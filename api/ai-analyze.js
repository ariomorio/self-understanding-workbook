// AI分析APIエンドポイント
// POST /api/ai-analyze
// Body: { userData, customPrompt? }
// Anthropic Claude APIでユーザーの自己理解データを分析

const LARK_CONFIG = {
  appId: process.env.LARK_APP_ID || 'cli_a9f3f7c00538de1b',
  appSecret: process.env.LARK_APP_SECRET || '4Uj0TspI3nEn6kEXDLW6thVCXzSMzzPc',
  appToken: process.env.LARK_APP_TOKEN || 'Hr8xbtPOVaiYpasng71jryL9pfh'
};

const USERS_TABLE_ID = process.env.LARK_USERS_TABLE_ID || 'tbls6sCjskyHEaHK';

// Lark Baseからコーチのカスタムプロンプトを取得
async function getPromptFromLarkBase() {
  try {
    const tokenRes = await fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: LARK_CONFIG.appId, app_secret: LARK_CONFIG.appSecret })
    });
    const tokenData = await tokenRes.json();
    if (tokenData.code !== 0) return null;

    // role=coachのユーザーからai_promptフィールドを取得
    const url = `https://open.larksuite.com/open-apis/bitable/v1/apps/${LARK_CONFIG.appToken}/tables/${USERS_TABLE_ID}/records/search`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.tenant_access_token}`
      },
      body: JSON.stringify({
        filter: {
          conjunction: 'and',
          conditions: [{ field_name: 'role', operator: 'is', value: ['coach'] }]
        }
      })
    });
    const data = await res.json();
    const items = data.data?.items || [];
    // 最初に見つかったコーチのプロンプトを使用
    for (const item of items) {
      const aiPrompt = item.fields?.ai_prompt;
      const val = Array.isArray(aiPrompt) ? (aiPrompt[0]?.text || aiPrompt[0]) : aiPrompt;
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (parsed.prompt) return parsed.prompt;
        } catch {
          return val;
        }
      }
    }
  } catch (e) {
    console.error('Failed to get prompt from Lark Base:', e);
  }
  return null;
}

// デフォルトの分析プロンプト
const DEFAULT_PROMPT = `あなたは自己理解コーチ「おさるAI」です。
以下のワークデータを分析して、ユーザーの自己理解を深める総合レポートを作成してください。

## 分析してほしいこと
1. **あなたの強み・特徴まとめ** - 全体を通して見えてくるユーザーの本質的な強みと特徴
2. **価値観・才能・情熱の一貫性** - 3つの柱がどのように繋がっているか
3. **SNS発信で活かせるテーマ** - ユーザーに合った発信テーマや切り口の提案
4. **商品・サービス化の方向性** - ユーザーの強みを活かしたビジネスの可能性
5. **今後のアクションプラン** - 具体的な次のステップ3つ

## ルール
- 暖かく、応援する口調で書く
- 具体的なエピソードを引用しながら分析する
- マークダウン形式で見出し・箇条書きを使う
- 「あなた」ではなく入力した名前で呼びかける（名前が無い場合は「あなた」）`;

// ユーザーデータをプロンプト用テキストに変換
function formatUserData(userData) {
  let text = '';

  if (userData.personality) {
    text += `## 性格診断\n`;
    text += `タイプ: ${userData.personality.resultType || '未診断'}\n`;
    const s = userData.personality.scores || {};
    text += `うさぎ(短期集中): ${s.usagi || 0}, かめ(長期分散): ${s.kame || 0}, キリギリス(快楽追求): ${s.kirigirisu || 0}, アリ(リスク回避): ${s.ari || 0}\n\n`;
  }

  if (userData.values) {
    const v = userData.values;
    text += `## 価値観ワーク\n`;
    text += `満たされた体験: ${v.q1 || '未入力'}\n`;
    text += `イラっとした体験: ${v.q2 || '未入力'}\n`;
    text += `仕事を辞めるとしたら: ${v.q3 || '未入力'}\n`;
    text += `選んだ価値観: ${v.q8?.selected?.join(', ') || '未選択'}\n`;
    if (v.q9 && typeof v.q9 === 'object') {
      text += `ジャンル分け:\n`;
      Object.entries(v.q9).forEach(([genre, vals]) => {
        text += `  ${genre}: ${Array.isArray(vals) ? vals.join(', ') : vals}\n`;
      });
    }
    if (Array.isArray(v.q10) && v.q10.length > 0) {
      text += `優先順位: ${v.q10.map((g, i) => `${i + 1}.${g}`).join(' ')}\n`;
    }
    text += `価値観の説明書: ${v.summary || '未入力'}\n\n`;
  }

  if (userData.talent) {
    const t = userData.talent;
    text += `## 才能ワーク\n`;
    text += `感謝された体験: ${t.q1 || '未入力'}\n`;
    text += `驚かれたこと: ${t.q2 || '未入力'}\n`;
    text += `選んだ才能: ${Array.isArray(t.q7) ? t.q7.join(', ') : (t.q7 || '未選択')}\n`;
    text += `才能の説明書: ${t.q9 || '未入力'}\n\n`;
  }

  if (userData.passion) {
    const p = userData.passion;
    text += `## 情熱ワーク\n`;
    text += `つい見てしまうコンテンツ: ${p.q1 || '未入力'}\n`;
    text += `時間を忘れる話題: ${p.q2 || '未入力'}\n`;
    text += `情熱チェック: ${Array.isArray(p.q7) ? p.q7.filter(a => a === 'yes').length : 0}/10 YES\n`;
    text += `情熱を一言で: ${p.q11 || '未入力'}\n\n`;
  }

  if (userData.mission) {
    const m = userData.mission;
    text += `## 使命・判断軸ワーク\n`;
    text += `自分らしさワード: ${m.coreWords || '未入力'}\n`;
    text += `人生の目的: ${m.lifePurpose || '未入力'}\n`;
    text += `人生の使命: ${m.lifeMission || '未入力'}\n`;
    text += `判断軸: ${m.lifeCompass || '未入力'}\n\n`;
  }

  if (userData['life-manual']) {
    text += `## 人生の説明書\n${userData['life-manual'].finalManual || '未入力'}\n\n`;
  }

  return text;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AI API key is not configured' });
  }

  try {
    const { userData, customPrompt } = req.body || {};
    if (!userData) return res.status(400).json({ error: 'userData is required' });

    // プロンプト優先順位: リクエスト指定 > Lark Base設定 > デフォルト
    let systemPrompt = customPrompt;
    if (!systemPrompt) {
      systemPrompt = await getPromptFromLarkBase();
    }
    if (!systemPrompt) {
      systemPrompt = DEFAULT_PROMPT;
    }

    const userDataText = formatUserData(userData);
    const userName = userData.userName || 'ユーザー';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `ユーザー名: ${userName}\n\n${userDataText}\n\n上記の自己理解ワークの結果を総合的に分析して、レポートを作成してください。`
        }]
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Anthropic API error:', response.status, errorBody);
      return res.status(500).json({ error: 'AI分析に失敗しました', details: response.status });
    }

    const result = await response.json();
    const analysisText = result.content?.[0]?.text || '分析結果を取得できませんでした';

    return res.status(200).json({
      analysis: analysisText,
      model: result.model,
      usage: result.usage
    });

  } catch (error) {
    console.error('AI analyze error:', error);
    return res.status(500).json({ error: 'AI分析中にエラーが発生しました' });
  }
}
