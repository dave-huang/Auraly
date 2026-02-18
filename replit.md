# Auraly - AI-Powered Ingredient Analysis App

## Overview
Auraly is a mobile-friendly web application designed to help users understand the ingredients in their food, skincare, and personal care products. It allows users to scan or upload product labels in any language, using AI to extract and analyze ingredients, highlighting potential health risks with clear, user-friendly explanations. The project's vision is to empower users with knowledge about product compositions, fostering informed choices for better health and wellness.

## Monetization Model
- **Free tier**: 2 free scans per day (reset at midnight UTC) for all users
- **Paid**: One-time purchase of 10-scan bundles for $2.99 via Stripe (scans never expire)
- **Scan priority**: Free daily scans used first, then purchased scans
- **All features available**: Multi-language support, personalized risk assessments, scan history, settings - only scan volume is limited

## User Preferences
- Privacy-focused: Images not stored on server
- Mobile-friendly: Optimized for on-the-go scanning
- Multi-language support: Full English, Spanish, and Chinese UI, OCR works with various languages, AI analysis results in user's preferred language
- Language preference: Stored locally in browser, persists across sessions
- Personalized Risk Settings: Users can configure sensitivity to 11 ingredient categories, with risk levels adjusted at display time based on preferences

## System Architecture

### Frontend (React + TypeScript)
- **Pages**: Landing (`/`), Onboarding (`/onboarding`), Settings (`/settings`), Upload (`/upload`), Results (`/results`), History (`/history`), Account (`/account`). All fully internationalized.
- **Components**: `ProductTypeSelector`, `ImageUploader` (mobile-first design with camera as primary CTA), `IngredientCard`, `RiskSummary`, `LanguageSwitcher`, `ScanCounter`, `ScanPurchaseModal`.
- **Internationalization**: i18next configured with `en`, `es`, `zh` locales. Language preference stored in localStorage.
- **State Management**: TanStack Query for API calls (with 5-minute timeout), sessionStorage for pending analysis, localStorage for scan history and language preference.
- **UI/UX Decisions**:
    - **Design System**: Wellness-inspired palette (soft greens, creams, pastels), Inter and Space Grotesk fonts.
    - **Principles**: Mobile-first, calm aesthetic, clear visual hierarchy, risk color-coding, generous whitespace, rounded corners, subtle animations.
    - **Image Preprocessing**: Automatic client-side image enhancement (max 2400px, grayscale conversion for better OCR character recognition) to improve OCR accuracy.
    - **Progress Bar**: Smooth 0-95% animation over 20 seconds for visual feedback during analysis.

### Backend (Node.js + Express)
- **API Endpoints**:
    - `POST /api/scan-and-analyze`: **PRIMARY ENDPOINT** - Combined OCR + Analysis for maximum speed.
    - `POST /api/analyze-ingredients`: Batch ingredient analysis with category-specific caching.
    - `GET /api/cache-stats`: Cache performance metrics.
    - `POST /api/ocr`: Extracts text using Gemini Flash.
    - `POST /api/analyze`: Analyzes ingredients with OpenAI GPT-5.1.
    - `GET /api/scan/quota` - Returns current scan quota (dailyFreeScansUsed, purchasedScanBalance, totalScansAvailable)
    - `POST /api/scan/purchase` - Creates Stripe checkout session for 10-scan bundle ($2.99)
    - `GET /api/user/allergen-preferences` - Fetch current preferences
    - `PATCH /api/user/allergen-preferences` - Update preferences
    - `POST /api/user/allergen-onboarding` - Complete allergen onboarding
    - `POST /api/admin/clear-cache` - **ADMIN ONLY** - Clears ingredient cache (use when AI prompts change)
    - `GET /api/admin/dashboard` - Admin dashboard stats with test user filtering
    - `GET /api/admin/daily-usage` - Last 30 days of login and scan activity
    - `GET /api/admin/ingredient-cache` - Browse cached ingredient analyses (limited to 500 entries)
    - `POST /api/admin/grant-scans` - Grant purchased scans to a user
- **Services**: `services/cache.ts`, `services/ocr.ts`, `services/geminiOcr.ts`, `services/googleVisionOcr.ts`, `services/analyzer.ts`, `services/subscription.ts`, `gemini.ts`, `openai.ts`.
- **Feature Specifications**:
    - **Fast OCR with Fallback**: Gemini 2.5 Flash (primary, 2-5s) with Google Cloud Vision API as fallback.
    - **Combined Scan & Analyze Pipeline**: `/api/scan-and-analyze` endpoint for sequential OCR and AI analysis in a single request.
    - **Automatic Retry System**: Frontend auto-retries failed requests with exponential backoff and OCR text caching.
    - **AI-Powered Analysis**: Utilizes GPT-5.2 for accurate ingredient analysis with a consumer-protective bias. Risk assessments err on the side of caution - when evidence is mixed or uncertain, the AI defaults to the higher risk category. High-risk ingredient descriptions include specific regulatory citations, scientific basis for concerns, and clear health implications to build credibility. Includes parenthetical expansion, deduplication, and dynamic token allocation.
    - **Allergen Risk Rules**: Common food allergens (soy, peanuts, tree nuts, dairy, eggs, wheat, fish, shellfish, sesame, coconut) are marked as "low" risk by default since they're only dangerous to individuals with allergies, not the general population. The AI prompt explicitly enforces this rule.
    - **High-Risk Ingredient Rules**: Consumer-protective hardcoded rules for ingredients with significant health concerns or international bans. Includes synthetic food dyes (Red 40, Yellow 5, etc. with E-number aliases), BHA/BHT/TBHQ, nitrates/nitrites, potassium bromate, parabens, phthalates, formaldehyde-releasers, triclosan, and oxybenzone. These are always marked as "high" risk with explanations of why.
    - **Intelligent Completeness Validation**: Schema-level validation and smart section boundary detection for ingredient lists.
    - **Cross-Language Consistency**: Acceptable ingredient count variance across English, Spanish, and Chinese analyses.
    - **Multi-Language Support**: Full internationalization for UI and AI analysis results in English, Spanish, and Chinese.
    - **Mobile Optimization**: Redesigned ImageUploader, 5-minute timeout protection, and mobile browser compatibility.
    - **Product-Specific Analysis**: Analyzer uses different safety criteria based on product type (Food & Supplements, Personal Care).
    - **Allergen Detection Framework**: 12 allergen categories (Food, Cosmetic, Chemical Additives) with toggle-based user preferences and intelligent detection.
    - **Personalized Risk Settings**: Users can configure tolerance levels ("Avoid", "Caution", "No Preference") for 11 ingredient categories.
    - **Simplified Two-Category System**: Streamlined product categories to "Food & Supplements" and "Personal Care" for improved analysis context and filtering.
    - **Mobile Background Resilience**: Automatically resumes polling and re-acquires Wake Lock when the app returns from the background.
    - **Backend Ingredient Caching**: `/api/analyze-ingredients` endpoint with intelligent, category-specific caching (stored in PostgreSQL `ingredient_cache` table for persistence across deployments) and 12-month auto-refresh.
    - **Performance & Reliability Overhaul**: Simplified OCR to Gemini 2.5 Flash, combined pipeline, and use of GPT-5.1 via direct OpenAI API for faster and more reliable processing.
    - **Account Management**: Account page (`/account`) showing scan balance, daily free scans, and purchased scan balance.
    - **Scan Quota System**: Daily free scan reset at midnight UTC, purchased scans never expire, free scans consumed first.

### Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Wouter
- **Backend**: Node.js, Express, TypeScript
- **Storage**:
    - **PostgreSQL Database**: User profiles with `dailyFreeScansUsed`, `lastDailyReset`, `purchasedScanBalance` fields for scan quota tracking. Also `riskPreferences` JSONB, `onboardingCompleted` boolean, `allergenPreferences` JSONB. Ingredient analysis cache in `ingredient_cache` table.
    - Client-side: localStorage for scan history and language preference.

## External Dependencies
- **AI/ML**:
    - **Gemini 2.5 Flash** (via Replit AI Integrations) - Primary OCR.
    - **OpenAI GPT-5.2** (via direct OpenAI API) - Primary ingredient analysis with consumer-protective risk thresholds.
    - **Google Cloud Vision API** - Optional OCR fallback.
- **Payments**: Stripe (one-time payments for scan bundles)
- **Internationalization**: i18next, react-i18next.
- **Analytics**: Google Analytics 4 (GA4) via gtag.js with custom event tracking.
- **Deployment**: Replit (hosting platform).

## Analytics Tracking (GA4)

### Setup
- Measurement ID stored in secret `VITE_GA_MEASUREMENT_ID`
- Auto-initializes on app load via `usePageTracking` hook in `App.tsx`
- Tracks page views automatically via `history.pushState` listener

### Custom Events Tracked
| Event Name | Trigger Location | Parameters |
|------------|------------------|------------|
| `scan_product` | Results page (scan success) | `product_type`, `success` |
| `scan_purchase` | Scan purchase modal | `bundle_size` |
| `language_change` | Language switcher | `from_language`, `to_language` |
| `onboarding_complete` | Onboarding finish/skip | - |

### Files
- `client/src/lib/analytics.ts` - Core gtag wrapper and event functions
- `client/src/hooks/use-analytics.tsx` - Page view tracking hook

## Known Issues & Workarounds

### Stripe Customer Sync Errors
**Issue**: The `stripe-replit-sync` package maintains a read-only `stripe.customers` table that may contain stale customer IDs (customers deleted from Stripe but still in the local table). This causes "No such customer" errors during sync.

**Workaround Implemented**: The `/api/scan/purchase` endpoint bypasses all cached customer data by:
1. Searching Stripe directly using userId metadata
2. Fallback search by email if no customer found by userId
3. Updating legacy customers with userId metadata if found by email
4. Creating a new customer with idempotency key (`customer-create-${userId}`) if none found
5. Updating the users table with the valid customer ID

**Impact**: Sync errors appear in logs but don't affect checkout functionality.

**Admin Tools**:
- `POST /api/admin/cleanup-stripe-customers` - Identifies stale customers and clears them from users table
