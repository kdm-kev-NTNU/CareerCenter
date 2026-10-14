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

The pull-request gate matches GitHub Actions `quality` and `unit`:

```bash
npm run test:ci
```

The main-branch gate adds Cypress and the merged coverage check:

```bash
npm run test:ci:full
```

## CI jobs

- `quality` — typecheck and lint, in parallel with `unit`, on every push and pull request
- `unit` — `test:coverage` + unit coverage gate, in parallel with `quality`
- `e2e` — Cypress and the full coverage gate, on pushes to `main` and `workflow_dispatch`
- `docker` — production image builds on pushes to `main`, after `quality` and `unit`

A newer push to the same ref cancels the run that is still going.

## Branch protection

In GitHub **Settings → Branches → main**, require these status checks before merge:

- `quality`
- `unit`

`e2e` and `docker` run after the merge to `main`. Do not require `e2e` on pull requests: that job is skipped there, and a required skipped check blocks the merge.

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
