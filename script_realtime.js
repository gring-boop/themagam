/* TheMagam © 그링링 · 무단 복제·재배포 금지 */

  /* =====================================================================
     🛡️ 관리자 상수 — ★ 관리자를 바꾸려면 이 두 줄만 고치면 됩니다.

       ADMIN_NICK : 이 필명으로 입장한 사람에게만 숨은 문이 반응합니다.
                    여기만 고치면 관리자가 바뀝니다.
       ADMIN_PIN  : 숨은 문을 열 때 물어보는 번호. 자릿수 제한은 없습니다.

     ※ 관리자 페이지(script_admin.js) 에도 같은 값이 들어 있습니다.
       두 파일은 반드시 함께 고쳐야 해요 — 동기 필요!

     ※ 이것이 진짜 잠금장치가 아니라는 점을 분명히 해둡니다.
       - 코드가 공개돼 있어서 누구나 이 값을 읽을 수 있습니다.
       - 브라우저 개발자도구에서 아래 한 줄이면 검사를 건너뜁니다.
             AppSession.setItem("adminPinOk", "true")

       즉 이 PIN 은 "실수로 관리자 기능을 누르는 것"을 막아줄 뿐,
       마음먹은 사람을 막지는 못합니다.

       정말로 막으려면 파이어베이스 보안 규칙으로 서버에서 걸러야 합니다.
       함께 넣어둔 "설치안내.md" 의 규칙 예시를 보세요.
     ===================================================================== */
  const ADMIN_NICK = "그링링🍄";     // ← 관리자 필명
  const ADMIN_PIN  = "09129823";     // ← 관리자 PIN

  let _statusCache = null;
  Object.defineProperty(window, '_statusCache', {
    get() { return _statusCache; },
    set(v) { _statusCache = v; },
    configurable: true
  });
  let _headerIntervalId = null;
  let _clearRef = null;
  let _lastClearedAt = 0;

  /* 지난 1차 수정(서버 시각 기록 + 판정 창 확대)은 아래 2차 수정에 흡수됐습니다.
     lastSeen을 서버 시각으로 쓰는 부분은 그대로 유지합니다. */

  /* ===================================================================
     [FIX 3차] 창을 내려두거나 오래 방치하면 목록에서 사라지던 문제

     지난번에 "서버가 보기에 연결돼 있는가"(disconnectedAt)를 기준으로
     바꿨는데, 보조 장치로 남겨둔 lastSeen 검사가 발목을 잡았습니다.

       lastSeen 은 15초마다 도는 JS 타이머가 갱신합니다.
       그런데 브라우저는 가려진 탭·최소화한 창의 타이머를 늦추다가
       아예 멈춥니다. 크롬은 5분쯤 지나면 1분에 한 번, 더 지나면 정지.
       그러니 소켓은 멀쩡히 붙어 있는데도 lastSeen 이 낡아가고,
       15분이 지나면 다른 사람 화면에서 사라졌습니다.

     그래서 판단 기준을 정리했습니다.

       disconnectedAt 없음        → 접속 중 (서버가 붙어 있다고 봄)
       disconnectedAt 있고 유예 안 → 접속 중 유지
       disconnectedAt 있고 유예 지남 → 목록에서 제외

     lastSeen 은 "onDisconnect 가 못 돌아 고아로 남은 기록"을 걷어내는
     용도만 남기고 창을 아주 넉넉하게(12시간) 잡습니다. 어차피 나가기
     버튼과 탭 닫기는 즉시 삭제되므로, 짧은 창이 필요하지 않습니다.

     유예도 2분 → 15분으로 늘렸습니다. 절전·창 내림으로 소켓이 잠깐
     끊기는 경우가 흔한데, 2분은 너무 짧았습니다.
     =================================================================== */
  /* [고침 2026-08-05] 15분 → 30분. 크롬 메모리 절약이 탭을 재우면
     탭에 돌아올 때까지 재연결을 못 하는데, 15분으로는 모자랐습니다. */
  const DISCONNECT_GRACE_MS = 30 * 60 * 1000;      // 끊긴 뒤 목록에 남겨두는 유예
  const ONLINE_STALE_MS     = 12 * 60 * 60 * 1000; // 고아 기록 정리용 (아주 넉넉히)
  const HEADER_TICK_MS      = 30 * 1000;

  /** 이 사람을 접속 중으로 볼 것인가 */
  function isOnline(row, now) {
    if (!row) return false;

    const disc = Number(row.disconnectedAt || 0);
    if (disc > 0 && now - disc >= DISCONNECT_GRACE_MS) return false;

    // 고아 기록만 걷어냅니다 (하루 지난 기록 등)
    const seen = Number(row.lastSeen || 0);
    if (seen > 0 && now - seen >= ONLINE_STALE_MS) return false;

    return true;
  }
  window.isOnline = isOnline;

  // 서버-클라이언트 시각 차이 (ms). .info/serverTimeOffset이 채워줍니다.
  let _serverOffset = 0;
  function serverNow() { return Date.now() + _serverOffset; }
  window.serverNow = serverNow;

  try {
    db.ref(".info/serverTimeOffset").on("value", s => {
      const v = Number(s.val());
      if (Number.isFinite(v)) _serverOffset = v;
    });
  } catch (e) {
    console.warn("[serverTimeOffset 구독 실패 — 로컬 시계로 대체]", e);
  }

  let _seenMsgKeys = new Set();

  let _msgLiveQuery = null;
  let _messagesListening = false;

  /* [뺌 2026-08-06] 뽀모가 개인 타이머가 되면서 seq·중복 방지 장치가
     필요 없어졌습니다. 서버에서 오는 이벤트가 아예 없으니까요. */

  // =====================================================
  // UI helpers
  // =====================================================
  function clearChatUI() {
    const box = document.getElementById("chat-box");
    if (box) box.innerHTML = "";

    if (typeof lastRendered !== "undefined") {
      lastRendered = { user: null, ts: 0, ymd: null, msg: "" };
    }
    if (typeof unreadCount !== "undefined") unreadCount = 0;

    const floatBtn = document.getElementById("new-msg-float");
    if (floatBtn) floatBtn.classList.add("hidden");

    _seenMsgKeys = new Set();
  }
  window.clearChatUI = clearChatUI;

  function detachMessageListeners() {
    try { if (_msgLiveQuery) _msgLiveQuery.off(); } catch(e) {}
    try { if (_clearRef) _clearRef.off(); } catch(e) {}

    _msgLiveQuery = null;
    _clearRef = null;
    _messagesListening = false;
  }
  window.detachMessageListeners = detachMessageListeners;

  window._renderMessageLocal = function(key, data){
    try {
      if (!key || !data) return;
      if (_seenMsgKeys.has(key)) return;
      _seenMsgKeys.add(key);
      window.renderChatMessage?.(document.getElementById("chat-box"), data, key);
      window.scrollChatToBottom?.(true);
    } catch(e){}
  };

  /* [2026-08-09] isPresenceSystemMsg 는 지웠습니다.
     지난 대화에서 입장·퇴장을 빼면서 부르는 곳이 없어졌어요.
     (지금 접속 중의 입장·퇴장 표시는 script_ui.js 쪽이 맡습니다) */


  // =====================================================
  // Header online list
  // =====================================================
  function updateChatHeader() {
    /* [2026-08-03] 접속 현황은 채팅 머리말이 아니라 맨 위 브랜드 줄의
       레드 박스(#head-count)에 보여줍니다. 닉 목록은 툴팁으로. */
    if (!myNick) return;
    if (_statusCache) {
      const online = [];
      const now = serverNow();
      for (let nick in _statusCache) {
        if (isOnline(_statusCache[nick], now)) online.push(nick);
      }
      const hc = document.getElementById("head-count");
      if (hc) {
        hc.textContent = `${online.length}명 집필 중`;
        hc.title = online.join(", ");
      }
    }
  }

  /* =====================================================
     [2026-08-03] 공지 핀 — 맨 위 브랜드 줄의 📌
     config/notice { text, by, at } — 보안규칙의 config 는
     로그인한 사람이면 쓸 수 있어서 규칙 변경이 필요 없습니다.
     ===================================================== */
  let _noticeText = "";
  let _noticeListening = false;
  function listenNotice() {
    if (_noticeListening) return;
    _noticeListening = true;
    try {
      db.ref("config/notice").on("value", (snap) => {
        const v = snap.val();
        _noticeText = (v && v.text) ? String(v.text) : "";
        const t = document.getElementById("head-notice-text");
        const btn = document.getElementById("head-notice");
        if (!t || !btn) return;
        t.textContent = _noticeText || "공지";
        btn.classList.toggle("empty", !_noticeText);
        btn.title = _noticeText
          /* [2026-08-06] 툴팁에서 '관리자' 언급을 뺐습니다 — 관리자 흔적을
             화면에 남기지 않기 위해서예요. 고치는 건 여전히 PIN이 필요합니다. */
          ? `📌 ${_noticeText}`
          : "공지";
      });
    } catch (e) { console.warn("[listenNotice]", e); }
  }
  function bindNoticeEdit() {
    const btn = document.getElementById("head-notice");
    if (!btn || btn._noticeBound) return;
    btn._noticeBound = true;
    btn.addEventListener("click", async () => {
      if (!myNick) { alert("입장 후에 공지를 고정할 수 있어요."); return; }
      /* [2026-08-03] 공지는 관리자 전용 — 채팅 핀과 같은 방식(관리자 핀) */
      if (AppSession.getItem("adminPinOk") !== "true") {
        if (!window.requireAdminPin?.()) return;
      }
      const next = prompt("📌 고정할 공지 (비우고 확인하면 내려요)", _noticeText);
      if (next === null) return;               // 취소
      const text = String(next).trim();
      try {
        if (text) await db.ref("config/notice").set({ text, by: myNick, at: Date.now() });
        else      await db.ref("config/notice").remove();
      } catch (e) {
        console.warn("[notice save]", e);
        alert("공지 저장에 실패했어요. 연결을 확인해 주세요.");
      }
    });
  }
  window.listenNotice = listenNotice;
  window.bindNoticeEdit = bindNoticeEdit;
  document.addEventListener("DOMContentLoaded", () => {
    try { bindNoticeEdit(); } catch (e) {}
    try { bindHeadCountDoor(); } catch (e) {}
    try { if (window.db) listenNotice(); } catch (e) {}
    /* 대기 상태(idle)에서는 집중 시간 입력이 곧 표시 시간입니다 */
    const wmIn = document.getElementById("pomo-work-min");
    if (wmIn) wmIn.addEventListener("input", () => {
      const pill = document.getElementById("timer-pill");
      const text = document.getElementById("timer-text");
      if (!pill || !text || pill.dataset.phase !== "idle") return;
      const wm = parseInt(wmIn.value, 10) || 25;
      text.textContent = `${String(wm).padStart(2, "0")}:00`;
    });
  });

  function startHeaderTicker() {
    if (_headerIntervalId) clearInterval(_headerIntervalId);
    _headerIntervalId = setInterval(() => updateChatHeader(), HEADER_TICK_MS);
    window._headerIntervalId = _headerIntervalId;
    updateChatHeader();
  }

  // =====================================================
  // ✅ 업적 오버라이드(테스트 모드): 실제 업적과 병합
  // =====================================================
  /* =====================================================================
     업적(🏆 연속 출석 · 👑 풀출석)은 없앴습니다.

     대신 그 자리에 펫이 들어갑니다. 출석은 "왔다"만 재는 지표라 글을
     썼는지와 무관했습니다. 펫은 실제로 쓴 시간으로만 자라니, 이 방이
     재는 것과 보여주는 것이 같아집니다.
     ===================================================================== */

  // =====================================================
  // status realtime
  // =====================================================
  function listenStatus() {
    _seenOnline = null;   // 다시 붙을 때는 씨앗부터 (옛 목록으로 오알림 방지)
    _statusRef = db.ref("status");
    _statusRef.on("value", snap => {
      const data = snap.val() || null;
      _statusCache = data;
      window._statusCache = data;   // ✅ 전역 노출

      detectJoins(data);
      updateChatHeader();
      renderUserCards(data);
      /* 남이 공유를 켜고 끄면 머리말 버튼 색이 따라 바뀝니다 */
      window.renderShareButton?.();
    });
  }

  /* ===================================================================
     입장 감지 — 새로 들어온 사람만 골라냅니다.

     status 리스너는 누가 lastSeen 을 갱신할 때마다 통째로 다시 옵니다.
     그래서 "지금 접속 중인 사람 집합"을 들고 있다가, 직전에 없던
     이름만 새 입장으로 봅니다.

     첫 스냅숏은 씨앗만 심고 알리지 않습니다. 안 그러면 내가 들어올 때
     이미 있던 사람 전원이 "방금 들어왔다"고 뜹니다.

     끊겼다 15분 유예 안에 돌아온 사람은 그 동안에도 접속 중으로
     잡히므로, 집합에서 빠지지 않고 다시 알리지도 않습니다. */
  let _seenOnline = null;   // null = 아직 첫 스냅숏 전

  function detectJoins(data) {
    const now = serverNow();
    const cur = new Set();

    for (const nick in (data || {})) {
      if (isOnline(data[nick], now)) cur.add(nick);
    }

    if (_seenOnline === null) { _seenOnline = cur; return; }

    const fresh = [];
    for (const nick of cur) {
      if (nick === myNick) continue;          // 내 입장은 알리지 않습니다
      if (!_seenOnline.has(nick)) fresh.push(nick);
    }
    _seenOnline = cur;

    if (fresh.length) { try { window.notifyJoin?.(fresh); } catch (e) {} }
  }

  // ✅ [프로필] 카드 그리기를 별도 함수로 분리.
  // 프로필(users/{닉}/profile)이 바뀌었을 때 status 리스너를 다시 태우지 않고
  // 캐시된 데이터로 카드만 다시 그릴 수 있게 하기 위함.
  /* ✅ [FIX] 프로필 사진 깜빡임

     이 함수는 매번 innerHTML을 비우고 카드를 새로 만들었습니다.
     <img src="data:image/jpeg;base64,…">가 새 요소로 교체되니 브라우저가
     그때마다 이미지를 다시 디코딩했고, 그게 깜빡임으로 보였습니다.

     호출 빈도가 상당했습니다.
       · status 리스너 — 각자 15초마다 lastSeen 갱신 (6명이면 분당 24회)
       · 프로필 리스너 — users/{닉} 아래 무엇이든 바뀌면.
                        투두·오늘 목표도 같은 경로라 타이핑할 때마다 발동

     그런데 lastSeen은 화면에 안 나오므로 결과 HTML은 대부분 이전과 똑같습니다.
     → 만들어진 HTML이 직전과 동일하면 DOM을 건드리지 않고 끝냅니다. */
  let _lastCardsHtml = null;

  function renderUserCards(data) {
      const list = document.getElementById("user-cards");
      if (!list) return;

      const now = serverNow();

      if (!data) {
        if (_lastCardsHtml !== "") {
          list.innerHTML = "";
          _lastCardsHtml = "";
        }
        return;
      }

      const parts = [];

      /* [2026-08-04] 내 카드는 항상 맨 앞으로.
         sort 는 안정 정렬이라 내 닉만 앞으로 빼고, 나머지의 기존 순서
         (데이터 순서·접속중 필터)는 그대로 유지됩니다. */
      const orderedNicks = Object.keys(data);
      orderedNicks.sort((a, b) =>
        (a === myNick ? -1 : 0) - (b === myNick ? -1 : 0));

      for (const u of orderedNicks) {
        const row = data[u] || {};
        if (isOnline(row, now)) {
          const st = row.status || "idle";
          const cls = statusClass(st);
          const badge = st === "writing" ? `<span class="rec-dot"></span>` : "";

          const goalText = row.todayGoalText ? escapeHtml(row.todayGoalText) : "오늘의 한줄 목표 없음";

          // ✅ 업적 표시 (테스트 오버라이드 병합)
          const streakBanner = "";
          const weeklyBanner = "";
          const banners = "";
          const goldCls = "";
          const nameBadges = "";

          // ✅ [프로필] users/{닉}/profile 값을 병합 (없으면 전부 기본값)
          const prof = (window._profileCache && window._profileCache[u]) || {};

          // 카드 강조색 — 좌측 보더. 미설정이면 CSS 기본 토큰 사용

          // 프사 — 사진이 있으면 사진, 없으면 필명으로 만든 눈사람
          const photo = window.sanitizePhoto?.(prof.photo) || "";
          const avatar = photo
            ? `<div class="card-avatar has-photo"><img src="${escapeHtml(photo)}" alt="" loading="lazy"></div>`
            : `<div class="card-avatar has-snow">${window.snowmanSvg?.(u) || ""}</div>`;

          // 내 카드에만 편집(연필) 버튼. 프사 위에 떠 있다가 마우스를 올리면 나타납니다.
          /* 카드 배경과 무늬 — 각자 프로필에서 고른 값 */
          const cardBg  = window.sanitizeHexColor?.(prof.cardBg) || "";
          const _legacyInk = window.sanitizeHexColor?.(prof.cardTextColor) || "";
          const inkNick = window.sanitizeHexColor?.(prof.cardNickColor) || _legacyInk;
          const inkGoal = window.sanitizeHexColor?.(prof.cardGoalColor) || _legacyInk;
          const inkWh   = window.sanitizeHexColor?.(prof.cardWhColor)   || _legacyInk;
          const inkStyle = (inkNick || inkGoal || inkWh)
            ? ` style="${inkNick ? `--ink-nick:${inkNick};` : ""}${inkGoal ? `--ink-goal:${inkGoal};` : ""}${inkWh ? `--ink-wh:${inkWh};` : ""}"`
            : "";
          const patId   = window.sanitizePattern?.(prof.cardPattern) || "none";
          const patCol  = window.sanitizeHexColor?.(prof.patColor) || "#D8DEE8";
          const cardStyle = (cardBg || patId !== "none")
            ? ` style="${cardBg ? `--cbg:${cardBg};` : ""}--cpat:${patCol};"`
            : "";
          const patCls = patId !== "none" ? ` pat-${patId}` : "";
          const bgCls  = cardBg ? " has-cardbg" : "";

          /* 연결 상태 안테나 — 이 사람이 지금 붙어 있는가.
             disconnectedAt 이 남아 있으면 "끊겨서 유예 중"이라는 뜻입니다. */
          const connOk = !Number(row.disconnectedAt || 0);

          const isMine = (u === myNick);

          /* TheMagam — 카드가 곧 조작판입니다. 세 곳이 각자 다른 문을 엽니다.
               프사    → 프로필 설정 (사진·색·무늬)
               상태표  → 상태 고르기 (WORK / 휴식 / 초집중 / 자리비움)
               아래칸  → 오늘 목표와 나의 투두

             그래서 예전의 ✏️ 버튼은 없앴습니다. 프사 자체가 그 버튼이에요. */
          const editBtn = "";

          /* 카드 아래 지표 — 진척 바 + [n / m 완료] ····· [🍅 k]
             둘 다 없는 사람(투두도 없고 뽀모도 안 돈 사람)은 줄 자체를 만들지 않습니다. */
          const tDone  = Math.max(0, Number(row.todoDone  || 0));
          const tTotal = Math.max(0, Number(row.todoTotal || 0));
          const pCount = Math.max(0, Number(row.pomoCount || 0));
          const pct = tTotal > 0 ? Math.round((tDone / tTotal) * 100) : 0;

          /* 진척 바 한 줄 + 그 아래 [3 / 5 완료] ······ [🍅 4].
             숫자 줄은 바와 같은 폭을 쓰므로 양 끝에 정확히 맞습니다. */
          /* [2026-08-03 · B안] 진척 바 대신 오늘 작업 시간(Write+Job)을
             큰 숫자로. WRITE·JOB 중에는 1분마다 값이 갱신돼 타이머처럼
             보입니다. 투두 진척은 카드 팝업에서 봅니다. */
          const _whMs = Math.max(0, Number(row.workMs || 0));
          const _whM = Math.round(_whMs / 60000);
          const whTxt = _whM < 60 ? `${_whM}m`
            : `${Math.floor(_whM / 60)}h${_whM % 60 ? " " + (_whM % 60) + "m" : ""}`;
          void tDone; void tTotal; void pct;
          /* [2026-08-06] 지금 뽀모를 돌리는 중이면 🍅 이 살짝 뜁니다.
             타이머는 각자 것이라 남은 시간은 모릅니다 — "달리는 중"만 보여요.
             집중이면 붉게, 휴식이면 차분하게. */
          const pRun = !!row.pomoRunning;
          const pRest = pRun && row.pomoPhase === "rest";
          const pomoChip = pRun
            ? `<span class="card-pomo-count is-live${pRest ? " is-rest" : ""}"
                     title="${pRest ? "휴식 중" : "집중 중"}${pCount > 0 ? ` · 오늘 ${pCount}회 마침` : ""}"
                     >${pRest ? "☕" : "🍅"}${pCount > 0 ? ` ${pCount}` : ""}</span>`
            : (pCount > 0
                ? `<span class="card-pomo-count" title="오늘 끝낸 집중 세션">🍅 ${pCount}</span>`
                : "");
          const metaBlock = `<div class="card-meta card-wh">
                 <span class="card-wh-t"><small>⏱</small><b>${whTxt}</b></span>
                 ${pomoChip}
               </div>`;

          // 배지 줄 — 왼쪽 업적(트로피·왕관), 오른쪽 상태
          /* 배지 줄은 비웠습니다. 상태표가 위로 올라오고, 그 아래 자리에
             펫이 들어갑니다. */
          const achChips = "";

          /* 펫 — status 에 실려 온 요약으로 그립니다.
             남의 누적 시간을 매번 계산하면 무거워지므로, 각자 자기 값을
             status 에 적어 보냅니다. */

          parts.push(`
            <div class="user-card ${cls}${goldCls}${patCls}${bgCls}${isMine ? " is-me" : ""}"
                 data-card-nick="${escapeHtml(u)}"${cardStyle}>
              <div class="card-body">
                <div class="card-avatar-wrap${isMine ? " is-clickable" : ""}"${
                  isMine ? ' data-edit-profile="1" role="button" tabindex="0"'
                         + ' title="프로필 설정 (사진·색·무늬)"' : ""}>
                  ${avatar}
                  ${editBtn}
                </div>

                <div class="card-side">
                  <div class="card-state-row">
                    <span class="card-state ${cls}${isMine ? " is-clickable" : ""}"${
                      isMine ? ' data-pick-status="1" role="button" tabindex="0" title="상태 바꾸기"' : ""
                    }>${escapeHtml(row.statusLabel || statusLabel(st))}</span>
                    <!-- 폭 기준자 — 눈에는 안 보이지만 자리는 차지합니다.
                         가장 긴 상태(🔥초집중🔥)를 모든 카드에 똑같이 심어 두면,
                         상태가 짧은 사람의 카드도 오른쪽 칸 폭이 같아집니다.
                         덕분에 카드마다 프사 크기가 들쭉날쭉해지지 않아요. -->
                    <span class="card-state-ghost" aria-hidden="true">🔥초집중🔥</span>
                  </div>
                </div>
              </div>

              <!-- [2026-08-03] 아래칸은 내 카드만 눌립니다 (목표·투두 팝업).
                   남의 작업시간은 보여주지 않습니다 — 본인만 설정 → 📊 나의 작업. -->
              <div class="card-foot"${inkStyle}${isMine
                ? ` data-record-of="${escapeHtml(u)}" role="button" tabindex="0" title="오늘 목표와 나의 투두"`
                : ""}>
                <span class="card-conn${connOk ? "" : " off"}" aria-hidden="true"
                      title="${connOk ? "연결됨" : "연결이 끊겼어요 (곧 돌아올 수 있어요)"}">
                  <i></i><i></i><i></i><i></i>
                </span>
                <div class="card-name">${escapeHtml(u)}</div>
                <div class="card-goal" title="${escapeHtml(row.todayGoalText || "")}"><div class="goal-line">🎯 ${goalText}</div></div>
                ${metaBlock}
              </div>
            </div>
          `);
        }
      }

      // 결과가 직전과 같으면 DOM을 그대로 둡니다 (이미지 재디코딩 방지)
      const html = parts.join("");
      if (html !== _lastCardsHtml) {
        list.innerHTML = html;
        _lastCardsHtml = html;
      }

      startHeaderTicker();
  }

  /* 상태 이름. 저장되는 값(writing/focus/rest/away)은 그대로 두고
     화면에 보이는 이름만 바꿨습니다. 기존 데이터가 그대로 살아납니다.
       writing → WORK      focus → 🔥초집중🔥
       rest    → 휴식      away  → 자리비움 */
  function statusLabel(code) {
    /* [2026-08-03] 상태는 Work · Break 둘뿐입니다. 저장값은 그대로
       (writing/rest), 옛 데이터의 focus/away 도 두 이름으로 접힙니다. */
    return ({
      idle:    "☕BREAK☕",
      writing: "🔥WRITE🔥",
      focus:   "💻JOB💻",
      rest:    "☕BREAK☕",
      away:    "💤AWAY💤"
    })[code] || "휴식";
  }

  function statusClass(code) {
    return ({
      idle: "status-rest",
      writing: "status-writing",
      focus: "status-focus",
      rest: "status-rest",
      away: "status-away"
    })[code] || "status-rest";
  }

  function updateStatus(force = false) {
    if (!myNick) return;

    const goalText = document.getElementById("db-today-goal-text")?.value || "";
    const done = document.getElementById("db-today-done")?.value || "";
    const statusChoice = document.getElementById("db-status")?.value || "rest";

    /* 카드에 띄울 지표 두 가지.
       둘 다 이미 가지고 있는 값이라 새로 입력받을 건 없습니다.
         - 오늘 할일 진척 : 내 투두 목록의 완료 수 / 전체 수
         - 오늘 뽀모 횟수 : 집중 세션을 끝낸 횟수 (script_ui.js가 세고 있음) */
    /* [고침 2026-08-06] 할 일에 날짜가 생긴 뒤로, 다음 달 것까지 세면
       카드 진척이 부풀어 보였습니다. 프로필 팝업이 보여주는 것과 똑같이
       "오늘 것 + 날짜 없는 것"만 셉니다 (script_data.js 의 같은 규칙). */
    const _todos = (typeof window.todosForProfileList === "function")
      ? window.todosForProfileList()
      : (Array.isArray(window._todoItems) ? window._todoItems : []);
    const todoTotal = _todos.length;
    const todoDone = _todos.filter(t => t && t.done).length;
    const pomoCount = Number(window.getTodayFocusSessions?.() || 0);
    /* [2026-08-06] 지금 집중 중인지 — 남들 카드에 작은 🍅 을 띄우는 용도.
       개인 타이머라 남은 시간은 보내지 않습니다. "달리는 중"만 알립니다. */
    const pomoRunning = (typeof isPomodoroRunning === "function") ? isPomodoroRunning() : false;
    const pomoPhaseNow = pomoRunning ? pomodoroPhase() : "";
    /* [2026-08-07] 지금 화면을 공유 중인지 — 참/거짓 한 칸뿐입니다.

       머리말의 [🖥️ 화면 공유] 버튼을, 남이 공유 중일 때도 옅은 붉은색으로
       물들이려고 둡니다. 그림은 여기 싣지 않아요. screens 를 늘 구독하면
       공유하지도 않는 사람이 5초마다 남의 그림을 내려받게 되고, 그건
       "공유 중인 사람끼리만 본다"는 약속과도 어긋납니다.
       접속자 정보는 어차피 모두가 이미 구독 중이라 통신량도 늘지 않습니다. */
    const shareOn = (typeof window.isScreenSharing === "function")
      ? window.isScreenSharing() === true : false;

    if (force) {
      window.saveDailyLog?.();
      window.backupLocal?.();
    }

    db.ref("status/" + myNick).set({
      emoji: myEmoji,
      status: statusChoice,
      statusLabel: statusLabel(statusChoice),
      todayGoalText: goalText,
      workMs: Number(window.myTodayWorkMs?.() || 0),
      todayDone: done,
      todoDone,
      todoTotal,
      pomoCount,
      pomoRunning,
      pomoPhase: pomoPhaseNow,
      shareOn,
      /* 펫 요약 — 남들 카드에도 보이게 */
      // ✅ 서버 시각으로 기록 — 각자 PC 시계가 달라도 판정이 흔들리지 않음
      lastSeen: firebase.database.ServerValue.TIMESTAMP,
      // 살아 있다는 뜻 — 끊김 표시를 지웁니다
      disconnectedAt: null
    });
  }

  // =====================================================
  // pomodoro realtime
  // =====================================================

  /* =====================================================================
     🍅 뽀모도로 — 개인 타이머

     [바뀐 이유 2026-08-06]
     예전에는 방 전체가 서버의 `pomodoro` 한 칸을 같이 봤습니다. 누가
     시작하면 모두의 타이머가 같이 돌고, 누가 멈추면 모두 멈췄어요.
     그런데 이 방은 "다 같이 하나 둘 셋" 하고 출발하는 곳이 아니라
     각자 자기 리듬으로 쓰는 곳입니다. 그러다 보니 가이드를 안 읽고
     이것저것 눌러 본 사람이 남의 집중을 통째로 끊어 버리는 사고만
     남았습니다. 그래서 타이머를 각자 것으로 돌렸습니다.

     [지금 구조]
       · 서버에 아무것도 쓰지 않습니다. 타이머는 내 브라우저 안에서만 돕니다
       · 집중/휴식 시간도 각자 마음대로 — 남에게 영향이 없습니다
       · 새로고침하거나 창을 닫았다 열어도 이어집니다 (끝나는 시각을
         이 기기에 적어 두고, 돌아왔을 때 남은 시간을 다시 계산합니다)
       · 알림 줄은 내 화면에만 뜹니다 (서버에 올리지 않습니다)
       · 도는 동안에는 내 카드에 작은 🍅 이 붙어서, 남들도 "쟤 지금
         달리는 중이구나" 정도는 볼 수 있습니다

     서버에 남는 것: 없음. 카드에 실려 나가는 pomoRunning(참/거짓)뿐.
     ===================================================================== */

  const POMO_SAVE_KEY = "pomoLocal";   // 이 기기에 저장하는 열쇠

  /* 지금 도는 세션.
       { phase:"work"|"rest", endAt, workMin, restMin, pausedLeft? }

     [일시정지를 어떻게 담는가]
     끝나는 시각(endAt)만으로는 멈춤을 표현할 수 없습니다. 시계는 계속
     흐르니까요. 그래서 멈출 때 **남은 밀리초(pausedLeft)** 를 적어 두고
     endAt 은 버립니다. 다시 이어갈 때 endAt = 지금 + 남은 시간 으로
     되살리고 pausedLeft 를 지웁니다. 이러면 몇 시간을 멈춰 두었다가
     이어가도, 창을 닫았다 열어도 남은 시간이 그대로예요. */
  let _pomo = null;

  function _isPaused() { return !!(_pomo && _pomo.pausedLeft > 0); }

  /* 내 화면에만 뜨는 알림 줄 — 서버로 나가지 않습니다 */
  function _showMyPomoLine(kind) {
    let msg = "";
    if (kind === "stop")       msg = "⏹️ 뽀모도로를 멈췄어요.";
    else if (kind === "pause") msg = "⏸️ 잠깐 멈췄어요.";
    else if (kind === "resume")msg = "▶️ 다시 이어갑니다.";
    else if (kind === "work")  msg = "🍅 집중 세션을 시작했어요!";
    else                       msg = "☁️ 휴식을 시작했어요!";
    window.addMyPomoLine?.(msg);
  }

  function _pomoSave() {
    try {
      if (_pomo) AppStore.setItem(POMO_SAVE_KEY, JSON.stringify(_pomo));
      else AppStore.removeItem(POMO_SAVE_KEY);
    } catch (e) {}
  }

  /* 새로고침 뒤 이어 달리기 — 저장해 둔 끝나는 시각을 되살립니다.
     이미 지나 버린 세션이면 살리지 않습니다. 몇 시간 뒤에 돌아왔는데
     "3시간 전에 끝난 타이머"가 되살아나면 더 이상하니까요. */
  function _pomoLoad() {
    try {
      const raw = AppStore.getItem(POMO_SAVE_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (!v) return null;
      const base = {
        phase:   v.phase === "rest" ? "rest" : "work",
        workMin: Math.max(1, Math.min(180, Number(v.workMin) || 25)),
        restMin: Math.max(1, Math.min(60,  Number(v.restMin) || 5))
      };
      /* 멈춰 둔 채 나갔으면 남은 시간 그대로 되살립니다 —
         시계가 흐른 것과 무관하니 시간이 지나도 사라지지 않습니다. */
      const left = Number(v.pausedLeft || 0);
      if (left > 0) return { ...base, endAt: 0, pausedLeft: left };
      if (!v.endAt || Number(v.endAt) <= Date.now()) return null;
      return { ...base, endAt: Number(v.endAt) };
    } catch (e) { return null; }
  }

  /* 화면에 "멈춰 있음" 을 그립니다 */
  function _paintIdle() {
    const pill = document.getElementById("timer-pill");
    const text = document.getElementById("timer-text");
    if (!pill || !text) return;
    pill.classList.remove("timer-warn");
    pill.dataset.phase = "idle";
    const wm = parseInt(document.getElementById("pomo-work-min")?.value, 10) || 25;
    text.textContent = `${String(wm).padStart(2, "0")}:00`;
    window.updatePomoHeaderStatus?.({ running: false });
    window.updatePomoSetupUI?.({ running: false });
    window.updatePomoProgressBar?.(1, 1);
  }

  /* 1초마다 도는 몸통 — 남은 시간을 다시 그리고, 다 되면 단계를 넘깁니다 */
  function _pomoTick() {
    if (!_pomo) return;
    const pill = document.getElementById("timer-pill");
    const text = document.getElementById("timer-text");
    if (!pill || !text) return;

    /* 멈춰 있으면 시계가 흘러도 숫자는 그대로입니다 */
    const remainMs = _isPaused() ? _pomo.pausedLeft : (_pomo.endAt - Date.now());
    const totalSec = (_pomo.phase === "work" ? _pomo.workMin : _pomo.restMin) * 60;
    const remainingSec = Math.max(0, Math.ceil(remainMs / 1000));

    window.updatePomoProgressBar?.(totalSec, remainingSec);
    window.updatePomoHeaderStatus?.({ running: true, mode: _pomo.phase, remainingSec });

    if (!_isPaused() && remainMs <= 0) { _pomoNextPhase(); return; }

    const mm = Math.floor(remainMs / 60000);
    const ss = Math.floor((remainMs % 60000) / 1000);
    pill.dataset.phase = _isPaused() ? "paused" : _pomo.phase;
    text.textContent = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

    const warnMin = parseInt(AppStore.getItem("warnMinutes") || "10", 10);
    pill.classList.toggle("timer-warn", !_isPaused() && remainMs <= warnMin * 60000);
  }

  /* 집중 ↔ 휴식 전환. 소리·알림·오늘 집중 횟수도 여기서 처리합니다. */
  function _pomoNextPhase() {
    if (!_pomo) return;
    const next = _pomo.phase === "work" ? "rest" : "work";
    const dur  = next === "work" ? _pomo.workMin : _pomo.restMin;

    // 집중을 끝내고 휴식으로 넘어갈 때만 "오늘 1회"를 더합니다
    if (next === "rest") window.incrementTodayFocusSessions?.();

    _pomo = { ..._pomo, phase: next, endAt: Date.now() + dur * 60 * 1000 };
    _pomoSave();

    if (next === "work") {
      window.playPomodoroSound?.("work_start");
      window.notifyPomodoro?.("work");
    } else {
      window.playPomodoroSound?.("rest_start");
      window.notifyPomodoro?.("rest");
    }
    _showMyPomoLine(next);

    window.updatePomoSetupUI?.({ running: true, workMin: _pomo.workMin, restMin: _pomo.restMin });
    updateStatus();                 // 카드의 🍅 갱신
    _pomoTick();
  }

  /* [2026-08-09] ⏸ 일시정지 / ▶ 이어가기

     멈출 때 남은 시간을 적어 두고 끝나는 시각을 버립니다. 이어갈 때
     그 반대로 합니다. 상태(WORK/BREAK)는 건드리지 않습니다 —
     잠깐 자리를 뜨는 것까지 상태로 옮기면 작업 기록이 지저분해져요. */
  function pausePomodoro() {
    if (!_pomo || _isPaused()) return;
    const left = Math.max(0, _pomo.endAt - Date.now());
    if (left <= 0) return;
    _pomo = { ..._pomo, endAt: 0, pausedLeft: left };
    _pomoSave();
    _showMyPomoLine("pause");
    renderPomoButtons();
    _pomoTick();
  }

  function resumePomodoro() {
    if (!_isPaused()) return;
    _pomo = { phase: _pomo.phase, workMin: _pomo.workMin, restMin: _pomo.restMin,
              endAt: Date.now() + _pomo.pausedLeft };
    _pomoSave();
    _showMyPomoLine("resume");
    renderPomoButtons();
    _pomoStartLoop();
  }

  /* 시작 ↔ 일시정지 를 한 버튼이 맡습니다 */
  function togglePomoRun() {
    if (!_pomo) { startPomodoro(); return; }
    if (_isPaused()) resumePomodoro();
    else pausePomodoro();
  }

  /* 버튼 줄 다시 그리기 — 도는 중에만 [정지] 가 나옵니다 */
  function renderPomoButtons() {
    const running = !!_pomo;
    const paused  = _isPaused();
    const state   = !running ? "idle" : (paused ? "paused" : "running");
    /* 조작 줄과 설정 줄 둘 다에 상태를 적습니다 — 서로 다른 줄이라 */
    ["pomo-controls", "pomo-setrow"].forEach(id => {
      const r = document.getElementById(id);
      if (r) r.dataset.state = state;
    });
    const row = document.getElementById("pomo-controls");
    if (!row) return;

    const run = document.getElementById("pomo-run-btn");
    if (run) {
      run.classList.toggle("is-pause", running && !paused);
      run.title = !running ? "내 타이머를 시작해요 (남에게는 영향 없어요)"
                : paused   ? "이어서 다시 셉니다"
                           : "잠깐 멈춰요 (남은 시간은 그대로)";
      run.setAttribute("aria-label", !running ? "뽀모도로 시작"
                                   : paused   ? "뽀모도로 이어가기" : "뽀모도로 일시정지");
    }
    /* 도는 동안에는 시간 설정을 잠급니다 — 지금 세션에는 반영되지 않으니까요 */
    ["pomo-work-min", "pomo-rest-min"].forEach(id => {
      const i = document.getElementById(id);
      if (i) i.disabled = running;
    });
  }
  window.renderPomoButtons = renderPomoButtons;

  function _pomoStartLoop() {
    if (window.pomodoroTick) { clearInterval(window.pomodoroTick); }
    window.pomodoroTick = setInterval(_pomoTick, 1000);
    _pomoTick();
  }

  /* 켤 때 한 번 부릅니다. 이름은 그대로 두었습니다 — 다른 파일들이
     이 이름으로 부르고 있어서, 바꾸면 조용히 안 도는 사고가 납니다. */
  function listenPomodoro() {
    _pomo = _pomoLoad();
    if (_pomo) {
      window.updatePomoSetupUI?.({ running: true, workMin: _pomo.workMin, restMin: _pomo.restMin });
      const wi = document.getElementById("pomo-work-min");
      const ri = document.getElementById("pomo-rest-min");
      if (wi) wi.value = _pomo.workMin;
      if (ri) ri.value = _pomo.restMin;
      _pomoStartLoop();
    } else {
      _paintIdle();
    }
    renderPomoButtons();
  }

  function startPomodoro() {
    /* 알림 권한은 "시작을 누른 그 순간"에만 물어봅니다.
       사용자 동작 없이 물으면 브라우저가 막거나 대체로 거부됩니다. */
    window.askNotifyPermissionOnce?.();

    const workInput = document.getElementById("pomo-work-min");
    const restInput = document.getElementById("pomo-rest-min");

    const workMinRaw = parseInt(workInput?.value, 10);
    const restMinRaw = parseInt(restInput?.value, 10);

    const workMin = Math.max(1, Math.min(180, Number.isFinite(workMinRaw) ? workMinRaw : 25));
    const restMin = Math.max(1, Math.min(60,  Number.isFinite(restMinRaw) ? restMinRaw : 5));

    // 클램프된 값으로 입력창도 정리
    if (workInput) workInput.value = workMin;
    if (restInput) restInput.value = restMin;

    _pomo = { phase: "work", endAt: Date.now() + workMin * 60 * 1000, workMin, restMin };
    _pomoSave();

    window.updatePomoSetupUI?.({ running: true, workMin, restMin });
    renderPomoButtons();
    window.playPomodoroSound?.("work_start");
    _showMyPomoLine("work");
    updateStatus();                 // 카드에 🍅 붙이기
    _pomoStartLoop();
  }

  function stopPomodoro() {
    const wasRunning = !!_pomo;
    _pomo = null;
    _pomoSave();
    if (window.pomodoroTick) { clearInterval(window.pomodoroTick); window.pomodoroTick = null; }
    _paintIdle();
    renderPomoButtons();
    if (wasRunning) {
      _showMyPomoLine("stop");
      updateStatus();               // 카드에서 🍅 떼기
    }
  }

  /* 카드에 실어 보낼 값 — 지금 집중 중인가 */
  function isPomodoroRunning() { return !!_pomo && !_isPaused(); }
  function pomodoroPhase() { return _pomo ? _pomo.phase : ""; }

  // =====================================================
  // messages realtime
  // =====================================================
  async function listenMessages() {
    detachMessageListeners();

    _messagesListening = true;
    clearChatUI();

    _msgRef = db.ref("messages");
    _clearRef = db.ref("chatMeta/clearedAt");

    _clearRef.on("value", snap => {
      const ts = snap.val() || 0;
      if (ts && ts !== _lastClearedAt) {
        _lastClearedAt = ts;
        clearChatUI();
      }
    });

    let joinTs = 0;
    if (typeof window._myJoinTimestamp === "function") {
      joinTs = window._myJoinTimestamp() || 0;
    }
    if (!joinTs) joinTs = Date.now() - 1200;

    // ✅ [벨사탕] 입장 히스토리: mode(on/admin/off) + count(개수), 관리자가 설정
    let showHist = true;
    let histCount = 100;
    try {
      const hs = await db.ref("chatMeta/showHistory").once("value");
      const conf = hs.val() || {};
      const mode = conf.mode || (conf.enabled === false ? "off" : "on");
      const isAdminNow = AppSession.getItem("adminPinOk") === "true";
      showHist = (mode === "on") || (mode === "admin" && isAdminNow);
      // ✅ 관리자가 '이전 채팅 불러오기'를 누른 경우: 모드와 무관하게 1회 표시
      if (window._forceHistOnce) {
        showHist = true;
        window._forceHistOnce = false;
      }
      histCount = Math.max(10, Math.min(300, parseInt(conf.count ?? 100, 10) || 100));
    } catch(e) {}

    // ✅ [벨사탕] 최근 100개는 새 입장자에게도 렌더 (OFF면 키만 등록해 중복 방지)
    // [FIX] limitToLast는 키 순서라 sys_pomo_* 같은 이름 키가 몰려 나옴 → time 기준 정렬로 변경
    // [FIX] 히스토리에는 실제 대화만 표시 (뽀모/입장/퇴장/이펙트 시스템 메시지는 제외)
    const initSnap = await _msgRef.orderByChild("time").limitToLast(Math.max(histCount, 100)).once("value");
    const box = document.getElementById("chat-box");
    const histItems = [];
    initSnap.forEach(child => {
      const key = child.key;
      const data = child.val();
      if (!key) return;
      _seenMsgKeys.add(key);
      if (!data) return;
      const t = data.type;
      const isRealChat = !t || t === "declaration" || t === "fortune";
      /* [변경 2026-08-09] 지난 대화에서 입장·퇴장 알림을 뺍니다.

         2026-08-04 에는 넣는 쪽이 맞다고 봤습니다 — 누가 다녀갔는지
         알 수 있으니까요. 그런데 그 뒤로 관리자 창에 [🚪 출입 기록]이
         생겨서, 누가 언제 들고 났는지는 그쪽에서 날짜별로 훨씬 정확히
         볼 수 있습니다. 남은 건 손해뿐이었어요 — 30개를 불러오면 그중
         절반 넘게가 "○○님이 입장했습니다" 로 채워져서, 정작 지난 대화가
         밀려났습니다.

         지금 접속 중에 들어오고 나가는 알림은 그대로 뜹니다. 여기서
         빠지는 건 "예전 것을 되짚어 보여줄 때" 뿐입니다. */
      if (isRealChat) histItems.push([key, data]);
    });
    if (showHist) {
      const toRender = histItems.slice(-histCount);
      window._lastHistRenderedCount = toRender.length;
      toRender.forEach(([key, data]) => {
        window.renderChatMessage?.(box, data, key);
      });
    } else {
      window._lastHistRenderedCount = 0;
    }

    // ✅ 관리자 토글 버튼 라벨 실시간 동기화
    try {
      if (!window._histLabelRef) {
        window._histLabelRef = db.ref("chatMeta/showHistory");
        window._histLabelRef.on("value", snap => {
          const conf = snap.val() || {};
          const mode = conf.mode || (conf.enabled === false ? "off" : "on");
          const count = Math.max(10, Math.min(300, parseInt(conf.count ?? 100, 10) || 100));
          window._historyConfCache = { mode, count };

          // 설정 패널 동기화 (열려 있으면)
          const radio = document.querySelector(`input[name="hist-mode"][value="${mode}"]`);
          if (radio) radio.checked = true;
          const cntInput = document.getElementById("hist-count-input");
          if (cntInput && document.activeElement !== cntInput) cntInput.value = String(count);
          const label = document.getElementById("hist-current-label");
          if (label) {
            const modeTxt =
              mode === "on"    ? "🕘 전체 공개" :
              mode === "admin" ? "🛡️ 관리자만" : "🙈 숨김";
            label.textContent = `현재 적용 중: ${modeTxt} · ${count}개`;
          }
        });
      }
    } catch(e) {}

    window.scrollChatToBottom?.(true);

    _msgLiveQuery = _msgRef.orderByChild("time").startAt(joinTs);

    _msgLiveQuery.on("child_added", (snap) => {
      const key = snap.key;
      const data = snap.val();
      if (!data || !key) return;

      if (_seenMsgKeys.has(key)) return;
      _seenMsgKeys.add(key);

      window.renderChatMessage?.(document.getElementById("chat-box"), data, key);

      const isSystemLike = (data.type === "system" || data.type === "fx");
      const isMine = (data.user && data.user === myNick);

      if (!isSystemLike && !isMine) {
        if (!autoScrollEnabled) {
          unreadCount += 1;
          const floatBtn = document.getElementById("new-msg-float");
          const countEl = document.getElementById("new-msg-count");
          if (countEl) countEl.textContent = String(unreadCount);
          if (floatBtn) floatBtn.classList.remove("hidden");
        } else {
          unreadCount = 0;
          const floatBtn = document.getElementById("new-msg-float");
          if (floatBtn) floatBtn.classList.add("hidden");
        }
      }

      window.scrollChatToBottom?.(false);
    });
  }

  // =====================================================
  // admin
  // =====================================================
  /* =====================================================================
     관리자 PIN 확인

     ★ 값(ADMIN_PIN·ADMIN_NICK)은 이 파일 맨 위 한 곳에만 있습니다.
       바꿀 일이 생기면 위로 올라가세요. (script_admin.js 와 동기 필요)
     ===================================================================== */
  function requireAdminPin() {
    if (AppSession.getItem("adminPinOk") === "true") return true;
    const p = prompt("관리자 PIN을 입력해 주세요");
    if (p === ADMIN_PIN) {
      AppSession.setItem("adminPinOk", "true");
      window.refreshAdminUiVisibility?.();
      return true;
    }
    alert("PIN이 올바르지 않습니다.");
    return false;
  }

  /* [2026-08-06] 아래 관리자 기능들(applyHistoryConfig · loadHistoryNow ·
     clearAllChat · clearAllWordcount · showAttendanceLog)은 설정 창에서
     버튼을 모두 걷어내 메인 화면에서는 더 이상 불리지 않습니다.
     같은 일을 관리자 페이지(admin.html)가 하고 있어요.
     지우지 않고 남겨둔 이유는 데이터 형태를 맞춰볼 참고용이기 때문입니다.
     (없어진 DOM 을 읽는 자리는 모두 ?. 나 null 검사로 감싸 뒀습니다) */

  // ✅ 히스토리 노출 설정: 라디오 + 개수 입력 → '설정 적용' 버튼으로만 반영
  async function applyHistoryConfig() {
    if (!requireAdminPin()) return;

    const sel = document.querySelector('input[name="hist-mode"]:checked');
    const mode = sel ? sel.value : "on";
    const n = parseInt(document.getElementById("hist-count-input")?.value, 10);

    if (!Number.isFinite(n) || n < 10 || n > 300) {
      alert("표시 개수는 10에서 300 사이의 숫자로 입력해 주세요!");
      return;
    }
    if (!["on", "admin", "off"].includes(mode)) return;

    const modeTxt =
      mode === "on"    ? "🕘 전체 공개 — 모든 입장자에게 이전 대화가 보여요" :
      mode === "admin" ? "🛡️ 관리자만 — 관리자로 로그인한 사람만 볼 수 있어요" :
                         "🙈 숨김 — 아무에게도 이전 대화가 보이지 않아요";
    if (!confirm(`이 설정을 적용할까요?\n\n${modeTxt}\n표시 개수: ${n}개`)) return;

    await db.ref("chatMeta/showHistory").set({
      mode,
      count: n,
      updatedBy: myNick || "admin",
      at: Date.now()
    });
    alert("✅ 히스토리 설정이 적용됐어요.");
  }

  // ✅ 이전 채팅 불러오기: 누른 관리자 본인 화면에만 과거 대화를 표시
  async function loadHistoryNow() {
    if (!requireAdminPin()) return;
    if (!myNick) { alert("먼저 작업실에 입장해 주세요!"); return; }
    window._forceHistOnce = true;
    try {
      await window.listenMessages?.();
      window.closeSettings?.();
      const n = window._lastHistRenderedCount || 0;
      if (n === 0) {
        alert("불러올 이전 대화가 아직 없어요.\n(이펙트 같은 일부 시스템 메시지는 히스토리에 포함되지 않아요)");
      }
    } catch(e) {
      window._forceHistOnce = false;
      alert("이전 채팅을 불러오지 못했어요 😢");
    }
  }

  /* ===================================================================
     ✅ [벨사탕] 접속 기록 · 출석 업적

     [FIX] 보관 기간이 짧아 업적이 제대로 안 쌓이던 문제

       · 공용 로그 attendance/{날짜}       기존 7일  → 1000일
       · 개인 출석맵 users/{닉}/attend/days 기존 14일 → 1000일

     특히 개인 출석맵이 14일이었던 게 문제였습니다.
     "지난주 월~일 풀출석"은 최대 13일 전까지 들여다봐야 하는데,
     정리 시점이 어긋나면 지난주 앞부분이 이미 지워진 뒤라 판정이 실패했습니다.
     연속 출석도 날짜맵 기준 재계산이 14일에서 막혀 그 이상 올라가지 못했고요.

     관리자 화면에 보이는 목록은 요청대로 최근 30일만 보여줍니다.
     (저장은 1000일, 표시는 30일)
     =================================================================== */
  const ATTEND_KEEP_DAYS = 1000;   // 보관
  const ATTEND_SHOW_DAYS = 30;     // 관리자 화면 표시
  const ATTEND_BACKFILL_DAYS = 60; // 예전 공용 로그에서 끌어올 범위
  const DAY_MS = 86400000;

  /* ===================================================================
     [2026-08-07] 정밀 출입 기록 — attendlog/{날짜}/{pushId}

     기존 attendance 는 하루당 한 줄입니다.
       attendance/{날짜}/{닉} = { firstAt, at, leftAt? }
     그래서 하루에 여러 번 들락거려도 **첫 입장 하나만** 남고, 퇴장은
     [나가기] 를 눌렀을 때만 찍혔습니다. "9시에 왔다가 11시에 나가고
     2시에 다시 왔다" 같은 걸 알 방법이 없었어요.

     그래서 사건을 일어난 순서대로 한 줄씩 쌓는 자리를 따로 뒀습니다.
       attendlog/{날짜}/{pushId} = { n: 닉, t: 시각, k: "in" | "out" }

     [왜 이렇게 가볍게 적는가]
     열쇠 이름을 한 글자로 줄인 건 멋이 아니라 양 때문입니다. 사람이
     늘고 날짜가 쌓이면 이 목록이 가장 빨리 자라요. 그래도 한 줄이
     50바이트 남짓이라, 열 명이 하루 세 번씩 드나들어도 하루 3KB 정도입니다.

     [기존 attendance 를 대체하지 않습니다]
     출석부·업적·휴가는 계속 attendance 를 봅니다. 이건 "그날 무슨 일이
     있었나"를 시간순으로 되짚어 보기 위한 별도의 기록이에요.
     =================================================================== */
  const ATTENDLOG_KEEP_DAYS = 180;   // 보관 — 출석부(1000일)보다 짧게 둡니다

  /* 창을 그냥 닫았을 때 대신 찍어 줄 자리를 미리 잡아 둡니다.
     [나가기] 를 누르면 이 예약을 취소하고 직접 적습니다 (두 줄 방지). */
  let _attendOutRef = null;

  async function writeAttendLog(kind) {
    if (!myNick) return;
    if (kind !== "in" && kind !== "out") return;
    try {
      const day = ymd(Date.now());
      await db.ref(`attendlog/${day}`).push({
        n: myNick,
        t: firebase.database.ServerValue.TIMESTAMP,   // 각자 시계가 아니라 서버 시각으로
        k: kind
      });
    } catch (e) {
      /* 기록이 하나 빠져도 방은 그대로 돌아가야 합니다 — 조용히 넘깁니다 */
      console.warn("[attendlog]", e);
    }
  }

  /* [핵심] 퇴장을 놓치지 않기 위한 예약.

     사람들은 [나가기] 를 잘 안 누릅니다. 그냥 탭을 닫거나, 노트북을
     덮거나, 인터넷이 끊기죠. 그때마다 퇴장 기록이 비면 이 목록은
     "들어온 줄"만 잔뜩 쌓인 반쪽짜리가 됩니다.

     그래서 입장할 때 미리 자리를 하나 잡아 두고, "연결이 끊기면 여기에
     이 내용을 적어라" 하고 **서버에** 부탁해 둡니다(onDisconnect).
     브라우저가 죽어도 서버가 대신 적어 주므로 놓치지 않아요.

     ※ 자정을 넘겨 접속해 있다가 끊기면 그 줄은 '들어온 날'쪽에 적힙니다.
        날짜를 미리 정해 두고 부탁하는 방식이라 어쩔 수 없어요.
        읽는 쪽에서 크게 문제되지 않아 그대로 둡니다. */
  async function reserveOutOnDisconnect(day) {
    if (!myNick) return;
    try {
      /* 예전 예약이 남아 있으면 먼저 거둡니다 (재접속 등) */
      try { await _attendOutRef?.onDisconnect().cancel(); } catch (e) {}
      _attendOutRef = db.ref(`attendlog/${day}`).push();
      await _attendOutRef.onDisconnect().set({
        n: myNick,
        t: firebase.database.ServerValue.TIMESTAMP,
        k: "out"
      });
    } catch (e) {
      _attendOutRef = null;
    }
  }

  /* 오래된 날짜를 지웁니다. 입장할 때 한 번만 훑어요. */
  async function sweepAttendLog() {
    try {
      const cutoff = ymd(Date.now() - (ATTENDLOG_KEEP_DAYS - 1) * DAY_MS);
      const old = await db.ref("attendlog").orderByKey().endAt(cutoff).once("value");
      const updates = {};
      old.forEach(child => { if (child.key < cutoff) updates[child.key] = null; });
      if (Object.keys(updates).length) await db.ref("attendlog").update(updates);
    } catch (e) {}
  }

  async function recordAttendance() {
    if (!myNick) return;
    const day = ymd(Date.now());

    try {
      // ---- 공용 로그 ----
      const aref = db.ref(`attendance/${day}/${myNick}`);
      const prevSnap = await aref.once("value");
      const prev = prevSnap.val();
      await aref.set({
        firstAt: prev?.firstAt || prev?.at || Date.now(),
        at: Date.now()
      });

      /* 정밀 기록에도 한 줄 — 이쪽은 들어올 때마다 쌓입니다 */
      writeAttendLog("in");
      reserveOutOnDisconnect(day);
      sweepAttendLog();

      /* 보관 기간이 지난 것만 골라 지웁니다.
         예전에는 attendance 전체를 내려받아 훑었는데, 1000일치가 쌓이면
         접속할 때마다 그 전부를 받게 됩니다. 오래된 구간만 조회하도록 바꿨습니다. */
      const cutoff = ymd(Date.now() - (ATTEND_KEEP_DAYS - 1) * DAY_MS);
      const oldSnap = await db.ref("attendance").orderByKey().endAt(cutoff).once("value");
      const updates = {};
      oldSnap.forEach(c => { if (c.key && c.key < cutoff) updates[c.key] = null; });
      if (Object.keys(updates).length) await db.ref("attendance").update(updates);

      // ---- 개인 출석맵 ----
      const uref = db.ref(`users/${myNick}/attend`);
      await uref.child(`days/${day}`).set(true);

      /* 업적 기능이 생기기 전의 공용 로그를 개인 맵으로 옮겨옵니다.
         최근 구간만 보면 충분해서 범위를 제한했습니다. */
      try {
        const recent = await db.ref("attendance")
          .orderByKey().limitToLast(ATTEND_BACKFILL_DAYS).once("value");
        const backfill = {};
        recent.forEach(c => {
          const rows = c.val();
          if (rows && rows[myNick]) backfill[c.key] = true;
        });
        if (Object.keys(backfill).length) await uref.child("days").update(backfill);
      } catch (e) {}

      // 개인 맵도 같은 기간만 보관
      const dcut = ymd(Date.now() - (ATTEND_KEEP_DAYS - 1) * DAY_MS);
      const dOld = await uref.child("days").orderByKey().endAt(dcut).once("value");
      const dupd = {};
      dOld.forEach(c => { if (c.key && c.key < dcut) dupd[c.key] = null; });
      if (Object.keys(dupd).length) await uref.child("days").update(dupd);

      // ---- 연속 출석 ----
      const yesterday = ymd(Date.now() - DAY_MS);
      const ssnap = await uref.child("streak").once("value");
      const st = ssnap.val() || {};
      let streak;
      if (st.lastDay === day) streak = Number(st.count || 1);
      else if (st.lastDay === yesterday) streak = Number(st.count || 0) + 1;
      else streak = 1;

      /* 날짜맵을 거슬러 올라가며 실제 연속일수도 계산해 더 큰 값을 씁니다.
         카운터가 어떤 이유로 끊겨도 기록만 남아 있으면 복구됩니다.
         (예전에는 60일에서 멈춰 그 이상 못 올라갔습니다) */
      try {
        const dm = (await uref.child("days").once("value")).val() || {};
        let mapStreak = 0;
        for (let i = 0; i < ATTEND_KEEP_DAYS; i++) {
          if (dm[ymd(Date.now() - i * DAY_MS)]) mapStreak++;
          else break;
        }
        if (mapStreak > streak) streak = mapStreak;
      } catch (e) {}

      await uref.child("streak").set({ count: streak, lastDay: day });

      /* 풀출석 계산은 없앴습니다 (업적 제거).
         연속일수는 남겨둡니다 — 나중에 다시 쓸 수도 있고, 저장 비용이
         거의 없습니다. 화면에는 아무것도 안 나옵니다. */
      window._myAch = { streak };

      try { updateStatus(true); } catch (e) {}
    } catch (e) { console.warn("[recordAttendance failed]", e); }
  }

  /* [2026-08-03] 퇴장 시각 — 나가기 버튼을 누를 때 찍습니다.
     (창을 그냥 닫으면 못 찍지만, 입장 기록만으로 출석은 셉니다) */
  async function recordLeaveAttendance() {
    if (!myNick) return;
    try {
      const day = ymd(Date.now());
      await db.ref(`attendance/${day}/${myNick}`).update({ leftAt: Date.now(), at: Date.now() });
      /* 예약을 먼저 거두고 직접 적습니다 — 안 그러면 창이 닫힐 때
         서버가 한 줄 더 적어서 퇴장이 두 번 찍힙니다. */
      try { await _attendOutRef?.onDisconnect().cancel(); } catch (e) {}
      _attendOutRef = null;
      await writeAttendLog("out");
    } catch (e) { console.warn("[recordLeaveAttendance]", e); }
  }
  window.recordLeaveAttendance = recordLeaveAttendance;

  /* [2026-08-03] 📅 내 출석 달력 — 누구나 자기 출석만 봅니다.
     recordAttendance 가 users/{닉}/attend/days/{날짜}=true 로 찍어둔 것을
     달력 모양으로 그립니다. ‹ › 로 지난 달도 넘겨볼 수 있어요.

     [2026-08-06] 이 달력을 여는 버튼은 머리말에서 없앴습니다.
     같은 달력이 🗂️ 나의 작업 창(script_mywork.js) 왼쪽에 통째로
     들어갔고, 거기서는 그날 할 일까지 함께 보여주니까요.

     함수는 남겨둡니다 — 지우면 콘솔에서 showMyAttendance() 로 확인하던
     길이 막히고, 나중에 관리자 페이지에서 쓸 일이 생길 수도 있습니다.
     쓰이지 않는 동안에는 아무 일도 하지 않으므로 무해합니다.
     (toggleMyVacation 도 같은 이유로 남겨둡니다. 나의 작업 창은 이
      함수를 부르지 않고 자기 것을 씁니다 — 이 함수가 끝에
      showMyAttendance 를 불러 창을 겹쳐 띄우기 때문입니다.) */
  async function showMyAttendance(monthOffset = 0) {
    if (!myNick) { alert("입장 후에 볼 수 있어요."); return; }
    let daysMap = {};
    let vacMap = {};
    try {
      const snap = await db.ref(`users/${myNick}/attend/days`).once("value");
      daysMap = snap.val() || {};
    } catch (e) {}
    /* [2026-08-05] 🏖️ 휴가 — 날짜 칸을 눌러 표시해 둔 날들 */
    try {
      const vsnap = await db.ref(`users/${myNick}/vacations`).once("value");
      vacMap = vsnap.val() || {};
    } catch (e) {}

    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() - monthOffset);
    const y = base.getFullYear(), m = base.getMonth();
    const ymKey = `${y}-${String(m + 1).padStart(2, "0")}`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const firstDow = new Date(y, m, 1).getDay();
    const todayKey = ymd(Date.now());
    let attended = 0;
    let vacCount = 0;

    let cells = `<span class="att-dow">일</span><span class="att-dow">월</span><span class="att-dow">화</span><span class="att-dow">수</span><span class="att-dow">목</span><span class="att-dow">금</span><span class="att-dow">토</span>`;
    for (let i = 0; i < firstDow; i++) cells += `<span></span>`;
    for (let d = 1; d <= lastDay; d++) {
      const key = `${ymKey}-${String(d).padStart(2, "0")}`;
      const on = !!daysMap[key];
      const vac = !!vacMap[key];
      if (on) attended++;
      if (vac) vacCount++;
      /* [2026-08-05] 날짜 칸을 누르면 휴가 토글 — 과거·미래 아무 날이나 됩니다 */
      cells += `<span class="att-day${on ? " on" : ""}${vac ? " vac" : ""}${key === todayKey ? " today" : ""}" style="cursor:pointer;" title="누르면 휴가 표시를 켜고 꺼요" onclick="toggleMyVacation('${key}', ${monthOffset})">${vac ? "🏖️" : (on ? "✓" : d)}</span>`;
    }

    document.getElementById("my-attend-modal")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "my-attend-modal";
    overlay.style.cssText = "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:7000;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);";
    overlay.innerHTML = `
      <div class="modal-content" style="width:min(360px, calc(100vw - 32px));">
        <div class="modal-title rec-weeknav" style="justify-content:center;">
          <button type="button" class="rec-nav" onclick="showMyAttendance(${monthOffset + 1})" title="지난 달">‹</button>
          <span>📅 ${y}년 ${m + 1}월 출석</span>
          <button type="button" class="rec-nav" ${monthOffset === 0 ? "disabled" : ""}
                  onclick="showMyAttendance(${monthOffset - 1})" title="다음 달">›</button>
        </div>
        <div class="modal-sub" style="text-align:center;">${escapeHtml(myNick)} · 이 달 <b>${attended}일</b> 출석했어요</div>
        <div class="att-grid">${cells}</div>
        <div class="modal-sub" style="text-align:center;margin-top:10px;">🏖️ 이번 달 휴가 <b>${vacCount}일</b></div>
        <div class="hint" style="text-align:center;margin-top:2px;">날짜를 누르면 휴가로 표시돼요</div>
        <button class="ghost-btn w-full" style="margin-top:12px;" onclick="document.getElementById('my-attend-modal').remove()">닫기</button>
      </div>`;
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }
  window.showMyAttendance = showMyAttendance;

  /* [2026-08-05] 🏖️ 휴가 토글 — 출석 달력의 날짜 칸을 누르면 켜고 끕니다.
     users/{닉}/vacations/{YYYY-MM-DD} = true 로 저장하고, 끄면 지웁니다.
     users 하위라 기존 보안규칙(닉 주인만 쓰기)이 그대로 적용돼요. */
  async function toggleMyVacation(dateKey, monthOffset = 0) {
    if (!myNick) return;
    const ref = db.ref(`users/${myNick}/vacations/${dateKey}`);
    try {
      const cur = (await ref.once("value")).val();
      if (cur) await ref.remove();
      else await ref.set(true);
    } catch (e) {
      console.warn("[toggleMyVacation]", e);
      alert("휴가 표시를 저장하지 못했어요. 연결을 확인해 주세요.");
      return;
    }
    showMyAttendance(monthOffset);   // 달력을 다시 그려 바로 보여줍니다
  }
  window.toggleMyVacation = toggleMyVacation;

  /* [2026-08-06] 🕳️ 숨은 문 — 관리자 페이지로 가는 유일한 통로.

     예전에는 머리말에 [🛡️ 관리자] 버튼이 대놓고 있었는데, 관리자
     페이지가 있다는 사실 자체를 굳이 알릴 필요가 없어 없앴습니다.
     대신 브랜드 줄의 빨간 박스(#head-count · "n명 집필 중")가 문이 됩니다.

     · 관리자 필명이 아니면 아무 일도 일어나지 않습니다.
       커서·색·툴팁(접속자 목록)을 하나도 건드리지 않아서, 남들 눈에는
       그냥 접속 인원 표시입니다. 흔적이 남지 않아요.
     · 관리자여도 한 번 누른 것만으로는 열리지 않습니다.
       그 자리는 지나가다 스칠 수 있는 곳이라, 단일 클릭으로 열면
       PIN 창이 불쑥 뜨는 오작동이 잦습니다. 그래서 더블클릭입니다. */
  function openAdminPage() {
    /* 숨은 문 밖에서(콘솔 등) 불러도 같은 검사를 지납니다 */
    if (myNick !== ADMIN_NICK) return;
    if (!requireAdminPin()) return;
    window.open("admin.html", "_blank");
  }
  window.openAdminPage = openAdminPage;

  function bindHeadCountDoor() {
    const hc = document.getElementById("head-count");
    if (!hc || hc._doorBound) return;
    hc._doorBound = true;
    /* 겉모습은 그대로 둡니다 — cursor·title 을 손대면 티가 나니까요 */
    hc.addEventListener("dblclick", () => {
      if (myNick !== ADMIN_NICK) return;   // 관리자가 아니면 무반응
      openAdminPage();
    });
  }
  window.bindHeadCountDoor = bindHeadCountDoor;

  function _closeAttendanceModal() {
    document.getElementById("attendance-modal")?.remove();
  }

  async function showAttendanceLog(monthOffset = 0) {
    if (!requireAdminPin()) return;
    try {
      /* [2026-08-03] 월별 기준 — ‹ › 로 지난 달을 넘겨봅니다.
         인원 정리는 달 단위니까, 조회도 그 달 날짜만 가져옵니다. */
      const base = new Date();
      base.setDate(1);
      base.setMonth(base.getMonth() - monthOffset);
      const ymKey = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
      const snap = await db.ref("attendance")
        .orderByKey().startAt(`${ymKey}-01`).endAt(`${ymKey}-31`).once("value");
      const v = snap.val() || {};
      const days = Object.keys(v).sort().reverse();

      /* [2026-08-03] 인원 정리용 요약 — 최근 30일 작가별 출석일수 · 마지막 출석일 */
      const per = {};
      days.forEach(d => Object.keys(v[d] || {}).forEach(n => {
        per[n] = per[n] || { days: 0, last: "" };
        per[n].days += 1;
        if (d > per[n].last) per[n].last = d;
      }));
      const summary = Object.keys(per).length ? `
        <div class="set-block" style="margin-bottom:10px;">
          <div class="set-title">👥 작가별 출석 (${ymKey.replace("-", "년 ")}월)</div>
          ${Object.entries(per).sort((a, b) => b[1].days - a[1].days).map(([n, s]) => `
            <div style="display:flex;align-items:center;gap:10px;padding:6px 4px;border-bottom:1px dashed var(--border);">
              <span style="flex:1;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(n)}</span>
              <span style="flex:0 0 auto;font-size:12px;font-weight:800;">${s.days}일</span>
              <span style="flex:0 0 auto;font-size:11.5px;color:var(--sub-muted);">마지막 ${escapeHtml(s.last.slice(5))}</span>
            </div>`).join("")}
        </div>` : "";

      let body;
      if (!days.length) {
        body = `<div class="hint" style="text-align:center;padding:20px 0;">아직 접속 기록이 없어요!</div>`;
      } else {
        body = days.map(d => {
          const rows = v[d] || {};
          const nicks = Object.keys(rows).sort((a, b) =>
            (rows[a]?.firstAt || 0) - (rows[b]?.firstAt || 0));
          const items = nicks.map(n => {
            const r = rows[n] || {};
            const first = r.firstAt || r.at;
            return `
              <div style="display:flex;align-items:center;gap:10px;padding:7px 4px;border-bottom:1px dashed var(--border);">
                <span style="font-size:17px;flex:0 0 auto;">${r.emoji || "✍️"}</span>
                <span style="flex:1;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(n)}</span>
                <span style="flex:0 0 auto;font-size:12px;font-weight:800;color:var(--sub-muted);">in ${first ? formatHHMM(first) : "-"}${r.leftAt ? " · out " + formatHHMM(r.leftAt) : ""}</span>
              </div>`;
          }).join("");
          return `
            <div class="set-block" style="margin-bottom:10px;">
              <div class="set-title" style="display:flex;justify-content:space-between;align-items:center;">
                <span>📅 ${escapeHtml(d)}</span>
                <span style="font-size:12px;color:var(--sub-muted);font-weight:900;">${nicks.length}명</span>
              </div>
              ${items}
            </div>`;
        }).join("");
      }

      _closeAttendanceModal();
      const overlay = document.createElement("div");
      overlay.id = "attendance-modal";
      overlay.style.cssText = "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:7000;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);";
      overlay.innerHTML = `
        <div class="modal-content" style="max-height:calc(100vh - 60px);display:flex;flex-direction:column;width:min(440px, calc(100vw - 32px));">
          <div class="modal-title rec-weeknav" style="justify-content:center;">
            <button type="button" class="rec-nav" onclick="showAttendanceLog(${monthOffset + 1})" title="지난 달">‹</button>
            <span>📋 출석부 · ${ymKey.replace("-", "년 ")}월</span>
            <button type="button" class="rec-nav" ${monthOffset === 0 ? "disabled" : ""}
                    onclick="showAttendanceLog(${monthOffset - 1})" title="다음 달">›</button>
          </div>
          <div class="modal-sub">작가별 출석일수와 날짜별 입·퇴장 시각이에요. (퇴장은 🚪 나가기를 눌렀을 때만 찍혀요)</div>
          <div style="flex:1;overflow:auto;min-height:0;">${summary}${body}</div>
          <div style="height:10px;"></div>
          <button class="ghost-btn" style="width:100%;" onclick="document.getElementById('attendance-modal').remove()">닫기</button>
        </div>`;
      overlay.addEventListener("click", (e) => { if (e.target === overlay) _closeAttendanceModal(); });
      document.body.appendChild(overlay);
    } catch(e) {
      console.warn("[showAttendanceLog failed]", e);
      alert("접속 기록을 불러오지 못했어요 😢");
    }
  }

  /* 업적 테스트 모드는 없앴습니다 (업적 자체가 없어졌으므로). */

  async function clearAllChat() {
    if (!requireAdminPin()) return;
    if (!confirm("정말 채팅을 모두 삭제할까요? (되돌릴 수 없어요!)")) return;

    const now = Date.now();
    await db.ref("chatMeta/clearedAt").set(now);
    await db.ref("messages").remove();
    await db.ref("messages").push({ type: "system", msg: "🧹 관리자가 채팅을 전체 삭제했습니다.", time: now });

    clearChatUI();
  }

  window.listenStatus = listenStatus;
  window.listenPomodoro = listenPomodoro;
  window.listenMessages = listenMessages;
  window.updateStatus = updateStatus;
  window.renderUserCards = renderUserCards;   // ✅ [프로필] 프로필 변경 시 재렌더용
  window.startPomodoro = startPomodoro;
  window.stopPomodoro = stopPomodoro;
  window.togglePomoRun = togglePomoRun;
  window.pausePomodoro = pausePomodoro;
  window.resumePomodoro = resumePomodoro;
  window.isPomodoroPaused = _isPaused;
  window.isPomodoroRunning = isPomodoroRunning;
  window.pomodoroPhase = pomodoroPhase;
  window.requireAdminPin = requireAdminPin;
  window.clearAllChat = clearAllChat;

  /* [2026-08-03] 관리자 — 오늘 글자수 창 초기화 (채팅 전체 삭제와 같은 결)
     오늘 날짜의 wordfeed(말풍선)와 wordlog(누적)를 지웁니다.
     보안규칙: $day 에 "삭제만" 허용하는 규칙이 필요합니다 (보안규칙.json 참고). */
  async function clearAllWordcount() {
    if (!requireAdminPin()) return;
    if (!confirm("오늘의 글자수 기록을 초기화할까요?\n모두의 오늘 기록·말풍선이 지워집니다. (되돌릴 수 없어요!)")) return;
    const day = window.Wordcount?.dayKey?.(new Date()) || new Date().toISOString().slice(0, 10);
    try {
      await db.ref(`wordfeed/${day}`).remove();
      await db.ref(`wordlog/${day}`).remove();
      alert("🧹 오늘 글자수 기록을 초기화했어요.");
    } catch (e) {
      console.warn("[clearAllWordcount]", e);
      alert("초기화하지 못했어요 — 파이어베이스 콘솔에 새 보안규칙을 적용했는지 확인해 주세요.");
    }
  }
  window.clearAllWordcount = clearAllWordcount;
  window.applyHistoryConfig = applyHistoryConfig;
  window.loadHistoryNow = loadHistoryNow;
  window.recordAttendance = recordAttendance;
  window.showAttendanceLog = showAttendanceLog;
  window.updateChatHeader = updateChatHeader;
