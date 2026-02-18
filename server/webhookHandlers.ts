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
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
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

  if (mode === 'payment' && metadata.scansToAdd) {
    const scansToAdd = parseInt(metadata.scansToAdd, 10);
    
    await db.update(users)
      .set({
        purchasedScanBalance: sql`${users.purchasedScanBalance} + ${scansToAdd}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await db.insert(purchaseLogs).values({
      userId: user.id,
      purchaseType: 'scan_bundle',
      amount: session.amount_total,
      currency: session.currency,
      scansAdded: scansToAdd,
      stripeCheckoutSessionId: session.id,
      status: 'completed',
      metadata: { scansToAdd },
    });

    console.log(`Added ${scansToAdd} scans to user ${user.id} (new balance: ${(user.purchasedScanBalance || 0) + scansToAdd})`);
  }
}
