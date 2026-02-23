/**
 * コーチ認証モジュール
 * localStorage でコーチのセッションを管理し、API で認証を検証する
 */

const AdminAuth = {
  STORAGE_KEY: 'selfUnderstanding_coachUser',

  /** コーチ情報を取得 */
  getCoach() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  },

  /** コーチ情報を保存 */
  setCoach(data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },

  /** ログアウト */
  logout() {
    localStorage.removeItem(this.STORAGE_KEY);
    window.location.href = 'admin-login.html';
  },

  /**
   * サーバー側でコーチ権限を検証
   * @returns {Promise<{valid: boolean, name?: string, email?: string}>}
   */
  async verify() {
    const coach = this.getCoach();
    if (!coach || !coach.userId) return { valid: false };

    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: coach.userId })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Coach verify failed:', error);
      return { valid: false };
    }
  },

  /**
   * コーチ認証を必須にする（ページ読み込み時に呼び出す）
   * 認証が無効ならログインページへリダイレクト
   */
  async requireAuth() {
    const coach = this.getCoach();
    if (!coach) {
      window.location.href = 'admin-login.html';
      return null;
    }

    const result = await this.verify();
    if (!result.valid) {
      localStorage.removeItem(this.STORAGE_KEY);
      window.location.href = 'admin-login.html';
      return null;
    }

    return coach;
  }
};

window.AdminAuth = AdminAuth;
