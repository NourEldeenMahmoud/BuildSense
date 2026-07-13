# ADR-001: MongoDB Atlas as Default Development Database

## Status

Accepted

## Date

2026-07-13

## Context

ADR-000.15 originally specified Docker Compose for running MongoDB locally during M0. The project has since adopted MongoDB Atlas as its primary development database, eliminating the need for Docker in the development workflow.

## Decision

MongoDB Atlas is the default development database for BuildSense. Docker is not required for local development or testing.

This supersedes ADR-000.15's requirement for Docker Compose.

## Consequences

### Positive

- No Docker Desktop installation required for developers
- Consistent database environment across all developers
- Easier onboarding (just configure `MONGO_URI`)
- Free tier Atlas provides sufficient capacity for M0
- Eliminates Docker-related platform issues (e.g., WSL2, Hyper-V)

### Negative

- Requires internet connection for development
- Atlas free tier has connection limits
- Slightly higher latency than local MongoDB

## Configuration

Required environment variables in `.env`:

```
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
MONGO_DB_NAME=buildsense
```

Optional DNS configuration for network restrictions:

```
DNS_SERVERS=8.8.8.8,1.1.1.1
```

## References

- ADR-000.15 (superseded)
- MongoDB Atlas free tier documentation
