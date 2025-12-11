import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Crown, Zap } from 'lucide-react';
import { useSubscriptionStatus, formatRemainingScans } from '@/hooks/use-subscription';

interface ScanCounterProps {
  variant?: 'badge' | 'inline';
  className?: string;
}

export function ScanCounter({ variant = 'badge', className = '' }: ScanCounterProps) {
  const { t } = useTranslation();
  const { data: status, isLoading } = useSubscriptionStatus();

  if (isLoading) {
    return null;
  }

  if (!status) {
    return null;
  }

  if (status.isPremium) {
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

  const remaining = formatRemainingScans(status);
  const isLow = !status.isPremium && (status.freeScansLimit - status.freeScansUsed + status.scanPackBalance) <= 2;

  if (variant === 'badge') {
    return (
      <Badge 
        variant="secondary" 
        className={`gap-1 ${isLow ? 'bg-amber-500/10 text-amber-600' : 'bg-muted'} ${className}`}
        data-testid="badge-scans-remaining"
      >
        <Zap className="w-3 h-3" />
        <span>{remaining} {t('subscription.scansLeft', 'scans left')}</span>
      </Badge>
    );
  }

  return (
    <div className={`flex items-center gap-1 text-sm ${isLow ? 'text-amber-600' : 'text-muted-foreground'} ${className}`} data-testid="text-scans-remaining">
      <Zap className="w-4 h-4" />
      <span>{remaining} {t('subscription.scansRemaining', 'scans remaining')}</span>
    </div>
  );
}
