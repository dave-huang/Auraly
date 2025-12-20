import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Crown, Zap, Clock } from 'lucide-react';
import { useSubscriptionStatus, formatRemainingScans, getSubscriptionTier, getRemainingScans } from '@/hooks/use-subscription';

interface ScanCounterProps {
  variant?: 'badge' | 'inline';
  className?: string;
}

export function ScanCounter({ variant = 'badge', className = '' }: ScanCounterProps) {
  const { t } = useTranslation();
  const { data: status, isLoading } = useSubscriptionStatus();

  if (isLoading || !status) {
    return null;
  }

  const tier = getSubscriptionTier(status);

  if (tier === 'premium') {
    if (variant === 'badge') {
      return (
        <Badge variant="secondary" className={`bg-primary/10 text-primary gap-1 ${className}`} data-testid="badge-premium">
          <Crown className="w-3 h-3" />
          <span>Auraly+</span>
        </Badge>
      );
    }
    return (
      <div className={`flex items-center gap-1 text-primary text-sm ${className}`} data-testid="text-premium">
        <Crown className="w-4 h-4" />
        <span>{t('subscription.premium', 'Auraly+ Member')}</span>
      </div>
    );
  }

  if (tier === 'trial') {
    const daysLeft = status.trialDaysRemaining || 0;
    if (variant === 'badge') {
      return (
        <Badge variant="secondary" className={`bg-primary/10 text-primary gap-1 ${className}`} data-testid="badge-trial">
          <Clock className="w-3 h-3" />
          <span>{t('subscription.trialDays', 'Trial: {{days}} days left', { days: daysLeft })}</span>
        </Badge>
      );
    }
    return (
      <div className={`flex items-center gap-1 text-primary text-sm ${className}`} data-testid="text-trial">
        <Clock className="w-4 h-4" />
        <span>{t('subscription.trialRemaining', 'Premium Trial: {{days}} days remaining', { days: daysLeft })}</span>
      </div>
    );
  }

  const remaining = formatRemainingScans(status);
  const remainingCount = getRemainingScans(status);
  const isLow = status.freeScansLimit - status.freeScansUsed <= 2;
  const scansText = remainingCount === 1 
    ? t('subscription.scanLeft', 'scan left') 
    : t('subscription.scansLeft', 'scans left');

  if (variant === 'badge') {
    return (
      <Badge 
        variant="secondary" 
        className={`gap-1 ${isLow ? 'bg-amber-500/10 text-amber-600' : 'bg-muted'} ${className}`}
        data-testid="badge-scans-remaining"
      >
        <Zap className="w-3 h-3" />
        <span>{remaining} {scansText}</span>
      </Badge>
    );
  }

  return (
    <div className={`flex items-center gap-1 text-sm ${isLow ? 'text-amber-600' : 'text-muted-foreground'} ${className}`} data-testid="text-scans-remaining">
      <Zap className="w-4 h-4" />
      <span>{remaining} of {status.freeScansLimit} {t('subscription.freeScansRemaining', 'free scans remaining')}</span>
    </div>
  );
}
