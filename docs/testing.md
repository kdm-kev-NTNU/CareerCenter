# Testing and coverage gates

CareerCenter enforces **75% line/statement/function/branch coverage** before merging to `main`.

## Gates

| Gate | Command | What it measures |
|------|---------|------------------|
| Unit | `npm run coverage:merge:unit` | Vitest coverage for `backend/src` and `frontend/src` TypeScript (Vue SFCs are covered in the full gate via Cypress) |
| Full | `npm run coverage:merge:full` | Unit output merged with Cypress Istanbul data from `frontend/.nyc_output`. Lines/statements/functions use the merged map; **branches** use the unit gate map (Cypress dilutes branch % on TypeScript). Function counters that stay at 0 after the function body executed are reconciled from statement hits before the threshold check. |

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

## Agent inventory E2E

The spec `frontend/cypress/e2e/agent-inventory-scan.cy.ts` scans the real repo root for skills under `.agent-inventory/skills/` (gitignored mirror). Run the sync script first, then the spec:

```bash
powershell -File ./scripts/sync-agent-inventory.ps1
# From repo root (starts API + web, then Cypress):
CYPRESS_SPEC=cypress/e2e/agent-inventory-scan.cy.ts npm run test:e2e
```

On Windows PowerShell:

```powershell
powershell -File ./scripts/sync-agent-inventory.ps1
$env:CYPRESS_SPEC = "cypress/e2e/agent-inventory-scan.cy.ts"
npm run test:e2e
```

On GitHub Actions the spec is skipped when `.agent-inventory` is missing (no local Cursor paths on the runner).

## Debugging low coverage

After a failed merge, the script prints the lowest-covered files. Coverage artifacts are uploaded from CI under `coverage-unit` and `coverage-full`.
