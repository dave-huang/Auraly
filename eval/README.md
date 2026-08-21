# Eval harness

Three things live here, and only the first costs money.

| Command | Tests | Cost |
| --- | --- | --- |
| `npm run eval` | Whether the vision pipeline reads a label correctly | One real vision call per case |
| `npm run eval:check` | Whether the scorer counts correctly and the ground truth is self-consistent | Free, instant |
| `npm run risk:check` | Whether the deterministic risk layers rate correctly | Free, instant |

`npm run check:all` runs the typechecker and all three free checks together.

Run the two free checks on every change. Run `npm run eval` before shipping a
change to the extraction prompt, vision model, or provider chain.

## Why the risk check is separate

`npm run eval` measures *reading*. It says nothing about whether the verdicts
are right, and the verdict is the product. `risk.check.ts` covers the layers
between a model rating and what appears on the card: record overrides in both
directions, personal overrides, negation, idempotent re-derivation, and the
verdict word matching the worst row.

The model's own judgement is an **input** to that check, fixed per fixture, not
something under test. Everything it does check is deterministic, which is the
point — those layers fail silently, because a policy rule that stops firing
throws no error and simply reports "no concerns found".

## Label extraction

Regression-tests the vision pipeline (`server/services/labelReader.ts`) against
label photos with known-correct answers.

```bash
npm run eval                        # all cases, default provider chain
npm run eval -- --provider=gemini   # pin a provider: gemini | openai | ocr
npm run eval -- --cases=bamba-peanut
npm run eval -- --threshold=0.85    # ingredient-recall gate (default 0.9)
```

Each run makes one real vision-model API call per case.

## Gates

- **Major-allergen recall is a hard release blocker** (exit code 2). A truth
  allergen counts as detected if any extracted ingredient matches its keyword
  list (`eval/scoring.ts`). False negatives here are the ER-visit scenario.
- Ingredient recall below `--threshold` fails with exit code 1. False
  positives (extra ingredients) are reported but don't gate.

## Adding a case

1. Put the photo anywhere in the repo (existing scans live in `attached_assets/`).
2. Create `eval/cases/<case-id>/case.json`:

```json
{
  "image": "attached_assets/IMG_xxxx.jpeg",
  "description": "what makes this case hard",
  "productType": "food | personal_care",
  "language": "en",
  "verified": false,
  "truth": {
    "ingredients": ["exact", "canonical", "English", "names"],
    "majorAllergens": ["milk", "wheat", "soy"]
  }
}
```

3. Transcribe the ingredient list from the photo **by hand** and set
   `verified: true` once a human has checked it against the physical label.
   Cases seeded by AI transcription stay `verified: false` and produce a
   warning on every run until reviewed.

## `crossCheckedAgainstPhoto` is not `verified`

Two different claims, and the weaker must not read as the stronger:

- **`crossCheckedAgainstPhoto`** — the transcription was compared against the
  photo. Catches dropped and mistranslated ingredients. On 2026-08-12 this
  found two real omissions across the six seed cases.
- **`verified`** — a human held the physical packet.

Only a human sets `verified`. A model re-reading the same image it transcribed
proves nothing about the cases where the image itself is ambiguous — a fold in
the bag, a glare, text running off the edge.

All six cases are currently cross-checked and none are verified. What a human
still needs to confirm:

| Case | What to check |
| --- | --- |
| `bamba-peanut` | Nothing found; confirm the 5-item list. |
| `paul-mitchell-tea-tree` | Nothing found; confirm all 38 INCI names. |
| `sacha-tofu-tw` | Confirm the sacha-sauce sub-list (11 items inside one paren) and that 麥芽 is malt, not maltose. |
| `spartak-dark-chocolate` | **The two languages disagree.** Chinese 致敏提示 says soy IS present; the Russian lists СОЮ as may-contain. The case takes the Chinese as truth — confirm that is the right call. |
| `tj-latte-pretzels` | Confirm "Cocoa Powder Processed With Alkali" is a separate listed ingredient from plain "Cocoa Powder". |
| `vermont-curry` | Confirm "Sugar and Milk Powder Mixture" is a named compound on the box. |

## Current gaps (add cases for these)

- **Non-English labels** — three of the six cases are now non-English or
  dual-language (`sacha-tofu-tw` zh-TW, `spartak-dark-chocolate` zh+ru). Still
  missing: ja, es, fr, ko (idea report calls for 5+ label languages in beta).
- Low-light / blurry shots, refrigerated (condensation) packaging.
- Labels with no ingredient list visible (should error, not hallucinate).
- Sesame, egg, fish, shellfish, tree-nut allergen coverage.
