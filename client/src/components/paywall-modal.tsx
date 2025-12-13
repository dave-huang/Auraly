import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Crown, Sparkles, History, Settings, Loader2 } from 'lucide-react';
import { useStripeProducts, useCreateCheckout, useLogPaywallView, useSubscriptionStatus } from '@/hooks/use-subscription';

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

  const getResetDateString = () => {
    if (!status?.nextResetDate) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      return nextMonth.toLocaleDateString();
    }
    return new Date(status.nextResetDate).toLocaleDateString();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md" data-testid="paywall-modal">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Crown className="w-7 h-7 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-display">
            {t('paywall.title', "You've used all 5 free scans this month")}
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            {t('paywall.description', 'Upgrade to Auraly+ for unlimited scans and personalized ingredient analysis.')}
          </DialogDescription>
        </DialogHeader>

        {loadingProducts ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-5 border border-primary/20">
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-5 h-5 text-primary" />
                <span className="font-semibold text-lg">Auraly+</span>
              </div>
              
              <div className="mb-4">
                <span className="text-3xl font-bold">
                  {subscriptionProduct?.prices[0] ? formatPrice(subscriptionProduct.prices[0].unitAmount) : '$4.99'}
                </span>
                <span className="text-muted-foreground">/month</span>
              </div>
              
              <ul className="space-y-3 mb-5">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span>{t('paywall.unlimitedScans', 'Unlimited ingredient scans')}</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span>{t('paywall.personalization', 'Personalized allergen analysis')}</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span>{t('paywall.fullHistory', 'Full scan history access')}</span>
                </li>
              </ul>

              <Button 
                className="w-full" 
                size="lg"
                onClick={handleSubscribe}
                disabled={createCheckout.isPending}
                data-testid="button-subscribe"
              >
                {createCheckout.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {t('paywall.subscribe', 'Upgrade to Auraly+')}
              </Button>
            </div>

            <div className="text-center">
              <Button 
                variant="ghost" 
                onClick={onClose}
                className="text-muted-foreground"
                data-testid="button-cancel-paywall"
              >
                {t('paywall.cancel', 'Cancel')}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {t('paywall.resetNote', 'Your quota resets on {{date}}', { date: getResetDateString() })}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
