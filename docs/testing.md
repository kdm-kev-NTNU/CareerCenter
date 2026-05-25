# Testing and coverage gates

CareerCenter enforces **80% line/statement/function coverage** (78% branches) before merging to `main`.

## Gates

| Gate | Command | What it measures |
|------|---------|------------------|
| Unit | `npm run coverage:merge:unit` | Vitest coverage for `backend/src` and `frontend/src` TypeScript (Vue SFCs are covered in the full gate via Cypress) |
| Full | `npm run coverage:merge:full` | Unit output merged with Cypress Istanbul data from `frontend/.nyc_output` |

Run unit tests with coverage first:

```bash
npm run test:coverage
npm run coverage:merge:unit
```

Run the full CI test suite locally (same order as GitHub Actions `e2e` job):

```bash
npm run test:ci
```

## CI jobs

- `quality` — typecheck and lint
- `unit` — `test:coverage` + unit coverage gate
- `e2e` — Cypress E2E + full coverage gate (depends on `unit`)
- `docker` — production image builds (depends on `quality` and `e2e`)

## Branch protection

In GitHub **Settings → Branches → main**, require these status checks before merge:

- `quality`
- `unit`
- `e2e`

Optionally require `docker` if image builds must block merges.

## Debugging low coverage

After a failed merge, the script prints the lowest-covered files. Coverage artifacts are uploaded from CI under `coverage-unit` and `coverage-full`.
