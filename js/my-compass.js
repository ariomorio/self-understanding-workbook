/**
 * マイコンパス - 人生説明書ビューアー
 */
(function() {
  'use strict';

  // ── ページ構成定義（PDFと同じ8ページ） ──
  const PAGE_CONFIG = [
    { type: 'cover' },
    { items: [
      { num: 1, title: 'わたしの特徴・性格', key: 'item1' },
      { num: 2, title: 'わたしの強み・才能（〇〇する力）', key: 'item2' }
    ]},
    { items: [
      { num: 3, title: '課題・つまずきポイント', key: 'item3' },
      { num: 4, title: 'やる気がなくなるトリガー＆復活スイッチ', key: 'item4' }
    ]},
    { items: [
      { num: 5, title: '大切にしたい価値観 TOP5', key: 'item5' },
      { num: 6, title: '情熱を感じるテーマ・分野', key: 'item6' }
    ]},
    { items: [
      { num: 7, title: '自分に合う働き方・環境', key: 'item7' },
      { num: 8, title: '目指したい"生き方"', key: 'item8' }
    ]},
    { items: [
      { num: 9, title: '発信テーマにするなら？', key: 'item9' },
      { num: 10, title: '誰に届けたい？', key: 'item10' }
    ]},
    { items: [
      { num: 11, title: '理想のフォロワーの悩み', key: 'item11' },
      { num: 12, title: '届けられる価値・変化', key: 'item12' }
    ]},
    { type: 'last', items: [
      { num: 13, title: '商品・サービスにするなら？', key: 'item13' }
    ]}
  ];

  const CIRCLED_NUMS = ['', '\u2460', '\u2461', '\u2462', '\u2463', '\u2464', '\u2465', '\u2466', '\u2467', '\u2468', '\u2469', '\u246A', '\u246B', '\u246C'];
  const FOOTER_TEXT = '\u30DE\u30A4\u30B3\u30F3\u30D1\u30B9\u3000-\u8FF7\u308F\u306A\u3044\u81EA\u5206\u306E\u4F5C\u308A\u65B9-';

  let currentPage = 0;
  let totalPages = PAGE_CONFIG.length;
  let manualData = null;
  let userName = '';

  // ── 初期化 ──
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    // ログインチェック
    const larkUser = localStorage.getItem('selfUnderstanding_larkUser');
    if (!larkUser) {
      window.location.href = '../index.html?msg=login_required';
      return;
    }

    const user = JSON.parse(larkUser);
    userName = user.name || localStorage.getItem('selfUnderstanding_userName') || '';

    // データチェック
    const raw = localStorage.getItem('selfUnderstanding_life-manual');
    if (!raw) {
      showNoData();
      return;
    }

    manualData = JSON.parse(raw);
    // finalManualが空なら未完成扱い
    if (!manualData.finalManual || !manualData.finalManual.trim()) {
      showNoData();
      return;
    }

    renderViewer();
  }

  // ── データなし画面 ──
  function showNoData() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('noDataState').style.display = 'flex';
  }

  // ── ビューアー描画 ──
  function renderViewer() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('compassViewer').style.display = 'flex';

    const pagesContainer = document.getElementById('compassPages');
    pagesContainer.innerHTML = '';

    PAGE_CONFIG.forEach((config, idx) => {
      const pageEl = document.createElement('div');
      pageEl.className = 'compass-page';
      pageEl.innerHTML = '<div class="compass-page-inner">' + buildPageContent(config, idx) + '</div>';
      pagesContainer.appendChild(pageEl);
    });

    // ドット生成
    const dotsContainer = document.getElementById('compassDots');
    dotsContainer.innerHTML = '';
    for (let i = 0; i < totalPages; i++) {
      const dot = document.createElement('div');
      dot.className = 'compass-dot' + (i === 0 ? ' active' : '');
      dot.addEventListener('click', () => goToPage(i));
      dotsContainer.appendChild(dot);
    }

    // イベント
    setupSwipe();
    document.getElementById('prevBtn').addEventListener('click', () => goToPage(currentPage - 1));
    document.getElementById('nextBtn').addEventListener('click', () => goToPage(currentPage + 1));
    document.getElementById('downloadBtn').addEventListener('click', downloadCurrentPage);

    updateNav();
  }

  // ── ページ内容生成 ──
  function buildPageContent(config, pageIndex) {
    if (config.type === 'cover') return buildCover();

    let html = '<div class="compass-content">';

    if (config.items) {
      config.items.forEach(item => {
        const text = manualData[item.key] || '';
        html += '<div class="compass-section">' +
          '<div class="compass-section-header">' + CIRCLED_NUMS[item.num] + ' ' + item.title + '</div>' +
          '<div class="compass-section-body">' + escHtml(text) + '</div>' +
          '</div>';
      });
    }

    // 最終ページ: finalManualカード
    if (config.type === 'last') {
      const fm = manualData.finalManual || '';
      html += '<div class="compass-final-card">' +
        '<div class="compass-final-label">YOUとは</div>' +
        '<div class="compass-final-text">' + escHtml(fm) + '</div>' +
        '</div>';
    }

    html += '</div>';
    html += '<div class="compass-page-footer">' + FOOTER_TEXT + '</div>';
    return html;
  }

  function buildCover() {
    const mascotSrc = '../assets/images/mascot-monkey.png';
    return '<div class="compass-cover">' +
      '<div class="compass-cover-title">' +
        '<span class="name-line">' + escHtml(userName) + '</span>' +
        '<span class="name-suffix">\u3055\u3093</span>' +
      '</div>' +
      '<p class="compass-cover-subtitle">\u4EBA\u751F\u8AAC\u660E\u66F8</p>' +
      '<div class="compass-cover-divider"></div>' +
      '<div class="compass-cover-intro">' +
        '\u3053\u306E\u300C\u308F\u305F\u3057\u306E\u4EBA\u751F\u306E\u8AAC\u660E\u66F8\u300D\u306F<br>' +
        '\u3042\u306A\u305F\u306E\u4EBA\u751F\u306E\u9078\u629E\u306B\u8FF7\u3063\u305F\u3068\u304D<br><br>' +
        '\u81EA\u5206\u3092\u4FE1\u3058\u3066\u9032\u3080\u305F\u3081\u306E<br>' +
        '"\u5FC3\u306E\u30B3\u30F3\u30D1\u30B9"\u306B\u306A\u308A\u307E\u3059<br><br>' +
        '\u5B9A\u671F\u7684\u306B\u898B\u8FD4\u3059\u3053\u3068\u3067<br>' +
        '"\u6210\u9577\u3057\u305F\u81EA\u5206"\u3068\u3082\u518D\u4F1A\u3067\u304D\u307E\u3059' +
      '</div>' +
      '<div class="compass-cover-mascot">' +
        '<img src="' + mascotSrc + '" alt="\u30DE\u30A4\u30B3\u30F3\u30D1\u30B9" onerror="this.parentElement.innerHTML=\'\\ud83d\\udcdd\\ud83d\\udc35\'">' +
      '</div>' +
      '<div class="compass-cover-logo">' + FOOTER_TEXT + '</div>' +
    '</div>';
  }

  // ── ナビゲーション ──
  function goToPage(idx) {
    if (idx < 0 || idx >= totalPages) return;
    currentPage = idx;
    document.getElementById('compassPages').style.transform = 'translateX(-' + (idx * 100) + '%)';
    updateNav();
  }

  function updateNav() {
    document.getElementById('prevBtn').disabled = currentPage === 0;
    document.getElementById('nextBtn').disabled = currentPage === totalPages - 1;
    document.getElementById('pageIndicator').textContent = (currentPage + 1) + ' / ' + totalPages;

    document.querySelectorAll('.compass-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === currentPage);
    });
  }

  // ── スワイプ ──
  function setupSwipe() {
    const wrap = document.querySelector('.compass-pages-wrap');
    let startX = 0, startY = 0, isDragging = false;

    wrap.addEventListener('touchstart', function(e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true;
    }, { passive: true });

    wrap.addEventListener('touchend', function(e) {
      if (!isDragging) return;
      isDragging = false;
      const dx = startX - e.changedTouches[0].clientX;
      const dy = startY - e.changedTouches[0].clientY;
      // 水平方向が優勢で50px以上スワイプ
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx > 0) goToPage(currentPage + 1);
        else goToPage(currentPage - 1);
      }
    }, { passive: true });
  }

  // ── ダウンロード ──
  async function downloadCurrentPage() {
    if (typeof html2canvas === 'undefined') {
      alert('\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u6A5F\u80FD\u3092\u8AAD\u307F\u8FBC\u307F\u4E2D\u3067\u3059\u3002\u5C11\u3057\u304A\u5F85\u3061\u304F\u3060\u3055\u3044\u3002');
      return;
    }

    const btn = document.getElementById('downloadBtn');
    btn.classList.add('downloading');
    showDlOverlay(true);

    try {
      const srcPage = document.querySelectorAll('.compass-page')[currentPage];
      const srcInner = srcPage.querySelector('.compass-page-inner');

      // 壁紙サイズ用クローン
      const renderArea = document.createElement('div');
      renderArea.className = 'compass-wallpaper-render';
      const clone = srcInner.cloneNode(true);
      renderArea.appendChild(clone);
      document.body.appendChild(renderArea);

      const canvas = await html2canvas(clone, {
        width: 1080,
        height: 1920,
        scale: 1,
        useCORS: true,
        backgroundColor: '#fffdf5'
      });

      document.body.removeChild(renderArea);

      const link = document.createElement('a');
      link.download = '\u4EBA\u751F\u8AAC\u660E\u66F8_\u30DA\u30FC\u30B8' + (currentPage + 1) + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Download failed:', e);
      alert('\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u306B\u5931\u6557\u3057\u307E\u3057\u305F');
    } finally {
      btn.classList.remove('downloading');
      showDlOverlay(false);
    }
  }

  function showDlOverlay(show) {
    let overlay = document.getElementById('dlOverlay');
    if (show) {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'dlOverlay';
        overlay.className = 'compass-dl-overlay';
        overlay.innerHTML = '<div><div class="compass-dl-spinner"></div><p>\u58C1\u7D19\u3092\u751F\u6210\u4E2D...</p></div>';
        document.body.appendChild(overlay);
      }
      overlay.style.display = 'flex';
    } else if (overlay) {
      overlay.style.display = 'none';
    }
  }

  // ── ユーティリティ ──
  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  }

})();


// ── 全ワーク一括PDFダウンロード（グローバル関数） ──
async function downloadAllPDF() {
  var progressEl = document.getElementById('downloadProgress');
  var progressBar = document.getElementById('downloadProgressBar');
  var progressText = document.getElementById('downloadProgressText');
  progressEl.style.display = 'block';
  progressBar.style.width = '0%';
  progressText.textContent = 'PDF生成を準備中...';

  // jsPDF がまだ読み込まれていない場合は動的に読み込む
  if (typeof jspdf === 'undefined') {
    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
    document.head.appendChild(script);
    await new Promise(function(resolve, reject) {
      script.onload = resolve;
      script.onerror = function() { reject(new Error('jsPDF の読み込みに失敗しました')); };
    });
  }

  var pageWidth = 210;
  var pageHeight = 297;
  var margin = 15;
  var contentWidth = pageWidth - margin * 2;
  var y = margin;

  // ワーク定義
  var WORK_KEYS = [
    { key: 'selfUnderstanding_personality', title: '性格診断', emoji: '🐰' },
    { key: 'selfUnderstanding_values',      title: '価値観ワーク', emoji: '❤️' },
    { key: 'selfUnderstanding_talent',      title: '才能ワーク', emoji: '🌟' },
    { key: 'selfUnderstanding_passion',     title: '情熱ワーク', emoji: '🔥' },
    { key: 'selfUnderstanding_mission',     title: '使命ワーク', emoji: '🧭' },
    { key: 'selfUnderstanding_become',      title: 'なりたい自分ワーク', emoji: '🫶' },
    { key: 'selfUnderstanding_life-manual', title: '人生の説明書', emoji: '🌱' }
  ];

  var totalSteps = WORK_KEYS.length;
  var userName = localStorage.getItem('selfUnderstanding_userName') || '';

  try {
    var pdf = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // ── 表紙ページ ──
    pdf.setFontSize(26);
    pdf.setTextColor(93, 78, 55);
    pdf.text('マイコンパス', pageWidth / 2, 80, { align: 'center' });
    pdf.setFontSize(13);
    pdf.setTextColor(140, 123, 107);
    pdf.text('ー迷わない自分の作り方ー', pageWidth / 2, 92, { align: 'center' });

    if (userName) {
      pdf.setFontSize(14);
      pdf.setTextColor(93, 78, 55);
      pdf.text(userName + ' さん', pageWidth / 2, 118, { align: 'center' });
    }

    pdf.setFontSize(12);
    pdf.setTextColor(140, 123, 107);
    pdf.text('自己理解ワーク 全記録', pageWidth / 2, 132, { align: 'center' });

    var dateStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    pdf.setFontSize(10);
    pdf.text('出力日: ' + dateStr, pageWidth / 2, 148, { align: 'center' });

    // 表紙のセパレーター線
    pdf.setDrawColor(200, 180, 140);
    pdf.setLineWidth(0.5);
    pdf.line(margin + 20, 104, pageWidth - margin - 20, 104);

    // ── 各ワークページ ──
    for (var wi = 0; wi < WORK_KEYS.length; wi++) {
      var work = WORK_KEYS[wi];
      var pct = Math.round(((wi + 1) / totalSteps) * 100);
      progressBar.style.width = pct + '%';
      progressText.textContent = work.title + ' を処理中... (' + (wi + 1) + '/' + totalSteps + ')';

      // データ取得
      var raw = localStorage.getItem(work.key);
      if (!raw) continue;

      var data;
      try { data = JSON.parse(raw); } catch (e) { continue; }

      // 新規ページ
      pdf.addPage();
      y = margin;

      // セクションタイトル
      pdf.setFontSize(16);
      pdf.setTextColor(93, 78, 55);
      pdf.text(work.title, margin, y + 8);
      y += 16;

      // アクセント線
      pdf.setDrawColor(255, 200, 100);
      pdf.setLineWidth(1.5);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 8;

      // コンテンツ出力
      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);

      // 性格診断は特別処理
      if (work.key === 'selfUnderstanding_personality') {
        if (data.resultType) {
          pdf.setFontSize(13);
          pdf.setTextColor(200, 130, 30);
          pdf.text('タイプ: ' + data.resultType, margin, y + 6);
          y += 14;
          pdf.setFontSize(10);
          pdf.setTextColor(60, 60, 60);
        }
        if (data.scores) {
          var scoreItems = [
            { label: 'うさぎ（短期集中型）', val: data.scores.usagi || 0 },
            { label: 'かめ（長期分散型）',   val: data.scores.kame || 0 },
            { label: 'キリギリス（快楽追求型）', val: data.scores.kirigirisu || 0 },
            { label: 'アリ（リスク回避型）', val: data.scores.ari || 0 }
          ];
          scoreItems.forEach(function(s) {
            pdf.setTextColor(93, 78, 55);
            pdf.text(s.label + ':', margin, y + 4);
            pdf.setTextColor(60, 60, 60);
            pdf.text(String(s.val) + '/25', margin + 80, y + 4);
            y += 8;
          });
        }
        continue;
      }

      // 汎用処理: データのキーを順番に出力
      var keys = Object.keys(data).filter(function(k) {
        // 除外キー
        if (k === 'timestamp' || k === 'updated_at' || k === 'user_id') return false;
        if (k.startsWith('images_') || k.startsWith('imageTokens_')) return false;
        return true;
      });

      keys.forEach(function(key) {
        var val = data[key];

        // 空値スキップ
        if (val === null || val === undefined || val === '' || val === '[]' || val === '{}') return;

        // 配列・オブジェクトは文字列化
        if (typeof val === 'object') {
          try {
            // 配列の場合は箇条書き風に
            if (Array.isArray(val)) {
              var filtered = val.filter(function(v) { return v && String(v).trim(); });
              if (filtered.length === 0) return;
              val = filtered.map(function(v, i) { return (i + 1) + '. ' + String(v); }).join('\n');
            } else {
              val = JSON.stringify(val, null, 1);
            }
          } catch (e) { val = String(val); }
        }
        val = String(val).trim();
        if (!val) return;

        // 長すぎる値はカット
        if (val.length > 600) val = val.substring(0, 600) + '...';

        // ラベル（キー名を読みやすく変換）
        var labelMap = {
          q1: 'Q1', q2: 'Q2', q3: 'Q3', q4: 'Q4', q5: 'Q5',
          q6: 'Q6', q7: 'Q7', q8: 'Q8', q9: 'Q9', q10: 'Q10',
          q11: 'Q11', q12: 'Q12', q13: 'Q13', q14: 'Q14',
          summary: 'まとめ', finalManual: '最終版: 人生の説明書',
          resultType: 'タイプ', scores: 'スコア',
          valley_summary: '谷のまとめ', mountain_summary: '山のまとめ',
          core_words: 'コアワード', verbalize: '言語化',
          life_purpose: '人生の目的', life_mission: '人生の使命',
          life_compass: '人生のコンパス',
          text_5year: '5年後', reason_5year: '5年後の理由',
          text_3year: '3年後', reason_3year: '3年後の理由',
          text_1year: '1年後', reason_1year: '1年後の理由',
          text_half: '半年後', reason_half: '半年後の理由'
        };
        var labelText = labelMap[key] || key.replace(/_/g, ' ');

        // ページ溢れチェック
        if (y > pageHeight - margin - 15) {
          pdf.addPage();
          y = margin;
          // 継続ヘッダー
          pdf.setFontSize(11);
          pdf.setTextColor(140, 123, 107);
          pdf.text(work.title + '（続き）', margin, y + 5);
          y += 12;
          pdf.setDrawColor(220, 200, 160);
          pdf.setLineWidth(0.5);
          pdf.line(margin, y, pageWidth - margin, y);
          y += 6;
          pdf.setFontSize(10);
          pdf.setTextColor(60, 60, 60);
        }

        // ラベル出力
        pdf.setFontSize(8.5);
        pdf.setTextColor(140, 123, 107);
        pdf.text(labelText, margin, y + 4);
        y += 7;

        // 値出力（複数行対応）
        pdf.setFontSize(10);
        pdf.setTextColor(50, 50, 50);
        var lines = pdf.splitTextToSize(val, contentWidth);
        lines.forEach(function(line) {
          if (y > pageHeight - margin - 10) {
            pdf.addPage();
            y = margin;
            pdf.setFontSize(11);
            pdf.setTextColor(140, 123, 107);
            pdf.text(work.title + '（続き）', margin, y + 5);
            y += 12;
            pdf.setDrawColor(220, 200, 160);
            pdf.setLineWidth(0.5);
            pdf.line(margin, y, pageWidth - margin, y);
            y += 6;
            pdf.setFontSize(10);
            pdf.setTextColor(50, 50, 50);
          }
          pdf.text(line, margin + 3, y + 4);
          y += 5.5;
        });

        y += 4; // アイテム間スペース
      });
    }

    // 保存
    progressBar.style.width = '100%';
    progressText.textContent = 'ダウンロード中...';

    var fileName = 'マイコンパス_全ワーク';
    if (userName) fileName += '_' + userName;
    fileName += '.pdf';
    pdf.save(fileName);

    progressText.textContent = 'ダウンロード完了！';
    setTimeout(function() {
      progressEl.style.display = 'none';
    }, 2500);

  } catch (err) {
    console.error('全ワークPDF生成エラー:', err);
    progressEl.style.display = 'none';
    alert('PDFの生成に失敗しました。\n' + err.message);
  }
}
