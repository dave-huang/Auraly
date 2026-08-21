import 'dotenv/config';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { applyPopulationRisk, domainForProductType } from '../server/services/substances/classify';

(async () => {
  const rows = (await db.execute(sql`
    select id, product_name, product_category, analysis_results
    from scan_history where user_id = (
      select user_id from scan_history group by 1 order by count(*) desc offset 1 limit 1
    )`)).rows as any[];

  const highCulprits = new Map<string, { n: number; source: string }>();
  let highScans = 0;
  const byLevel: Record<string, number> = { low: 0, moderate: 0, high: 0 };

  for (const r of rows) {
    const domain = domainForProductType(r.product_category ?? 'food');
    const ings = (Array.isArray(r.analysis_results) ? r.analysis_results : [])
      .map((i: any) => applyPopulationRisk(i, domain));
    const highs = ings.filter((i: any) => i.riskLevel === 'high');
    for (const i of ings) byLevel[i.riskLevel] = (byLevel[i.riskLevel] ?? 0) + 1;
    if (highs.length === 0) continue;
    highScans++;
    for (const h of highs) {
      const key = h.name.toLowerCase().trim();
      const prev = highCulprits.get(key);
      highCulprits.set(key, { n: (prev?.n ?? 0) + 1, source: h.riskSource ?? 'model' });
    }
  }

  console.log(`scans: ${rows.length}, scans with >=1 high ingredient: ${highScans}`);
  console.log(`ingredient rows by level:`, byLevel);
  const total = Object.values(byLevel).reduce((a, b) => a + b, 0);
  console.log(`share of INGREDIENTS rated high: ${(100 * byLevel.high / total).toFixed(1)}%\n`);

  const sorted = [...highCulprits.entries()].sort((a, b) => b[1].n - a[1].n);
  console.log(`distinct ingredients ever rated high: ${sorted.length}`);
  console.log(`\ntop high-rated ingredients (count, where the level came from):`);
  for (const [name, v] of sorted.slice(0, 30)) {
    console.log(`  ${String(v.n).padStart(3)}  ${v.source.padEnd(7)}  ${name.slice(0, 60)}`);
  }
  const bySource = sorted.reduce((acc: any, [, v]) => { acc[v.source] = (acc[v.source] ?? 0) + v.n; return acc; }, {});
  console.log(`\nhigh ratings by source:`, bySource);
  process.exit(0);
})();
