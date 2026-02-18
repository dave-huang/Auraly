import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Zap, Package, Tag, Check } from 'lucide-react';
import { usePurchaseScans, useLogPurchasePromptView } from '@/hooks/use-subscription';
import { trackPurchasePromptView, trackPurchaseClick } from '@/lib/analytics';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ScanPurchaseModalProps {
  open: boolean;
  onClose: () => void;
  source?: string;
}

export function ScanPurchaseModal({ open, onClose, source = 'unknown' }: ScanPurchaseModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const purchaseScans = usePurchaseScans();
  const logPurchasePromptView = useLogPurchasePromptView();
  const [promoCode, setPromoCode] = useState('');
  const [promoSuccess, setPromoSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      logPurchasePromptView.mutate(source);
      trackPurchasePromptView(source);
      setPromoCode('');
      setPromoSuccess(false);
    }
  }, [open, source]);

  const redeemPromo = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest('POST', '/api/scan/redeem', { code });
      return res.json();
    },
    onSuccess: (data) => {
      setPromoSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['/api/scan/quota'] });
      toast({
        title: t('promo.successTitle', 'Promo Code Redeemed!'),
        description: t('promo.successDesc', '{{count}} scans have been added to your balance.', { count: data.scansGranted }),
      });
      setTimeout(() => onClose(), 1500);
    },
    onError: async (error: any) => {
      let message = t('promo.errorGeneric', 'Failed to redeem promo code');
      try {
        const raw = error?.message || '';
        const jsonPart = raw.substring(raw.indexOf('{'));
        if (jsonPart) {
          const parsed = JSON.parse(jsonPart);
          if (parsed.error) message = parsed.error;
        }
      } catch {}
      toast({
        title: t('promo.errorTitle', 'Invalid Code'),
        description: message,
        variant: 'destructive',
      });
    },
  });

  const handleBuyNow = () => {
    trackPurchaseClick('scan_bundle_10');
    purchaseScans.mutate();
  };

  const handleRedeemPromo = () => {
    if (promoCode.trim()) {
      redeemPromo.mutate(promoCode.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden" data-testid="paywall-modal">
        <DialogHeader className="text-center px-6 pt-6 pb-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
            <Zap className="w-6 h-6 text-amber-500" />
          </div>
          <DialogTitle className="text-xl font-display" data-testid="text-purchase-title">
            {t('scanPurchase.title', 'Get More Scans')}
          </DialogTitle>
          <DialogDescription className="text-sm mt-2">
            {t('scanPurchase.description', 'Add scans to your balance. You also get 2 free scans every day.')}
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

          <div className="mt-4 pt-4 border-t border-border/40">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                {t('promo.label', 'Have a promo code?')}
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder={t('promo.placeholder', 'Enter code')}
                className="flex-1 uppercase"
                disabled={redeemPromo.isPending || promoSuccess}
                onKeyDown={(e) => e.key === 'Enter' && handleRedeemPromo()}
                data-testid="input-promo-code"
              />
              <Button
                variant="outline"
                onClick={handleRedeemPromo}
                disabled={!promoCode.trim() || redeemPromo.isPending || promoSuccess}
                data-testid="button-redeem-promo"
              >
                {redeemPromo.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : promoSuccess ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  t('promo.redeem', 'Redeem')
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const PaywallModal = ScanPurchaseModal;
