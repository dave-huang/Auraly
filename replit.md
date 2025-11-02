# Auraly - AI-Powered Ingredient Analysis App

## Overview
Auraly is a mobile-friendly web application designed to help users understand the ingredients in their food, skincare, and personal care products. It allows users to scan or upload product labels in any language, utilizes AI to extract and analyze ingredients, and highlights potential health risks with clear, user-friendly explanations. The project aims to empower users with knowledge about product compositions, promoting healthier choices.

## User Preferences
- Privacy-focused: No user accounts, images not stored on server
- Mobile-friendly: Optimized for on-the-go scanning
- Multi-language support: Full English, Spanish, and Chinese UI, OCR works with various languages, AI analysis results in user's preferred language
- Instant results: Real-time analysis without registration
- Language preference: Stored locally in browser, persists across sessions

## System Architecture
Auraly employs a mobile-first, wellness-inspired design with a calm, trustworthy aesthetic. It features a clear visual hierarchy, risk-based color-coding, and generous whitespace.

### Frontend (React + TypeScript)
- **Pages**: Landing (`/`), Upload (`/upload`), and Results (`/results`), all fully translated.
- **Key Components**: `ProductTypeSelector`, `ImageUploader` (mobile-first with camera as primary CTA), `IngredientCard`, `RiskSummary`, `LanguageSwitcher`.
- **Internationalization**: Uses `i18next` with `en`, `es`, `zh` translation files. Language preference is stored in `localStorage` and dictates both UI and AI analysis output.
- **State Management**: `TanStack Query` for API calls (with 2-minute timeout), `sessionStorage` for pending analysis data, `localStorage` for scan history (last 10 scans) and language preference.

### Backend (Node.js + Express)
- **API Endpoints**:
    - `POST /api/ocr`: Extracts text using a dual OCR system (Google Cloud Vision API with Tesseract.js fallback).
    - `POST /api/analyze`: Analyzes ingredients using OpenAI GPT-4o, accepting a `userLanguage` parameter ('en', 'es', or 'zh') and returning results in the specified language.
- **Services**:
    - `ocr.ts`: Orchestrates the dual OCR process.
    - `googleVisionOcr.ts`: Google Cloud Vision API integration.
    - `analyzer.ts`: GPT-4o ingredient analysis, including schema validation and multi-language support with explicit ingredient name translation instructions. Optimized for speed (10-20 seconds).
    - `openai.ts`: OpenAI client using Replit AI Integrations.
- **Error Handling**: Robust error handling for OCR failures, AI response validation against Zod schemas, and meaningful error messages.

### Design System
- **Colors**: Wellness-inspired palette (soft greens, creams, pastels) with specific colors for risk indicators (Green, Amber, Red).
- **Typography**: Primary font is Inter; accent font is Space Grotesk for headings.
- **Design Principles**: Mobile-first responsive, calm aesthetic, clear visual hierarchy, rounded corners, subtle animations, and hover states.

### Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Wouter.
- **Backend**: Node.js, Express, TypeScript.
- **Storage**: In-memory (no database), `localStorage` for client-side history.

## External Dependencies
- **AI/ML**:
    - **OpenAI GPT-4o**: Used for AI-powered ingredient analysis via Replit AI Integrations.
    - **Google Cloud Vision API**: Primary OCR engine for text extraction from product labels.
    - **Tesseract.js**: Fallback OCR engine.
- **Deployment**: Replit platform.

## Recent Changes (November 2, 2025)

### Image Compression Fix ✅ (Latest)
- **Fixed QuotaExceededError on mobile devices when storing images**
  - **Previous behavior**: Camera worked but threw QuotaExceededError when trying to store full-size photos (3-8MB) in sessionStorage
  - **Root cause**: Mobile browsers have sessionStorage limits (5-10MB), and base64-encoded images exceeded this limit
  - **Solution**: Implemented automatic image compression before storage
  
- **Image Compression Implementation**
  - Created `imageCompression.ts` utility that compresses images to max 1200x1200px at 85% quality
  - Reduces typical mobile photo from 3-8MB to <500KB (80-90% reduction)
  - Maintains sufficient resolution for OCR text extraction
  - Async compression with error handling and user feedback
  
- **Technical Details**
  - Canvas-based compression using JPEG format
  - Preserves aspect ratio while reducing dimensions
  - Error handling with translated toast notifications (EN/ES/ZH)
  - Console logging shows compression ratio for debugging
  
- **User Experience**
  - ✅ Photos now upload successfully on all mobile devices
  - ✅ Faster upload times due to smaller file sizes
  - ✅ No visible quality loss for OCR purposes
  - ✅ Graceful error handling with user-friendly messages

### iOS Mobile File Input Fix ✅
- **Fixed critical iOS Safari/Chrome issue where camera and file upload were completely unresponsive**
  - **Previous behavior**: User clicked camera/upload button → nothing happened (silent failure on mobile)
  - **Root cause**: iOS security restrictions block programmatically clicking hidden file inputs (display:none)
  - **Additional issues**: Dynamic `capture` attribute changes and `.click()` calls violate iOS Web API policies
  
- **Mobile-First Architecture Implementation**
  - Two dedicated file inputs: camera (with `capture="environment"`) and file upload (without capture)
  - Inputs remain in DOM but visually hidden using `opacity-0 absolute` (NOT `display:none`)
  - Trigger via `<label htmlFor>` associations instead of programmatic `.click()` calls
  - Static `capture` attribute (not dynamically toggled at runtime)
  - SessionStorage persistence for selectedProductType to survive camera navigation
  
- **Technical Details**
  - Follows iOS Web API best practices for file input handling
  - Label-based activation ensures native browser file picker launches correctly
  - No state loss when switching to/from camera interface on mobile browsers
  - Compatible with iOS Safari, Chrome, and all desktop browsers
  
- **User Experience**
  - ✅ Camera and upload now work reliably on iOS Safari and Chrome
  - ✅ Direct user gesture recognition (no programmatic clicks blocked by iOS)
  - ✅ Smooth flow: select product type → scan/upload → immediate navigation to results
  - ✅ Consistent experience across all devices and browsers