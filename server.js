// server.js
// ─────────────────────────────────────────────────────────────────────────────
// CareerJet Search API Proxy
//
// WHY THIS EXISTS:
//   CareerJet Search API requires IP whitelisting.
//   Supabase Edge Functions run on dynamic IPs — can't be whitelisted.
//   This Express server runs on YOUR server (static IP) and proxies
//   the CareerJet API call, so CareerJet sees your server's fixed IP.
//
// CALLED BY:
//   Supabase edge function (careerjet-proxy) action="search"
//   via CAREERJET_SEARCH_PROXY_URL secret → https://api.xrilic.ai/api/careerjet-search
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const app     = express();

app.use(express.json());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  // Only accept calls from Supabase edge functions
  const allowed = ['https://kbpeyfietrwlhwcwqhjw.supabase.co'];
  const origin  = req.headers.origin ?? '';
  if (allowed.some(a => origin.startsWith(a))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Proxy-Secret');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Shared secret check ───────────────────────────────────────────────────────
// Same secret stored in:
//   - docker-compose.yml → PROXY_SECRET env var
//   - Supabase → supabase secrets set CAREERJET_PROXY_SECRET=xxx
function checkSecret(req, res, next) {
  const secret = process.env.PROXY_SECRET;
  if (!secret) return next();   // No secret = skip check (local dev only)
  if (req.headers['x-proxy-secret'] !== secret) {
    console.warn(`[auth] Rejected request — bad secret from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── POST /api/careerjet-search ────────────────────────────────────────────────
app.post('/api/careerjet-search', checkSecret, async (req, res) => {
  try {
    const {
      api_key,
      locale_code   = 'en_IN',
      keywords      = '',
      location      = '',
      page          = 1,
      page_size     = 20,
      sort          = 'relevance',
      user_ip       = '1.1.1.1',
      user_agent    = 'CareerJet-Integration/1.0',
      referer       = 'https://xrilic.ai/',
      contract_type,
      work_hours,
    } = req.body;

    if (!api_key) {
      return res.status(400).json({ error: 'api_key is required' });
    }

    // Build CareerJet v4 query params
    const params = new URLSearchParams({
      locale_code,
      keywords,
      location,
      page:      String(page),
      page_size: String(page_size),
      sort,
      user_ip,
      user_agent,
    });
    if (contract_type) params.set('contract_type', contract_type);
    if (work_hours)    params.set('work_hours', work_hours);

    // Basic auth: Base64(api_key:)
    const authHeader = 'Basic ' + Buffer.from(`${api_key}:`).toString('base64');

    const upstream = await fetch(
      `https://search.api.careerjet.net/v4/query?${params.toString()}`,
      {
        method:  'GET',
        headers: {
          Authorization:  authHeader,
          Referer:        referer,
          'User-Agent':   user_agent,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await upstream.json();

    console.log(
      `[search] "${keywords}" / "${location}" → type=${data.type} hits=${data.hits ?? 0} status=${upstream.status}`
    );

    return res.status(200).json(data);

  } catch (err) {
    console.error('[careerjet-search] Unhandled error:', err.message);
    return res.status(500).json({ error: 'Proxy error', detail: err.message });
  }
});

// ── GET /health ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:  'ok',
    service: 'careerjet-api',
    ts:      new Date().toISOString(),
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`✓ CareerJet proxy running on port ${PORT}`);
  console.log(`  Secret protection: ${process.env.PROXY_SECRET ? 'ENABLED' : 'DISABLED (set PROXY_SECRET)'}`);
});
// changes
