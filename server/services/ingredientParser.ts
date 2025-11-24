/**
 * Parses ingredient lists from OCR text
 * Handles various separators and formatting across multiple languages
 */

export interface ParsedIngredient {
  name: string;
  originalIndex: number;
}

/**
 * Extract individual ingredients from OCR text
 * Handles:
 * - Comma-separated lists
 * - Newline-separated lists
 * - Multi-language separators (，、；：)
 * - Parenthetical content
 * - Bullet points and numbering
 */
export function parseIngredients(text: string): ParsedIngredient[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Split by common separators
  const separators = /[\n,，、；：;]/;
  let lines = text.split(separators);

  // Clean and filter lines
  const ingredients: ParsedIngredient[] = [];
  
  lines.forEach((line, index) => {
    const cleaned = cleanIngredientLine(line);
    
    if (cleaned.length > 0) {
      // Skip lines that are clearly headers or metadata
      if (!isHeaderOrMetadata(cleaned)) {
        ingredients.push({
          name: cleaned,
          originalIndex: index
        });
      }
    }
  });

  // Remove duplicates while preserving order
  const seen = new Set<string>();
  const unique: ParsedIngredient[] = [];
  
  ingredients.forEach(ing => {
    const normalized = normalizeIngredientName(ing.name);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(ing);
    }
  });

  return unique;
}

/**
 * Clean a single ingredient line
 * Removes:
 * - Leading/trailing whitespace
 * - Bullet points and numbering
 * - Extra spaces
 */
function cleanIngredientLine(line: string): string {
  return line
    // Remove leading bullet points and numbering
    .replace(/^[\s•·∙\*\-\d.]+/, '')
    // Remove trailing numbers/percentages
    .replace(/\s*[\d.%]+%?\s*$/, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
}

/**
 * Normalize ingredient name for deduplication
 */
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a line is a header, metadata, or non-ingredient text
 */
function isHeaderOrMetadata(line: string): boolean {
  const normalized = line.toLowerCase();
  
  // Common headers and metadata patterns
  const patterns = [
    /^ingredients?:/i,
    /^contains:/i,
    /^allergens?:/i,
    /^directions?:/i,
    /^instructions?:/i,
    /^warnings?:/i,
    /^made in/i,
    /^net weight/i,
    /^product of/i,
    /^nutrition/i,
    /^servings?:/i,
    /^store at/i,
    /^best before/i,
    /^use by/i,
    /^may contain/i,
    /^\s*\*+\s*$/, // Lines with only asterisks
    /^-+$/, // Lines with only dashes
    /^=+$/, // Lines with only equals
  ];
  
  return patterns.some(pattern => pattern.test(normalized));
}

/**
 * Group ingredients into batches for efficient processing
 * Useful for batching uncached ingredients for AI analysis
 */
export function batchIngredients(
  ingredients: ParsedIngredient[],
  batchSize: number = 10
): ParsedIngredient[][] {
  const batches: ParsedIngredient[][] = [];
  
  for (let i = 0; i < ingredients.length; i += batchSize) {
    batches.push(ingredients.slice(i, i + batchSize));
  }
  
  return batches;
}

/**
 * Filter ingredients by a list of names to exclude
 */
export function filterIngredients(
  ingredients: ParsedIngredient[],
  excludeNames: string[]
): ParsedIngredient[] {
  const excludeNormalized = new Set(
    excludeNames.map(name => normalizeIngredientName(name))
  );
  
  return ingredients.filter(ing => 
    !excludeNormalized.has(normalizeIngredientName(ing.name))
  );
}
