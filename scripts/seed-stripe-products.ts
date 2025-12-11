import { getUncachableStripeClient } from '../server/stripeClient';

async function createAuralyProducts() {
  const stripe = await getUncachableStripeClient();
  console.log('Connected to Stripe, creating Auraly products...');

  const existingProducts = await stripe.products.search({ query: "name:'Auraly+'" });
  if (existingProducts.data.length > 0) {
    console.log('Auraly+ product already exists, skipping...');
    console.log('Existing product ID:', existingProducts.data[0].id);
    return;
  }

  console.log('Creating Auraly+ subscription product...');
  const subscriptionProduct = await stripe.products.create({
    name: 'Auraly+',
    description: 'Unlimited ingredient scans, full history access, and personalized allergen settings.',
    metadata: {
      type: 'subscription',
      tier: 'premium',
    }
  });

  const monthlyPrice = await stripe.prices.create({
    product: subscriptionProduct.id,
    unit_amount: 499,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: {
      display_name: 'Auraly+ Monthly',
    }
  });

  console.log('Created Auraly+ subscription:');
  console.log('  Product ID:', subscriptionProduct.id);
  console.log('  Monthly Price ID:', monthlyPrice.id);

  console.log('\nCreating Scan Pack products...');

  const scanPack20 = await stripe.products.create({
    name: 'Scan Pack - 20 Scans',
    description: '20 additional ingredient scans. Never expires.',
    metadata: {
      type: 'scan_pack',
      scanCount: '20',
    }
  });

  const scanPack20Price = await stripe.prices.create({
    product: scanPack20.id,
    unit_amount: 299,
    currency: 'usd',
    metadata: {
      scanPackSize: '20',
    }
  });

  console.log('  Scan Pack 20: Product ID:', scanPack20.id, 'Price ID:', scanPack20Price.id);

  const scanPack50 = await stripe.products.create({
    name: 'Scan Pack - 50 Scans',
    description: '50 additional ingredient scans. Never expires. Best value!',
    metadata: {
      type: 'scan_pack',
      scanCount: '50',
    }
  });

  const scanPack50Price = await stripe.prices.create({
    product: scanPack50.id,
    unit_amount: 499,
    currency: 'usd',
    metadata: {
      scanPackSize: '50',
    }
  });

  console.log('  Scan Pack 50: Product ID:', scanPack50.id, 'Price ID:', scanPack50Price.id);

  const scanPack120 = await stripe.products.create({
    name: 'Scan Pack - 120 Scans',
    description: '120 additional ingredient scans. Never expires. Premium value!',
    metadata: {
      type: 'scan_pack',
      scanCount: '120',
    }
  });

  const scanPack120Price = await stripe.prices.create({
    product: scanPack120.id,
    unit_amount: 999,
    currency: 'usd',
    metadata: {
      scanPackSize: '120',
    }
  });

  console.log('  Scan Pack 120: Product ID:', scanPack120.id, 'Price ID:', scanPack120Price.id);

  console.log('\n✅ All Auraly products created successfully!');
  console.log('\nProduct Summary:');
  console.log('----------------');
  console.log('Auraly+ Monthly: $4.99/month');
  console.log('Scan Pack 20: $2.99 (one-time)');
  console.log('Scan Pack 50: $4.99 (one-time)');
  console.log('Scan Pack 120: $9.99 (one-time)');
}

createAuralyProducts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error creating products:', error);
    process.exit(1);
  });
