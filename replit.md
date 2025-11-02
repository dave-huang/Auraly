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