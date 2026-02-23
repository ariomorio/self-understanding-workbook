// メンバー一覧取得エンドポイント
// GET /api/admin/members?coach_id=user_xxx

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

async function verifyCoach(token, coachId) {
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
          value: [coachId]
        }]
      }
    })
  });
  const data = await response.json();
  if (data.code !== 0 || !data.data?.items?.length) return false;
  const role = getFieldValue(data.data.items[0].fields.role);
  return role === 'coach';
}

async function getMembersByCoachId(token, coachId) {
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
          field_name: 'coach_id',
          operator: 'is',
          value: [coachId]
        }]
      }
    })
  });
  const data = await response.json();
  if (data.code === 0) return data.data?.items || [];
  throw new Error(`Search failed: ${data.msg}`);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const coachId = req.query.coach_id;
    if (!coachId) {
      return res.status(400).json({ error: 'coach_id は必須です' });
    }

    const token = await getTenantAccessToken();

    // コーチ権限確認
    const isCoach = await verifyCoach(token, coachId);
    if (!isCoach) {
      return res.status(403).json({ error: 'コーチ権限がありません' });
    }

    // メンバー一覧取得
    const members = await getMembersByCoachId(token, coachId);

    const memberList = members.map(m => ({
      userId: getFieldValue(m.fields.user_id),
      name: getFieldValue(m.fields.name),
      email: getFieldValue(m.fields.email),
      createdAt: m.fields.created_at || null
    }));

    return res.status(200).json({ members: memberList });

  } catch (error) {
    console.error('Members list error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}
