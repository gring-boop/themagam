/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 🖥️ 화면 공유 (자체 모자이크) · script_share.js
   ---------------------------------------------------------------------
   ★ 원본 화면은 내 컴퓨터를 벗어나지 않습니다.

   브라우저 화면 캡쳐(getDisplayMedia)로 창을 하나 잡습니다. 그 영상은
   이 컴퓨터 안에서만 흐릅니다. 5초에 한 번, **내 컴퓨터에서 먼저**
   아주 작은 캔버스(가로 22~88px)에 옮겨 그려 알아볼 수 없게 뭉갠 다음,
   그 작은 그림 한 장만 서버로 보냅니다. 원본 해상도의 프레임은 서버로도
   다른 사람에게도 절대 나가지 않습니다. 나가는 것은 언제나 뭉갠 뒤입니다.

   [무엇이 서버에 남는가]
     screens/{닉} = { img: 뭉갠 JPEG dataURL, at: 서버시각, level: 가로 픽셀 }
   한 장이 보통 1~3KB, 상한 8KB. 5초에 한 번이니 한 사람이 공유하는 동안
   시간당 대략 1~2MB 정도가 오갑니다. 낡은 그림은 덮어쓰기라 쌓이지 않고,
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
     가로 22px 이면 화면 전체가 스물두 칸으로 뭉개집니다. */
  const SHARE_LEVELS = [
    { name: "약함", w: 88 },
    { name: "보통", w: 44 },
    { name: "강함", w: 22 }
  ];
  /* [고침 2026-08-06] 기본을 "약함"(88px)으로. 화면에서 고를 수 없게 됐으니
     기본값이 곧 유일한 값입니다 — 뭉갠 정도는 이 상수로만 바꿉니다. */
  const SHARE_DEFAULT_LEVEL = 0;          // 기본은 "약함"(88px)

  const SHARE_INTERVAL_MS = 5000;         // 5초에 한 장
  const SHARE_MAX_BYTES   = 8 * 1024;     // 한 장 상한 8KB
  const SHARE_QUALITIES   = [0.5, 0.4, 0.3];  // 상한을 넘으면 품질을 낮춰 다시
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
  let _agoTimer   = null;    // "n초 전" 갱신 타이머 (1초)
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

  function agoText(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return `${s}초 전`;
    return `${Math.floor(s / 60)}분 전`;
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

    /* 44px 폭 JPEG 0.5 품질이면 보통 1~3KB 입니다. 그림이 복잡해서
       8KB 를 넘으면 품질을 0.4, 0.3 으로 낮춰 다시 만들고, 그래도
       넘으면 이 프레임은 통째로 건너뜁니다. */
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
  async function startScreenShare() {
    if (!supported()) { alert(SHARE_UNSUPPORTED); return; }
    if (!myNick) { alert("먼저 입장한 뒤에 쓸 수 있어요."); return; }
    if (_sharing) return;

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 } });
    } catch (e) {
      // 창 고르기를 취소했거나 권한이 막혔습니다 — 조용히 없던 일로
      return;
    }
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
    try { await _video.play(); } catch (e) {}

    /* 브라우저가 띄우는 "공유 중지" 막대를 직접 누른 경우에도 정리 */
    const track = stream.getVideoTracks()[0];
    if (track) track.onended = () => { stopScreenShare(); };

    _sharing = true;

    /* 창이 그냥 닫혀도 내 그림이 서버에 남지 않게 미리 예약해 둡니다 */
    try { await db.ref("screens/" + myNick).onDisconnect().remove(); } catch (e) {}

    listenScreens();
    _timer    = setInterval(pushFrame, SHARE_INTERVAL_MS);
    _agoTimer = setInterval(tickAgo, 1000);
    renderShareButton();
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
    closeShareLightbox();
    _lastShareHtml = null;
    renderShareCards();                // 공유를 끄면 남의 화면도 치웁니다
    renderShareButton();

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
    btn.classList.toggle("share-on", _sharing);   // 공유 중에는 붉게
    if (label) label.textContent = _sharing ? "공유 중" : "화면 공유";
    btn.title = _sharing
      ? "화면 공유 끄기"
      : "내 창 하나를 뭉갠 그림으로 공유합니다 (원본은 나가지 않아요)";
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

  /* 카드 HTML 에는 "몇 초 전"과 "끊김" 표시를 넣지 않습니다.
     그 둘은 시계만 흘러도 달라지므로, 만든 HTML 이 매번 달라져
     그림이 새로 붙고(=깜빡이고) 맙니다. 두 가지는 tickAgo 가
     1초마다 글자와 클래스만 고쳐 씁니다. */
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
        <div class="share-shot" role="button" tabindex="0" title="크게 보기">
          <img class="share-img" src="${row.img}" alt="${esc(row.nick)} 님이 공유 중인 화면 (모자이크)">
          <span class="share-live">● 공유 중</span>
          <span class="share-ago"></span>
        </div>
        <div class="card-foot share-foot">
          <span class="share-who">${esc(row.nick)}의 화면</span>
          ${off}
        </div>
      </div>`;
  }

  function renderShareCards() {
    const list = document.getElementById("user-cards");
    if (!list) return;

    const html = _sharing ? shareRows().map(shareCardHtml).join("") : "";
    const present = !!list.querySelector(".share-card");

    /* 만든 HTML 이 직전과 같고 카드도 그대로 붙어 있으면 손대지 않습니다.
       (다시 그리면 <img> 가 새 요소가 되어 그림이 깜빡입니다) */
    if (html === _lastShareHtml && present === !!html) { tickAgo(); return; }

    list.querySelectorAll(".share-card").forEach(el => el.remove());
    if (html) list.insertAdjacentHTML("beforeend", html);
    _lastShareHtml = html;

    tickAgo();          // 방금 붙인 카드에 "n초 전"을 채웁니다
    // 크게 보기가 열려 있으면 그 그림도 새것으로 바꿔 줍니다
    syncLightbox();
  }

  /* "n초 전"만 1초마다 고쳐 씁니다 — 카드를 다시 만들지 않으므로
     그림이 깜빡이지 않습니다. 20초가 넘으면 흐리게, 30초가 넘으면 뺍니다. */
  function tickAgo() {
    const t = now();
    document.querySelectorAll(".share-card").forEach(card => {
      const at = Number(card.getAttribute("data-share-at") || 0);
      const age = t - at;
      if (age > SHARE_DROP_MS) { card.remove(); _lastShareHtml = null; return; }
      card.classList.toggle("is-stale", age > SHARE_STALE_MS);
      const ago = card.querySelector(".share-ago");
      if (ago) ago.textContent = agoText(age);
    });
  }

  /* ---------------------------------------------------------------
     크게 보기 (라이트박스) — 뭉갠 그림을 화면 가운데 크게.
     배경을 누르면 닫힙니다.
     --------------------------------------------------------------- */
  function openShareLightbox(nick) {
    const row = shareRows().find(r => r.nick === nick);
    if (!row) return;
    closeShareLightbox();

    const box = document.createElement("div");
    box.id = "share-lightbox";
    box.className = "share-lightbox";
    box.innerHTML = `
      <div class="share-lightbox-in">
        <img class="share-big" src="${row.img}" alt="${esc(nick)} 님이 공유 중인 화면 (모자이크)">
        <div class="share-lightbox-cap">${esc(nick)} · 🖥️ 화면 · 5초마다 한 장</div>
        <div class="share-lightbox-note">${esc(SHARE_NOTICE)}</div>
        <button type="button" class="share-lightbox-close" data-share-close="1">닫기</button>
      </div>`;
    box.addEventListener("click", (e) => {
      // 배경(또는 [닫기])을 누르면 닫힙니다. 그림을 누른 건 그대로 둡니다.
      if (e.target === box || e.target.closest("[data-share-close]")) closeShareLightbox();
    });
    document.body.appendChild(box);
    document.addEventListener("keydown", onLightboxKey);
  }

  function closeShareLightbox() {
    const box = document.getElementById("share-lightbox");
    if (box) box.remove();
    document.removeEventListener("keydown", onLightboxKey);
  }

  function onLightboxKey(e) {
    if (e.key === "Escape") closeShareLightbox();
  }

  /* 새 그림이 오면 열려 있는 크게 보기도 따라 갱신 */
  function syncLightbox() {
    const box = document.getElementById("share-lightbox");
    if (!box) return;
    const img = box.querySelector(".share-big");
    const cap = box.querySelector(".share-lightbox-cap");
    if (!img || !cap) return;
    const nick = cap.textContent.split(" · ")[0];
    const row = shareRows().find(r => r.nick === nick);
    if (!row) { closeShareLightbox(); return; }
    if (img.getAttribute("src") !== row.img) img.setAttribute("src", row.img);
  }

  /* ---------------------------------------------------------------
     카드 안 클릭 — 위임으로 한 번만 답니다
     --------------------------------------------------------------- */
  function bindShareClicks() {
    const list = document.getElementById("user-cards");
    if (!list || list.__shareBound) return;
    list.__shareBound = true;

    list.addEventListener("click", (e) => {
      const off = e.target.closest("[data-share-stop]");
      if (off) { e.stopPropagation(); stopScreenShare(); return; }

      const card = e.target.closest(".share-card");
      if (card) openShareLightbox(card.getAttribute("data-share-nick"));
    });

    list.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const shot = e.target.closest(".share-shot");
      if (!shot) return;
      e.preventDefault();
      const card = shot.closest(".share-card");
      if (card) openShareLightbox(card.getAttribute("data-share-nick"));
    });
  }

  /* ---------------------------------------------------------------
     창구
     --------------------------------------------------------------- */
  window.toggleScreenShare = toggleScreenShare;
  /* 화면에는 버튼이 없지만, 뭉갠 정도를 바꿔보고 싶으면 F12 콘솔에서
     setShareLevel(0|1|2) — 0 약함(88px) · 1 보통(44px) · 2 강함(22px) */
  window.setShareLevel = setShareLevel;
  window.stopScreenShare   = stopScreenShare;
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
