// 管理者チェックAPIエンドポイント
// GET /api/admin-check?email=xxx
// Lark Base設定テーブルから管理者メールリストを取得して判定
// Lark Baseに key: "admin_emails", value: "email1@example.com,email2@example.com" で登録

const LARK_CONFIG = {
  appId: process.env.LARK_APP_ID || 'cli_a9f3f7c00538de1b',
  appSecret: process.env.LARK_APP_SECRET || '4Uj0TspI3nEn6kEXDLW6thVCXzSMzzPc',
  appToken: process.env.LARK_APP_TOKEN || 'Hr8xbtPOVaiYpasng71jryL9pfh'
};

const SETTINGS_TABLE_ID = process.env.LARK_SETTINGS_TABLE_ID || '';

// デフォルトの管理者メール（Lark Base未設定時のフォールバック）
const DEFAULT_ADMIN_EMAILS = ['ariomorio@gmail.com'];

// Lark Baseから管理者メールリストを取得
async function getAdminEmailsFromLarkBase() {
  if (!SETTINGS_TABLE_ID) return null;

  try {
    const tokenRes = await fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: LARK_CONFIG.appId, app_secret: LARK_CONFIG.appSecret })
    });
    const tokenData = await tokenRes.json();
    if (tokenData.code !== 0) return null;

    const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${LARK_CONFIG.appToken}/tables/${SETTINGS_TABLE_ID}/records/search`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.tenant_access_token}`
      },
      body: JSON.stringify({
        filter: {
          conjunction: 'and',
          conditions: [{ field_name: 'key', operator: 'is', value: ['admin_emails'] }]
        }
      })
    });
    const data = await res.json();
    const items = data.data?.items || [];
    if (items.length > 0) {
      let val = items[0].fields?.value;
      if (Array.isArray(val)) val = val[0]?.text || val[0] || '';
      if (typeof val === 'string' && val.trim()) {
        return val.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
      }
    }
  } catch (e) {
    console.error('Failed to get admin emails from Lark Base:', e);
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const email = (req.query.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'email is required', isAdmin: false });

  // 優先順位: Lark Base設定 > デフォルト
  let adminEmails = await getAdminEmailsFromLarkBase();
  if (!adminEmails) {
    adminEmails = DEFAULT_ADMIN_EMAILS;
  }

  const isAdmin = adminEmails.includes(email);

  return res.status(200).json({ isAdmin, source: adminEmails === DEFAULT_ADMIN_EMAILS ? 'default' : 'lark_base' });
}
