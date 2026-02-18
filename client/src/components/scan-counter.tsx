import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';
import { useSubscriptionStatus } from '@/hooks/use-subscription';

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

  const totalAvailable = status.totalScansAvailable;
  const isLow = totalAvailable <= 1;
  const scansText = totalAvailable === 1
    ? t('subscription.scanLeft', 'scan left')
    : t('subscription.scansLeft', 'scans left');

  if (variant === 'badge') {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <Badge
          variant="secondary"
          className={`gap-1 ${isLow ? 'bg-amber-500/10 text-amber-600' : 'bg-muted'}`}
          data-testid="badge-scans-remaining"
        >
          <Zap className="w-3 h-3" />
          <span>{totalAvailable} {scansText}</span>
        </Badge>
        {status.purchasedScanBalance > 0 && (
          <span className="text-xs text-muted-foreground" data-testid="text-purchased-balance">
            +{status.purchasedScanBalance} {t('subscription.purchased', 'purchased')}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 text-sm ${isLow ? 'text-amber-600' : 'text-muted-foreground'} ${className}`} data-testid="text-scans-remaining">
      <Zap className="w-4 h-4" />
      <span>{totalAvailable} {scansText}</span>
      {status.purchasedScanBalance > 0 && (
        <span className="text-xs text-muted-foreground ml-1" data-testid="text-purchased-balance-inline">
          (+{status.purchasedScanBalance} {t('subscription.purchased', 'purchased')})
        </span>
      )}
    </div>
  );
}
