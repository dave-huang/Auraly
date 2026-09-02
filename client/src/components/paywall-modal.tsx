import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Leaf, Sparkles, Infinity } from 'lucide-react';
import { usePurchaseScans, useLogPurchasePromptView } from '@/hooks/use-subscription';
import { trackPurchasePromptView, trackPurchaseClick } from '@/lib/analytics';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface ScanPurchaseModalProps {
  open: boolean;
  onClose: () => void;
  source?: string;
}

export function ScanPurchaseModal({ open, onClose, source = 'unknown' }: ScanPurchaseModalProps) {
  const { t } = useTranslation();
  const purchaseScans = usePurchaseScans();
  const logPurchasePromptView = useLogPurchasePromptView();

  useEffect(() => {
    if (open) {
      logPurchasePromptView.mutate(source);
      trackPurchasePromptView(source);
    }
  }, [open, source]);

  const handleBuyNow = () => {
    trackPurchaseClick('scan_bundle_10');
    purchaseScans.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-visible border-border/50 rounded-2xl [&>button]:z-50 [&>button]:bg-background/50 [&>button]:backdrop-blur-sm [&>button]:rounded-full [&>button]:p-1" data-testid="paywall-modal">
        <VisuallyHidden>
          <DialogTitle>{t('scanPurchase.title', 'Get More Scans')}</DialogTitle>
          <DialogDescription>{t('scanPurchase.description', 'Add scans to your balance.')}</DialogDescription>
        </VisuallyHidden>
        
        <div className="relative overflow-hidden rounded-2xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl translate-x-1/3 -translate-y-1/4" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl -translate-x-1/3 translate-y-1/4" />

          <div className="relative z-10 text-center px-6 pt-8 pb-4">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Leaf className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-display text-2xl text-foreground mb-2" data-testid="text-purchase-title">
              {t('scanPurchase.title', 'Get More Scans')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
              {t('scanPurchase.description', 'Add scans to your balance. You also get 2 free scans every day.')}
            </p>
          </div>

          <div className="relative z-10 px-6 pb-6">
            <div className="rounded-2xl p-4 bg-card border border-border/50 mb-5" data-testid="card-scan-bundle">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {t('scanPurchase.bundleName', '10 Scan Bundle')}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Infinity className="w-3 h-3" />
                    {t('scanPurchase.neverExpire', 'Scans never expire')}
                  </div>
                </div>
                <div className="font-display text-xl text-foreground" data-testid="text-bundle-price">
                  {t('scanPurchase.bundlePrice', '$2.99')}
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-5">
              <Button
                className="w-full rounded-full shadow-sm"
                size="lg"
                onClick={handleBuyNow}
                disabled={purchaseScans.isPending}
                data-testid="button-buy-scans"
              >
                {purchaseScans.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {t('scanPurchase.buyNow', 'Buy Now')}
              </Button>
              <Button
                variant="ghost"
                className="w-full rounded-full"
                size="lg"
                onClick={onClose}
                data-testid="button-not-now"
              >
                {t('scanPurchase.notNow', 'Not Now')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const PaywallModal = ScanPurchaseModal;
