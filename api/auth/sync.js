// ユーザーデータ一括取得エンドポイント
// POST /api/auth/sync
// Body: { userId }
// ログイン後にLark Baseから全ワークデータを一括取得

const LARK_CONFIG = {
  appId: process.env.LARK_APP_ID || 'cli_a9f3f7c00538de1b',
  appSecret: process.env.LARK_APP_SECRET || '4Uj0TspI3nEn6kEXDLW6thVCXzSMzzPc',
  appToken: process.env.LARK_APP_TOKEN || 'Hr8xbtPOVaiYpasng71jryL9pfh'
};

const TABLES = {
  personality: process.env.LARK_PERSONALITY_TABLE_ID || 'tblCmFcFv7f5uheg',
  values:      process.env.LARK_VALUES_TABLE_ID      || 'tblfJYASpzI1b3xe',
  talent:      process.env.LARK_TALENT_TABLE_ID      || 'tblBIqnjhQslDMeU',
  passion:     process.env.LARK_PASSION_TABLE_ID     || 'tbltiTrYJeRLstQx',
  mission:     process.env.LARK_MISSION_TABLE_ID     || 'tblI0i66Soy92fTz',
  lifeManual:  process.env.LARK_LIFEMANUAL_TABLE_ID  || 'tblHhmjRRyL5Zs2H'
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

async function searchRecordsByUserId(token, tableId, userId) {
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
  if (data.code === 0) {
    return data.data?.items || [];
  }
  return [];
}

// Lark Baseのフィールド値を取得（配列の場合のテキスト抽出対応）
function getFieldValue(val) {
  if (val == null) return '';
  if (Array.isArray(val)) {
    return val[0]?.text || val[0] || '';
  }
  return val;
}

// JSON文字列をパースし、文字列型の場合はそのまま文字列を返す
// JSON.stringify("text") → '"text"' の復元に対応
function getStringField(val) {
  const str = getFieldValue(val);
  if (!str) return '';
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed === 'string') return parsed;
  } catch { /* not JSON, return as-is */ }
  return String(str);
}

// テーブルのfieldsをフロントエンド(localStorage)形式に変換
// 各ページのloadData()が期待するフォーマットに正確に合わせる
function convertFields(workType, fields) {
  const g = (key) => getFieldValue(fields[key]);

  switch (workType) {
    // 03-personality.html loadData: data.answers[num] → select値を設定 → calculateScores()
    // answers: {"1":"5", "2":"4", ..., "20":"3"} (質問番号→スコア値の文字列)
    case 'personality':
      return {
        answers: safeJsonParse(g('answers_json'), {}),
        scores: {
          usagi: fields.usagi_score || 0,
          kame: fields.kame_score || 0,
          kirigirisu: fields.kirigirisu_score || 0,
          ari: fields.ari_score || 0
        },
        resultType: g('type')
      };

    // 04-values.html loadData:
    //   q1,q2,q3: string
    //   q4: {kindergarten, elementary, junior, high, university}
    //   q6: {person, reason}
    //   q7: [5 strings]
    //   q8: {selected: [string], other: string}
    //   q9,q10,summary: string
    case 'values': {
      // q8: ページは {selected: [], other: ""} を期待。配列で保存されている場合も対応
      const q8Raw = safeJsonParse(g('q8_selected_values'), { selected: [], other: '' });
      const q8 = Array.isArray(q8Raw) ? { selected: q8Raw, other: '' } : q8Raw;
      return {
        q1: g('q1_satisfied'),
        q2: g('q2_angry'),
        q3: g('q3_quit_job'),
        q4: safeJsonParse(g('q4_memories_json'), { kindergarten: '', elementary: '', junior: '', high: '', university: '' }),
        q6: safeJsonParse(g('q6_respect'), { person: '', reason: '' }),
        q7: safeJsonParse(g('q7_feedback_json'), []),
        q8,
        q9: safeJsonParse(g('q9_categories'), {}),
        q10: safeJsonParse(g('q10_priority'), []),
        summary: g('summary')
      };
    }

    // 05-talent.html loadData:
    //   q1-q5: string
    //   q6: [5 strings]
    //   q7: [talent name strings] (selectedTalents)
    //   q8: string (textarea)
    //   q9: string (textarea)
    case 'talent':
      return {
        q1: g('q1_thanked'),
        q2: g('q2_surprised'),
        q3: g('q3_cant_help'),
        q4: g('q4_absorbed'),
        q5: g('q5_not_aware'),
        q6: safeJsonParse(g('q6_feedback_json'), []),
        q7: safeJsonParse(g('q7_selected_talents'), []),
        q8: getStringField(fields.q8_priority),
        q9: g('q9_summary')
      };

    // 06-passion.html loadData:
    //   q1-q6: string
    //   q7: [10 elements: "yes"|"no"|null]
    //   q8-q11: string
    case 'passion':
      return {
        q1: g('q1_youtube'),
        q2: g('q2_talk'),
        q3: g('q3_free'),
        q4: g('q4_curious'),
        q5: g('q5_told'),
        q6: g('q6_searched'),
        q7: safeJsonParse(g('q7_check_answers'), []),
        q8: g('q8_experiences'),
        q9: g('q9_who_help'),
        q10: g('q10_work_form'),
        q11: g('q11_one_word')
      };

    // 07-mission.html loadData:
    //   valley: [{when,what,emotion,why,recovery,learn}, x3]  ← 配列！
    //   valleySummary: string
    //   mountain: [{when,what,emotion,why}, x3]  ← 配列！
    //   mountainSummary: string
    //   coreWords, verbalize, lifePurpose, lifeMission, lifeCompass: string
    case 'mission':
      return {
        valley: [
          safeJsonParse(g('valley1_json'), {}),
          safeJsonParse(g('valley2_json'), {}),
          safeJsonParse(g('valley3_json'), {})
        ],
        valleySummary: g('valley_summary'),
        mountain: [
          safeJsonParse(g('mountain1_json'), {}),
          safeJsonParse(g('mountain2_json'), {}),
          safeJsonParse(g('mountain3_json'), {})
        ],
        mountainSummary: g('mountain_summary'),
        coreWords: g('core_words'),
        verbalize: g('verbalize'),
        lifePurpose: g('life_purpose'),
        lifeMission: g('life_mission'),
        lifeCompass: g('life_compass')
      };

    // 09-life-manual.html loadData:
    //   item1-item13: string
    //   finalManual: string
    case 'lifeManual':
      return {
        item1: g('item1_character'),
        item2: g('item2_strength'),
        item3: g('item3_challenge'),
        item4: g('item4_trigger'),
        item5: g('item5_values_top5'),
        item6: g('item6_passion_theme'),
        item7: g('item7_work_style'),
        item8: g('item8_lifestyle'),
        item9: g('item9_sns_theme'),
        item10: g('item10_target'),
        item11: g('item11_pain'),
        item12: g('item12_value'),
        item13: g('item13_service'),
        finalManual: g('final_manual')
      };

    default:
      return fields;
  }
}

function safeJsonParse(str, fallback) {
  if (!str) return fallback;
  try {
    const parsed = JSON.parse(str);
    // "[object Object]" はバグで保存された不正データ → fallback
    if (parsed === null || parsed === undefined) return fallback;
    return parsed;
  } catch {
    // JSON.parseに失敗 → "[object Object]" 等の不正文字列
    return fallback;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const token = await getTenantAccessToken();

    // 全テーブルを順次検索（レート制限回避）
    const results = {};
    const entries = Object.entries(TABLES);

    for (const [workType, tableId] of entries) {
      try {
        const records = await searchRecordsByUserId(token, tableId, userId);
        if (records.length > 0) {
          results[workType] = convertFields(workType, records[0].fields);
        }
      } catch (err) {
        console.error(`Failed to search ${workType} (${tableId}):`, err.message);
      }
    }

    return res.status(200).json({
      userId,
      data: results,
      restoredCount: Object.keys(results).length
    });

  } catch (error) {
    console.error('Sync error:', error);
    return res.status(500).json({ error: 'データ同期中にエラーが発生しました' });
  }
}
