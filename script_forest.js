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

  /** 한 장을 안전한 모양으로 다듬습니다 (옛 데이터·손댄 데이터 대비)
      [2026-08-13] parent — 답쪽지입니다. 값이 있으면 보드가 아니라
      그 부모 쪽지 밑에 작게 겹쳐 붙어요. 익명 규칙은 똑같습니다. */
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
      hearts: Math.max(0, Math.round(Number(v.hearts) || 0)),
      parent: typeof v.parent === "string" ? v.parent : "",
      /* ⌨️ 사진은 forestImg/{id} 에 따로 삽니다 — 여기엔 "있다"는 표시와
         모델명만 둡니다 (쪽지 목록을 가볍게 유지하려고) */
      hasImg: v.hasImg === true,
      model:  typeof v.model === "string" ? v.model.slice(0, 40) : ""
    };
  }

  /** 쪽지 하나를 서버에서 지웁니다 — 사진도 함께.
      ★ 쪽지만 지우고 사진을 두면 아무도 안 보는 40KB 가 영영 남습니다.
        지우는 자리가 세 군데(답쪽지 고아·시듦·내 손)라 한 곳으로 모았어요. */
  async function wipe(id) {
    try { await window.db.ref("forest/" + id).remove(); } catch (e) {}
    try { await window.db.ref("forestImg/" + id).remove(); } catch (e) {}
    _imgCache.delete(id);
    forget(MINE_KEY, id);
    forget(HEART_KEY, id);
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

    /* 부모가 사라진 답쪽지는 같이 걷어냅니다 — 부모가 시들거나 지워지면
       답쪽지 혼자 보드에 나뒹굴 곳이 없어요. 서버에서도 조용히 지웁니다. */
    const ids = new Set(list.map(n => n.id));
    const orphans = list.filter(n => n.parent && !ids.has(n.parent));
    for (const o of orphans) { wipe(o.id); }
    _notes = list.filter(n => !(n.parent && !ids.has(n.parent)));
  }

  /** 서른 날이 지난 쪽지를 조용히 걷어냅니다.
      실패해도 아무 말 하지 않습니다 — 청소는 곁다리 일이라
      실패했다고 화면에 경고를 띄우면 오히려 성가십니다. */
  async function sweepOld() {
    if (!window.db) return;
    /* 🧘 혼자 방에서는 시들지 않습니다 — 나 혼자 붙인 쪽지가 한 달 뒤
       사라지면 그건 메모장이 아니라 모래시계니까요 (2026-08-15) */
    if (window.FOREST_NO_WITHER) return;
    const cut = Date.now() - KEEP_MS;
    const dead = _notes.filter(n => n.at && n.at < cut);
    if (!dead.length) return;
    _notes = _notes.filter(n => !(n.at && n.at < cut));
    for (const n of dead) { await wipe(n.id); }

    /* ★ 주인 없는 사진을 훑어서 걷어내고 싶었지만 **하지 않습니다.**
       그러려면 forestImg 를 통째로 읽어야 하는데, 그게 바로 사진을
       따로 뺀 이유(다 내려받지 않기)를 스스로 무너뜨립니다.
       파이어베이스 자바스크립트 쪽에는 "열쇠만 보기" 가 없어요.
       대신 **고아를 안 만드는 쪽**으로 갑니다 — 붙이기가 도중에
       엎어지면 그 자리에서 사진을 지웁니다(postNote 아래 참고). */
  }

  /* ---------------------------------------------------------------
     화면 그리기
     --------------------------------------------------------------- */

  /* 답쪽지 펼침 상태와 답쪽지 작성 상태 — 이 기기 화면에만 있는 것 */
  let _openReplies = new Set();
  let _reply = null;   // { parent, text, color }

  /** 답쪽지 한 장 — 부모 밑에 작게 겹쳐 붙습니다 */
  function replyHtml(r) {
    const c = colorOf(r.color);
    const mine = isMine(r.id);
    return `
      <div class="fr-reply" style="--fr-bg:${c.bg}; --fr-fg:${c.fg};
             --fr-rot:${r.rot}deg;">
        <span class="fr-reply-text">${esc(r.text)}</span>
        ${mine ? `<button type="button" class="fr-del fr-reply-del" data-fr-del="${esc(r.id)}"
                          title="내 답쪽지 지우기" aria-label="내 답쪽지 지우기">✕</button>` : ""}
      </div>`;
  }

  /** 답쪽지 쓰는 칸 — 펼친 답쪽지 무더기 맨 아래 */
  function replyComposeHtml() {
    const swatches = FOREST_COLORS.map((k, i) => `
      <button type="button" class="fr-swatch mini${i === _reply.color ? " is-on" : ""}"
              data-fr-rcolor="${i}" style="--fr-bg:${k.bg}; --fr-fg:${k.fg};"
              aria-pressed="${i === _reply.color ? "true" : "false"}"></button>`).join("");
    return `
      <div class="fr-rcompose">
        <textarea id="fr-rtext" class="fr-rtext" maxlength="${MAX_TEXT}"
                  placeholder="답쪽지…">${esc(_reply.text)}</textarea>
        <div class="fr-rcompose-row">
          <span class="fr-swatches mini">${swatches}</span>
          <button type="button" class="fr-btn mini" data-fr-ract="post">붙이기</button>
        </div>
      </div>`;
  }

  /** 쪽지 한 장 (보드에 붙는 뿌리 쪽지) */
  function noteHtml(n, z, replies) {
    const c = colorOf(n.color);
    const mine = isMine(n.id);
    const on   = didHeart(n.id);
    const open = _openReplies.has(n.id);
    const rs   = replies || [];
    return `
      <div class="fr-note${mine ? " is-mine" : ""}" data-fr-note="${esc(n.id)}"
           ${mine ? `data-fr-mine="1"` : ""}
           style="--fr-x:${n.x}%; --fr-y:${n.y}%; --fr-rot:${n.rot}deg;
                  --fr-bg:${c.bg}; --fr-fg:${c.fg}; --fr-sub:${c.sub}; z-index:${z};">
        ${mine ? `<button type="button" class="fr-del" data-fr-del="${esc(n.id)}"
                          title="이 쪽지 지우기" aria-label="이 쪽지 지우기">✕</button>` : ""}
        ${n.hasImg ? `<div class="fr-shot" data-fr-shot="${esc(n.id)}"
             role="img" aria-label="키보드 사진">${
               _imgCache.get(n.id)
                 ? `<img src="${_imgCache.get(n.id)}" alt="키보드 사진" loading="lazy">`
                 : ""}</div>` : ""}
        ${n.model ? `<p class="fr-model" title="모델명">⌨️ ${esc(n.model)}</p>` : ""}
        <p class="fr-note-text">${esc(n.text)}</p>
        <div class="fr-note-foot">
          <span class="fr-note-time">${esc(ago(n.at))}</span>
          <span class="fr-note-dot" aria-hidden="true">·</span>
          <button type="button" class="fr-heart${on ? " is-on" : ""}"
                  data-fr-heart="${esc(n.id)}"
                  aria-label="공감 ${n.hearts}개${on ? " (이미 눌렀어요)" : ""}"
                  title="${on ? "이미 공감했어요" : "공감하기 (한 번만)"}">♥ ${n.hearts}</button>
          <span class="fr-note-dot" aria-hidden="true">·</span>
          <button type="button" class="fr-rbtn" data-fr-replies="${esc(n.id)}"
                  title="${open ? "답쪽지 접기" : "답쪽지 보기·쓰기"}"
                  aria-expanded="${open ? "true" : "false"}">${open ? "▴" : "💬"} ${rs.length}</button>
        </div>
        ${open ? `
        <div class="fr-replies${n.y > 55 ? " flip" : ""}">
          ${rs.map(replyHtml).join("")}
          ${_reply && _reply.parent === n.id
            ? replyComposeHtml()
            : `<button type="button" class="fr-rbtn fr-radd" data-fr-reply="${esc(n.id)}">+ 답쪽지 쓰기</button>`}
        </div>` : ""}
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

        <!-- ⌨️ 키보드 자랑 — 사진은 넣어도 되고 안 넣어도 됩니다 -->
        <div class="fr-shot-pick${_compose.shot ? " has-shot" : ""}" id="fr-shot-pick">
          ${_compose.shot
            ? `<img src="${_compose.shot}" alt="고른 사진">
               <button type="button" class="fr-shot-x" data-fr-act="unshot"
                       title="사진 빼기" aria-label="사진 빼기">✕</button>`
            : `<button type="button" class="fr-shot-add" data-fr-act="shot">⌨️ 키보드 사진 넣기</button>`}
        </div>
        ${_compose.shot ? `
        <input type="text" id="fr-model" class="fr-model-in" maxlength="${MODEL_MAX}"
               placeholder="모델명 (예: HHKB Pro 2 무각)" autocomplete="off"
               value="${esc(_compose.model || "")}">` : ""}
        <input type="file" id="fr-shot-file" accept="image/*" hidden>

        <div class="fr-swatches" role="group" aria-label="쪽지 색 고르기">${swatches}</div>
        <div class="fr-compose-btns">
          <button type="button" class="fr-btn ghost" data-fr-act="cancel">취소</button>
          <button type="button" class="fr-btn" data-fr-act="post">붙이기</button>
        </div>
      </div>`;
  }

  /* =====================================================================
     판 넘기기 (2026-08-13) — 한 판에 24장

     판은 쪽지에 기록하지 않습니다. **시간순으로 잘라 자동 배정**해요 —
     오래된 24장이 1판, 다음 24장이 2판…. 그래서
       · 시든 쪽지가 빠지면 뒤 판 쪽지가 앞 판으로 저절로 당겨 붙고
       · 꽉 차면 새 판이 저절로 생기고
       · 서버·보안규칙은 아무것도 안 바뀝니다.
     새 쪽지는 시간순 맨 끝 = 맨 끝 판에 붙습니다. 다른 판을 보다가
     붙여도 붙인 직후 그 판으로 데려다줘요.
     ===================================================================== */
  /* =====================================================================
     ⌨️ 키보드 자랑 — 쪽지에 사진 한 장 (2026-08-15)
     ---------------------------------------------------------------------
     [왜 사진을 쪽지 안에 안 넣었나]
     대숲은 열 때마다 **쪽지를 전부** 내려받습니다(forest 를 통째로 once).
     사진을 쪽지에 같이 담으면 한 번 열 때마다 모든 사진이 따라와요.
     40장이면 2MB 가 넘고, 방 전체로 치면 무료치를 한 달 안에 다 씁니다.

     [그래서 두 자리로 나눕니다]
       forest/{id}      … 지금까지와 똑같음 + hasImg, model
       forestImg/{id}   … 사진 한 장 (data URL)
     쪽지 목록은 예전만큼 가볍고, 사진은 **지금 보는 판에 뜬 것만**
     따로 가져옵니다. 한 번 가져온 것은 이 자리에 기억해 두고요.

     [보안규칙 — 콘솔에 넣어야 합니다]
       "forestImg": {
         ".read": "auth != null",
         "$id": { ".write": "auth != null" }
       }
     쪽지와 같은 결입니다 — 익명이라 "글쓴이만" 을 규칙으로 쓸 수 없어요.
     쪽지를 지우면 사진도 같이 지웁니다.
     ===================================================================== */
  /* [고침 2026-08-15] 660×220 → 360×120.
     쪽지에 사진이 실제로 보이는 크기는 **150 × 50px** 입니다. 레티나
     화면을 감안해 두 배로 잡아도 300×100 이면 충분한데, 처음에
     660×220 으로 만들었어요 — 필요한 픽셀의 다섯 배를 저장하고
     있었습니다. 화면에서는 어차피 줄여 그리므로 **눈에 보이는 차이는
     없고**, 통신량만 절반이 됩니다(한 장 36KB → 20KB).
     ★ 더 줄이려면 300×100(13KB)까지 갈 수 있습니다. 360 으로 둔 건
       나중에 크게 보기를 붙이거나 카드 폭을 넓힐 여지를 조금 남긴 것. */
  const SHOT_W = 360, SHOT_H = 120;          // 3 : 1
  const SHOT_MAX = 40 * 1024;                // data URL 문자열 상한
  const MODEL_MAX = 40;                      // 모델명 글자 수
  const _imgCache = new Map();               // id → data URL (이 자리에만)
  let   _imgWant = new Set();                // 지금 판에서 기다리는 것

  /** 파일 → 3:1 로 가운데를 잘라 줄인 data URL */
  function fileToBoardShot(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("파일이 없어요."));
      if (!/^image\//.test(file.type)) return reject(new Error("이미지 파일만 올릴 수 있어요."));
      if (file.size > 12 * 1024 * 1024) return reject(new Error("파일이 너무 커요. 12MB 이하로 부탁해요."));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const cv = document.createElement("canvas");
          cv.width = SHOT_W; cv.height = SHOT_H;
          const ctx = cv.getContext("2d");
          const want = SHOT_W / SHOT_H;
          let sw = img.width, sh = Math.round(img.width / want);
          if (sh > img.height) { sh = img.height; sw = Math.round(img.height * want); }
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, SHOT_W, SHOT_H);
          let out = "";
          for (const q of [0.82, 0.72, 0.62, 0.52, 0.42]) {
            out = cv.toDataURL("image/jpeg", q);
            if (out.length <= SHOT_MAX) break;
          }
          if (out.length > SHOT_MAX) return reject(new Error("사진을 충분히 줄이지 못했어요. 다른 사진으로 부탁해요."));
          resolve(out);
        } catch (e) { reject(new Error("사진을 바꾸지 못했어요.")); }
        finally { URL.revokeObjectURL(url); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("사진을 읽지 못했어요.")); };
      img.src = url;
    });
  }

  /** 지금 판에 뜬 사진만 가져옵니다 — 한 장씩, 이미 가진 건 건너뛰고 */
  async function fetchShots(ids) {
    if (!window.db) return;
    const 할것 = ids.filter(id => !_imgCache.has(id) && !_imgWant.has(id));
    if (!할것.length) return;
    할것.forEach(id => _imgWant.add(id));
    for (const id of 할것) {
      try {
        const v = (await window.db.ref("forestImg/" + id).once("value")).val();
        _imgCache.set(id, (typeof v === "string" && v.startsWith("data:image/")) ? v : "");
      } catch (e) {
        _imgCache.set(id, "");
      } finally {
        _imgWant.delete(id);
      }
      /* 한 장 올 때마다 그 자리에만 끼워 넣습니다 — 판 전체를 다시 그리면
         쪽지를 끌던 손이 튕기고, 열어 둔 답쪽지도 접혀요 */
      const slot = document.querySelector(`[data-fr-shot="${id}"]`);
      const src = _imgCache.get(id);
      if (slot && src) slot.innerHTML = `<img src="${src}" alt="키보드 사진" loading="lazy">`;
      else if (slot) slot.remove();
    }
  }

  const PAGE_SIZE = 24;
  let _page = 0;         // 지금 보는 판 (0부터)

  function rootNotes() { return _notes.filter(n => !n.parent); }
  function pageCount() { return Math.max(1, Math.ceil(rootNotes().length / PAGE_SIZE)); }

  function pagerHtml() {
    const pc = pageCount();
    if (pc <= 1) return "";
    let h = `<button type="button" class="fr-pg" data-fr-page="prev"
                     aria-label="이전 판"${_page === 0 ? " disabled" : ""}>‹</button>`;
    for (let i = 0; i < pc; i++) {
      h += `<button type="button" class="fr-pg${i === _page ? " is-on" : ""}"
                    data-fr-page="${i}" aria-label="${i + 1}판"
                    ${i === _page ? `aria-current="page"` : ""}>${i + 1}</button>`;
    }
    h += `<button type="button" class="fr-pg" data-fr-page="next"
                  aria-label="다음 판"${_page >= pc - 1 ? " disabled" : ""}>›</button>`;
    return h;
  }

  function boardHtml() {
    if (!_notes.length && !_compose) {
      return `<p class="fr-empty">아직 아무 쪽지도 없어요.<br>빈 곳을 눌러 첫 쪽지를 붙여 보세요.</p>`;
    }
    /* 뿌리 쪽지만 보드에 — 답쪽지는 제 부모 밑으로 들어갑니다 */
    const all = rootNotes();
    _page = clamp(_page, 0, pageCount() - 1);
    const roots = all.slice(_page * PAGE_SIZE, (_page + 1) * PAGE_SIZE);
    const byParent = {};
    _notes.forEach(n => {
      if (!n.parent) return;
      (byParent[n.parent] = byParent[n.parent] || []).push(n);
    });
    /* 오래된 것부터 z-index 1 씩 — 최신 쪽지가 늘 위에 옵니다.
       답쪽지를 펼친 쪽지는 무더기가 이웃 위로 오도록 한층 더 올립니다 */
    /* ⌨️ 지금 판에 뜬 사진만 뒤따라 가져옵니다 — 그리기를 막지 않게
       다음 차례로 미룹니다 (자리는 이미 만들어 두었어요) */
    const 사진있는것 = roots.filter(n => n.hasImg).map(n => n.id);
    if (사진있는것.length) setTimeout(() => fetchShots(사진있는것), 0);

    return roots.map((n, i) =>
        noteHtml(n, _openReplies.has(n.id) ? roots.length + 1 + i : i + 1,
                 byParent[n.id])).join("")
         + (_compose ? composeHtml() : "");
  }

  /* [바꿈 2026-08-13] 쪽지 수에 따라 보드를 늘리던 boardHeight() 를
     없앴습니다 — 쪽지가 붙을수록 창이 길어져 스크롤이 생기는 원인이
     그거였어요. 이제 높이는 CSS 가 화면에 맞춰 고정합니다
     (styles.css .fr-board — 화면 높이에서 제목·여백만큼 뺀 값).
     좌표가 %라서 보드 크기가 바뀌어도 쪽지의 상대 위치는 그대로예요. */

  function render() {
    const board = el("forest-board");
    if (!board) return;

    /* 글을 치던 중이면 어디까지 쳤는지·초점을 되돌려 줍니다 */
    const act = document.activeElement;
    const keep = !!(act && (act.id === "fr-text" || act.id === "fr-rtext"));
    const caret = keep ? act.selectionStart : 0;
    const keepId = keep ? act.id : "";

    board.innerHTML = boardHtml();

    const cnt = el("forest-count");
    if (cnt) {
      const roots = rootNotes().length;
      const replies = _notes.length - roots;
      cnt.textContent = roots
        ? `🎋 쪽지 ${roots}장${replies ? ` · 답쪽지 ${replies}장` : ""}`
        : "";
    }
    const pg = el("forest-pager");
    if (pg) pg.innerHTML = pagerHtml();

    if (_compose || _reply) {
      const ta = el(keepId || (_reply ? "fr-rtext" : "fr-text"));
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
    const x = clamp(((e.clientX - r.left) / r.width) * 100 - 8, 0, 88);
    /* 세로는 72%까지만 — 맨 아래를 눌러도 작성 카드가 잘리지 않게
       살짝 위로 당겨 앉힙니다 (쪽지 자체는 어디든 끌어다 둘 수 있어요) */
    const y = clamp(((e.clientY - r.top) / r.height) * 100 - 6, 0, 72);

    _compose = {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      color: Math.floor(Math.random() * FOREST_COLORS.length),
      text: "",
      shot: "",      // ⌨️ 고른 사진 (아직 서버에 안 올라간 상태)
      model: ""
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
    /* ⌨️ 사진이 있으면 표시만 쪽지에, 알맹이는 따로 */
    const shot = _compose.shot || "";
    if (shot) {
      note.hasImg = true;
      note.model = String(_compose.model || "").slice(0, MODEL_MAX).trim();
    }

    try {
      const ref = window.db.ref("forest").push();
      /* ★ 사진을 **먼저** 올립니다. 쪽지가 먼저 올라간 뒤 사진이 실패하면
           "사진이 있다는데 없는 쪽지" 가 남아요. 순서를 뒤집으면
           최악이 "주인 없는 사진 한 장" 인데, 그건 아래 청소가 걷어냅니다. */
      if (shot) await window.db.ref("forestImg/" + ref.key).set(shot);
      try {
        await ref.set(note);
      } catch (err) {
        /* 사진만 올라가고 쪽지가 엎어졌습니다 — 아무도 못 보는 사진이
           영영 남지 않게 그 자리에서 되돌립니다 */
        if (shot) { try { await window.db.ref("forestImg/" + ref.key).remove(); } catch (e2) {} }
        throw err;
      }
      if (shot) _imgCache.set(ref.key, shot);
      remember(MINE_KEY, ref.key);      // ← 이 기기에만 남는 기록
      window.achvBump?.("cForest");     // 🏅 대숲지기 (누가 썼는지는 여전히 안 남습니다)
      _notes.push(normalize(ref.key, note));
      _compose = null;
      _page = pageCount() - 1;          // 새 쪽지는 맨 끝 판에 붙습니다 — 거기로 데려다줘요
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
      await wipe(id);
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
    /* ⌨️ 파일 고르기 — 작성 카드는 다시 그려지므로 요소마다 달지 않고
       바깥에서 위임으로 받습니다 (change 는 거품이 올라옵니다) */
    box.addEventListener("change", onFilePick);
    bindDrag();
  }

  function onClick(e) {
    /* 0) 방금 쪽지를 끌었다면 이 클릭은 끌기의 꼬리 — 아무것도 안 합니다 */
    if (_dragged) { _dragged = false; return; }

    /* 0-0) 판 넘기기 */
    const pg = e.target.closest("[data-fr-page]");
    if (pg) {
      const v = pg.getAttribute("data-fr-page");
      if (v === "prev") _page = Math.max(0, _page - 1);
      else if (v === "next") _page = Math.min(pageCount() - 1, _page + 1);
      else _page = clamp(Number(v) || 0, 0, pageCount() - 1);
      _compose = null;              // 판을 넘기면 쓰던 카드는 접습니다
      render();
      return;
    }

    /* 0-1) 답쪽지 펼치기/접기 · 쓰기 · 붙이기 */
    const rb = e.target.closest("[data-fr-replies]");
    if (rb) {
      const id = rb.getAttribute("data-fr-replies");
      if (_openReplies.has(id)) { _openReplies.delete(id); if (_reply?.parent === id) _reply = null; }
      else _openReplies.add(id);
      render(); return;
    }
    const ra = e.target.closest("[data-fr-reply]");
    if (ra) {
      _reply = { parent: ra.getAttribute("data-fr-reply"), text: "",
                 color: Math.floor(Math.random() * FOREST_COLORS.length) };
      render(); return;
    }
    const rc = e.target.closest("[data-fr-rcolor]");
    if (rc && _reply) {
      _reply.color = clamp(Number(rc.getAttribute("data-fr-rcolor")) || 0,
                           0, FOREST_COLORS.length - 1);
      render(); return;
    }
    const ract = e.target.closest("[data-fr-ract]");
    if (ract) { postReply(); return; }

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
      else if (a === "shot") el("fr-shot-file")?.click();     // ⌨️ 파일 고르기
      else if (a === "unshot" && _compose) {
        _compose.shot = ""; _compose.model = "";
        render();
      }
      return;
    }

    /* 5) 보드의 빈 곳 — 이미 쪽지나 작성 카드 위라면 아무 일도 안 합니다 */
    const board = e.target.closest("#forest-board");
    if (!board) return;
    if (e.target.closest(".fr-note") || e.target.closest(".fr-compose")) return;
    if (_compose) { cancelCompose(); return; }   // 열려 있던 카드는 먼저 접습니다
    openCompose(e);
  }

  async function onFilePick(e) {
    const inp = e.target;
    if (!inp || inp.id !== "fr-shot-file" || !_compose) return;
    const f = inp.files?.[0];
    inp.value = "";
    if (!f) return;
    const btn = document.querySelector(".fr-shot-add");
    if (btn) { btn.disabled = true; btn.textContent = "줄이는 중…"; }
    try {
      _compose.shot = await fileToBoardShot(f);
      render();
    } catch (err) {
      alert(err?.message || "사진을 넣지 못했어요.");
      if (btn) { btn.disabled = false; btn.textContent = "⌨️ 키보드 사진 넣기"; }
    }
  }

  function onInput(e) {
    const t = e.target;
    if (t && t.id === "fr-rtext" && _reply) {
      _reply.text = String(t.value || "").slice(0, MAX_TEXT);
      return;
    }
    if (t && t.id === "fr-model" && _compose) {
      _compose.model = String(t.value || "").slice(0, MODEL_MAX);
      return;
    }
    if (!t || t.id !== "fr-text" || !_compose) return;
    _compose.text = String(t.value || "").slice(0, MAX_TEXT);
    const c = el("fr-count");
    if (c) c.textContent = String(_compose.text.length);
  }

  /** 답쪽지 붙이기 — 뿌리 쪽지와 같은 익명 규칙, parent 만 하나 더 */
  async function postReply() {
    if (!_reply || _busy) return;
    const text = String(_reply.text || "").trim().slice(0, MAX_TEXT);
    if (!text) { alert("답쪽지에 적을 말을 먼저 써 주세요."); return; }
    if (!me() || !window.db) return;
    _busy = true;
    const note = {
      text,
      color: clamp(Math.round(Number(_reply.color) || 0), 0, FOREST_COLORS.length - 1),
      x: 0, y: 0,
      rot: Math.round((Math.random() * 4 - 2) * 10) / 10,   // 답쪽지는 살짝만
      at: Date.now(),
      hearts: 0,
      parent: _reply.parent
    };
    try {
      const ref = window.db.ref("forest").push();
      await ref.set(note);
      remember(MINE_KEY, ref.key);
      _notes.push(normalize(ref.key, note));
      _reply = null;
      render();
    } catch (e) {
      console.warn("[대숲] 답쪽지를 붙이지 못했어요", e);
      alert("답쪽지를 붙이지 못했어요. 연결을 확인해 주세요.");
    } finally {
      _busy = false;
    }
  }

  /* ---------------------------------------------------------------
     내 쪽지 끌어 옮기기 (2026-08-13)

     이 기기가 기억하는 **내 쪽지만** 끌립니다 — 아무나 남의 쪽지를
     옮기면 아침마다 보드가 뒤죽박죽일 테니까요.
     서버에는 x·y 만 고쳐 씁니다. 보안규칙이 "글이 그대로인 수정"을
     이미 허용하고 있어서 규칙 변경이 없습니다 (♥ 와 같은 문).
     5px 넘게 움직였을 때만 끌기로 칩니다 — 안 그러면 ♥ 누르려던
     클릭이 끌기로 오해받아요. 끌었으면 뒤따르는 click 을 삼킵니다.
     --------------------------------------------------------------- */
  let _dragNote = null;
  let _dragged = false;

  function bindDrag() {
    const board = el("forest-board");
    if (!board || board.__frDragBound) return;
    board.__frDragBound = true;

    board.addEventListener("pointerdown", (e) => {
      const noteEl = e.target.closest("[data-fr-mine]");
      if (!noteEl) return;
      /* 단추(♥·✕·💬)와 답쪽지 무더기 위에서는 끌지 않습니다 */
      if (e.target.closest("button") || e.target.closest(".fr-replies")) return;
      const id = noteEl.getAttribute("data-fr-note");
      const n = _notes.find(v => v.id === id);
      if (!n) return;
      const r = board.getBoundingClientRect();
      _dragNote = { n, el: noteEl, sx: e.clientX, sy: e.clientY,
                    ox: n.x, oy: n.y, bw: r.width, bh: r.height, moved: false };
      noteEl.setPointerCapture?.(e.pointerId);
    });

    board.addEventListener("pointermove", (e) => {
      if (!_dragNote) return;
      const dx = e.clientX - _dragNote.sx, dy = e.clientY - _dragNote.sy;
      if (!_dragNote.moved && Math.hypot(dx, dy) < 5) return;
      _dragNote.moved = true;
      _dragNote.el.classList.add("dragging");
      const x = clamp(_dragNote.ox + (dx / _dragNote.bw) * 100, 0, 96);
      const y = clamp(_dragNote.oy + (dy / _dragNote.bh) * 100, 0, 92);
      _dragNote.n.x = Math.round(x * 10) / 10;
      _dragNote.n.y = Math.round(y * 10) / 10;
      _dragNote.el.style.setProperty("--fr-x", _dragNote.n.x + "%");
      _dragNote.el.style.setProperty("--fr-y", _dragNote.n.y + "%");
      e.preventDefault();
    });

    const drop = () => {
      if (!_dragNote) return;
      const d = _dragNote;
      _dragNote = null;
      d.el.classList.remove("dragging");
      if (!d.moved) return;
      _dragged = true;                        // 뒤따르는 click 삼키기
      window.db?.ref("forest/" + d.n.id).update({ x: d.n.x, y: d.n.y })
        .catch(e => console.warn("[대숲] 자리를 저장하지 못했어요", e));
    };
    board.addEventListener("pointerup", drop);
    board.addEventListener("pointercancel", drop);
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
    _reply = null;
    _openReplies = new Set();
    bind();
    modal.style.display = "flex";
    render();                       // 빈 보드를 먼저 (서버를 기다리는 동안 멈춘 듯 보이지 않게)

    await loadNotes();
    await sweepOld();               // 서른 날 지난 쪽지는 조용히 걷어냅니다
    _page = pageCount() - 1;        // 열면 맨 끝 판(최신)부터
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
