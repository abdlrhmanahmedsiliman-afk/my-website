# LICENSES.md — Vendored & Third-Party Assets

Kashf is designed to run fully offline with no runtime CDN dependencies. All vendored
libraries are stored locally under `/vendor` and are used under permissive licenses.

## Vendored libraries

### GSAP (GreenSock Animation Platform) — Core, ScrollTrigger, SplitText
- **Path:** `vendor/gsap/gsap.min.js`, `vendor/gsap/ScrollTrigger.min.js`, `vendor/gsap/SplitText.min.js`
- **Version:** 3.x (vendored locally)
- **License:** GreenSock Standard License (free for use in this project context; no runtime CDN)
- **Use:** Page transitions, staggered reveals, heading animations, scroll-triggered effects, counter animations.
- **Fallback:** CSS/Web Animations API and simple JS fallbacks when GSAP is unavailable or motion is disabled.

### Canvas Confetti (in-app implementation)
- **Path:** Implemented inline in `js/motion.js` (`Kashf.motion.celebrate`)
- **License:** Original implementation for this project (no external dependency)
- **Use:** Payment success and onboarding celebration micro-animations (<=80 particles, <=30 in lite mode).

### Barcode scanning fallback
- **Status:** Camera scanning uses the browser `BarcodeDetector` API when available. A vendored
  JS fallback library (e.g. html5-qrcode / @zxing/library) was not downloaded in this environment;
  the app falls back gracefully to manual barcode/name search and hardware keyboard-wedge input,
  which remain fully functional offline.
- **License note:** If a fallback library is added later, it must use a permissive license (MIT/Apache-2.0)
  and be listed here.

## Fonts & Icons
- **Icons:** Inline SVG icons defined in `js/icons.js` (original/project assets).
- **Fonts:** System font stack (no external font CDN).

## Project license
- **Kashf:** Project source as provided in this repository/workspace. All rights reserved by the project owner
  unless otherwise specified.

Total vendored size is kept under the 1.5 MB budget (GSAP minified files only).
