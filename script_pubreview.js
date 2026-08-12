/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_pubreview.js — 🏢 출판사 품평 (익명)
   ---------------------------------------------------------------------
   출판사 목록을 두고, 그 아래에 **익명으로** 품평 댓글을 답니다.
   작가들이 계약 전에 서로의 경험을 참고하는 자리예요.

   [익명 — 🎋 대숲의 방식을 그대로 물려받습니다]
   서버에 남는 것은 이것뿐입니다.

       pubs/{pid}        = { name, genre, at }          ← 출판사 명패
       pubreview/{pid}/{rid} = { text, at, hearts }     ← 품평

   닉네임도, uid 도, 기기 정보도 넣지 않습니다. 그래서 "내가 쓴 것" 은
   서버가 모릅니다 — 쓴 직후 키를 이 기기의 AppStore 에 적어 두고,
   ✕ 는 그 목록에 있는 품평에만 보여줍니다. 기기를 옮기면 ✕ 도, ♥
   중복 방지도 새로 시작입니다. 대숲과 똑같은 저울질이에요.

   [대숲과 다른 점 둘]
     · **안 시듭니다.** 대숲은 감정 배출이라 30일이면 지지만, 품평은
       참고 자료라 쌓이는 것이 값어치입니다. (운영진 결정 2026-08-12)
     · 점수·별점이 없습니다. 평균이 박제되면 분쟁 소지가 있어서,
       글과 ♥ 공감만 둡니다.

   [등록은 누구나, 고치기는 방장만]
   출판사 추가는 누구나 (이름 40자 제한 — 보안규칙이 지킵니다).
   명패의 이름을 바꾸거나 지우는 것은 방장만이에요 — 댓글이 잔뜩 달린
   명패가 조용히 딴 회사로 바뀌면 품평이 통째로 엉뚱한 데 붙습니다.

   [보안규칙 — 콘솔 재적용 필요]
       "pubs":      명패 새로 만들기만 열림 (수정·삭제는 방장)
       "pubreview": 대숲과 같음 — 새 글 · 지우기 · 글이 그대로인
                    수정(♥)만 열림. 남의 글 바꿔치기는 규칙이 막습니다.
   ===================================================================== */
(function () {
  "use strict";

  const MAX_TEXT = 300;
  const MAX_NAME = 40;

  /* 이 기기에만 남는 기록 (서버에는 절대 올라가지 않습니다) */
  const MINE_KEY  = "pubMine";     // 내가 쓴 품평 키
  const HEART_KEY = "pubHearts";   // ♥ 를 누른 품평 키

  let _pubs = {};        // pid → { name, genre, at }
  let _revs = {};        // pid → { rid → { text, at, hearts } }
  let _openPub = null;   // 펼쳐진 명패 — 한 번에 하나 (목록이 길어지니까)
  let _listening = false;

  const el = (id) => document.getElementById(id);

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function _mine(key) {
    try { return JSON.parse(window.AppStore?.getItem(key) || "[]"); }
    catch (e) { return []; }
  }
  function _addMine(key, id) {
    const a = _mine(key);
    if (!a.includes(id)) { a.push(id); }
    try { window.AppStore?.setItem(key, JSON.stringify(a.slice(-300))); } catch (e) {}
  }

  /* =====================================================================
     서버에서 받기 — 판을 처음 열 때 한 번만 listener 를 답니다
     ===================================================================== */
  function listenPub() {
    if (_listening || !window.db) return;
    _listening = true;
    window.db.ref("pubs").on("value", snap => {
      _pubs = snap.val() || {};
      render();
    }, err => console.warn("[품평] 출판사 목록을 못 받아왔어요", err));
    window.db.ref("pubreview").on("value", snap => {
      _revs = snap.val() || {};
      render();
    }, err => console.warn("[품평] 품평을 못 받아왔어요", err));
  }

  /* =====================================================================
     그리기
     ===================================================================== */
  function fmtDay(t) {
    const d = new Date(Number(t) || 0);
    return (d.getMonth() + 1) + "/" + d.getDate();
  }

  function revHtml(pid, rid, r) {
    const mine = _mine(MINE_KEY).includes(rid);
    const hearted = _mine(HEART_KEY).includes(rid);
    const n = Math.max(0, Number(r.hearts) || 0);
    return `
      <div class="pub-rev">
        <div class="pub-rev-text">${esc(r.text)}</div>
        <div class="pub-rev-meta">
          <span>🖋️ 익명 · ${fmtDay(r.at)}</span>
          <button type="button" class="pub-heart${hearted ? " on" : ""}"
                  data-pub-heart="${esc(pid)}:${esc(rid)}"
                  aria-label="공감">♥ ${n || ""}</button>
          ${mine ? `<button type="button" class="pub-del" data-pub-del="${esc(pid)}:${esc(rid)}"
                            aria-label="내 품평 지우기" title="지우기 (이 기기에서 쓴 것만)">✕</button>` : ""}
        </div>
      </div>`;
  }

  function pubHtml(pid, p) {
    const revs = _revs[pid] || {};
    const rids = Object.keys(revs).sort((a, b) => (revs[a].at || 0) - (revs[b].at || 0));
    const open = _openPub === pid;
    return `
      <article class="pub-item${open ? " is-open" : ""}" data-pid="${esc(pid)}">
        <button type="button" class="pub-head" data-pub-open="${esc(pid)}"
                aria-expanded="${open}">
          <b class="pub-name">${esc(p.name)}</b>
          ${p.genre ? `<span class="pub-genre">${esc(p.genre)}</span>` : ""}
          <span class="pub-count">💬 ${rids.length}</span>
          <span class="pub-arrow" aria-hidden="true">${open ? "▾" : "▸"}</span>
        </button>
        ${!open ? "" : `
        <div class="pub-body">
          ${rids.length
            ? rids.map(rid => revHtml(pid, rid, revs[rid])).join("")
            : `<p class="pub-empty">아직 품평이 없어요. 첫 경험담을 남겨 주세요.</p>`}
          <div class="pub-write">
            <textarea class="pub-input" data-pub-input="${esc(pid)}" rows="1"
                      maxlength="${MAX_TEXT}" placeholder="익명으로 품평 남기기…"></textarea>
            <button type="button" class="pub-send" data-pub-send="${esc(pid)}"
                    aria-label="품평 올리기">↑</button>
          </div>
        </div>`}
      </article>`;
  }

  function render() {
    const box = el("pub-board");
    if (!box) return;

    /* 쓰던 글은 다시 그려도 살아 있어야 합니다 (공지판과 같은 수법) */
    const ta = box.querySelector("[data-pub-input]");
    const draft = ta ? ta.value : "";

    const pids = Object.keys(_pubs).sort((a, b) =>
      String(_pubs[a].name).localeCompare(String(_pubs[b].name), "ko"));
    box.innerHTML =
      (pids.length
        ? pids.map(pid => pubHtml(pid, _pubs[pid])).join("")
        : `<p class="pub-empty">아직 등록된 출판사가 없어요.</p>`) +
      `<button type="button" class="pub-add" data-pub-add>＋ 출판사 추가</button>
       <p class="pub-hint">🎋 대숲처럼 <b>완전 익명</b>이에요 — 닉네임·계정은 서버에 남지 않아요.
       내가 쓴 품평의 ✕ 는 이 기기에서만 보입니다.</p>`;

    if (draft) {
      const ta2 = box.querySelector("[data-pub-input]");
      if (ta2) { ta2.value = draft; }
    }
  }

  /* =====================================================================
     쓰기 — 익명이라 닉네임을 **절대** 싣지 않습니다
     ===================================================================== */
  async function sendReview(pid) {
    const ta = document.querySelector(`[data-pub-input="${CSS.escape(pid)}"]`);
    const text = (ta?.value || "").trim().slice(0, MAX_TEXT);
    if (!text) return;
    try {
      const ref = window.db.ref("pubreview/" + pid).push();
      await ref.set({ text, at: Date.now(), hearts: 0 });
      _addMine(MINE_KEY, ref.key);
      if (ta) ta.value = "";
    } catch (e) {
      console.warn("[품평] 올리지 못했어요", e);
      window.showCommandToast?.("품평을 올리지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    }
  }

  async function addPub() {
    const name = (prompt("출판사 이름 (40자까지)") || "").trim().slice(0, MAX_NAME);
    if (!name) return;
    const dup = Object.values(_pubs).some(p =>
      String(p.name).replace(/\s/g, "") === name.replace(/\s/g, ""));
    if (dup) { window.showCommandToast?.("이미 있는 출판사예요."); return; }
    const genre = (prompt("주요 장르 (예: 로판 · BL) — 없으면 비워 두세요") || "").trim().slice(0, 30);
    try {
      const ref = window.db.ref("pubs").push();
      await ref.set(genre ? { name, genre, at: Date.now() } : { name, at: Date.now() });
      _openPub = ref.key;
    } catch (e) {
      console.warn("[품평] 출판사를 추가하지 못했어요", e);
      window.showCommandToast?.("추가하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    }
  }

  async function heart(pid, rid) {
    if (_mine(HEART_KEY).includes(rid)) return;   // 이 기기에서 한 번
    _addMine(HEART_KEY, rid);
    try {
      await window.db.ref(`pubreview/${pid}/${rid}/hearts`)
        .transaction(n => (Number(n) || 0) + 1);
    } catch (e) { console.warn("[품평] ♥ 실패", e); }
  }

  async function delMine(pid, rid) {
    if (!_mine(MINE_KEY).includes(rid)) return;   // 화면에서도 이미 안 보입니다
    if (!confirm("이 품평을 지울까요?")) return;
    try { await window.db.ref(`pubreview/${pid}/${rid}`).remove(); }
    catch (e) { console.warn("[품평] 지우지 못했어요", e); }
  }

  /* =====================================================================
     누르기 — 판 하나에 한 번만 걸어 둡니다 (다시 그려도 안 죽게)
     ===================================================================== */
  function bind() {
    const box = el("pub-board");
    if (!box || box.dataset.pubBound === "true") return;
    box.dataset.pubBound = "true";

    box.addEventListener("click", (e) => {
      const openBtn = e.target.closest("[data-pub-open]");
      if (openBtn) {
        const pid = openBtn.dataset.pubOpen;
        _openPub = _openPub === pid ? null : pid;   // 한 번에 하나
        render();
        return;
      }
      if (e.target.closest("[data-pub-add]")) { addPub(); return; }
      const send = e.target.closest("[data-pub-send]");
      if (send) { sendReview(send.dataset.pubSend); return; }
      const h = e.target.closest("[data-pub-heart]");
      if (h) { const [pid, rid] = h.dataset.pubHeart.split(":"); heart(pid, rid); return; }
      const d = e.target.closest("[data-pub-del]");
      if (d) { const [pid, rid] = d.dataset.pubDel.split(":"); delMine(pid, rid); }
    });

    /* Enter 로 올리기 (Shift+Enter 는 줄바꿈 — 채팅과 같은 손맛) */
    box.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
      const ta = e.target.closest("[data-pub-input]");
      if (!ta) return;
      e.preventDefault();
      sendReview(ta.dataset.pubInput);
    });
  }

  /** 알약 판이 열릴 때 부릅니다 — 그때 처음 listener 가 붙습니다 */
  function openPubReview() {
    const host = el("dock-body-pub");
    if (host && !el("pub-board")) {
      host.innerHTML = `<div class="pub-board" id="pub-board"></div>`;
    }
    bind();
    listenPub();
    render();
  }

  window.openPubReview = openPubReview;
})();
