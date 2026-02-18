import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

export interface ScanQuotaStatus {
  canScan: boolean;
  reason?: 'no_scans' | 'not_authenticated';
  dailyFreeScansUsed: number;
  dailyFreeScansLimit: number;
  dailyFreeScansRemaining: number;
  purchasedScanBalance: number;
  totalScansAvailable: number;
  nextDailyReset: string;
}

export function useSubscriptionStatus() {
  return useQuery<ScanQuotaStatus>({
    queryKey: ['/api/scan/quota'],
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function usePurchaseScans() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/scan/purchase');
      const data = await response.json();
      return data;
    },
    onSuccess: (data: any) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      console.error('[Purchase] Error:', error);
      alert(`Purchase failed: ${error.message || 'Unknown error'}. Please try again.`);
    },
  });
}

export function useLogPurchasePromptView() {
  return useMutation({
    mutationFn: async (source: string) => {
      const response = await apiRequest('POST', '/api/analytics/purchase-prompt-view', { source });
      return response.json();
    },
  });
}

export function getRemainingScans(status: ScanQuotaStatus | undefined): number {
  if (!status) return 0;
  return status.totalScansAvailable;
}

export function formatRemainingScans(status: ScanQuotaStatus | undefined): string {
  if (!status) return '...';
  return String(status.totalScansAvailable);
}
