import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

export interface ScanQuotaStatus {
  canScan: boolean;
  reason?: 'no_scans' | 'rate_limited' | 'not_authenticated';
  isPremium: boolean;
  freeScansUsed: number;
  freeScansLimit: number;
  scanPackBalance: number;
  nextResetDate?: string;
  hourlyScansRemaining?: number;
}

export interface StripeProduct {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: {
    id: string;
    unitAmount: number;
    currency: string;
    recurring?: { interval: string };
    metadata: Record<string, string>;
  }[];
}

export function useSubscriptionStatus() {
  return useQuery<ScanQuotaStatus>({
    queryKey: ['/api/subscription/status'],
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useStripeProducts() {
  return useQuery<{ products: StripeProduct[] }>({
    queryKey: ['/api/subscription/products'],
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: async (params: { priceId: string; mode: 'subscription' | 'payment'; scanPackSize?: number }) => {
      const response = await apiRequest('POST', '/api/subscription/checkout', params);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/subscription/portal');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

export function useLogPaywallView() {
  return useMutation({
    mutationFn: async (source: string) => {
      const response = await apiRequest('POST', '/api/analytics/paywall-view', { source });
      return response.json();
    },
  });
}

export function useLogGatedContentTap() {
  return useMutation({
    mutationFn: async (contentType: string) => {
      const response = await apiRequest('POST', '/api/analytics/gated-content', { contentType });
      return response.json();
    },
  });
}

export function getRemainingScans(status: ScanQuotaStatus | undefined): number {
  if (!status) return 0;
  if (status.isPremium) return Infinity;
  const freeRemaining = Math.max(0, status.freeScansLimit - status.freeScansUsed);
  return freeRemaining + status.scanPackBalance;
}

export function formatRemainingScans(status: ScanQuotaStatus | undefined): string {
  if (!status) return '...';
  if (status.isPremium) return 'Unlimited';
  const remaining = getRemainingScans(status);
  return String(remaining);
}
