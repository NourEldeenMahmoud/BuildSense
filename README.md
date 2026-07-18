# BuildSense

BuildSense is an Egyptian PC hardware catalog, compatibility, and purchasing-assistance platform. Current phase: **M0 - Repository Foundation**.

## Prerequisites

- Node.js `24.18.0` (see `.nvmrc`)
- npm
- MongoDB Atlas account (free tier) or local MongoDB instance

## Setup

```bash
git clone <repository-url>
cd buildsense
npm ci
cp .env.example .env
```

On PowerShell, use `Copy-Item .env.example .env`.

Configure `MONGO_URI` in `.env` with your MongoDB Atlas connection string.

## Development

Start each runtime in a separate terminal after MongoDB is healthy:

```bash
# API
npx nx dev api

# Web
npx nx serve web

# Worker database check
npm run worker -- health
```

## Commands

| Command | Description |
| --- | --- |
| `npm run lint` | Lint all projects |
| `npm run test` | Run all tests |
| `npm run typecheck` | Type-check all projects |
| `npm run build` | Build all projects |
| `npm run format` | Apply Prettier |
| `npm run format:check` | Verify formatting |
| `npx nx serve web` | Start Angular development server |
| `npx nx dev api` | Start Express development server |
| `npm run worker -- health` | Connect, verify, and disconnect MongoDB |

## Health Endpoints

With API and MongoDB running on the configured port (`3000` by default):

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | API and database connection status |
| `GET /health/live` | HTTP process liveness |
| `GET /health/ready` | Readiness including MongoDB availability |

## Project Structure

```text
apps/
  web/                 Angular placeholder shell
  api/                 Express runtime and health endpoints
  worker/              CLI health command
packages/
  config/              Zod environment validation
  contracts/           Transport DTOs
  database/            Mongoose connection lifecycle
  domain/              Shared domain primitives
  observability/       Pino logger factory
  test-support/        Test-only helpers
docs/
fixtures/
```

## Documentation

- [ADR](docs/ADR/ADR-000-project-foundation-decisions.md)
- [TDD](docs/TDD/PC_Hardware_Aggregator_TDD_v1.0_AR.md)
- [PRD](docs/PRD/PC_Hardware_Aggregator_PRD_v1.0_AR.md)

## M0 Limitations

M0 provides repository and runtime foundations only. It does not include scraping, product ingestion, catalog data, search, compatibility rules, authentication, payments, or production deployment.
