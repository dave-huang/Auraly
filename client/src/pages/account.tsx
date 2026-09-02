import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowLeft, 
  User, 
  Zap, 
  RefreshCw,
  Loader2,
  Leaf,
  ShoppingCart,
  Package
} from "lucide-react";
import { NavigationMenu } from "@/components/navigation-menu";
import { PaywallModal } from "@/components/paywall-modal";
import { useSubscriptionStatus, usePurchaseScans } from "@/hooks/use-subscription";
import { format } from "date-fns";

function formatDate(dateString: string | undefined, lang: string = 'en') {
  if (!dateString) return '-';
  try {
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch {
    return '-';
  }
}

function formatTime(dateString: string | undefined) {
  if (!dateString) return '';
  try {
    return format(new Date(dateString), 'h:mm a');
  } catch {
    return '';
  }
}

export default function AccountPage() {
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.substring(0, 2) || 'en';
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  const { data: quota, isLoading } = useSubscriptionStatus();
  const purchaseScans = usePurchaseScans();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1.5 sm:gap-2 text-muted-foreground hover:text-foreground -ml-2"
            onClick={() => navigate("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-light text-sm sm:text-base">{t('common.back')}</span>
          </Button>
          <NavigationMenu showHomeLink />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-5 sm:py-10">
        <div className="flex items-center gap-2.5 mb-5 sm:mb-6">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl text-foreground">{t('account.title')}</h1>
        </div>

        <div className="space-y-4">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Zap className="w-4 h-4 text-primary flex-shrink-0" />
                {t('account.scanBalance', 'Scan Balance')}
              </CardTitle>
              <CardDescription className="text-sm mt-0.5">
                {t('account.scanBalanceDescription', 'Your available scans and daily limits')}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 border-b border-border/30 gap-1.5 sm:gap-4">
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-sm">{t('account.dailyFreeScans', 'Daily Free Scans')}</span>
                </div>
                <span className="font-medium text-foreground text-sm pl-9 sm:pl-0" data-testid="text-daily-scans">
                  {quota?.dailyFreeScansRemaining ?? 0} <span className="text-muted-foreground font-normal">/ {quota?.dailyFreeScansLimit ?? 2}</span>
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 border-b border-border/30 gap-1.5 sm:gap-4">
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <span className="text-sm">{t('account.nextReset', 'Free Scans Reset')}</span>
                </div>
                <span className="font-medium text-foreground text-sm pl-9 sm:pl-0" data-testid="text-next-reset">
                  {t('account.resetTomorrow', 'Tomorrow at midnight')}
                </span>
              </div>

              {(quota?.purchasedScanBalance ?? 0) > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 border-b border-border/30 gap-1.5 sm:gap-4">
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Package className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-sm">{t('account.purchasedScans', 'Purchased Scans')}</span>
                  </div>
                  <span className="font-medium text-foreground text-sm pl-9 sm:pl-0" data-testid="text-purchased-scans">
                    {quota?.purchasedScanBalance ?? 0}
                  </span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 gap-1.5 sm:gap-4">
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Leaf className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{t('account.totalAvailable', 'Total Available')}</span>
                </div>
                <span className="font-semibold text-foreground text-base pl-9 sm:pl-0" data-testid="text-total-scans">
                  {quota?.totalScansAvailable ?? 0} {t('account.scans', 'scans')}
                </span>
              </div>

              <div className="pt-3">
                <Button 
                  variant="outline"
                  className="w-full gap-2 h-11 font-medium rounded-xl" 
                  onClick={() => setShowPurchaseModal(true)}
                  data-testid="button-buy-scans"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {t('account.buyMoreScans', 'Buy More Scans')}
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>

      <PaywallModal 
        open={showPurchaseModal} 
        onClose={() => setShowPurchaseModal(false)} 
        source="account_page" 
      />
    </div>
  );
}
