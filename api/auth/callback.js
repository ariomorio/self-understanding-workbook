// Lark OAuth コールバック処理
const LARK_CONFIG = {
  appId: process.env.LARK_APP_ID || 'cli_a9f3f7c00538de1b',
  appSecret: process.env.LARK_APP_SECRET || '4Uj0TspI3nEn6kEXDLW6thVCXzSMzzPc'
};

async function getAppAccessToken() {
  const response = await fetch('https://open.larksuite.com/open-apis/auth/v3/app_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: LARK_CONFIG.appId,
      app_secret: LARK_CONFIG.appSecret
    })
  });
  const data = await response.json();
  if (data.code === 0) {
    return data.app_access_token;
  }
  throw new Error(data.msg);
}

async function getUserAccessToken(code, appToken) {
  const response = await fetch('https://open.larksuite.com/open-apis/authen/v1/oidc/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${appToken}`
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: code
    })
  });
  const data = await response.json();
  if (data.code === 0) {
    return data.data;
  }
  throw new Error(data.msg);
}

async function getUserInfo(userAccessToken) {
  const response = await fetch('https://open.larksuite.com/open-apis/authen/v1/user_info', {
    headers: { 'Authorization': `Bearer ${userAccessToken}` }
  });
  const data = await response.json();
  if (data.code === 0) {
    return data.data;
  }
  throw new Error(data.msg);
}

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    res.status(400).send('<html><body><h1>Error: No code provided</h1></body></html>');
    return;
  }

  try {
    const appToken = await getAppAccessToken();
    const tokenData = await getUserAccessToken(code, appToken);
    const userInfo = await getUserInfo(tokenData.access_token);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ログイン成功</title>
  <style>
    body { font-family: sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #ff9800, #ffc107); min-height: 100vh; margin: 0; }
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
    localStorage.setItem('selfUnderstanding_needSync', 'true');
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send(`<html><body><h1>Login Error</h1><p>${error.message}</p><a href="/">戻る</a></body></html>`);
  }
}
