---
name: Editorial Warmth
colors:
  surface: '#fff8f3'
  surface-dim: '#dfd9d4'
  surface-bright: '#fff8f3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f9f2ed'
  surface-container: '#f3ede8'
  surface-container-high: '#eee7e2'
  surface-container-highest: '#e8e1dc'
  on-surface: '#1d1b18'
  on-surface-variant: '#5a413c'
  inverse-surface: '#33302d'
  inverse-on-surface: '#f6efeb'
  outline: '#8e706a'
  outline-variant: '#e2bfb8'
  surface-tint: '#b22b15'
  primary: '#a5220c'
  on-primary: '#ffffff'
  primary-container: '#c83b23'
  on-primary-container: '#ffeeeb'
  inverse-primary: '#ffb4a5'
  secondary: '#b5250e'
  on-secondary: '#ffffff'
  secondary-container: '#fc583b'
  on-secondary-container: '#590700'
  tertiary: '#005a8e'
  on-tertiary: '#ffffff'
  tertiary-container: '#0073b4'
  on-tertiary-container: '#eaf2ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad3'
  primary-fixed-dim: '#ffb4a5'
  on-primary-fixed: '#3f0400'
  on-primary-fixed-variant: '#8f1200'
  secondary-fixed: '#ffdad3'
  secondary-fixed-dim: '#ffb4a5'
  on-secondary-fixed: '#3f0400'
  on-secondary-fixed-variant: '#8f1200'
  tertiary-fixed: '#cee5ff'
  tertiary-fixed-dim: '#97cbff'
  on-tertiary-fixed: '#001d33'
  on-tertiary-fixed-variant: '#004a76'
  background: '#fff8f3'
  on-background: '#1d1b18'
  surface-variant: '#e8e1dc'
  tinta: '#18212F'
  texto: '#4B5563'
  borde-suave: '#E6DCD5'
  fondo-alterno: '#F3EBE4'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 64px
    fontWeight: '700'
    lineHeight: 68px
    letterSpacing: -0.03em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.03em
  section-title:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
  section-title-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '650'
    lineHeight: 34px
  app-name:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
  app-name-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '650'
    lineHeight: 28px
  intro:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  intro-mobile:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 25px
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  cta:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  helper:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 21px
  antetitle:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 21px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 24px
  margin: 120px
  space-xs: 4px
  space-sm: 8px
  space-md: 16px
  space-lg: 24px
  space-xl: 48px
---

## Brand & Style

This design system embodies an **editorial warmth** personality—approachable, solid, and contemporary. It deliberately moves away from cold, hyper-corporate fintech aesthetics by pairing a warm ivory canvas with deep ink typography and grounded terracotta accents. The emotional response is one of trust, clarity, and unhurried confidence.

We embrace a refined **Minimalism** style built around generous whitespace, large-scale typography, and uncompromising content hierarchy. The interface relies on structural honesty, crisp grid alignment, and deliberate restraint rather than superficial UI decoration.

## Colors

The palette anchors the experience in organic warmth and high-contrast readability. The primary canvas utilizes a warm ivory (`#FFF8F3`), creating a welcoming foundation that contrasts softly with pristine white (`#FFFFFF`) card surfaces. 

Typography and primary interface anchors are rendered in deep ink (`#18212F`), while secondary metadata uses a balanced slate (`#4B5563`). Terracotta (`#C83B23`) drives primary interactive states, supported by vibrant coral (`#FF5A3D`) for decorative accents and geometric highlights. Structural borders and secondary groupings employ warm, low-contrast tones (`#E6DCD5` and `#F3EBE4`) to segment information without visual noise.

## Typography

Typography establishes an editorial hierarchy with a high-impact scale. Geometric sans-serif letterforms deliver exceptional legibility and modern authority. 

Large display titles scale gracefully down to mobile viewports while retaining their tight tracking. Body copy and descriptions favor neutral, highly readable sans-serif metrics with generous line heights to ensure long-form scanning remains effortless. Always preserve the precise tracking on hero titles to maintain the signature editorial feel.

## Layout & Spacing

The layout philosophy centers on a **fixed grid** container with generous exterior whitespace. The desktop experience anchors content within a centered 1200px max-width container inside a 1440px reference viewport, producing signature 120px side margins. On mobile devices, the canvas adapts to fluid margins (20px down to 16px).

The spacing rhythm is anchored to a predictable 4px/8px scale, organizing content into clean vertical sequences. Maintain a 64px separation between major structural zones (such as hero headers and application directories) on desktop, scaling to 40px on mobile.

## Elevation & Depth

Depth is treated with utmost restraint. The system rejects heavy drop shadows, continuous animations, and glassmorphic blurs in favor of flat structural surfaces separated by whitespace and subtle borders. 

Cards utilize a single, carefully calibrated elevation token: a vertical offset of 8px, a 24px blur radius, and ink at 6% opacity (`tinta al 6%`). This gentle diffusion lifts interactive cards just enough off the warm ivory canvas to establish affordance without introducing visual clutter.

## Shapes

The shape language balances structural stability with approachable geometry:
- **Cards:** Defined by a generous 24px border radius, softening the container boundaries.
- **CTA Buttons:** Constructed with a 12px radius for a balanced, contemporary pill-adjacent feel.
- **Badges & Tags:** Fully rounded capsule shapes to denote metadata and status.
- **Borders:** Crisp, low-contrast structural dividers (`#E6DCD5`) segment layout regions. Interactive elements feature solid 3px focus rings offset by 3px.

## Components

### Buttons
Primary CTAs feature a solid terracotta background (`#C83B23`) with white text, a 12px border radius, and a minimum height of 48px. Hover states transition smoothly to `#A92E1B` within 120–180ms. Focus rings must be clearly visible using the standard 3px offset ring.

### Cards
Cards act as the primary container for application directories and metadata. They utilize pure white surfaces (`#FFFFFF`), a 24px border radius, internal padding of 28px (24px on mobile), and the signature 6% ink elevation shadow. On hover, cards may elevate a maximum of 2px.

### Input Fields & Controls
Form elements and search inputs maintain generous hit targets (minimum 48px height) with soft borders (`#E6DCD5`) and deep ink text. Checkboxes and radio buttons adhere strictly to the system's warm neutral tones without ornamental gradients.

### Chips & Badges
Badges are rendered as compact capsules using the alternate background tone (`#F3EBE4`) and deep ink or slate text, ideal for version numbers, tags, or unverified state indicators.

### Lists & Directories
Directory lists utilize clean vertical pacing with 12–16px internal separation between elements, pairing 48x48px app icon containers with distinct typographic hierarchy for titles and helper metadata.