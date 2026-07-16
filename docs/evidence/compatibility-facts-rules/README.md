# Compatibility Facts and Rules Rollout Evidence

Status: implementation validated; production activation blocked by evidence gates.

## Implemented

- Seven-category extraction from `CatalogProduct.rawSpecifications` with versioned per-fact evidence.
- Idempotent worker backfill with stable resume checkpoints, dry-run mode, and separate quality reports.
- Fourteen seven-slot rules registered in the pure engine; rules activate only when every required fact passes its quality gate.
- Build mutation, validation, candidate grouping, and Builder evidence display use persisted facts and rule results.
- `CMP-CPU-MB-002` remains inactive without authoritative versioned chipset/family reference data.
- `CMP-PSU-GPU-001` remains inactive because PSU connector inventory is not yet an extracted fact.

## Activation Gates

Each required category/fact must have at least 80% coverage, at least 95% precision, and a verified sample of at least 50 products or every product when the category has fewer than 50. Missing verified precision or sample data fails the gate. Extractor confidence is never treated as verified precision.

## Current Limitation

No authoritative verified sample is stored in the repository, and M2 pagination is not production-complete. Therefore production representativeness is not established and no rule should be declared production-active from current data alone.

Before rollout, run the worker dry-run and backfill against a representative catalog, attach reviewed verification samples to the quality reports, and confirm every activated rule's required facts pass independently. Do not override failed gates.
