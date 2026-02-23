/**
 * データ同期モジュール
 * ローカルストレージ ⇔ Lark Base の同期を管理
 */

const DataSync = {
  // ユーザーID（メールまたはユニークID）
  userId: null,

  // 同期状態
  syncStatus: {
    lastSync: null,
    pendingChanges: []
  },

  /**
   * 初期化
   */
  init() {
    this.userId = localStorage.getItem('selfUnderstanding_userId') || this.generateUserId();
    localStorage.setItem('selfUnderstanding_userId', this.userId);

    // 同期状態を読み込み
    const savedStatus = localStorage.getItem('selfUnderstanding_syncStatus');
    if (savedStatus) {
      this.syncStatus = JSON.parse(savedStatus);
    }

    console.log('DataSync initialized with userId:', this.userId);

    // 未同期のローカルデータがあれば自動同期（ページロード後2秒待ち）
    setTimeout(() => this._autoSyncIfNeeded(), 2000);
  },

  /**
   * 未同期データの自動同期
   * - ローカルにデータがあるがsyncStatusに記録がない場合に同期
   * - 前回の同期から1時間以上経過している場合にも同期
   */
  async _autoSyncIfNeeded() {
    if (!window.LarkAPI || !window.LARK_CONFIG) return;

    const lastSync = this.syncStatus.lastSync;
    const oneHour = 60 * 60 * 1000;
    const recentlySynced = lastSync && (Date.now() - new Date(lastSync).getTime() < oneHour);

    // 最近同期済みなら何もしない
    if (recentlySynced && this.syncStatus.pendingChanges.length === 0) return;

    const workTypes = ['personality', 'values', 'talent', 'passion', 'mission', 'life-manual'];
    let syncCount = 0;

    for (const wt of workTypes) {
      const localKey = `selfUnderstanding_${wt}`;
      const localData = localStorage.getItem(localKey);
      if (localData) {
        try {
          await this.saveWorkData(wt, JSON.parse(localData));
          syncCount++;
        } catch (e) {
          console.error('Auto-sync failed for', wt, ':', e);
        }
      }
    }

    if (syncCount > 0) {
      console.log(`Auto-synced ${syncCount} work types to Lark Base`);
    }
  },

  /**
   * ユニークIDを生成
   */
  generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  /**
   * ワークデータを保存（ローカル + Lark Base）
   */
  async saveWorkData(workType, data) {
    // ローカルストレージに保存
    const localKey = `selfUnderstanding_${workType}`;
    localStorage.setItem(localKey, JSON.stringify(data));
    console.log(`Saved ${workType} to localStorage`);

    // Lark Baseに同期
    if (window.LarkAPI && window.LARK_CONFIG) {
      try {
        const tableId = window.LARK_CONFIG.tableIds[this.convertWorkTypeToTableKey(workType)];
        if (tableId) {
          // データをLark Base形式に変換
          const fields = this.convertToLarkFields(workType, data);
          fields.user_id = this.userId;
          fields.updated_at = Date.now();

          // 既存レコードをチェック
          const existing = await window.LarkAPI.getRecords(tableId, `CurrentValue.[user_id]="${this.userId}"`);

          if (existing.length > 0) {
            await window.LarkAPI.updateRecord(tableId, existing[0].record_id, fields);
            console.log(`Updated ${workType} in Lark Base`);
          } else {
            await window.LarkAPI.createRecord(tableId, fields);
            console.log(`Created ${workType} in Lark Base`);
          }

          this.updateSyncStatus(workType, 'synced');
          this.showSyncNotification('success', `${this.getWorkTypeName(workType)}をクラウドに保存しました`);
        }
      } catch (error) {
        console.error(`Failed to sync ${workType} to Lark Base:`, error);
        this.updateSyncStatus(workType, 'pending');
        this.showSyncNotification('warning', 'オフラインで保存しました（後で同期されます）');
      }
    }
  },

  /**
   * ワークタイプをテーブルキーに変換
   */
  convertWorkTypeToTableKey(workType) {
    const mapping = {
      'personality': 'personality',
      'values': 'values',
      'talent': 'talent',
      'passion': 'passion',
      'mission': 'mission',
      'life-manual': 'lifeManual',
      'become': 'become' // 独立ワーク（Lark Base未対応）
    };
    return mapping[workType] || workType;
  },

  /**
   * 値を文字列に変換（オブジェクト/配列はJSON化、文字列はそのまま）
   */
  _toStr(val, fallback) {
    if (val === undefined || val === null) return fallback || '';
    if (typeof val === 'string') return val;
    return JSON.stringify(val);
  },

  /**
   * データをLark Baseフィールド形式に変換
   */
  convertToLarkFields(workType, data) {
    const fields = {};
    const s = this._toStr.bind(this);

    switch (workType) {
      case 'personality':
        fields.type = data.type || '';
        fields.usagi_score = data.usagiScore || 0;
        fields.kame_score = data.kameScore || 0;
        fields.kirigirisu_score = data.kirigirisuScore || 0;
        fields.ari_score = data.ariScore || 0;
        fields.answers_json = s(data.answers, '{}');
        break;

      case 'values':
        fields.q1_satisfied = s(data.q1);
        fields.q2_angry = s(data.q2);
        fields.q3_quit_job = s(data.q3);
        fields.q4_memories_json = s(data.q4, '{}');
        fields.q6_respect = s(data.q6, '{}');
        fields.q7_feedback_json = s(data.q7, '[]');
        fields.q8_selected_values = s(data.q8, '{}');
        fields.q9_categories = s(data.q9);
        fields.q10_priority = s(data.q10);
        fields.summary = s(data.summary);
        break;

      case 'talent':
        fields.q1_thanked = s(data.q1);
        fields.q2_surprised = s(data.q2);
        fields.q3_cant_help = s(data.q3);
        fields.q4_absorbed = s(data.q4);
        fields.q5_not_aware = s(data.q5);
        fields.q6_feedback_json = s(data.q6, '[]');
        fields.q7_selected_talents = s(data.q7, '[]');
        fields.q8_priority = s(data.q8);
        fields.q9_summary = s(data.q9);
        break;

      case 'passion':
        fields.q1_youtube = s(data.q1);
        fields.q2_talk = s(data.q2);
        fields.q3_free = s(data.q3);
        fields.q4_curious = s(data.q4);
        fields.q5_told = s(data.q5);
        fields.q6_searched = s(data.q6);
        fields.q7_uninstructed = s(data.q7);
        fields.q8_most_curious = s(data.q8);
        fields.q9_episodes = s(data.q9);
        fields.q10_common = s(data.q10);
        fields.q11_keywords = s(data.q11);
        fields.q12_state = s(data.q12);
        fields.q13_daily_change = s(data.q13);
        fields.q14_shape = s(data.q14);
        fields.passion_manual = s(data['passion-manual']);
        break;

      case 'mission': {
        // ページは valley/mountain を配列で保存、互換性のため両形式対応
        const v = data.valley || [];
        fields.valley1_json = s(data.valley1 || v[0], '{}');
        fields.valley2_json = s(data.valley2 || v[1], '{}');
        fields.valley3_json = s(data.valley3 || v[2], '{}');
        fields.valley_summary = s(data.valleySummary);
        const m = data.mountain || [];
        fields.mountain1_json = s(data.mountain1 || m[0], '{}');
        fields.mountain2_json = s(data.mountain2 || m[1], '{}');
        fields.mountain3_json = s(data.mountain3 || m[2], '{}');
        fields.mountain_summary = s(data.mountainSummary);
        fields.core_words = s(data.coreWords);
        fields.verbalize = s(data.verbalize);
        fields.life_purpose = s(data.lifePurpose);
        fields.life_mission = s(data.lifeMission);
        fields.life_compass = s(data.lifeCompass);
        break;
      }

      case 'life-manual':
        fields.item1_character = s(data.item1);
        fields.item2_strength = s(data.item2);
        fields.item3_challenge = s(data.item3);
        fields.item4_trigger = s(data.item4);
        fields.item5_values_top5 = s(data.item5);
        fields.item6_passion_theme = s(data.item6);
        fields.item7_work_style = s(data.item7);
        fields.item8_lifestyle = s(data.item8);
        fields.item9_sns_theme = s(data.item9);
        fields.item10_target = s(data.item10);
        fields.item11_pain = s(data.item11);
        fields.item12_value = s(data.item12);
        fields.item13_service = s(data.item13);
        fields.final_manual = s(data.finalManual);
        break;

      case 'become': {
        // テキストデータのみ（画像はローカルのみ保持）
        const periods = ['year5', 'year3', 'year1', 'month6'];
        periods.forEach(p => {
          if (data[p]) {
            fields[p + '_goal'] = s(data[p].goal);
            fields[p + '_reason'] = s(data[p].reason);
          }
        });
        break;
      }

      default:
        // 未定義のワークタイプは全てJSONとして保存
        fields.data_json = JSON.stringify(data);
    }

    return fields;
  },

  /**
   * ワークタイプの日本語名を取得
   */
  getWorkTypeName(workType) {
    const names = {
      'personality': '性格診断',
      'values': '価値観ワーク',
      'talent': '才能ワーク',
      'passion': '情熱ワーク',
      'mission': '使命ワーク',
      'life-manual': '人生の説明書',
      'become': 'なりたい自分'
    };
    return names[workType] || workType;
  },

  /**
   * 同期状態を更新
   */
  updateSyncStatus(workType, status) {
    if (status === 'synced') {
      this.syncStatus.lastSync = new Date().toISOString();
      this.syncStatus.pendingChanges = this.syncStatus.pendingChanges.filter(w => w !== workType);
    } else if (status === 'pending') {
      if (!this.syncStatus.pendingChanges.includes(workType)) {
        this.syncStatus.pendingChanges.push(workType);
      }
    }
    localStorage.setItem('selfUnderstanding_syncStatus', JSON.stringify(this.syncStatus));
  },

  /**
   * 同期通知を表示
   */
  showSyncNotification(type, message) {
    // 通知要素を作成
    const notification = document.createElement('div');
    notification.className = `sync-notification sync-${type}`;
    notification.innerHTML = `
      <span class="sync-icon">${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '❌'}</span>
      <span class="sync-message">${message}</span>
    `;

    // スタイルを適用
    Object.assign(notification.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '8px',
      backgroundColor: type === 'success' ? '#4caf50' : type === 'warning' ? '#ff9800' : '#f44336',
      color: 'white',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      zIndex: '10000',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      animation: 'slideIn 0.3s ease'
    });

    document.body.appendChild(notification);

    // 3秒後に自動削除
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  },

  /**
   * 全データをLark Baseに同期
   */
  async syncAllToLarkBase() {
    if (!window.LarkAPI || !window.LARK_CONFIG) {
      console.error('Lark API not initialized');
      return;
    }

    const workTypes = ['personality', 'values', 'talent', 'passion', 'mission', 'life-manual'];
    let syncCount = 0;

    for (const workType of workTypes) {
      const localKey = `selfUnderstanding_${workType}`;
      const localData = localStorage.getItem(localKey);

      if (localData) {
        try {
          await this.saveWorkData(workType, JSON.parse(localData));
          syncCount++;
        } catch (error) {
          console.error(`Failed to sync ${workType}:`, error);
        }
      }
    }

    this.showSyncNotification('success', `${syncCount}件のデータをクラウドに同期しました`);
    return syncCount;
  },

  /**
   * Lark Baseからデータを復元
   */
  async restoreFromLarkBase() {
    if (!window.LarkAPI || !window.LARK_CONFIG) {
      console.error('Lark API not initialized');
      return 0;
    }

    const workTypes = ['personality', 'values', 'talent', 'passion', 'mission'];
    let restoreCount = 0;

    for (const workType of workTypes) {
      try {
        const tableKey = this.convertWorkTypeToTableKey(workType);
        const tableId = window.LARK_CONFIG.tableIds[tableKey];

        if (tableId) {
          const records = await window.LarkAPI.getRecords(tableId, `CurrentValue.[user_id]="${this.userId}"`);

          if (records.length > 0) {
            const fields = records[0].fields;
            // Lark Baseのフィールドをローカル形式に変換
            const localData = this.convertFromLarkFields(workType, fields);
            const localKey = `selfUnderstanding_${workType}`;
            localStorage.setItem(localKey, JSON.stringify(localData));
            restoreCount++;
            console.log(`Restored ${workType} from Lark Base`);
          }
        }
      } catch (error) {
        console.error(`Failed to restore ${workType}:`, error);
      }
    }

    if (restoreCount > 0) {
      this.showSyncNotification('success', `${restoreCount}件のデータをクラウドから復元しました`);
    }
    return restoreCount;
  },

  /**
   * Lark Baseフィールドをローカル形式に変換
   */
  convertFromLarkFields(workType, fields) {
    const data = {};

    switch (workType) {
      case 'personality':
        data.type = fields.type || '';
        data.scores = {
          usagi: fields.usagi_score || 0,
          kame: fields.kame_score || 0,
          kirigirisu: fields.kirigirisu_score || 0,
          ari: fields.ari_score || 0
        };
        data.resultType = fields.type || '';
        try {
          data.answers = fields.answers_json ? JSON.parse(fields.answers_json) : {};
        } catch (e) {
          data.answers = {};
        }
        break;

      case 'values':
        data.q1 = fields.q1_satisfied || '';
        data.q2 = fields.q2_angry || '';
        data.q3 = fields.q3_quit_job || '';
        try { data.q4 = fields.q4_memories_json ? JSON.parse(fields.q4_memories_json) : []; } catch (e) { data.q4 = []; }
        data.q6 = fields.q6_respect || '';
        try { data.q7 = fields.q7_feedback_json ? JSON.parse(fields.q7_feedback_json) : []; } catch (e) { data.q7 = []; }
        try { data.q8 = fields.q8_selected_values ? JSON.parse(fields.q8_selected_values) : []; } catch (e) { data.q8 = []; }
        try { data.q9 = fields.q9_categories ? JSON.parse(fields.q9_categories) : {}; } catch (e) { data.q9 = {}; }
        try { data.q10 = fields.q10_priority ? JSON.parse(fields.q10_priority) : []; } catch (e) { data.q10 = []; }
        data.summary = fields.summary || '';
        break;

      case 'talent':
        data.q1 = fields.q1_thanked || '';
        data.q2 = fields.q2_surprised || '';
        data.q3 = fields.q3_cant_help || '';
        data.q4 = fields.q4_absorbed || '';
        data.q5 = fields.q5_not_aware || '';
        try { data.q6 = fields.q6_feedback_json ? JSON.parse(fields.q6_feedback_json) : []; } catch (e) { data.q6 = []; }
        try { data.q7 = fields.q7_selected_talents ? JSON.parse(fields.q7_selected_talents) : []; } catch (e) { data.q7 = []; }
        try { data.q8 = fields.q8_priority ? JSON.parse(fields.q8_priority) : []; } catch (e) { data.q8 = []; }
        data.q9 = fields.q9_summary || '';
        break;

      case 'passion':
        data.q1 = fields.q1_youtube || '';
        data.q2 = fields.q2_talk || '';
        data.q3 = fields.q3_free || '';
        data.q4 = fields.q4_curious || '';
        data.q5 = fields.q5_told || '';
        data.q6 = fields.q6_searched || '';
        data.q7 = fields.q7_uninstructed || '';
        data.q8 = fields.q8_most_curious || '';
        data.q9 = fields.q9_episodes || '';
        data.q10 = fields.q10_common || '';
        data.q11 = fields.q11_keywords || '';
        data.q12 = fields.q12_state || '';
        data.q13 = fields.q13_daily_change || '';
        data.q14 = fields.q14_shape || '';
        data['passion-manual'] = fields.passion_manual || '';
        break;

      case 'mission':
        try { data.valley1 = fields.valley1_json ? JSON.parse(fields.valley1_json) : {}; } catch (e) { data.valley1 = {}; }
        try { data.valley2 = fields.valley2_json ? JSON.parse(fields.valley2_json) : {}; } catch (e) { data.valley2 = {}; }
        try { data.valley3 = fields.valley3_json ? JSON.parse(fields.valley3_json) : {}; } catch (e) { data.valley3 = {}; }
        data.valleySummary = fields.valley_summary || '';
        try { data.mountain1 = fields.mountain1_json ? JSON.parse(fields.mountain1_json) : {}; } catch (e) { data.mountain1 = {}; }
        try { data.mountain2 = fields.mountain2_json ? JSON.parse(fields.mountain2_json) : {}; } catch (e) { data.mountain2 = {}; }
        try { data.mountain3 = fields.mountain3_json ? JSON.parse(fields.mountain3_json) : {}; } catch (e) { data.mountain3 = {}; }
        data.mountainSummary = fields.mountain_summary || '';
        data.coreWords = fields.core_words || '';
        data.verbalize = fields.verbalize || '';
        data.lifePurpose = fields.life_purpose || '';
        data.lifeMission = fields.life_mission || '';
        data.lifeCompass = fields.life_compass || '';
        break;

      default:
        // そのまま返す
        return fields;
    }

    data.timestamp = fields.updated_at ? new Date(fields.updated_at).toISOString() : new Date().toISOString();
    return data;
  },

  /**
   * ログイン後の自動同期
   * - Lark Baseに既存データがあれば復元
   * - ローカルにデータがあればアップロード
   */
  async syncOnLogin() {
    if (!window.LarkAPI || !window.LARK_CONFIG) {
      console.error('Lark API not initialized');
      return;
    }

    console.log('Starting post-login sync for user:', this.userId);

    // まずクラウドからデータを復元
    const restoredCount = await this.restoreFromLarkBase();

    if (restoredCount === 0) {
      // クラウドにデータがない場合、ローカルデータをアップロード
      const localWorkTypes = ['personality', 'values', 'talent', 'passion', 'mission', 'life-manual'];
      let hasLocalData = false;

      for (const workType of localWorkTypes) {
        const localKey = `selfUnderstanding_${workType}`;
        if (localStorage.getItem(localKey)) {
          hasLocalData = true;
          break;
        }
      }

      if (hasLocalData) {
        this.showSyncNotification('info', 'ローカルデータをクラウドに同期中...');
        await this.syncAllToLarkBase();
      } else {
        this.showSyncNotification('info', 'ようこそ！ワークを始めましょう');
      }
    }

    return restoredCount;
  }
};

// CSSアニメーションを追加
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// グローバルに公開
window.DataSync = DataSync;

// 自動初期化
document.addEventListener('DOMContentLoaded', () => {
  DataSync.init();
});
