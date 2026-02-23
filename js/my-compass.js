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
  const FOOTER_TEXT = '\u30DE\u30A4\u30B3\u30F3\u30D1\u3000-\u8FF7\u308F\u306A\u3044\u81EA\u5206\u306E\u4F5C\u308A\u65B9-';

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
        '<img src="' + mascotSrc + '" alt="\u30DE\u30A4\u30B3\u30F3\u30D1" onerror="this.parentElement.innerHTML=\'\\ud83d\\udcdd\\ud83d\\udc35\'">' +
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
