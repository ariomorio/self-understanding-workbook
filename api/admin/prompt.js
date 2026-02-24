// コーチ用AIプロンプト設定エンドポイント
// GET  /api/admin/prompt?coach_id=xxx  → 現在のプロンプトを取得
// POST /api/admin/prompt { coach_id, prompt } → プロンプトを保存

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
  throw new Error(`Failed to get token: ${data.msg}`);
}

function getFieldValue(field) {
  if (Array.isArray(field)) return field[0]?.text || field[0] || '';
  return field || '';
}

// user_idでユーザーを検索
async function searchUser(token, userId) {
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
  if (data.code === 0) return data.data?.items || [];
  throw new Error(`Search failed: ${data.msg}`);
}

// レコードを更新
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
  if (data.code !== 0) throw new Error(`Update failed: ${data.msg}`);
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = await getTenantAccessToken();

    if (req.method === 'GET') {
      // プロンプト取得
      const coachId = req.query.coach_id;
      if (!coachId) return res.status(400).json({ error: 'coach_id は必須です' });

      const users = await searchUser(token, coachId);
      if (users.length === 0) return res.status(404).json({ error: 'コーチが見つかりません' });

      const fields = users[0].fields;
      const role = getFieldValue(fields.role);
      if (role !== 'coach') return res.status(403).json({ error: 'コーチ権限がありません' });

      const promptJson = getFieldValue(fields.ai_prompt);
      let promptData = null;
      if (promptJson) {
        try {
          promptData = JSON.parse(promptJson);
        } catch {
          promptData = { prompt: promptJson };
        }
      }

      return res.status(200).json({
        prompt: promptData?.prompt || null,
        updatedAt: promptData?.updatedAt || null
      });

    } else if (req.method === 'POST') {
      // プロンプト保存
      const { coach_id, prompt } = req.body || {};
      if (!coach_id) return res.status(400).json({ error: 'coach_id は必須です' });
      if (prompt === undefined) return res.status(400).json({ error: 'prompt は必須です' });

      const users = await searchUser(token, coach_id);
      if (users.length === 0) return res.status(404).json({ error: 'コーチが見つかりません' });

      const fields = users[0].fields;
      const role = getFieldValue(fields.role);
      if (role !== 'coach') return res.status(403).json({ error: 'コーチ権限がありません' });

      const recordId = users[0].record_id;
      const promptData = JSON.stringify({
        prompt: prompt,
        updatedAt: new Date().toISOString()
      });

      await updateRecord(token, recordId, { ai_prompt: promptData });

      return res.status(200).json({ success: true, message: 'プロンプトを保存しました' });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Prompt API error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}
