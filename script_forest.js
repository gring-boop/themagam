/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_forest.js — 🎋 대숲 (익명 게시판)
   ---------------------------------------------------------------------
   코르크 보드에 포스트잇을 덕지덕지 붙이는 익명 게시판입니다.
   빈 곳을 누르면 그 자리에 쪽지 한 장이 생기고, 서른 날이 지나면
   저절로 시들어 사라집니다.

   [완전 익명 — 이게 이 기능의 전부입니다]
   서버(forest/{키})에 남는 것은 이것뿐입니다.

       { text, color, x, y, rot, at, hearts }

   닉네임도, uid 도, 시간대도, 브라우저 정보도 넣지 않습니다.
   **누가 썼는지는 서버 어디에도 남지 않습니다.** 그래서 나중에
   "이건 내가 쓴 거니까 지울래" 를 서버가 판단할 방법이 없어요.
   대신 글을 붙인 직후 그 쪽지의 키를 이 기기의 AppStore 에 적어둡니다.

       tm:forestMine    = ["-Nx...","-Ny..."]   ← 내가 쓴 쪽지 (이 기기)
       tm:forestHearts  = ["-Nx...","-Nz..."]   ← ♥ 를 누른 쪽지 (이 기기)

   [이 방식의 한계 — 솔직히 적어둡니다]
     · 다른 기기(휴대폰 ↔ 컴퓨터)에서는 ✕ 가 보이지 않습니다.
       "내가 쓴 목록" 은 서버가 아니라 이 브라우저에만 있으니까요.
     · 브라우저 저장 공간을 지우면 그 목록도 함께 사라집니다.
     · ♥ 중복 방지도 같은 이유로 "이 기기에서 한 번" 입니다.
       기기를 옮기면 한 번 더 누를 수 있어요. 익명을 지키려면
       "누가 눌렀는가" 를 서버에 적을 수 없으니 어쩔 수 없습니다.
   익명성과 편의를 저울에 올려 익명성 쪽을 택한 결과입니다.

   [보안규칙]
       "forest": {
         ".read": "auth != null",
         "$id": { ".write": "auth != null && (관리자 || 새 글 || 지우기
                              || 글이 그대로인 수정)" }
       }
   글이 그대로인 수정만 열어둔 건 ♥ 때문입니다(hearts 만 올라가니까요).
   남의 글 내용을 몰래 바꿔치기하는 짓은 규칙 단계에서 막힙니다.
   지우기는 누구나 할 수 있게 열려 있습니다 — 익명이라 "글쓴이만"
   이라는 조건을 규칙으로 쓸 수가 없어서요. 화면에서는 이 기기가
   기억하는 내 쪽지에만 ✕ 를 보여줍니다.

   [팝업 안에서 클릭이 죽지 않게]
   .modal-content 에 onclick="event.stopPropagation()" 이 붙어 있어서,
   위임 리스너를 껍데기(#forest-modal)에 달면 click 이 통째로 죽습니다.
   반드시 **안쪽 상자(.modal-content)** 에 답니다.
   (script_mywork.js 에서 똑같이 데인 적이 있습니다)
   ===================================================================== */
(function () {
  "use strict";

  const MAX_TEXT = 200;
  const DAY_MS   = 24 * 60 * 60 * 1000;
  const KEEP_MS  = 30 * DAY_MS;        // 30일이 지나면 저절로 시들어요

  /* 이 기기에만 남는 기록 (서버에는 절대 올라가지 않습니다) */
  const MINE_KEY  = "forestMine";
  const HEART_KEY = "forestHearts";

  /* 쪽지 색 — A안 "먹지와 한지". 채도를 낮춰 종이에 스민 먹처럼.
     [배경, 글자, 시각(작은 글자)] 세 색이 한 벌입니다.
     서버에는 이 배열의 번호(0~4)만 저장합니다. */
  const FOREST_COLORS = [
    { name: "한지", bg: "#F2EBDC", fg: "#4A4034", sub: "#9A8E7C" },
    { name: "이끼", bg: "#E3E7E0", fg: "#3B443A", sub: "#8B968A" },
    { name: "매화", bg: "#E9E1E4", fg: "#4B3D42", sub: "#9C8B92" },
    { name: "새벽", bg: "#DFE4EA", fg: "#3A4450", sub: "#8794A2" },
    { name: "볕",   bg: "#EDE6DA", fg: "#4C4436", sub: "#9B927F" }
  ];

  /* ---------------------------------------------------------------
     상태
     --------------------------------------------------------------- */
  let _notes   = [];     // [{ id, text, color, x, y, rot, at, hearts }]
  let _compose = null;   // { x, y, color, text } — 작성 카드가 열려 있을 때만
  let _bound   = false;
  let _busy    = false;  // 붙이는 중 두 번 눌리지 않게

  /* ---------------------------------------------------------------
     자잘한 도구
     --------------------------------------------------------------- */
  function el(id) { return document.getElementById(id); }

  function esc(s) {
    if (window.escapeHtml) return window.escapeHtml(s);
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  /* 내 닉네임 — 입장했는지 확인하는 용도로만 씁니다.
     이 값이 서버로 나가는 일은 이 파일 어디에도 없습니다. */
  function me() {
    try { if (typeof myNick === "string" && myNick) return myNick; } catch (e) {}
    return window.myNick || "";
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function colorOf(i) {
    const n = Number(i);
    return FOREST_COLORS[(n >= 0 && n < FOREST_COLORS.length) ? n : 0];
  }

  /** "2시간 전" 처럼 — 시각을 그대로 보여주면 누가 언제 있었는지가
      드러납니다. 대숲에서는 흐릿한 편이 낫습니다. */
  function ago(at) {
    const d = Date.now() - Number(at || 0);
    if (d < 60 * 1000)        return "방금";
    if (d < 60 * 60 * 1000)   return Math.floor(d / 60000) + "분 전";
    if (d < DAY_MS)           return Math.floor(d / 3600000) + "시간 전";
    return Math.floor(d / DAY_MS) + "일 전";
  }

  /* ── 이 기기의 기록 ────────────────────────────────────────── */
  function readSet(key) {
    try {
      const raw = window.AppStore ? window.AppStore.getItem(key) : null;
      const arr = JSON.parse(raw || "[]");
      return Array.isArray(arr) ? arr.filter(x => typeof x === "string") : [];
    } catch (e) { return []; }
  }

  function writeSet(key, arr) {
    try {
      /* 무한정 쌓이지 않게 뒤쪽 500개만 남깁니다 */
      window.AppStore?.setItem(key, JSON.stringify(arr.slice(-500)));
    } catch (e) {}
  }

  function isMine(id)   { return readSet(MINE_KEY).indexOf(id) >= 0; }
  function didHeart(id) { return readSet(HEART_KEY).indexOf(id) >= 0; }

  function remember(key, id) {
    const arr = readSet(key);
    if (arr.indexOf(id) < 0) { arr.push(id); writeSet(key, arr); }
  }

  function forget(key, id) {
    writeSet(key, readSet(key).filter(x => x !== id));
  }

  /* ---------------------------------------------------------------
     서버 읽고 쓰기 — forest/{자동키}
     --------------------------------------------------------------- */

  /** 한 장을 안전한 모양으로 다듬습니다 (옛 데이터·손댄 데이터 대비) */
  function normalize(id, v) {
    if (!v || typeof v !== "object") return null;
    const text = String(v.text == null ? "" : v.text).slice(0, MAX_TEXT);
    if (!text.trim()) return null;
    return {
      id,
      text,
      color:  clamp(Math.round(Number(v.color) || 0), 0, FOREST_COLORS.length - 1),
      x:      clamp(Number(v.x) || 0, 0, 100),
      y:      clamp(Number(v.y) || 0, 0, 100),
      rot:    clamp(Number(v.rot) || 0, -3, 3),
      at:     Number(v.at) || 0,
      hearts: Math.max(0, Math.round(Number(v.hearts) || 0))
    };
  }

  async function loadNotes() {
    if (!window.db) { _notes = []; return; }
    let raw = {};
    try {
      raw = (await window.db.ref("forest").once("value")).val() || {};
    } catch (e) {
      console.warn("[대숲] 쪽지를 불러오지 못했어요", e);
      _notes = [];
      return;
    }
    const list = [];
    Object.keys(raw).forEach(id => {
      const n = normalize(id, raw[id]);
      if (n) list.push(n);
    });
    /* 오래된 것이 아래, 최신이 위로 오도록 (z-index 를 이 순서로 줍니다) */
    list.sort((a, b) => a.at - b.at);
    _notes = list;
  }

  /** 서른 날이 지난 쪽지를 조용히 걷어냅니다.
      실패해도 아무 말 하지 않습니다 — 청소는 곁다리 일이라
      실패했다고 화면에 경고를 띄우면 오히려 성가십니다. */
  async function sweepOld() {
    if (!window.db) return;
    const cut = Date.now() - KEEP_MS;
    const dead = _notes.filter(n => n.at && n.at < cut);
    if (!dead.length) return;
    _notes = _notes.filter(n => !(n.at && n.at < cut));
    for (const n of dead) {
      try { await window.db.ref("forest/" + n.id).remove(); } catch (e) {}
      forget(MINE_KEY, n.id);
      forget(HEART_KEY, n.id);
    }
  }

  /* ---------------------------------------------------------------
     화면 그리기
     --------------------------------------------------------------- */

  /** 쪽지 한 장 */
  function noteHtml(n, z) {
    const c = colorOf(n.color);
    const mine = isMine(n.id);
    const on   = didHeart(n.id);
    return `
      <div class="fr-note" data-fr-note="${esc(n.id)}"
           style="--fr-x:${n.x}%; --fr-y:${n.y}%; --fr-rot:${n.rot}deg;
                  --fr-bg:${c.bg}; --fr-fg:${c.fg}; --fr-sub:${c.sub}; z-index:${z};">
        ${mine ? `<button type="button" class="fr-del" data-fr-del="${esc(n.id)}"
                          title="이 쪽지 지우기" aria-label="이 쪽지 지우기">✕</button>` : ""}
        <p class="fr-note-text">${esc(n.text)}</p>
        <div class="fr-note-foot">
          <span class="fr-note-time">${esc(ago(n.at))}</span>
          <span class="fr-note-dot" aria-hidden="true">·</span>
          <button type="button" class="fr-heart${on ? " is-on" : ""}"
                  data-fr-heart="${esc(n.id)}"
                  aria-label="공감 ${n.hearts}개${on ? " (이미 눌렀어요)" : ""}"
                  title="${on ? "이미 공감했어요" : "공감하기 (한 번만)"}">♥ ${n.hearts}</button>
        </div>
      </div>`;
  }

  /** 새 쪽지 작성 카드 — 누른 그 자리에 뜹니다 */
  function composeHtml() {
    const c = colorOf(_compose.color);
    const swatches = FOREST_COLORS.map((k, i) => `
      <button type="button" class="fr-swatch${i === _compose.color ? " is-on" : ""}"
              data-fr-color="${i}" style="--fr-bg:${k.bg}; --fr-fg:${k.fg};"
              title="${esc(k.name)}" aria-label="${esc(k.name)} 색"
              aria-pressed="${i === _compose.color ? "true" : "false"}"></button>`).join("");

    return `
      <div class="fr-compose" data-fr-compose="1"
           style="--fr-x:${_compose.x}%; --fr-y:${_compose.y}%;
                  --fr-bg:${c.bg}; --fr-fg:${c.fg}; --fr-sub:${c.sub};">
        <label class="sr-only" for="fr-text">쪽지 내용</label>
        <textarea id="fr-text" class="fr-text" maxlength="${MAX_TEXT}"
                  placeholder="아무 말이나 적어요…">${esc(_compose.text)}</textarea>
        <div class="fr-count"><span id="fr-count">${_compose.text.length}</span> / ${MAX_TEXT}</div>
        <div class="fr-swatches" role="group" aria-label="쪽지 색 고르기">${swatches}</div>
        <div class="fr-compose-btns">
          <button type="button" class="fr-btn ghost" data-fr-act="cancel">취소</button>
          <button type="button" class="fr-btn" data-fr-act="post">붙이기</button>
        </div>
      </div>`;
  }

  function boardHtml() {
    if (!_notes.length && !_compose) {
      return `<p class="fr-empty">아직 아무 쪽지도 없어요.<br>빈 곳을 눌러 첫 쪽지를 붙여 보세요.</p>`;
    }
    /* 오래된 것부터 z-index 1 씩 — 최신 쪽지가 늘 위에 옵니다 */
    return _notes.map((n, i) => noteHtml(n, i + 1)).join("")
         + (_compose ? composeHtml() : "");
  }

  /** 쪽지가 많아지면 보드를 세로로 늘립니다 (넘치면 창이 스크롤돼요).
      좌표는 %라서 보드가 길어지면 쪽지도 자연스레 넓게 퍼집니다. */
  /* [고침 2026-08-07] 기본 높이 430 → 387 (9할). 대신 보드 폭이 3할
     넓어져서 한 줄에 6장까지 들어가므로, 쪽지가 늘어날 때 세로로
     길어지는 속도도 그만큼 늦춥니다 (5장 기준 → 6장 기준). */
  function boardHeight() {
    return Math.max(387, 257 + Math.ceil((_notes.length + 1) / 6) * 130);
  }

  function render() {
    const board = el("forest-board");
    if (!board) return;

    /* 글을 치던 중이면 어디까지 쳤는지·초점을 되돌려 줍니다 */
    const act = document.activeElement;
    const keep = !!(act && act.id === "fr-text");
    const caret = keep ? act.selectionStart : 0;

    board.style.setProperty("--fr-h", boardHeight() + "px");
    board.innerHTML = boardHtml();

    const cnt = el("forest-count");
    if (cnt) cnt.textContent = _notes.length ? `쪽지 ${_notes.length}장` : "";

    if (_compose) {
      const ta = el("fr-text");
      if (ta) {
        try {
          ta.focus();
          const p = keep ? caret : ta.value.length;
          ta.setSelectionRange(p, p);
        } catch (e) {}
      }
    }
  }

  /* ---------------------------------------------------------------
     동작
     --------------------------------------------------------------- */

  /** 빈 곳을 눌렀을 때 — 그 자리를 보드 기준 %로 바꿔 기억합니다 */
  function openCompose(e) {
    const board = el("forest-board");
    if (!board) return;
    const r = board.getBoundingClientRect();
    if (!r.width || !r.height) return;

    /* 쪽지는 왼쪽 위 모서리를 기준으로 놓입니다. 누른 자리가 카드
       한복판이 되도록 조금 당겨 두면 손끝과 덜 어긋나요. */
    const x = clamp(((e.clientX - r.left) / r.width) * 100 - 8, 0, 100);
    const y = clamp(((e.clientY - r.top) / r.height) * 100 - 6, 0, 100);

    _compose = {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      color: Math.floor(Math.random() * FOREST_COLORS.length),
      text: ""
    };
    render();
  }

  function cancelCompose() {
    _compose = null;
    render();
  }

  /** 붙이기 — 여기가 서버에 무엇을 적는지 전부입니다.
      닉네임·uid 는 어떤 이름으로도 넣지 않습니다. */
  async function postNote() {
    if (!_compose || _busy) return;
    const text = String(_compose.text || "").trim().slice(0, MAX_TEXT);
    if (!text) { alert("쪽지에 적을 말을 먼저 써 주세요."); return; }
    if (!me())        { alert("입장 후에 쓸 수 있어요."); return; }
    if (!window.db)   { alert("서버에 연결되어 있지 않아요."); return; }

    _busy = true;
    /* 각도는 지금 한 번만 정해 저장합니다 — 그려질 때마다 새로 뽑으면
       쪽지가 볼 때마다 다른 각도로 기울어 어지럽습니다. */
    const note = {
      text: text,
      color: clamp(Math.round(Number(_compose.color) || 0), 0, FOREST_COLORS.length - 1),
      x: _compose.x,
      y: _compose.y,
      rot: Math.round((Math.random() * 6 - 3) * 10) / 10,   // -3° ~ 3°
      at: Date.now(),
      hearts: 0
    };

    try {
      const ref = window.db.ref("forest").push();
      await ref.set(note);
      remember(MINE_KEY, ref.key);      // ← 이 기기에만 남는 기록
      window.achvBump?.("cForest");     // 🏅 대숲지기 (누가 썼는지는 여전히 안 남습니다)
      _notes.push(normalize(ref.key, note));
      _compose = null;
      render();
    } catch (e) {
      console.warn("[대숲] 쪽지를 붙이지 못했어요", e);
      alert("쪽지를 붙이지 못했어요. 연결을 확인해 주세요.");
    } finally {
      _busy = false;
    }
  }

  /** ♥ 공감 — 서버에는 총 개수만 올라갑니다.
      누가 눌렀는지는 이 기기의 AppStore 에만 남습니다. */
  async function heart(id) {
    if (didHeart(id)) return;                 // 이 기기에서는 한 번만
    const n = _notes.find(v => v.id === id);
    if (!n || !window.db) return;

    n.hearts += 1;                            // 화면이 먼저 반응하도록
    remember(HEART_KEY, id);
    render();

    try {
      await window.db.ref(`forest/${id}/hearts`).transaction(v => (Number(v) || 0) + 1);
    } catch (e) {
      console.warn("[대숲] 공감을 저장하지 못했어요", e);
      n.hearts = Math.max(0, n.hearts - 1);
      forget(HEART_KEY, id);
      render();
    }
  }

  /** 내 쪽지 지우기 — 이 기기가 "내가 썼다"고 기억하는 것만 보입니다 */
  async function removeNote(id) {
    if (!isMine(id)) return;
    if (!confirm("이 쪽지를 지울까요? 되돌릴 수 없어요.")) return;
    const before = _notes.slice();
    _notes = _notes.filter(v => v.id !== id);
    render();
    try {
      await window.db.ref("forest/" + id).remove();
      forget(MINE_KEY, id);
      forget(HEART_KEY, id);
    } catch (e) {
      console.warn("[대숲] 쪽지를 지우지 못했어요", e);
      alert("쪽지를 지우지 못했어요. 연결을 확인해 주세요.");
      _notes = before;
      render();
    }
  }

  /* ---------------------------------------------------------------
     손가락 붙이기
     ★ 리스너는 반드시 안쪽 상자(.modal-content)에 답니다.
       껍데기에는 "바깥을 누르면 닫기"가 걸려 있고, 안쪽 상자는
       onclick="event.stopPropagation()" 으로 click 을 막아 세우기
       때문에 껍데기에 단 리스너는 한 번도 불리지 않습니다.
     --------------------------------------------------------------- */
  function bind() {
    if (_bound) return;
    const root = el("forest-modal");
    if (!root) return;
    _bound = true;

    const box = root.querySelector(".modal-content") || root;
    box.addEventListener("click", onClick);
    box.addEventListener("input", onInput);
  }

  function onClick(e) {
    /* 1) 쪽지의 ✕ */
    const del = e.target.closest("[data-fr-del]");
    if (del) { removeNote(del.getAttribute("data-fr-del")); return; }

    /* 2) ♥ */
    const hb = e.target.closest("[data-fr-heart]");
    if (hb) { heart(hb.getAttribute("data-fr-heart")); return; }

    /* 3) 색 고르기 */
    const sw = e.target.closest("[data-fr-color]");
    if (sw && _compose) {
      _compose.color = clamp(Number(sw.getAttribute("data-fr-color")) || 0,
                             0, FOREST_COLORS.length - 1);
      render();
      return;
    }

    /* 4) 취소 · 붙이기 */
    const act = e.target.closest("[data-fr-act]");
    if (act) {
      const a = act.getAttribute("data-fr-act");
      if (a === "cancel") cancelCompose();
      else if (a === "post") postNote();
      return;
    }

    /* 5) 보드의 빈 곳 — 이미 쪽지나 작성 카드 위라면 아무 일도 안 합니다 */
    const board = e.target.closest("#forest-board");
    if (!board) return;
    if (e.target.closest(".fr-note") || e.target.closest(".fr-compose")) return;
    if (_compose) { cancelCompose(); return; }   // 열려 있던 카드는 먼저 접습니다
    openCompose(e);
  }

  function onInput(e) {
    const t = e.target;
    if (!t || t.id !== "fr-text" || !_compose) return;
    _compose.text = String(t.value || "").slice(0, MAX_TEXT);
    const c = el("fr-count");
    if (c) c.textContent = String(_compose.text.length);
  }

  /* ---------------------------------------------------------------
     열기 / 닫기
     --------------------------------------------------------------- */
  function isOpen() {
    const m = el("forest-modal");
    return !!m && m.style.display === "flex";
  }

  async function openForest() {
    if (!me()) { alert("입장 후에 볼 수 있어요."); return; }
    const modal = el("forest-modal");
    if (!modal) return;

    _compose = null;
    bind();
    modal.style.display = "flex";
    render();                       // 빈 보드를 먼저 (서버를 기다리는 동안 멈춘 듯 보이지 않게)

    await loadNotes();
    await sweepOld();               // 서른 날 지난 쪽지는 조용히 걷어냅니다
    if (isOpen()) render();
  }

  function closeForest() {
    const modal = el("forest-modal");
    if (modal) modal.style.display = "none";
    _compose = null;
  }

  /* ESC — 작성 중이면 카드만 접고, 아니면 창을 닫습니다 */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !isOpen()) return;
    if (_compose) cancelCompose();
    else closeForest();
  });

  window.openForest = openForest;
  window.closeForest = closeForest;
  window.FOREST_COLORS = FOREST_COLORS;   // 점검(checks.js)과 관리자 화면에서 씁니다
})();
