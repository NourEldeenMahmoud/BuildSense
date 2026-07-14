# ADR 004: Custom M4 Frontend Implementation Override

## Status
Accepted

## Context
The user requested implementing the BuildSense frontend (Angular web app) matching a provided Stitch design system, bypassing the original M4 increment scope that primarily focused on API integration scaffolding. This is a custom accelerated frontend implementation plan.

## Decision
We will implement the M4 custom frontend phases to build the Catalog UI and foundations.

## Constraints & Requirements
1. This frontend sequence is user-approved but **does not supersede M8/M9 capability prerequisites**.
2. This plan formally acknowledges the official TDD phases (M4, M6, M8, M9).
3. **No fake Builder or compatibility behavior is allowed**. The Builder UI and compatibility rules cannot be mocked in the frontend; they must be implemented in their respective architectural phases (M8/M9).
