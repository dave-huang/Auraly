import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { db } from './db';
import { users, purchaseLogs } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature, uuid);

    const stripe = await getUncachableStripeClient();
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      await getWebhookSecret(uuid)
    );

    await handleStripeEvent(event);
  }
}

async function getWebhookSecret(uuid: string): Promise<string> {
  const sync = await getStripeSync();
  const webhooks = await sync.listManagedWebhooks();
  const webhook = webhooks.find((w: any) => w.uuid === uuid);
  if (!webhook) {
    throw new Error('Webhook not found for UUID: ' + uuid);
  }
  return webhook.secret;
}

async function handleStripeEvent(event: any): Promise<void> {
  console.log(`Processing Stripe event: ${event.type}`);

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionCancelled(event.data.object);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;

    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

async function handleSubscriptionUpdate(subscription: any): Promise<void> {
  const customerId = subscription.customer;
  const status = subscription.status;

  const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
  if (!user) {
    console.log(`No user found for customer: ${customerId}`);
    return;
  }

  let subscriptionStatus: 'free' | 'active' | 'cancelled' | 'past_due' = 'free';
  if (status === 'active' || status === 'trialing') {
    subscriptionStatus = 'active';
  } else if (status === 'past_due') {
    subscriptionStatus = 'past_due';
  } else if (status === 'canceled' || status === 'unpaid') {
    subscriptionStatus = 'cancelled';
  }

  await db.update(users)
    .set({
      stripeSubscriptionId: subscription.id,
      subscriptionStatus,
      subscriptionStartedAt: new Date(subscription.start_date * 1000),
      subscriptionEndsAt: subscription.current_period_end 
        ? new Date(subscription.current_period_end * 1000) 
        : null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  console.log(`Updated subscription for user ${user.id}: ${subscriptionStatus}`);
}

async function handleSubscriptionCancelled(subscription: any): Promise<void> {
  const customerId = subscription.customer;

  const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
  if (!user) {
    console.log(`No user found for customer: ${customerId}`);
    return;
  }

  await db.update(users)
    .set({
      subscriptionStatus: 'cancelled',
      subscriptionEndsAt: subscription.current_period_end 
        ? new Date(subscription.current_period_end * 1000) 
        : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  console.log(`Cancelled subscription for user ${user.id}`);
}

async function handlePaymentFailed(invoice: any): Promise<void> {
  const customerId = invoice.customer;

  const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
  if (!user) {
    console.log(`No user found for customer: ${customerId}`);
    return;
  }

  await db.update(users)
    .set({
      subscriptionStatus: 'past_due',
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  console.log(`Payment failed for user ${user.id}`);
}

async function handleCheckoutCompleted(session: any): Promise<void> {
  const customerId = session.customer;
  const mode = session.mode;
  const metadata = session.metadata || {};

  const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
  if (!user) {
    console.log(`No user found for customer: ${customerId}`);
    return;
  }

  if (mode === 'payment' && metadata.scanPackSize) {
    const scansToAdd = parseInt(metadata.scanPackSize, 10);
    
    await db.update(users)
      .set({
        scanPackBalance: sql`${users.scanPackBalance} + ${scansToAdd}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await db.insert(purchaseLogs).values({
      userId: user.id,
      purchaseType: 'scan_pack',
      amount: session.amount_total,
      currency: session.currency,
      scansAdded: scansToAdd,
      stripeCheckoutSessionId: session.id,
      status: 'completed',
      metadata: { scanPackSize: scansToAdd },
    });

    console.log(`Added ${scansToAdd} scans to user ${user.id}`);
  } else if (mode === 'subscription') {
    await db.insert(purchaseLogs).values({
      userId: user.id,
      purchaseType: 'subscription',
      amount: session.amount_total,
      currency: session.currency,
      stripeCheckoutSessionId: session.id,
      status: 'completed',
    });

    console.log(`Subscription purchase logged for user ${user.id}`);
  }
}
