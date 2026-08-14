/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 📮 쪽지 (script_note.js)
   ---------------------------------------------------------------------
   남의 카드를 누르면 그 사람에게 짧은 쪽지를 보냅니다. 받은 쪽지는
   🗂️ 나의 작업 → 📮 쪽지 에서 봅니다.

   [대화가 아니라 쪽지입니다]
   답장 버튼이 있지만 실 타래로 엮지 않습니다. 누르면 그 사람 앞으로
   **새 쪽지 쓰는 창**이 열릴 뿐이에요. 주고받기가 편해지면 사람들이
   여기서 대화를 시작하고, 그러면 채팅방이 조용해집니다.
   짧게 한마디 건네는 자리로 남기려고 일부러 불편하게 두었습니다.

   [무엇이 어디에 남는가]
     notes/{받는닉}/{id}    = { from, text, at, read? }   ← 받은 쪽지함
     notesOut/{보낸닉}/{id} = { to,   text, at }          ← 보낸 쪽지함
   같은 내용을 두 번 적습니다. 한 곳에 모아두면 "보낸 것"을 찾으려고
   남의 쪽지함을 뒤져야 하는데, 그러면 잠글 수가 없어요.
   두 벌로 두는 대신 각자 자기 것만 읽으면 됩니다.

   [누가 볼 수 있나]
   **받는 사람만.** 방장도 못 봅니다. 보안규칙에서 닉의 주인만 읽도록
   막아 두었습니다. 대신 보내는 사람 이름은 반드시 붙고, 규칙이
   "적어 넣는 이름 = 지금 로그인한 사람" 인지 검사하므로 남의 이름을
   사칭할 수 없습니다. 익명으로 하고 싶으면 🎋 대숲을 쓰면 됩니다.

   [30일]
   대숲과 같습니다. 오래된 쪽지는 각자 접속할 때 조용히 지워집니다.
   ===================================================================== */
(function () {
  const NOTE_MAX  = 80;                        // 한 통에 담는 글자 수
  const KEEP_MS   = 30 * 24 * 60 * 60 * 1000;  // 30일이 지나면 사라집니다

  let _inbox  = {};      // { id: {from, text, at, read} }
  let _outbox = {};      // { id: {to, text, at} }
  let _inRef = null, _outRef = null;
  let _to = "";          // 지금 쓰고 있는 쪽지의 받는 사람

  const el = (id) => document.getElementById(id);
  function esc(s) {
    return window.escapeHtml ? window.escapeHtml(s) : String(s == null ? "" : s);
  }
  function now() {
    return (typeof window.serverNow === "function") ? window.serverNow() : Date.now();
  }

  /* 몇 시 몇 분 — 어제 것은 날짜까지 */
  function whenText(at) {
    const t = Number(at || 0);
    if (!t) return "";
    const d = new Date(t), n = new Date(now());
    const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const sameDay = d.toDateString() === n.toDateString();
    if (sameDay) return hm;
    const yst = new Date(n); yst.setDate(yst.getDate() - 1);
    if (d.toDateString() === yst.toDateString()) return `어제 ${hm}`;
    return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
  }

  /* ---------------------------------------------------------------
     구독 — 내 쪽지함 두 개
     --------------------------------------------------------------- */
  function listenNotes() {
    if (!myNick || _inRef) return;
    _inRef = db.ref(`notes/${myNick}`);
    _inRef.on("value", snap => {
      _inbox = snap.val() || {};
      renderNoteBadge();
      renderNotePanel();
    });
    _outRef = db.ref(`notesOut/${myNick}`);
    _outRef.on("value", snap => {
      _outbox = snap.val() || {};
      renderNotePanel();
    });
    sweepOld();
  }
  function detachNotes() {
    try { _inRef && _inRef.off(); } catch (e) {}
    try { _outRef && _outRef.off(); } catch (e) {}
    _inRef = _outRef = null;
    _inbox = {}; _outbox = {};
  }

  /* 오래된 것 치우기 — 각자 자기 쪽지함만 손댑니다 */
  async function sweepOld() {
    if (!myNick) return;
    const cut = now() - KEEP_MS;
    const upd = {};
    Object.entries(_inbox).forEach(([k, v]) => { if (Number(v?.at || 0) < cut) upd[k] = null; });
    if (Object.keys(upd).length) { try { await db.ref(`notes/${myNick}`).update(upd); } catch (e) {} }
    const upd2 = {};
    Object.entries(_outbox).forEach(([k, v]) => { if (Number(v?.at || 0) < cut) upd2[k] = null; });
    if (Object.keys(upd2).length) { try { await db.ref(`notesOut/${myNick}`).update(upd2); } catch (e) {} }
  }

  function unreadCount() {
    return Object.values(_inbox).filter(v => v && !v.read).length;
  }

  /* ---------------------------------------------------------------
     쓰는 창
     --------------------------------------------------------------- */
  function openNoteTo(nick) {
    const to = String(nick || "").trim();
    if (!to || !myNick) return;
    if (to === myNick) return;                 // 나에게는 안 보냅니다
    _to = to;

    const m = el("note-modal");
    if (!m) return;
    const who = el("note-to");
    if (who) who.textContent = `📮 ${to} 님에게 쪽지`;
    const ta = el("note-text");
    if (ta) { ta.value = ""; ta.maxLength = NOTE_MAX; }
    renderNoteCount();
    m.style.display = "flex";
    setTimeout(() => ta?.focus(), 30);
  }
  function closeNote() {
    const m = el("note-modal");
    if (m) m.style.display = "none";
    _to = "";
  }

  function renderNoteCount() {
    const ta = el("note-text"), c = el("note-count");
    if (!ta || !c) return;
    c.textContent = `${ta.value.length} / ${NOTE_MAX}`;
  }

  async function sendNote() {
    const ta = el("note-text");
    if (!ta || !_to || !myNick) return;
    const text = ta.value.trim().slice(0, NOTE_MAX);
    if (!text) return;

    const to = _to;
    const btn = el("note-send");
    if (btn) btn.disabled = true;
    try {
      const at = Date.now();
      /* 받는 사람 쪽지함 — 규칙이 from 이 나인지 검사합니다 */
      await db.ref(`notes/${to}`).push({ from: myNick, text, at });
      /* 내 보낸 쪽지함 — 실패해도 보낸 것 자체는 이미 갔습니다 */
      try { await db.ref(`notesOut/${myNick}`).push({ to, text, at }); } catch (e) {}
      closeNote();
      window.showCommandToast?.(`${to} 님에게 쪽지를 보냈어요`);
    } catch (e) {
      console.warn("[쪽지 보내기 실패]", e);
      alert("보내지 못했어요.\nFirebase 콘솔에 새 보안규칙(notes)을 게시했는지 확인해 주세요.");
    }
    if (btn) btn.disabled = false;
  }

  /* ---------------------------------------------------------------
     읽는 곳 — 🗂️ 나의 작업 → 📮 쪽지
     --------------------------------------------------------------- */
  let _box = "in";       // in | out

  function noteRows(kind) {
    const src = kind === "out" ? _outbox : _inbox;
    return Object.entries(src)
      .map(([id, v]) => ({ id, ...(v || {}) }))
      .filter(r => r.text)
      .sort((a, b) => Number(b.at || 0) - Number(a.at || 0));
  }

  function notePanelHtml() {
    const rows = noteRows(_box);
    const un = unreadCount();

    const tabs = `
      <div class="note-boxtabs">
        <button type="button" class="note-boxtab${_box === "in" ? " is-on" : ""}" data-note-box="in">
          받은 쪽지${un ? ` <span class="note-dot">${un}</span>` : ""}</button>
        <button type="button" class="note-boxtab${_box === "out" ? " is-on" : ""}" data-note-box="out">
          보낸 쪽지</button>
      </div>`;

    if (!rows.length) {
      return tabs + `<p class="mw-hint">${_box === "in"
        ? "받은 쪽지가 없어요. 다른 작가님 카드를 누르면 쪽지를 보낼 수 있어요."
        : "보낸 쪽지가 없어요."}</p>`;
    }

    const list = rows.map(r => {
      const isIn = _box === "in";
      const who  = isIn ? r.from : r.to;
      const isNew = isIn && !r.read;
      return `<div class="note-item${isNew ? " is-new" : ""}">
          <div class="note-head">
            <span class="note-who">${esc(who)}</span>
            <span class="note-at">${whenText(r.at)}</span>
            ${isNew ? `<span class="note-new">새 쪽지</span>` : ""}
            ${isIn ? `<button type="button" class="note-reply" data-note-reply="${esc(who)}">답장</button>` : ""}
          </div>
          <div class="note-body">${esc(r.text)}</div>
        </div>`;
    }).join("");

    return tabs + `<div class="note-list">${list}</div>
      <p class="mw-hint">30일이 지난 쪽지는 저절로 사라져요.
        ${_box === "in" ? "받은 쪽지는 이 탭을 열면 읽음으로 바뀝니다." : ""}</p>`;
  }

  function renderNotePanel() {
    const host = el("mywork-panel-note");
    if (!host) return;
    host.innerHTML = notePanelHtml();
  }

  /* 이 탭을 열면 받은 쪽지를 읽음으로 바꿉니다 */
  async function markAllRead() {
    if (!myNick) return;
    const upd = {};
    Object.entries(_inbox).forEach(([k, v]) => { if (v && !v.read) upd[`${k}/read`] = true; });
    if (!Object.keys(upd).length) return;
    try { await db.ref(`notes/${myNick}`).update(upd); } catch (e) {}
  }

  /* 내 카드 이름 오른편의 쪽지 표시 — 안테나처럼 **늘 있는 자리**입니다.

     [왜 늘 두는가]
     새 쪽지가 왔을 때만 나타나면, 그 자리가 원래 무엇인지 모르는 채로
     갑자기 뭔가 생깁니다. 안테나처럼 평소에는 옅은 윤곽으로 자리를
     지키다가, 쪽지가 오면 색이 차오르는 편이 알아보기 쉬워요.
     자리도 흔들리지 않고요.

     내 카드에만 붙습니다 — 남의 안 읽은 쪽지 수는 알 이유가 없으니까요. */
  function renderNoteBadge() {
    if (!myNick) return;
    /* [고침 2026-08-09] 이름 줄 **안쪽 왼편**에 둡니다.

       예전에는 카드 오른쪽 끝에 띄워 두었는데, 이름이 오른쪽 정렬이라
       긴 닉네임과 부딪혔습니다. 이름 줄은 이미 flex 라 그 안에 넣으면
       [쪽지] [닉네임] 순서로 나란히 서고, 이름 길이에 따라 자리도
       알아서 밀립니다. */
    const nameEl = document.querySelector(
      `.user-card[data-card-nick="${CSS.escape(myNick)}"] .card-name`);
    if (!nameEl) return;

    let b = nameEl.querySelector(".card-note");
    if (!b) {
      b = document.createElement("button");
      b.type = "button";
      b.className = "card-note";
      b.setAttribute("data-note-open", "1");
      nameEl.insertBefore(b, nameEl.firstChild);   // 이름보다 앞
    }
    const n = unreadCount();
    b.classList.toggle("has", n > 0);
    b.textContent = n > 0 ? (n > 9 ? "9+" : String(n)) : "";
    b.title = n > 0
      ? `안 읽은 쪽지 ${n}통 — 눌러서 봐요`
      : "쪽지함 — 받은 쪽지가 없어요";
    b.setAttribute("aria-label", b.title);
  }

  /* ---------------------------------------------------------------
     손가락 붙이기
     --------------------------------------------------------------- */
  function bindNoteClicks() {
    const list = el("user-cards");
    if (list && !list.__noteBound) {
      list.__noteBound = true;
      list.addEventListener("click", (e) => {
        /* 🧘 혼자 방 — 카드는 전부 내 것입니다. 쪽지도 업적도 뜻이 없고,
           프꾸 창을 여는 길만 남습니다 (script_profile.js 가 맡아요). */
        if (window.SOLO) return;
        /* 내 카드는 🗂️ 나의 작업이 열립니다 — 건드리지 않습니다 */
        if (e.target.closest("[data-record-of]")) return;
        if (e.target.closest("[data-edit-profile]")) return;
        if (e.target.closest("[data-pick-status]")) return;
        if (e.target.closest(".share-card")) return;

        /* 내 카드의 쪽지 아이콘 — 바로 📮 쪽지 탭으로 */
        if (e.target.closest("[data-note-open]")) {
          window.openMyWork?.();
          window.switchMyWorkTab?.("note");
          return;
        }
        const card = e.target.closest(".user-card[data-card-nick]");
        if (!card) return;
        const nick = card.getAttribute("data-card-nick");
        if (!nick || nick === myNick) return;

        /* [2026-08-11] 남의 카드를 둘로 가릅니다 —
             프사   → 🏅 그 사람의 업적
             그 밖  → 📮 쪽지

           내 카드가 이미 이 규칙으로 돌아갑니다(내 프사를 누르면 프로필,
           아래칸을 누르면 나의 작업). 남의 카드도 "프사 = 그 사람",
           "그 밖 = 그 사람에게 하는 일" 로 맞췄어요.

           ★ 여태 카드 아무 데나 눌러도 쪽지였습니다. 손에 익은 분들이
             프사를 눌렀다가 당황하지 않게, 업적 창에 쪽지로 가는 길을
             함께 둡니다. */
        /* ★ [고침 2026-08-11] 처음에 [data-avatar-of] 를 봤는데, 그건
             **채팅 말풍선**의 프사에 붙는 표시였습니다(chatAvatarHtml).
             카드의 프사는 .card-avatar-wrap > .card-avatar 라서 한 번도
             걸리지 않았어요 — 눌러도 그냥 쪽지가 떴습니다.
             둘 다 받아 두되, 실제로 쓰이는 건 앞의 둘입니다. */
        if (e.target.closest(".card-avatar-wrap, .card-avatar, [data-avatar-of]")) {
          window.openAchvOf?.(nick);
          return;
        }
        openNoteTo(nick);
      });
    }

    const modal = el("note-modal");
    if (modal && !modal.__noteBound) {
      modal.__noteBound = true;
      el("note-text")?.addEventListener("input", renderNoteCount);
      el("note-send")?.addEventListener("click", sendNote);
    }

    /* 쪽지 탭 안쪽 — 보관함 전환과 답장 */
    const host = el("mywork-panel-note");
    if (host && !host.__noteBound) {
      host.__noteBound = true;
      host.addEventListener("click", (e) => {
        const bx = e.target.closest("[data-note-box]");
        if (bx) { _box = bx.dataset.noteBox === "out" ? "out" : "in"; renderNotePanel(); return; }
        const rp = e.target.closest("[data-note-reply]");
        if (rp) { openNoteTo(rp.getAttribute("data-note-reply")); return; }
      });
    }
  }

  /* ---------------------------------------------------------------
     창구
     --------------------------------------------------------------- */
  window.openNoteTo     = openNoteTo;
  window.closeNote      = closeNote;
  window.listenNotes    = listenNotes;
  window.detachNotes    = detachNotes;
  window.renderNotePanel = renderNotePanel;
  window.markNotesRead  = markAllRead;
  window.noteUnread     = unreadCount;

  /* 접속자 카드를 다시 그리면 내 카드의 표시도 다시 붙입니다 */
  (function installNoteHooks() {
    const _render = window.renderUserCards;
    if (typeof _render === "function" && !_render.__notePatched) {
      const wrapped = function () {
        const r = _render.apply(this, arguments);
        try { renderNoteBadge(); } catch (e) {}
        return r;
      };
      wrapped.__notePatched = true;
      window.renderUserCards = wrapped;
    }

    const _leave = window.leaveRoom;
    if (typeof _leave === "function" && !_leave.__notePatched) {
      const wrapped = async function () {
        try { detachNotes(); } catch (e) {}
        return _leave.apply(this, arguments);
      };
      wrapped.__notePatched = true;
      window.leaveRoom = wrapped;
    }

    bindNoteClicks();
  })();

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const m = el("note-modal");
    if (m && m.style.display === "flex") closeNote();
  });
})();
