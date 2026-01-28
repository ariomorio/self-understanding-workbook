// Lark OAuth ログインURL取得
const LARK_CONFIG = {
  appId: process.env.LARK_APP_ID || 'cli_a9f3f7c00538de1b',
  redirectUri: process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/auth/callback`
    : 'http://localhost:8888/auth/callback'
};

export default function handler(req, res) {
  const params = new URLSearchParams({
    app_id: LARK_CONFIG.appId,
    redirect_uri: LARK_CONFIG.redirectUri,
    state: 'random_state'
  });

  const authUrl = `https://open.larksuite.com/open-apis/authen/v1/authorize?${params.toString()}`;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ url: authUrl });
}
