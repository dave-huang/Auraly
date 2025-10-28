# Auraly - AI-Powered Ingredient Analysis App

## Overview
Auraly is a mobile-friendly web application that helps users understand ingredients in their food, skincare, and personal care products. Users can scan or upload product labels in any language, and the app uses AI to extract and analyze ingredients, highlighting potential health risks with clear, friendly explanations.

**Current State**: MVP complete and functional with enhanced OCR, performance optimization, and full internationalization
- Landing page with wellness-inspired design
- Product type selection (Food, Skincare/Haircare, Oral Care, Cosmetics)
- Image upload and camera capture functionality
- **Dual OCR system: Google Cloud Vision API (primary) with Tesseract.js fallback**
- **AI-powered ingredient analysis using GPT-4-turbo (optimized for speed: 10-20s analysis time)**
- **Full multi-language support: English and Chinese (both UI and AI analysis results)**
- Risk-coded results with expandable ingredient details
- Local scan history storage
- Language preference persisted in localStorage
- **Mobile-optimized with 2-minute timeout protection**

## Recent Changes (October 28, 2025)

### Performance Optimization & Mobile Fix (Latest) ✅
- **Switched from GPT-5 to GPT-4-turbo for 3-5x faster analysis**
  - Reduced analysis time from 60-75 seconds to 10-20 seconds
  - GPT-4-turbo avoids GPT-5's heavy reasoning token overhead (7,000+ tokens)
  - Maintains accuracy while dramatically improving user experience
- **Added timeout support to prevent mobile failures**
  - Implemented AbortController with 2-minute default timeout
  - Fixed "Load Failed" error on mobile browsers
  - Provides clear error messages if timeout occurs
- **Mobile compatibility verified**: Analysis completes well within mobile browser timeout limits

### Mobile-First UX Optimization ✅
- **Redesigned ImageUploader for mobile-first scanning experience**
- Camera scanning is now the PRIMARY CTA with large, prominent card and button
- File upload is SECONDARY with smaller drag-drop zone below divider
- Restored drag-and-drop functionality for desktop users
- Uses proper Button sizing without custom padding (follows design guidelines)
- Clear visual hierarchy: "Scan with Camera" → "or" divider → "Upload from Files"
- **Full keyboard accessibility**: Enter/Space keys, proper tabIndex and ARIA labels
- **Screen reader support**: Descriptive aria-labels for all interactive elements
- Updated translations for new UI text in both English and Chinese
- **Tested and verified**: E2E tests confirm visual hierarchy, keyboard navigation, and mobile-first UX

### Bug Fixes & Improvements
- **Fixed GPT-5 token issue**: Increased max_completion_tokens to 16,384 to accommodate reasoning overhead
- **Fixed language normalization**: Extract 'en' or 'zh' from browser locale codes before API calls
- **Robust error handling**: Image validation, Tesseract worker management, 30-second timeouts
- Global error handlers prevent server crashes

### Multi-Language Support
- **Implemented complete internationalization (i18n) with English and Chinese**
- Installed and configured i18next and react-i18next
- Created comprehensive translation files for all UI text
- Built language switcher component (globe icon) on all pages
- Updated backend analyzer to return ingredient analysis in user's preferred language
- Language preference stored in localStorage and synced across sessions
- AI now provides ingredient names, summaries, and details in the selected language

### Google Cloud Vision OCR Integration
- **Integrated Google Cloud Vision API for improved OCR accuracy**
- Implemented intelligent fallback: Google Vision → Tesseract.js
- Enhanced OCR handles curved text, poor lighting, and multiple languages
- Fixed apiRequest response parsing (.json() call)

## Previous Changes (October 27, 2025)
- Initial MVP implementation completed
- Implemented complete frontend with three pages (Landing, Upload, Results)
- Built backend with OpenAI integration and Tesseract.js OCR
- Added comprehensive error handling for OCR failures and AI response validation
- Implemented risk-coded ingredient display with expandable details
- Added localStorage-based scan history
- Mobile-first responsive design with wellness aesthetic

## Project Architecture

### Frontend (React + TypeScript)
**Pages:**
- `/` - Landing page with hero, features, and how-it-works sections (fully translated)
- `/upload` - Two-step flow: product type selection → image upload/camera (fully translated)
- `/results` - Analysis results with risk summary and ingredient cards (fully translated)

**Key Components:**
- `ProductTypeSelector` - 4-card grid for product type selection (uses i18n translations)
- `ImageUploader` - Mobile-first design with camera scan as primary CTA (large card) and file upload as secondary (smaller drag-drop zone)
- `IngredientCard` - Risk-coded expandable card for each ingredient
- `RiskSummary` - Overall risk assessment with color-coded breakdown
- `LanguageSwitcher` - Globe icon dropdown to switch between English and Chinese

**Internationalization:**
- i18next configuration in `client/src/i18n/config.ts`
- Translation files: `client/src/i18n/locales/{en,zh}.json`
- Language preference stored in localStorage
- All UI text supports English and Chinese
- AI analysis results returned in user's preferred language

**State Management:**
- TanStack Query for API calls and mutations with 2-minute timeout protection
- sessionStorage for pending analysis data
- localStorage for scan history (last 10 scans) and language preference

### Backend (Node.js + Express)
**API Endpoints:**
- `POST /api/ocr` - Extract text from image using dual OCR system (typically 1-2 seconds)
- `POST /api/analyze` - Analyze ingredients with OpenAI GPT-4-turbo in user's preferred language (10-20 seconds)
  - Accepts `userLanguage` parameter ('en' or 'zh')
  - Returns ingredient names, summaries, and details in requested language

**Services:**
- `services/ocr.ts` - Dual OCR orchestrator (Google Vision → Tesseract fallback)
- `services/googleVisionOcr.ts` - Google Cloud Vision API OCR implementation
- `services/analyzer.ts` - GPT-4-turbo ingredient analysis with schema validation and multi-language support
  - Language-specific prompts for English and Chinese
  - Instructs AI to respond in user's preferred language
  - Optimized for speed (10-20s vs GPT-5's 60-75s)
- `openai.ts` - OpenAI client using Replit AI Integrations

**Error Handling:**
- OCR validates extracted text length (minimum 5 characters)
- AI responses validated against Zod schemas before returning
- Meaningful error messages guide users to retry with better images

### Design System
**Colors:**
- Wellness-inspired palette: soft greens, creams, pastels
- Primary: Green tones (hsl 158 64% 42%)
- Risk indicators: Green (low), Amber (moderate), Red (high)

**Typography:**
- Primary: Inter - Clean, modern sans-serif
- Accent: Space Grotesk - Rounded geometric for headings

**Key Design Principles:**
- Mobile-first responsive design
- Calm, trustworthy aesthetic
- Clear visual hierarchy with risk color-coding
- Generous whitespace and rounded corners
- Subtle animations and hover states

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Wouter
- **Backend**: Node.js, Express, TypeScript
- **AI/ML**: OpenAI GPT-5 (via Replit AI Integrations), Google Cloud Vision API, Tesseract.js
- **Storage**: In-memory (no database), localStorage for client-side history
- **Deployment**: Replit

## User Preferences
- Privacy-focused: No user accounts, images not stored on server
- Mobile-friendly: Optimized for on-the-go scanning
- **Multi-language support**: Full English and Chinese UI, OCR works with various languages, AI analysis results in user's preferred language
- Instant results: Real-time analysis without registration
- Language preference: Stored locally in browser, persists across sessions

## Development Notes

### Running Locally
```bash
npm run dev
```
Server runs on port 5000 with Vite dev server for frontend.

### Key Files
- `shared/schema.ts` - TypeScript types and Zod schemas shared between frontend/backend (includes `userLanguage` field)
- `design_guidelines.md` - Comprehensive design system documentation
- `server/services/analyzer.ts` - Product-type-specific health risk criteria with multi-language support
- `client/src/pages/results.tsx` - Main results page with mutation handling and language-aware API calls
- `client/src/i18n/config.ts` - i18next configuration with language detection and localStorage persistence
- `client/src/i18n/locales/{en,zh}.json` - Translation files for English and Chinese
- `client/src/components/language-switcher.tsx` - Language selection dropdown component

### Future Enhancements
- User accounts with persistent scan history (Replit Auth)
- Advanced filtering and search within results
- Shareable product report permalinks
- Comprehensive ingredient database with research citations
- Native mobile app conversion (React Native or Capacitor)

## API Integration
**Replit AI Integrations:**
- Uses environment variables: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`
- No personal API key required
- Charges billed to Replit credits
- Model: GPT-5 (latest as of August 2025)

## Product-Specific Analysis Contexts
The analyzer uses different safety criteria based on product type:
- **Food**: Additives, sweeteners, allergens, trans fats, sodium
- **Skincare**: Parabens, sulfates, phthalates, fragrances, heavy metals
- **Oral Care**: Triclosan, SLS, microbeads, excessive fluoride
- **Cosmetics**: Parabens, phthalates, formaldehyde, toluene, heavy metals
