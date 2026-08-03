
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
  const DISCONNECT_GRACE_MS = 15 * 60 * 1000;      // 끊긴 뒤 목록에 남겨두는 유예
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

  // ✅ pomodoro 이벤트 중복 방지 (클라별)
  let _lastHandledPomoSeq = 0;

  // ✅ 입장 직후 “현재 뽀모 상태”는 이벤트로 처리하지 않기(메시지 폭탄 방지)
  let _pomoBootstrapped = false;

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

  function isPresenceSystemMsg(data) {
    return !!(data && data.type === "system" && (data.joinOf || data.leaveOf));
  }

  // ✅ [추가] 뽀모 시스템 메시지인지 판별 (입장 이전 렌더에서 제외할 용도)
  function isPomodoroSystemMsg(data) {
    return !!(data && data.type === "system" && data.pomoSeq !== undefined && data.pomoPhase !== undefined);
  }

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
        t.textContent = _noticeText || "공지를 고정할 수 있어요";
        btn.classList.toggle("empty", !_noticeText);
        btn.title = _noticeText
          ? `📌 ${_noticeText} — 눌러서 고칠 수 있어요`
          : "공지 — 눌러서 고정할 수 있어요";
      });
    } catch (e) { console.warn("[listenNotice]", e); }
  }
  function bindNoticeEdit() {
    const btn = document.getElementById("head-notice");
    if (!btn || btn._noticeBound) return;
    btn._noticeBound = true;
    btn.addEventListener("click", async () => {
      if (!myNick) { alert("입장 후에 공지를 고정할 수 있어요."); return; }
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

      for (let u in data) {
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
          const metaBlock = (tTotal > 0 || pCount > 0)
            ? `<div class="card-meta">
                 ${tTotal > 0
                   ? `<div class="card-prog-track" role="progressbar"
                           aria-valuemin="0" aria-valuemax="${tTotal}" aria-valuenow="${tDone}"
                           aria-label="오늘 할일 진척"><i style="width:${pct}%"></i></div>`
                   : ""}
                 <div class="card-meta-line">
                   <span class="card-todo-count">${
                     tTotal > 0 ? `${tDone} / ${tTotal} 완료` : ""
                   }</span>
                   ${pCount > 0
                     ? `<span class="card-pomo-count" title="오늘 끝낸 집중 세션">🍅 ${pCount}</span>`
                     : ""}
                 </div>
               </div>`
            : "";

          // 배지 줄 — 왼쪽 업적(트로피·왕관), 오른쪽 상태
          /* 배지 줄은 비웠습니다. 상태표가 위로 올라오고, 그 아래 자리에
             펫이 들어갑니다. */
          const achChips = "";

          /* 펫 — status 에 실려 온 요약으로 그립니다.
             남의 누적 시간을 매번 계산하면 무거워지므로, 각자 자기 값을
             status 에 적어 보냅니다. */

          parts.push(`
            <div class="user-card ${cls}${goldCls}${patCls}${bgCls}${isMine ? " is-me" : ""}"${cardStyle}>
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
              <div class="card-foot"${isMine
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
      writing: "🔥WORK🔥",
      focus:   "🔥WORK🔥",
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
    const _todos = Array.isArray(window._todoItems) ? window._todoItems : [];
    const todoTotal = _todos.length;
    const todoDone = _todos.filter(t => t && t.done).length;
    const pomoCount = Number(window.getTodayFocusSessions?.() || 0);

    if (force) {
      window.saveDailyLog?.();
      window.backupLocal?.();
    }

    db.ref("status/" + myNick).set({
      emoji: myEmoji,
      status: statusChoice,
      statusLabel: statusLabel(statusChoice),
      todayGoalText: goalText,
      todayDone: done,
      todoDone,
      todoTotal,
      pomoCount,
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

  async function _writePomodoroSystemMessageOnce(seq, phaseOrKind) {
    if (!seq) return;
    const key = `sys_pomo_${seq}`;

    let msg = "";
    if (phaseOrKind === "stop") msg = "⏹️ 뽀모도로가 정지됐어요.";
    else if (phaseOrKind === "work") msg = "🍅 뽀모도로 작업 세션이 시작됐어요!";
    else msg = "☁️ 뽀모도로 휴식이 시작됐어요!";

    try {
      await db.ref(`messages/${key}`).set({
        type: "system",
        msg,
        time: firebase.database.ServerValue.TIMESTAMP,
        pomoSeq: seq,
        pomoPhase: phaseOrKind
      });
    } catch(e) {
      console.warn("[write pomodoro system msg failed]", e);
    }
  }

  function _remainingSecFrom(data) {
    const endAt = Number(data?.endAt || 0);
    if (!endAt) return 0;
    return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  }

  function listenPomodoro() {
    _pomodoroRef = db.ref("pomodoro");
    _pomodoroRef.on("value", snap => {
      const data = snap.val();
      const pill = document.getElementById("timer-pill");
      const text = document.getElementById("timer-text");
      if (!pill || !text) return;

      if (window.pomodoroTick) { clearInterval(window.pomodoroTick); window.pomodoroTick = null; }
      pill.classList.remove("timer-warn");

      // ✅ stopped/없음 처리
      if (!data || data.status === "stopped") {
        window.setPomoStarter?.("");
        /* [2026-08-03] 대기 문구 대신 설정된 집중 시간을 25:00 꼴로 보여줍니다 */
        pill.dataset.phase = "idle";
        const _wm = parseInt(document.getElementById("pomo-work-min")?.value, 10) || 25;
        text.textContent = `${String(_wm).padStart(2, "0")}:00`;
        window.updatePomoHeaderStatus?.({ running:false });
        window.updatePomoSetupUI?.({ running:false });
        _lastHandledPomoSeq = 0;
        _pomoBootstrapped = false;

        window.updatePomoProgressBar?.(1, 1);
        return;
      }

      const seq = Number(data.seq || 0);
      const phase = data.phase || "work";

      /* [이식 2026-08-03 · 벨사탕 0802] 참여 버튼에 보여줄 starter — 도는 동안만.
         startedBy 가 마지막 정지(stoppedAt) 이후에 적힌 것일 때만 믿습니다.
         옛 코드로 접속한 사람이 시작을 누르면 startedBy 를 안 적어서
         지난 세션 이름이 남는데, 그 이름은 지난 정지보다 오래된 것이라
         여기서 걸러집니다. (startedAt 과 비교하면 안 됩니다: 휴식↔집중
         자동 전환 때마다 startedAt 이 갱신돼서 멀쩡한 starter 도 사라져요) */
      let _starter = "";
      if (data.startedBy) {
        const sbAt = Number(data.startedByAt || 0);
        if (sbAt && sbAt > Number(data.stoppedAt || 0)) _starter = String(data.startedBy);
      }
      window.setPomoStarter?.(_starter);

      // ✅ 진행 중인 세션의 집중/휴식 시간을 설정 UI에도 동기화(늦게 들어온 사람도 host가 정한 시간을 확인 가능)
      window.updatePomoSetupUI?.({
        running: true,
        workMin: Number(data.workMin || 25),
        restMin: Number(data.restMin || 5)
      });

      // ✅ [핵심] 첫 수신(입장 직후)에는 “현재 상태”를 이벤트로 처리하지 않음
      if (!_pomoBootstrapped) {
        _pomoBootstrapped = true;
        _lastHandledPomoSeq = seq || 0;
      } else {
        // ✅ seq 기반 이벤트 1회 처리
        if (seq && seq !== _lastHandledPomoSeq) {
          _lastHandledPomoSeq = seq;

          // ✅ 시스템 메시지는 updatedBy(버튼 누른 사람)만 작성
          const updatedBy = String(data.updatedBy || "");
          // ✅ [FIX] 최초 "시작" 클릭 시의 work 메시지는 startPomodoro().then()에서 이미 처리되지만,
          // 이후 rest→work 자동 전환(휴식이 끝나고 다시 작업 세션이 시작되는 경우)은
          // 여기서만 감지되므로 phase 종류와 무관하게 항상 기록해야 한다.
          // (같은 seq 키에 .set()으로 덮어쓰기 때문에 중복 기록돼도 안전함)
          if (updatedBy && myNick && updatedBy === myNick) {
            _writePomodoroSystemMessageOnce(seq, phase);
          }

          // 소리(개인) + 브라우저 알림 (탭이 가려져 있어도 보이게)
          if (phase === "work") {
            window.playPomodoroSound?.("work_start");
            window.notifyPomodoro?.("work");
          } else {
            window.playPomodoroSound?.("rest_start");
            window.notifyPomodoro?.("rest");
          }

          // work -> rest 전환이면 “오늘 집중 1회” 증가
          if (phase === "rest") {
            window.incrementTodayFocusSessions?.();
          }
        }
      }

      // 초기 즉시 1회 갱신
      window.updatePomoHeaderStatus?.({
        running: true,
        mode: phase,
        remainingSec: _remainingSecFrom(data)
      });

      window.pomodoroTick = setInterval(() => {
        const remainMs = (data.endAt || 0) - Date.now();
        const phaseNow = data.phase || "work";

        const workMin = Number(data.workMin || 25);
        const restMin = Number(data.restMin || 5);
        const totalSec = (phaseNow === "work" ? workMin : restMin) * 60;

        const remainingSec = Math.max(0, Math.ceil(remainMs / 1000));

        window.updatePomoProgressBar?.(totalSec, remainingSec);

        window.updatePomoHeaderStatus?.({
          running: true,
          mode: phaseNow,
          remainingSec
        });

        if (remainMs <= 0) {
          db.ref("pomodoro").transaction((cur) => {
            if (!cur || cur.status !== "running") return cur;

            const now = Date.now();
            if ((cur.endAt || 0) > now) return cur;

            const currentPhase = cur.phase || "work";
            const nextPhase = currentPhase === "work" ? "rest" : "work";
            const dur = nextPhase === "work" ? (cur.workMin || 25) : (cur.restMin || 5);

            const nextSeq = Number(cur.seq || 0) + 1;

            return {
              ...cur,
              phase: nextPhase,
              startedAt: now,
              endAt: now + dur * 60 * 1000,
              seq: nextSeq,
              updatedBy: myNick || cur.updatedBy || "unknown",
              updatedAt: now
            };
          });
          return;
        }

        /* [2026-08-03] 큰 숫자만 — 문구 없이. 휴식은 CSS 가 ☕ 를 앞에 붙입니다 */
        const mm = Math.floor(remainMs / 60000);
        const ss = Math.floor((remainMs % 60000) / 1000);
        pill.dataset.phase = phaseNow;
        text.textContent = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

        const warnMin = parseInt(AppStore.getItem("warnMinutes") || "10", 10);
        if (remainMs <= warnMin * 60000) pill.classList.add("timer-warn");
        else pill.classList.remove("timer-warn");
      }, 1000);
    });
  }

  function startPomodoro() {
    /* 알림 권한은 "시작을 누른 그 순간"에만 물어봅니다.
       사용자 동작 없이 물으면 브라우저가 막거나 대체로 거부됩니다. */
    window.askNotifyPermissionOnce?.();

    // ✅ 호스트(=지금 "시작"을 누른 사람)가 입력한 집중/휴식 시간을 읽어서 세션에 반영
    const workInput = document.getElementById("pomo-work-min");
    const restInput = document.getElementById("pomo-rest-min");

    const workMinRaw = parseInt(workInput?.value, 10);
    const restMinRaw = parseInt(restInput?.value, 10);

    const workMin = Math.max(1, Math.min(180, Number.isFinite(workMinRaw) ? workMinRaw : 25));
    const restMin = Math.max(1, Math.min(60,  Number.isFinite(restMinRaw) ? restMinRaw : 5));

    // 클램프된 값으로 입력창도 정리
    if (workInput) workInput.value = workMin;
    if (restInput) restInput.value = restMin;

    db.ref("pomodoro").transaction((cur) => {
      const now     = Date.now();
      const prevSeq = Number(cur?.seq || 0);
      const nextSeq = prevSeq + 1;

      return {
        ...(cur || {}),
        phase:     "work",
        startedAt: now,
        endAt:     now + workMin * 60 * 1000,
        status:    "running",
        updatedBy: myNick || "unknown",
        /* [이식 2026-08-03 · 벨사탕 0802] 시작 버튼을 누른 사람.
           updatedBy 는 정지·전환 때마다 바뀌지만 startedBy 는 "시작"에서만
           적혀서, 참여 버튼에 starter 를 보여주는 데 씁니다.
           startedByAt 은 검증용, stoppedAt 을 지우는 것도 같은 이유입니다. */
        startedBy:   myNick || "unknown",
        startedByAt: now,
        stoppedAt:   null,
        seq:       nextSeq,
        workMin:   workMin,
        restMin:   restMin,
        updatedAt: now
      };
    }).then((res) => {
      // ✅ stopPomodoro와 동일한 패턴: transaction 커밋 후 직접 메시지 작성
      try {
        if (!myNick) return;
        if (!res || !res.committed) return;
        const v         = res.snapshot?.val?.();
        const seq       = Number(v?.seq || 0);
        const updatedBy = String(v?.updatedBy || "");
        if (seq && updatedBy === myNick) {
          _writePomodoroSystemMessageOnce(seq, "work");
        }
      } catch(e) {}
    });
  }

  function stopPomodoro() {
    db.ref("pomodoro").transaction((cur) => {
      const now = Date.now();
      const prevSeq = Number(cur?.seq || 0);
      const nextSeq = prevSeq + 1;

      return {
        ...(cur || {}),
        status: "stopped",
        updatedBy: myNick || cur?.updatedBy || "unknown",
        seq: nextSeq,
        updatedAt: now,
        stoppedAt: now,
        phase: cur?.phase || "work"
      };
    }).then((res) => {
      // ✅ stop 메시지는 "정확한 seq"로, 그리고 버튼 누른 사람만 작성
      try {
        if (!myNick) return;
        if (!res || !res.committed) return;
        const v = res.snapshot?.val?.();
        const seq = Number(v?.seq || 0);
        const updatedBy = String(v?.updatedBy || "");
        if (seq && updatedBy === myNick) {
          _writePomodoroSystemMessageOnce(seq, "stop");
        }
      } catch(e){}
    });
  }

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
     관리자 PIN

     ★ 바꾸는 곳은 아래 ADMIN_PIN 한 줄입니다.

     ※ 이것이 진짜 잠금장치가 아니라는 점을 분명히 해둡니다.
       - 코드가 공개돼 있어서 누구나 이 숫자를 읽을 수 있습니다.
       - 브라우저 개발자도구에서 아래 한 줄이면 검사를 건너뜁니다.
             AppSession.setItem("adminPinOk", "true")

       즉 이 PIN 은 "실수로 관리자 기능을 누르는 것"을 막아줄 뿐,
       마음먹은 사람을 막지는 못합니다.

       정말로 막으려면 파이어베이스 보안 규칙으로 서버에서 걸러야 합니다.
       함께 넣어둔 "설치안내.md" 의 규칙 예시를 보세요.
     ===================================================================== */
  const ADMIN_PIN = "1009";     // ← 여기를 원하는 숫자로 바꾸세요

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
        alert("불러올 이전 대화가 아직 없어요.\n(뽀모도로·입장 알림 같은 시스템 메시지는 히스토리에 포함되지 않아요)");
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

  function _closeAttendanceModal() {
    document.getElementById("attendance-modal")?.remove();
  }

  async function showAttendanceLog() {
    if (!requireAdminPin()) return;
    try {
      /* 저장은 1000일까지 하지만, 화면에는 최근 30일만 보여줍니다.
         전체를 내려받으면 기록이 쌓일수록 무거워지므로 조회 단계에서 자릅니다. */
      const snap = await db.ref("attendance")
        .orderByKey().limitToLast(ATTEND_SHOW_DAYS).once("value");
      const v = snap.val() || {};
      const days = Object.keys(v).sort().reverse();

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
                <span style="flex:0 0 auto;font-size:12px;font-weight:800;color:var(--sub-muted);">첫 접속 ${first ? formatHHMM(first) : "-"}</span>
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
          <div class="modal-title">📋 접속 기록</div>
          <div class="modal-sub">최근 30일 · 날짜별 접속한 작가님과 첫 접속 시각이에요.</div>
          <div style="flex:1;overflow:auto;min-height:0;">${body}</div>
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
