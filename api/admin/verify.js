// コーチ認証検証 + AIプロンプト設定 + パスワードリセット
// POST /api/admin/verify { userId }              → コーチ認証検証
// POST /api/admin/verify { action: "save_prompt", coach_id, prompt } → プロンプト保存
// POST /api/admin/verify { action: "reset_password", coach_id, member_id } → パスワードリセット
// GET  /api/admin/verify?coach_id=xxx            → プロンプト取得

import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

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

async function searchUserById(token, userId) {
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

// GET: プロンプト取得
async function handleGetPrompt(req, res) {
  const coachId = req.query.coach_id;
  if (!coachId) return res.status(400).json({ error: 'coach_id は必須です' });

  const token = await getTenantAccessToken();
  const users = await searchUserById(token, coachId);
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
}

// POST: プロンプト保存
async function handleSavePrompt(req, res) {
  const { coach_id, prompt } = req.body || {};
  if (!coach_id) return res.status(400).json({ error: 'coach_id は必須です' });
  if (prompt === undefined) return res.status(400).json({ error: 'prompt は必須です' });

  const token = await getTenantAccessToken();
  const users = await searchUserById(token, coach_id);
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
}

// POST: パスワードリセット
async function handleResetPassword(req, res) {
  const { coach_id, member_id } = req.body || {};
  if (!coach_id) return res.status(400).json({ error: 'coach_id は必須です' });
  if (!member_id) return res.status(400).json({ error: 'member_id は必須です' });

  const token = await getTenantAccessToken();

  // コーチ権限チェック
  const coaches = await searchUserById(token, coach_id);
  if (coaches.length === 0) return res.status(404).json({ error: 'コーチが見つかりません' });
  const coachRole = getFieldValue(coaches[0].fields.role);
  if (coachRole !== 'coach') return res.status(403).json({ error: 'コーチ権限がありません' });

  // メンバー検索
  const members = await searchUserById(token, member_id);
  if (members.length === 0) return res.status(404).json({ error: 'メンバーが見つかりません' });

  // 新パスワード生成（8文字ランダム）
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let newPassword = '';
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    newPassword += chars[bytes[i] % chars.length];
  }

  // ハッシュ化
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(newPassword, salt, 64);
  const hash = salt + ':' + derivedKey.toString('hex');

  // Lark Baseを更新
  const recordId = members[0].record_id;
  await updateRecord(token, recordId, { password_hash: hash });

  const memberName = getFieldValue(members[0].fields.name);
  const memberEmail = getFieldValue(members[0].fields.email);

  return res.status(200).json({
    success: true,
    memberName,
    memberEmail,
    newPassword,
    message: `${memberName}さんのパスワードをリセットしました`
  });
}

// POST: コーチ認証検証
async function handleVerify(req, res) {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId は必須です' });
  }

  const token = await getTenantAccessToken();
  const users = await searchUserById(token, userId);

  if (users.length === 0) {
    return res.status(404).json({ valid: false, error: 'ユーザーが見つかりません' });
  }

  const fields = users[0].fields;
  const role = getFieldValue(fields.role);

  if (role !== 'coach') {
    return res.status(403).json({ valid: false, error: 'コーチ権限がありません' });
  }

  return res.status(200).json({
    valid: true,
    role: 'coach',
    name: getFieldValue(fields.name),
    email: getFieldValue(fields.email)
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      // GET: プロンプト取得
      return await handleGetPrompt(req, res);
    }

    if (req.method === 'POST') {
      const { action } = req.body || {};
      if (action === 'save_prompt') {
        return await handleSavePrompt(req, res);
      }
      if (action === 'reset_password') {
        return await handleResetPassword(req, res);
      }
      // POST without action: コーチ認証検証（既存機能）
      return await handleVerify(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Verify/Prompt API error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}
