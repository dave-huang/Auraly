import { apiFetch } from './api';

/**
 * The regulatory record behind an ingredient's risk level.
 *
 * Fetched on demand from the drill-down rather than carried in every scan: the
 * payload stays small, and the answer reflects the corpus as it stands now
 * rather than as it stood when the photo was taken. Same reasoning as the
 * allergen alias list next to it.
 */

/** A jurisdiction code as the server records it. */
export type Jurisdiction = 'EU' | 'UK' | 'US' | 'US-CA' | 'CA' | 'AU' | 'INTL';

export interface EvidenceRecordView {
  /** The source's own words. Quoted verbatim, never translated. */
  statement: string;
  kind: string;
  jurisdiction: Jurisdiction;
  org: string;
  title: string;
  url: string | null;
  determinedOn: string | null;
}

export interface SubstanceEvidence {
  substanceId: string;
  name: string;
  cas: string | null;
  eNumber: string | null;
  level: 'low' | 'moderate' | 'high' | 'unknown';
  policyVersion: string;
  /** Permitted in one market, prohibited in another. The story worth telling. */
  divergence: { permittedIn: Jurisdiction[]; prohibitedIn: Jurisdiction[] } | null;
  records: EvidenceRecordView[];
}

export function fetchSubstanceEvidence(
  substanceId: string,
  domain: 'food' | 'cosmetic',
): Promise<SubstanceEvidence> {
  return apiFetch<SubstanceEvidence>(
    `/api/substances/${encodeURIComponent(substanceId)}/evidence?domain=${domain}`,
  );
}
