# Auraly - AI-Powered Ingredient Analysis App

## Overview
Auraly is a mobile-friendly web application that helps users understand ingredients in their food, skincare, and personal care products. Users can scan or upload product labels in any language, and the app uses AI to extract and analyze ingredients, highlighting potential health risks with clear, friendly explanations.

**Current State**: MVP complete and functional with enhanced OCR
- Landing page with wellness-inspired design
- Product type selection (Food, Skincare/Haircare, Oral Care, Cosmetics)
- Image upload and camera capture functionality
- **Dual OCR system: Google Cloud Vision API (primary) with Tesseract.js fallback**
- AI-powered ingredient analysis using GPT-5
- Risk-coded results with expandable ingredient details
- Local scan history storage

## Recent Changes (October 28, 2025)
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
- `/` - Landing page with hero, features, and how-it-works sections
- `/upload` - Two-step flow: product type selection → image upload/camera
- `/results` - Analysis results with risk summary and ingredient cards

**Key Components:**
- `ProductTypeSelector` - 4-card grid for product type selection
- `ImageUploader` - Drag-drop zone with camera/file upload buttons
- `IngredientCard` - Risk-coded expandable card for each ingredient
- `RiskSummary` - Overall risk assessment with color-coded breakdown

**State Management:**
- TanStack Query for API calls and mutations
- sessionStorage for pending analysis data
- localStorage for scan history (last 10 scans)

### Backend (Node.js + Express)
**API Endpoints:**
- `POST /api/ocr` - Extract text from image using dual OCR system
- `POST /api/analyze` - Analyze ingredients with OpenAI GPT-5

**Services:**
- `services/ocr.ts` - Dual OCR orchestrator (Google Vision → Tesseract fallback)
- `services/googleVisionOcr.ts` - Google Cloud Vision API OCR implementation
- `services/analyzer.ts` - GPT-5 ingredient analysis with schema validation
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
- Multi-language support: OCR works with various languages (translated to English for analysis)
- Instant results: Real-time analysis without registration

## Development Notes

### Running Locally
```bash
npm run dev
```
Server runs on port 5000 with Vite dev server for frontend.

### Key Files
- `shared/schema.ts` - TypeScript types and Zod schemas shared between frontend/backend
- `design_guidelines.md` - Comprehensive design system documentation
- `server/services/analyzer.ts` - Product-type-specific health risk criteria
- `client/src/pages/results.tsx` - Main results page with mutation handling

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
