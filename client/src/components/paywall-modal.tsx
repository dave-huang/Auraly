import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, Package } from 'lucide-react';
import { usePurchaseScans, useLogPurchasePromptView } from '@/hooks/use-subscription';
import { trackPurchasePromptView, trackPurchaseClick } from '@/lib/analytics';

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
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden" data-testid="paywall-modal">
        <DialogHeader className="text-center px-6 pt-6 pb-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
            <Zap className="w-6 h-6 text-amber-500" />
          </div>
          <DialogTitle className="text-xl font-display" data-testid="text-purchase-title">
            {t('scanPurchase.title', 'Out of scans')}
          </DialogTitle>
          <DialogDescription className="text-sm mt-2">
            {t('scanPurchase.description', 'You get 2 free scans every day. Want more?')}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          <div className="rounded-xl p-4 border border-border/40 bg-card/50 mb-4" data-testid="card-scan-bundle">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-base">
                  {t('scanPurchase.bundleName', '10 Scan Bundle')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('scanPurchase.neverExpire', 'Scans never expire')}
                </div>
              </div>
              <div className="font-bold text-lg" data-testid="text-bundle-price">
                {t('scanPurchase.bundlePrice', '$2.99')}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              className="w-full"
              size="lg"
              onClick={handleBuyNow}
              disabled={purchaseScans.isPending}
              data-testid="button-buy-scans"
            >
              {purchaseScans.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              {t('scanPurchase.buyNow', 'Buy Now')}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              size="lg"
              onClick={onClose}
              data-testid="button-not-now"
            >
              {t('scanPurchase.notNow', 'Not Now')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const PaywallModal = ScanPurchaseModal;
