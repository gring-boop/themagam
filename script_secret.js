/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_secret.js — 세 번째 채팅방 "비밀방" 🔒 (히든·승인제)
   ---------------------------------------------------------------------
   메인 Chat(messages)·수다방(messages2) 옆에 조용히 하나 더 팠습니다.
   이 방은 아무나 들어올 수 없습니다.

     ① 히든 — 탭 버튼은 자물쇠 아이콘 하나뿐입니다. 라벨도 툴팁도
        "준비 중"이라, 승인받지 않은 사람에게는 그냥 아직 안 만든
        기능처럼 보입니다. 눌러도 "준비 중이에요" 토스트만 뜨고
        탭은 바뀌지 않아요. 방이 있다는 사실 자체가 드러나지 않습니다.
     ② 승인제 — rooms/secret/allow/{내 uid} 가 true 인 사람만 들어옵니다.
        승인은 관리자 페이지(admin.html)에서 닉네임으로 합니다.
        승인받은 사람에게만 탭 라벨이 방 이름(🔒 비밀방)으로 바뀝니다.
     ③ 히스토리 있음 — 수다방과 달리 지난 대화를 볼 수 있습니다
        (limitToLast 100). 참여하기 절차는 없습니다 — 승인이 곧 참여니까요.

   ★ 진짜 잠금은 화면이 아니라 Firebase 보안규칙이 합니다.
     messages3 의 .read/.write 가 allow 명단을 직접 확인하므로,
     승인받지 않은 사람은 콘솔로 db.ref("messages3").once(...) 를
     때려도 permission_denied 만 돌아옵니다.
     (보안규칙.json 을 Firebase 콘솔에 반드시 다시 게시해야 해요!)

   3방 전환은 script_chatty.js 가 가진 switchChatTab 을 이 파일이
   감싸서 협조합니다. 자세한 설명은 아래 _wrapSwitchChatTab 주석에.
   ===================================================================== */

  // =====================================================
  // ✅ 방 이름 — 나중에 바꾸고 싶으면 여기만 고치면 됩니다.
  //    (미승인자에게는 절대 보이지 않는 이름입니다)
  // =====================================================
  const SECRET_ROOM_NAME  = "비밀방";
  const SECRET_ROOM_EMOJI = "🔒";
  /* 미승인자에게 보여줄 위장 문구 — 방의 정체를 숨깁니다 */
  const SECRET_DECOY_LABEL = "준비 중";
  const SECRET_DECOY_TOAST = "준비 중이에요";

  const SECRET_HISTORY_COUNT = 100;   // 불러올 지난 메시지 수

  // =====================================================
  // ✅ 상태
  // =====================================================
  let _secretApproved   = false;  // rooms/secret/allow/{uid} === true
  let _secretActive     = false;  // 지금 비밀방 탭을 보고 있는가
  let _secretQuery      = null;   // messages3 live query
  let _secretSeenKeys   = new Set();
  let _secretLastRendered = { user: null, ts: 0, ymd: null, msg: "" };
  let _secretUnread     = 0;      // 비밀방 탭 배지
  let _mainUnreadInSecret = 0;    // 비밀방을 보는 동안 쌓인 메인 탭 배지
  let _secretAttachedAt = 0;      // 이 시각 이후 메시지만 "새 메시지"로 셉니다
  let _secretAutoScroll = true;

  function _secretBox() { return document.getElementById("chat-box3"); }

  function _secretToast(msg) {
    if (typeof showCommandToast === "function") showCommandToast(msg);
    else if (typeof window.showCommandToast === "function") window.showCommandToast(msg);
    else console.log("[secret]", msg);
  }

  // =====================================================
  // ✅ 스크롤 가드 — 수다방과 같은 결(맨 아래 200px 안에서만 따라감)
  // =====================================================
  function _bindSecretScrollGuard() {
    const box = _secretBox();
    if (!box || box.dataset.secretScrollBound === "true") return;
    box.dataset.secretScrollBound = "true";
    box.addEventListener("scroll", () => {
      _secretAutoScroll =
        (box.scrollHeight - box.scrollTop - box.clientHeight) <= 200;
    });
  }

  function _scrollSecretToBottom(force) {
    const box = _secretBox();
    if (!box) return;
    if (force || _secretAutoScroll) {
      box.scrollTop = box.scrollHeight;
      _secretAutoScroll = true;
    }
  }

  // =====================================================
  // ✅ 탭 버튼 — 승인 전에는 자물쇠 아이콘 하나, 승인 후에만 방 이름
  // =====================================================
  function _secretTabBtn() { return document.getElementById("chat-tab-secret"); }

  function _renderSecretTabLabel() {
    const btn = _secretTabBtn();
    if (!btn) return;
    const label = btn.querySelector("#secret-tab-label");
    if (_secretApproved) {
      btn.classList.remove("icon-only");
      btn.title = `${SECRET_ROOM_EMOJI} ${SECRET_ROOM_NAME}`;
      btn.setAttribute("aria-label", `${SECRET_ROOM_NAME} 열기`);
      if (label) label.textContent = SECRET_ROOM_NAME;
    } else {
      btn.classList.add("icon-only");
      btn.title = SECRET_DECOY_LABEL;
      btn.setAttribute("aria-label", SECRET_DECOY_LABEL);
      if (label) label.textContent = "";
    }
  }

  function _renderSecretBadge() {
    const el = document.getElementById("chat-tab-badge-secret");
    if (!el) return;
    /* 미승인자에게는 배지가 뜰 일이 없습니다 (listener 자체가 없으니까요) */
    el.textContent = _secretUnread > 99 ? "99+" : String(_secretUnread);
    el.classList.toggle("hidden", _secretUnread <= 0 || !_secretApproved);
  }

  /* 비밀방을 보는 동안 메인에 쌓인 수를 메인 탭 배지에 직접 그립니다.
     (수다방의 _tabUnread 는 그 파일 안에 갇혀 있어 손댈 수 없으므로,
      비밀방이 활성인 동안만 이 파일이 대신 그려줍니다) */
  function _drawMainBadgeFromSecret() {
    const el = document.getElementById("chat-tab-badge-main");
    if (!el) return;
    el.textContent = _mainUnreadInSecret > 99 ? "99+" : String(_mainUnreadInSecret);
    el.classList.toggle("hidden", _mainUnreadInSecret <= 0);
  }

  // =====================================================
  // ✅ 3방 전환 협조 구조
  //    switchChatTab 은 script_chatty.js 소유입니다. 그 함수를 고치는
  //    대신 여기서 감쌉니다.
  //      · switchChatTab("secret")  → 원본을 "main" 으로 한 번 돌려
  //        수다방 쪽 상태(배지·답장·부속 표시)를 정리시킨 뒤, 화면만
  //        비밀방으로 갈아끼웁니다. 원본 입장에서 활성 탭은 늘
  //        main/chatty 둘 중 하나라 기존 2방 동작이 그대로 유지됩니다.
  //      · switchChatTab("main"|"chatty") → 비밀방 화면을 걷어내고
  //        원본에게 넘깁니다.
  // =====================================================
  let _origSwitchChatTab = null;

  function _enterSecret() {
    /* 미승인자 — 아무 흔적도 남기지 않습니다. 탭도 안 바뀌고,
       "이런 방이 있다"는 낌새도 주지 않는 문구만 띄웁니다. */
    if (!_secretApproved) { _secretToast(SECRET_DECOY_TOAST); return; }

    if (_secretActive) { _scrollSecretToBottom(true); return; }

    // ① 수다방/메인 쪽 상태를 원본에게 정리시킵니다
    try { _origSwitchChatTab?.("main"); } catch (e) {}

    // ② 화면만 비밀방으로
    _secretActive = true;
    document.getElementById("my-info")?.classList.add("tab-off");
    document.getElementById("chat-tab-chatty")?.classList.remove("on");
    _secretTabBtn()?.classList.add("on");
    document.getElementById("chat-box")?.classList.add("hidden");
    document.getElementById("chat-box2")?.classList.add("hidden");
    document.getElementById("chatty-online-bar")?.classList.add("hidden");
    document.getElementById("pin-banner-slot")?.classList.add("hidden");
    document.getElementById("new-msg-float")?.classList.add("hidden");
    _secretBox()?.classList.remove("hidden");

    /* 탭을 건너가면 답장 대상도 접습니다 (수다방과 같은 이유) */
    window.cancelReply?.();

    _secretUnread = 0;
    _renderSecretBadge();
    _mainUnreadInSecret = 0;
    _drawMainBadgeFromSecret();

    _bindSecretScrollGuard();
    _scrollSecretToBottom(true);
  }

  function _exitSecretView() {
    _secretActive = false;
    _secretTabBtn()?.classList.remove("on");
    _secretBox()?.classList.add("hidden");
  }

  (function _wrapSwitchChatTab() {
    const orig = window.switchChatTab;
    if (typeof orig !== "function" || orig.__secretPatched) return;
    _origSwitchChatTab = orig;

    const wrapped = function (tab) {
      if (tab === "secret") { _enterSecret(); return; }

      const wasSecret = _secretActive;
      if (wasSecret) _exitSecretView();
      const r = orig.apply(this, arguments);

      /* 비밀방 → 수다방으로 건너갈 때, 비밀방을 보는 동안 쌓아둔
         메인 배지를 원본이 0으로 덮어쓰므로 여기서 되살립니다.
         메인으로 갈 때는 읽은 셈이니 0으로 둡니다. */
      if (wasSecret) {
        if (tab === "chatty") _drawMainBadgeFromSecret();
        else { _mainUnreadInSecret = 0; }
      }
      return r;
    };
    wrapped.__secretPatched = true;
    window.switchChatTab = wrapped;
  })();

  // =====================================================
  // ✅ 렌더 — 수다방과 같은 방식(lastRendered 스왑)
  //    renderChatMessage 가 말풍선 묶음/날짜선 판단에 쓰는 메인 상태를
  //    그리는 동안만 비밀방 것으로 바꿔치기했다가 되돌립니다.
  // =====================================================
  function _renderSecretMessage(data, key) {
    const box = _secretBox();
    if (!box) return;
    const mainState = lastRendered;      // script_chat.js top-level let
    lastRendered = _secretLastRendered;
    window._chattySuppressCount = true;  // 접힘 레일/좁은화면 카운트 차단
    try {
      window.renderChatMessage?.(box, data, key);
    } finally {
      window._chattySuppressCount = false;
      _secretLastRendered = lastRendered;
      lastRendered = mainState;
    }
  }

  // =====================================================
  // ✅ listener — 승인자에게만 붙습니다. 히스토리 100개 포함.
  // =====================================================
  function _attachSecretListener() {
    _detachSecretListener();

    const box = _secretBox();
    if (box) box.innerHTML = "";
    _secretSeenKeys = new Set();
    _secretLastRendered = { user: null, ts: 0, ymd: null, msg: "" };
    _secretAutoScroll = true;
    _bindSecretScrollGuard();

    _secretAttachedAt = Date.now();
    _secretQuery = db.ref("messages3").limitToLast(SECRET_HISTORY_COUNT);
    _secretQuery.on("child_added", (snap) => {
      const key = snap.key;
      const data = snap.val();
      if (!data || !key) return;
      if (_secretSeenKeys.has(key)) return;
      _secretSeenKeys.add(key);

      _renderSecretMessage(data, key);

      const isMine = (data.user && data.user === myNick);
      const isSystemLike = (data.type === "system" || data.type === "fx");
      /* 처음 쏟아지는 지난 대화는 "새 메시지"가 아닙니다 */
      const isFresh = (data.time || 0) >= _secretAttachedAt;

      if (_secretActive) {
        _scrollSecretToBottom(isMine);
      } else if (isFresh && !isMine && !isSystemLike
                 && !document.body.classList.contains("chat-collapsed")) {
        _secretUnread += 1;
        _renderSecretBadge();
      }
      /* 접힘 중에는 아무 배지도 올리지 않습니다 (레일 배지는 메인 전용) */
    }, (err) => {
      /* 보안규칙 미게시/승인 해제 — 조용히 접습니다 */
      console.warn("[secret listen denied]", err);
    });
  }

  function _detachSecretListener() {
    try { if (_secretQuery) _secretQuery.off(); } catch (e) {}
    _secretQuery = null;
  }

  // =====================================================
  // ✅ 입장 시 초기화 — startChatty 를 감싸서 함께 불립니다.
  //    firebase auth uid 로 승인 여부를 한 번만 확인합니다.
  // =====================================================
  async function startSecret() {
    _secretApproved = false;
    _secretUnread = 0;
    _mainUnreadInSecret = 0;
    _renderSecretTabLabel();
    _renderSecretBadge();
    if (!myNick) return;

    try {
      /* script_auth.js 가 입장 직전 로그인을 마치고 window.myUid 도 남깁니다 */
      const uid = firebase.auth().currentUser?.uid || window.myUid;
      if (!uid) return;                      // 익명/미로그인 — 미승인 취급
      const snap = await db.ref(`rooms/secret/allow/${uid}`).once("value");
      _secretApproved = (snap.val() === true);
    } catch (e) {
      _secretApproved = false;               // 못 읽으면 미승인 취급
    }

    _renderSecretTabLabel();
    if (_secretApproved) _attachSecretListener();
  }

  // =====================================================
  // ✅ 퇴장 — detachChatty 를 감싸서 함께 불립니다.
  // =====================================================
  function detachSecret() {
    _detachSecretListener();
    _secretApproved = false;
    _secretSeenKeys = new Set();
    _secretUnread = 0;
    _mainUnreadInSecret = 0;
    _renderSecretTabLabel();
    _renderSecretBadge();
    const box = _secretBox();
    if (box) box.innerHTML = "";
    if (_secretActive) {
      _exitSecretView();
      try { _origSwitchChatTab?.("main"); } catch (e) {}
    }
  }

  /* startChatty / detachChatty 에 얹기 — script_core.js 를 건드리지 않고
     입장·퇴장 시점을 같이 얻습니다 (script_reactions.js 가 join 을 감싸는 방식) */
  (function _hookSecretLifecycle() {
    const _start = window.startChatty;
    if (typeof _start === "function" && !_start.__secretPatched) {
      const wrapped = async function () {
        const r = await _start.apply(this, arguments);
        try { await startSecret(); } catch (e) { console.warn("[startSecret]", e); }
        return r;
      };
      wrapped.__secretPatched = true;
      window.startChatty = wrapped;
    }

    const _detach = window.detachChatty;
    if (typeof _detach === "function" && !_detach.__secretPatched) {
      const wrapped = function () {
        try { detachSecret(); } catch (e) {}
        return _detach.apply(this, arguments);
      };
      wrapped.__secretPatched = true;
      window.detachChatty = wrapped;
    }
  })();

  // =====================================================
  // ✅ 전송 문지기 — script_chat.js send() 맨 위에서 호출.
  //    true 를 돌려주면 "여기서 처리했으니 send 는 손 떼라".
  //    false 면 메인 send() 가 이어서 처리하고, _activeMsgRef() 가
  //    messages3 로 갈라줍니다 (명령어·답장 모두 그대로 동작).
  // =====================================================
  function secretSend() {
    if (!_secretActive) return false;

    const el = document.getElementById("message");
    if (!el || !myNick) return true;
    if (!el.value.trim()) return true;

    if (!_secretApproved) { _secretToast(SECRET_DECOY_TOAST); return true; }
    return false;
  }

  // =====================================================
  // ✅ 메인 Chat 렌더를 감싸 — 비밀방을 보는 동안 메인에 온 새 메시지를
  //    메인 탭 배지로 셉니다. (수다방의 같은 장치는 활성 탭이 "chatty"
  //    일 때만 도는데, 비밀방 중에는 원본 기준 활성 탭이 "main" 이라
  //    세지 않으므로 여기서 대신 셉니다 — 이중 카운트 없음)
  // =====================================================
  (function _wrapRenderForSecret() {
    const orig = window.renderChatMessage;
    if (typeof orig !== "function" || orig.__secretPatched) return;
    const wrapped = function (box, data, key) {
      const r = orig.apply(this, arguments);
      try {
        if (_secretActive && box && box.id === "chat-box"
            && !document.body.classList.contains("chat-collapsed")
            && data && data.type !== "system" && data.type !== "fx"
            && data.user && data.user !== myNick) {
          _mainUnreadInSecret += 1;
          _drawMainBadgeFromSecret();
        }
      } catch (e) {}
      return r;
    };
    wrapped.__secretPatched = true;
    window.renderChatMessage = wrapped;
  })();

  // =====================================================
  // exports
  // =====================================================
  window.startSecret          = startSecret;
  window.detachSecret         = detachSecret;
  window.secretSend           = secretSend;
  /* script_chat.js 의 _activeMsgRef()·_scrollActiveChat() 가 씁니다 */
  window.isSecretActive       = () => _secretActive === true;
  window.scrollSecretToBottom = _scrollSecretToBottom;
  window.secretRoomName       = () => `${SECRET_ROOM_EMOJI} ${SECRET_ROOM_NAME}`;
