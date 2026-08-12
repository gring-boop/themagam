/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_demo.js — 🧪 시험 모드 (?demo=1)
   ---------------------------------------------------------------------
   [무엇을 푸는가]
   화면을 조금 고칠 때마다 작업방에 들락거려야 했습니다. 그때마다 남들
   화면에는 카드가 떴다 사라지고, 시험 삼아 친 채팅이 진짜 채팅방에
   남고, 출석까지 찍혔어요.

   주소 뒤에 ?demo=1 을 붙이면 **입장을 아예 하지 않습니다.**
   서버에 한 글자도 쓰지 않고, 서버에서 한 글자도 읽지 않아요.
   대신 가짜 사람 열아홉을 만들어 화면을 채웁니다.

   [어떻게 막는가 — 한 곳에서]
   쓰는 자리를 하나하나 막으면 반드시 빠뜨립니다. 이 방만 해도
   set·update·push·remove·transaction·onDisconnect 가 스무 곳이 넘어요.

   그래서 **firebase.database() 자체를 갈아 끼웁니다.** 그 뒤로 만들어지는
   모든 ref 는 진짜 데이터베이스와 아무 상관이 없는 흉내입니다.
   어느 파일이 어떤 방식으로 쓰든 서버까지 가지 못해요.

   ★ 이 파일은 **맨 먼저** 실려야 합니다. script_core.js 가 database() 를
     부르기 전에 갈아 끼워야 하니까요. (index.html 의 첫 script 태그)

   ★ 평소(?demo 없음)에는 아무 일도 하지 않습니다. 첫 줄에서 그냥 나가요.
   ===================================================================== */
(function () {
  "use strict";

  let 켬 = false;
  try { 켬 = new URLSearchParams(location.search).get("demo") === "1"; } catch (e) {}
  if (!켬) return;

  window.DEMO = true;
  document.documentElement.setAttribute("data-demo", "1");

  /* =====================================================================
     ① 데이터베이스 흉내 — 읽지도 쓰지도 않습니다
     ---------------------------------------------------------------------
     진짜 ref 가 가진 함수를 이름만 같게 흉내 냅니다.
       · 읽기(on·once) → 늘 **빈 것**을 돌려줍니다
       · 쓰기(set·update·push·remove·transaction) → 아무 일도 안 하고 성공
       · 거르기(orderByKey·startAt…) → 자기 자신을 돌려줘 사슬이 이어지게

     ★ 읽기까지 막는 이유 — 진짜 멤버 목록이 흘러들면 "시험 화면인데
       사람이 진짜네?" 가 되어 헷갈립니다. 무엇보다 시험 중에 남의
       기록을 들여다볼 이유가 없어요.
     ===================================================================== */
  const 빈스냅 = {
    val: () => null,
    exists: () => false,
    numChildren: () => 0,
    hasChild: () => false,
    child() { return 빈스냅; },
    forEach: () => false,
    key: null
  };

  let _쓰기시도 = 0;
  window.demoWrites = () => _쓰기시도;   // 검사와 콘솔 확인용

  function 흉내Ref(path) {
    const ref = {
      key: String(path || "").split("/").filter(Boolean).pop() || null,
      toString: () => "demo://" + path
    };

    /* 자기 자신을 돌려주는 것들 — 사슬이 끊기지 않게 */
    ["child", "orderByKey", "orderByChild", "orderByValue",
     "startAt", "endAt", "equalTo", "limitToFirst", "limitToLast",
     "parent", "root"].forEach(n => {
      ref[n] = (x) => (n === "child" ? 흉내Ref(path + "/" + x) : ref);
    });

    /* 읽기 — 늘 비어 있습니다 */
    ref.once = () => Promise.resolve(빈스냅);
    ref.on = (evt, cb) => { try { cb && cb(빈스냅); } catch (e) {} return cb; };
    ref.off = () => {};

    /* 쓰기 — 세어만 두고 아무 일도 안 합니다 */
    ["set", "update", "remove", "setPriority", "setWithPriority"].forEach(n => {
      ref[n] = () => { _쓰기시도++; return Promise.resolve(); };
    });
    ref.push = (v) => {
      if (v !== undefined) _쓰기시도++;
      const r = 흉내Ref(path + "/demo" + Date.now());
      r.then = undefined;
      return r;
    };
    ref.transaction = (fn) => {
      _쓰기시도++;
      return Promise.resolve({ committed: false, snapshot: 빈스냅 });
    };
    ref.onDisconnect = () => ({
      set: () => { _쓰기시도++; return Promise.resolve(); },
      update: () => { _쓰기시도++; return Promise.resolve(); },
      remove: () => { _쓰기시도++; return Promise.resolve(); },
      cancel: () => Promise.resolve()
    });
    return ref;
  }

  const 흉내DB = {
    ref: (p) => 흉내Ref(p || ""),
    refFromURL: (p) => 흉내Ref(p || ""),
    goOnline: () => {},
    goOffline: () => {}
  };

  try {
    firebase.database = function () { return 흉내DB; };
    /* ServerValue 는 값만 쓰는 상수라 그대로 둡니다 (없으면 터져요) */
    firebase.database.ServerValue = { TIMESTAMP: Date.now() };
    firebase.database.enableLogging = () => {};
  } catch (e) { console.warn("[demo] database 갈아끼우기 실패", e); }

  /* ② 로그인도 흉내 — 진짜 계정을 만들면 안 됩니다 */
  try {
    const 흉내User = { uid: "demo-uid", email: "demo@themagam.local" };
    firebase.auth = function () {
      return {
        currentUser: 흉내User,
        onAuthStateChanged: (cb) => { try { cb(흉내User); } catch (e) {} },
        signInWithEmailAndPassword: () => Promise.resolve({ user: 흉내User }),
        createUserWithEmailAndPassword: () => Promise.resolve({ user: 흉내User }),
        signOut: () => Promise.resolve()
      };
    };
  } catch (e) { console.warn("[demo] auth 갈아끼우기 실패", e); }

  /* =====================================================================
     ③ 가짜 사람들 — 사람이 많을 때의 화면을 보려고
     ---------------------------------------------------------------------
     열아홉은 지금 이 방의 인원입니다. 카드가 몇 줄이 되는지, 아래 알약
     줄이 어떻게 눌리는지를 실제와 같은 조건에서 볼 수 있어요.
     ===================================================================== */
  const 이름들 = ["그링링", "고메", "곰미", "공공", "녹차차", "당근", "대찌",
                  "뚜잇", "랑랑", "리리", "몽몽", "벨벨", "소소", "솝솝",
                  "스카렛", "신복", "윤비", "자몽에이드", "초초"];
  const 상태들 = ["writing", "writing", "writing", "job", "rest", "away"];
  const 태그들 = ["draft", "polish", "proof", "revise", "rework", "idea", "input", ""];
  const 목표들 = ["오늘도 화이팅~!", "1빡 완주", "새 글 트릿, 쓰던 거 수정!",
                  "매일 1빡", "1000자라도 씁시다", "발등 튀김을 막아야만",
                  "딴짓하지 않습니다!", "교정…가능하면 원고도", ""];

  function 가짜상태() {
    const now = Date.now();
    const out = {};
    이름들.forEach((n, i) => {
      out[n] = {
        emoji: "🍄",
        status: 상태들[i % 상태들.length],
        statusLabel: "",
        /* ★ 열쇠 이름은 카드가 읽는 것과 **똑같아야** 합니다.
           처음에 goal 이라고 적었더니 열아홉 장이 전부
           "오늘의 한줄 목표 없음" 이었어요 — 카드는 todayGoalText 를 봅니다. */
        todayGoalText: 목표들[i % 목표들.length],
        tag: 태그들[i % 태그들.length],
        workMs: (1 + (i % 7)) * 3600e3 + (i * 7 % 60) * 60e3,
        pomoCount: i % 15,
        pomoRunning: i % 4 === 0,
        pomoPhase: i % 4 === 0 ? "work" : "",
        todoTotal: 3 + (i % 6),
        todoDone: i % 4,
        shareOn: false,
        lastSeen: now,
        photo: ""
      };
    });
    return out;
  }

  /* =====================================================================
     ④ 입장 절차를 건너뜁니다
     ---------------------------------------------------------------------
     입장 창을 닫고, 닉네임만 정해 둔 뒤 카드를 그립니다.
     ★ 진짜 입장 함수(joinRoom)는 부르지 않습니다 — 그 안에 출석 기록과
       입장 메시지가 들어 있어요. 흉내 DB 라 서버까지 가진 않지만,
       애초에 부르지 않는 편이 확실합니다.
     ===================================================================== */
  function 띄우기() {
    try {
      window.myNick = "그링링";
      try { myNick = "그링링"; } catch (e) {}

      const modal = document.getElementById("modal");
      if (modal) modal.style.display = "none";

      window._statusCache = 가짜상태();
      window.renderUserCards?.(window._statusCache);
      window.updateChatHeader?.();
      window.applyLayout?.();
      고리멈춤();
      가짜채팅();
      가짜할일();
      가짜안읽음();

      배너();
      console.log("%c[시험 모드] 서버에 아무것도 쓰지 않습니다.",
                  "background:#B3372B;color:#fff;padding:2px 6px;border-radius:3px");
    } catch (e) { console.warn("[demo] 화면 채우기 실패", e); }
  }

  /* =====================================================================
     뽀모 고리를 "멈춰 있음" 으로 그려 둡니다
     ---------------------------------------------------------------------
     ★ SVG 의 원은 dasharray 를 정해 주기 전까지 **꽉 찬 원**으로 그려집니다.
       평소에는 입장 직후 _paintIdle() 이 0% 로 맞춰 주는데, 시험 모드는
       입장을 안 하니 그 함수가 안 돌아요. 그래서 붉은 고리가 100% 로
       꽉 차 보였습니다 (실제로는 아무것도 안 돌고 있는데).
     ===================================================================== */
  function 고리멈춤() {
    try {
      window.updatePomoProgressBar?.(1, 1);
      window.renderDayRing?.();
      ["ring-day", "ring-pom"].forEach(id => {
        const c = document.getElementById(id);
        if (!c) return;
        const r = Number(c.getAttribute("r")) || 1;
        const len = 2 * Math.PI * r;
        c.setAttribute("stroke-dasharray", len.toFixed(2));
        c.setAttribute("stroke-dashoffset", len.toFixed(2));   // 0%
      });
    } catch (e) {}
  }

  /* =====================================================================
     가짜 채팅 몇 줄
     ---------------------------------------------------------------------
     빈 채팅 창으로는 말풍선 폭·줄바꿈·아바타 자리를 볼 수 없습니다.
     리뉴얼에서 채팅을 팝업으로 옮길 참이라 특히 필요해요.
     ===================================================================== */
  function 가짜채팅() {
    const box = document.getElementById("chat-box");
    if (!box || box.childElementCount) return;
    const 줄 = [
      ["고메",   "출근합니다~", false],
      ["그링링", "고메님 어서오세요!", true],
      ["벨벨",   "저 퇴고만 벌써 사흘째예요… 이게 맞나 싶고", false],
      ["그링링", "토닥토닥 ㅠㅠ 그 구간이 제일 힘들죠", true],
      ["소소",   "오늘 5천 자 채웠습니다!!", false],
      ["그링링", "헐 대박!! 축하드려요 🎉", true],
      ["초초",   "저는 저녁 먹고 재출근할게요", false]
    ];
    줄.forEach(([who, msg, 나]) => {
      const wrap = document.createElement("div");
      wrap.className = "chat-item" + (나 ? " mine" : "");
      wrap.innerHTML =
        (나 ? "" : `<div class="user-name">${who}</div>`) +
        `<div class="msg-bubble ${나 ? "mine" : ""}"><div class="msg-content">${msg}</div></div>`;
      box.appendChild(wrap);
    });
  }

  /* 방 전체 할 일 진척 — 시험 모드에서는 아무도 안 적으니 비어 있습니다.
     알약 줄에 빈 자리로 남으면 "고장인가?" 싶어서 그럴듯하게 채웁니다. */
  function 가짜할일() {
    try {
      const pill = document.getElementById("room-todo-pill");
      const wrap = document.getElementById("room-todo");
      if (!pill) return;
      pill.innerHTML = "📌 오늘 할 일 <b>78개</b> 중 <b>31개</b> 완료";
      if (wrap) wrap.hidden = false;
    } catch (e) {}
  }

  /* 안 읽음 표시 — 배지가 떴을 때 알약 줄이 흐트러지지 않는지 봐야 해서
     시험 모드에서도 그럴듯하게 켜 둡니다. */
  function 가짜안읽음() {
    try {
      const 켜기 = (id, txt) => {
        const n = document.getElementById(id);
        if (!n) return;
        if (txt !== undefined) n.textContent = txt;
        n.classList.remove("hidden");
      };
      켜기("chat-tab-badge-main", "3");
      켜기("chat-tab-badge-chatty", "12");
      켜기("notice-dot");
    } catch (e) {}
  }

  /* 시험 모드라는 걸 잊고 "왜 저장이 안 되지" 하지 않도록 */
  function 배너() {
    if (document.getElementById("demo-banner")) return;
    const b = document.createElement("div");
    b.id = "demo-banner";
    b.style.cssText =
      "position:fixed;left:50%;top:6px;transform:translateX(-50%);z-index:99998;" +
      "background:#B3372B;color:#FFFDF6;font-size:12px;font-weight:600;" +
      "padding:5px 14px;border-radius:99px;box-shadow:0 2px 10px rgba(0,0,0,.2);" +
      "pointer-events:none;letter-spacing:.2px";
    b.textContent = "🧪 시험 모드 — 서버에 저장되지 않아요 (가짜 사람 19명)";
    document.body.appendChild(b);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(띄우기, 300));
  } else {
    setTimeout(띄우기, 300);
  }
})();
