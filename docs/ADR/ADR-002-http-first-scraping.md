# ADR-002: Sigma HTTP-First Extraction

**Project:** BuildSense  
**Status:** Accepted  
**Decision Date:** 13 July 2026  
**Scope:** M1 - Sigma Data Discovery  
**Owner:** Nour Eldeen Mahmoud

## Context

Sigma serves Next.js HTML responses containing React Server Component (RSC) flight data in `self.__next_f.push()` script calls. The captured category and product responses contain the data required by the M1 parsers without executing JavaScript.

Large serialized objects can span multiple RSC string chunks. The Sigma adapter therefore joins the captured chunks before locating complete JSON objects.

## Decision

Use HTTP responses as the primary Sigma extraction source.

- Category pages: read structured products and pagination from RSC data, with an HTML product-card fallback.
- Product pages: read the complete product from RSC data. The M1 product parser returns `null` when no valid RSC product is present; it does not yet implement an HTML fallback.
- Breadcrumbs: read category breadcrumbs from HTML.
- Browser execution: none of the captured M1 routes currently requires Playwright.

Playwright may be added for a route only when a live M2 check demonstrates that the required data is absent from the HTTP response and JavaScript execution is necessary. A visual loading skeleton alone is not sufficient evidence because the response may still contain RSC data.

ADR-000.10 remains in force: M2 may use Crawlee CheerioCrawler or direct HTTP fetch with Cheerio. The specific HTTP orchestration choice belongs to M2; it does not change this HTTP-first decision.

## Consequences

### Benefits

- Fixture-based parser tests use the same response form as production HTTP fetching.
- HTTP extraction avoids browser startup and rendering costs for the observed routes.
- Store-specific RSC and HTML parsing remains inside `packages/sigma-adapter`.

### Risks

- A Sigma or Next.js response-format change can break RSC extraction.
- HTML fallback selectors can drift independently from RSC data.
- A future route may require browser execution and must be proven separately.

## Validation

M1 validates this decision with saved category and product HTML fixtures and parser tests. M2 must add live sample checks, request policy, retries, rate/concurrency configuration, and failure classification before full crawling.

## Related Decisions

- ADR-000.10 - Scraping Strategy
- ADR-000.11 - Raw-First Data Ingestion
- TDD section 33 - Phase M1 and Phase M2
