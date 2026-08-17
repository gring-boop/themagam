/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 🖥️ 화면 공유 (자체 모자이크) · script_share.js
   ---------------------------------------------------------------------
   ★ 원본 화면은 내 컴퓨터를 벗어나지 않습니다.

   브라우저 화면 캡쳐(getDisplayMedia)로 창을 하나 잡습니다. 그 영상은
   이 컴퓨터 안에서만 흐릅니다. 5초에 한 번, **내 컴퓨터에서 먼저**
   아주 작은 캔버스(가로 80~360px)에 옮겨 그려 글자를 못 읽게 뭉갠 다음,
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
     가로 80px 이면 화면 전체가 여든 칸으로 뭉개집니다.

     [바뀜 2026-08-10] 세 단계 → **연속 조절**.

     예전에는 약함(320) · 보통(160) · 강함(80) 셋 중에 골랐습니다. 그런데
     "320 은 좀 흐리고 160 은 너무 뭉개진다" 같은 자리가 없었어요.
     이제 빨간 불을 눌러 막대로 원하는 지점을 잡습니다.

     ★ 상한 360 은 함부로 올리면 안 됩니다.
       1920px 화면 기준으로 가로 400px 부터 **큰 제목이 읽히기 시작합니다**
       (32px 글자 → 6.7px, 획이 살아남는 크기). 본문은 한참 뒤에야
       읽히지만 제목만 읽혀도 무엇을 쓰는지 드러나요. 그래서 400 에서
       한 뼘 물러선 360 을 상한으로 뒀습니다. 검사도 이걸 막고 있습니다. */
  /* =====================================================================
     그림을 카드에 맞추는 방식 (2026-08-11)
     ---------------------------------------------------------------------
     "채우기" 는 칸을 꽉 채우고 넘치는 쪽을 잘라냅니다. 원고 창처럼
     세로로 긴 그림에는 이게 낫습니다.

     그런데 타임좌 같은 **가로로 길쭉한 창**은 높이에 맞춰 늘어나면서
     양옆이 잘려 나갑니다 — 정작 숫자가 있는 자리가 사라져요.
     그래서 "전체 보기" 를 함께 둡니다. 잘라내지 않고 통째로 넣어요.

     ★ 이 값은 **공유하는 사람**이 정하고 **모두의 화면에 그대로** 갑니다.
       보는 사람이 각자 고르게 하면, 정작 타임좌를 띄운 본인이 남들
       화면을 고쳐 줄 수 없습니다. 카드가 잘려 보이는 걸 아는 사람은
       공유하는 본인이니까요.
     ===================================================================== */
  const FIT_KEY = "shareFit";           // "cover"(채우기) | "contain"(전체 보기)
  let _shareFit = "cover";

  const SHARE_W_MIN  = 80;    // 가장 뭉갠 쪽
  const SHARE_W_MAX  = 360;   // 가장 선명한 쪽 (400 미만이어야 합니다)
  const SHARE_W_STEP = 20;

  /* 예전 저장값(0·1·2)을 새 값(가로 픽셀)으로 옮기는 표.
     쓰던 사람이 다시 들어왔을 때 갑자기 딴 값이 되면 안 되니까요. */
  const SHARE_LEGACY_W = [320, 160, 80];
  /* [얼마나 선명해지나]  1920px 화면 기준으로 —
         가로  80px  24배 축소. 색 덩어리만 보입니다
         가로 320px   6배 축소. 문단 덩어리와 그림 윤곽까지
     글자를 읽으려면 획이 5px 쯤 남아야 하는데, 320 에서 본문 16px 은
     2.7px 로 줄어 회색 띠가 됩니다. 큰 제목 32px 도 5.3px 라 형태만
     겨우 보이는 정도예요. */
  const SHARE_DEFAULT_W = 320;            // 기본값 — 예전의 "약함"과 같습니다

  /* [고침 2026-08-15] 5초 → 10초.
     화면 공유는 **공유 중인 사람끼리만** 봅니다. 그래서 통신량이
     공유자 수의 **제곱**으로 늘어요 — 하루 2시간씩 다섯 명이 켜면
     월 33GB(무료치 10GB의 세 배)입니다. 간격을 두 배로 늘리면 딱 절반.
     원래 뭉갠 그림이라 글자를 읽는 용도가 아니고 "저 사람 지금 뭐
     하는구나" 를 보는 것이라, 10초로도 충분합니다.

     [고침 2026-08-17] 10초 → 15초. 화공을 켜는 작가가 늘어서요.
     하루 2시간·한 장 20KB 기준 월 통신량:
       동시 3명  3.7 → 2.5GB  ·  4명  6.6 → 4.4GB  ·  5명  10.3 → 6.9GB
     무료치가 월 10GB 라, 이 한 줄로 동시 공유 상한이 4명 → 5명이 됩니다. */
  const SHARE_INTERVAL_MS = 15000;        // 15초에 한 장
  /* 그림이 커지면 상한도 함께 올려야 합니다. 상한을 낮게 두면 대부분의
     프레임이 걸려 통째로 버려지고, 화면이 10초가 아니라 몇십 초에 한 번씩만
     바뀝니다 (뭉개짐보다 이게 더 답답해요).
     320px 이면 한 장이 보통 12~30KB, 10초마다 보내니 한 사람당 시간당
     5~12MB 남짓입니다. */
  const SHARE_MAX_BYTES   = 40 * 1024;    // 한 장 상한 40KB
  const SHARE_QUALITIES   = [0.5, 0.4, 0.3, 0.22];  // 상한을 넘으면 품질을 낮춰 다시

  /* ★★ 아래 둘은 **간격을 기준으로** 잡습니다 — 간격만 바꾸고 이걸 두면
     멀쩡히 공유 중인 사람이 흐려지고 사라집니다.
     예전 5초 시절에 20초/30초였으니 각각 "네 장 · 여섯 장 놓침" 이
     기준이었어요. 그 뜻을 그대로 지킵니다.
     [고침 2026-08-17] 사라짐만 ×6 → ×5. 간격이 15초가 되면서 ×6이면
     끈 사람의 마지막 화면이 90초나 남습니다. ×5(75초)로 당겼어요 —
     "여섯 장 놓침" 에서 "다섯 장 놓침" 으로, 흐려짐(×4)보다는 뒤. */
  const SHARE_STALE_MS    = SHARE_INTERVAL_MS * 4;   // 네 장 놓치면 "끊김"(흐리게) — 60초
  const SHARE_DROP_MS     = SHARE_INTERVAL_MS * 5;   // 다섯 장 놓치면 목록에서 뺍니다 — 75초
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
  let _shareW     = SHARE_DEFAULT_W;      // 지금 뭉갬 정도 (가로 픽셀)
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

    /* =====================================================================
       ★ [고침 2026-08-11] 여기서 그림을 **눌러 납작하게** 만들고 있었습니다.

       예전 줄:
           const h = Math.min(round(w * vh/vw), round(w * 0.6));
           ctx.drawImage(_video, 0, 0, w, h);

       세로를 "가로의 0.6배" 로 못박아 두었어요. 뜻은 "세로로 긴 창이
       와도 용량이 커지지 않게" 였는데, drawImage 에 목적지 크기만 주면
       **원본을 그 상자에 밀어 넣습니다.** 잘라내는 게 아니라 눌러요.

       그래서 1216×1332 짜리 거의 정사각 창도 360×216 으로 찍눌려서,
       무슨 창을 띄우든 납작하게 나왔습니다. 카드에서 "위아래가 잘린다"
       고 보였던 것의 진짜 원인이 이거였어요.

       [이제는]
       비율을 **언제나** 지킵니다. 용량은 세로를 자르는 대신 **넓이(픽셀 수)**
       로 잡아요 — 지금까지의 가장 큰 그림(360×216)과 같은 양을 상한으로
       두고, 그보다 넓어지면 비율을 지킨 채 통째로 줄입니다.

       ※ 세로로 긴 창은 그만큼 가로가 줄어듭니다. 글자는 더 안 읽히게
         되니 사생활 쪽으로도 안전한 방향이에요.
       ===================================================================== */
    const PIX_BUDGET = SHARE_W_MAX * Math.round(SHARE_W_MAX * 0.6);   // 360×216

    let w = _shareW;
    let h = Math.max(1, Math.round(w * (vh / vw)));
    if (w * h > PIX_BUDGET) {
      const k = Math.sqrt(PIX_BUDGET / (w * h));
      w = Math.max(1, Math.round(w * k));
      h = Math.max(1, Math.round(h * k));
    }

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
        level: _shareW,
        fit: _shareFit          // 카드에 어떻게 맞출지 — 보는 쪽이 그대로 따릅니다
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
    _표시남기기(true);

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
    _표시남기기(false);          // 내 손으로 껐으니 다음에 안 물어봅니다

    if (_timer)    { clearInterval(_timer);    _timer = null; }
    if (_agoTimer) { clearInterval(_agoTimer); _agoTimer = null; }
    /* 머리에 모아둔 초를 마저 적습니다 — 안 그러면 30초까지 날아갑니다 */
    try { window.achvShareFlush?.(); } catch (e) {}

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

  /* =====================================================================
     🖥️ 돌아오면 다시 켤지 물어봅니다 (2026-08-15)
     ---------------------------------------------------------------------
     [먼저, 자동으로는 안 됩니다 — 브라우저가 막습니다]
     화면 공유는 "이 창을 보여줄게" 를 **그때그때 사람이 고르는** 방식이라,
     카메라·마이크처럼 한 번 허락해 두는 권한이 아예 없습니다. 크롬은
     사람이 누른 직후가 아니면 고르기 창을 띄우는 것 자체를 거부해요.
     새로고침하면 화면 줄기도 함께 끊깁니다. 그래서 "저절로 다시 켜기" 는
     지금의 웹에서는 만들 수 없어요 — 남의 화면이 몰래 다시 나가는 일을
     막으려는 규칙이라, 뚫을 방법을 찾는 것도 옳지 않습니다.

     [대신 할 수 있는 것]
     "아까 공유 중이었다" 는 것만 이 기기에 적어 두고, 돌아오면 머리말
     단추를 **깜빡여서** 알려 줍니다. 한 번 누르면 바로 고르기 창이
     떠요 — 메뉴를 찾아 들어갈 일이 없어집니다.

     ★ 내 손으로 끈 경우에는 표시를 지웁니다. 끝낸 사람에게 다시
       권하는 건 참견이니까요. 표시는 6시간만 삽니다 — 어제 켰던 것을
       오늘 아침에 묻는 건 눈치 없는 짓이에요.
     ===================================================================== */
  const RESUME_KEY = "shareWasOn";
  const RESUME_TTL = 6 * 60 * 60 * 1000;

  function _표시남기기(켬) {
    try {
      if (켬) window.AppStore?.setItem(RESUME_KEY, String(Date.now()));
      else    window.AppStore?.removeItem(RESUME_KEY);
    } catch (e) {}
  }
  function _표시있나() {
    try {
      const t = Number(window.AppStore?.getItem(RESUME_KEY) || 0);
      if (!t) return false;
      if (Date.now() - t > RESUME_TTL) { _표시남기기(false); return false; }
      return true;
    } catch (e) { return false; }
  }

  /** 입장한 뒤에 한 번 — 아까 공유 중이었으면 단추를 깜빡입니다 */
  function offerResume() {
    if (_sharing || !supported() || !myNick) return;
    if (!_표시있나()) return;
    const btn = document.getElementById("share-btn");
    if (!btn) return;
    btn.classList.add("share-resume");
    btn.title = "아까 화면을 공유하고 있었어요 — 눌러서 다시 켜기";
    /* 깜빡임은 눌렀을 때 · 30초 뒤에 스스로 멎습니다. 계속 깜빡이면
       "안 끄면 안 되나" 싶어져요 */
    const 그만 = () => btn.classList.remove("share-resume");
    btn.addEventListener("click", 그만, { once: true });
    setTimeout(그만, 30000);
  }
  window.offerShareResume = offerResume;

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
  /** 가로 픽셀로 직접 정합니다 (80 ~ 360). 범위를 벗어나면 잘라 맞춥니다. */
  /* 맞추는 방식 바꾸기 — 이 기기에 적어 두고, 공유 중이면 곧바로 한 장 보냅니다 */
  function setShareFit(v, opts) {
    _shareFit = (v === "contain") ? "contain" : "cover";
    try { window.AppStore?.setItem(FIT_KEY, _shareFit); } catch (e) {}
    /* 내 카드는 서버를 기다리지 않고 바로 바뀌게 — 누른 느낌이 살아야 해요 */
    document.querySelectorAll('.share-card.is-me .share-img').forEach(im => {
      im.classList.toggle("is-contain", _shareFit === "contain");
      im.classList.toggle("is-cover", _shareFit !== "contain");
    });
    if (!opts || !opts.quiet) pushFrame();
  }

  function setShareWidth(w, opts) {
    const n = Math.round(Number(w) / SHARE_W_STEP) * SHARE_W_STEP;
    _shareW = Math.max(SHARE_W_MIN, Math.min(SHARE_W_MAX, n || SHARE_DEFAULT_W));
    try { window.AppStore && window.AppStore.setItem(SHARE_LEVEL_KEY, "w" + _shareW); } catch (e) {}
    /* 막대를 끄는 동안에는 매번 보내지 않습니다 — 손을 뗄 때 한 번만.
       5초에 한 장이라는 약속을 지키면서도 결과는 바로 보입니다. */
    if (!opts || !opts.quiet) pushFrame();
  }

  /* 예전 방식(0·1·2)으로 부르던 곳을 위해 남겨 둡니다 */
  function setShareLevel(i) {
    const w = SHARE_LEGACY_W[Number(i)];
    if (w) setShareWidth(w);
  }

  function loadShareLevel() {
    try {
      const raw = String(window.AppStore && window.AppStore.getItem(SHARE_LEVEL_KEY) || "");
      if (raw.startsWith("w")) {                    // 새 방식 — 가로 픽셀
        const w = Number(raw.slice(1));
        if (w >= SHARE_W_MIN && w <= SHARE_W_MAX) _shareW = w;
        return;
      }
      const v = Number(raw);                        // 옛 방식 — 0·1·2
      if (SHARE_LEGACY_W[v]) _shareW = SHARE_LEGACY_W[v];
    } catch (e) {}
  }

  function loadShareFit() {
    try {
      const raw = String(window.AppStore && window.AppStore.getItem(FIT_KEY) || "");
      _shareFit = (raw === "contain") ? "contain" : "cover";
    } catch (e) { _shareFit = "cover"; }
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
      /* 🧘 혼자 방의 가짜 화면은 늙지 않습니다 — 보내는 사람이 없으니
         "소식이 끊겼다" 는 판정이 뜻을 잃어요 */
      if (!window.SOLO && age > SHARE_DROP_MS) continue;   // 30초 넘게 소식이 없으면 뺍니다
      /* 모르는 값이 오면 예전처럼 "채우기" — 옛 기록과 섞여도 안 깨집니다 */
      const fit = (r.fit === "contain") ? "contain" : "cover";
      rows.push({ nick, img, at, age, fit });
    }
    // 내 카드가 맨 앞 (자기 것 확인용)
    rows.sort((a, b) => (a.nick === myNick ? -1 : 0) - (b.nick === myNick ? -1 : 0));
    return rows;
  }

  /* [2026-08-06] 강도 고르기 버튼은 화면에서 뺐습니다.
     [2026-08-10] 이제 카드의 빨간 불을 누르면 조절 막대가 열립니다.
     setShareLevel(0|1|2) 도 남겨 뒀어요 — 옛 저장값과 콘솔용입니다. */

  /* 카드 HTML 에는 "끊김" 표시를 넣지 않습니다. 시계만 흘러도 달라지므로
     만든 HTML 이 매번 달라져 그림이 새로 붙고(=깜빡이고) 맙니다.
     끊김은 tickShare 가 1초마다 클래스만 고쳐 씁니다. */
  /* [고침 2026-08-06] 카드를 프로필 카드와 같은 크기로 고정합니다.

     화면이 주인공이라, 그림이 카드를 꽉 채우고 아래 한 줄만 남깁니다.
       · 강도 고르기 버튼과 안내 문구는 뺐습니다 (기본 "약함" 고정)
       · 아래 한 줄 = "닉네임의 화면" + [off] 나란히
     그림은 카드 비율에 맞춰 잘라 넣습니다(양옆이 잘려도 괜찮습니다). */
  function shareCardHtml(row) {
    /* 🧘 혼자 방의 가짜 화면에는 손잡이를 달지 않습니다 —
       끄기·창 바꾸기는 진짜 공유에만 뜻이 있어요 */
    const mine = (row.nick === myNick) && !window.SOLO;
    const off = mine
      ? `<button type="button" class="share-off" data-share-stop="1"
                 title="화면 공유 끄기" aria-label="화면 공유 끄기">off</button>`
      : "";
    return `
      <div class="user-card share-card${mine ? " is-me" : ""}"
           data-share-nick="${esc(row.nick)}" data-share-at="${row.at}"
           title="${esc(SHARE_NOTICE)}">
        <div class="share-shot">
          <img class="share-img is-${row.fit === "contain" ? "contain" : "cover"}"
               src="${row.img}" alt="${esc(row.nick)} 님이 공유 중인 화면 (모자이크)">
          <!-- [2026-08-10] 글자를 빼고 **빨간 불 하나**로. 녹음실 ON 램프처럼.
               글자가 사라져도 뜻이 남도록 title 과 aria-label 을 답니다 —
               마우스를 올리면 "공유 중" 이 뜨고, 화면 낭독기도 그렇게 읽어요. -->
          ${mine
            ? `<button type="button" class="share-live is-mine" data-blur-open="1"
                       aria-label="공유 중 — 눌러서 뭉갬 정도 조절"
                       title="공유 중 · 눌러서 뭉갬 정도 조절"><i></i></button>`
            : `<span class="share-live" role="img" aria-label="공유 중" title="공유 중"><i></i></span>`}
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

    /* 🧘 혼자 방은 내가 공유 중이 아니어도 그립니다 (전부 내가 놓아둔 사진) */
    const rows = (_sharing || window.SOLO) ? shareRows() : [];
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
      /* [고침 2026-08-14] 주인 카드가 없으면 **그리지 않습니다.**
         예전에는 맨 뒤에 붙였는데, 그 사람 접속이 잠깐 끊겨 카드가 사라진
         순간에 공유 그림만 덩그러니 남아 "프로필 카드가 남의 그림으로
         바뀐 것처럼" 보였습니다 (실제 제보 — 놀라게 해서 미안합니다).
         주인이 돌아오면 다음 그림에 다시 붙으니 잃는 것도 없어요. */
      if (!own) return;
      own.insertAdjacentHTML("afterend", shareCardHtml(row));
    });
    _lastShareHtml = html;

    tickShare();
    syncShareHeights();
    /* 공유 카드도 줄에 서므로 "혼자 내려간 카드" 규칙을 다시 잽니다 */
    window.fixLonelyCard?.();
  }

  /* =====================================================================
     공유 카드 높이 맞추기 (2026-08-10)
     ---------------------------------------------------------------------
     [무엇이 문제였나]
     카드 목록은 그리드인데 `align-items: start` 라, 카드가 줄 높이에
     끌려가지 않고 각자 내용만큼만 차지합니다(프로필 카드끼리 높이가
     들쭉날쭉하지 않게 하려고 일부러 그렇게 뒀어요).

     공유 카드는 `height: 100%` 로 "옆 프로필 카드와 같은 높이"를
     노렸는데, 100% 의 기준은 **그 줄의 높이**입니다. 그래서 같은 줄에
     프로필 카드가 있을 때만 맞고, 줄 끝에서 밀려 **혼자 다음 줄로
     내려가면 그 줄에는 자기밖에 없어서** 제 내용만큼으로 쪼그라들었죠.

     [왜 CSS 로 안 되나]
     grid-auto-rows: 1fr 로 모든 줄 높이를 같게 만들 수는 있지만,
     그러면 align-items: start 인 프로필 카드 아래로 빈 자리가 크게
     남습니다. 지금 배치를 해치지 않으면서 공유 카드만 맞추려면
     프로필 카드의 실제 높이를 재는 수밖에 없습니다.

     [어떻게]
     프로필 카드 중 가장 큰 높이를 재서 공유 카드에 그대로 입힙니다.
     창 크기가 바뀌면 다시 잽니다.
     ===================================================================== */
  let _syncTimer = 0;

  function syncShareHeights() {
    const list = document.getElementById("user-cards");
    if (!list) return;

    /* [되돌림 2026-08-15] 한때 혼자 방만 액자를 사진 비율대로 자라게
       두었습니다. 회색 띠는 없어졌지만 카드 키가 제각각이 되어 줄이
       들쭉날쭉했어요. 액자는 진짜 방과 똑같이 카드 키에 맞추고, 대신
       **잘라 보기 / 전체 보기를 카드마다 고르게** 했습니다
       (진짜 방이 이미 가진 기능인데 혼자 방에서만 안 쓰고 있었어요). */
    const shares = list.querySelectorAll(".share-card");
    if (!shares.length) return;

    /* 먼저 지난번에 입힌 높이를 걷어내고 잽니다 —
       안 그러면 한 번 커진 값이 계속 눌러앉습니다. */
    shares.forEach(el => { el.style.height = ""; });

    /* ★★ [고침 2026-08-15] 재는 자를 맞춥니다.
       getBoundingClientRect 는 **확대된 뒤**의 화면 값이고, style.height 는
       **확대 전**의 요소 값입니다. 95% 로 줄여 놓으면 잰 값이 이미 0.95배라,
       그걸 그대로 입히면 공유 카드만 5% 짧아졌어요 (실제 제보).
       100% 로 돌리면 멀쩡해 보이니 더 찾기 어려운 종류의 어긋남입니다. */
    const z = (window.uiZoom?.() || 1);
    let h = 0;
    list.querySelectorAll(".user-card:not(.share-card)").forEach(el => {
      h = Math.max(h, el.getBoundingClientRect().height / z);
    });
    if (!h) return;                       // 프로필 카드가 아직 없으면 그대로 둡니다
    shares.forEach(el => { el.style.height = Math.round(h) + "px"; });
  }
  window.syncShareCardHeights = syncShareHeights;

  /* 창 크기가 바뀌면 카드 폭이 달라져 높이도 달라집니다.
     연달아 들어오는 resize 는 한 번으로 묶습니다. */
  window.addEventListener("resize", () => {
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(syncShareHeights, 120);
  });

  /* 1초마다 끊김만 살핍니다 — 카드를 다시 만들지 않으므로 깜빡이지 않아요.
     20초가 넘으면 흐리게, 30초가 넘으면 카드를 뺍니다.
     ("n초 전" 글자는 뺐습니다 — 화면이 흐려지는 것만으로 충분해서요) */
  /* =====================================================================
     💤 자리비움이 길어지면 공유를 스스로 끕니다 (2026-08-15)
     ---------------------------------------------------------------------
     [왜] 켜 둔 채 자리를 뜨는 일이 잦습니다. 두어 시간씩 이어지기도 해요.
     그동안 내 화면은 계속 나가고, 통신량도 계속 씁니다. 무엇보다
     **자리에 없는 사람의 화면이 계속 보이는 건 본인이 원한 게 아닙니다.**

     [언제] 자리비움(away) 으로 넘어간 뒤 5분. 자동감지가 바꿔 준 것이든
     손으로 고른 것이든 똑같이 셉니다.

     [왜 곧바로가 아니라 5분인가] 상태를 잘못 눌렀다가 되돌리는 일이
     있고, 자동감지도 20분 무입력이라 이미 한참 기다린 뒤예요. 5분이면
     "잘못 눌렀네" 하고 돌아올 틈은 되면서, 두 시간을 흘려보내지도
     않습니다. 자리로 돌아오면 세던 것은 없던 일이 됩니다.

     [끄고 나서] 조용히 끄지 않고 알려 줍니다 — 껐는지 몰라서 "왜
     아무도 내 화면을 안 보지" 하는 일이 없게요.
     ===================================================================== */
  const AWAY_STOP_MS = 5 * 60 * 1000;
  let _awaySince = 0;
  let _stoppedByAway = false;      // 자리비움 때문에 껐다 — 돌아오면 알려주려고
  let _awayWatchTimer = null;

  function _myStatusNow() {
    return document.getElementById("db-status")?.value || "";
  }

  function _watchAway() {
    const away = (_myStatusNow() === "away");

    /* 자리로 돌아왔습니다 — 껐다고 알려주고, 다시 켜기 쉽게 단추를 깜빡입니다.
       ★ 알림을 끌 때가 아니라 **돌아왔을 때** 띄우는 이유: 자리비움 중에
         띄워 봐야 못 봅니다. 토스트는 몇 초 뒤 사라지니까요. */
    if (!away && _stoppedByAway) {
      _stoppedByAway = false;
      try {
        window.showCommandToast?.("💤 자리비움이 길어져 화면 공유를 꺼 두었어요. 🖥️ 를 누르면 다시 켤 수 있어요.");
      } catch (e) {}
      try { offerResume(); } catch (e) {}
    }

    if (!_sharing) { _awaySince = 0; return; }
    if (!away)     { _awaySince = 0; return; }        // 자리에 있어요

    const t = Date.now();
    if (!_awaySince) { _awaySince = t; return; }
    if (t - _awaySince < AWAY_STOP_MS) return;

    _awaySince = 0;
    _stoppedByAway = true;
    stopScreenShare();
    /* ★ 내 손으로 끈 게 아니니 "아까 공유 중이었다" 표시는 남겨 둡니다.
       (stopScreenShare 가 지우므로 여기서 도로 세웁니다) */
    _표시남기기(true);
  }

  /* 공유를 끈 뒤에도 "돌아왔나" 는 지켜봐야 합니다 — tickShare 는 공유
     중일 때만 도니까요. 30초에 한 번이면 충분합니다. */
  function _startAwayWatcher() {
    if (_awayWatchTimer) return;
    _awayWatchTimer = setInterval(_watchAway, 30 * 1000);
  }
  window.addEventListener("load", () => setTimeout(_startAwayWatcher, 5000));

  function tickShare() {
    /* ★ 자리비움 검사는 혼자 방에서도 돕니다 — 아래 SOLO 반환보다 먼저 */
    _watchAway();

    /* 🏅 👀 관심이 필요해 — 공유한 시간을 1초씩 업적 쪽에 알립니다.
       ★ 이 타이머는 **내가 공유 중일 때만** 돕니다(startScreenShare 에서
         켜고 stopScreenShare 에서 끕니다). 그래서 남의 화면을 보고만
         있는 시간은 세어지지 않아요. */
    try { window.achvShareTick?.(1000); } catch (e) {}

    /* 🧘 혼자 방의 가짜 화면은 늙지 않습니다 — 보내는 사람이 없으니
       "소식이 끊겼다" 는 판정이 뜻을 잃어요.
       ★ 이걸 빠뜨려서, 걸어 둔 사진이 20초에 흐려지고 30초에 사라졌다가
         다시 나타났습니다. shareRows 쪽만 막고 여기를 놓쳤어요. */
    if (window.SOLO) return;

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

      /* 내 카드의 🔴 — 뭉갬 정도 조절 막대 */
      const bl = e.target.closest("[data-blur-open]");
      if (bl) { e.stopPropagation(); openBlurPop(bl); return; }
    });
  }

  /* =====================================================================
     🔴 빨간 불 → 뭉갬 정도 조절 막대 (2026-08-10)
     ---------------------------------------------------------------------
     ★ 내 카드에서만 열립니다.

     뭉개는 일은 **보내는 쪽 컴퓨터에서** 일어납니다. 이미 뭉개진 그림만
     서버로 나가니까요. 그래서 남의 카드에 붙은 불을 눌러도 그 사람의
     화면을 선명하게 만들 수는 없습니다 — 애초에 선명한 그림이 온 적이
     없어요. 이건 기능의 한계가 아니라 **이 기능의 핵심**입니다.

     [손을 뗄 때 한 번만 보냅니다]
     막대를 끄는 동안 매번 보내면 5초에 한 장이라는 약속이 깨집니다.
     끄는 중에는 숫자만 바꾸고, 놓는 순간 한 장을 보내 결과를 보여줍니다.
     ===================================================================== */
  let _blurPop = null;

  function closeBlurPop() {
    if (!_blurPop) return;
    _blurPop.remove();
    _blurPop = null;
    document.removeEventListener("click", _onBlurDoc, true);
    document.removeEventListener("keydown", _onBlurKey, true);
    window.removeEventListener("resize", closeBlurPop);
    window.removeEventListener("scroll", closeBlurPop, true);
  }
  function _onBlurDoc(e) {
    if (_blurPop && !_blurPop.contains(e.target) && !e.target.closest("[data-blur-open]"))
      closeBlurPop();
  }
  function _onBlurKey(e) { if (e.key === "Escape") closeBlurPop(); }

  /* 0(가장 뭉갬) ~ 100(가장 선명) 으로 보여줍니다.
     사람에게 "가로 240픽셀" 은 아무 뜻이 없으니까요. */
  function _wToPct(w) {
    return Math.round((w - SHARE_W_MIN) / (SHARE_W_MAX - SHARE_W_MIN) * 100);
  }

  function openBlurPop(anchor) {
    if (_blurPop) { closeBlurPop(); return; }
    if (!anchor) return;

    const pop = document.createElement("div");
    pop.className = "blur-pop";
    pop.innerHTML = `
      <div class="blur-pop-head">
        <span>화면 뭉갬 정도</span>
        <output id="blur-pct">${_wToPct(_shareW)}%</output>
      </div>
      <input type="range" id="blur-range" aria-label="화면 뭉갬 정도"
             min="${SHARE_W_MIN}" max="${SHARE_W_MAX}" step="${SHARE_W_STEP}"
             value="${_shareW}">
      <div class="blur-pop-ends"><span>뭉개짐</span><span>선명함</span></div>

      <div class="blur-pop-head blur-pop-head2"><span>카드에 맞추기</span></div>
      <div class="fit-pick" role="group" aria-label="카드에 맞추는 방식">
        <button type="button" data-fit="cover"   aria-pressed="${_shareFit !== "contain"}">채우기</button>
        <button type="button" data-fit="contain" aria-pressed="${_shareFit === "contain"}">전체 보기</button>
      </div>
      <p class="blur-pop-note">
        <b>채우기</b> 는 칸을 꽉 채우고 넘치는 쪽을 잘라내요.
        <b>전체 보기</b> 는 잘라내지 않는 대신 위아래에 여백이 생깁니다 —
        타임좌처럼 <b>가로로 길쭉한 창</b>에 쓰세요.
      </p>

      <p class="blur-pop-note">
        <b>내 화면에만</b> 적용돼요. 이 기기에 저장되고,
        가장 선명해도 <b>글자는 읽히지 않는 선</b>까지만 올라갑니다.
      </p>`;
    document.body.appendChild(pop);

    const r = anchor.getBoundingClientRect();
    /* 🧘 혼자 방의 확대·축소 — 재는 자를 하나로 맞춥니다 (진짜 방은 늘 1) */
    const _z = (window.uiZoom?.() || 1);
    const VW = innerWidth / _z, VH = innerHeight / _z;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = Math.min(r.left / _z, VW - w - 8);
    let top  = r.bottom / _z + 8;
    if (top + h > VH - 8) top = r.top / _z - h - 8;
    pop.style.left = Math.max(8, left) + "px";
    pop.style.top  = Math.max(8, top) + "px";

    const range = pop.querySelector("#blur-range");
    const out   = pop.querySelector("#blur-pct");
    /* 끄는 중 — 숫자만 바꿉니다 (보내지 않음) */
    range.addEventListener("input", () => {
      setShareWidth(range.value, { quiet: true });
      out.textContent = _wToPct(_shareW) + "%";
    });
    /* 맞추는 방식 — 누르면 곧바로 바뀝니다 (막대와 달리 끄는 동작이 없어요) */
    pop.addEventListener("click", (e) => {
      const b = e.target.closest("[data-fit]");
      if (!b) return;
      setShareFit(b.getAttribute("data-fit"));
      pop.querySelectorAll("[data-fit]").forEach(x =>
        x.setAttribute("aria-pressed", String(x === b)));
    });

    /* 손을 뗐을 때 — 그제서야 한 장 보냅니다 */
    const commit = () => pushFrame();
    range.addEventListener("change", commit);
    range.addEventListener("pointerup", commit);

    _blurPop = pop;
    setTimeout(() => {
      document.addEventListener("click", _onBlurDoc, true);
      document.addEventListener("keydown", _onBlurKey, true);
      window.addEventListener("resize", closeBlurPop);
      window.addEventListener("scroll", closeBlurPop, true);
    }, 0);
    range.focus();
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
  /* 입장이 끝난 뒤에 한 번 물어봅니다 (카드·채팅이 먼저 떠야 하니 조금 뒤에) */
  window.addEventListener("load", () => {
    setTimeout(() => { try { offerResume(); } catch (e) {} }, 4000);
  });
  window.listenScreens     = listenScreens;   // 🧘 혼자 방이 직접 켭니다
  window.isScreenSharing   = () => _sharing;
  window.setShareWidth     = setShareWidth;
  window.setShareFit       = setShareFit;

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
    loadShareFit();
    renderShareButton();
    bindShareClicks();
  })();
})();
