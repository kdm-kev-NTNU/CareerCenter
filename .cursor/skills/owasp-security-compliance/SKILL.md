---
name: owasp-security-compliance
description: Applies OWASP-aligned secure design and verification (Top 10 risks, ASVS-style checks, cheat sheets) during code review, API design, auth changes, cryptography, logging, and dependency updates. Use when the user mentions OWASP, ASVS, secure coding, security audit, threat modeling, penetration-test findings, CWE, XSS, CSRF, SSRF, injection, secrets, session management, or hardening.
---

# OWASP-aligned security

## How to use this skill

On any change that touches trust boundaries (HTTP APIs, HTML output, SQL, deserialization, files, subprocesses, redirects, webhooks, OAuth, admin tools), run through the **review checklist** below. For release gates or formal verification depth, use [reference.md](reference.md) (ASVS levels and external references).

## Review checklist (OWASP Top 10 risk areas)

Map findings to the nearest category so fixes stay traceable.

1. **Broken access control** — Every sensitive action checks authorization on the server (not only UI). IDs are scoped to tenant/user where applicable. No security by `POST` vs `GET` alone. Admin paths explicitly protected.

2. **Cryptographic failures** — Secrets not logged or returned in errors. TLS for data in transit where applicable. Strong algorithms and correct use (IVs/nonces, password hashing with slow KDF). No hardcoded keys; use vault/env with rotation story.

3. **Injection** — Parameterized queries or ORM bindings for SQL; bound parameters for `text()`. Neutralize or strictly validate input for OS commands, LDAP, XPath. Avoid string-built SQL/HTML where user input flows.

4. **Insecure design** — Threat modeling for new features: abuse cases, rate limits, idempotency, fraud/replay. Business rules enforced server-side.

5. **Security misconfiguration** — Secure defaults (deny). Least privilege for DB/app roles. Debug off in prod. Security headers where relevant (CSP, HSTS, frame options). CORS explicit and minimal.

6. **Vulnerable and outdated components** — Lockfiles, supply-chain checks (SCA), patch policy. Pin images and CI bases where reproducibility matters.

7. **Identification and authentication failures** — Session/token hygiene (httpOnly, secure, rotation, expiry). MFA where policy requires. Credential stuffing mitigations (rate limit, lockout policy). No credentials in URLs.

8. **Software and data integrity failures** — Signed releases/artifacts where applicable. CI trust (OIDC), protected branches. Safe update/install paths (no unsigned plugins). Integrity checks on deserialization if used.

9. **Logging and monitoring failures** — Authz failures and security events logged without leaking secrets or PII. Correlation IDs. Alerts on auth anomalies where feasible.

10. **SSRF** — Server-side fetches validate schemes/hosts, block cloud metadata IPs, use allowlists or egress controls; no user-controlled raw URLs without gates.

## Cross-cutting rules

- **Validate on the server** for anything security-relevant.
- **Fail closed**; prefer explicit allowlists.
- **Least data** in responses, logs, and client storage.
- **Consistent error messages** that do not disclose stack traces or internal identifiers to end users in production.

## Output format (when reporting)

Group issues under the Top 10 category (or ASVS chapter if using [reference.md](reference.md)). For each item: location, exploitability/impact in one line, concrete fix, optional test idea.

## Additional resources

- ASVS depth and verification levels: [reference.md](reference.md)
- Official overview: [OWASP Top 10](https://owasp.org/www-project-top-ten/), [ASVS](https://owasp.org/www-project-application-security-verification-standard/), [Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
