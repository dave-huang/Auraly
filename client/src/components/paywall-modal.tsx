import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Leaf, Sparkles, Tag, Check, Infinity } from 'lucide-react';
import { usePurchaseScans, useLogPurchasePromptView } from '@/hooks/use-subscription';
import { trackPurchasePromptView, trackPurchaseClick } from '@/lib/analytics';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

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
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-visible border-border/50 rounded-2xl" data-testid="paywall-modal">
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

            <div className="pt-4 border-t border-border/30">
              <div className="flex items-center gap-2 mb-2.5">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {t('promo.label', 'Have a promo code?')}
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder={t('promo.placeholder', 'Enter code')}
                  className="flex-1 uppercase rounded-full"
                  disabled={redeemPromo.isPending || promoSuccess}
                  onKeyDown={(e) => e.key === 'Enter' && handleRedeemPromo()}
                  data-testid="input-promo-code"
                />
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={handleRedeemPromo}
                  disabled={!promoCode.trim() || redeemPromo.isPending || promoSuccess}
                  data-testid="button-redeem-promo"
                >
                  {redeemPromo.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : promoSuccess ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    t('promo.redeem', 'Redeem')
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const PaywallModal = ScanPurchaseModal;
