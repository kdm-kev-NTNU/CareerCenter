---
name: good-ci-cd
description: Designs and reviews CI/CD pipelines with fast PR gates, deeper main-branch checks, reusable job definitions, local parity scripts, and safe deploy conditions. Use when adding or changing GitHub Actions, Bitbucket Pipelines, GitLab CI, Azure DevOps, Jenkins, Docker build/push in CI, workflow_dispatch, branch protections, caching, test tiers, or when the user asks for CI/CD best practices.
---

# Good CI/CD (platform-agnostic)

## Principles (keep these stable across tools)

1. **Separate “validate” from “ship”**  
   Lint, format check, static analysis, and fast unit tests gate merges. Build/push/deploy is a distinct stage with its own prerequisites and secrets.

2. **Tier tests by trigger**  
   Default branches / PRs: smallest suite that catches real regressions (for example marker-based `critical` tests). Main or scheduled: broader unit coverage. Heavy integration/browser/eval: manual workflow or nightly, not every push.

3. **Parallelize independent work**  
   Run format/lint, typecheck, and SAST (for example Semgrep) in parallel after a single dependency-install step. Keep sequential gates only where order matters (migrations before DB tests, tests before image push).

4. **One install contract**  
   Prefer lockfiles (`uv.lock`, `package-lock.json`, Maven wrapper) and a single “sync/install” step reused by anchors, YAML `extends`, composite actions, or shared templates—avoid drifting commands between jobs.

5. **Reusable definitions**  
   Use YAML anchors (Bitbucket), `extends` / hidden jobs (GitLab), composite actions / reusable workflows (GitHub), shared libraries (Jenkins), or template stages (Azure) so steps are not copy-pasted.

6. **Caches and service health**  
   Cache tool-specific dirs (for example `~/.cache/uv`, npm cache). For databases or brokers, wait in a small loop or use native “service healthy” hooks before migrations/tests.

7. **Artifacts and observability**  
   Publish coverage XML/HTML, SARIF/JSON from SAST, and junit where supported. Print a short worst-covered summary in logs even when `fail_under` is relaxed in CI.

8. **Conditional deploy/push**  
   Skip registry push when secrets are missing or on fork/PR contexts unless explicitly intended. Tag `latest` only from protected default branch.

9. **Local parity**  
   Maintain one script or documented command sequence (for example `infrastructure/pipelines/prepush.py`) that mirrors the PR gate so developers reproduce CI before push. Optionally wire the same formatters into pre-commit.

10. **Document the pipeline in-file**  
    A short header comment at the top of the pipeline file listing triggers, tiers, and manual jobs saves onboarding time and keeps behavior intentional.

11. **Align CI images with production Dockerfile**  
    System packages needed at test time (for example `libgl1`, OCR tools) should match what the runtime image installs; cross-link in comments when they must stay in sync.

12. **Secrets and forks**  
    Never rely on repo secrets in untrusted PR jobs for deploy. Use OIDC or short-lived tokens where the platform supports it.

## Workflow shape (map to your vendor)

```text
install_deps
    → parallel: [lint/format, typecheck, SAST]
    → fast_tests (+ services: DB etc.)
    → optional: full_tests / integration (branch, schedule, or manual)
    → optional: build_image → (if creds + branch policy) push
```

## When implementing

- Name jobs/steps after outcomes (`Validate - Lint`, `Test - Critical`), not only tools.
- Set **timeouts** and **resource class** on slow jobs.
- Prefer **pinned** base images and dependency versions in CI where reproducibility matters.
- Add **manual** (`workflow_dispatch`, `custom:` pipeline, `when: manual`) for expensive paths.

## Platform notes

For concrete syntax mapping (parallel steps, caches, services, OIDC), see [reference.md](reference.md).
