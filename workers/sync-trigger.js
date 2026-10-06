/**
 * PTracker sync-trigger — Cloudflare Worker (free tier, no card needed).
 *
 * The app's Sync button POSTs here; this Worker forwards the request to
 * GitHub's workflow-dispatch API using a token that never touches the
 * client. GitHub then runs the scraper; listings land in Firestore and
 * appear in the app automatically.
 *
 * SETUP (see README "One-tap sync"):
 *  1. GitHub → Settings → Developer settings → Fine-grained personal
 *     access tokens → generate a token with:
 *       Repository access: only this repo
 *       Permissions: Actions → Read and write
 *  2. Cloudflare dashboard → Workers & Pages → Create Worker → paste
 *     this file → deploy.
 *  3. Worker → Settings → Variables:
 *       GH_PAT            = <the token>            (type: Secret)
 *       GH_REPO           = sakshamwadhankar/Internship-Tracker-IEEE
 *       ALLOWED_ORIGINS   = https://ptracker-app-7117.web.app,http://localhost:5173
 *       SYNC_KEY          = <any long random string>   (type: Secret, optional
 *                           extra gate — must then also go in the app's
 *                           VITE_SYNC_TRIGGER_URL as ?key=<SYNC_KEY>)
 *  4. Put the worker URL in the app's .env as VITE_SYNC_TRIGGER_URL.
 */

const corsHeaders = (env, request) => {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
  const allowOrigin = allowed.includes('*')
    ? '*'
    : (allowed.includes(origin) ? origin : allowed[0] || '');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
};

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env, request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    const url = new URL(request.url);

    // Debug: reports which configuration keys the worker can SEE
    // (booleans and non-secret config only — never token values).
    if (url.pathname === '/api/debug') {
      return new Response(JSON.stringify({
        GH_PAT_set: Boolean(env.GH_PAT),
        GH_PAT_length: env.GH_PAT ? String(env.GH_PAT).length : 0,
        GH_REPO: env.GH_REPO || null,
        GH_REF: env.GH_REF || null,
        ALLOWED_ORIGINS: env.ALLOWED_ORIGINS || null,
        SYNC_KEY_set: Boolean(env.SYNC_KEY),
      }, null, 2), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname !== '/api/sync') {
      return new Response('Not found', { status: 404, headers: cors });
    }

    const missing = [];
    if (!env.GH_PAT) missing.push('GH_PAT');
    if (!env.GH_REPO) missing.push('GH_REPO');
    if (missing.length > 0) {
      return new Response(`Worker not configured — missing: ${missing.join(', ')}`, {
        status: 500,
        headers: cors,
      });
    }

    // Optional shared-secret gate (?key=... in the client URL)
    if (env.SYNC_KEY && url.searchParams.get('key') !== env.SYNC_KEY) {
      return new Response('Forbidden', { status: 403, headers: cors });
    }

    const ref = env.GH_REF || 'main';
    const ghRes = await fetch(
      `https://api.github.com/repos/${env.GH_REPO}/actions/workflows/sync-opportunities.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GH_PAT}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'ptracker-sync-trigger',
        },
        body: JSON.stringify({ ref }),
      }
    );

    if (ghRes.status === 204) {
      return new Response(JSON.stringify({ ok: true, dispatched: true }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const detail = await ghRes.text();
    return new Response(`GitHub dispatch failed (${ghRes.status}): ${detail.slice(0, 200)}`, {
      status: 502,
      headers: cors,
    });
  },
};
