import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Leaf
} from "lucide-react";
import { NavigationMenu } from "@/components/navigation-menu";
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
      window.open(data.url, '_blank');
      setTimeout(() => refetch(), 2000);
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
    
    if (status === 'active' || subscription.isAdminGrantedPremium) {
      return (
        <Badge className="bg-primary/10 text-primary gap-1" data-testid="badge-plan">
          <Crown className="w-3 h-3" />
          Auraly+
        </Badge>
      );
    }
    
    if (status === 'trial') {
      return (
        <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 gap-1" data-testid="badge-plan">
          <Zap className="w-3 h-3" />
          Auraly+ Trial
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary" className="gap-1" data-testid="badge-plan">
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
          <div className="flex items-center justify-between py-3 border-b border-border/40">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{t('account.trialEnds')}</span>
            </div>
            <span className="font-medium" data-testid="text-trial-ends">
              {formatDate(subscription.trialEndsAt, lang)}
              {subscription.trialDaysRemaining !== undefined && (
                <span className="text-muted-foreground ml-2">
                  ({subscription.trialDaysRemaining} {t('account.daysLeft')})
                </span>
              )}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('account.trialDescription')}
          </p>
          <Link href="/upload">
            <Button className="w-full gap-2" data-testid="button-upgrade">
              <Crown className="w-4 h-4" />
              {t('account.upgradeToPremium')}
            </Button>
          </Link>
        </div>
      );
    }
    
    if (status === 'active' && !subscription.isAdminGrantedPremium) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border/40">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{t('account.nextBilling')}</span>
            </div>
            <span className="font-medium" data-testid="text-next-billing">
              {formatDate(subscription.nextBillingDate, lang)}
            </span>
          </div>
          
          {subscription.billingAmount && (
            <div className="flex items-center justify-between py-3 border-b border-border/40">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CreditCard className="w-4 h-4" />
                <span>{t('account.billingAmount')}</span>
              </div>
              <span className="font-medium" data-testid="text-billing-amount">
                {formatCurrency(subscription.billingAmount, subscription.billingCurrency)}
                /{subscription.billingInterval === 'year' ? 'yr' : 'mo'}
              </span>
            </div>
          )}
          
          {subscription.paymentMethod && (
            <div className="flex items-center justify-between py-3 border-b border-border/40">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CreditCard className="w-4 h-4" />
                <span>{t('account.paymentMethod')}</span>
              </div>
              <span className="font-medium" data-testid="text-payment-method">
                {capitalizeCardBrand(subscription.paymentMethod.brand)} •••• {subscription.paymentMethod.last4}
              </span>
            </div>
          )}
          
          <Button 
            variant="outline" 
            className="w-full gap-2"
            onClick={() => billingPortalMutation.mutate()}
            disabled={billingPortalMutation.isPending}
            data-testid="button-manage-billing"
          >
            {billingPortalMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4" />
            )}
            {t('account.manageBilling')}
          </Button>
        </div>
      );
    }
    
    if (subscription.isAdminGrantedPremium) {
      return (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground">
              {t('account.adminGrantedDescription')}
            </p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between py-3 border-b border-border/40">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Zap className="w-4 h-4" />
            <span>{t('account.freeScansUsed')}</span>
          </div>
          <span className="font-medium" data-testid="text-scans-used">
            {subscription.monthlyFreeScansUsed} / 5
          </span>
        </div>
        
        <div className="flex items-center justify-between py-3 border-b border-border/40">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="w-4 h-4" />
            <span>{t('account.scansRefresh')}</span>
          </div>
          <span className="font-medium" data-testid="text-scans-refresh">
            {formatDate(subscription.nextFreeScansRefresh, lang)}
          </span>
        </div>
        
        {subscription.scanPackBalance > 0 && (
          <div className="flex items-center justify-between py-3 border-b border-border/40">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="w-4 h-4" />
              <span>{t('account.scanPackBalance')}</span>
            </div>
            <span className="font-medium" data-testid="text-scan-pack-balance">
              {subscription.scanPackBalance}
            </span>
          </div>
        )}
        
        <Link href="/upload">
          <Button className="w-full gap-2" data-testid="button-upgrade">
            <Crown className="w-4 h-4" />
            {t('account.upgradeToPremium')}
          </Button>
        </Link>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-light">{t('common.back')}</span>
          </Button>
          <NavigationMenu showHomeLink />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="font-display text-3xl mb-8">{t('account.title')}</h1>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                {t('account.accountInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-border/40">
                <span className="text-muted-foreground">{t('account.email')}</span>
                <span className="font-medium" data-testid="text-email">
                  {subscription?.email || '-'}
                </span>
              </div>
              
              {(subscription?.firstName || subscription?.lastName) && (
                <div className="flex items-center justify-between py-3 border-b border-border/40">
                  <span className="text-muted-foreground">{t('account.name')}</span>
                  <span className="font-medium" data-testid="text-name">
                    {[subscription?.firstName, subscription?.lastName].filter(Boolean).join(' ')}
                  </span>
                </div>
              )}
              
              <div className="flex items-center justify-between py-3">
                <span className="text-muted-foreground">{t('account.memberSince')}</span>
                <span className="font-medium" data-testid="text-member-since">
                  {formatDate(subscription?.createdAt, lang)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5" />
                  {t('account.subscription')}
                </CardTitle>
                {getPlanBadge()}
              </div>
              <CardDescription>
                {t('account.subscriptionDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderSubscriptionDetails()}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
