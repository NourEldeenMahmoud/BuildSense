# Local Development and Operations Runbook

This runbook explains how to configure, populate, start, inspect, test, and stop BuildSense on a development machine.

## Runtime Overview

BuildSense has three runtime applications backed by MongoDB:

- `apps/web`: Angular frontend
- `apps/api`: Express API
- `apps/worker`: one-shot ingestion and compatibility CLI

MongoDB stores catalog products, offers, persistent builds, compatibility facts and quality reports, and scraper records. MongoDB Atlas is the default development database; Docker is not required.

## Prerequisites

- Node.js `24.18.0`, as pinned in `.nvmrc`
- npm
- MongoDB Atlas or a local MongoDB instance

From the repository root, confirm the installed tools:

```powershell
node --version
npm --version
```

With NVM for Windows:

```powershell
nvm install 24.18.0
nvm use 24.18.0
```

Install the locked dependencies:

```powershell
npm ci
```

## Environment Configuration

Create `.env` from the example if it does not already exist:

```powershell
Copy-Item .env.example .env
```

For MongoDB Atlas, configure:

```dotenv
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/buildsense?retryWrites=true&w=majority
MONGO_DB_NAME=buildsense
API_PORT=3000
LOG_LEVEL=info
DNS_SERVERS=
```

For a local MongoDB instance, configure:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB_NAME=buildsense
API_PORT=3000
LOG_LEVEL=info
DNS_SERVERS=
```

For Atlas, create a database user, allow the current IP address under Network Access, and URL-encode special characters in the password. Do not commit `.env`.

Verify the database connection:

```powershell
npm run worker -- health
```

The command connects to MongoDB, verifies the connection, and disconnects.

## Populate the Catalog

The local `data/bootstrap/` directory may contain a previously captured Sigma dataset. When present, publish its normalized products without scraping Sigma again:

```powershell
npm run bootstrap:publish
```

The publisher reads `data/bootstrap/normalized-products.json` and upserts catalog products and offers into the database configured in `.env`.

Verify the imported and published data:

```powershell
npm run bootstrap:verify
```

Review `data/bootstrap/sigma-import-manifest.json`, `normalization-manifest.json`, and `publish-manifest.json` for the counts and status produced by the local capture. These files are ignored local artifacts and may be absent on a clean checkout. A non-passing verification result can represent incomplete ingestion rather than a database connection failure.

### Capture a New Dataset

Run a CPU-only proof import:

```powershell
npm run bootstrap:sigma:proof
```

Run the full one-time import:

```powershell
npm run bootstrap:sigma
```

Normalize, publish, and verify the captured data:

```powershell
npm run bootstrap:process
```

The pipeline is:

```text
Sigma website
-> raw capture
-> normalization
-> MongoDB publication
-> verification
-> compatibility extraction
-> API
-> web application
```

The production scraper is not complete. Do not treat a live run or the current bootstrap capture as production-representative evidence.

## Extract Compatibility Facts

Preview the extraction scope without writing changes:

```powershell
npm run worker -- compatibility extract --all --dry-run
```

Extract and persist facts for every supported category:

```powershell
npm run worker -- compatibility extract --all
```

Show coverage and precision reports without extracting again:

```powershell
npm run worker -- compatibility extract --all --report-only
```

Process one category:

```powershell
npm run worker -- compatibility extract --category CPU
npm run worker -- compatibility extract --category Motherboard
npm run worker -- compatibility extract --category GPU
```

Force products to be reprocessed even when their extractor version matches:

```powershell
npm run worker -- compatibility extract --all --force-reprocess
```

Compatibility results can remain `UNKNOWN` after extraction. Rules activate only when every required fact passes the coverage, verified-precision, and verified-sample gates. The repository does not currently contain an authoritative reviewed verification sample.

## Start the Applications

Running the API and web application in separate terminals keeps their logs readable.

### Terminal 1: API

```powershell
npx nx dev api
```

The API runs at `http://localhost:3000` by default.

### Terminal 2: Web

```powershell
npx nx serve web
```

The frontend runs at `http://localhost:4200` and currently calls the API at `http://localhost:3000`.

Alternatively, start every project that has an Nx `dev` target:

```powershell
npm run dev
```

The worker is not a long-running service. Each worker command exits after its operation completes.

## Inspect API Health and Documentation

Open these endpoints while the API is running:

| URL | Purpose |
| --- | --- |
| `http://localhost:3000/` | API identity |
| `http://localhost:3000/api/health` | API and database status |
| `http://localhost:3000/health/live` | HTTP process liveness |
| `http://localhost:3000/health/ready` | Readiness including MongoDB |
| `http://localhost:3000/api/docs` | Swagger UI |

Check readiness from PowerShell:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

A healthy response is:

```json
{
  "status": "ok",
  "database": "connected"
}
```

Inspect categories and products:

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/categories
Invoke-RestMethod "http://localhost:3000/api/v1/products?page=1&pageSize=5"
Invoke-RestMethod "http://localhost:3000/api/v1/products?category=CPU&brand=AMD&pageSize=10"
Invoke-RestMethod "http://localhost:3000/api/v1/products?search=ryzen&sort=price_asc"
```

### Catalog Endpoints

```text
GET /api/v1/categories
GET /api/v1/products
GET /api/v1/products/:id
GET /api/v1/products/:id/offers
```

### Persistent Build Endpoints

```text
POST   /api/v1/builds
GET    /api/v1/builds/:publicId
PATCH  /api/v1/builds/:publicId
PUT    /api/v1/builds/:publicId/items/:slot
DELETE /api/v1/builds/:publicId/items/:slot
POST   /api/v1/builds/:publicId/validate
GET    /api/v1/builds/:publicId/candidates/:slot
GET    /api/v1/builds/:publicId/purchase-plan
```

Create and retrieve a build from PowerShell:

```powershell
$body = @{ name = "My Test Build" } | ConvertTo-Json
$build = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/v1/builds" `
  -ContentType "application/json" `
  -Body $body

$build
Invoke-RestMethod "http://localhost:3000/api/v1/builds/$($build.publicId)"
Invoke-RestMethod "http://localhost:3000/api/v1/builds/$($build.publicId)/candidates/cpu"
```

Swagger currently describes the catalog endpoints more completely than the build endpoints.

## Inspect the Frontend

### Catalog

Open `http://localhost:4200/`.

Use the search, category, brand, price, sort, and pagination controls. Open a product card to inspect its details and Sigma source link. `/catalog` redirects to `/` while preserving query parameters.

### Product Details

Open a product through the catalog or navigate to:

```text
http://localhost:4200/products/PRODUCT_ID
```

The page can display the product gallery, price and availability, brand, model, MPN, raw specifications, offers, and original Sigma source link.

### Comparison

Open a product, select Compare, search for another product in the same category, and select it. A valid shared comparison URL has this form:

```text
http://localhost:4200/compare?left=PRODUCT_ID&right=PRODUCT_ID
```

Cross-category comparisons are rejected.

### PC Builder

Open:

```text
http://localhost:4200/builder
```

The frontend creates a persistent build and redirects to its canonical URL:

```text
http://localhost:4200/builder/PUBLIC_BUILD_ID
```

To inspect the complete journey:

1. Add a CPU and motherboard.
2. Inspect the candidate groups and compatibility evidence.
3. Add RAM, GPU, storage, PSU, and case components.
4. Replace and remove components.
5. Reload the browser and confirm that the build persists.
6. Copy the canonical build URL and open it again.
7. Follow the purchase-plan link.

Candidates can appear in four groups:

- `COMPATIBLE`
- `COMPATIBLE_WITH_WARNINGS`
- `UNKNOWN`
- `INCOMPATIBLE`

`UNKNOWN` is expected when the evidence gates do not permit a definitive compatibility result.

### Purchase Plan

Navigate from the Builder or open:

```text
http://localhost:4200/purchase-plan?buildId=PUBLIC_BUILD_ID
```

BuildSense presents the selected components, offers, totals, compatibility review, and store links. It redirects users to the store and does not process payments.

### Other Routes

- `http://localhost:4200/admin` loads the current admin presentation surface; a production administration backend is deferred.
- An unknown route loads the Not Found page.

## Inspect MongoDB Directly

Connect MongoDB Compass with the same `MONGO_URI`, then select the database named by `MONGO_DB_NAME`.

The database models include:

- `CatalogProduct`
- `Offer`
- `Build`
- `CategoryQualityReport`
- `ReferenceDataset`
- `ScrapeRun`
- `ScrapeRunItem`
- `RawProductSnapshot`
- `DiscoveredProduct`
- `WorkerLock`

Mongoose normally displays their collection names in pluralized form. Useful checks include:

1. Confirm products under the catalog-product collection.
2. Inspect Sigma prices and source URLs under offers.
3. Create a build in the browser, then refresh the build collection.
4. Inspect category quality reports after compatibility extraction.
5. Inspect persisted compatibility facts on catalog products.
6. Inspect scrape runs and snapshots after worker scraper commands.

Do not manually alter raw snapshots; captured raw data is immutable.

## Inspect Sigma Parsing

Fetch and parse the command's default live sample without persistence:

```powershell
npm run worker -- sigma live-sample
```

Provide another Sigma product URL:

```powershell
npm run worker -- sigma live-sample --url "https://www.sigma-computer.com/en/product/PRODUCT"
```

Run one URL through the scraper without persisting snapshots:

```powershell
npm run worker -- sigma url "https://www.sigma-computer.com/en/product/PRODUCT" --dry-run
```

The worker also exposes `sigma full` and `sigma category`, but production scraper closure and pagination hardening remain deferred.

## Validation and Tests

Run all repository checks:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run format:check
```

Run focused checks for one project:

```powershell
npx nx lint api
npx nx typecheck api
npx nx test api
npx nx build api

npx nx lint web
npx nx typecheck web
npx nx test web
npx nx build web
```

Install the Playwright Chromium browser once:

```powershell
npx playwright install chromium
```

Run functional browser tests:

```powershell
npx nx e2e web
```

Open Playwright's interactive UI:

```powershell
npx nx e2e web -- --ui
```

Run the Builder journey only:

```powershell
npx nx e2e web -- builder-journey.spec.ts
```

Functional frontend E2E tests mock API responses. They validate frontend behavior but do not replace manually running the web application, API, and MongoDB together.

Run the visual-test frontend on port `4201`:

```powershell
npx nx run web:serve-visual
```

Run visual E2E tests:

```powershell
npx nx run web:e2e-visual
```

## Explore the Monorepo

List Nx projects and inspect their targets:

```powershell
npx nx show projects
npx nx show project web
npx nx show project api
npx nx show project worker
npx nx show project compatibility-engine
```

Open the Nx dependency graph:

```powershell
npx nx graph
```

Relevant source locations:

| Path | Responsibility |
| --- | --- |
| `apps/web/src/app/features/` | Frontend pages and features |
| `apps/api/src/modules/catalog/` | Catalog API |
| `apps/api/src/modules/builds/` | Persistent build API |
| `apps/worker/src/commands/` | Worker commands |
| `packages/compatibility-engine/src/` | Compatibility rules and gates |
| `packages/compatibility-facts/src/` | Compatibility fact extraction |
| `packages/database/src/models/` | MongoDB models |
| `packages/sigma-adapter/src/` | Sigma-specific parsing |
| `packages/scraping-core/src/` | Shared crawler behavior |
| `data/bootstrap/` | Local bootstrap dataset and manifests |
| `docs/evidence/` | Validation and rollout evidence |

## Stop the Applications

Press `Ctrl+C` in the API and web terminals. Worker commands are one-shot processes and do not need to be stopped after they complete.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| API exits during startup | Verify `MONGO_URI` and `MONGO_DB_NAME`. |
| `/health/ready` returns `503` | MongoDB is disconnected. |
| Atlas connection times out | Allow the current IP in Atlas Network Access and verify the credentials. |
| Catalog is empty | Run `npm run bootstrap:publish` against the intended database. |
| Builder candidates are empty | Confirm products exist for the requested category. |
| Compatibility is `UNKNOWN` | This is expected until the required evidence gates pass. |
| Frontend cannot reach the API | Run the API on port `3000`; the frontend currently uses that URL directly. |
| Playwright cannot find Chromium | Run `npx playwright install chromium`. |
| Bootstrap verification reports incomplete ingestion | Review `data/bootstrap/sigma-import-manifest.json` and its recorded failures. |

## Related Documentation

- [`README.md`](../../README.md)
- [ADR-001: MongoDB Atlas as Default Development Database](../ADR/ADR-001-mongodb-atlas-default.md)
- [Compatibility Facts and Rules Rollout Evidence](../evidence/compatibility-facts-rules/README.md)
