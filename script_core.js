/* TheMagam © 그링링 · 무단 복제·재배포 금지 */

/* =====================================================================
     방마다 따로 기억하기 (AppStore)

     [문제] 두 방이 같은 주소(도메인)를 씁니다.

         gring-boop.github.io/BL-...      ← 벨사탕
         gring-boop.github.io/themagam/   ← TheMagam

     브라우저의 localStorage 는 **주소 단위**로 나뉩니다. 뒤의 폴더
     이름은 보지 않아요. 그래서 두 방이 같은 저장 공간을 함께 쓰고
     있었습니다. 한쪽에서 뽀모가 끝나 집중 횟수가 올라가면, 다른
     방의 카드에도 그 숫자가 그대로 나타났습니다. 테마·글씨 크기·
     칸 배치도 마찬가지로 서로 덮어썼습니다.

     [해결] 모든 열쇠 앞에 방 이름표를 붙입니다.

         pomoSessions_2026-07-31   →   tm:pomoSessions_2026-07-31

     이름표가 다르니 두 방이 서로를 건드릴 수 없습니다.

     [옮겨주기] 예전에 저장된 값은 이름표가 없습니다. 그대로 두면
     테마와 배치가 초기화된 것처럼 보이므로, 처음 한 번 옮겨옵니다.
     ===================================================================== */
const STORE_ROOM = "tm";          // 이 방의 이름표

function _mkStore(raw) {
    const P = STORE_ROOM + ":";
    return {
      getItem(k) { try { return raw.getItem(P + k); } catch (e) { return null; } },
      setItem(k, v) { try { raw.setItem(P + k, v); } catch (e) {} },
      removeItem(k) { try { raw.removeItem(P + k); } catch (e) {} },
      /* 이 방의 열쇠만 셉니다 (다른 방 것은 안 보입니다) */
      get length() {
        try { return Object.keys(raw).filter(k => k.startsWith(P)).length; }
        catch (e) { return 0; }
      },
      key(i) {
        try { return (Object.keys(raw).filter(k => k.startsWith(P))[i] || "").slice(P.length) || null; }
        catch (e) { return null; }
      }
    };
  }

const AppStore   = _mkStore(window.localStorage);
const AppSession = _mkStore(window.sessionStorage);
window.AppStore = AppStore;
window.AppSession = AppSession;

/* 이름표 없던 예전 값을 한 번만 옮겨옵니다 */
(function migrateOnce() {
    const FLAG = "_migrated_v1";
    try {
      if (AppStore.getItem(FLAG)) return;
      const P = STORE_ROOM + ":";
      Object.keys(window.localStorage).forEach(k => {
        if (k.startsWith(P) || k.includes(":")) return;   // 이미 이름표가 있으면 건너뜀
        try { window.localStorage.setItem(P + k, window.localStorage.getItem(k)); } catch (e) {}
      });
      AppStore.setItem(FLAG, "1");
    } catch (e) {}
  })();


  // =====================================================
  // ✅ Utils
  // =====================================================
  function escapeHtml(input) {
    const s = String(input ?? "");
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatHHMM(ts) {
    const n = Number(ts);
    const d = new Date(Number.isFinite(n) ? n : Date.now());
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function ymd(ts) {
    const n = Number(ts);
    const d = new Date(Number.isFinite(n) ? n : Date.now());
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  window.escapeHtml = escapeHtml;
  window.formatHHMM = formatHHMM;
  window.ymd = ymd;

  // =====================================================
  // Firebase config
  // =====================================================
  /* =====================================================================
     TheMagam 전용 파이어베이스 (프로젝트: themagam-158f7)

     벨사탕 작업실과 데이터가 완전히 분리됩니다.
     방을 옮기거나 새로 만들 때는 이 덩어리만 갈아끼우면 됩니다.
     databaseURL 이 실제 방 주소입니다 — 여기가 틀리면 아무것도 안 맞습니다.
     ===================================================================== */
  const firebaseConfig = {
    apiKey: "AIzaSyD1YV5KlgkwBSEpDupiwMcWtryrlfCFyGc",
    authDomain: "themagam-158f7.firebaseapp.com",
    databaseURL: "https://themagam-158f7-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "themagam-158f7",
    storageBucket: "themagam-158f7.firebasestorage.app",
    messagingSenderId: "429789102223",
    appId: "1:429789102223:web:22263ce9440c144baa70fa"
  };

  try {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
  } catch (e) {
    console.warn("[firebase init guarded]", e);
  }

  const db = firebase.database();
  window.db = db;

  // =====================================================
  // Global state
  // =====================================================
  let myNick = "";
  let myEmoji = "";
  let _msgRef = null, _statusRef = null;
  let _statusIntervalId = null, _backupIntervalId = null;

  let _joining = false;
  let _sessionId = "";
  let _presenceDisconnectArmed = false;

  /* =====================================================================
     하트비트 주기 (2026-08-15 — 15초 → 30초)
     ---------------------------------------------------------------------
     [왜 늘렸나] 15초마다 **한 사람이 쓰면 접속한 모두가 받습니다.**
     그래서 통신량이 사람 수의 **제곱**으로 늘어나요. 파이어베이스
     사용량을 보니 보름 만에 4.87GB — 이대로면 월 9.7GB 로 무료치
     10GB 에 닿습니다. 넘으면 요금이 아니라 **데이터베이스가 잠겨서
     방이 안 열립니다.**

     주기를 두 배로 늘리면 통신량은 절반이 됩니다(월 14.5GB → 7.3GB).

     [무엇을 잃나] 입장·퇴장이 화면에 뜨는 것이 최대 30초 늦어집니다.
     그게 전부예요. 실제로 나갔는지는 이 값이 아니라
       · onDisconnect (연결이 끊기면 서버가 그 자리에서 표시)
       · DISCONNECT_GRACE_MS 30분 유예
     가 판정하고, 고아 기록 정리(ONLINE_STALE_MS)는 12시간짜리라
     여기와 아무 상관이 없습니다. 그래서 30초는 안전합니다.

     [더 줄여야 하면] 45초로 가면 월 4.8GB 까지 떨어집니다. 다만 그쯤
     되면 "들어왔는데 한참 안 뜬다" 는 말이 나올 거예요. 그때는 주기보다
     status 줄에서 안 변하는 칸을 빼는 쪽(다이어트)이 낫습니다.
     ===================================================================== */
  const PRESENCE_POLL_MS = 30000;

  // 마지막으로 쓴 닉네임 (이 기기에만 저장)
  const LAST_NICK_KEY = "writerLastNick";
  let _myJoinTs = 0;

  window._myJoinTimestamp = function () {
    return _myJoinTs || 0;
  };

  function callIfFn(name, ...args) {
    try {
      const fn = window[name];
      if (typeof fn === "function") return fn(...args);
    } catch (e) {}
    return null;
  }

  function _ensureSessionId() {
    const k = "writerRoomSessionId";
    let sid = AppSession.getItem(k);
    if (!sid) {
      sid = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      AppSession.setItem(k, sid);
    }
    _sessionId = sid;
    return sid;
  }

  function _clearSessionId() {
    try { AppSession.removeItem("writerRoomSessionId"); } catch (e) {}
    _sessionId = "";
  }

  function detachListeners() {
    try {
      window.detachMessageListeners?.();
      _msgRef?.off();
      _statusRef?.off();
    } catch (e) {}

    _msgRef = null;
    _statusRef = null;

    if (_statusIntervalId) clearInterval(_statusIntervalId);
    if (_backupIntervalId) clearInterval(_backupIntervalId);
    if (window.pomodoroTick) clearInterval(window.pomodoroTick);
    if (window._headerIntervalId) clearInterval(window._headerIntervalId);

    _statusIntervalId = null;
    _backupIntervalId = null;
  }

  async function _writeJoinSystemMessageOnce() {
    const sid = _ensureSessionId();
    // [FIX] 같은 탭 재입장 시 키가 겹치지 않도록 입장 시각을 포함해 고유화
    const key = `sys_join_${sid}_${_myJoinTs || Date.now()}`;

    const payload = {
      type: "system",
      msg: `📢 ${myNick} 작가님이 입장하셨습니다.`,
      time: firebase.database.ServerValue.TIMESTAMP,
      joinOf: myNick,
      sid
    };

    await db.ref(`messages/${key}`).set(payload);

    // ✅ [FIX] 방에 아무도 없어 이 연결이 사실상 "막 열린" 상태일 때는,
    // messages 쿼리 리스너가 서버와의 핸드셰이크를 채 마치기 전에
    // 방금 쓴 내 입장 메시지의 child_added 이벤트를 놓치는 경우가 있었음.
    // → 쓰기 직후 내 화면에는 즉시 로컬로 반영해서, 리스너 타이밍과 무관하게
    //   항상 보이도록 함. (같은 key로 나중에 진짜 이벤트가 와도 dedupe돼서 중복 렌더 안 됨)
    window._renderMessageLocal?.(key, { ...payload, time: Date.now() });
  }

  async function _writeLeaveSystemMessageOnce() {
    const sid = _ensureSessionId();
    const key = `sys_leave_${sid}_${_myJoinTs || Date.now()}`;

    await db.ref(`messages/${key}`).set({
      type: "system",
      msg: `👋 ${myNick} 작가님이 작업실을 나갔어요.`,
      time: firebase.database.ServerValue.TIMESTAMP,
      leaveOf: myNick,
      sid
    });
  }

  /* ===================================================================
     ✅ [FIX] 창을 가려두면 접속자 목록에서 사라지던 문제

     예전 방식은 연결이 끊기는 즉시 status/{닉}을 통째로 지웠습니다.

         statusRef.onDisconnect().remove();

     크롬·엣지는 다른 창에 가려진 페이지를 hidden으로 취급해서
     타이머를 늦추고, 길어지면 WebSocket까지 정리합니다. 그때마다
     기록이 삭제돼 모두의 화면에서 바로 사라졌습니다. 유예가 없었어요.

     이제는 지우는 대신 "언제 끊겼는지"만 남깁니다.
     잠깐 끊긴 것(창 가림·절전·네트워크 순단)은 유예 시간 안에 다시
     연결되므로 목록에 계속 남고, 진짜로 나갔다면 유예가 지나 사라집니다.

     ⌐ 나가기 버튼이나 탭 닫기는 지금처럼 즉시 삭제됩니다.
     =================================================================== */
  function armPresenceOnDisconnect() {
    if (!myNick || _presenceDisconnectArmed) return;

    const statusRef = db.ref(`status/${myNick}`);

    // 끊기면 삭제 대신 끊긴 시각을 서버 시각으로 기록
    statusRef.child("disconnectedAt")
      .onDisconnect()
      .set(firebase.database.ServerValue.TIMESTAMP);

    _presenceDisconnectArmed = true;
  }

  /* ===================================================================
     연결 상태를 직접 구독합니다.

     프레즌스를 JS 타이머(setInterval)에 기대면, 브라우저가 백그라운드
     페이지의 타이머를 늦추거나 멈추는 순간 흔들립니다. 반면 Firebase의
     .info/connected는 소켓 상태를 그대로 알려주므로 스로틀링과 무관합니다.

     연결이 돌아오는 즉시 상태를 다시 쓰고 onDisconnect를 재등록합니다.
     =================================================================== */
  /* ===================================================================
     연결 상태를 화면에 표시합니다.

     지금까지는 끊겨도 사용자가 알 방법이 없었습니다. 다른 분 화면에서
     내가 사라져도, 내 화면은 멀쩡해 보이니까요. 머리말에 작게 띄워두면
     "지금 끊겼구나"를 바로 알 수 있고, 문제를 알려주실 때도 정확해집니다.
     =================================================================== */
  let _offlineSinceUi = 0;
  let _connUiTimer = null;

  function paintConnBadge(up) {
    /* [변경] 머리말 배지 → 카드 아래 상자의 안테나로 옮겼습니다.

       내 카드의 안테나는 DB 값만으로는 알 수 없습니다. 끊긴 동안에는
       내가 DB에 아무것도 쓸 수 없으니까요. 그래서 body 에 표시를 달고,
       CSS 가 내 카드의 안테나만 "끊김" 모양으로 바꿉니다. */
    document.body.classList.toggle("conn-down", !up);

    if (up) { _offlineSinceUi = 0; return; }
    if (!_offlineSinceUi) _offlineSinceUi = Date.now();
  }

  window.paintConnBadge = paintConnBadge;

  let _connectedBound = false;
  function bindConnectionWatcher() {
    if (_connectedBound) return;
    _connectedBound = true;

    db.ref(".info/connected").on("value", (snap) => {
      const up = !!snap.val();
      try { paintConnBadge(up); } catch (e) {}

      if (!up) return;               // 끊김 — 서버가 알아서 표시해 줍니다
      if (!myNick) return;

      // 재연결됨 → 끊김 표시를 지우고 즉시 현재 상태를 다시 기록
      _presenceDisconnectArmed = false;
      try { armPresenceOnDisconnect(); } catch (e) {}
      try { db.ref(`status/${myNick}/disconnectedAt`).remove(); } catch (e) {}
      /* ★ 끊긴 사이에 서버 쪽 내 줄이 어떻게 됐는지 알 수 없습니다.
         "같은 화면이면 안 보내기"(script_realtime.js)가 이 한 번을
         건너뛰지 않도록, 기억해 둔 지문을 지우고 통째로 다시 보냅니다. */
      window.forgetStatusSig?.();
      callIfFn("updateStatus", true);
    });
  }

  async function cancelPresenceOnDisconnect() {
    if (!myNick || !_presenceDisconnectArmed) return;
    await db.ref(`status/${myNick}/disconnectedAt`).onDisconnect().cancel();
    _presenceDisconnectArmed = false;
  }

  function getDailyEmoji(nick) {
    const emojis = [
      // 🌸 꽃/식물 (컬러풀)
      "🌸","🌺","🌻","🌹","🌷","💐","🌼","🪷","🌿","🍀",
      "🍁","🍂","🍃","☘️","🌱","🌲","🌳","🌴","🌵","🎋",
      "🎍","🪴","🌾","🍄","🌰","🪸","🫧",
      // ⭐ 별/빛/우주
      "⭐","🌟","✨","💫","⚡","🌈","🌙","🌛","🌜","🌝",
      "🌞","☀️","🌤️","⛅","🌦️","🌈","🪐","🌍","🌏","🌌",
      "🔮","🪄","🎆","🎇","🧨","✴️","🌠","💥","🌀","❄️",
      // 💖 하트/감정 (핑크/컬러)
      "💖","💗","💓","💞","💕","💝","❤️","🧡","💛","💚",
      "💙","💜","🖤","🤍","🤎","❤️‍🔥","❤️‍🩹","💔","💟","☮️",
      "🫀","🫶","💌","💋","🥰","😍","🤩","😻","💯","🎀",
      // 🦋 동물/귀여운
      "🦋","🐝","🌸","🐞","🦄","🐉","🦊","🐼","🐨","🦁",
      "🐯","🐸","🐧","🦜","🦩","🦚","🦋","🐬","🦭","🦈",
      "🐙","🦑","🦀","🐡","🐠","🐟","🦓","🦒","🐘","🦘",
      "🦔","🐇","🐿️","🦫","🦦","🦥","🐾","🐉","🐲","🦕",
      // 🍭 음식/간식 (알록달록)
      "🍭","🍬","🍫","🍩","🍰","🎂","🧁","🍓","🍒","🍑",
      "🥭","🍍","🍋","🍊","🍎","🍇","🫐","🍈","🥝","🍅",
      "🌽","🥕","🫑","🌶️","🥑","🍆","🎃","🫒",
      // 💎 보석/마법/판타지
      "💎","💍","👑","🏆","🥇","🎖️","🎗️","🎫","🎟️","🎪",
      "🪅","🎠","🎡","🎢","🎨","🖼️","🎭","🎪","🪩","🎊",
      "🎉","🎈","🎁","🛍️","🧸","🪆","🎯","🎲","🎮","🕹️",
      // 🌊 자연/날씨
      "🌊","🏔️","🗻","🌋","🏝️","🏖️","🌅","🌄","🌠","🎑",
      "🍀","🌺","🏵️","💮","🪷","🌸","🌼","🌻","🌹","🥀",
      // 🪐 우주/신비
      "🪐","🌌","🔭","🛸","🚀","🛰️","☄️","🌑","🌒","🌓",
      "🌔","🌕","🌖","🌗","🌘","🌙","🌚","🌛","🌜","🌝",
      // ✏️ 작가/창작 (테마)
      "✏️","📝","🖊️","🖋️","📖","📚","📕","📗","📘","📙",
      "📓","📔","📒","📃","🗃️",
      "🎬","🎥","📷","📸","🎞️","📽️","🎞️","🎙️",
      // 🎵 음악/예술
      "🎵","🎶","🎼","🎹","🥁","🎷","🎺","🎸","🪕","🎻",
      "🪗","🎤","🎧","🎨","🖌️","🖍️","✒️","🖊️","🎭","🎪",
      // 🌈 무지개/컬러
      "🌈","🎨","🖌️","🎆","🎇","🧶","🧵","🪡","🎀","🪢",
      "🧿","🪬","🧲","💡","🕯️","🪔","🔦","🏮","🪩","🎱"
    ];

    // ✅ [프로필] 사용자가 "이 이모지로 고정"을 켜둔 경우 랜덤 배정을 건너뜀.
    // Firebase(users/{닉}/profile)가 정본이지만 join()은 동기 호출이라
    // 테마와 동일하게 localStorage 캐시를 먼저 읽는다. (script_profile.js가 동기화)
    try {
      const locked = AppStore.getItem(`writerEmojiLock_${nick}`);
      if (locked) return locked;
    } catch (e) {}

    // 중복 제거
    const unique = [...new Set(emojis)];

    let hash = 0;
    const seed = nick + new Date().toISOString().slice(0, 10);
    for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    return unique[Math.abs(hash) % unique.length];
  }

  async function join() {
    if (_joining || myNick) return;

    const inputEl = document.getElementById("nick-input");
    const input = (inputEl?.value || "").trim();
    if (!input) return alert("닉네임을 입력해주세요!");

    _joining = true;

    try {
      // ✅ [FIX] 관리자 인증은 닉네임이 아닌 탭에 남아 있었음 →
      // 입장할 때마다 초기화해서, 재입장한 사람이 자동으로 관리자 취급되는 것을 방지
      try { AppSession.removeItem("adminPinOk"); } catch(e) {}
      try { window.refreshAdminUiVisibility?.(); } catch(e) {}

      detachListeners();

      myNick = input;
      myEmoji = getDailyEmoji(myNick);
      _ensureSessionId();

      // ✅ 다음 접속 때 입력창에 채워두기 위해 닉네임을 기억합니다 (이 기기에만)
      try { AppStore.setItem(LAST_NICK_KEY, myNick); } catch (e) {}

      // joinTs: 입장 직전 1.2초만 허용 (이전 로그 거의 안 보이게)
      _myJoinTs = Date.now() - 1200;

      document.getElementById("modal").style.display = "none";
      document.getElementById("exit-screen").classList.add("hidden");
      /* [2026-08-03] 채팅 머리말은 "Chat" 고정 — 접속 현황은 맨 위 브랜드 줄로 갔습니다 */
      document.getElementById("my-info").innerText = "Chat";

      // ✅ 1) 닉 귀속 테마 먼저 로드/적용 (UI 안정화)
      try { await window.afterJoinLoadNickTheme?.(); } catch(e){ console.warn("[afterJoinLoadNickTheme failed]", e); }

      // ✅ 2) 메시지 리슨
      await window.listenMessages?.();

      // ✅ 2-1) Chatty Chat 초기화 — 참여 여부 로드 후 참여 중이면 listener 부착
      try { await window.startChatty?.(); } catch(e){ console.warn("[startChatty failed]", e); }

      // ✅ 3) 사운드/참가/상세/세션카운트 등 닉귀속 UI 초기화
      try { await window.afterJoinInitSoundPrefs?.(); } catch(e){ console.warn("[afterJoinInitSoundPrefs failed]", e); }

      // ✅ 3-1) 자리비움 자동 감지 — 저장값이 켜짐이고 권한이 있으면 조용히 시작
      try { await window.afterJoinInitIdleDetect?.(); } catch(e){ console.warn("[afterJoinInitIdleDetect failed]", e); }

      // ✅ 3-2) 무음 접속 유지 — 이 기기에서 켜 뒀으면 입장 클릭에 얹어 조용히 시작
      //         (브라우저는 클릭 전에 소리를 못 내게 막습니다. 지금이 그 클릭 직후예요)
      try { await window.afterJoinInitAlive?.(); } catch(e){ console.warn("[afterJoinInitAlive failed]", e); }

      // ✅ 3-3) ♪ BGM — 추천 리스트 구독 시작 (판은 dock 이 이미 만들어 둠)
      try { window.musicInit?.(); } catch(e){ console.warn("[musicInit failed]", e); }

      armPresenceOnDisconnect();
      bindConnectionWatcher();

      // ✅ 실제 브라우저 종료/탭 닫기 시에만 퇴장 메시지
      // (beforeunload는 실제 닫힐 때만 발동, 네트워크 끊김엔 발동 안 함)
      window._beforeUnloadBound = true;
      _leaveBeaconSent = false;
      window.addEventListener("beforeunload", _handleBeforeUnload, { once: true });
      /* ✅ 모바일 사파리 등에서는 beforeunload 가 안 뜨는 경우가 있어 pagehide 도 함께.
         ★ 다만 곧 돌아올 때(persisted)는 거릅니다 — 위 _handlePageHide 참고.
         ★ once 를 뗐습니다. 걸러 보내는 일이 생겼으니, 한 번 거르고 나면
           정작 진짜 나갈 때 아무도 안 듣게 됩니다. 두 번 보내는 건
           _leaveBeaconSent 가 이미 막고 있어요. */
      window.addEventListener("pagehide", _handlePageHide);
      await _writeJoinSystemMessageOnce();

      callIfFn("recordAttendance");
      callIfFn("loadPersonalData");
      callIfFn("updateStatus", true);
      callIfFn("listenStatus");
      callIfFn("listenPomodoro");
      /* [철거 2026-08-14] listenNotice(머리말 한줄 공지) — 자리에 시계가 앉음 */
      callIfFn("listenNotes");
      callIfFn("listenRoomTodo");     // 📌 방 전체 할 일 진척 (명단 아래 한 줄)
      callIfFn("listenNoticeBoard");  // 📢 공지판 — 안 읽은 게 있으면 단추에 붉은 점
      callIfFn("loadGoalHours");     // 🍅 바깥 고리가 향할 하루 목표
      /* 🏅 업적 — 방이 자리를 잡은 뒤에 훑습니다. 입장 직후에는
         카드·채팅이 먼저 떠야 하고, 업적은 급할 게 없어요. */
      setTimeout(() => callIfFn("startAchv"), 8000)

      /* [2026-08-10] 들어오자마자 내 할 일 **개수**를 한 번 올립니다.

         ★ 이걸 빠뜨려서 줄이 아예 안 떴습니다.
         개수는 savePersonalData 안에서만 올라가는데, 그건 할 일이나
         목표를 **건드릴 때** 도는 함수입니다. 그래서 새 기능을 올린 뒤
         아무도 할 일을 손대지 않으면 todostat 이 텅 빈 채로 남고,
         합계가 0 이라 줄이 감춰집니다. 이미 적어 둔 할 일이 있어도요.

         목록을 다 불러온 뒤라야 제대로 세므로 조금 기다렸다 올립니다. */
      setTimeout(() => { try { window.saveTodoStat?.(); } catch (e) {} }, 1500);

      _statusIntervalId = setInterval(() => callIfFn("updateStatus", false), PRESENCE_POLL_MS);

      // ✅ [FIX] 크롬은 백그라운드 탭의 setInterval을 최소 60초로 늦춥니다.
      // 탭을 다시 보는 순간 즉시 한 번 갱신해서, 스로틀링 때문에
      // 접속자 목록에서 사라져 보이던 문제를 줄입니다.
      _bindPresenceWakeup();

    } catch (e) {
      console.error("[JOIN ERROR]", e);
      alert("입장 중 오류 발생 😵 새로고침 해줘!");

      try { document.getElementById("modal").style.display = "flex"; } catch (e2) {}
      myNick = "";
      myEmoji = "";
      _clearSessionId();
    } finally {
      _joining = false;
    }
  }

  async function leaveRoom() {
    if (!myNick) return;

    /* [2026-08-03] 나가기 전 마무리 —
       ① 열려 있는 작업 구간을 지금까지로 저장 (워크 타임이 날아가지 않게)
       ② users/{닉}/timeCur 를 지워서 묵은 구간이 남지 않게
       ③ 작업 상태를 닫아 두어, 다음 입장 때 시간이 이어서 세지 않게

       [고침 2026-08-10] 예전에는 여기서 **away** 로 저장했습니다.
       그런데 그 값이 다음 입장 때 그대로 되살아나서, 들어오자마자
       💤AWAY 로 뜨고 풀리지 않았어요.

       자동감지 탓으로 보였지만 아니었습니다. 자동감지는 "제가 내린
       AWAY"만 되돌립니다 — 사람이 고른 AWAY 를 마음대로 푸는 건
       그 기능의 원칙에 어긋나니까요. 여기서 찍은 away 에는 꼬리표가
       없으니 손대지 않은 게 맞습니다. 고칠 곳은 감지기가 아니라
       **무엇으로 저장해 두느냐** 였어요.

       ☕BREAK 로 바꿉니다. 자리에는 있지만 아직 작업 선언은 안 한 상태라,
       작업 시간이 저절로 불어나지도 않고 "자리에 없다"는 거짓말도
       하지 않습니다. 쓰기 시작할 때 WORK 를 한 번 누르면 됩니다. */
    try {
      const sel = document.getElementById("db-status");
      if (sel) sel.value = "rest";
      window.savePersonalData?.();
    } catch (e) {}
    try { await window.finalizeTimelogOnLeave?.(); } catch (e) {}
    try { await window.recordLeaveAttendance?.(); } catch (e) {}

    await cancelPresenceOnDisconnect();
    await db.ref("status/" + myNick).remove();
    await _writeLeaveSystemMessageOnce();

    window.resetPomoUserScopedUI?.();
    // ✅ 수동 퇴장 시 beforeunload 리스너 제거 (중복 방지)
    window.removeEventListener("beforeunload", _handleBeforeUnload);
    window.removeEventListener("pagehide", _handlePageHide);
    detachListeners();
    // ✅ Chatty listener도 함께 정리 (참여 여부 자체는 서버에 남습니다)
    try { window.detachChatty?.(); } catch(e) {}

    myNick = "";
    myEmoji = "";
    _presenceDisconnectArmed = false;
    _myJoinTs = 0;
    _clearSessionId();

    try { AppSession.removeItem("adminPinOk"); } catch(e) {}
    try { window.refreshAdminUiVisibility?.(); } catch(e) {}

    document.getElementById("my-info").innerText = "Chat";
    document.getElementById("exit-screen").classList.remove("hidden");
  }


  /**
   * 탭이 다시 보이거나 창에 포커스가 오면 프레즌스를 즉시 갱신.
   * 리스너는 한 번만 등록하고, 입장 상태일 때만 동작합니다.
   */
  let _presenceWakeupBound = false;
  function _bindPresenceWakeup() {
    if (_presenceWakeupBound) return;
    _presenceWakeupBound = true;

    const wake = () => {
      if (!myNick) return;
      if (document.visibilityState === "hidden") return;
      callIfFn("updateStatus", false);
      callIfFn("updateChatHeader");
    };

    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);

    /* [추가] 브라우저가 탭을 아예 얼려버리는 경우(Page Lifecycle).
       크롬은 오래 방치된 백그라운드 탭을 freeze 시키고, 그때 소켓도
       끊길 수 있습니다. 깨어나는 순간 끊김 표시를 지우고 다시 등록해서
       다른 분들 화면에 즉시 되돌아오게 합니다. */
    const revive = () => {
      if (!myNick) return;
      _presenceDisconnectArmed = false;
      try { armPresenceOnDisconnect(); } catch (e) {}
      try { db.ref(`status/${myNick}/disconnectedAt`).remove(); } catch (e) {}
      callIfFn("updateStatus", false);
      callIfFn("updateChatHeader");
    };
    document.addEventListener("resume", revive);
    window.addEventListener("pageshow", revive);
  }

  let _leaveBeaconSent = false;

  function _handleBeforeUnload() {
    if (!myNick || _leaveBeaconSent) return;
    _leaveBeaconSent = true;

    const sid = _ensureSessionId();

    const url = `${firebaseConfig.databaseURL}/messages/sys_leave_${sid}_${_myJoinTs || Date.now()}.json?x-http-method-override=PUT`;
    const payload = JSON.stringify({
      type:    "system",
      msg:     `👋 ${myNick} 작가님이 작업실을 나갔어요.`,
      time:    Date.now(),
      leaveOf: myNick,
      sid,
      byUnload: true
    });

    // ✅ [FIX] sendBeacon은 크로스오리진으로 application/json 전송이 차단됨 →
    // 허용되는 text/plain으로 전송 (Firebase REST는 형식 무관하게 본문을 해석함)
    let ok = false;
    try {
      ok = navigator.sendBeacon(url, new Blob([payload], { type: "text/plain" }));
    } catch(e) {}
    if (!ok) {
      // 예비 수단: keepalive fetch (언로드 후에도 요청 유지)
      try { fetch(url, { method: "POST", body: payload, keepalive: true }); } catch(e) {}
    }

    // status 즉시 제거도 시도 (best-effort)
    try {
      const stUrl = `${firebaseConfig.databaseURL}/status/${encodeURIComponent(myNick)}.json?x-http-method-override=DELETE`;
      let ok2 = false;
      try { ok2 = navigator.sendBeacon(stUrl, new Blob(["null"], { type: "text/plain" })); } catch(e) {}
      if (!ok2) fetch(stUrl, { method: "POST", body: "null", keepalive: true });
    } catch(e) {}
  }

  window._handleBeforeUnload = _handleBeforeUnload;

  /* ===================================================================
     ★★ [고침 2026-08-12] "한 사람만 자꾸 슝 사라졌다 나타나요"
     -------------------------------------------------------------------
     [무엇이 일어나고 있었나]
     퇴장 처리(_handleBeforeUnload)를 beforeunload 와 **pagehide 둘 다**에
     걸어 두었습니다. 모바일 사파리에서 beforeunload 가 안 뜨는 경우가
     있어서요. 그런데 pagehide 는 **창을 닫을 때만 뜨는 것이 아닙니다.**

       · 폰에서 다른 앱으로 넘어갈 때
       · 화면을 끌 때
       · 다른 사이트에 갔다가 뒤로가기로 돌아올 때

     이때도 pagehide 가 뜹니다. 그리고 이 함수는 status/{닉네임} 을
     **통째로 지웁니다.** 끊김 표시(disconnectedAt)를 남기는 게 아니라
     기록 자체를 지우는 것이라, 30분 유예도 소용이 없어요. 남들 화면에서
     그 사람 카드가 **그 자리에서** 사라집니다. 돌아오면 되살아나고요.

     그래서 "폰으로 켜 두고 가끔 들여다보는 사람" 한 명만 계속 그랬습니다.
     조용한 분이라 더 그랬어요 — 말을 안 하니 앱을 자주 오갔을 뿐입니다.
     자리를 비운 것도, 네트워크가 나쁜 것도 아니었습니다.

     [어떻게 고치나]
     pagehide 에는 persisted 라는 표가 붙어 옵니다.
       · persisted = true  → 페이지를 얼려 두는 것. **곧 돌아옵니다.**
       · persisted = false → 진짜로 없어지는 것.
     참이면 아무것도 하지 않습니다. 잠깐 끊기는 건 onDisconnect 가 이미
     맡고 있어요 — 끊김 표시를 남기고 30분 기다립니다. 그게 유예를 둔
     이유이기도 하고요.
     =================================================================== */
  function _handlePageHide(e) {
    if (e && e.persisted) return;   // 얼려 두는 것뿐 — 나간 게 아닙니다
    _handleBeforeUnload();
  }
  window._handlePageHide = _handlePageHide;

  // ✅ [FIX] bfcache 복귀 대응: 다른 사이트로 갔다가 '뒤로가기'로 돌아오면
  // 페이지가 얼려진 상태 그대로 살아나는데, 떠나는 순간 퇴장 메시지가 이미 전송됨.
  // → 복귀를 감지해서 상태를 복구하고 재입장 메시지를 남겨 모순을 해소한다.
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;   // bfcache 복귀가 아니면 무시
    if (!myNick) return;        // 입장 전이면 무시

    _leaveBeaconSent = false;
    _myJoinTs = Date.now();
    _presenceDisconnectArmed = false;

    try {
      window.addEventListener("beforeunload", _handleBeforeUnload, { once: true });
      window.addEventListener("pagehide", _handlePageHide);
    } catch(err) {}

    try { armPresenceOnDisconnect(); } catch(err) {}
    try { callIfFn("updateStatus", true); } catch(err) {}
    try { _writeJoinSystemMessageOnce(); } catch(err) {}
  });

  function init() {
    window.resetPomoUserScopedUI?.();

    // ✅ init은 "로그인 전 프리뷰"만: 기본테마 + 폰트 + 타이머 표시
    // (닉 귀속 로딩은 join() 이후 afterJoinLoadNickTheme에서 처리)
    try {
      const previewTheme = AppStore.getItem("writerTheme") || "📜 원고와 잉크";
      callIfFn("applyTheme", previewTheme);
    } catch(e) {}

    callIfFn("applySavedFontSize");
    callIfFn("applyTimerVisibility");

    document.getElementById("modal").style.display = "flex";
    document.getElementById("exit-screen").classList.add("hidden");

    const nickInput = document.getElementById("nick-input");

    // ✅ 지난번에 쓴 닉네임을 채워두고 전체 선택 상태로 둡니다.
    // 그대로 쓰려면 Enter, 바꾸려면 바로 타이핑하면 돼요.
    try {
      const last = AppStore.getItem(LAST_NICK_KEY);
      if (nickInput && last && !nickInput.value) {
        nickInput.value = last;
        setTimeout(() => { nickInput.focus(); nickInput.select(); }, 60);
      } else {
        setTimeout(() => nickInput?.focus(), 60);
      }
    } catch (e) {}

    nickInput?.addEventListener("keydown", (e) => {
      // 한글 조합 중의 Enter는 무시 (투두 입력창과 같은 이유)
      if (e.isComposing || e.keyCode === 229) return;

      if (e.key === "Enter") {
        e.preventDefault();
        join();
      }
    });

    // ✅ core에서 바인딩 보장
    try { window.bindSendHandlers?.(); } catch (e) { console.warn("[bindSendHandlers failed]", e); }
    try { window.bindChatScrollGuard?.(); } catch (e) { console.warn("[bindChatScrollGuard failed]", e); }
  }

  window.join = join;
  window.leaveRoom = leaveRoom;
  window.init = init;
  window.getDailyEmoji = getDailyEmoji;   // ✅ [프로필] 고정 해제 시 오늘의 랜덤값 재계산용
