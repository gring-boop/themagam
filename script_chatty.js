/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_chatty.js — 두 번째 채팅방 "Chatty Chat" ☕
   ---------------------------------------------------------------------
   메인 Chat은 작업 이야기가 오가는 자리라, 수다가 길어지면 미안해지는
   분위기가 있었습니다. 그래서 수다 전용 방을 하나 더 팠습니다.

   메인 Chat과 다른 점 세 가지.
     ① 참여형 — 탭을 연다고 바로 대화가 보이지 않습니다. "참여하기"를
        눌러야 listener가 붙고, 참여 여부는 users/{닉}/chattyParticipation
        에 저장됩니다 (뽀모도로 참여 저장과 같은 모양새).
     ② 히스토리 없음 — listener가 붙은 시각 이후의 메시지만 받습니다.
        지나간 수다를 캐볼 수 없으니 마음 놓고 떠들 수 있습니다.
     ③ 명령어·핀·삭제·트림 미지원 — 일반 텍스트만 오갑니다.

   입력창과 전송 버튼은 메인 Chat과 공유합니다. 활성 탭이 Chatty면
   script_chat.js 의 send() 가 맨 위에서 window.chattySend() 로
   위임합니다 (기존 send 를 갈아엎지 않으려고 이렇게 했습니다).

   렌더는 기존 renderChatMessage 를 그대로 빌려 씁니다. 다만 그 함수가
   말풍선 묶음/날짜 구분선 판단에 쓰는 top-level lastRendered 를 메인과
   공유하면 두 방의 메시지가 서로 묶여 버리므로, 그리는 동안만 Chatty
   전용 상태로 바꿔치기했다가 되돌립니다.

   알림 규칙.
     - 패널이 접힌 동안(body.chat-collapsed) 레일 배지는 메인 Chat만
       셉니다. Chatty 메시지는 window._chattySuppressCount 깃발로
       카운트 호출(script_profile.js·script_chat.js)을 건너뜁니다.
     - 패널이 열려 있을 때 비활성 탭에 새 메시지가 오면 그 탭에
       빨간 숫자 배지(99+ 캡)가 붙고, 탭을 열면 0으로 돌아갑니다.
       내 메시지와 system/fx는 세지 않습니다.
   ===================================================================== */

  // =====================================================
  // ✅ Chatty 상태
  // =====================================================
  let _chattyParticipating = false;   // 참여 여부 (Firebase에서 로드)
  let _chattyQuery = null;            // messages2 live query
  let _chattySeenKeys = new Set();    // 중복 렌더 방지
  let _chattyLastRendered = { user: null, ts: 0, ymd: null, msg: "" };
  let _activeChatTab = "main";        // "main" | "chatty"
  let _tabUnread = { main: 0, chatty: 0 };

  function _chattyBox() { return document.getElementById("chat-box2"); }

  function _chattyToast(msg) {
    if (typeof showCommandToast === "function") showCommandToast(msg);
    else if (typeof window.showCommandToast === "function") window.showCommandToast(msg);
    else console.log("[chatty]", msg);
  }

  /* [추가 2026-08-05] 수다방에도 "연어" 보호막.

     [무엇이 잘못됐었나]
     지난 대화를 거슬러 올라가 읽는 중에 새 메시지가 오면, 화면이
     그때마다 맨 아래로 끌려 내려갔습니다. 읽던 자리를 잃으니
     차분히 되짚어 읽을 수가 없었어요.

     이제 맨 아래 근처(200px 안)를 보고 있을 때만 따라 내려갑니다.
     위로 올라가 읽는 중이면 그 자리에 그대로 머물러요. */
  let _chattyAutoScroll = true;

  function _bindChattyScrollGuard() {
    const box = _chattyBox();
    if (!box || box.dataset.chattyScrollBound === "true") return;
    box.dataset.chattyScrollBound = "true";
    box.addEventListener("scroll", () => {
      _chattyAutoScroll =
        (box.scrollHeight - box.scrollTop - box.clientHeight) <= 200;
    });
  }

  function _scrollChattyToBottom(force) {
    const box = _chattyBox();
    if (!box) return;
    if (force || _chattyAutoScroll) {
      box.scrollTop = box.scrollHeight;
      _chattyAutoScroll = true;
    }
  }

  // =====================================================
  // ✅ 탭 배지 (열린 패널의 비활성 탭용 빨간 숫자)
  // =====================================================
  function _renderTabBadges() {
    const draw = (id, n) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = n > 99 ? "99+" : String(n);
      el.classList.toggle("hidden", n <= 0);
    };
    draw("chat-tab-badge-main", _tabUnread.main);
    draw("chat-tab-badge-chatty", _tabUnread.chatty);
  }

  /* =====================================================================
     "이 방의 대화가 지금 눈에 보이는가"
     ---------------------------------------------------------------------
     [무엇이 잘못됐었나 · 2026-08-12]
     안 읽음을 세는 조건이 줄곧 **"저쪽 탭이 켜져 있나"** 였습니다.
     칸이 하나뿐이던 시절엔 그게 곧 "안 보인다" 였으니 맞는 말이었어요.

     알약 줄 배치에서는 챗과 수다방이 **따로 뜨는 판**입니다. 그래서
       · 챗을 보는 중이고 수다방 판은 닫혀 있어도 → 옛 조건은 "수다방이
         활성이 아니니 세라" 가 아니라 "챗이 활성이니 세지 마라" 가 되고,
       · 반대쪽도 마찬가지라, **양쪽 다 배지가 한 번도 안 떴습니다.**

     그래서 "보이나?" 를 화면 배치에게 물어봅니다. 세는 일은 여전히
     여기 한 곳에서만 해요 — 두 벌로 세면 언젠가 어긋나니까요.
     ===================================================================== */
  function _seeing(room) {
    const r = room === "chatty" ? "chatty" : "main";
    if (typeof window.dockSeeing === "function") return !!window.dockSeeing(r);
    /* 예전 세 칸 배치 — 켜진 탭이 곧 보이는 방 (접혀 있으면 아무것도 안 보임) */
    return _activeChatTab === r
        && !document.body.classList.contains("chat-collapsed");
  }

  /** 그 방을 읽은 것으로 — 판을 열었을 때 화면 배치가 부릅니다 */
  function markChatRead(room) {
    const r = room === "chatty" ? "chatty" : "main";
    if (!_tabUnread[r]) return;
    _tabUnread[r] = 0;
    _renderTabBadges();
  }

  // =====================================================
  // ✅ 탭 전환 — chat-box ↔ chat-box2
  //    입력창은 공유하므로 화면(로그 영역)만 갈아끼웁니다.
  //    메인 전용 부속(핀 배너, 새 메시지 플로트)도 같이 숨깁니다.
  // =====================================================
  function switchChatTab(tab) {
    _activeChatTab = (tab === "chatty") ? "chatty" : "main";
    const onChatty = _activeChatTab === "chatty";

    /* [2026-08-04] 탭 줄을 머리말로 합침 — 제목(#my-info)이 곧 메인 탭.
       Chatty를 보는 동안 제목은 살짝 흐려집니다(tab-off). */
    document.getElementById("my-info")?.classList.toggle("tab-off", onChatty);
    document.getElementById("chat-tab-chatty")?.classList.toggle("on", onChatty);

    document.getElementById("chat-box")?.classList.toggle("hidden", onChatty);
    _chattyBox()?.classList.toggle("hidden", !onChatty);
    document.getElementById("pin-banner-slot")?.classList.toggle("hidden", onChatty);
    document.getElementById("chatty-online-bar")?.classList.toggle("hidden", !onChatty);
    if (onChatty) document.getElementById("new-msg-float")?.classList.add("hidden");

    /* [2026-08-05] 탭을 건너가면 답장 대상도 접습니다 — 메인 메시지를
       가리킨 채 Chatty 로 보내는(또는 그 반대) 어긋남 방지 */
    window.cancelReply?.();

    /* 연 탭의 안 읽음은 그 자리에서 0으로.
       ★ 단 **그 방이 실제로 보일 때만.** 알약 줄 배치에서는 판을 닫아
         둔 채 글칸만 옮길 수 있는데, 그건 읽은 게 아닙니다. */
    if (_seeing(_activeChatTab)) _tabUnread[_activeChatTab] = 0;
    _renderTabBadges();
    _renderChattyLeaveBtn();

    if (onChatty) {
      // 아직 참여 전이고 상자가 비어 있으면 안내를 채워둡니다
      const box = _chattyBox();
      if (box && !_chattyParticipating && !box.childElementCount) _renderChattyIntro();
      _updateChattyCount();
      _bindChattyScrollGuard();
      _scrollChattyToBottom();
    } else {
      /* [고침 2026-08-05] 탭을 돌아왔다고 맨 아래로 끌지 않습니다 —
         위에서 읽던 중이었다면 그 자리가 그대로 남아야 하니까요. */
      window.scrollChatToBottom?.();
    }
  }

  // =====================================================
  // ✅ 접속 중인 참여자 수 — "n명 접속 중 · ☕ Chatty Chat에 참여했어요…"
  //    지금 온라인인 사람(_statusCache + isOnline) 중에서
  //    chattyParticipation 이 켜진 사람만 셉니다. 실시간 listener 를
  //    또 늘리는 대신, Chatty 탭을 보는 동안 30초마다 다시 셉니다.
  // =====================================================
  let _chattyCountTimer = null;

  function _escChatty(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function _updateChattyCount() {
    try {
      const cache = window._statusCache || {};
      const now = window.serverNow ? window.serverNow() : Date.now();
      const online = Object.keys(cache).filter(n => window.isOnline?.(cache[n], now));
      const flags = await Promise.all(online.map(async n => {
        try {
          const s = await db.ref(`users/${n}/chattyParticipation/participating`).once("value");
          return s.val() === true ? n : null;
        } catch (e) { return null; }
      }));
      const names = flags.filter(Boolean);
      const cnt = names.length;

      /* ① 탭 라벨 — "☕ Chatty (n명)". 아무도 없으면 (0명) */
      const tabCnt = document.getElementById("chatty-tab-count");
      if (tabCnt) tabCnt.textContent = `(${cnt}명)`;

      /* ② 머리말 아래 접속자 줄 — [👥 미호, 그링, 버찌]
         (안내 문구 앞의 "n명 접속 중"은 이 줄과 겹쳐서 뺐습니다 — 사용자 요청)
         핀 배너 자리처럼 한 줄로 시작해 길어지면 최대 3줄(CSS 클램프). */
      /* [고침 2026-08-12] 예전에는 줄 전체(#chatty-online-bar)에 썼습니다.
         이제 그 줄 안에 [나가기] 단추가 함께 살아서, 통째로 덮어쓰면
         단추가 지워져요. 이름만 안쪽 칸(#chatty-who)에 씁니다. */
      const who = document.getElementById("chatty-who");
      if (who) {
        who.innerHTML = cnt > 0
          ? `👥 ${names.map(_escChatty).join(", ")}`
          : `👥 아직 아무도 없어요`;
      }
    } catch (e) { /* 못 세도 문구만 없을 뿐 — 조용히 넘어갑니다 */ }
  }

  function _startChattyCountTicker() {
    if (_chattyCountTimer) clearInterval(_chattyCountTimer);
    /* 탭 라벨의 (n명)은 어느 탭을 보고 있어도 갱신돼야 해서 늘 돕니다 */
    _updateChattyCount();
    _chattyCountTimer = setInterval(_updateChattyCount, 30 * 1000);
  }

  function _renderChattyLeaveBtn() {
    const btn = document.getElementById("chatty-leave-btn");
    if (!btn) return;
    btn.classList.toggle("hidden", !(_activeChatTab === "chatty" && _chattyParticipating));
  }

  // =====================================================
  // ✅ 참여 안내 화면 (chat-box2 안에 표시)
  // =====================================================
  function _renderChattyIntro() {
    const box = _chattyBox();
    if (!box) return;
    box.innerHTML = `
      <div class="chatty-intro">
        <div class="chatty-intro-emoji">☕</div>
        <div class="chatty-intro-title">수다방</div>
        <p class="chatty-intro-desc">
          작업 얘기 말고 그냥 수다 떠는 방이에요.<br>
          이전 대화는 보이지 않아요 — 참여한 순간부터의 메시지만 보여요.<br>
          참여는 이번 접속에만 유효해요. 다음에 오면 다시 눌러주세요.<br>
          명령어(/선언 /운세 …)·답장·이모지 반응도 똑같이 쓸 수 있어요.
        </p>
        <button type="button" class="chatty-join-btn" onclick="joinChatty()">참여하기</button>
      </div>`;
  }

  // =====================================================
  // ✅ 렌더 — 기존 renderChatMessage 재사용
  //    그리는 동안 lastRendered(메인 상태)를 Chatty 상태로 바꿔치기.
  //    _chattySuppressCount 깃발로 접힘 레일/좁은화면 카운트를 막습니다.
  // =====================================================
  function _renderChattyMessage(data, key) {
    const box = _chattyBox();
    if (!box) return;
    const mainState = lastRendered;      // script_chat.js top-level let
    lastRendered = _chattyLastRendered;
    window._chattySuppressCount = true;
    try {
      window.renderChatMessage?.(box, data, key);
    } finally {
      window._chattySuppressCount = false;
      _chattyLastRendered = lastRendered;
      lastRendered = mainState;
    }
  }

  // =====================================================
  // ✅ listener 부착/해제 — 히스토리 없음이 핵심
  //    orderByChild("time").startAt(부착 시각) 이라서
  //    붙이기 전의 메시지는 애초에 내려오지 않습니다.
  // =====================================================
  function _attachChattyListener() {
    _detachChattyListener();

    const box = _chattyBox();
    if (box) box.innerHTML =
      `<div class="system" style="text-align:left;line-height:1.7;max-width:92%;">☕ 수다방에 참여했어요. 지금부터의 메시지만 보여요.</div>`;
    _updateChattyCount();
    _chattySeenKeys = new Set();
    _chattyLastRendered = { user: null, ts: 0, ymd: null, msg: "" };
    _chattyAutoScroll = true;
    _bindChattyScrollGuard();

    const attachedAt = Date.now();
    _chattyQuery = db.ref("messages2").orderByChild("time").startAt(attachedAt);
    _chattyQuery.on("child_added", (snap) => {
      const key = snap.key;
      const data = snap.val();
      if (!data || !key) return;
      if (_chattySeenKeys.has(key)) return;
      _chattySeenKeys.add(key);

      _renderChattyMessage(data, key);

      const isMine = (data.user && data.user === myNick);
      const isSystemLike = (data.type === "system" || data.type === "fx");

      if (_seeing("chatty")) {
        /* 내가 보낸 것은 무조건 따라 내려갑니다 — 방금 쓴 말은 보여야죠 */
        _scrollChattyToBottom(isMine);
      } else if (!isMine && !isSystemLike) {
        // 수다방이 안 보이는 중 → ☕ 수다방에 안 읽음 배지
        _tabUnread.chatty += 1;
        _renderTabBadges();
      }
      // 접힘 중에는 아무 배지도 올리지 않습니다 (레일 배지는 메인 전용)
    });
  }

  function _detachChattyListener() {
    try { if (_chattyQuery) _chattyQuery.off(); } catch (e) {}
    _chattyQuery = null;
  }

  // =====================================================
  // ✅ 참여하기 / 나가기 — users/{닉}/chattyParticipation
  //    (script_ui.js 의 pomoParticipation 저장 모양을 그대로 따랐습니다)
  // =====================================================
  async function joinChatty() {
    if (!myNick) { _chattyToast("먼저 작업실에 입장해 주세요!"); return; }
    _chattyParticipating = true;
    try {
      await db.ref(`users/${myNick}/chattyParticipation`).set({
        participating: true,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn("[chattyParticipation save failed]", e);
    }

    /* 🏅 ☕ 수다방 지킴이 · 안방마님 — 들어온 날을 하루로 셉니다.
       ★ [참여하기] 를 누른 자리라야 맞습니다. 탭만 열어 보는 것으로
         세면 "들어왔다" 가 아니라 "구경했다" 가 되거든요.
       같은 날 여러 번 눌러도 날짜 하나라 한 번만 셉니다. */
    try {
      const d = new Date();
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      window.achvBump?.("cha", k);
    } catch (e) {}

    _attachChattyListener();
    _renderChattyLeaveBtn();
  }

  async function leaveChatty() {
    _chattyParticipating = false;
    _detachChattyListener();
    try {
      if (myNick) {
        await db.ref(`users/${myNick}/chattyParticipation`).set({
          participating: false,
          updatedAt: Date.now()
        });
      }
    } catch (e) {
      console.warn("[chattyParticipation save failed]", e);
    }
    const box = _chattyBox();
    if (box) box.innerHTML = "";
    _renderChattyIntro();
    _tabUnread.chatty = 0;
    _renderTabBadges();
    _renderChattyLeaveBtn();
  }

  // =====================================================
  // ✅ 입장 시 초기화 — script_core.js 의 join() 에서
  //    listenMessages 직후에 불립니다.
  // =====================================================
  async function startChatty() {
    if (!myNick) return;
    /* [변경 2026-08-05] 참여는 이번 접속에만 유효합니다.

       예전에는 지난번 참여가 그대로 이어져서, 한 번 눌러본 사람이
       다음 접속에도 수다방에 들어와 있었습니다. 조용히 쓰고 싶은 날엔
       시끄럽게 느껴지고요. 이제 들어올 때마다 새로 고르게 합니다.
       (서버에 남은 값도 꺼짐으로 되돌려, 접속자 수에도 안 잡힙니다) */
    _chattyParticipating = false;
    try {
      await db.ref(`users/${myNick}/chattyParticipation`).set({
        participating: false,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn("[chattyParticipation reset failed]", e);
    }
    _renderChattyIntro();
    _renderChattyLeaveBtn();
    _startChattyCountTicker();
  }

  // =====================================================
  // ✅ 퇴장 — listener를 떼고 화면을 처음 상태로.
  //    [변경 2026-08-05] 서버의 참여 값도 함께 꺼서, 다음 접속 때
  //    다시 "참여하기"를 고르게 합니다. 나가기를 안 누르고 창을 닫아도
  //    startChatty 가 입장 때 꺼짐으로 되돌리니 결과는 같습니다.
  // =====================================================
  function detachChatty() {
    _detachChattyListener();
    if (_chattyCountTimer) { clearInterval(_chattyCountTimer); _chattyCountTimer = null; }
    if (_chattyParticipating && myNick) {
      try {
        db.ref(`users/${myNick}/chattyParticipation`)
          .set({ participating: false, updatedAt: Date.now() });
      } catch (e) {}
    }
    _chattyParticipating = false;
    _chattySeenKeys = new Set();
    _tabUnread = { main: 0, chatty: 0 };
    _renderTabBadges();
    const box = _chattyBox();
    if (box) box.innerHTML = "";
    switchChatTab("main");
  }

  // =====================================================
  // ✅ 전송 위임 — script_chat.js send() 맨 위에서 호출.
  //    true를 돌려주면 "여기서 처리했으니 send는 손 떼라"는 뜻.
  // =====================================================
  function chattySend() {
    if (_activeChatTab !== "chatty") return false;

    const el = document.getElementById("message");
    if (!el || !myNick) return true;
    const m = el.value.trim();
    if (!m) return true;

    if (!_chattyParticipating) {
      _chattyToast("먼저 참여하기를 눌러주세요 ☕");
      return true;
    }

    /* [2026-08-05] 여기서부터는 메인 send() 가 이어서 처리합니다.
       명령어(/운세 /축하 …)·답장(replyTo)·payload 구성 모두 메인과 같은
       코드를 타고, 전송 ref 만 _activeMsgRef() 가 messages2 로 갈라줍니다.
       (전송 실패 안내 — 보안규칙 미게시 등 — 도 send() 쪽 _chattySendFail 담당) */
    return false;
  }

  // =====================================================
  // ✅ 메인 Chat 렌더를 감싸서 — Chatty 탭을 보는 동안
  //    메인에 온 새 메시지를 메인 탭 배지로 셉니다.
  //    (이 파일은 script_chat.js 다음에 로드되므로 원본 export가 이미 있고,
  //     script_profile.js 가 나중에 이 wrapped 를 다시 감쌉니다 — 순서 안전)
  // =====================================================
  (function _wrapRenderForMainTabBadge() {
    const orig = window.renderChatMessage;
    if (typeof orig !== "function" || orig.__chattyPatched) return;
    const wrapped = function (box, data, key) {
      const r = orig.apply(this, arguments);
      try {
        if (box && box.id === "chat-box"
            && !_seeing("main")
            && data && data.type !== "system" && data.type !== "fx"
            && data.user && data.user !== myNick) {
          _tabUnread.main += 1;
          _renderTabBadges();
        }
      } catch (e) {}
      return r;
    };
    wrapped.__chattyPatched = true;
    window.renderChatMessage = wrapped;
  })();

  // =====================================================
  // exports
  // =====================================================
  window.switchChatTab = switchChatTab;
  window.joinChatty    = joinChatty;
  window.leaveChatty   = leaveChatty;
  window.startChatty   = startChatty;
  window.detachChatty  = detachChatty;
  window.chattySend    = chattySend;
  /* [2026-08-05] 메인 send()·reactions 가 활성 방을 알아볼 때 씁니다 */
  window.isChattyActive = () => _activeChatTab === "chatty";
  window.scrollChattyToBottom = _scrollChattyToBottom;
  /* 화면 배치가 판을 열었을 때 부릅니다 — 세는 일은 이 파일 한 곳에서만 */
  window.markChatRead = markChatRead;
