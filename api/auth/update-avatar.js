// アバター更新エンドポイント
// POST /api/auth/update-avatar
// Body: { userId, avatar }

const LARK_CONFIG = {
  appId: process.env.LARK_APP_ID || 'cli_a9f3f7c00538de1b',
  appSecret: process.env.LARK_APP_SECRET || '4Uj0TspI3nEn6kEXDLW6thVCXzSMzzPc',
  appToken: process.env.LARK_APP_TOKEN || 'Hr8xbtPOVaiYpasng71jryL9pfh',
  usersTableId: process.env.LARK_USERS_TABLE_ID || 'tbls6sCjskyHEaHK'
};

async function getTenantAccessToken() {
  const response = await fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: LARK_CONFIG.appId,
      app_secret: LARK_CONFIG.appSecret
    })
  });
  const data = await response.json();
  if (data.code === 0) return data.tenant_access_token;
  throw new Error(`Token取得失敗: ${data.msg}`);
}

async function findUserRecord(token, userId) {
  const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${LARK_CONFIG.appToken}/tables/${LARK_CONFIG.usersTableId}/records/search`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      filter: {
        conjunction: 'and',
        conditions: [{
          field_name: 'user_id',
          operator: 'is',
          value: [userId]
        }]
      }
    })
  });
  const data = await response.json();
  if (data.code === 0 && data.data?.items?.length > 0) {
    return data.data.items[0];
  }
  return null;
}

async function updateRecord(token, recordId, fields) {
  const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${LARK_CONFIG.appToken}/tables/${LARK_CONFIG.usersTableId}/records/${recordId}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ fields })
  });
  const data = await response.json();
  return data.code === 0;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, avatar } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const token = await getTenantAccessToken();
    const userRecord = await findUserRecord(token, userId);

    if (!userRecord) {
      return res.status(404).json({ error: 'User not found' });
    }

    const success = await updateRecord(token, userRecord.record_id, {
      avatar: avatar || ''
    });

    if (success) {
      return res.status(200).json({ ok: true });
    } else {
      return res.status(500).json({ error: 'Update failed' });
    }

  } catch (error) {
    console.error('Avatar update error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
