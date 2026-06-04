---
name: readme-updater
description: Analyze the current codebase and generate or update the project README.md to reflect actual tech stack, structure, setup instructions, API surface, and features. Use when the user asks to update the README, sync documentation with code, generate a README from scratch, or mentions that the README is outdated.
---

# README Updater

Update or generate a project README based on the actual codebase — not assumptions.

## Workflow

Copy this checklist and track progress:

```
README Update Progress:
- [ ] Step 1: Discover project shape
- [ ] Step 2: Check existing README
- [ ] Step 3: Collect facts from code
- [ ] Step 4: Draft / update README
- [ ] Step 5: Review and finalize
```

### Step 1 — Discover project shape

Identify the project type and structure:

1. List the repo root (`ls` / `Get-ChildItem`) and note top-level directories.
2. Look for key markers:
   - **Package managers**: `package.json`, `pom.xml`, `build.gradle`, `requirements.txt`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `*.csproj`
   - **Containerization**: `Dockerfile`, `docker-compose.yml`
   - **CI/CD**: `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`
   - **Config**: `.env.example`, `application.yaml`, `tsconfig.json`, `vite.config.*`
3. Determine if the repo is a monorepo (multiple apps/services) or a single project.

### Step 2 — Check existing README

- If a README exists, read it fully. Note which sections are present and which are stale.
- If no README exists, proceed to Step 3 and generate from scratch.

### Step 3 — Collect facts from code

Gather concrete data for each section. **Only state what the code proves** — never guess versions or features.

| Section | Where to look |
|---------|---------------|
| **Project name & description** | README header, `package.json#description`, `pom.xml#description`, repo name |
| **Tech stack** | Dependency files — extract framework names and major versions |
| **Repo structure** | Top-level `ls`; use a brief directory tree |
| **Prerequisites** | Runtime versions (`engines` in `package.json`, `java.version` in `pom.xml`, `python_requires`), required CLI tools, Docker |
| **Environment variables** | `.env.example`, config files (`application.yaml`, settings), code that reads `process.env` / `System.getenv` |
| **Setup / getting started** | Scripts in `package.json`, Maven wrapper, `Makefile`, `docker-compose.yml`, helper scripts |
| **API surface** | Controllers/routes, OpenAPI config, endpoint annotations |
| **Testing** | Test runner config, test scripts, coverage tooling |
| **CI/CD** | Workflow files, pipeline configs |
| **Security** | Auth config, CORS, rate limiting, input validation |
| **Deployment** | Dockerfiles, cloud config (Railway, Vercel, etc.) |

For each fact, note the **source file** so the README can link to it where useful.

### Step 4 — Draft / update README

Use the section order below. Skip sections that don't apply. Keep language concise and scannable.

```markdown
# Project Name

## About
One paragraph: what the project does, who it's for, key value proposition.

## Repository structure
Brief directory tree or bullet list with one-line descriptions.

## Tech Stack
### Frontend
### Backend
### Infrastructure
(Group by layer; include versions from dependency files.)

## Features
Bullet list of user-facing and notable technical features.

## Prerequisites
- Runtime versions, CLI tools, Docker, API keys

## Getting Started
### 1) Clone
### 2) Environment variables
### 3) Start services (Docker / local)
### 4) Run the app
### 5) Open in browser

## API
Key endpoints with method, path, body, response, and status codes.
Link to Swagger/OpenAPI if available.

## Testing
How to run tests and view coverage.

## Security
Auth, rate limiting, CORS, input validation — summarize mechanisms.

## CI/CD
What runs on push/PR, scheduled jobs, required secrets.

## Deployment
Docker, cloud platform, build commands.

## Credits
Author, contributors, data sources.
```

**Rules when writing:**
- Use **relative links** to files in the repo (e.g., `[frontend README](frontend/homepage/README.md)`).
- Show concrete commands — don't say "run the start script", say `npm run dev`.
- For env vars, show a table or list with name, required/optional, and purpose.
- Use fenced code blocks with the correct language tag for all commands.
- Prefer `bash` blocks; add a separate `powershell` block only when the command differs meaningfully on Windows.
- When the project has existing README sections that are still accurate, **preserve them** instead of rewriting.
- When updating, show the user what changed (list added/removed/modified sections).

### Step 5 — Review and finalize

Before finishing:
1. Verify every version number against the actual dependency file.
2. Verify every command is runnable (correct paths, correct flags).
3. Verify relative links point to files that exist.
4. Check that no secrets or credentials are included.
5. Ensure the README reads well top-to-bottom for a newcomer.
