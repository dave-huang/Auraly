# Auraly - AI-Powered Ingredient Analysis App

## Overview
Auraly is a mobile-friendly web application designed to help users understand the ingredients in their food, skincare, and personal care products. It allows users to scan or upload product labels in any language, using AI to extract and analyze ingredients, highlighting potential health risks with clear, user-friendly explanations. The project's vision is to empower users with knowledge about product compositions, fostering informed choices for better health and wellness.

## Recent Changes (November 21, 2025)
### Backend Ingredient Caching with Auto-Refresh
- **New `/api/analyze-ingredients` Endpoint**: Batch ingredient analysis with intelligent caching
- **Cache Architecture**: 
  * Category-specific cache keys (ingredient name + product type)
  * 30-day automatic refresh - stale entries re-analyzed on next request
  * In-memory cache with JSON file persistence for durability
  * Automatic deduplication of ingredients within same request
- **Performance Impact**: Repeat scans of same products return cached results instantly (near-zero latency for cached hits)
- **Cache Monitoring**: `/api/cache-stats` endpoint provides hit rate, fresh/stale counts for debugging
- **Error Handling**: Graceful ingredient-level errors - one failure doesn't crash entire batch

## Previous Changes (November 15, 2025)
### Major Performance & Reliability Overhaul
- **75% Faster Processing**: Simplified to use only Gemini 2.5 Flash for OCR (2-5s, reliable and fast)
- **Single Fast OCR**: Gemini Flash as primary, Google Vision as optional fallback only on failure
- **Removed Complexity**: Eliminated slow Tesseract (20-30s) and parallel OCR overhead
- **Combined Pipeline**: New `/api/scan-and-analyze` endpoint eliminates client round-trip latency
- **Reverted to GPT-4o**: Using Replit AI Integrations for reliability (GPT-5.1 had quota issues)
- **Total Time Reduction**: 
  * English/Spanish: 30-40s → 7-15s (75% faster)
  * Chinese: 60-120s → 35-50s (60% faster)
- **Higher Reliability**: Replit integrations handle all billing/quotas automatically

## User Preferences
- Privacy-focused: No user accounts, images not stored on server
- Mobile-friendly: Optimized for on-the-go scanning
- Multi-language support: Full English, Spanish, and Chinese UI, OCR works with various languages, AI analysis results in user's preferred language
- Instant results: Real-time analysis without registration
- Language preference: Stored locally in browser, persists across sessions

## System Architecture

### Frontend (React + TypeScript)
- **Pages**: Landing (`/`), Upload (`/upload`), Results (`/results`). All fully internationalized.
- **Components**: `ProductTypeSelector`, `ImageUploader` (mobile-first design with camera as primary CTA), `IngredientCard`, `RiskSummary`, `LanguageSwitcher`.
- **Internationalization**: i18next configured with `en`, `es`, `zh` locales. Language preference stored in localStorage.
- **State Management**: TanStack Query for API calls (with 5-minute timeout), sessionStorage for pending analysis, localStorage for scan history and language preference.
- **UI/UX Decisions**:
    - **Design System**: Wellness-inspired palette (soft greens, creams, pastels), Inter and Space Grotesk fonts.
    - **Principles**: Mobile-first, calm aesthetic, clear visual hierarchy, risk color-coding, generous whitespace, rounded corners, subtle animations.
    - **Image Preprocessing**: Automatic client-side image enhancement (max 2400px, grayscale conversion for better OCR character recognition) to improve OCR accuracy. Optimized to prevent sessionStorage quota errors while maintaining excellent text clarity. Removed aggressive sharpening that was destroying character edges.
    - **Progress Bar**: Smooth 0-95% animation over 20 seconds for visual feedback during analysis.

### Backend (Node.js + Express)
- **API Endpoints**:
    - `POST /api/scan-and-analyze`: **PRIMARY ENDPOINT** - Combined OCR + Analysis for maximum speed (7-50s total)
    - `POST /api/analyze-ingredients`: Batch ingredient analysis with category-specific caching (instant for cached)
    - `GET /api/cache-stats`: Cache performance metrics (hit rate, fresh/stale counts)
    - `POST /api/ocr`: Extracts text using Gemini Flash (2-5s, with optional Google Vision fallback)
    - `POST /api/analyze`: Analyzes ingredients with OpenAI GPT-4o (with GPT-4o-mini fallback)
- **Services**:
    - `services/cache.ts`: Ingredient cache with 30-day auto-refresh, deduplication, and JSON persistence
    - `services/ocr.ts`: Simple OCR orchestration - Gemini Flash primary, Google Vision fallback
    - `services/geminiOcr.ts`: Gemini 2.5 Flash vision-based OCR (2-5s, fast and reliable)
    - `services/googleVisionOcr.ts`: Google Cloud Vision fallback (only runs if Gemini fails)
    - `services/analyzer.ts`: GPT-4o ingredient analysis (with GPT-4o-mini fallback) with Zod schema validation and multi-language support
    - `gemini.ts`: Gemini client using Replit AI Integrations
    - `openai.ts`: OpenAI client using Replit AI Integrations
- **Error Handling**: Robust validation for OCR text length and AI response schemas.
- **Feature Specifications**:
    - **Fast OCR with Fallback**: Simplified single-engine approach for speed and reliability:
      * **Gemini 2.5 Flash** (primary, 2-5s) - Vision-based OCR using Replit AI Integrations, returns immediately on success
      * **Google Cloud Vision API** (fallback) - Only runs if Gemini fails and API key is configured
      * Sequential execution: fast path completes in 2-5s, no waiting for slower engines
    - **Combined Scan & Analyze Pipeline**: `/api/scan-and-analyze` endpoint eliminates round-trip latency by running OCR and AI analysis sequentially in a single request. Supports optional `ocrText` parameter to skip OCR when cached text is available. Total processing time: 7-15s (EN/ES) or 35-50s (ZH) - down from 30-120s baseline.
    - **Automatic Retry System**: Frontend auto-retries failed requests to handle intermittent API issues invisibly:
      * Up to 2 automatic retries with exponential backoff (3s, 6s delays)
      * OCR text caching: successful OCR results are cached and reused on retries to skip the 2-5s OCR stage
      * Smart retry: retries only re-run the failed stage (Analysis), not the entire pipeline
      * Non-retryable errors (OCR failures, client errors) fail immediately without wasting retry attempts
      * User sees retry status in UI with translations in EN, ES, ZH
      * Total attempts: up to 6 (3 backend + 2 frontend) before showing error
      * Makes transient GPT-4o rate limits and timeouts invisible to users
    - **AI-Powered Analysis**: Utilizes GPT-4o for fast and accurate ingredient analysis (automatically falls back to GPT-4o-mini if unavailable). Provides risk assessments and clear explanations in the user's chosen language. Enhanced with:
      - **Parenthetical Expansion**: Stack-based parser that intelligently handles parenthetical patterns:
        * Category expansion: "Enriched Flour (Wheat, Niacin)" → extracts "Wheat, Niacin" (multiple items)
        * Alias/qualifier: "Niacin (Vitamin B3)" → keeps "Niacin" only (single item, drops alias)
        * Certification: "Palm Oil (RSPO Certified)" → keeps "Palm Oil" only (drops qualifier)
      - **Deduplication**: Counts each distinct ingredient only once
      - **Comprehensive Extraction**: Ensures ALL ingredients are identified, including additives, vitamins, preservatives, and colorings
      - **Dynamic Token Allocation**: Language-aware token optimization for speed and completeness:
        * English/Spanish: ingredientCount × 140 + 800, capped at 6,000 tokens
        * Chinese: ingredientCount × 110 + 600, capped at 4,500 tokens (faster due to higher token density)
      - **Robust Retry Logic**: Up to 3 retry attempts with exponential backoff (2s, 4s, 8s) to handle OpenAI API intermittent failures (500/502/503 server errors, timeouts, rate limits)
      - **Extended Timeout**: 5-minute frontend timeout to accommodate longest analyses (Chinese mode can take 2-3 minutes)
      - **Clear Error Messages**: Specific user-friendly messages for server errors, timeouts, rate limits, and network issues instead of generic "Load failed"
      - **Lower Temperature**: Uses 0.3 temperature for more consistent JSON output
    - **Intelligent Completeness Validation**: 
      - Schema-level minimum validation (requires at least 1 ingredient)
      - Smart section boundary detection: finds "INGREDIENTS:" markers in multiple languages and stops at "CONTAINS:", "DIRECTIONS:", etc.
      - Currently DISABLED: Completeness check temporarily disabled to avoid false positives from parenthetical expansion
      - Bulletproof pattern matching: only counts line-start bullets (`^[•·∙\*]\s`), ignoring hyphens in ingredient names like "beta-carotene"
    - **Cross-Language Consistency**: 
      - Acceptable variance: ±3-4 ingredients across languages (EN, ES, ZH)
      - Variance source: AI temperature=0.3 + non-deterministic translation-based deduplication
      - Tested with curry label: EN=40, ES=41, ZH=43 (variance=3, within acceptable range)
    - **Multi-Language Support**: Full internationalization for UI and AI analysis results in English, Spanish, and Chinese, ensuring the AI responds in the user's selected language regardless of the scanned product's language.
    - **Mobile Optimization**: Redesigned ImageUploader with camera scan as primary CTA, 5-minute timeout protection, and mobile browser compatibility fixes.
    - **Product-Specific Analysis**: Analyzer uses different safety criteria based on product type (Food, Skincare, Oral Care, Cosmetics).

### Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Wouter
- **Backend**: Node.js, Express, TypeScript
- **Storage**: 
    - Ingredient cache: In-memory + JSON file persistence (ingredient_cache.json)
    - Client-side: localStorage for scan history and language preference
    - No external database required

## External Dependencies
- **AI/ML**:
    - **Gemini 2.5 Flash** (via Replit AI Integrations) - Primary OCR, no API key required
    - **OpenAI GPT-4o** (via Replit AI Integrations) - Primary ingredient analysis, with GPT-4o-mini fallback, no API key required
    - **Google Cloud Vision API** - Optional OCR fallback (requires API key, only used if Gemini fails)
- **Internationalization**: i18next, react-i18next
- **Deployment**: Replit (hosting platform)
