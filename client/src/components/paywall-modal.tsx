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
  reason?: 'out_of_scans' | 'voluntary_upgrade';
}

export function PaywallModal({ open, onClose, source = 'unknown', reason = 'voluntary_upgrade' }: PaywallModalProps) {
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

  // Show different titles based on why the paywall was triggered
  const title = reason === 'out_of_scans' 
    ? t('paywall.titleOutOfScans', "You've used all your free scans")
    : t('paywall.titleUpgrade', "Upgrade to Auraly+");
  
  const description = reason === 'out_of_scans'
    ? t('paywall.descriptionOutOfScans', 'Upgrade now to continue scanning or wait for your monthly refresh')
    : t('paywall.description', 'Choose the plan that works best for you');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden max-h-[90vh] overflow-y-auto" data-testid="paywall-modal">
        <DialogHeader className="text-center px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4">
          <DialogTitle className="text-xl sm:text-2xl font-display">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base mt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        {loadingProducts ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="px-4 sm:px-6 pb-5 sm:pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* Auraly+ Card (Featured) - Shows first on mobile via order */}
              <div className="relative flex flex-col rounded-xl p-4 sm:p-5 pt-6 sm:pt-7 border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-primary/8 to-primary/12 order-1 md:order-2" data-testid="card-plus">
                <Badge 
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-0.5 flex items-center justify-center"
                  data-testid="badge-recommended"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  {t('paywall.recommended', 'Recommended')}
                </Badge>

                <div className="flex items-center gap-2 min-h-[2.5rem]">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Crown className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-semibold text-lg">{t('paywall.plusName', 'Auraly+')}</span>
                </div>
                
                <div className="min-h-[3rem] flex items-center mt-2">
                  <span className="text-2xl sm:text-3xl font-bold">
                    {subscriptionProduct?.prices[0] ? formatPrice(subscriptionProduct.prices[0].unitAmount) : '$4.99'}
                  </span>
                  <span className="text-muted-foreground ml-1">{t('paywall.perMonth', '/month')}</span>
                </div>
                
                <ul className="space-y-2.5 sm:space-y-3 mt-3 sm:mt-4 mb-4 sm:mb-6 flex-grow text-sm sm:text-base">
                  <li className="flex items-start gap-2.5 sm:gap-3">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{t('paywall.plus.scans', 'Unlimited scans')}</span>
                  </li>
                  <li className="flex items-start gap-2.5 sm:gap-3">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{t('paywall.plus.personalization', 'Personalized allergen and ingredient alerts')}</span>
                  </li>
                  <li className="flex items-start gap-2.5 sm:gap-3">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{t('paywall.plus.history', 'Full scan history access')}</span>
                  </li>
                  <li className="flex items-start gap-2.5 sm:gap-3">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{t('paywall.plus.earlyAccess', 'Early access to new features')}</span>
                  </li>
                </ul>

                <Button 
                  className="w-full mt-auto" 
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

              {/* Auraly Basic Card - Shows second on mobile via order */}
              <div className="flex flex-col rounded-xl p-4 sm:p-5 pt-4 sm:pt-5 md:pt-12 border border-border bg-card/50 order-2 md:order-1" data-testid="card-basic">
                <div className="flex items-center gap-2 min-h-[2.5rem]">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Leaf className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="font-semibold text-lg">{t('paywall.basicName', 'Auraly Basic')}</span>
                </div>
                
                <div className="min-h-[3rem] flex items-center mt-2">
                  <span className="text-2xl sm:text-3xl font-bold">{t('paywall.free', 'Free')}</span>
                </div>
                
                <ul className="space-y-2.5 sm:space-y-3 mt-3 sm:mt-4 mb-4 sm:mb-6 flex-grow text-muted-foreground text-sm sm:text-base">
                  <li className="flex items-start gap-2.5 sm:gap-3">
                    <span className="text-muted-foreground/60 mt-0.5">•</span>
                    <span>{t('paywall.basic.scans', '5 scans per month')}</span>
                  </li>
                  <li className="flex items-start gap-2.5 sm:gap-3">
                    <span className="text-muted-foreground/60 mt-0.5">•</span>
                    <span>{t('paywall.basic.analysis', 'Basic ingredient analysis')}</span>
                  </li>
                </ul>

                <Button 
                  variant="outline"
                  className="w-full mt-auto" 
                  size="lg"
                  onClick={onClose}
                  data-testid="button-stay-basic"
                >
                  {t('paywall.stayBasic', 'Stay on Basic')}
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
