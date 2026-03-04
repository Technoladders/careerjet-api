# careerjet-api

CareerJet Search API proxy. Runs on your server (static IP) so CareerJet
can whitelist it. Called by the `careerjet-proxy` Supabase edge function.

## Why this exists

CareerJet requires IP whitelisting for the Search API.  
Supabase edge functions run on **dynamic IPs** — they can't be whitelisted.  
This tiny Express server runs on your server with a **static IP** and proxies
the request through, so CareerJet always sees your fixed IP.

## Flow

```
Browser → Supabase edge fn (careerjet-proxy)
               ↓ POST (x-proxy-secret header)
         api.xrilic.ai  ← YOUR server (static IP, whitelisted by CareerJet)
               ↓
         CareerJet Search API
```

## Local development

```bash
cp .env.example .env
# Fill in PROXY_SECRET in .env

npm install
npm run dev
# Server runs at http://localhost:3001

# Test:
curl http://localhost:3001/health
```

## GitHub Secrets required

Add these in GitHub → Settings → Secrets and variables → Actions:

| Secret | Value |
|--------|-------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username (already set) |
| `DOCKERHUB_TOKEN` | Your Docker Hub token (already set) |
| `SERVER_HOST` | Your server IP (already set) |
| `SERVER_USERNAME` | deploy (already set) |
| `SSH_PRIVATE_KEY` | SSH key (already set) |
| `PROXY_SECRET_PROD` | Run `openssl rand -hex 32` — new secret |

## Supabase secrets required

```bash
supabase secrets set CAREERJET_SEARCH_PROXY_URL=https://api.xrilic.ai/api/careerjet-search
supabase secrets set CAREERJET_PROXY_SECRET=same_value_as_PROXY_SECRET_PROD
```