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

  function _scrollChattyToBottom() {
    const box = _chattyBox();
    if (box) box.scrollTop = box.scrollHeight;
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

  // =====================================================
  // ✅ 탭 전환 — chat-box ↔ chat-box2
  //    입력창은 공유하므로 화면(로그 영역)만 갈아끼웁니다.
  //    메인 전용 부속(핀 배너, 새 메시지 플로트)도 같이 숨깁니다.
  // =====================================================
  function switchChatTab(tab) {
    _activeChatTab = (tab === "chatty") ? "chatty" : "main";
    const onChatty = _activeChatTab === "chatty";

    document.getElementById("chat-tab-main")?.classList.toggle("on", !onChatty);
    document.getElementById("chat-tab-chatty")?.classList.toggle("on", onChatty);

    document.getElementById("chat-box")?.classList.toggle("hidden", onChatty);
    _chattyBox()?.classList.toggle("hidden", !onChatty);
    document.getElementById("pin-banner-slot")?.classList.toggle("hidden", onChatty);
    if (onChatty) document.getElementById("new-msg-float")?.classList.add("hidden");

    // 연 탭의 안 읽음은 그 자리에서 0으로
    _tabUnread[_activeChatTab] = 0;
    _renderTabBadges();
    _renderChattyLeaveBtn();

    if (onChatty) {
      // 아직 참여 전이고 상자가 비어 있으면 안내를 채워둡니다
      const box = _chattyBox();
      if (box && !_chattyParticipating && !box.childElementCount) _renderChattyIntro();
      _scrollChattyToBottom();
    } else {
      window.scrollChatToBottom?.(true);
    }
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
        <div class="chatty-intro-title">Chatty Chat</div>
        <p class="chatty-intro-desc">
          작업 얘기 말고 그냥 수다 떠는 방이에요.<br>
          이전 대화는 보이지 않아요 — 참여한 순간부터의 메시지만 보여요.<br>
          명령어(/선언 /운세 …)는 여기선 쓸 수 없어요.
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
      `<div class="system" style="text-align:left;line-height:1.7;max-width:92%;">☕ Chatty Chat에 참여했어요. 지금부터의 메시지만 보여요.</div>`;
    _chattySeenKeys = new Set();
    _chattyLastRendered = { user: null, ts: 0, ymd: null, msg: "" };

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

      if (_activeChatTab === "chatty") {
        _scrollChattyToBottom();
      } else if (!isMine && !isSystemLike
                 && !document.body.classList.contains("chat-collapsed")) {
        // 패널이 열려 있고 다른 탭을 보는 중 → Chatty 탭에 배지
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
    _chattyParticipating = false;
    try {
      const snap = await db.ref(`users/${myNick}/chattyParticipation`).once("value");
      const v = snap.val();
      if (v && typeof v.participating === "boolean") _chattyParticipating = v.participating;
    } catch (e) {
      console.warn("[chattyParticipation load failed]", e);
    }
    if (_chattyParticipating) _attachChattyListener();
    else _renderChattyIntro();
    _renderChattyLeaveBtn();
  }

  // =====================================================
  // ✅ 퇴장/재입장 대비 — listener를 떼고 화면을 처음 상태로
  //    (참여 여부 자체는 서버에 남아 다음 입장 때 이어집니다)
  // =====================================================
  function detachChatty() {
    _detachChattyListener();
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
    // 명령어는 메인 Chat 전용 — 안내만 하고 입력은 그대로 둡니다
    if (m.startsWith("/")) {
      _chattyToast("Chatty Chat에서는 명령어를 쓸 수 없어요");
      return true;
    }

    // payload는 메인과 같은 모양 (렌더 함수를 공유하니까)
    db.ref("messages2").push({ user: myNick, emoji: myEmoji, msg: m, time: Date.now() })
      .catch(e => console.error("Chatty 전송 실패", e));
    el.value = "";
    el.style.height = "42px";
    _scrollChattyToBottom();
    return true;
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
            && _activeChatTab === "chatty"
            && !document.body.classList.contains("chat-collapsed")
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
