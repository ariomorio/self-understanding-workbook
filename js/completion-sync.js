/**
 * ページ完了チェック - Lark Base同期版
 * 各ページの「このページを読みました」チェックをLark Baseに同期する
 *
 * 使い方: 各HTMLページで以下を読み込む
 *   <script src="../js/lark-api.js"></script>
 *   <script src="../js/lark-config.js"></script>
 *   <script src="../js/data-sync.js"></script>
 *   <script src="../js/completion-sync.js"></script>
 *
 * ページ側で必要な要素:
 *   - PAGE_KEY 変数（例: 'selfUnderstanding_osaru-ai'）
 *   - id="pageComplete" のチェックボックス
 *   - id="completionCheck" のラベル
 */

(function() {
  'use strict';

  // ページロード後に初期化
  document.addEventListener('DOMContentLoaded', function() {
    // PAGE_KEYからページ名を抽出
    if (typeof PAGE_KEY === 'undefined') return;
    var pageName = PAGE_KEY.replace('selfUnderstanding_', '');

    // Lark Baseから進捗を復元（少し待ってからチェック）
    setTimeout(function() {
      restoreFromCloud(pageName);
    }, 2500);
  });

  // クラウドから復元
  function restoreFromCloud(pageName) {
    if (!window.DataSync || !window.LarkAPI || !window.LARK_CONFIG) return;

    window.DataSync.loadProgressFromLarkBase().then(function(progress) {
      if (progress && progress[pageName]) {
        var localKey = 'selfUnderstanding_' + pageName;
        if (!localStorage.getItem(localKey)) {
          localStorage.setItem(localKey, JSON.stringify({ completed: true, timestamp: new Date().toISOString() }));
          // UIを更新
          if (typeof updateCheckUI === 'function') {
            updateCheckUI();
          }
          console.log('Restored completion for ' + pageName + ' from Lark Base');
        }
      }
    }).catch(function(e) {
      console.error('Failed to restore progress:', e);
    });
  }

  // グローバルのtoggleCompleteを拡張
  var _origToggle = window.toggleComplete;
  window.toggleComplete = function() {
    // 元の処理を呼ぶ（ある場合）
    if (typeof _origToggle === 'function') {
      _origToggle();
    }

    // Lark Baseに同期
    if (typeof PAGE_KEY !== 'undefined' && window.DataSync) {
      var pageName = PAGE_KEY.replace('selfUnderstanding_', '');
      var cb = document.getElementById('pageComplete');
      var checked = cb ? cb.checked : false;
      window.DataSync.savePageCompletion(pageName, checked);
    }
  };
})();
