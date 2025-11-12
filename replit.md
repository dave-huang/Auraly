# Auraly - AI-Powered Ingredient Analysis App

## Overview
Auraly is a mobile-friendly web application designed to help users understand the ingredients in their food, skincare, and personal care products. It allows users to scan or upload product labels in any language, using AI to extract and analyze ingredients, highlighting potential health risks with clear, user-friendly explanations. The project's vision is to empower users with knowledge about product compositions, fostering informed choices for better health and wellness.

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
- **State Management**: TanStack Query for API calls (with 2-minute timeout), sessionStorage for pending analysis, localStorage for scan history and language preference.
- **UI/UX Decisions**:
    - **Design System**: Wellness-inspired palette (soft greens, creams, pastels), Inter and Space Grotesk fonts.
    - **Principles**: Mobile-first, calm aesthetic, clear visual hierarchy, risk color-coding, generous whitespace, rounded corners, subtle animations.
    - **Image Preprocessing**: Automatic client-side image enhancement (max 1800px, 90% JPEG quality, contrast boost, sharpening) to improve OCR accuracy. Optimized to prevent sessionStorage quota errors while maintaining excellent text clarity.
    - **Progress Bar**: Smooth 0-95% animation over 20 seconds for visual feedback during analysis.

### Backend (Node.js + Express)
- **API Endpoints**:
    - `POST /api/ocr`: Extracts text using a dual OCR system (Google Cloud Vision API with Tesseract.js fallback).
    - `POST /api/analyze`: Analyzes ingredients with OpenAI GPT-4o, accepting `userLanguage` (`en`, `es`, `zh`). Optimized for speed (10-20 seconds).
- **Services**:
    - `services/ocr.ts`: Orchestrates OCR process.
    - `services/googleVisionOcr.ts`: Google Cloud Vision integration.
    - `services/analyzer.ts`: GPT-4o ingredient analysis with Zod schema validation and multi-language support. Includes explicit instructions for AI to respond in the user's preferred language, translating ingredient names.
    - `openai.ts`: OpenAI client using Replit AI Integrations.
- **Error Handling**: Robust validation for OCR text length and AI response schemas.
- **Feature Specifications**:
    - **Dual OCR System**: Combines Google Cloud Vision API with DOCUMENT_TEXT_DETECTION (primary, optimized for dense ingredient labels) with Tesseract.js (fallback) for enhanced accuracy across languages and image qualities. Uses language hints for 10+ common languages.
    - **AI-Powered Analysis**: Utilizes GPT-4o for rapid (10-20s) and accurate ingredient analysis, providing risk assessments and detailed explanations in the user's chosen language. Enhanced with:
      - **Parenthetical Expansion**: Automatically expands grouped ingredients (e.g., "Enriched Flour (Wheat Flour, Niacin)" → extracts Wheat Flour and Niacin separately)
      - **Deduplication**: Counts each distinct ingredient only once
      - **Comprehensive Extraction**: Ensures ALL ingredients are identified, including additives, vitamins, preservatives, and colorings
    - **Intelligent Completeness Validation**: 
      - Schema-level minimum validation (requires at least 1 ingredient)
      - Smart section boundary detection: finds "INGREDIENTS:" markers in multiple languages and stops at "CONTAINS:", "DIRECTIONS:", etc.
      - Adaptive enforcement: skips completeness check for mixed-content labels (when markers are found) since AI is better at extracting ingredients than heuristics are at estimating from mixed content
      - For simple ingredient lists: enforces 80% threshold (detected >= 80% of estimated count)
      - Bulletproof pattern matching: only counts line-start bullets (`^[•·∙\*]\s`), ignoring hyphens in ingredient names like "beta-carotene"
    - **Multi-Language Support**: Full internationalization for UI and AI analysis results in English, Spanish, and Chinese, ensuring the AI responds in the user's selected language regardless of the scanned product's language.
    - **Mobile Optimization**: Redesigned ImageUploader with camera scan as primary CTA, 2-minute timeout protection, and mobile browser compatibility fixes.
    - **Product-Specific Analysis**: Analyzer uses different safety criteria based on product type (Food, Skincare, Oral Care, Cosmetics).

### Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Wouter
- **Backend**: Node.js, Express, TypeScript
- **Storage**: In-memory (no database), localStorage for client-side history.

## External Dependencies
- **AI/ML**:
    - OpenAI GPT-4o (via Replit AI Integrations)
    - Google Cloud Vision API (for OCR)
    - Tesseract.js (for OCR fallback)
- **Internationalization**: i18next, react-i18next
- **Deployment**: Replit (hosting platform)