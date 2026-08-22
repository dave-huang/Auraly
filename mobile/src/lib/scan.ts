import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useSyncExternalStore } from 'react';

import { ApiError, apiFetch } from './api';
import type { AnalysisResult, ProductType } from './types';

// Scan pipeline client: compress the photo, submit for analysis, poll until
// the verdict is ready.

/**
 * Downscale + JPEG-compress a captured photo before upload. Label photos off
 * modern phones are ~4000px/3MB+; the vision models don't need that, and
 * upload time dominates perceived scan speed on cellular.
 */
export async function prepareImage(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 1600 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.7,
    base64: true,
  });
  if (!saved.base64) throw new Error('Failed to encode image');
  return `data:image/jpeg;base64,${saved.base64}`;
}

interface ScanSubmission {
  requestId: string;
  status: string;
}

export interface AnalysisStatus {
  status: 'processing' | 'ocr_complete' | 'completed' | 'failed';
  analysis?: AnalysisResult;
  ocrText?: string;
  /** Available from 'ocr_complete' onward — lets the UI show real progress. */
  ingredientCount?: number;
  error?: string;
  /** Machine-readable failure reason; the UI writes the sentence from this. */
  code?: string;
}

export async function submitScan(params: {
  imageDataUrl: string;
  productType: ProductType;
  language: string;
  profileId?: string;
}): Promise<string> {
  const { requestId } = await apiFetch<ScanSubmission>('/api/scan-and-analyze', {
    method: 'POST',
    body: JSON.stringify({
      imageData: params.imageDataUrl,
      productType: params.productType,
      userLanguage: params.language,
      profileId: params.profileId,
    }),
  });
  return requestId;
}

// Poll fast early, then widen.
//
// A flat 2500ms interval was coarser than the stages it was meant to observe:
// a measured scan reached ocr_complete at :05 and completed at :08, so the
// "analyzing / found N ingredients" phase got one tick if the timing was lucky
// and none if it was not. Most of the wait showed the first message only, and
// the screen looked stuck.
//
// The status route is a map lookup that answers in ~13ms and does no work per
// call, so the early burst is cheap; the backoff keeps a slow label (a big
// image, a cold model) from making hundreds of requests.
const POLL_SCHEDULE_MS = [400, 400, 600, 600, 800, 1000, 1500] as const;
const POLL_INTERVAL_MAX_MS = 2500;
const POLL_TIMEOUT_MS = 150_000;

function pollDelayMs(attempt: number): number {
  return POLL_SCHEDULE_MS[attempt] ?? POLL_INTERVAL_MAX_MS;
}

export async function pollAnalysis(
  requestId: string,
  onStatus?: (status: AnalysisStatus) => void,
): Promise<AnalysisResult> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let attempt = 0;
  while (Date.now() < deadline) {
    const status = await apiFetch<AnalysisStatus>(`/api/analysis-status/${requestId}`);
    onStatus?.(status);
    if (status.status === 'completed' && status.analysis) return status.analysis;
    if (status.status === 'failed') {
      // Preserved as an ApiError so the code survives to the screen that has to
      // word this failure. (In practice the 400 from the status route already
      // throws inside apiFetch; this covers a failed status arriving with 200.)
      throw new ApiError(400, status.error || 'Analysis failed.', status.code);
    }
    await new Promise((resolve) => setTimeout(resolve, pollDelayMs(attempt)));
    attempt += 1;
  }
  throw new Error('Analysis timed out. Please try again.');
}

/**
 * Re-score an analysis the app is already holding against another profile.
 *
 * Switching who the scan is for must not cost a re-scan: the label read is
 * done, and the personal verdict is deterministic matching. The matching
 * itself stays on the server so production and the eval harness keep sharing
 * one implementation.
 */
export function personalizeAnalysis(
  analysis: AnalysisResult,
  profileId: string,
): Promise<AnalysisResult> {
  return apiFetch<AnalysisResult>('/api/analysis/personalize', {
    method: 'POST',
    body: JSON.stringify({ analysis, profileId }),
  });
}

// The finished result is handed between screens via this module-level slot —
// results can exceed router-param size limits comfortably. The profile that
// was active at scan time rides along so the verdict card's chip can name the
// specific allergens it checked against.
export interface ScanProfile {
  id?: string;
  name: string;
  allergens: string[];
}

let lastResult: AnalysisResult | null = null;
let lastProfile: ScanProfile | null = null;
let lastFrame: string | null = null;
let version = 0;

// Subscribers exist because the profile switcher re-scores the scan that a
// screen behind it is already showing. Without notification that screen would
// keep displaying a verdict for the previous person.
const listeners = new Set<() => void>();

export function setLastResult(
  result: AnalysisResult,
  profile?: ScanProfile | null,
  frameUri?: string | null,
): void {
  lastResult = result;
  lastProfile = profile ?? null;
  lastFrame = frameUri ?? null;
  version += 1;
  listeners.forEach((notify) => notify());
}

/** The held scan, re-rendering whichever screen shows it when it is re-scored. */
export function useLastScan(): {
  result: AnalysisResult | null;
  profile: ScanProfile | null;
  frame: string | null;
} {
  // The snapshot is a counter, not the values: the three getters would build a
  // fresh object on every call and spin useSyncExternalStore forever.
  useSyncExternalStore(subscribeToLastResult, () => version);
  return { result: lastResult, profile: lastProfile, frame: lastFrame };
}

/** Re-score the held scan in place, keeping its frozen frame. */
export function replaceLastVerdict(result: AnalysisResult, profile: ScanProfile | null): void {
  setLastResult(result, profile, lastFrame);
}

/**
 * Forget the held scan.
 *
 * Sign-out and account deletion both land here: the last verdict names a
 * person and their allergens, and it must not still be sitting in memory for
 * whoever signs in next on the same phone.
 */
export function clearLastScan(): void {
  lastResult = null;
  lastProfile = null;
  lastFrame = null;
  version += 1;
  listeners.forEach((notify) => notify());
}

export function subscribeToLastResult(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The still the verdict card rises over. */
export function getLastFrame(): string | null {
  return lastFrame;
}

export function getLastResult(): AnalysisResult | null {
  return lastResult;
}

export function getLastProfile(): ScanProfile | null {
  return lastProfile;
}
