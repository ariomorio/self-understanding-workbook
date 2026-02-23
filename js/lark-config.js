/**
 * Lark Base設定ファイル
 * マイコンパス
 * 生成日時: 2026-01-28
 */

const LARK_CONFIG = {
  // アプリID（公開情報）
  appId: 'cli_a9f3f7c00538de1b',

  // API設定（プロキシ経由で認証はサーバー側で行う）
  proxyUrl: '/api/lark-proxy',
  useProxy: true,

  // Lark Base App Token
  appToken: 'Hr8xbtPOVaiYpasng71jryL9pfh',

  // Base URL（直接アクセス用）
  baseAppUrl: 'https://qjpf01hvchni.jp.larksuite.com/base/Hr8xbtPOVaiYpasng71jryL9pfh',

  // テーブルID
  tableIds: {
    users: 'tbls6sCjskyHEaHK',
    personality: 'tblCmFcFv7f5uheg',
    values: 'tblfJYASpzI1b3xe',
    talent: 'tblBIqnjhQslDMeU',
    passion: 'tbltiTrYJeRLstQx',
    mission: 'tblI0i66Soy92fTz',
    lifeManual: 'tblHhmjRRyL5Zs2H'
  }
};

// グローバルに公開
window.LARK_CONFIG = LARK_CONFIG;

// 自動初期化
document.addEventListener('DOMContentLoaded', async () => {
  if (window.LarkAPI) {
    try {
      await window.LarkAPI.init(LARK_CONFIG);
      console.log('Lark API initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Lark API:', error);
    }
  }
});
