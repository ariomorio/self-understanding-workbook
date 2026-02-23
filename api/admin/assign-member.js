// メンバー割り当てエンドポイント
// POST /api/admin/assign-member
// Body: { coach_id, member_email }

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

async function searchUser(token, fieldName, fieldValue) {
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
          field_name: fieldName,
          operator: 'is',
          value: [fieldValue]
        }]
      }
    })
  });
  const data = await response.json();
  if (data.code === 0) return data.data?.items || [];
  throw new Error(`Search failed: ${data.msg}`);
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
  if (data.code === 0) return data.data.record;
  throw new Error(`Update failed: ${data.msg}`);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { coach_id: coachId, member_email: memberEmail } = req.body || {};
    if (!coachId || !memberEmail) {
      return res.status(400).json({ error: 'coach_id と member_email は必須です' });
    }

    const token = await getTenantAccessToken();

    // コーチ権限確認
    const coaches = await searchUser(token, 'user_id', coachId);
    if (coaches.length === 0) {
      return res.status(404).json({ error: 'コーチが見つかりません' });
    }
    if (getFieldValue(coaches[0].fields.role) !== 'coach') {
      return res.status(403).json({ error: 'コーチ権限がありません' });
    }

    // メンバー検索
    const members = await searchUser(token, 'email', memberEmail);
    if (members.length === 0) {
      return res.status(404).json({ error: 'このメールアドレスのメンバーが見つかりません。メンバーがまず登録を完了してください。' });
    }

    const member = members[0];
    const memberFields = member.fields;
    const existingCoachId = getFieldValue(memberFields.coach_id);

    // 既に別のコーチに割り当てられている場合
    if (existingCoachId && existingCoachId !== coachId) {
      return res.status(409).json({ error: 'このメンバーは既に別のコーチに割り当てられています' });
    }

    // 既にこのコーチに割り当てられている場合
    if (existingCoachId === coachId) {
      return res.status(200).json({
        success: true,
        message: 'このメンバーは既に割り当て済みです',
        memberId: getFieldValue(memberFields.user_id),
        memberName: getFieldValue(memberFields.name)
      });
    }

    // coach_id を更新
    await updateRecord(token, member.record_id, { coach_id: coachId });

    return res.status(200).json({
      success: true,
      memberId: getFieldValue(memberFields.user_id),
      memberName: getFieldValue(memberFields.name)
    });

  } catch (error) {
    console.error('Assign member error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}
