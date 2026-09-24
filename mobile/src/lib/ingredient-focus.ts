import type { Ingredient, PersonalFlag, ProductType } from './types';

// The ingredient the drill-down is about.
//
// Handed over through a module slot rather than route params for the same
// reason the finished analysis is: citations and detail text blow past
// comfortable param sizes, and re-deriving them on the far side would mean the
// drill-down could disagree with the row that opened it.

export interface IngredientFocus {
  ingredient: Ingredient;
  /** The name as printed on the label, when the read captured one. */
  original?: string;
  /** The flag that matched, when this row is flagged for the active profile. */
  flag?: PersonalFlag;
  profileName?: string;
  /**
   * Which corpus domain to read evidence in. A cosmetic prohibition says
   * nothing about a biscuit, so the drill-down has to ask in the same domain
   * the verdict was decided in.
   */
  productType?: ProductType;
  /**
   * The language the scan was taken in. Sources are shown translated into it,
   * not into the app's current setting, so a scan reopened from history reads
   * the way it did when it was taken.
   */
  language?: string;
}

let focused: IngredientFocus | null = null;

export function setFocusedIngredient(next: IngredientFocus): void {
  focused = next;
}

export function getFocusedIngredient(): IngredientFocus | null {
  return focused;
}
