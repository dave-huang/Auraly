import 'dotenv/config';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { ingredientMatchesAllergen } from '../server/services/allergenMatcher';
(async () => {
  const scans = (await db.execute(sql`select id, user_id, analysis_results from scan_history`)).rows as any[];
  const profs = (await db.execute(sql`select user_id, allergens from profiles`)).rows as any[];
  const allergensByUser = new Map<string, { allergen: string; keywords?: string[] }[]>();
  for (const p of profs) {
    const list = allergensByUser.get(p.user_id) ?? [];
    for (const a of (p.allergens ?? [])) list.push(a);
    allergensByUser.set(p.user_id, list);
  }

  let rows = 0, missing = 0, suspect = 0, scansAffected = 0;
  const examples: string[] = [];
  for (const s of scans) {
    const ings = Array.isArray(s.analysis_results) ? s.analysis_results : [];
    let hit = false;
    for (const i of ings) {
      rows++;
      if (i.modelRiskLevel) continue;
      missing++;
      const level = i.riskLevel;
      if (level === 'low') continue;
      const allergens = allergensByUser.get(s.user_id) ?? [];
      const matched = allergens.find((a) => ingredientMatchesAllergen(i.name, a.allergen, a.keywords ?? []));
      if (matched) {
        suspect++; hit = true;
        if (examples.length < 12) examples.push(`${i.name} = ${level}  (matches "${matched.allergen}")`);
      }
    }
    if (hit) scansAffected++;
  }
  console.log(`stored ingredient rows:            ${rows}`);
  console.log(`without modelRiskLevel (pre-fix):  ${missing}`);
  console.log(`LIKELY personalization artifacts:  ${suspect}  across ${scansAffected} scans`);
  console.log(`\nexamples:`); examples.forEach((e) => console.log('  ' + e));
  process.exit(0);
})();
