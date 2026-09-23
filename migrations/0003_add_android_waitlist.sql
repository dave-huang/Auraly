-- The Android waitlist on revely.life. An email address and the language of
-- the page it was left on, keyed by the address so asking twice is one row.
-- Not linked to users: the people on it have no account, because they have no
-- app. The page and the privacy policy both promise one email, then deletion,
-- so this table is meant to be emptied the day it is used.
--
-- Additive only. Apply this file directly rather than with db:push, which
-- offers to drop the legacy promo and referral tables; see 0002.
CREATE TABLE "android_waitlist" (
	"email" varchar(254) PRIMARY KEY NOT NULL,
	"lang" varchar(8) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
