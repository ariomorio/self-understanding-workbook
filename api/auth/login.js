// メンバーログインエンドポイント
// GET  /api/auth/login → Lark OAuth URL返却
// POST /api/auth/login → email/password認証

import { scrypt, timingSafeEqual, randomBytes } from 'crypto';
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
  throw new Error(`Token取得失敗: ${data.msg}`);
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
  if (data.code === 0) return data.data?.items || [];
  throw new Error(`検索失敗: ${data.msg}`);
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: Lark OAuth URL生成（従来互換）
  if (req.method === 'GET') {
    const redirectUri = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/auth/callback`
      : 'http://localhost:8888/auth/callback';
    const params = new URLSearchParams({
      app_id: LARK_CONFIG.appId,
      redirect_uri: redirectUri,
      state: 'random_state'
    });
    const authUrl = `https://open.larksuite.com/open-apis/authen/v1/authorize?${params.toString()}`;
    return res.status(200).json({ url: authUrl });
  }

  // POST: email/password認証 or パスワードリセット
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, password, action } = req.body || {};

    // パスワードリセット
    if (action === 'reset_password') {
      if (!email) {
        return res.status(400).json({ error: 'メールアドレスを入力してください' });
      }

      const token = await getTenantAccessToken();
      const users = await searchUserByEmail(token, email);

      if (users.length === 0) {
        return res.status(404).json({ error: 'このメールアドレスのアカウントが見つかりません' });
      }

      const user = users[0];
      const fields = user.fields;
      const userName = getFieldValue(fields.name);

      // 新パスワード生成（8文字ランダム）
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      let newPassword = '';
      const bytes = randomBytes(8);
      for (let i = 0; i < 8; i++) {
        newPassword += chars[bytes[i] % chars.length];
      }

      // ハッシュ化して保存
      const salt = randomBytes(16).toString('hex');
      const derivedKey = await scryptAsync(newPassword, salt, 64);
      const hash = salt + ':' + derivedKey.toString('hex');

      const recordId = user.record_id;
      const updateUrl = `https://open.larksuite.com/open-apis/bitable/v1/apps/${LARK_CONFIG.appToken}/tables/${LARK_CONFIG.usersTableId}/records/${recordId}`;
      const updateRes = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fields: { password_hash: hash } })
      });
      const updateData = await updateRes.json();
      if (updateData.code !== 0) throw new Error('パスワード更新に失敗しました');

      return res.status(200).json({
        success: true,
        name: userName,
        newPassword
      });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'メールアドレスとパスワードを入力してください' });
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
      return res.status(500).json({ error: 'パスワードが設定されていません。管理者にお問い合わせください。' });
    }

    const isValid = await verifyPassword(password, storedHash);
    if (!isValid) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
    }

    const userId = getFieldValue(fields.user_id);
    const userName = getFieldValue(fields.name);
    const userEmail = getFieldValue(fields.email);
    const avatar = getFieldValue(fields.avatar);
    const role = getFieldValue(fields.role) || 'member';

    return res.status(200).json({
      userId,
      name: userName,
      email: userEmail,
      avatar: avatar || '',
      role
    });

  } catch (error) {
    console.error('Member login error:', error);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
}
