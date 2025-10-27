# Auraly Design Guidelines

## Design Approach

**Reference-Based Approach**: Drawing inspiration from wellness and health-focused applications like Calm, Headspace, and modern health tracking apps. The design prioritizes trust, clarity, and approachability while maintaining scientific credibility.

**Core Principles**:
- Reassuring wellness aesthetic that builds user confidence
- Scannable information hierarchy for quick risk assessment
- Gentle, non-alarming presentation of health data
- Mobile-first responsive experience optimized for on-the-go scanning

---

## Typography

**Font Families** (Google Fonts):
- Primary: 'Inter' - Clean, modern sans-serif for body text and UI elements
- Accent: 'Space Grotesk' - Slightly rounded geometric for headings

**Type Scale**:
- Hero Heading: text-5xl md:text-6xl, font-bold, tracking-tight
- Page Heading: text-3xl md:text-4xl, font-bold
- Section Heading: text-2xl md:text-3xl, font-semibold
- Card Title: text-lg md:text-xl, font-semibold
- Body Large: text-base md:text-lg, font-normal
- Body: text-sm md:text-base, font-normal
- Caption: text-xs md:text-sm, font-medium

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16, 20, 24** for consistent rhythm (e.g., p-4, gap-6, m-8, py-12, mt-16, py-20, py-24).

**Container Strategy**:
- Full-width sections with inner max-w-6xl for desktop
- Mobile: px-4, Desktop: px-8
- Vertical section padding: py-12 mobile, py-20 desktop

**Grid Systems**:
- Product type selection: grid-cols-2 md:grid-cols-4
- Ingredient results: Single column with stacked cards
- Feature showcase: grid-cols-1 md:grid-cols-3

---

## Component Library

### Navigation
- Sticky header with logo left, minimal navigation right
- Transparent on landing hero, solid white with subtle shadow on scroll
- Height: h-16 md:h-20

### Hero Section (Landing Page)
- Full viewport height (min-h-screen) with centered content
- Large headline with gradient text treatment
- Prominent CTA button (see Buttons below)
- Tagline and trust indicators ("Privacy-first • No account needed • Instant results")
- Background: Soft gradient mesh or wellness-themed imagery

### Product Type Selection Cards
- Large touch-friendly cards (min-h-32)
- Icon at top, label below
- Soft rounded corners (rounded-2xl)
- Subtle hover lift effect (transform translate)
- Active state with gentle border highlight

### Upload/Scan Interface
- Centered dropzone with dashed border (rounded-3xl)
- Large icon indicator
- Clear instruction text
- Camera button and file upload side-by-side on desktop, stacked on mobile
- Progress indicator: Linear progress bar with percentage

### Results - Ingredient Cards
- Risk color-coded left border (w-1 border-l-4)
  - 🟢 Green: #10B981 (safe)
  - 🟡 Yellow: #F59E0B (moderate)
  - 🔴 Red: #EF4444 (high risk)
- Card structure: Ingredient name (bold) → Risk badge → Short explanation → Expandable "Learn More"
- Shadow: shadow-sm hover:shadow-md transition
- Spacing: gap-4 between cards, p-6 internal padding

### Buttons
**Primary CTA** (Upload/Scan actions):
- Large size: px-8 py-4 text-lg
- Fully rounded (rounded-full)
- Gradient background with subtle shadow
- White text with medium font weight
- When on images: backdrop-blur-md with semi-transparent background

**Secondary** (Navigation, auxiliary):
- Outlined style with rounded-lg
- px-6 py-3
- Hover: filled with subtle background

**Icon Buttons** (Camera, rescan):
- Circular (rounded-full)
- p-4, icon size w-6 h-6

### Risk Indicators
- Badge style with rounded-full
- px-3 py-1 text-xs font-semibold
- Color-matched to risk level with 10% opacity background

### Loading States
- Pulsing animation for skeleton cards
- Circular spinner for analysis progress
- Smooth fade-in for results appearance

### Icons
Use **Heroicons** via CDN (outline style for UI, solid for indicators)

---

## Images

**Hero Section Image**: 
Large, high-quality lifestyle image showing someone scanning a product label in a bright, clean kitchen or wellness setting. Should feel authentic and relatable, not clinical. Image should have subtle overlay gradient (dark-to-transparent from bottom) to ensure text readability. Position: Full background with object-cover.

**Product Type Icons**: 
Use Heroicons for category selection (could be replaced with custom illustrations later):
- Food: cake icon or sparkles
- Skincare: beaker or heart
- Oral Care: academic-cap or clipboard
- Cosmetics: star or paint-brush

**Empty States**: 
Friendly illustration showing product scanning concept (can use placeholder SVG initially)

---

## Page-Specific Layouts

### Landing Page (/)
1. **Hero Section** (full viewport)
   - Centered content with headline, subheadline, primary CTA
   - Background image with overlay
   - Trust badges below CTA

2. **How It Works** (py-20)
   - 3-column grid on desktop
   - Step number → Icon → Title → Description
   - Connecting line between steps (desktop only)

3. **Features Grid** (py-20)
   - 3-column feature cards
   - Icon + headline + body text
   - Light background alternating sections

4. **Privacy Reassurance** (py-16)
   - Centered text block (max-w-3xl)
   - Icon badges for key privacy points
   - Subtle background treatment

5. **Footer** (py-12)
   - Centered logo and tagline
   - Links and copyright
   - Social proof mention if applicable

### Upload Page (/upload)
- Product type selection grid (prominent, centered)
- Heading above: "What are you scanning?"
- Upload interface appears after selection
- Back button to return to landing

### Results Page (/results)
- Product name header (if detected)
- Overall safety score summary card
- Tabbed or filtered ingredient list (All / Red / Yellow / Green)
- Sticky "Scan Another Product" button at bottom
- Share/save options (future feature placeholder)

---

## Quality Standards

- All interactive elements have minimum touch target of 44x44px
- Consistent 8px base spacing rhythm
- Smooth transitions (duration-200 to duration-300)
- Accessible contrast ratios (WCAG AA minimum)
- Loading states for all async operations
- Clear error messages with recovery actions
- Optimistic UI updates where possible