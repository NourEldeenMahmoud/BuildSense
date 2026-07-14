# SVG Icons

This directory contains inline SVG icon assets used throughout the BuildSense frontend.

## Strategy
- Use raw `.svg` files.
- Prefer inline SVGs or Angular components wrapping SVGs to allow CSS styling of `fill` and `stroke` via CSS variables.
- Avoid icon font libraries to reduce bundle size and external dependencies.
