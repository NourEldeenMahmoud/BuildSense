# Fonts

This directory contains locally hosted font files to ensure zero layout shift and offline availability.

## Strategy
- Download `Hanken Grotesk` (woff2) for normal text.
- Download `Space Mono` (woff2) for technical labels.
- Preload these fonts in `index.html`.
- Define `@font-face` rules in `styles.css`.
