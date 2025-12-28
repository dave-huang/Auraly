import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

export interface ScanQuotaStatus {
  canScan: boolean;
  reason?: 'no_scans' | 'rate_limited' | 'not_authenticated' | 'trial_expired';
  isPremium: boolean;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  freeScansUsed: number;
  freeScansLimit: number;
  nextResetDate?: string;
  hourlyScansRemaining?: number;
  subscriptionStatus: string;
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
    mutationFn: async (params: { priceId: string; mode: 'subscription' }) => {
      console.log('[Checkout] Creating checkout session with params:', params);
      const response = await apiRequest('POST', '/api/subscription/checkout', params);
      const data = await response.json();
      console.log('[Checkout] Response:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('[Checkout] Success, redirecting to:', data.url);
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error) => {
      console.error('[Checkout] Error creating checkout session:', error);
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
  if (status.isPremium || status.isTrialActive) return Infinity;
  return Math.max(0, status.freeScansLimit - status.freeScansUsed);
}

export function formatRemainingScans(status: ScanQuotaStatus | undefined): string {
  if (!status) return '...';
  if (status.isPremium || status.isTrialActive) return 'Unlimited';
  return String(getRemainingScans(status));
}

export function getSubscriptionTier(status: ScanQuotaStatus | undefined): 'free' | 'trial' | 'premium' {
  if (!status) return 'free';
  if (status.subscriptionStatus === 'active' || status.isPremium) return 'premium';
  if (status.isTrialActive) return 'trial';
  return 'free';
}
