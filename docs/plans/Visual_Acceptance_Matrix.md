# Visual Acceptance Matrix

This matrix establishes the Pass/Fail criteria for frontend components and styling based on the Stitch design system.

## Typography
- **Pass**: Hanken Grotesk is used for normal text. Space Mono is used for technical labels and specifications. Fonts load correctly without FOIT/FOUT.
- **Fail**: Fallback fonts (sans-serif, monospace) are visible after loading, or wrong font weights are applied.

## Color Tokens
- **Pass**: Uses only the defined CSS custom variables (e.g., `--color-surface-graphite`, `--color-accent-acid`). Text contrasts meet accessibility standards.
- **Fail**: Hardcoded hex values in component CSS, generic colors (red, blue), or insufficient contrast.

## Layout Shift (CLS)
- **Pass**: Pages reserve space for images and dynamic content. Zero cumulative layout shift during initial load.
- **Fail**: Content jumps when images or async data finish loading.

## Interactive States (Hover/Focus)
- **Pass**: Buttons, links, and cards have distinct, accessible hover and focus states (e.g., accent color borders, slight background lightening). Transitions are smooth (e.g., `transition: all 0.2s ease`).
- **Fail**: No visual feedback on hover/focus, or jarring instantaneous changes.

## Disabled States
- **Pass**: Disabled elements have reduced opacity (e.g., 50%) and `cursor: not-allowed`.
- **Fail**: Disabled elements look identical to active elements, or are clickable.

## Skeleton Loaders
- **Pass**: Data-fetching components display a pulsing skeleton placeholder matching the final content's approximate dimensions.
- **Fail**: Blank screens, generic spinners replacing entire layouts, or shifting content post-load.
