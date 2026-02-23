// メンバーのワークデータ取得エンドポイント
// GET /api/admin/member-data?coach_id=user_xxx&member_id=user_yyy

const LARK_CONFIG = {
  appId: process.env.LARK_APP_ID || 'cli_a9f3f7c00538de1b',
  appSecret: process.env.LARK_APP_SECRET || '4Uj0TspI3nEn6kEXDLW6thVCXzSMzzPc',
  appToken: process.env.LARK_APP_TOKEN || 'Hr8xbtPOVaiYpasng71jryL9pfh',
  usersTableId: process.env.LARK_USERS_TABLE_ID || 'tbls6sCjskyHEaHK',
  tableIds: {
    personality: 'tblCmFcFv7f5uheg',
    values: 'tblfJYASpzI1b3xe',
    talent: 'tblBIqnjhQslDMeU',
    passion: 'tbltiTrYJeRLstQx',
    mission: 'tblI0i66Soy92fTz',
    lifeManual: 'tblHhmjRRyL5Zs2H'
  }
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

async function verifyCoachMemberRelation(token, coachId, memberId) {
  // コーチのロール確認
  const coachUrl = `https://open.larksuite.com/open-apis/bitable/v1/apps/${LARK_CONFIG.appToken}/tables/${LARK_CONFIG.usersTableId}/records/search`;
  const coachRes = await fetch(coachUrl, {
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
  const coachData = await coachRes.json();
  if (coachData.code !== 0 || !coachData.data?.items?.length) return { valid: false, reason: 'coach_not_found' };
  if (getFieldValue(coachData.data.items[0].fields.role) !== 'coach') return { valid: false, reason: 'not_coach' };

  // メンバーの coach_id 確認
  const memberRes = await fetch(coachUrl, {
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
          value: [memberId]
        }]
      }
    })
  });
  const memberData = await memberRes.json();
  if (memberData.code !== 0 || !memberData.data?.items?.length) return { valid: false, reason: 'member_not_found' };

  const memberCoachId = getFieldValue(memberData.data.items[0].fields.coach_id);
  if (memberCoachId !== coachId) return { valid: false, reason: 'not_assigned' };

  return {
    valid: true,
    memberName: getFieldValue(memberData.data.items[0].fields.name),
    memberEmail: getFieldValue(memberData.data.items[0].fields.email)
  };
}

async function getWorkData(token, tableId, userId) {
  const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${LARK_CONFIG.appToken}/tables/${tableId}/records/search`;
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
    return data.data.items[0].fields;
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { coach_id: coachId, member_id: memberId } = req.query;
    if (!coachId || !memberId) {
      return res.status(400).json({ error: 'coach_id と member_id は必須です' });
    }

    const token = await getTenantAccessToken();

    // コーチ-メンバー関係を検証
    const relation = await verifyCoachMemberRelation(token, coachId, memberId);
    if (!relation.valid) {
      const messages = {
        coach_not_found: 'コーチが見つかりません',
        not_coach: 'コーチ権限がありません',
        member_not_found: 'メンバーが見つかりません',
        not_assigned: 'このメンバーはあなたに割り当てられていません'
      };
      return res.status(403).json({ error: messages[relation.reason] || 'アクセス権限がありません' });
    }

    // 全ワークデータを取得
    const workTypes = ['personality', 'values', 'talent', 'passion', 'mission', 'lifeManual'];
    const result = {
      memberName: relation.memberName,
      memberEmail: relation.memberEmail
    };

    for (const workType of workTypes) {
      const tableId = LARK_CONFIG.tableIds[workType];
      if (tableId) {
        const data = await getWorkData(token, tableId, memberId);
        result[workType] = data || null;
      }
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Member data error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}
