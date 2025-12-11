import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Sparkles, Zap, History, Settings, Loader2 } from 'lucide-react';
import { useStripeProducts, useCreateCheckout, useLogPaywallView, type StripeProduct } from '@/hooks/use-subscription';

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  source?: string;
}

export function PaywallModal({ open, onClose, source = 'unknown' }: PaywallModalProps) {
  const { t } = useTranslation();
  const { data: productsData, isLoading: loadingProducts } = useStripeProducts();
  const createCheckout = useCreateCheckout();
  const logPaywallView = useLogPaywallView();
  const [selectedOption, setSelectedOption] = useState<'subscription' | 'pack20' | 'pack50' | 'pack120' | null>(null);

  useEffect(() => {
    if (open) {
      logPaywallView.mutate(source);
    }
  }, [open, source]);

  const products = productsData?.products || [];
  
  const subscriptionProduct = products.find(p => p.metadata?.type === 'subscription');
  const scanPacks = products.filter(p => p.metadata?.type === 'scan_pack');

  const handleSubscribe = () => {
    const price = subscriptionProduct?.prices[0];
    if (!price) return;
    createCheckout.mutate({ priceId: price.id, mode: 'subscription' });
  };

  const handleBuyScanPack = (product: StripeProduct) => {
    const price = product.prices[0];
    if (!price) return;
    const scanCount = parseInt(product.metadata?.scanCount || '0', 10);
    createCheckout.mutate({ priceId: price.id, mode: 'payment', scanPackSize: scanCount });
  };

  const formatPrice = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="paywall-modal">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Crown className="w-6 h-6 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-display">
            {t('paywall.title', 'Unlock Full Access')}
          </DialogTitle>
          <DialogDescription>
            {t('paywall.description', "You've used all your free scans this month. Upgrade to continue scanning.")}
          </DialogDescription>
        </DialogHeader>

        {loadingProducts ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <Card 
              className={`p-4 cursor-pointer transition-all border-2 ${
                selectedOption === 'subscription' ? 'border-primary ring-2 ring-primary/20' : 'border-border'
              }`}
              onClick={() => setSelectedOption('subscription')}
              data-testid="option-subscription"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Auraly+</span>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  {t('paywall.bestValue', 'Best Value')}
                </Badge>
              </div>
              
              <div className="mb-3">
                <span className="text-2xl font-bold">
                  {subscriptionProduct?.prices[0] ? formatPrice(subscriptionProduct.prices[0].unitAmount) : '$4.99'}
                </span>
                <span className="text-muted-foreground">/month</span>
              </div>
              
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span>{t('paywall.unlimitedScans', 'Unlimited ingredient scans')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" />
                  <span>{t('paywall.fullHistory', 'Full scan history access')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-primary" />
                  <span>{t('paywall.personalization', 'Personalized allergen settings')}</span>
                </li>
              </ul>

              <Button 
                className="w-full mt-4" 
                onClick={handleSubscribe}
                disabled={createCheckout.isPending}
                data-testid="button-subscribe"
              >
                {createCheckout.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {t('paywall.subscribe', 'Subscribe to Auraly+')}
              </Button>
            </Card>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {t('paywall.or', 'Or buy scan packs')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {scanPacks.sort((a, b) => {
                const countA = parseInt(a.metadata?.scanCount || '0', 10);
                const countB = parseInt(b.metadata?.scanCount || '0', 10);
                return countA - countB;
              }).map((pack) => {
                const scanCount = pack.metadata?.scanCount || '0';
                const price = pack.prices[0];
                const packKey = `pack${scanCount}` as 'pack20' | 'pack50' | 'pack120';
                
                return (
                  <Card
                    key={pack.id}
                    className={`p-3 cursor-pointer transition-all border-2 text-center ${
                      selectedOption === packKey ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                    }`}
                    onClick={() => setSelectedOption(packKey)}
                    data-testid={`option-${packKey}`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className="font-bold">{scanCount}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">scans</div>
                    <div className="font-semibold">
                      {price ? formatPrice(price.unitAmount) : '-'}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBuyScanPack(pack);
                      }}
                      disabled={createCheckout.isPending}
                      data-testid={`button-buy-${packKey}`}
                    >
                      Buy
                    </Button>
                  </Card>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              {t('paywall.termsNote', 'By subscribing, you agree to our terms of service. Cancel anytime.')}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
