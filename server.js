/**
 * Lark API Proxy Server
 * CORS問題を解決するためのローカルプロキシ
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8888;

// Lark設定
const LARK_CONFIG = {
  appId: 'cli_a9f3f7c00538de1b',
  appSecret: '4Uj0TspI3nEn6kEXDLW6thVCXzSMzzPc',
  baseUrl: 'https://open.larksuite.com',
  // OAuth設定
  redirectUri: `http://localhost:${PORT}/auth/callback`,
  scope: 'contact:user.base:readonly'
};

// アクセストークンキャッシュ
let tokenCache = { token: null, expiry: 0 };

// アクセストークン取得
async function getAccessToken() {
  if (tokenCache.token && tokenCache.expiry > Date.now()) {
    return tokenCache.token;
  }

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      app_id: LARK_CONFIG.appId,
      app_secret: LARK_CONFIG.appSecret
    });

    const req = https.request({
      hostname: 'open.larksuite.com',
      path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.code === 0) {
            tokenCache.token = json.tenant_access_token;
            tokenCache.expiry = Date.now() + (json.expire - 60) * 1000;
            resolve(tokenCache.token);
          } else {
            reject(new Error(json.msg));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Lark APIへプロキシ
async function proxyToLark(req, res, apiPath, method, body) {
  try {
    const token = await getAccessToken();

    const options = {
      hostname: 'open.larksuite.com',
      path: '/open-apis' + apiPath,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let data = '';
      proxyRes.on('data', chunk => data += chunk);
      proxyRes.on('end', () => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(data);
      });
    });

    proxyReq.on('error', (e) => {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: e.message }));
    });

    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();

  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

// ユーザーアクセストークン取得（OAuthコード交換）
async function getUserAccessToken(code) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      grant_type: 'authorization_code',
      code: code
    });

    // まずapp_access_tokenを取得
    getAppAccessToken().then(appToken => {
      const req = https.request({
        hostname: 'open.larksuite.com',
        path: '/open-apis/authen/v1/oidc/access_token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${appToken}`
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.code === 0) {
              resolve(json.data);
            } else {
              reject(new Error(json.msg));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    }).catch(reject);
  });
}

// App Access Token取得
async function getAppAccessToken() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      app_id: LARK_CONFIG.appId,
      app_secret: LARK_CONFIG.appSecret
    });

    const req = https.request({
      hostname: 'open.larksuite.com',
      path: '/open-apis/auth/v3/app_access_token/internal',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.code === 0) {
            resolve(json.app_access_token);
          } else {
            reject(new Error(json.msg));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ユーザー情報取得
async function getUserInfo(userAccessToken) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'open.larksuite.com',
      path: '/open-apis/authen/v1/user_info',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userAccessToken}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.code === 0) {
            resolve(json.data);
          } else {
            reject(new Error(json.msg));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// OAuth認証URL生成
function getAuthUrl(state = 'random_state') {
  const params = new URLSearchParams({
    app_id: LARK_CONFIG.appId,
    redirect_uri: LARK_CONFIG.redirectUri,
    state: state
  });
  return `https://open.larksuite.com/open-apis/authen/v1/authorize?${params.toString()}`;
}

// MIMEタイプ
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// 静的ファイル配信
function serveStatic(req, res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// サーバー作成
const server = http.createServer(async (req, res) => {
  // CORSヘッダー
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // プリフライト
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // OAuth: ログインURL取得
  if (url.pathname === '/auth/login') {
    const authUrl = getAuthUrl();
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ url: authUrl }));
    return;
  }

  // OAuth: コールバック処理
  if (url.pathname === '/auth/callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>Error: No code provided</h1></body></html>');
      return;
    }

    try {
      // コードをアクセストークンに交換
      const tokenData = await getUserAccessToken(code);
      // ユーザー情報を取得
      const userInfo = await getUserInfo(tokenData.access_token);

      // ユーザー情報をクライアントに渡すHTMLを生成
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ログイン成功</title>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #ff9800, #ffc107); min-height: 100vh; }
    .card { background: white; padding: 40px; border-radius: 16px; max-width: 400px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
    .avatar { width: 80px; height: 80px; border-radius: 50%; margin-bottom: 16px; }
    h1 { color: #333; margin-bottom: 8px; }
    p { color: #666; }
    .btn { display: inline-block; padding: 12px 32px; background: #ff9800; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <img class="avatar" src="${userInfo.avatar_url || 'https://via.placeholder.com/80'}" alt="avatar">
    <h1>ようこそ！</h1>
    <p><strong>${userInfo.name}</strong></p>
    <p>${userInfo.email || userInfo.enterprise_email || ''}</p>
    <a href="/" class="btn">教科書を始める</a>
  </div>
  <script>
    // ユーザー情報をローカルストレージに保存
    const userData = {
      userId: '${userInfo.user_id || userInfo.open_id}',
      openId: '${userInfo.open_id}',
      unionId: '${userInfo.union_id || ''}',
      name: '${userInfo.name}',
      email: '${userInfo.email || userInfo.enterprise_email || ''}',
      avatar: '${userInfo.avatar_url || ''}',
      loginAt: new Date().toISOString()
    };
    localStorage.setItem('selfUnderstanding_larkUser', JSON.stringify(userData));
    localStorage.setItem('selfUnderstanding_userId', userData.userId);
    localStorage.setItem('selfUnderstanding_userName', userData.name);
    console.log('Lark user logged in:', userData);

    // ログイン後の自動同期フラグを設定
    localStorage.setItem('selfUnderstanding_needSync', 'true');
  </script>
</body>
</html>`;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h1>Login Error</h1><p>${error.message}</p><a href="/">戻る</a></body></html>`);
    }
    return;
  }

  // OAuth: ユーザー情報取得（ログイン状態確認用）
  if (url.pathname === '/auth/user') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ message: 'Check localStorage for user data' }));
    return;
  }

  // API プロキシ
  if (url.pathname.startsWith('/api/lark')) {
    const apiPath = url.pathname.replace('/api/lark', '');
    let body = '';

    if (req.method !== 'GET') {
      for await (const chunk of req) {
        body += chunk;
      }
    }

    await proxyToLark(req, res, apiPath + url.search, req.method, body || null);
    return;
  }

  // 静的ファイル
  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
  serveStatic(req, res, filePath);
});

server.listen(PORT, () => {
  console.log(`
====================================
  マイコンパ - ローカルサーバー
====================================

サーバー起動: http://localhost:${PORT}

ページを開く:
  - トップ: http://localhost:${PORT}/
  - 性格診断: http://localhost:${PORT}/pages/03-personality.html

Ctrl+C で停止
====================================
  `);
});
