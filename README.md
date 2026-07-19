# BuildSense

<div align="center">
  <p><strong>PC hardware discovery and compatibility for the Egyptian market.</strong></p>
  <p>
    BuildSense is not a store or a generic hardware listing site. It turns fragmented retailer
    data into one catalog, links offers for the same product, and explains whether selected PC
    parts fit together.
  </p>
  <p>
    <img src="https://img.shields.io/badge/Node.js-24.18.0-339933?logo=nodedotjs&logoColor=white" alt="Node.js 24.18.0">
    <img src="https://img.shields.io/badge/Angular-19-DD0031?logo=angular&logoColor=white" alt="Angular 19">
    <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5.8">
    <img src="https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white" alt="MongoDB with Mongoose">
    <img src="https://img.shields.io/badge/Nx-23-143055?logo=nx&logoColor=white" alt="Nx 23">
  </p>
</div>

<p align="center">
  <img src="./docs/screenshots/desktop/home.webp" alt="BuildSense home page and component catalog" width="100%">
</p>

> BuildSense is a decision-support platform, not a retailer. Checkout happens on the source store.

## Contents

- [Feature Tour](#feature-tour)
  - [Home and Component Discovery](#home-and-component-discovery)
  - [Product Details and Store Offers](#product-details-and-store-offers)
  - [Persistent PC Builder](#persistent-pc-builder)
  - [Compatibility Engine](#compatibility-engine)
  - [Product Comparison](#product-comparison)
  - [Purchase Plan](#purchase-plan)
  - [Multi-Store Data Pipeline](#multi-store-data-pipeline)
  - [Admin Operations Console](#admin-operations-console)
- [Responsive UI](#responsive-ui)
- [Architecture](#architecture)
- [Repository Layout](#repository-layout)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Author](#author)

## Feature Tour

### Home and Component Discovery

The home page is the catalog:

- Search, category, brand, and price filters.
- Price and recency sorting with paginated results.
- Compact cards with current price, availability, and useful specifications when available.

<p align="center">
  <img src="./docs/screenshots/desktop/catalog.webp" alt="BuildSense component catalog with search, filters, sorting, and product cards" width="100%">
</p>

### Product Details and Store Offers

Product pages show images, specifications, current price and availability, all known store offers,
retailer links, and an Add to Build action for eligible components.

<p align="center">
  <img src="./docs/screenshots/desktop/product-details.webp" alt="Product detail page with gallery, current offer, raw specifications, and store link" width="100%">
</p>

### Persistent PC Builder

Builds are persisted by public ID and contain eight slots:

| CPU | Motherboard | RAM | GPU | Storage | PSU | Case | Cooling |
| --- | --- | --- | --- | --- | --- | --- | --- |

- Search and filter candidates for each slot.
- Compare store offers and current prices.
- Group candidates by compatibility status.
- Show rule reasons and missing facts instead of guessing.

| Build Workspace | Component Selector |
| --- | --- |
| <img src="./docs/screenshots/desktop/builder.webp" alt="PC builder workspace with component slots and build summary" width="520"> | <img src="./docs/screenshots/desktop/builder-selector.webp" alt="Builder component selector with search, availability filters, compatibility groups, and offers" width="520"> |

### Compatibility Engine

The engine checks sockets, RAM support, case clearances, PSU wattage, storage interfaces, and
graphics requirements. Results are `COMPATIBLE`, `WARNING`, `INCOMPATIBLE`, or `UNKNOWN`; unknown
means the required facts are missing, not that the parts are compatible.

<p align="center">
  <img src="./docs/screenshots/desktop/admin-compatibility-quality.webp" alt="Admin compatibility quality view with fact extraction coverage and rule readiness" width="100%">
</p>

### Product Comparison

Compare two products side by side by price, availability, source store, and specifications. Changed
and missing values are highlighted.

<p align="center">
  <img src="./docs/screenshots/desktop/compare.webp" alt="Two-product comparison matrix with prices, availability, and differing specifications" width="100%">
</p>

### Purchase Plan

A purchase plan turns a build into a store-by-store checklist with quantities, retailer links,
estimated total, JSON export, and print-to-PDF support.

<p align="center">
  <img src="./docs/screenshots/desktop/purchase-plan.webp" alt="Purchase plan with selected components, retailer links, estimated total, and export controls" width="100%">
</p>

### Multi-Store Data Pipeline

BuildSense currently recognizes four store codes and human-readable labels:

| Store | Integration |
| --- | --- |
| Sigma Computer | HTTP discovery, category/product parsing, bootstrap import, and live samples |
| El Badr Group | HTTP discovery, URL/category imports, snapshot publishing, and live samples |
| El Nour Tech | Store adapter plus browser-capture manifest import for protected pages |
| Alfrensia Computer | Store adapter plus URL, snapshot, and browser-capture imports |

The worker owns ingestion:

```text
Store page or approved capture
        |
        v
Discovery -> Fetch -> Immutable raw snapshot -> Parse -> Normalize
        -> Identity matching -> Catalog/offer publish -> Compatibility fact extraction
```

- Immutable raw snapshots and resumable store-scoped runs.
- Exact product identity evidence before cross-store matching.
- Idempotent offer publishing and separate compatibility-fact extraction.

### Admin Operations Console

The secured admin console covers dashboard metrics, scrape runs, match reviews, data-quality
issues, eligibility overrides, compatibility coverage, and asynchronous reprocessing jobs.

| Login | Operations Overview |
| --- | --- |
| <img src="./docs/screenshots/desktop/admin-login.webp" alt="BuildSense admin login" width="520"> | <img src="./docs/screenshots/desktop/admin-overview.webp" alt="Admin operations dashboard with catalog and pipeline metrics" width="520"> |

| Scrape Runs | Match Reviews |
| --- | --- |
| <img src="./docs/screenshots/desktop/admin-scrape-runs.webp" alt="Admin scrape-run history and status view" width="520"> | <img src="./docs/screenshots/desktop/admin-match-reviews.webp" alt="Admin product match review queue" width="520"> |

| Data Quality | Compatibility Quality |
| --- | --- |
| <img src="./docs/screenshots/desktop/admin-data-quality.webp" alt="Admin data-quality issue list" width="520"> | <img src="./docs/screenshots/desktop/admin-compatibility-quality.webp" alt="Admin compatibility quality metrics" width="520"> |

## Responsive UI

The public catalog, product details, builder, and candidate selector adapt to narrow screens. Touch
layouts preserve the same data and actions without requiring hover.

| Home | Catalog | Product Details |
| --- | --- | --- |
| <img src="./docs/screenshots/mobile/home-mobile.webp" alt="BuildSense mobile home page" width="280"> | <img src="./docs/screenshots/mobile/catalog-mobile.webp" alt="BuildSense mobile catalog" width="280"> | <img src="./docs/screenshots/mobile/product-details-mobile.webp" alt="BuildSense mobile product details" width="280"> |

| Builder | Component Selector |
| --- | --- |
| <img src="./docs/screenshots/mobile/builder-mobile.webp" alt="BuildSense mobile PC builder" width="280"> | <img src="./docs/screenshots/mobile/builder-selector-mobile.webp" alt="BuildSense mobile component selector" width="280"> |

## Architecture

BuildSense is an Nx monorepo with three runtime applications and shared packages. The API never
scrapes a store, and the web application never accesses MongoDB directly.

```mermaid
flowchart LR
    Stores["Store websites / approved captures"]
    Worker["Worker CLI<br/>discover, capture, parse, publish, extract facts"]
    DB[(MongoDB)]
    API["Express API<br/>catalog, builds, admin"]
    PublicWeb["Angular public UI<br/>catalog, details, compare, builder, plan"]
    AdminWeb["Angular admin UI"]

    Stores --> Worker
    Worker <--> DB
    API <--> DB
    PublicWeb --> API
    AdminWeb --> API
```

Admin job requests are written through the API to MongoDB. The worker claims and processes those
jobs separately; the API does not execute ingestion work inside an HTTP request.

### Dependency Direction

```text
web     -> contracts, domain, config
api     -> contracts, domain, database, compatibility-engine, observability, config
worker  -> domain, database, scraping-core, store adapters, compatibility facts,
           observability, config
```

No application imports another application. Raw store parsing remains inside store adapters, shared
crawling behavior remains in `scraping-core`, and compatibility rules remain in
`compatibility-engine`.

## Repository Layout

```mermaid
flowchart TB
    Root["BuildSense Nx Monorepo"]

    Root --> Apps
    Root --> Packages
    Root --> Support

    subgraph Apps["Applications"]
        Web["web<br/>Angular public + admin UI"]
        Api["api<br/>Express REST API"]
        WorkerApp["worker<br/>ingestion + background jobs"]
    end

    subgraph Packages["Shared Packages"]
        Core["contracts / domain / database"]
        Compatibility["compatibility-engine / compatibility-facts"]
        Scraping["scraping-core / store adapters"]
        Platform["config / observability / test-support"]
    end

    subgraph Support["Project Support"]
        Docs["docs"]
        Fixtures["fixtures"]
        Scripts["scripts"]
    end
```

## Tech Stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js 24.18.0, TypeScript 5.8, ES modules |
| Monorepo | npm workspaces, Nx 23 |
| Web | Angular 19, RxJS |
| API | Express, OpenAPI/Swagger UI |
| Database | MongoDB, Mongoose |
| Worker | Commander CLI, Cheerio-based store adapters |
| Security | Helmet, CORS, scrypt, opaque sessions, CSRF and origin validation |
| Observability | Pino structured logging, request IDs, readiness/liveness endpoints |
| Testing | Vitest, MongoDB Memory Server, Playwright, axe-core |
| Quality | ESLint 9, Prettier 3, strict TypeScript |

## Getting Started

Requires Node.js `24.18.0` and MongoDB. Copy `.env.example` to `.env`, then set `MONGO_URI`.

```bash
git clone https://github.com/NourEldeenMahmoud/BuildSense.git
cd BuildSense
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:4200`. The API runs on `http://localhost:3000`.

## Author

**Nour Eldeen Mahmoud**

- GitHub: [NourEldeenMahmoud](https://github.com/NourEldeenMahmoud)
- LinkedIn: [nour-eldeen-eg](https://linkedin.com/in/nour-eldeen-eg)
