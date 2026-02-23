/**
 * コーチ管理画面 API クライアント
 * /api/admin/* エンドポイントを呼び出す
 */

const AdminAPI = {
  /**
   * メンバー一覧を取得
   * @param {string} coachId
   * @returns {Promise<{members: Array}>}
   */
  async getMembers(coachId) {
    const response = await fetch(`/api/admin/members?coach_id=${encodeURIComponent(coachId)}`);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'メンバー一覧の取得に失敗しました');
    }
    return response.json();
  },

  /**
   * メンバーのワークデータを取得
   * @param {string} coachId
   * @param {string} memberId
   * @returns {Promise<Object>}
   */
  async getMemberData(coachId, memberId) {
    const response = await fetch(`/api/admin/member-data?coach_id=${encodeURIComponent(coachId)}&member_id=${encodeURIComponent(memberId)}`);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'メンバーデータの取得に失敗しました');
    }
    return response.json();
  },

  /**
   * メンバーを割り当て
   * @param {string} coachId
   * @param {string} memberEmail
   * @returns {Promise<{success: boolean, memberId: string, memberName: string}>}
   */
  async assignMember(coachId, memberEmail) {
    const response = await fetch('/api/admin/assign-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coach_id: coachId, member_email: memberEmail })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'メンバーの追加に失敗しました');
    }
    return response.json();
  }
};

window.AdminAPI = AdminAPI;
