import { Capacitor } from '@capacitor/core';

export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

export const getPlatform = (): 'ios' | 'android' | 'web' => {
  const p = Capacitor.getPlatform();
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
};

const NATIVE_API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  'https://auraly.replit.app';

export function resolveApiUrl(url: string): string {
  if (!isNativePlatform()) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const base = NATIVE_API_BASE_URL.replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}
