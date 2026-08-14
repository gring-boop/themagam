/* TheMagam © 링가링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_solo.js — 🧘 혼자 방 (?solo=1)
   ---------------------------------------------------------------------
   [무엇인가]
   사람들과 부대끼긴 싫은데 작업방 분위기는 느끼고 싶은 사람을 위한
   1인용 집필실입니다. 카드가 여러 장 떠 있고 시간이 흐르고 상태가
   가끔 바뀌지만, **전부 자기 카드**예요. 서버에는 연결하지 않습니다.

   주소: …/themagam/?solo=1

   [진짜 방과 무엇이 다른가]
     · 서버에 연결하지 않습니다 — 로그인·승인·접속유지가 없어요.
       (연결이 없으니 끊길 것도 없어서 🔌 버튼 자체가 사라집니다)
     · 저장은 전부 이 기기(localStorage)에. 다른 사람은 볼 수 없고,
       이 방의 무료 한도도 한 글자도 쓰지 않습니다.
     · 수다방·출판사 품평은 뺐습니다 — 혼자서는 뜻이 없는 것들이라.
     · 채팅은 **혼자 쓰는 메모장**입니다. 스티커는 남기고 멘션·답장·
       반응·명령어는 걷어냈어요.
     · 대숲은 그대로 — 나만의 쪽지 보드. 30일 시듦은 끕니다(안 사라짐).

   [어떻게 만드나 — 한 곳에서 갈아 끼웁니다]
   script_demo.js 와 같은 수법입니다. firebase.database() 를 통째로
   **기기에 저장되는 작은 데이터베이스**로 바꿔치기해요. 그 뒤로는
   어느 파일이 무엇을 쓰든 서버까지 가지 못하고, 대신 localStorage 에
   쌓입니다. 뽀모·글자수·할 일·업적이 전부 그대로 동작하는 이유예요.

   ★ 이 파일은 script_demo.js 바로 다음, 나머지보다 **먼저** 실려야
     합니다. script_core.js 가 database() 를 부르기 전에 갈아 끼워야
     하니까요.
   ===================================================================== */
(function () {
  "use strict";

  let 켬 = false;
  try { 켬 = new URLSearchParams(location.search).get("solo") === "1"; } catch (e) {}
  if (!켬) return;

  window.SOLO = true;
  document.documentElement.setAttribute("data-solo", "1");

  const NICK_KEY = "soloNick";
  const DB_KEY   = "soloDb";
  const N_KEY    = "soloCount";
  const CHAT_MAX = 500;          // 메모는 최근 500줄까지 (넘치면 오래된 것부터)

  /* =====================================================================
     ① 기기에 저장되는 작은 데이터베이스
     ---------------------------------------------------------------------
     경로(a/b/c)로 값을 넣고 빼는 나무 한 그루를 localStorage 에 둡니다.
     진짜 파이어베이스가 주는 함수들을 이름만 같게 흉내 내요 —
     set·update·remove·push·transaction·once·on·off 와 거르기(query).
     ===================================================================== */
  /* 저장은 방의 규칙대로 AppStore 를 거칩니다 (script_core.js).
     ★ 이 파일은 core 보다 **먼저** 실리므로, 나무를 미리 읽어두면
       AppStore 가 아직 없습니다. 그래서 처음 쓸 때 읽습니다(느긋하게).
       firebase 갈아끼우기는 즉시 하되, 실제 읽고 쓰기는 입장 뒤에
       일어나니 그때는 core 가 다 실려 있어요. */
  let _tree = null;
  const _store = () => window.AppStore;

  function _ensure() {
    if (_tree) return _tree;
    try { _tree = JSON.parse(_store()?.getItem(DB_KEY) || "{}") || {}; }
    catch (e) { _tree = {}; }
    return _tree;
  }

  let _saveTimer = null;
  function _save() {
    /* 몰아서 저장합니다 — 글자 하나 칠 때마다 통째로 쓰면 버벅여요 */
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      try { _store()?.setItem(DB_KEY, JSON.stringify(_tree)); }
      catch (e) { console.warn("[solo] 저장 공간이 가득 찼어요", e); }
    }, 400);
  }

  const 조각 = (p) => String(p || "").split("/").filter(Boolean);

  function _get(path) {
    let cur = _ensure();
    for (const k of 조각(path)) {
      if (cur === null || typeof cur !== "object") return null;
      cur = cur[k];
      if (cur === undefined) return null;
    }
    return cur === undefined ? null : cur;
  }

  function _put(path, val) {
    const ks = 조각(path);
    _ensure();
    if (!ks.length) { _tree = (val && typeof val === "object") ? val : {}; _save(); _fire(""); return; }
    let cur = _tree;
    for (let i = 0; i < ks.length - 1; i++) {
      if (cur[ks[i]] === null || typeof cur[ks[i]] !== "object") cur[ks[i]] = {};
      cur = cur[ks[i]];
    }
    const last = ks[ks.length - 1];
    if (val === null || val === undefined) delete cur[last];
    else cur[last] = val;
    _save();
    _fire(path);
  }

  /* ---- 듣는 사람들 ---- */
  const _listeners = [];        // { path, evt, cb, query, seen:Set }

  function _fire(changed) {
    /* 바뀐 자리와 겹치는 사람에게만 알립니다 (조상·자손 모두) */
    _listeners.slice().forEach(L => {
      const a = L.path, b = String(changed || "");
      if (a && b && !a.startsWith(b) && !b.startsWith(a)) return;
      _emit(L);
    });
  }

  function _snap(key, val) {
    return {
      key,
      val: () => (val === undefined ? null : val),
      exists: () => val !== null && val !== undefined,
      numChildren: () => (val && typeof val === "object") ? Object.keys(val).length : 0,
      hasChild: (k) => !!(val && typeof val === "object" && val[k] !== undefined),
      child: (k) => _snap(k, (val && typeof val === "object") ? val[k] : null),
      forEach: (fn) => {
        if (!val || typeof val !== "object") return false;
        for (const k of Object.keys(val)) { if (fn(_snap(k, val[k])) === true) return true; }
        return false;
      }
    };
  }

  /* 거르기 — orderByChild/startAt/endAt/limitToLast 만 씁니다(이 방이 쓰는 전부) */
  function _rows(path, q) {
    const v = _get(path);
    if (!v || typeof v !== "object") return [];
    let rows = Object.keys(v).map(k => ({ k, v: v[k] }));
    const by = q.orderBy;
    const keyOf = (r) => by ? (r.v && typeof r.v === "object" ? r.v[by] : undefined) : r.k;
    rows.sort((a, b) => {
      const x = keyOf(a), y = keyOf(b);
      return (x > y ? 1 : x < y ? -1 : 0);
    });
    if (q.startAt !== undefined) rows = rows.filter(r => keyOf(r) >= q.startAt);
    if (q.endAt !== undefined)   rows = rows.filter(r => keyOf(r) <= q.endAt);
    if (q.limitLast) rows = rows.slice(-q.limitLast);
    if (q.limitFirst) rows = rows.slice(0, q.limitFirst);
    return rows;
  }

  function _emit(L) {
    try {
      if (L.evt === "value") {
        if (L.q.orderBy || L.q.limitLast || L.q.startAt !== undefined) {
          const out = {};
          _rows(L.path, L.q).forEach(r => { out[r.k] = r.v; });
          L.cb(_snap(조각(L.path).pop() || null, out));
        } else {
          L.cb(_snap(조각(L.path).pop() || null, _get(L.path)));
        }
        return;
      }
      if (L.evt === "child_added") {
        _rows(L.path, L.q).forEach(r => {
          if (L.seen.has(r.k)) return;
          L.seen.add(r.k);
          L.cb(_snap(r.k, r.v));
        });
        return;
      }
      if (L.evt === "child_changed" || L.evt === "child_removed") return;   // 이 방에선 안 씁니다
    } catch (e) { console.warn("[solo listener]", e); }
  }

  let _pushSeq = 0;
  function _newKey() {
    _pushSeq++;
    return "-solo" + Date.now().toString(36) + _pushSeq.toString(36);
  }

  function 방Ref(path, q) {
    const query = q || {};
    const ref = {
      key: 조각(path).pop() || null,
      toString: () => "solo://" + path
    };
    ref.child  = (x) => 방Ref(path + "/" + x, {});
    ref.parent = () => 방Ref(조각(path).slice(0, -1).join("/"), {});
    ref.root   = () => 방Ref("", {});
    ref.orderByChild = (k) => 방Ref(path, { ...query, orderBy: k });
    ref.orderByKey   = () => 방Ref(path, { ...query, orderBy: null });
    ref.orderByValue = () => 방Ref(path, { ...query });
    ref.startAt = (v) => 방Ref(path, { ...query, startAt: v });
    ref.endAt   = (v) => 방Ref(path, { ...query, endAt: v });
    ref.equalTo = (v) => 방Ref(path, { ...query, startAt: v, endAt: v });
    ref.limitToLast  = (n) => 방Ref(path, { ...query, limitLast: n });
    ref.limitToFirst = (n) => 방Ref(path, { ...query, limitFirst: n });

    ref.once = (evt) => {
      void evt;
      if (query.orderBy || query.limitLast || query.startAt !== undefined) {
        const out = {};
        _rows(path, query).forEach(r => { out[r.k] = r.v; });
        return Promise.resolve(_snap(ref.key, out));
      }
      return Promise.resolve(_snap(ref.key, _get(path)));
    };

    ref.on = (evt, cb) => {
      const L = { path, evt, cb, q: query, seen: new Set() };
      _listeners.push(L);
      _emit(L);
      cb.__soloL = L;
      return cb;
    };
    ref.off = (evt, cb) => {
      void evt;
      for (let i = _listeners.length - 1; i >= 0; i--) {
        if (_listeners[i].path === path && (!cb || _listeners[i].cb === cb)) _listeners.splice(i, 1);
      }
    };

    ref.set    = (v) => { _put(path, v); return Promise.resolve(); };
    ref.update = (v) => {
      const cur = _get(path);
      const base = (cur && typeof cur === "object") ? cur : {};
      _put(path, { ...base, ...(v || {}) });
      return Promise.resolve();
    };
    ref.remove = () => { _put(path, null); return Promise.resolve(); };
    ref.push = (v) => {
      const k = _newKey();
      const child = 방Ref(path + "/" + k, {});
      if (v !== undefined) child.set(v);
      const p = Promise.resolve(child);
      p.key = k; p.set = child.set; p.update = child.update; p.remove = child.remove;
      p.onDisconnect = child.onDisconnect;
      return p;
    };
    ref.transaction = (fn) => {
      let next;
      try { next = fn(_get(path)); } catch (e) { next = undefined; }
      if (next !== undefined) _put(path, next);
      return Promise.resolve({ committed: true, snapshot: _snap(ref.key, _get(path)) });
    };
    ref.onDisconnect = () => ({
      set: () => Promise.resolve(), update: () => Promise.resolve(),
      remove: () => Promise.resolve(), cancel: () => Promise.resolve()
    });
    return ref;
  }

  const 방DB = {
    ref: (p) => 방Ref(p || "", {}),
    refFromURL: (p) => 방Ref(p || "", {}),
    goOnline: () => {}, goOffline: () => {}
  };

  try {
    firebase.database = function () { return 방DB; };
    firebase.database.ServerValue = { TIMESTAMP: Date.now() };
    firebase.database.enableLogging = () => {};
  } catch (e) { console.warn("[solo] database 갈아끼우기 실패", e); }

  /* 로그인도 흉내 — 계정을 만들지 않습니다 */
  try {
    const 나 = { uid: "solo-uid", email: "solo@themagam.local" };
    firebase.auth = function () {
      return {
        currentUser: 나,
        onAuthStateChanged: (cb) => { try { cb(나); } catch (e) {} },
        signInWithEmailAndPassword: () => Promise.resolve({ user: 나 }),
        createUserWithEmailAndPassword: () => Promise.resolve({ user: 나 }),
        signOut: () => Promise.resolve()
      };
    };
  } catch (e) {}

  /* =====================================================================
     ② 함께할 작가들 — 전부 내 카드입니다
     ---------------------------------------------------------------------
     닉네임·목표·꾸밈을 카드마다 따로 정합니다. 저장은 기기에.
     내 카드(1번)는 늘 맨 앞이고, 진짜로 동작합니다 — 뽀모를 돌리면
     여기 시간이 쌓이고 글자수도 여기 붙어요. 나머지는 분위기 담당.
     ===================================================================== */
  const 기본이름 = ["나", "밤샘", "커피", "원고", "마감", "퇴고", "초고", "여백",
                    "각주", "탈고", "문장", "행간", "표지", "서문", "결말", "교정", "인쇄"];
  const 기본목표 = ["오늘도 한 줄", "1빡 완주", "매일 1빡", "3천자", "퇴고 마무리",
                    "프롤로그 끝내기", "교정 2장", "자유롭게", "마감 전까지", "한 화 완성"];

  function 카드수() {
    const n = Number(_store()?.getItem(N_KEY));
    return (n >= 1 && n <= 20) ? n : 9;
  }
  function 카드수정(n) {
    _store()?.setItem(N_KEY, String(Math.max(1, Math.min(20, n | 0))));
    만들기();
    window.renderUserCards?.(window._statusCache);
  }
  window.soloSetCount = 카드수정;
  window.soloGetCount = 카드수;

  const 상태들 = ["writing", "writing", "focus", "rest"];
  let _친구 = [];

  function 내닉() {
    let v = _store()?.getItem(NICK_KEY);
    if (!v) { v = "나"; _store()?.setItem(NICK_KEY, v); }
    return v;
  }

  function 만들기() {
    const n = 카드수();
    const now = Date.now();
    _친구 = [];
    for (let i = 0; i < n; i++) {
      const nick = i === 0 ? 내닉() : (기본이름[i % 기본이름.length] + (i > 16 ? i : ""));
      _친구.push({
        nick,
        status: i === 0 ? "rest" : 상태들[i % 상태들.length],
        goal: 기본목표[i % 기본목표.length],
        workMs: i === 0 ? 0 : ((1 + (i % 6)) * 3600e3 + (i * 13 % 60) * 60e3),
        pomo: i % 9
      });
    }
    const out = {};
    _친구.forEach((f, i) => {
      out[f.nick] = {
        emoji: "✍️",
        status: f.status,
        statusLabel: "",
        todayGoalText: f.goal,
        workMs: f.workMs,
        pomoCount: f.pomo,
        pomoRunning: false,
        todoTotal: 0, todoDone: 0,
        shareOn: false,
        lastSeen: now,
        joinedAt: now - (n - i) * 60000
      };
    });
    window._statusCache = out;
    /* 내 카드는 진짜 저장자리와 이어 둡니다 — 뽀모·글자수가 여기 붙어요 */
    _put("status/" + 내닉(), out[내닉()]);
    return out;
  }

  /* 아주 느린 숨결 — 30~90초에 한 명씩만 살짝 (2026-08-15)
     빠르게 바뀌면 눈에 밟혀서 오히려 방해가 됩니다. 옆자리 사람이
     1분에 한 번 자세를 고치는 정도가 딱 좋아요. */
  function 숨쉬기() {
    const cache = window._statusCache || {};
    const names = Object.keys(cache).filter(n => n !== 내닉());
    if (names.length) {
      const who = names[Math.floor(Math.random() * names.length)];
      const r = cache[who];
      if (r) {
        const 다음 = 상태들[Math.floor(Math.random() * 상태들.length)];
        if (다음 !== r.status) r.status = 다음;
        r.lastSeen = Date.now();
      }
    }
    /* 작업 중인 카드들의 시간이 조금씩 흐릅니다 */
    Object.keys(cache).forEach(n => {
      if (n === 내닉()) return;
      const r = cache[n];
      if (r && (r.status === "writing" || r.status === "focus")) r.workMs += 30000;
    });
    window.renderUserCards?.(cache);
    setTimeout(숨쉬기, 30000 + Math.random() * 60000);
  }

  /* =====================================================================
     ③ 입장 절차를 건너뜁니다 — 열면 바로 방
     ===================================================================== */
  function 띄우기() {
    const nick = 내닉();
    window.myNick = nick;
    try { myNick = nick; } catch (e) {}

    const modal = document.getElementById("modal");
    if (modal) modal.style.display = "none";
    document.body.classList.add("solo-mode");

    만들기();
    window.renderUserCards?.(window._statusCache);

    /* 진짜 방의 시동 절차 중 **혼자서도 뜻이 있는 것만** 부릅니다 */
    ["listenMessages", "loadPersonalData", "renderProfilePanel",
     "startAchv", "listenRoomTodo", "musicInit", "afterJoinLoadProfile"]
      .forEach(fn => { try { window[fn]?.(); } catch (e) {} });

    setTimeout(숨쉬기, 20000);
  }

  window.addEventListener("load", () => setTimeout(띄우기, 350));

  /* =====================================================================
     ④ 혼자서는 뜻이 없는 것들 걷어내기
     ---------------------------------------------------------------------
     ☕ 수다방 · 🏢 출판사 품평 — 상대가 있어야 하는 것들
     🔌 접속유지 — 서버에 연결하지 않으니 끊길 것이 없습니다
     채팅의 멘션·답장·반응·명령어 — 혼자 쓰는 메모장에는 없어도 돼요
       (스티커는 남깁니다. 그게 재미라고 하셨어요)
     ===================================================================== */
  function 걷어내기() {
    ["dock-pill-chatty", "dock-pill-pub", "alive-btn",
     "chatty-tab", "chat-tab-chatty"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    document.querySelectorAll("[data-dock='chatty'],[data-dock='pub']")
      .forEach(el => el.remove());
    /* 대숲의 30일 시듦은 끕니다 — 혼자 붙인 쪽지는 안 사라지는 게 낫습니다 */
    window.FOREST_NO_WITHER = true;
  }
  window.addEventListener("load", () => setTimeout(걷어내기, 500));

  /* 메모(채팅)가 무한정 쌓이지 않게 — 최근 500줄만 */
  window.soloTrimChat = function () {
    const all = _get("messages");
    if (!all) return;
    const ks = Object.keys(all);
    if (ks.length <= CHAT_MAX) return;
    ks.sort((a, b) => (all[a]?.time || 0) - (all[b]?.time || 0));
    ks.slice(0, ks.length - CHAT_MAX).forEach(k => { delete all[k]; });
    _put("messages", all);
  };
  setInterval(() => { try { window.soloTrimChat(); } catch (e) {} }, 60000);

  /* 콘솔에서 쓰는 손잡이 (설정 화면이 붙기 전까지) */
  window.soloRename = function (nick) {
    if (!nick) return;
    _store()?.setItem(NICK_KEY, String(nick).slice(0, 12));
    location.reload();
  };
})();
