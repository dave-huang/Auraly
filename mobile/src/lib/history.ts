import { apiFetch } from './api';
import type { AnalysisResult, ProductType, RiskLevel, ScanHistory } from './types';

export interface HistoryPage {
  scans: ScanHistory[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export function fetchHistory(
  offset = 0,
  limit = 20,
  risk?: RiskLevel,
  profileId?: string,
): Promise<HistoryPage> {
  // The verdict filter goes to the server so the total and the paging match
  // the pill: filtering the loaded page would tell someone with thirty avoid
  // scans that they have three.
  //
  // profileId goes with it so each tile carries the verdict for the person
  // reading it. Without it the grid showed the level stored at scan time while
  // the detail screen re-checked against the active profile — a tile reading
  // Safe that opened onto Avoid. Sesame is low risk for most people and high
  // for the child with the allergy, and the grid was answering for the wrong
  // one.
  const query =
    `offset=${offset}&limit=${limit}` +
    (risk ? `&risk=${risk}` : '') +
    (profileId ? `&profileId=${encodeURIComponent(profileId)}` : '');
  return apiFetch<HistoryPage>(`/api/history?${query}`);
}

export function fetchScan(scanId: string): Promise<ScanHistory> {
  return apiFetch<ScanHistory>(`/api/history/${scanId}`);
}

export function deleteScan(scanId: string): Promise<void> {
  return apiFetch<void>(`/api/history/${scanId}`, { method: 'DELETE' });
}

/**
 * Persist a finished analysis. Note the server also consumes a scan from the
 * user's quota here, so this is called exactly once per completed scan.
 *
 * Personal flags are deliberately NOT persisted: they belong to the profile
 * that was active at scan time, and profiles change. History stores the
 * product's objective analysis; re-opening a scan re-applies the current
 * profile client-side.
 */
/**
 * What POST /api/history actually replies with.
 *
 * NOT a ScanHistory, which is what this used to claim. `apiFetch` casts the
 * JSON without checking it, so the wrong type compiled cleanly and every
 * caller reading `.id` silently got undefined — which is exactly how the
 * label thumbnail came to be keyed on nothing and never saved.
 */
export interface SavedScan {
  success: boolean;
  scanId: string;
}

export function saveScan(params: {
  result: AnalysisResult;
  productType: ProductType;
  language: string;
}): Promise<SavedScan> {
  const { result, productType, language } = params;
  return apiFetch<SavedScan>('/api/history', {
    method: 'POST',
    body: JSON.stringify({
      productName: result.productName || 'Unnamed Product',
      productCategory: productType,
      detectedIngredients: result.ingredients.map((i) => i.name),
      // The label as printed, sent so the saved scan's count matches the card
      // it was saved from. `detectedIngredients` above is everything that was
      // analysed, sub-ingredients included, so counting it says a packet has
      // 31 ingredients when its label prints 12.
      composition: result.composition,
      analysisResults: result.ingredients.map((i) => ({
        name: i.name,
        // The MODEL's rating, not the level on screen.
        //
        // What is displayed may have been raised for this particular person —
        // sesame is `low` for most people and `high` for Kiddo. Storing the
        // displayed level bakes one profile's answer into the record, and when
        // the scan is reopened that value is read back as "what the model
        // said" and shown to everyone. Store the neutral fact; the personal
        // part is re-derived per reader, every time.
        riskLevel: i.modelRiskLevel ?? i.riskLevel,
        modelRiskLevel: i.modelRiskLevel ?? i.riskLevel,
        summary: i.summary,
        details: i.details,
        category: i.category ?? null,
        // Position on the printed list. Sent because the server cannot recover
        // it later: the canonical name list it is derived from is not stored,
        // and unlike the risk level this fact about the label never changes.
        labelRank: i.labelRank,
      })),
      overallRisk: result.overallRisk,
      language,
    }),
  });
}

/**
 * Display title for a stored scan. Most historical scans (and any where the
 * label had no visible brand name) carry the placeholder "Unnamed Product",
 * which makes a history list unreadable — fall back to the leading
 * ingredients, which is what people actually recognize a product by.
 */
export function scanTitle(scan: Pick<ScanHistory, 'productName' | 'detectedIngredients'>): string {
  const name = scan.productName?.trim();
  if (name && name.toLowerCase() !== 'unnamed product') return name;

  const ingredients = scan.detectedIngredients ?? [];
  if (ingredients.length === 0) return 'Unnamed product';
  return ingredients.slice(0, 3).join(', ') + (ingredients.length > 3 ? '…' : '');
}

/**
 * Rebuild an AnalysisResult from a stored scan so the results UI can render it.
 *
 * Ingredients are carried across WHOLE, not field by field. An earlier version
 * listed the five fields it knew about and rebuilt each object from them, which
 * silently discarded everything the server had added since — the citations, and
 * then the population-risk provenance (`evidenceStatus`, `policyRuleIds`).
 * The visible symptom was a reopened scan reporting "0 of 5 ingredients
 * checked" and printing "clear" on rows the server had classified, while the
 * results screen for the same product said otherwise.
 *
 * The server is the authority on an ingredient's shape. Anything it sends that
 * the card understands should reach the card, so only the fields this function
 * genuinely has to supply are touched.
 */
export function scanToAnalysisResult(scan: ScanHistory): AnalysisResult {
  const stored = (scan.analysisResults ?? []) as AnalysisResult['ingredients'];
  return {
    productType: (scan.productCategory as ProductType) ?? 'food',
    productName: scanTitle(scan),
    ingredients: stored.map((i) => ({ ...i, category: i.category ?? null })),
    overallRisk: scan.overallRisk as RiskLevel,
    analyzedAt: new Date(scan.createdAt).toISOString(),
  };
}
