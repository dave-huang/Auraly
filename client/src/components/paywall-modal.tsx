import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Sparkles, Loader2, Leaf, Zap } from 'lucide-react';
import { useStripeProducts, useCreateCheckout, useLogPaywallView, useSubscriptionStatus } from '@/hooks/use-subscription';
import { Badge } from '@/components/ui/badge';

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  source?: string;
}

export function PaywallModal({ open, onClose, source = 'unknown' }: PaywallModalProps) {
  const { t } = useTranslation();
  const { data: productsData, isLoading: loadingProducts } = useStripeProducts();
  const { data: status } = useSubscriptionStatus();
  const createCheckout = useCreateCheckout();
  const logPaywallView = useLogPaywallView();

  useEffect(() => {
    if (open) {
      logPaywallView.mutate(source);
    }
  }, [open, source]);

  const products = productsData?.products || [];
  const subscriptionProduct = products.find(p => p.metadata?.type === 'subscription');

  const handleSubscribe = () => {
    const price = subscriptionProduct?.prices[0];
    if (!price) return;
    createCheckout.mutate({ priceId: price.id, mode: 'subscription' });
  };

  const formatPrice = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden" data-testid="paywall-modal">
        <DialogHeader className="text-center px-6 pt-6 pb-4">
          <DialogTitle className="text-2xl font-display">
            {t('paywall.title', "You've used all your free scans")}
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            {t('paywall.description', 'Choose the plan that works best for you')}
          </DialogDescription>
        </DialogHeader>

        {loadingProducts ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Auraly Basic Card */}
              <div className="rounded-xl p-5 border border-border bg-card/50" data-testid="card-basic">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Leaf className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="font-semibold text-lg">Auraly Basic</span>
                </div>
                
                <div className="mb-4">
                  <span className="text-3xl font-bold">Free</span>
                </div>
                
                <ul className="space-y-3 mb-5 text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="text-muted-foreground/60 mt-0.5">•</span>
                    <span>{t('paywall.basic.scans', '5 scans per month')}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-muted-foreground/60 mt-0.5">•</span>
                    <span>{t('paywall.basic.analysis', 'Basic ingredient analysis')}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-muted-foreground/60 mt-0.5">•</span>
                    <span>{t('paywall.basic.history', 'Recent scan history')}</span>
                  </li>
                </ul>

                <Button 
                  variant="outline"
                  className="w-full" 
                  size="lg"
                  onClick={onClose}
                  data-testid="button-stay-basic"
                >
                  {t('paywall.stayBasic', 'Stay on Basic')}
                </Button>
              </div>

              {/* Auraly+ Card (Featured) */}
              <div className="relative rounded-xl p-5 border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-primary/8 to-primary/12" data-testid="card-plus">
                <Badge 
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-0.5"
                  data-testid="badge-recommended"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  {t('paywall.recommended', 'Recommended')}
                </Badge>

                <div className="flex items-center gap-2 mb-4 mt-1">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Crown className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-semibold text-lg">Auraly+</span>
                </div>
                
                <div className="mb-4">
                  <span className="text-3xl font-bold">
                    {subscriptionProduct?.prices[0] ? formatPrice(subscriptionProduct.prices[0].unitAmount) : '$4.99'}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                
                <ul className="space-y-3 mb-5">
                  <li className="flex items-start gap-3">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{t('paywall.plus.scans', 'Unlimited ingredient scans')}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{t('paywall.plus.personalization', 'Personalized analysis based on your preferences')}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{t('paywall.plus.history', 'Full scan history access')}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{t('paywall.plus.earlyAccess', 'Early access to new features')}</span>
                  </li>
                </ul>

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleSubscribe}
                  disabled={createCheckout.isPending || !subscriptionProduct?.prices[0]}
                  data-testid="button-subscribe"
                >
                  {createCheckout.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  {!subscriptionProduct?.prices[0] && !loadingProducts 
                    ? t('paywall.unavailable', 'Subscription unavailable')
                    : t('paywall.subscribe', 'Upgrade to Auraly+')}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              {t('paywall.cancelAnytime', 'Cancel anytime. No commitment required.')}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
