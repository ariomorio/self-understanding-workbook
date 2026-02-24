/**
 * Lark Base API連携モジュール
 * 自己理解ワークのデータをLark Baseに保存・取得
 */

const LarkAPI = {
  // 設定（実際の値は環境変数から取得）
  config: {
    appId: '',
    appSecret: '',
    baseUrl: 'https://open.larksuite.com/open-apis',
    proxyUrl: '/api/lark/proxy', // catch-all route経由のプロキシ
    useProxy: true, // プロキシを使用するか
    appToken: '', // Lark Base App Token
    tableIds: {
      users: '',
      personality: '',
      values: '',
      talent: '',
      passion: '',
      mission: '',
      lifeManual: ''
    }
  },

  // アクセストークン（プロキシ使用時は不要）
  accessToken: null,
  tokenExpiry: null,

  /**
   * 初期化
   */
  async init(config) {
    this.config = { ...this.config, ...config };
    // プロキシ使用時はトークン取得不要
    if (!this.config.useProxy) {
      await this.getAccessToken();
    }
    console.log('LarkAPI initialized', this.config.useProxy ? '(proxy mode)' : '(direct mode)');
  },

  /**
   * APIエンドポイントURLを構築
   * @param {string} apiPath - Lark APIパス (例: /bitable/v1/apps/.../records)
   * @param {object} extraParams - 追加のクエリパラメータ (例: { filter: '...' })
   */
  getApiUrl(apiPath, extraParams) {
    if (this.config.useProxy) {
      var params = new URLSearchParams({ lark_path: apiPath });
      if (extraParams) {
        Object.keys(extraParams).forEach(function(key) {
          params.append(key, extraParams[key]);
        });
      }
      return this.config.proxyUrl + '?' + params.toString();
    }
    var url = this.config.baseUrl + apiPath;
    if (extraParams) {
      var qs = new URLSearchParams(extraParams).toString();
      if (qs) url += '?' + qs;
    }
    return url;
  },

  /**
   * アクセストークンを取得（直接接続時のみ）
   */
  async getAccessToken() {
    if (this.config.useProxy) {
      return null; // プロキシがトークンを管理
    }

    if (this.accessToken && this.tokenExpiry > Date.now()) {
      return this.accessToken;
    }

    try {
      const response = await fetch(this.config.baseUrl + '/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: this.config.appId,
          app_secret: this.config.appSecret
        })
      });

      const data = await response.json();
      if (data.code === 0) {
        this.accessToken = data.tenant_access_token;
        this.tokenExpiry = Date.now() + (data.expire - 60) * 1000;
        return this.accessToken;
      }
      throw new Error(data.msg);
    } catch (error) {
      console.error('Failed to get access token:', error);
      throw error;
    }
  },

  /**
   * Lark Base にレコードを追加
   */
  async createRecord(tableId, fields) {
    const apiPath = '/bitable/v1/apps/' + this.config.appToken + '/tables/' + tableId + '/records';
    const url = this.getApiUrl(apiPath);

    const headers = { 'Content-Type': 'application/json' };
    if (!this.config.useProxy) {
      const token = await this.getAccessToken();
      headers['Authorization'] = 'Bearer ' + token;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ fields: fields })
      });

      const data = await response.json();
      if (data.code === 0) {
        return data.data.record;
      }
      throw new Error(data.msg || 'createRecord failed: ' + JSON.stringify(data));
    } catch (error) {
      console.error('Failed to create record:', error);
      throw error;
    }
  },

  /**
   * Lark Base のレコードを更新
   */
  async updateRecord(tableId, recordId, fields) {
    const apiPath = '/bitable/v1/apps/' + this.config.appToken + '/tables/' + tableId + '/records/' + recordId;
    const url = this.getApiUrl(apiPath);

    const headers = { 'Content-Type': 'application/json' };
    if (!this.config.useProxy) {
      const token = await this.getAccessToken();
      headers['Authorization'] = 'Bearer ' + token;
    }

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify({ fields: fields })
      });

      const data = await response.json();
      if (data.code === 0) {
        return data.data.record;
      }
      throw new Error(data.msg || 'updateRecord failed: ' + JSON.stringify(data));
    } catch (error) {
      console.error('Failed to update record:', error);
      throw error;
    }
  },

  /**
   * Lark Base からレコードを取得
   */
  async getRecords(tableId, filter) {
    const apiPath = '/bitable/v1/apps/' + this.config.appToken + '/tables/' + tableId + '/records';
    var extra = {};
    if (filter) {
      extra.filter = filter;
    }
    const url = this.getApiUrl(apiPath, extra);

    const headers = { 'Content-Type': 'application/json' };
    if (!this.config.useProxy) {
      const token = await this.getAccessToken();
      headers['Authorization'] = 'Bearer ' + token;
    }

    try {
      const response = await fetch(url, { headers: headers });

      const data = await response.json();
      if (data.code === 0) {
        return data.data.items || [];
      }
      throw new Error(data.msg || 'getRecords failed: ' + JSON.stringify(data));
    } catch (error) {
      console.error('Failed to get records:', error);
      throw error;
    }
  },

  /**
   * ユーザーデータを保存
   */
  async saveUserData(userId, workType, data) {
    const tableId = this.config.tableIds[workType];
    if (!tableId) {
      throw new Error('Unknown work type: ' + workType);
    }

    const fields = {
      user_id: userId,
      data: JSON.stringify(data),
      updated_at: new Date().toISOString()
    };

    // 既存レコードをチェック
    const existing = await this.getRecords(tableId, 'user_id="' + userId + '"');
    if (existing.length > 0) {
      return await this.updateRecord(tableId, existing[0].record_id, fields);
    }

    return await this.createRecord(tableId, fields);
  },

  /**
   * ユーザーデータを取得
   */
  async getUserData(userId, workType) {
    const tableId = this.config.tableIds[workType];
    if (!tableId) {
      throw new Error('Unknown work type: ' + workType);
    }

    const records = await this.getRecords(tableId, 'user_id="' + userId + '"');
    if (records.length > 0) {
      const data = records[0].fields.data;
      return typeof data === 'string' ? JSON.parse(data) : data;
    }
    return null;
  },

  /**
   * ローカルストレージとLark Baseを同期
   */
  async syncWithLarkBase(userId) {
    const workTypes = ['personality', 'values', 'talent', 'passion', 'mission', 'lifeManual'];

    for (const workType of workTypes) {
      const localKey = 'selfUnderstanding_' + workType.replace(/([A-Z])/g, '-$1').toLowerCase();
      const localData = localStorage.getItem(localKey);

      if (localData) {
        try {
          await this.saveUserData(userId, workType, JSON.parse(localData));
          console.log('Synced ' + workType + ' to Lark Base');
        } catch (error) {
          console.error('Failed to sync ' + workType + ':', error);
        }
      }
    }
  },

  /**
   * Lark Baseからローカルストレージに復元
   */
  async restoreFromLarkBase(userId) {
    const workTypes = ['personality', 'values', 'talent', 'passion', 'mission', 'lifeManual'];

    for (const workType of workTypes) {
      try {
        const data = await this.getUserData(userId, workType);
        if (data) {
          const localKey = 'selfUnderstanding_' + workType.replace(/([A-Z])/g, '-$1').toLowerCase();
          localStorage.setItem(localKey, JSON.stringify(data));
          console.log('Restored ' + workType + ' from Lark Base');
        }
      } catch (error) {
        console.error('Failed to restore ' + workType + ':', error);
      }
    }
  }
};

// グローバルに公開
window.LarkAPI = LarkAPI;
