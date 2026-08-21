# Evidence corpus

One JSON file per ingested source snapshot. Loaded in filename order and merged;
see `server/services/substances/evidence.ts`.

**This directory starts empty on purpose.** Every record must be traceable to a
publisher's snapshot, so nothing lands here by hand-curation. Until a source is
ingested, ingredients classify as `unknown` — which the app presents as caution
and never as safe.

## Adding a source

1. Download the publisher's file yourself. Fetching is deliberately manual so the
   snapshot can be committed next to the records it produced, which is what makes
   an ingestion reproducible months later.
2. Save it under `server/data/substances/snapshots/<source>-<version>.csv`.
3. Ingest it:

```bash
npm run substances:ingest -- prop65 server/data/substances/snapshots/prop65-2026-06.csv --version 2026-06 --url https://oehha.ca.gov/proposition-65/proposition-65-list
```

4. Read the classification diff it prints. A substance changing level is a
   product change.
5. Verify the corpus, then commit the snapshot, the evidence file and the
   registry together:

```bash
npm run substances:check
```

## Adapters available

| source | what it gives you |
| --- | --- |
| `prop65` | California OEHHA listings, CAS-keyed, with cancer / reproductive endpoints |
| `iarc` | IARC Monograph groups 1 / 2A / 2B / 3 |
| `cosing_annex_ii` | Substances prohibited in EU cosmetics |
| `cosing_annex_iii` | EU cosmetics restrictions, with numeric concentration limits |

Sources with no adapter yet — ECHA CLP Annex VI, EU food additive annexes, FDA
Substances Added to Food, EFSA OpenFoodTox, Health Canada's Hotlist, NTP RoC —
have policy rules waiting for them. `npm run substances:check` lists which rules
no current record can trigger.

## A note on what was removed

An earlier pass seeded this directory from a retired `regulatory-bans.json`
(40 hand-written rows, recoverable at commit `b788dfe`). It was dropped: its
`regulation` fields were prose summaries mixing several jurisdictions per row,
and inferring structured claims from them produced misattributions — an EU
restriction read as an EU ban, for instance. A blank slate that grows from real
snapshots is worth more than 40 rows of uncertain provenance.
