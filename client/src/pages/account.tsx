import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  User, 
  Crown, 
  CreditCard, 
  Calendar, 
  Zap, 
  RefreshCw,
  ExternalLink,
  Loader2,
  Clock,
  Leaf,
  Sparkles
} from "lucide-react";
import { NavigationMenu } from "@/components/navigation-menu";
import { PaywallModal } from "@/components/paywall-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface SubscriptionData {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  subscriptionStatus: string;
  monthlyFreeScansUsed: number;
  scanPackBalance: number;
  nextFreeScansRefresh: string;
  createdAt: string;
  trialEndsAt?: string;
  trialDaysRemaining?: number;
  subscriptionEndsAt?: string;
  nextBillingDate?: string;
  accessUntil?: string;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string;
  billingAmount?: number;
  billingCurrency?: string;
  billingInterval?: string;
  paymentMethod?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isAdminGrantedPremium?: boolean;
}

function formatCurrency(amount: number, currency: string = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(dateString: string | undefined, lang: string = 'en') {
  if (!dateString) return '-';
  try {
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch {
    return '-';
  }
}

function capitalizeCardBrand(brand: string | undefined) {
  if (!brand) return '';
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

export default function AccountPage() {
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const lang = i18n.language?.substring(0, 2) || 'en';
  const [showPaywall, setShowPaywall] = useState(false);

  const { data: subscription, isLoading, refetch } = useQuery<SubscriptionData>({
    queryKey: ['/api/account/subscription'],
  });

  const billingPortalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/account/billing-portal', {
        returnUrl: window.location.href
      });
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      // Use direct navigation instead of window.open to avoid mobile popup blockers
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({
        title: t('account.billingPortalError'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getPlanBadge = () => {
    if (!subscription) return null;
    
    const status = subscription.subscriptionStatus;
    
    // Show "Cancelled" badge if subscription is cancelled but still active
    if (status === 'active' && subscription.cancelAtPeriodEnd && !subscription.isAdminGrantedPremium) {
      return (
        <Badge className="bg-stone-100 text-stone-600 border-stone-200/60 dark:bg-stone-800/30 dark:text-stone-400 dark:border-stone-600/30 gap-1.5 px-2.5 py-0.5 text-xs font-medium" data-testid="badge-plan">
          <Clock className="w-3 h-3" />
          {t('account.cancelled')}
        </Badge>
      );
    }
    
    if (status === 'active' || subscription.isAdminGrantedPremium) {
      return (
        <Badge className="bg-primary/10 text-primary border-primary/15 gap-1 px-2 py-0.5 text-xs font-medium" data-testid="badge-plan">
          <Crown className="w-3 h-3" />
          Auraly+
        </Badge>
      );
    }
    
    if (status === 'trial') {
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700/30 gap-1 px-2 py-0.5 text-xs font-medium" data-testid="badge-plan">
          <Sparkles className="w-3 h-3" />
          Auraly+ Trial
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs font-medium bg-muted/50" data-testid="badge-plan">
        <Leaf className="w-3 h-3" />
        Auraly Basic
      </Badge>
    );
  };

  const renderSubscriptionDetails = () => {
    if (!subscription) return null;
    
    const status = subscription.subscriptionStatus;
    
    if (status === 'trial') {
      return (
        <div className="space-y-4">
          {/* Trial ends row - stacked on mobile for better readability */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 gap-1.5 sm:gap-4">
            <div className="flex items-center gap-2.5 text-muted-foreground">
              <div className="w-7 h-7 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-sm">{t('account.trialEnds')}</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-0 pl-9 sm:pl-0" data-testid="text-trial-ends">
              <span className="font-medium text-foreground text-sm">
                {formatDate(subscription.trialEndsAt, lang)}
              </span>
              {subscription.trialDaysRemaining !== undefined && (
                <span className="text-amber-600 dark:text-amber-400 text-xs font-normal whitespace-nowrap ml-1.5">
                  ({subscription.trialDaysRemaining} {t('account.daysLeft')})
                </span>
              )}
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('account.trialDescription')}
            </p>
          </div>
          
          <Button 
            className="w-full gap-2 h-11 font-medium rounded-xl" 
            onClick={() => setShowPaywall(true)}
            data-testid="button-upgrade"
          >
            <Crown className="w-4 h-4" />
            {t('account.upgradeToPremium')}
          </Button>
        </div>
      );
    }
    
    if (status === 'active' && !subscription.isAdminGrantedPremium) {
      const isCancelled = subscription.cancelAtPeriodEnd;
      
      return (
        <div className="space-y-0">
          {/* Cancelled notice - uses warm earth tones matching wellness aesthetic */}
          {isCancelled && (
            <div className="p-3.5 mb-4 rounded-xl bg-gradient-to-br from-stone-50 to-stone-100/80 dark:from-stone-800/20 dark:to-stone-700/10 border border-stone-200/60 dark:border-stone-600/30">
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                {t('account.cancelledDescription')}
              </p>
            </div>
          )}
          
          {/* Access until / Next billing row - responsive layout */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 border-b border-border/30 gap-1.5 sm:gap-4">
            <div className="flex items-center gap-2.5 text-muted-foreground">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isCancelled ? 'bg-stone-100 dark:bg-stone-800/30' : 'bg-primary/10'}`}>
                <Calendar className={`w-3.5 h-3.5 ${isCancelled ? 'text-stone-500 dark:text-stone-400' : 'text-primary'}`} />
              </div>
              <span className="text-sm">
                {isCancelled ? t('account.accessUntil') : t('account.nextBilling')}
              </span>
            </div>
            <span className="font-medium text-foreground text-sm pl-9 sm:pl-0" data-testid={isCancelled ? "text-access-until" : "text-next-billing"}>
              {formatDate(isCancelled ? subscription.accessUntil : subscription.nextBillingDate, lang)}
            </span>
          </div>
          
          {/* Only show billing amount if not cancelled */}
          {!isCancelled && subscription.billingAmount && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 border-b border-border/30 gap-1.5 sm:gap-4">
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-sm">{t('account.billingAmount')}</span>
              </div>
              <span className="font-medium text-foreground text-sm pl-9 sm:pl-0" data-testid="text-billing-amount">
                {formatCurrency(subscription.billingAmount, subscription.billingCurrency)}
                <span className="text-muted-foreground font-normal">
                  /{subscription.billingInterval === 'year' ? 'yr' : 'mo'}
                </span>
              </span>
            </div>
          )}
          
          {/* Only show payment method if not cancelled */}
          {!isCancelled && subscription.paymentMethod && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 border-b border-border/30 gap-1.5 sm:gap-4">
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-sm">{t('account.paymentMethod')}</span>
              </div>
              <span className="font-medium text-foreground text-sm pl-9 sm:pl-0" data-testid="text-payment-method">
                {capitalizeCardBrand(subscription.paymentMethod.brand)} •••• {subscription.paymentMethod.last4}
              </span>
            </div>
          )}
          
          <div className="pt-3">
            <Button 
              variant={isCancelled ? "default" : "outline"}
              className="w-full gap-2 h-10 rounded-xl"
              onClick={() => billingPortalMutation.mutate()}
              disabled={billingPortalMutation.isPending}
              data-testid={isCancelled ? "button-resubscribe" : "button-manage-billing"}
            >
              {billingPortalMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isCancelled ? (
                <RefreshCw className="w-4 h-4" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              {isCancelled ? t('account.resubscribe') : t('account.manageBilling')}
            </Button>
          </div>
        </div>
      );
    }
    
    if (subscription.isAdminGrantedPremium) {
      return (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Crown className="w-3.5 h-3.5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('account.adminGrantedDescription')}
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="space-y-0">
        {/* Free scans used - responsive layout */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 border-b border-border/30 gap-1.5 sm:gap-4">
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <span className="text-sm">{t('account.freeScansUsed')}</span>
          </div>
          <span className="font-medium text-foreground text-sm pl-9 sm:pl-0" data-testid="text-scans-used">
            {subscription.monthlyFreeScansUsed} <span className="text-muted-foreground font-normal">/ 5</span>
          </span>
        </div>
        
        {/* Scans refresh - responsive layout */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 border-b border-border/30 gap-1.5 sm:gap-4">
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <span className="text-sm">{t('account.scansRefresh')}</span>
          </div>
          <span className="font-medium text-foreground text-sm pl-9 sm:pl-0" data-testid="text-scans-refresh">
            {formatDate(subscription.nextFreeScansRefresh, lang)}
          </span>
        </div>
        
        {subscription.scanPackBalance > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 border-b border-border/30 gap-1.5 sm:gap-4">
            <div className="flex items-center gap-2.5 text-muted-foreground">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-sm">{t('account.scanPackBalance')}</span>
            </div>
            <span className="font-medium text-foreground text-sm pl-9 sm:pl-0" data-testid="text-scan-pack-balance">
              {subscription.scanPackBalance}
            </span>
          </div>
        )}
        
        <div className="pt-3">
          <Button 
            className="w-full gap-2 h-11 font-medium rounded-xl" 
            onClick={() => setShowPaywall(true)}
            data-testid="button-upgrade"
          >
            <Crown className="w-4 h-4" />
            {t('account.upgradeToPremium')}
          </Button>
        </div>
      </div>
    );
  };

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
                <User className="w-4 h-4 text-primary flex-shrink-0" />
                {t('account.accountInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              {/* Email row - responsive */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 border-b border-border/30 gap-1 sm:gap-4">
                <span className="text-sm text-muted-foreground">{t('account.email')}</span>
                <span className="font-medium text-foreground text-sm break-all sm:break-normal" data-testid="text-email">
                  {subscription?.email || '-'}
                </span>
              </div>
              
              {(subscription?.firstName || subscription?.lastName) && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 border-b border-border/30 gap-1 sm:gap-4">
                  <span className="text-sm text-muted-foreground">{t('account.name')}</span>
                  <span className="font-medium text-foreground text-sm" data-testid="text-name">
                    {[subscription?.firstName, subscription?.lastName].filter(Boolean).join(' ')}
                  </span>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 gap-1 sm:gap-4">
                <span className="text-sm text-muted-foreground">{t('account.memberSince')}</span>
                <span className="font-medium text-foreground text-sm" data-testid="text-member-since">
                  {formatDate(subscription?.createdAt, lang)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="pb-1">
              <div className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <Crown className="w-4 h-4 text-primary flex-shrink-0" />
                  {t('account.subscription')}
                </CardTitle>
                {getPlanBadge()}
              </div>
              <CardDescription className="text-sm mt-0.5">
                {t('account.subscriptionDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-1">
              {renderSubscriptionDetails()}
            </CardContent>
          </Card>
        </div>
      </main>

      <PaywallModal 
        open={showPaywall} 
        onClose={() => setShowPaywall(false)} 
        source="account_page" 
      />
    </div>
  );
}
