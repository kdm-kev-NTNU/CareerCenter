# Hemmeligheter og GitGuardian (ggshield)

## Pre-commit (anbefalt)

1. Installer Python 3 og pip-pakker:

   ```powershell
   pip install pre-commit ggshield
   ```

2. Aktiver hook i dette repoet:

   ```powershell
   pre-commit install
   ```

3. Logg inn mot GitGuardian (samme konto/org som skanner PR):

   ```powershell
   ggshield auth login
   ```

   Alternativ: sett miljøvariabel `GITGUARDIAN_API_KEY` fra [GitGuardian API](https://dashboard.gitguardian.com/api).

4. Test manuelt:

   ```powershell
   pre-commit run ggshield --all-files
   ```

   Eller via npm: `npm run secrets:scan`

Hooken er satt til **manual** – den blokkerer ikke vanlige commits. Kjør skanning før push:

```powershell
npm run secrets:scan
```

Hopp over én gang (nød): `SKIP=ggshield git commit -m "..."`

Ekte API-nøkler og tokens bør fanges før de pushes.

## Miljøvariabler

- Kopier [`.env.example`](../.env.example) til `.env` (commit aldri `.env`).
- Fyll inn `JWT_SECRET` i `.env` (min. 32 tegn); generer for produksjon, f.eks.:

  ```powershell
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

## PR-scanning

GitGuardian GitHub App skanner pull requests. Pre-commit fanger problemer tidligere på utviklermaskinen.
