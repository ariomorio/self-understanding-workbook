#!/bin/bash
# Lark Base作成スクリプト - 自己理解の教科書

# 環境変数（.envから読み込むか直接設定）
APP_ID="${LARK_APP_ID:-cli_a98ed0a417789e1c}"
APP_SECRET="${LARK_APP_SECRET:-wEgiZPCQn3R9z6AYMFtUOdwhIWInbhFe}"
BASE_URL="https://open.larksuite.com/open-apis"

echo "🚀 Lark Base作成を開始します..."

# 1. テナントアクセストークンを取得
echo "📋 アクセストークンを取得中..."
TOKEN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/v3/tenant_access_token/internal" \
  -H "Content-Type: application/json" \
  -d "{\"app_id\": \"${APP_ID}\", \"app_secret\": \"${APP_SECRET}\"}")

TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.tenant_access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ トークン取得に失敗しました"
  echo $TOKEN_RESPONSE
  exit 1
fi

echo "✅ トークン取得成功"

# 2. Lark Baseアプリを作成
echo "📋 Lark Baseアプリを作成中..."
APP_RESPONSE=$(curl -s -X POST "${BASE_URL}/bitable/v1/apps" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "自己理解の教科書",
    "folder_token": ""
  }')

APP_TOKEN=$(echo $APP_RESPONSE | jq -r '.data.app.app_token')

if [ "$APP_TOKEN" == "null" ] || [ -z "$APP_TOKEN" ]; then
  echo "❌ Base作成に失敗しました"
  echo $APP_RESPONSE
  exit 1
fi

echo "✅ Base作成成功: $APP_TOKEN"

# 3. テーブルを作成
create_table() {
  local table_name=$1
  local fields=$2

  echo "📋 テーブル作成中: $table_name"

  RESPONSE=$(curl -s -X POST "${BASE_URL}/bitable/v1/apps/${APP_TOKEN}/tables" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"table\": {
        \"name\": \"${table_name}\",
        \"fields\": ${fields}
      }
    }")

  TABLE_ID=$(echo $RESPONSE | jq -r '.data.table_id')
  echo "  → テーブルID: $TABLE_ID"
}

# usersテーブル
create_table "users" '[
  {"field_name": "user_id", "type": 1},
  {"field_name": "name", "type": 1},
  {"field_name": "email", "type": 1},
  {"field_name": "created_at", "type": 5}
]'

# personalityテーブル
create_table "personality" '[
  {"field_name": "user_id", "type": 1},
  {"field_name": "type", "type": 1},
  {"field_name": "usagi_score", "type": 2},
  {"field_name": "kame_score", "type": 2},
  {"field_name": "kirigirisu_score", "type": 2},
  {"field_name": "ari_score", "type": 2},
  {"field_name": "answers_json", "type": 1},
  {"field_name": "updated_at", "type": 5}
]'

# valuesテーブル
create_table "values" '[
  {"field_name": "user_id", "type": 1},
  {"field_name": "q1_satisfied", "type": 1},
  {"field_name": "q2_angry", "type": 1},
  {"field_name": "q3_quit_job", "type": 1},
  {"field_name": "q4_memories_json", "type": 1},
  {"field_name": "q6_respect", "type": 1},
  {"field_name": "q7_feedback_json", "type": 1},
  {"field_name": "q8_selected_values", "type": 1},
  {"field_name": "q9_categories", "type": 1},
  {"field_name": "q10_priority", "type": 1},
  {"field_name": "summary", "type": 1},
  {"field_name": "updated_at", "type": 5}
]'

# talentテーブル
create_table "talent" '[
  {"field_name": "user_id", "type": 1},
  {"field_name": "q1_thanked", "type": 1},
  {"field_name": "q2_surprised", "type": 1},
  {"field_name": "q3_cant_help", "type": 1},
  {"field_name": "q4_absorbed", "type": 1},
  {"field_name": "q5_not_aware", "type": 1},
  {"field_name": "q6_feedback_json", "type": 1},
  {"field_name": "q7_selected_talents", "type": 1},
  {"field_name": "q8_priority", "type": 1},
  {"field_name": "q9_summary", "type": 1},
  {"field_name": "updated_at", "type": 5}
]'

# passionテーブル
create_table "passion" '[
  {"field_name": "user_id", "type": 1},
  {"field_name": "q1_youtube", "type": 1},
  {"field_name": "q2_talk", "type": 1},
  {"field_name": "q3_free", "type": 1},
  {"field_name": "q4_curious", "type": 1},
  {"field_name": "q5_told", "type": 1},
  {"field_name": "q6_searched", "type": 1},
  {"field_name": "q7_check_answers", "type": 1},
  {"field_name": "q7_yes_count", "type": 2},
  {"field_name": "q8_experiences", "type": 1},
  {"field_name": "q9_who_help", "type": 1},
  {"field_name": "q10_work_form", "type": 1},
  {"field_name": "q11_one_word", "type": 1},
  {"field_name": "updated_at", "type": 5}
]'

# missionテーブル
create_table "mission" '[
  {"field_name": "user_id", "type": 1},
  {"field_name": "valley1_json", "type": 1},
  {"field_name": "valley2_json", "type": 1},
  {"field_name": "valley3_json", "type": 1},
  {"field_name": "valley_summary", "type": 1},
  {"field_name": "mountain1_json", "type": 1},
  {"field_name": "mountain2_json", "type": 1},
  {"field_name": "mountain3_json", "type": 1},
  {"field_name": "mountain_summary", "type": 1},
  {"field_name": "core_words", "type": 1},
  {"field_name": "verbalize", "type": 1},
  {"field_name": "life_purpose", "type": 1},
  {"field_name": "life_mission", "type": 1},
  {"field_name": "life_compass", "type": 1},
  {"field_name": "updated_at", "type": 5}
]'

# life_manualテーブル
create_table "life_manual" '[
  {"field_name": "user_id", "type": 1},
  {"field_name": "item1_character", "type": 1},
  {"field_name": "item2_strength", "type": 1},
  {"field_name": "item3_challenge", "type": 1},
  {"field_name": "item4_trigger", "type": 1},
  {"field_name": "item5_values_top5", "type": 1},
  {"field_name": "item6_passion_theme", "type": 1},
  {"field_name": "item7_work_style", "type": 1},
  {"field_name": "item8_lifestyle", "type": 1},
  {"field_name": "item9_sns_theme", "type": 1},
  {"field_name": "item10_target", "type": 1},
  {"field_name": "item11_pain", "type": 1},
  {"field_name": "item12_value", "type": 1},
  {"field_name": "item13_service", "type": 1},
  {"field_name": "final_manual", "type": 1},
  {"field_name": "updated_at", "type": 5}
]'

echo ""
echo "=========================================="
echo "🎉 Lark Base作成完了！"
echo "=========================================="
echo ""
echo "📌 Base App Token: $APP_TOKEN"
echo ""
echo "このトークンをHTMLのLark API設定に追加してください"
echo ""

# 設定ファイルを出力
cat > ../js/lark-config.js << EOF
// Lark Base設定（自動生成）
// 生成日時: $(date)
const LARK_CONFIG = {
  appId: '${APP_ID}',
  appToken: '${APP_TOKEN}',
  baseUrl: '${BASE_URL}'
};

// グローバルに公開
window.LARK_CONFIG = LARK_CONFIG;
EOF

echo "✅ 設定ファイルを生成しました: js/lark-config.js"
