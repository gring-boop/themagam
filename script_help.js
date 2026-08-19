/* TheMagam © 링가링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 🆘 살려주세요‼️ (script_help.js, 2026-08-16)

   [무엇인가]
   "이거 맞나요?" 하고 후다닥 묻는 자리. 이름이 🆘 살려주세요‼️ 인 건
   일부러예요 — Help 라고 하면 점잖아져서, 사소한 걸 묻기가 되레
   망설여집니다. 급하고 우스꽝스러운 이름이라야 문턱이 낮아요. 맞춤법·띄어쓰기·단어 고르기·
   문장 다듬기 — 짧게 묻고 가볍게 답합니다.

   [완전 익명 — 대숲과 같은 방식]
   서버에 닉네임을 **아예 적지 않습니다.** 관리자도 누가 썼는지 볼
   방법이 없어요. "내 글" 이라는 표시(✕ 단추, 맨 위 올리기)는 이 기기의
   AppStore 가 기억할 뿐이라, 다른 기기에서는 남의 글과 똑같이 보입니다.

   [채택도 하트도 없습니다 — 일부러]
   처음에는 "이 답이 맞았어요(채택)" 와 하트를 넣으려다 뺐습니다.
   방장 말이 맞아요 — **채택은 은근히 자존심 문제**라, 고르는 순간
   안 뽑힌 답을 단 사람이 머쓱해집니다. 그러면 다음부터 아무도 답을
   안 달아요. 급할 때 후다닥 묻는 자리인데 답이 안 달리면 끝입니다.

   대신 **💡 아하 스티커**를 붙입니다. "아하! 도움 됐어요" 정도의
   가벼운 표시고, **여러 사람이 겹쳐 붙일 수 있습니다.** 고르는 게
   아니라 쌓이는 것이라 아무도 떨어뜨리지 않아요.
   ★ 전구인 이유 — ✓ 는 "맞다/틀리다" 로 읽혀서 은근히 심사하는 결이
     됩니다. 💡 는 "나도 알았다" 라 답한 사람도 본 사람도 편해요.

   [줄 세우는 차례]
     ① 이 기기에서 내가 쓴 글      — 답이 달렸나 궁금하니까
     ② 아직 답이 없는 글           — 위에 있어야 지나가다 눈이 갑니다
     ③ 나머지 (최신순)
   ★ ②가 이 판의 핵심입니다. 그냥 시간순으로 쌓으면 답 없는 질문이
     아래로 가라앉아 영영 답을 못 받아요.

   [2주 뒤 사라집니다]
   대숲은 30일인데 여기는 14일입니다. 급한 물음이라 오래 둘 이유가
   없고, 짧게 도는 편이 "가볍게 물어도 되는 곳" 이라는 인상에 맞아요.

   [보안규칙 — 콘솔 적용 필요]
     "help": {
       ".read": "auth != null",
       "$id": { ".write": "auth != null" }
     }
   대숲과 같은 결입니다 — 익명이라 "글쓴이만" 을 규칙으로 쓸 수 없어요.
   화면에서 이 기기가 기억하는 내 글에만 ✕ 를 보여 주는 방식입니다.
   ===================================================================== */
(function () {
  "use strict";

  const MAX_TEXT  = 300;                 // 짧게 묻는 자리라 길지 않게
  const KEEP_MS   = 14 * 24 * 60 * 60 * 1000;
  const MINE_KEY  = "helpMine";          // 이 기기가 쓴 글
  const CHECK_KEY = "helpChecks";        // 이 기기가 💡 붙인 글

  let _rows = [];
  let _ref = null;
  let _bound = false;
  let _busy = false;
  let _reply = null;                     // { parent, text }
  /* 🔗 비슷한 질문 연결 (2026-08-18)
     _pickRef : 쓰는 중에 골라 둔 참고 글 { id, text } — 올릴 때 ref 로 실림
     _refOpen : 펼쳐 둔 참고 칩의 질문 id 들 (이 화면에서만) */
  let _pickRef = null;
  const _refOpen = new Set();

  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  /* ---- 이 기기만 아는 것 ---- */
  function readSet(key) {
    try {
      const arr = JSON.parse(window.AppStore?.getItem(key) || "[]");
      return Array.isArray(arr) ? arr.filter(x => typeof x === "string") : [];
    } catch (e) { return []; }
  }
  function writeSet(key, arr) {
    try { window.AppStore?.setItem(key, JSON.stringify(arr.slice(-500))); } catch (e) {}
  }
  function isMine(id)  { return readSet(MINE_KEY).indexOf(id) >= 0; }
  function didCheck(id){ return readSet(CHECK_KEY).indexOf(id) >= 0; }
  function remember(key, id) {
    const arr = readSet(key);
    if (arr.indexOf(id) < 0) { arr.push(id); writeSet(key, arr); }
  }
  function forget(key, id) { writeSet(key, readSet(key).filter(x => x !== id)); }

  /* ---- 서버에서 읽어 온 줄 다듬기 ---- */
  function normalize(id, v) {
    if (!v || typeof v !== "object") return null;
    const text = String(v.text || "").slice(0, MAX_TEXT);
    if (!text.trim()) return null;
    return {
      id,
      text,
      at: Number(v.at) || 0,
      parent: typeof v.parent === "string" ? v.parent : "",
      checks: Math.max(0, Math.round(Number(v.checks) || 0)),
      /* 🔗 참고하는 옛 질문의 글 번호 하나 — 익명은 그대로입니다 */
      ref: typeof v.ref === "string" ? v.ref : ""
    };
  }

  /* =====================================================================
     🔗 비슷한 질문 찾기 (2026-08-18)
     ---------------------------------------------------------------------
     같은 물음이 또 올라오면 옛 답을 참고하라고 이어 줍니다.
     이미 화면에 들고 있는 최근 2주 치(_rows)에서 **낱말 앞 두 글자가
     겹치는** 질문을 그 자리에서 찾아요 — 서버에 묻지 않아 통신량 0.
     ★ 더 똑똑한 비교(형태소 등)는 일부러 안 합니다. 질문이 짧아 이
       정도로 잘 걸리고, 영리하게 만들려다 엉뚱한 걸 물어오면 되레
       시끄러워요.
     ===================================================================== */
  function 낱말(s) {
    return (String(s || "").match(/[가-힣a-zA-Z]{2,}/g) || []).map(w => w.slice(0, 2));
  }
  function 비슷한질문(text) {
    const tk = 낱말(text);
    if (!tk.length) return [];
    return 정렬된질문()
      .filter(q => {
        const qt = 낱말(q.text);
        return tk.some(w => qt.indexOf(w) >= 0);
      })
      .sort((a, b) => b.답 - a.답 || b.at - a.at)   // 답 많은 글이 먼저 — 참고 가치순
      .slice(0, 3);
  }

  function 언제(at) {
    if (!at) return "";
    const 분 = Math.floor((Date.now() - at) / 60000);
    if (분 < 1) return "방금";
    if (분 < 60) return `${분}분 전`;
    const 시 = Math.floor(분 / 60);
    if (시 < 24) return `${시}시간 전`;
    const 날 = Math.floor(시 / 24);
    return `${날}일 전`;
  }

  /* =====================================================================
     줄 세우기 — 내 글 · 답 없는 글 · 나머지
     ===================================================================== */
  function 정렬된질문() {
    const 뿌리 = _rows.filter(r => !r.parent);
    const 답수 = {};
    _rows.forEach(r => { if (r.parent) 답수[r.parent] = (답수[r.parent] || 0) + 1; });

    return 뿌리
      .map(r => ({ ...r, 답: 답수[r.id] || 0, 내것: isMine(r.id) }))
      .sort((a, b) => {
        /* ① 내 글이 맨 위 — 이 기기에서만 그렇습니다 */
        if (a.내것 !== b.내것) return a.내것 ? -1 : 1;
        /* ② 답 없는 글이 그다음 — 안 그러면 영영 답을 못 받아요 */
        const a없 = a.답 === 0, b없 = b.답 === 0;
        if (a없 !== b없) return a없 ? -1 : 1;
        /* ③ 최신순 */
        return b.at - a.at;
      });
  }

  function 답들(parentId) {
    return _rows.filter(r => r.parent === parentId).sort((a, b) => a.at - b.at);
  }

  /* =====================================================================
     그리기
     ===================================================================== */
  function 답HTML(r) {
    const on = didCheck(r.id);
    return `
      <div class="help-a${r.checks ? " has-check" : ""}">
        <div class="help-a-h">
          <span class="help-t">${esc(언제(r.at))}</span>
          <span class="help-sp"></span>
          ${isMine(r.id) ? `<button type="button" class="help-x" data-help-del="${esc(r.id)}"
                                    title="내 답 지우기" aria-label="내 답 지우기">✕</button>` : ""}
          <button type="button" class="help-check${on ? " is-on" : ""}"
                  data-help-check="${esc(r.id)}"
                  aria-pressed="${on ? "true" : "false"}"
                  title="${on ? "아하 스티커를 뗍니다" : "아하! 도움 됐어요"}">💡 ${r.checks || 0}</button>
        </div>
        <p class="help-a-t">${esc(r.text)}</p>
      </div>`;
  }

  /* 🔗 참고 칩 + 펼침 — 옛 질문과 그 답들을 그 자리에서 보여줍니다.
     참고하던 글이 14일이 지나 먼저 사라졌으면 곱게 접습니다. */
  function 참고HTML(q) {
    if (!q.ref) return "";
    const 원본 = _rows.find(r => r.id === q.ref && !r.parent);
    if (!원본) {
      return `<div class="help-ref gone">🍂 참고하던 글이 사라졌어요 (여기는 2주만 머무는 곳이라서요)</div>`;
    }
    const 열림 = _refOpen.has(q.id);
    const rs = 답들(원본.id);
    return `
      <div class="help-ref${열림 ? " open" : ""}" data-help-ref="${esc(q.id)}" role="button" tabindex="0">
        🔗 <span class="help-ref-t">비슷한 질문: ${esc(원본.text)}</span>
        <span class="help-t">${esc(언제(원본.at))} · 답 ${rs.length}</span>
      </div>
      ${열림 ? `
        <div class="help-refbody">
          <p class="help-ref-q">${esc(원본.text)}</p>
          ${rs.length
            ? rs.map(r => `<div class="help-ref-a"><span>${esc(r.text)}</span>
                           ${r.checks ? `<span class="help-ref-c">💡 ${r.checks}</span>` : ""}</div>`).join("")
            : `<p class="help-ref-a">아직 답이 없던 글이에요.</p>`}
        </div>` : ""}`;
  }

  function 질문HTML(q) {
    const as = 답들(q.id);
    const 쓰는중 = _reply && _reply.parent === q.id;
    return `
      <div class="help-q${q.답 ? "" : " waiting"}${q.내것 ? " mine" : ""}" data-help-q="${esc(q.id)}">
        <div class="help-q-h">
          ${q.내것 ? `<span class="help-tag mine">내 글</span>` : ""}
          ${q.답 ? `<span class="help-t">답 ${q.답}</span>`
                 : `<span class="help-tag wait">답 기다리는 중</span>`}
          <span class="help-t">${esc(언제(q.at))}</span>
          <span class="help-sp"></span>
          ${isMine(q.id) ? `<button type="button" class="help-x" data-help-del="${esc(q.id)}"
                                    title="내 글 지우기" aria-label="내 글 지우기">✕</button>` : ""}
        </div>
        <p class="help-q-t">${esc(q.text)}</p>
        ${참고HTML(q)}
        ${as.map(답HTML).join("")}
        ${쓰는중 ? `
          <div class="help-write">
            <textarea id="help-reply" class="help-in" maxlength="${MAX_TEXT}"
                      placeholder="가볍게 한 줄이면 돼요">${esc(_reply.text)}</textarea>
            <div class="help-write-b">
              <button type="button" class="fr-btn ghost" data-help-act="cancel">취소</button>
              <button type="button" class="fr-btn" data-help-act="reply">답 달기</button>
            </div>
          </div>`
        : `<button type="button" class="help-more" data-help-reply="${esc(q.id)}">+ 답 달기</button>`}
      </div>`;
  }

  function render() {
    const box = el("help-board");
    if (!box) return;
    const qs = 정렬된질문();
    const 기다림 = qs.filter(q => q.답 === 0).length;

    const 머리 = `
      <div class="help-head">
        <!-- ★ [고침 2026-08-16] 판 안쪽 제목을 뺐습니다.
             판 머리말이 이미 "🆘 살려주세요‼️" 를 보여줘서 두 줄이
             겹쳐 보였어요 (실제 제보). 이름은 머리말에 맡기고 여기는
             부제 한 줄만 둡니다.
             ★ 부제가 "이 표현 맞나요?" 가 아닌 이유 — 맞다/틀리다를
               묻는 말투는 답하는 쪽에 정답을 요구하게 됩니다.
               "같이 고민해 주세요" 는 확신이 없어도 거들 수 있는 말이에요. -->
        <span class="help-sub">🚨 이 표현 어때요? 이 단어는요?? 같이 고민해 주세요! 😭</span>
        <span class="help-sp"></span>
        ${기다림 ? `<span class="help-tag wait">답 기다리는 중 ${기다림}</span>` : ""}
      </div>`;

    const 목록 = qs.length
      ? qs.map(질문HTML).join("")
      : `<p class="help-empty">아직 물어본 게 없어요.<br>
         맞춤법이든 단어든, 아래에 후다닥 적어 보세요.</p>`;

    box.innerHTML = 머리 + `<div class="help-list">${목록}</div>` + `
      ${_pickRef ? `
        <div class="help-pin">🔗 "${esc(_pickRef.text.slice(0, 20))}${_pickRef.text.length > 20 ? "…" : ""}"
          참고를 달아서 올려요
          <button type="button" class="help-x" data-help-unpin="1" aria-label="참고 떼기">✕</button>
        </div>` : ""}
      <div class="help-ask">
        <input type="text" id="help-new" maxlength="${MAX_TEXT}" autocomplete="off"
               placeholder="맞춤법·단어·문장 무엇이든">
        <!-- [2026-08-16] 채팅의 ↑ 단추와 같은 결. "올리기" 라는 글자가
             네모나게 앉아 있으면 판이 무거워 보입니다 — 가볍게 묻는
             자리라 손잡이도 가벼워야 해요. -->
        <button type="button" class="help-send" data-help-act="ask"
                aria-label="올리기" title="올리기">↑</button>
      </div>
      <!-- 🔗 비슷한 질문 제안 — 쓰는 중에만 잠깐 나타납니다.
           ★ 여기는 render() 로 다시 그리면 안 됩니다 — 입력칸이 새로
             태어나 초점과 조합 중이던 한글이 날아가요 (0813 자소 분리의
             친척). 그래서 입력 이벤트가 이 상자의 속만 갈아 끼웁니다. -->
      <div class="help-sug" id="help-sug" hidden></div>
      <p class="help-note">🔒 이름은 서버에도 남지 않아요 · 2주 뒤 사라집니다</p>`;
  }

  /* 쓰는 중 제안 그리기 — 전체 render() 없이 제 상자 속만 바꿉니다 */
  function 제안그리기() {
    const box = el("help-sug");
    const inp = el("help-new");
    if (!box || !inp) return;
    if (_pickRef) { box.hidden = true; return; }       // 이미 골랐으면 조용히
    const hit = 비슷한질문(inp.value);
    if (!hit.length) { box.hidden = true; return; }
    box.innerHTML = `
      <div class="help-sug-h">💡 비슷한 질문이 있었어요 — 먼저 볼래요?</div>
      ${hit.map(h => `
        <button type="button" class="help-sug-i" data-help-sug="${esc(h.id)}">
          🔗 <span class="help-sug-t">${esc(h.text)}</span>
          <span class="help-t">답 ${h.답} · ${esc(언제(h.at))}</span>
        </button>`).join("")}
      <div class="help-sug-f">누르면 새 글에 🔗 참고 고리가 달려요 · 그냥 올려도 돼요</div>`;
    box.hidden = false;
  }

  /* =====================================================================
     서버
     ===================================================================== */
  function listen() {
    if (_ref || !window.db) return;
    _ref = window.db.ref("help");
    _ref.on("value", snap => {
      const raw = snap.val() || {};
      const list = [];
      Object.keys(raw).forEach(id => {
        const r = normalize(id, raw[id]);
        if (r) list.push(r);
      });
      /* 부모가 사라진 답은 걷어냅니다 — 대숲의 답쪽지와 같은 이유예요 */
      const ids = new Set(list.map(r => r.id));
      _rows = list.filter(r => !(r.parent && !ids.has(r.parent)));
      render();
      sweep();
    });
  }

  /** 2주 지난 것은 조용히 걷어냅니다 (실패해도 아무 말 하지 않습니다) */
  async function sweep() {
    if (!window.db || window.FOREST_NO_WITHER) return;
    const cut = Date.now() - KEEP_MS;
    const dead = _rows.filter(r => r.at && r.at < cut);
    if (!dead.length) return;
    for (const r of dead) {
      try { await window.db.ref("help/" + r.id).remove(); } catch (e) {}
      forget(MINE_KEY, r.id); forget(CHECK_KEY, r.id);
    }
  }

  async function 올리기(text, parent, refId) {
    const t = String(text || "").trim().slice(0, MAX_TEXT);
    if (!t || _busy || !window.db) return;
    _busy = true;
    try {
      const ref = window.db.ref("help").push();
      const 줄 = { text: t, at: Date.now(), checks: 0 };
      if (parent) 줄.parent = parent;
      if (refId) 줄.ref = refId;          // 🔗 참고 — 글 번호 하나뿐, 익명 그대로
      await ref.set(줄);
      remember(MINE_KEY, ref.key);      // ← 이 기기에만
      window.dockMarkNew?.("help");     // 알약에 붉은 점 (내 기기는 빼고)
    } catch (e) {
      alert("올리지 못했어요. 연결을 확인해 주세요.");
    } finally { _busy = false; }
  }

  async function 지우기(id) {
    if (!isMine(id)) return;
    if (!confirm("지울까요? 되돌릴 수 없어요.")) return;
    try {
      await window.db.ref("help/" + id).remove();
      /* 질문을 지우면 그 아래 답도 함께 (부모 없는 답은 나뒹굽니다) */
      for (const r of _rows.filter(x => x.parent === id)) {
        try { await window.db.ref("help/" + r.id).remove(); } catch (e) {}
        forget(MINE_KEY, r.id); forget(CHECK_KEY, r.id);
      }
      forget(MINE_KEY, id); forget(CHECK_KEY, id);
    } catch (e) {
      alert("지우지 못했어요.");
    }
  }

  /** 💡 아하 스티커 — 여러 사람이 겹쳐 붙습니다. 내 것은 다시 눌러 뗍니다. */
  async function 확인(id) {
    const r = _rows.find(x => x.id === id);
    if (!r || !window.db) return;
    const 붙임 = didCheck(id);
    try {
      await window.db.ref("help/" + id + "/checks")
        .transaction(v => Math.max(0, (Number(v) || 0) + (붙임 ? -1 : 1)));
      if (붙임) forget(CHECK_KEY, id); else remember(CHECK_KEY, id);
      render();
    } catch (e) {}
  }

  /* =====================================================================
     손가락
     ★ 대숲에서 데인 자리 — 판 안쪽 상자에 답니다. 겉껍데기에 달면
       .modal-content 의 stopPropagation 에 막혀 클릭이 통째로 죽어요.
     ===================================================================== */
  function bind() {
    const host = el("dock-body-help");
    if (!host || _bound) return;
    _bound = true;

    host.addEventListener("click", (e) => {
      const del = e.target.closest("[data-help-del]");
      if (del) { 지우기(del.dataset.helpDel); return; }

      const chk = e.target.closest("[data-help-check]");
      if (chk) { 확인(chk.dataset.helpCheck); return; }

      /* 🔗 참고 칩 — 누르면 옛 답이 그 자리에 펼쳐집니다 */
      const rf = e.target.closest("[data-help-ref]");
      if (rf) {
        const id = rf.dataset.helpRef;
        if (_refOpen.has(id)) _refOpen.delete(id); else _refOpen.add(id);
        render();
        return;
      }

      /* 🔗 제안 고르기 — 새 글에 참고 고리를 달아 둡니다 */
      const sug = e.target.closest("[data-help-sug]");
      if (sug) {
        const q = _rows.find(r => r.id === sug.dataset.helpSug);
        if (q) {
          _pickRef = { id: q.id, text: q.text };
          const keep = el("help-new")?.value || "";   // 쓰던 글 지키기
          render();
          const inp = el("help-new");
          if (inp) { inp.value = keep; inp.focus(); }
        }
        return;
      }
      const unpin = e.target.closest("[data-help-unpin]");
      if (unpin) {
        _pickRef = null;
        const keep = el("help-new")?.value || "";
        render();
        const inp = el("help-new");
        if (inp) { inp.value = keep; inp.focus(); }
        return;
      }

      const rep = e.target.closest("[data-help-reply]");
      if (rep) {
        _reply = { parent: rep.dataset.helpReply, text: "" };
        /* 답 달러 온 사람에게 🔗 참고를 자동으로 펼쳐 줍니다 (콩 선택) —
           "저번엔 이런 답이 나왔구나" 를 보고 쓰라는 뜻이에요 */
        const q = _rows.find(r => r.id === rep.dataset.helpReply);
        if (q?.ref) _refOpen.add(q.id);
        render();
        el("help-reply")?.focus();
        return;
      }

      const act = e.target.closest("[data-help-act]");
      if (!act) return;
      const a = act.dataset.helpAct;
      if (a === "cancel") { _reply = null; render(); return; }
      if (a === "reply" && _reply) {
        const t = String(el("help-reply")?.value || "").trim();
        const p = _reply.parent;
        _reply = null;
        올리기(t, p).then(render);
        return;
      }
      if (a === "ask") {
        const inp = el("help-new");
        const t = String(inp?.value || "").trim();
        if (!t) return;
        if (inp) inp.value = "";
        const rid = _pickRef?.id || "";
        _pickRef = null;
        올리기(t, "", rid);
      }
    });

    /* 엔터로 바로 — 한글 조합 중은 무시합니다 (이 방에서 여러 번 데인 자리) */
    host.addEventListener("keydown", (e) => {
      const t = e.target;
      if (!t || (t.id !== "help-new" && t.id !== "help-reply")) return;
      if (e.key !== "Enter" || e.shiftKey || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      if (t.id === "help-new") {
        const v = String(t.value || "").trim();
        if (!v) return;
        t.value = "";
        const rid = _pickRef?.id || "";
        _pickRef = null;
        올리기(v, "", rid);
      } else if (_reply) {
        const v = String(t.value || "").trim();
        const p = _reply.parent;
        _reply = null;
        올리기(v, p).then(render);
      }
    });

    /* 답 쓰던 내용은 다시 그려도 살아남게 */
    host.addEventListener("input", (e) => {
      if (e.target?.id === "help-reply" && _reply) _reply.text = e.target.value;
      /* 🔗 질문을 쓰는 중엔 비슷한 옛 글을 찾아 보여줍니다 —
         전체 render() 가 아니라 제안 상자 속만 갈아 끼워요 (초점·조합 보호) */
      if (e.target?.id === "help-new") 제안그리기();
    });
  }

  /** 알약 판이 열릴 때 부릅니다 */
  function openHelp() {
    const host = el("dock-body-help");
    if (host && !el("help-board")) {
      host.innerHTML = `<div class="help-board" id="help-board"></div>`;
    }
    bind();
    listen();
    render();
  }
  window.openHelp = openHelp;
})();
