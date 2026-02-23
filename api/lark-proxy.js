// Lark API Proxy for Vercel (single endpoint approach)
// Usage: /api/lark-proxy?path=/bitable/v1/apps/.../records&filter=...

const LARK_CONFIG = {
  appId: process.env.LARK_APP_ID || 'cli_a9f3f7c00538de1b',
  appSecret: process.env.LARK_APP_SECRET || '4Uj0TspI3nEn6kEXDLW6thVCXzSMzzPc'
};

let tokenCache = { token: null, expiry: 0 };

async function getAccessToken() {
  if (tokenCache.token && tokenCache.expiry > Date.now()) {
    return tokenCache.token;
  }

  const response = await fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: LARK_CONFIG.appId,
      app_secret: LARK_CONFIG.appSecret
    })
  });

  const data = await response.json();
  if (data.code === 0) {
    tokenCache.token = data.tenant_access_token;
    tokenCache.expiry = Date.now() + (data.expire - 60) * 1000;
    return tokenCache.token;
  }
  throw new Error(data.msg);
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const token = await getAccessToken();

    // Get the Lark API path from query parameter
    const apiPath = req.query.path;
    if (!apiPath) {
      return res.status(400).json({ error: 'Missing path parameter' });
    }

    // Build query string (exclude 'path' param)
    const queryParams = new URLSearchParams();
    Object.keys(req.query).forEach(key => {
      if (key !== 'path') {
        queryParams.append(key, req.query[key]);
      }
    });
    const queryString = queryParams.toString();
    const fullUrl = queryString
      ? `https://open.larksuite.com/open-apis${apiPath}?${queryString}`
      : `https://open.larksuite.com/open-apis${apiPath}`;

    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    if (req.method !== 'GET' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(fullUrl, fetchOptions);
    const data = await response.json();

    res.status(response.status).json(data);
  } catch (error) {
    console.error('Lark API proxy error:', error);
    res.status(500).json({ error: error.message });
  }
}
