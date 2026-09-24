-- The label facts a scan was scored on: English ingredient names, the label's
-- own allergen statement, the names as printed, the label's language and the
-- read confidence. Without them a reopened Chinese or Spanish scan was scored
-- against its translated names and came back different from the live result.
-- Nullable: every earlier scan has none, and readers fall back to the old
-- behaviour. Additive only; apply this file directly, not with db:push.
ALTER TABLE "scan_history" ADD COLUMN "label_context" jsonb;