/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 🖥️ 화면 공유 (자체 모자이크) · script_share.js
   ---------------------------------------------------------------------
   ★ 원본 화면은 내 컴퓨터를 벗어나지 않습니다.

   브라우저 화면 캡쳐(getDisplayMedia)로 창을 하나 잡습니다. 그 영상은
   이 컴퓨터 안에서만 흐릅니다. 5초에 한 번, **내 컴퓨터에서 먼저**
   아주 작은 캔버스(가로 80~320px)에 옮겨 그려 글자를 못 읽게 뭉갠 다음,
   그 작은 그림 한 장만 서버로 보냅니다. 원본 해상도의 프레임은 서버로도
   다른 사람에게도 절대 나가지 않습니다. 나가는 것은 언제나 뭉갠 뒤입니다.

   [무엇이 서버에 남는가]
     screens/{닉} = { img: 뭉갠 JPEG dataURL, at: 서버시각, level: 가로 픽셀 }
   한 장이 보통 12~30KB, 상한 40KB. 5초에 한 번이니 한 사람이 공유하는 동안
   시간당 대략 10~25MB 정도가 오갑니다. 낡은 그림은 덮어쓰기라 쌓이지 않고,
   공유를 끄거나 창이 닫히면(onDisconnect) 서버에서 사라집니다.

   [보기 규칙 — 공유 중인 사람끼리만]
   내가 공유 중일 때만 screens 를 구독합니다. 공유를 끄면 구독을 끊고
   화면에서도 치웁니다. 서버 규칙만으로는 "공유하는 사람만 읽기"를 강제할
   수 없어서(읽기는 로그인한 사람 전체에 열려 있습니다) 화면 차원의
   약속으로 둡니다. 대신 쓰기는 자기 닉에만 되도록 규칙으로 막습니다.

   [알려진 한계]
     · 크롬·엣지 같은 PC 브라우저 전용입니다. 휴대폰에서는 화면 캡쳐 자체가
       안 되므로 버튼이 흐려집니다.
     · 공유한 창에 뜨는 알림·팝업도 그대로 찍힙니다. 뭉개져 있긴 하지만
       "무엇이 떴다"는 사실 자체는 보일 수 있어요.
     · 탭을 오래 재우면 브라우저가 타이머를 늦춰 갱신이 느려질 수 있습니다.
   ===================================================================== */
(function () {
  /* 모자이크 강도 — 작은 캔버스의 가로 픽셀 수가 곧 강도입니다.
     가로 80px 이면 화면 전체가 여든 칸으로 뭉개집니다. */
  const SHARE_LEVELS = [
    { name: "약함", w: 320 },
    { name: "보통", w: 160 },
    { name: "강함", w: 80 }
  ];
  /* [고침 2026-08-09 · 4차] 약함을 210 → 320px 로. 나머지 두 단은 절반씩.

     [얼마나 선명해지나]  1920px 화면이 9.1배 → 6.0배 축소로 줄어듭니다.
     창 배치와 색만 보이던 것이, 문단 덩어리와 그림의 윤곽까지 보입니다.

     [그래도 글자는 안 읽힙니다]  글자를 읽으려면 획이 5px 쯤은 남아야
     하는데, 여기서는
         본문 16px  →  2.7px   (획이 사라져 회색 띠로 보입니다)
         큰 제목 32px →  5.3px  (겨우 형태만, 글자로는 잘 안 읽힘)
     본문은 400px 까지 올려도 안 읽히지만, **큰 제목은 400 부터 읽히기
     시작합니다.** 그래서 320 을 상한 근처가 아닌 안전한 자리로 잡았습니다.
     더 올리고 싶어도 400 은 넘기지 마세요 — 검사에서도 막고 있습니다. */
  const SHARE_DEFAULT_LEVEL = 0;          // 기본은 "약함"(320px)

  const SHARE_INTERVAL_MS = 5000;         // 5초에 한 장
  /* 그림이 커지면 상한도 함께 올려야 합니다. 상한을 낮게 두면 대부분의
     프레임이 걸려 통째로 버려지고, 화면이 5초가 아니라 몇십 초에 한 번씩만
     바뀝니다 (뭉개짐보다 이게 더 답답해요).
     320px 이면 한 장이 보통 12~30KB, 5초마다 보내니 한 사람당 시간당
     10~25MB 남짓입니다. */
  const SHARE_MAX_BYTES   = 40 * 1024;    // 한 장 상한 40KB
  const SHARE_QUALITIES   = [0.5, 0.4, 0.3, 0.22];  // 상한을 넘으면 품질을 낮춰 다시
  const SHARE_STALE_MS    = 20 * 1000;    // 20초 넘게 소식이 없으면 "끊김"(흐리게)
  const SHARE_DROP_MS     = 30 * 1000;    // 30초 넘으면 목록에서 뺍니다
  const SHARE_LEVEL_KEY   = "shareLevel";
  const SHARE_NOTICE_KEY  = "shareNoticeSeen";

  /* [고침 2026-08-06] 한 줄로 길게 잇지 않고 짧은 문장 넷으로 나눕니다.
     "알림도 함께 찍힌다"는 문장은 사실과 달라 고쳤습니다 — 크롬의 선택
     창에서 [창] 하나만 고르면 그 창만 잡히고, 위에 겹친 알림·다른 창은
     찍히지 않습니다(운영체제가 그 창만 따로 그려 주기 때문). */
  const SHARE_NOTICE_LINES = [
    "뭉갠 그림만 나가고 원본은 내 컴퓨터를 벗어나지 않아요",
    "5초마다 한 장씩 송출, 끊어져 보일 수 있어요",
    "크롬·엣지 브라우저 사용 시에만 돼요",
    "창 하나만 고르면 그 위에 뜨는 알림은 안 찍혀요"
  ];
  /* 툴팁·알림창처럼 한 줄이 필요한 자리에서 씁니다 */
  const SHARE_NOTICE = SHARE_NOTICE_LINES.join(" · ");
  const SHARE_UNSUPPORTED = "화면 공유는 크롬·엣지 PC에서만 쓸 수 있어요.";

  let _sharing    = false;   // 지금 내가 공유 중인가
  let _stream     = null;    // getDisplayMedia 가 준 영상 줄기
  let _video      = null;    // 숨긴 <video> — 화면에는 보이지 않습니다
  let _canvas     = null;    // 뭉개는 작은 캔버스 (한 장을 계속 재사용)
  let _timer      = null;    // 5초 타이머
  let _agoTimer   = null;    // 끊김 살피는 타이머 (1초)
  let _screensRef = null;    // screens 구독 — 공유 중일 때만 삽니다
  let _screensCache = null;
  let _levelIdx   = SHARE_DEFAULT_LEVEL;
  let _lastShareHtml = null; // 만든 HTML 이 직전과 같으면 DOM 을 안 건드립니다

  function esc(s) {
    return window.escapeHtml ? window.escapeHtml(s) : String(s == null ? "" : s);
  }
  function now() {
    return (typeof window.serverNow === "function") ? window.serverNow() : Date.now();
  }
  function supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  /* 서버에서 온 그림은 그대로 믿지 않습니다.
     우리가 만드는 것과 똑같은 모양(작은 JPEG dataURL)만 화면에 답니다. */
  function sanitizeShot(url) {
    if (typeof url !== "string") return "";
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(url)) return "";
    if (url.length > 200000) return "";
    return url;
  }

  function dataUrlBytes(url) {
    const i = url.indexOf(",");
    return Math.round((url.length - i - 1) * 3 / 4);
  }

  /* ---------------------------------------------------------------
     모자이크 만들기 — 여기서 원본이 사라집니다

     작은 캔버스에 그리는 순간 픽셀이 뭉개지고, 그 캔버스에서 꺼낸
     그림만 밖으로 나갑니다. 크게 보이는 것은 받는 쪽에서 CSS
     image-rendering: pixelated 로 늘려 보여주기 때문입니다.
     --------------------------------------------------------------- */
  function grabMosaic() {
    if (!_video) return null;
    const vw = _video.videoWidth || 0, vh = _video.videoHeight || 0;
    if (!vw || !vh) return null;             // 아직 첫 프레임이 안 왔습니다

    const w = SHARE_LEVELS[_levelIdx].w;
    // 세로는 비율을 지키되 w*0.6 을 넘지 않습니다 (세로로 긴 창 대비)
    const h = Math.max(1, Math.min(Math.round(w * (vh / vw)), Math.round(w * 0.6)));

    const cv = _canvas || (_canvas = document.createElement("canvas"));
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.drawImage(_video, 0, 0, w, h);

    /* 320px 폭 JPEG 0.5 품질이면 보통 12~30KB 입니다. 그림이 복잡해서
       40KB 를 넘으면 품질을 0.4 → 0.3 → 0.22 로 낮춰 다시 만들고,
       그래도 넘으면 이 프레임은 통째로 건너뜁니다. */
    for (const q of SHARE_QUALITIES) {
      const url = cv.toDataURL("image/jpeg", q);
      if (dataUrlBytes(url) <= SHARE_MAX_BYTES) return url;
    }
    return null;
  }

  async function pushFrame() {
    if (!_sharing || !myNick) return;
    const img = grabMosaic();
    if (!img) return;
    try {
      await db.ref("screens/" + myNick).set({
        img,
        at: firebase.database.ServerValue.TIMESTAMP,
        level: SHARE_LEVELS[_levelIdx].w
      });
    } catch (e) {
      console.warn("[화면 공유 — 저장 실패]", e);
    }
  }

  /* ---------------------------------------------------------------
     구독 — 공유 중인 동안에만 삽니다
     --------------------------------------------------------------- */
  function listenScreens() {
    if (_screensRef) return;
    _screensRef = db.ref("screens");
    _screensRef.on("value", snap => {
      _screensCache = snap.val() || null;
      renderShareCards();
    });
  }
  function detachScreens() {
    try { _screensRef && _screensRef.off(); } catch (e) {}
    _screensRef = null;
  }

  /* ---------------------------------------------------------------
     켜기 · 끄기
     --------------------------------------------------------------- */
  /* 창 고르기 판을 띄웁니다. 취소하거나 막히면 null 을 돌려줍니다. */
  async function _pickWindow() {
    try {
      return await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 } });
    } catch (e) {
      return null;
    }
  }

  /* 고른 화면을 숨긴 <video> 에 물립니다.
     이미 물려 있던 것이 있으면 먼저 떼어 냅니다 — 창 바꾸기가 이 함수 하나로
     끝나게 하려고 시작과 바꾸기가 같은 길을 씁니다. */
  function _attachStream(stream) {
    /* 옛 것 정리 — 새 것을 받은 뒤에 하는 이유는, 고르기를 취소했을 때
       지금 나가던 화면이 끊기면 안 되기 때문입니다. */
    try {
      _stream && _stream.getTracks().forEach(t => { t.onended = null; t.stop(); });
    } catch (e) {}
    try { _video && _video.remove(); } catch (e) {}

    _stream = stream;

    /* 숨긴 <video>. 화면 밖에 두되 문서에는 붙여 둡니다
       (문서 밖 video 는 브라우저에 따라 프레임이 멈추기도 합니다) */
    _video = document.createElement("video");
    _video.className = "share-video";
    _video.muted = true;
    _video.autoplay = true;
    _video.playsInline = true;
    _video.srcObject = stream;
    document.body.appendChild(_video);
    _video.play().catch(() => {});

    /* 브라우저가 띄우는 "공유 중지" 막대를 직접 누른 경우에도 정리.
       단, 창을 바꾸느라 방금 우리가 끈 것은 위에서 onended 를 떼어 뒀으므로
       여기 걸리지 않습니다. */
    const track = stream.getVideoTracks()[0];
    if (track) track.onended = () => { stopScreenShare(); };
  }

  /* [2026-08-07] 공유 중에 보여줄 창을 바꿉니다.
     카드 아래 "○○의 화면" 글씨를 누르면 여기로 옵니다.

     끄고 다시 켜도 되지만 그러면 남들 화면에서 내 카드가 잠깐 사라졌다
     다시 생기고, 서버에 지웠다 쓰는 일이 한 번씩 더 붙습니다.
     공유 상태는 그대로 두고 물려 있는 화면만 갈아 끼웁니다. */
  async function switchShareWindow() {
    if (!_sharing) return;
    const stream = await _pickWindow();
    if (!stream) return;      // 취소 — 보던 화면 그대로 계속 나갑니다
    _attachStream(stream);
    pushFrame();              // 바뀐 창을 기다리지 않고 바로 한 장
  }

  async function startScreenShare() {
    if (!supported()) { alert(SHARE_UNSUPPORTED); return; }
    if (!myNick) { alert("먼저 입장한 뒤에 쓸 수 있어요."); return; }
    if (_sharing) return;

    const stream = await _pickWindow();
    if (!stream) return;      // 고르기를 취소했거나 권한이 막혔습니다
    _attachStream(stream);

    _sharing = true;

    /* 창이 그냥 닫혀도 내 그림이 서버에 남지 않게 미리 예약해 둡니다 */
    try { await db.ref("screens/" + myNick).onDisconnect().remove(); } catch (e) {}

    listenScreens();
    _timer    = setInterval(pushFrame, SHARE_INTERVAL_MS);
    _agoTimer = setInterval(tickShare, 1000);
    renderShareButton();
    window.updateStatus?.();           // 남들 버튼에도 "공유 중"이 뜨게
    noticeOnce();
    pushFrame();                       // 첫 장은 기다리지 않고 바로
  }

  async function stopScreenShare() {
    const wasSharing = _sharing;
    _sharing = false;

    if (_timer)    { clearInterval(_timer);    _timer = null; }
    if (_agoTimer) { clearInterval(_agoTimer); _agoTimer = null; }

    try {
      _stream && _stream.getTracks().forEach(t => { t.onended = null; t.stop(); });
    } catch (e) {}
    _stream = null;
    try { _video && _video.remove(); } catch (e) {}
    _video = null;

    detachScreens();
    _screensCache = null;
    _lastShareHtml = null;
    renderShareCards();                // 공유를 끄면 남의 화면도 치웁니다
    renderShareButton();
    if (wasSharing) window.updateStatus?.();   // 남들 버튼에서도 표시를 뗍니다

    if (wasSharing && myNick) {
      try { await db.ref("screens/" + myNick).onDisconnect().cancel(); } catch (e) {}
      try { await db.ref("screens/" + myNick).remove(); } catch (e) {}
    }
  }

  async function toggleScreenShare() {
    if (!supported()) { alert(SHARE_UNSUPPORTED); return; }
    if (_sharing) { await stopScreenShare(); return; }
    await startScreenShare();
  }

  /* 공유를 처음 켜는 사람에게 한 번만 알려 줍니다.
     (그 뒤로는 내 공유 카드 안에 같은 문구가 늘 적혀 있습니다) */
  function noticeOnce() {
    try {
      if (window.AppStore && window.AppStore.getItem(SHARE_NOTICE_KEY)) return;
      window.AppStore && window.AppStore.setItem(SHARE_NOTICE_KEY, "1");
    } catch (e) {}
    alert("🖥️ 화면 공유\n\n" + SHARE_NOTICE);
  }

  /* ---------------------------------------------------------------
     강도 고르기 — 공유 중일 때 내 카드 안에만 나옵니다
     (공유를 안 하면 볼 일이 없는 버튼이라 머리말에 두지 않았습니다)
     --------------------------------------------------------------- */
  function setShareLevel(i) {
    const n = Number(i);
    if (!(n >= 0 && n < SHARE_LEVELS.length)) return;
    _levelIdx = n;
    try { window.AppStore && window.AppStore.setItem(SHARE_LEVEL_KEY, String(n)); } catch (e) {}
    _lastShareHtml = null;
    renderShareCards();
    pushFrame();                       // 바뀐 강도를 바로 보여줍니다
  }

  function loadShareLevel() {
    try {
      const v = Number(window.AppStore && window.AppStore.getItem(SHARE_LEVEL_KEY));
      if (v >= 0 && v < SHARE_LEVELS.length) _levelIdx = v;
    } catch (e) {}
  }

  /* ---------------------------------------------------------------
     머리말 버튼
     --------------------------------------------------------------- */
  function renderShareButton() {
    const btn = document.getElementById("share-btn");
    if (!btn) return;
    const label = btn.querySelector(".icon-btn-label");
    if (!supported()) {
      /* 미지원 브라우저(휴대폰·사파리 등) — 흐리게.
         눌러도 안내만 나옵니다 */
      btn.classList.add("dim");
      btn.style.opacity = ".45";
      btn.title = "화면 공유 — 크롬·엣지 PC 전용";
      if (label) label.textContent = "화면 공유";
      return;
    }
    /* [2026-08-07] 세 가지 모습이 있습니다.
         내가 공유 중        → 꽉 찬 붉은색 (예전 그대로)
         남이 공유 중        → 옅은 붉은색  ← 새로 생긴 것
         아무도 공유 안 함   → 평소 회색
       "지금 볼 게 있다"는 신호가 없으면, 켜 놓고도 아무도 안 보는 일이
       생깁니다. 눌러야 비로소 보이는 기능이라 더 그래요. */
    const others = othersSharing();
    btn.classList.toggle("share-on", _sharing);
    btn.classList.toggle("share-others", !_sharing && others > 0);

    if (label) label.textContent = _sharing ? "공유 중" : "화면 공유";
    btn.title = _sharing
      ? "화면 공유 끄기"
      : (others > 0
          ? `${others}명이 화면을 공유하고 있어요 — 나도 켜면 볼 수 있어요`
          : "내 창 하나를 뭉갠 그림으로 공유합니다 (원본은 나가지 않아요)");
  }

  /* 나 말고 몇 명이 공유 중인가.

     접속자 정보(status)에 각자 적어 보내는 shareOn 만 셉니다 — 그림은
     보지 않아요. 끊긴 사람의 낡은 기록까지 세면 아무도 없는데 버튼이
     붉어지므로, 접속 중인 사람만 셉니다. */
  function othersSharing() {
    const cache = window._statusCache;
    if (!cache) return 0;
    const t = Date.now();
    let n = 0;
    for (const nick in cache) {
      if (nick === myNick) continue;
      const row = cache[nick];
      if (!row || row.shareOn !== true) continue;
      if (typeof window.isOnline === "function" && !window.isOnline(row, t)) continue;
      n++;
    }
    return n;
  }

  /* ---------------------------------------------------------------
     카드 그리기 — 접속자 카드 목록 뒤에 나란히 덧붙입니다

     접속자 카드를 그리는 renderUserCards 는 결과 HTML 이 직전과 같으면
     DOM 을 건드리지 않습니다. 그래서 공유 카드는 그 목록의 자식으로
     "덧붙이고", 카드가 통째로 새로 그려져 사라지면 다시 붙입니다.
     --------------------------------------------------------------- */
  function shareRows() {
    const t = now();
    const rows = [];
    for (const nick in (_screensCache || {})) {
      const r = _screensCache[nick] || {};
      const img = sanitizeShot(r.img);
      if (!img) continue;
      const at = Number(r.at || 0);
      const age = t - at;
      if (age > SHARE_DROP_MS) continue;      // 30초 넘게 소식이 없으면 뺍니다
      rows.push({ nick, img, at, age });
    }
    // 내 카드가 맨 앞 (자기 것 확인용)
    rows.sort((a, b) => (a.nick === myNick ? -1 : 0) - (b.nick === myNick ? -1 : 0));
    return rows;
  }

  /* [2026-08-06] 강도 고르기 버튼은 화면에서 뺐습니다.
     setShareLevel 과 SHARE_LEVELS 는 남겨둡니다 — 콘솔에서 바꿔보거나
     나중에 다시 버튼을 달 때 그대로 쓸 수 있게. */

  /* 카드 HTML 에는 "끊김" 표시를 넣지 않습니다. 시계만 흘러도 달라지므로
     만든 HTML 이 매번 달라져 그림이 새로 붙고(=깜빡이고) 맙니다.
     끊김은 tickShare 가 1초마다 클래스만 고쳐 씁니다. */
  /* [고침 2026-08-06] 카드를 프로필 카드와 같은 크기로 고정합니다.

     화면이 주인공이라, 그림이 카드를 꽉 채우고 아래 한 줄만 남깁니다.
       · 강도 고르기 버튼과 안내 문구는 뺐습니다 (기본 "약함" 고정)
       · 아래 한 줄 = "닉네임의 화면" + [off] 나란히
     그림은 카드 비율에 맞춰 잘라 넣습니다(양옆이 잘려도 괜찮습니다). */
  function shareCardHtml(row) {
    const mine = (row.nick === myNick);
    const off = mine
      ? `<button type="button" class="share-off" data-share-stop="1"
                 title="화면 공유 끄기" aria-label="화면 공유 끄기">off</button>`
      : "";
    return `
      <div class="user-card share-card${mine ? " is-me" : ""}"
           data-share-nick="${esc(row.nick)}" data-share-at="${row.at}"
           title="${esc(SHARE_NOTICE)}">
        <div class="share-shot">
          <img class="share-img" src="${row.img}" alt="${esc(row.nick)} 님이 공유 중인 화면 (모자이크)">
          <span class="share-live">● 공유 중</span>
          <!-- [2026-08-09] 이름 줄을 그림 아래가 아니라 **그림 위**에 얹습니다.
               아래에 두면 그만큼 그림이 짧아지는데, 이 카드의 주인공은
               화면이니까요. 반투명이라 뒤가 비쳐 보입니다. -->
          <div class="share-foot">
            ${mine
              ? `<button type="button" class="share-who is-mine" data-share-switch="1"
                         title="누르면 보여줄 창을 바꿀 수 있어요">${esc(row.nick)}의 화면</button>`
              : `<span class="share-who">${esc(row.nick)}의 화면</span>`}
            ${off}
          </div>
        </div>
      </div>`;
  }

  function renderShareCards() {
    const list = document.getElementById("user-cards");
    if (!list) return;

    const rows = _sharing ? shareRows() : [];
    const html = rows.map(shareCardHtml).join("");
    const present = !!list.querySelector(".share-card");

    /* 만든 HTML 이 직전과 같고 카드도 그대로 붙어 있으면 손대지 않습니다.
       (다시 그리면 <img> 가 새 요소가 되어 그림이 깜빡입니다) */
    if (html === _lastShareHtml && present === !!html) { tickShare(); return; }

    list.querySelectorAll(".share-card").forEach(el => el.remove());

    /* [고침 2026-08-06] 공유 카드를 그 사람의 프로필 카드 바로 뒤에 끼웁니다.
       예전에는 목록 맨 끝에 몰아 붙여서, 누구 화면인지 눈으로 잇기 어려웠어요.
       접속자 목록에 그 사람이 없으면(방금 나갔다든지) 맨 뒤에 붙입니다. */
    rows.forEach(row => {
      const own = Array.from(list.querySelectorAll(".user-card:not(.share-card)"))
        .find(el => el.getAttribute("data-card-nick") === row.nick);
      const one = shareCardHtml(row);
      if (own) own.insertAdjacentHTML("afterend", one);
      else list.insertAdjacentHTML("beforeend", one);
    });
    _lastShareHtml = html;

    tickShare();
  }

  /* 1초마다 끊김만 살핍니다 — 카드를 다시 만들지 않으므로 깜빡이지 않아요.
     20초가 넘으면 흐리게, 30초가 넘으면 카드를 뺍니다.
     ("n초 전" 글자는 뺐습니다 — 화면이 흐려지는 것만으로 충분해서요) */
  function tickShare() {
    const t = now();
    document.querySelectorAll(".share-card").forEach(card => {
      const at = Number(card.getAttribute("data-share-at") || 0);
      const age = t - at;
      if (age > SHARE_DROP_MS) { card.remove(); _lastShareHtml = null; return; }
      card.classList.toggle("is-stale", age > SHARE_STALE_MS);
    });
  }

  /* [뺌 2026-08-06] 크게 보기(라이트박스)는 없앴습니다.
     카드를 누르면 화면이 크게 떠서, 뭉갠 그림이라도 부담스럽다는 얘기가
     있었어요. 이제 공유 화면은 카드 안에서만 보입니다. */

  /* ---------------------------------------------------------------
     카드 안 클릭 — 위임으로 한 번만 답니다
     --------------------------------------------------------------- */
  function bindShareClicks() {
    const list = document.getElementById("user-cards");
    if (!list || list.__shareBound) return;
    list.__shareBound = true;

    /* 이제 카드 안에서 할 일은 [off] 하나뿐입니다.
       카드를 눌러도 아무 일도 일어나지 않습니다. */
    list.addEventListener("click", (e) => {
      const off = e.target.closest("[data-share-stop]");
      if (off) { e.stopPropagation(); stopScreenShare(); return; }

      /* 내 카드의 "○○의 화면" — 보여줄 창 바꾸기 */
      const sw = e.target.closest("[data-share-switch]");
      if (sw) { e.stopPropagation(); switchShareWindow(); return; }
    });
  }

  /* ---------------------------------------------------------------
     창구
     --------------------------------------------------------------- */
  window.toggleScreenShare = toggleScreenShare;
  /* 화면에는 버튼이 없지만, 뭉갠 정도를 바꿔보고 싶으면 F12 콘솔에서
     setShareLevel(0|1|2) — 0 약함(320px) · 1 보통(160px) · 2 강함(80px) */
  window.setShareLevel = setShareLevel;
  window.stopScreenShare   = stopScreenShare;
  window.switchShareWindow = switchShareWindow;
  /* 접속자 정보가 바뀔 때 script_realtime.js 가 다시 칠해 줍니다 */
  window.renderShareButton = renderShareButton;
  window.renderShareCards  = renderShareCards;
  window.isScreenSharing   = () => _sharing;
  window.SHARE_LEVELS      = SHARE_LEVELS;

  /* ---------------------------------------------------------------
     기존 흐름에 끼워 넣기
       · 접속자 카드를 다시 그리면 공유 카드도 다시 붙입니다
       · 나가기(leaveRoom) 때는 공유를 먼저 정리합니다 (닉이 지워지기 전에)
     --------------------------------------------------------------- */
  (function installShareHooks() {
    const _render = window.renderUserCards;
    if (typeof _render === "function" && !_render.__sharePatched) {
      const wrapped = function () {
        const r = _render.apply(this, arguments);
        try { renderShareCards(); } catch (e) { console.warn("[renderShareCards]", e); }
        return r;
      };
      wrapped.__sharePatched = true;
      window.renderUserCards = wrapped;
    }

    const _leave = window.leaveRoom;
    if (typeof _leave === "function" && !_leave.__sharePatched) {
      const wrapped = async function () {
        try { await stopScreenShare(); } catch (e) {}
        return _leave.apply(this, arguments);
      };
      wrapped.__sharePatched = true;
      window.leaveRoom = wrapped;
    }

    loadShareLevel();
    renderShareButton();
    bindShareClicks();
  })();
})();
