// コーチログインエンドポイント
// POST /api/admin/login
// Body: { email, password }

import { scrypt, timingSafeEqual } from 'crypto';
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
  if (data.code === 0) {
    return data.tenant_access_token;
  }
  throw new Error(`Failed to get token: ${data.msg}`);
}

async function searchUserByEmail(token, email) {
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
          field_name: 'email',
          operator: 'is',
          value: [email]
        }]
      }
    })
  });
  const data = await response.json();
  if (data.code === 0) {
    return data.data?.items || [];
  }
  throw new Error(`Search failed: ${data.msg}`);
}

function getFieldValue(field) {
  if (Array.isArray(field)) return field[0]?.text || field[0] || '';
  return field || '';
}

async function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const derivedKey = await scryptAsync(password, salt, 64);
  const storedKeyBuffer = Buffer.from(hash, 'hex');
  return timingSafeEqual(derivedKey, storedKeyBuffer);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'メールアドレスとパスワードは必須です' });
    }

    const token = await getTenantAccessToken();
    const users = await searchUserByEmail(token, email);

    if (users.length === 0) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }

    const user = users[0];
    const fields = user.fields;

    // パスワード照合
    const storedHash = getFieldValue(fields.password_hash);
    if (!storedHash) {
      return res.status(500).json({ error: 'アカウントにパスワードが設定されていません' });
    }

    const isValid = await verifyPassword(password, storedHash);
    if (!isValid) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }

    // ロールチェック
    const role = getFieldValue(fields.role);
    if (role !== 'coach') {
      return res.status(403).json({ error: 'コーチ権限がありません。管理者にお問い合わせください。' });
    }

    const userId = getFieldValue(fields.user_id);
    const userName = getFieldValue(fields.name);
    const userEmail = getFieldValue(fields.email);

    return res.status(200).json({
      userId,
      name: userName,
      email: userEmail,
      role: 'coach'
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}
