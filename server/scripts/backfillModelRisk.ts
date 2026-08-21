// Backfill `modelRiskLevel` on scans saved before it existed.
//
//   npm run scans:backfill -- --dry-run
//   npm run scans:backfill
//
// Stored scans are re-derived on read: the substance corpus and the reader's
// profile are applied fresh every time, using the stored level as the model's
// input. Rows saved before `modelRiskLevel` existed have no such input, so the
// displayed `riskLevel` gets read back as the model's rating.
//
// For almost every row that is harmless — the value stored WAS the model's
// rating, because no profile factor touched it. The exception is a row whose
// level was raised for the profile active at scan time. Sesame is low risk for
// most people and high for a child allergic to it; a scan saved with that
// profile active stored `high`, and every later reader would be told sesame is
// universally high.
//
// This script cannot recover what the model originally said — there is no
// record of it. What it can do is:
//   1. Copy `riskLevel` into `modelRiskLevel` everywhere, which makes
//      re-derivation stable from here on and changes nothing on screen.
//   2. Identify rows where the stored level was probably a personal override —
//      an elevated level on an ingredient matching one of that user's declared
//      allergens — and reset those to the level the current pipeline produces
//      for them universally.
//
// Every row in (2) is printed. It is a small, inspectable set by design: guess
// widely here and the cure is worse than the disease.

import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { ingredientMatchesAllergen } from '../services/allergenMatcher';
import { applyPopulationRisk, domainForProductType } from '../services/substances/classify';

const dryRun = process.argv.includes('--dry-run');

interface Suspect {
  scanId: string;
  name: string;
  storedLevel: string;
  newLevel: string;
  allergen: string;
}

async function main() {
  const scans = (
    await db.execute(
      sql`select id, user_id, product_category, analysis_results from scan_history`,
    )
  ).rows as any[];

  const profileRows = (await db.execute(sql`select user_id, allergens from profiles`))
    .rows as any[];
  const allergensByUser = new Map<string, { allergen: string; keywords?: string[] }[]>();
  for (const p of profileRows) {
    const list = allergensByUser.get(p.user_id) ?? [];
    for (const a of p.allergens ?? []) list.push(a);
    allergensByUser.set(p.user_id, list);
  }

  let scanned = 0;
  let backfilled = 0;
  let touchedScans = 0;
  const suspects: Suspect[] = [];

  for (const scan of scans) {
    const ingredients = Array.isArray(scan.analysis_results) ? scan.analysis_results : [];
    if (ingredients.length === 0) continue;

    const domain = domainForProductType(scan.product_category ?? 'food');
    const allergens = allergensByUser.get(scan.user_id) ?? [];
    let changed = false;

    for (const ing of ingredients) {
      scanned++;
      if (ing.modelRiskLevel) continue;

      let level: string = ing.riskLevel;

      // Elevated level on an ingredient this user declared an allergy to: the
      // stored value is far more likely to be their personal level than the
      // model's neutral one.
      if (level !== 'low') {
        const matched = allergens.find((a) =>
          ingredientMatchesAllergen(ing.name, a.allergen, a.keywords ?? []),
        );
        if (matched) {
          // What the pipeline says about this ingredient today, with no profile
          // applied. If a record covers it that record decides; otherwise this
          // falls back to the stored level and nothing is invented.
          const derived = applyPopulationRisk(
            { ...ing, modelRiskLevel: undefined, riskLevel: 'low' } as any,
            domain,
          );
          const newLevel = derived.riskSource === 'record' ? derived.riskLevel : 'low';
          suspects.push({
            scanId: scan.id,
            name: ing.name,
            storedLevel: level,
            newLevel,
            allergen: matched.allergen,
          });
          level = newLevel;
        }
      }

      ing.modelRiskLevel = level;
      ing.riskLevel = level;
      backfilled++;
      changed = true;
    }

    if (changed) {
      touchedScans++;
      if (!dryRun) {
        await db.execute(
          sql`update scan_history set analysis_results = ${JSON.stringify(ingredients)}::jsonb where id = ${scan.id}`,
        );
      }
    }
  }

  console.log(`\n[BACKFILL]${dryRun ? ' DRY RUN —' : ''} ${scans.length} scans`);
  console.log(`  ingredient rows scanned:  ${scanned}`);
  console.log(`  modelRiskLevel written:   ${backfilled} across ${touchedScans} scans`);
  console.log(`  personal-override resets: ${suspects.length}`);
  for (const s of suspects) {
    console.log(
      `    ${s.scanId.slice(0, 8)}  ${s.name}: ${s.storedLevel} → ${s.newLevel}  ` +
        `(matched the "${s.allergen}" allergy on this account)`,
    );
  }
  if (dryRun) console.log(`\n  nothing written. Re-run without --dry-run to apply.`);
  process.exit(0);
}

main();
