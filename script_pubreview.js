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
  const MINE_KEY = "pubMine";   // 내가 쓴 품평 키
  /* ♥ 공감은 2026-08-12 에 화면에서 뺐습니다 — hearts 필드는 서버에
     남아 있으니, 되살리고 싶으면 그리는 쪽만 다시 붙이면 됩니다. */

  /* 명패 고치기·지우기는 **방장과 운영진**입니다 (2026-08-17 운영진 추가.
     그 전에는 방장만이었어요 — 보안규칙 pubs/$pid 도 함께 열렸습니다).
     댓글이 잔뜩 달린 명패를 아무나 고치면, 품평이 통째로 엉뚱한 회사에
     붙습니다. 그래서 일반 멤버에게는 여전히 안 열립니다.
     ★ 명패를 **통째로 비우는 것**(pubs 루트)은 규칙에서 방장만입니다. */
  const ADMIN_UID = "ABM1ZJndrqaV3gpYUs03SV9qglr1";
  const isAdmin = () => {
    try {
      if (typeof window.canAdmin === "function") return window.canAdmin();
      return firebase.auth().currentUser?.uid === ADMIN_UID;
    } catch (e) { return false; }
  };

  /* ── 🔍 찾기 (2026-08-12) ──
     출판사가 수십 곳이라 목록을 훑어서는 못 찾습니다. 맨 윗줄에서
     이름·장르 아무거나 몇 글자만 쳐도 좁혀지고, 장르 칩을 눌러
     그 장르만 모아 볼 수도 있어요. 걸러내기는 전부 이 화면 안에서만 —
     서버는 건드리지 않습니다. */
  let _query = "";       // 찾는 말
  let _genre = null;     // 골라 둔 장르 칩

  /* ── 정렬 (2026-08-13) — 가나다순 / 💬 많은 순. 고른 쪽은 이 기기에 남습니다 */
  const SORT_KEY = "pubSort";
  let _sort = "abc";     // "abc" | "talk"
  try { if (window.AppStore?.getItem(SORT_KEY) === "talk") _sort = "talk"; } catch (e) {}

  /* ── 🏢 같은 출판사 묶기 (2026-08-13) ──
     등록 규칙이 "출판사 / 레이블" 이라, / 앞이 같으면 한 지붕입니다.
       "대원씨아이 / 모드, 클로젯"     ┐
       "대원씨아이 / 폴라리스, 플로레뜨" ┘→ 🏢 대원씨아이 (레이블 2)
     레이블 여러 개를 쉼표로 묶어 적은 것은 그냥 이름의 일부 — 안 가릅니다.
     / 가 없거나 그 출판사 명패가 하나뿐이면 지금처럼 낱장입니다. */
  let _openCos = new Set();   // 펼쳐 둔 묶음 (여러 개 가능)

  function 회사쪼개기(name) {
    const i = String(name || "").indexOf("/");
    if (i < 0) return { co: null, label: String(name || "").trim() };
    return {
      co: String(name).slice(0, i).trim(),
      label: String(name).slice(i + 1).trim()
    };
  }

  /* 레이블 몇 개인가 — "모드, 클로젯" 은 2 입니다 (콩의 지적 2026-08-13).
     명패 수로 세면 쉼표로 묶어 적은 레이블이 하나로 잡혀 숫자가 거짓말을
     해요. / 가 없는 명패는 출판사가 곧 한 자리이니 1 로 셉니다. */
  function 레이블수(name) {
    const { co, label } = 회사쪼개기(name);
    if (!co) return 1;
    const n = label.split(",").map(t => t.trim()).filter(Boolean).length;
    return n || 1;
  }

  /** 띄어쓰기·대소문자를 무시하고 견줍니다 — "페일 블루" 로도 "페일블루" 가 잡히게 */
  function _folded(s) {
    return String(s || "").toLowerCase().replace(/\s+/g, "");
  }

  /** "로판 · BL" 같은 장르 글자를 칩 단위로 쪼갭니다 */
  function _genreTokens(g) {
    return String(g || "").split(/[·,/|]+/).map(t => t.trim()).filter(Boolean);
  }

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
  /* 품평 한 줄 — 글만 남겼습니다 (2026-08-12, 콩의 결정).
     "익명 · 날짜 · ♥" 줄은 다 뺐어요. 어차피 전부 익명이라 적으나 마나고,
     날짜도 품평의 값어치와 상관없다는 판단. 서버의 at·hearts 는 그대로
     둡니다 — 화면에서만 뺀 것이라 언제든 되살릴 수 있어요.
     ✕ 는 글쓴이(이 기기)에게만, 말풍선에 커서를 올렸을 때 오른쪽 끝에. */
  function revHtml(pid, rid, r) {
    const mine = _mine(MINE_KEY).includes(rid);
    return `
      <div class="pub-rev">
        <div class="pub-rev-text">${esc(r.text)}${
          mine ? `<button type="button" class="pub-del" data-pub-del="${esc(pid)}:${esc(rid)}"
                          aria-label="내 품평 지우기" title="지우기 (이 기기에서 쓴 것만)">✕</button>` : ""}</div>
      </div>`;
  }

  function pubHtml(pid, p, 표시이름) {
    const revs = _revs[pid] || {};
    const rids = Object.keys(revs).sort((a, b) => (revs[a].at || 0) - (revs[b].at || 0));
    const open = _openPub === pid;
    return `
      <article class="pub-item${open ? " is-open" : ""}" data-pid="${esc(pid)}">
        <button type="button" class="pub-head" data-pub-open="${esc(pid)}"
                aria-expanded="${open}">
          <b class="pub-name">${esc(표시이름 || p.name)}</b>
          ${p.genre ? `<span class="pub-genre">${esc(p.genre)}</span>` : ""}
          <span class="pub-count">💬 ${rids.length}</span>
          <span class="pub-arrow" aria-hidden="true">${open ? "▾" : "▸"}</span>
        </button>
        ${!open ? "" : `
        <div class="pub-body">
          ${isAdmin() ? `
          <div class="pub-admin">
            <button type="button" class="pub-tool" data-pub-edit="${esc(pid)}">✏️ 명패 고치기</button>
            <button type="button" class="pub-tool" data-pub-remove="${esc(pid)}">🗑 명패 지우기</button>
          </div>` : ""}
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

    /* 찾는 칸에 커서를 둔 채 새 품평이 도착하면 판이 다시 그려집니다.
       그때 커서가 튕기면 치던 말이 끊겨요 — 자리까지 기억해 되살립니다. */
    const 찾는중 = document.activeElement?.id === "pub-search";
    const 커서 = 찾는중 ? document.activeElement.selectionStart : 0;

    /* 명패는 늘 **가나다순** — 등록한 차례가 아닙니다.
       찾는 사람 입장에서는 "ㅅ이니까 중간쯤" 이 통해야 하니까요.
       numeric: "2사" 가 "10사" 앞에 오게 (글자 아닌 숫자로 견줌) */
    const 견줌 = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });
    const 전체 = Object.keys(_pubs).sort((a, b) =>
      견줌.compare(String(_pubs[a].name).trim(), String(_pubs[b].name).trim()));

    /* 걸러내기 — 찾는 말은 이름과 장르 어느 쪽에 걸려도 잡습니다 */
    const q = _folded(_query);
    const pids = 전체.filter(pid => {
      const p = _pubs[pid];
      if (_genre && !_genreTokens(p.genre).includes(_genre)) return false;
      if (q && !_folded(p.name).includes(q) && !_folded(p.genre).includes(q)) return false;
      return true;
    });

    /* 장르 칩 — 등록된 장르에서 그때그때 모읍니다 (따로 관리 안 함) */
    const 칩들 = [...new Set(전체.flatMap(pid => _genreTokens(_pubs[pid].genre)))]
      .sort((a, b) => 견줌.compare(a, b));

    /* ── 🏢 같은 출판사끼리 묶기 — / 앞이 같으면 한 지붕 ── */
    const 품평수 = (pid) => Object.keys(_revs[pid] || {}).length;
    const 묶음맵 = {};                        // coKey → { co, pids }
    const 단위들 = [];                        // { name, pids, co? } — 낱장 또는 묶음
    pids.forEach(pid => {
      const { co } = 회사쪼개기(_pubs[pid].name);
      const key = co ? _folded(co) : null;    // 띄어쓰기 달라도 같은 지붕
      if (!key) { 단위들.push({ name: _pubs[pid].name, pids: [pid] }); return; }
      if (!묶음맵[key]) { 묶음맵[key] = { co, pids: [] }; 단위들.push(묶음맵[key]); }
      묶음맵[key].pids.push(pid);
    });
    단위들.forEach(u => {
      if (u.co && u.pids.length === 1) {      // 그 출판사 명패가 하나뿐 → 낱장
        u.name = _pubs[u.pids[0]].name;
        u.co = null;
      } else if (u.co) {
        u.name = u.co;
      }
      u.talk = u.pids.reduce((a, pid) => a + 품평수(pid), 0);
      u.labels = u.pids.reduce((a, pid) => a + 레이블수(_pubs[pid].name), 0);
    });

    /* ── 정렬 — 가나다순 / 💬 많은 순 (수가 같으면 그 안에서 가나다) ── */
    const 이름견줌 = (a, b) => 견줌.compare(String(a.name).trim(), String(b.name).trim());
    단위들.sort(_sort === "talk"
      ? (a, b) => (b.talk - a.talk) || 이름견줌(a, b)
      : 이름견줌);
    const 안견줌 = (a, b) => {
      if (_sort === "talk") { const d = 품평수(b) - 품평수(a); if (d) return d; }
      return 견줌.compare(회사쪼개기(_pubs[a].name).label, 회사쪼개기(_pubs[b].name).label);
    };

    /* 찾는 중에는 걸린 묶음을 저절로 펼칩니다 — 접힌 채면 찾은 보람이 없어요 */
    const 강제펼침 = !!(q || _genre);

    const 전체품평 = pids.reduce((a, pid) => a + 품평수(pid), 0);
    const 줄 = 단위들.map(u => {
      if (!u.co) return pubHtml(u.pids[0], _pubs[u.pids[0]], u.name);
      const coKey = _folded(u.co);
      const 펼침 = 강제펼침 || _openCos.has(coKey);
      return `
        <section class="pub-group${펼침 ? " is-open" : ""}">
          <button type="button" class="pub-co-head" data-pub-co="${esc(coKey)}"
                  aria-expanded="${펼침}">
            <b class="pub-name">🏢 ${esc(u.co)}</b>
            <span class="pub-genre">레이블 ${u.labels}</span>
            <span class="pub-count">💬 ${u.talk}</span>
            <span class="pub-arrow" aria-hidden="true">${펼침 ? "▾" : "▸"}</span>
          </button>
          ${펼침 ? `<div class="pub-group-body">${
            u.pids.sort(안견줌).map(pid =>
              pubHtml(pid, _pubs[pid], 회사쪼개기(_pubs[pid].name).label)).join("")
          }</div>` : ""}
        </section>`;
    }).join("");

    box.innerHTML =
      `<div class="pub-find">
         <input type="search" class="pub-search" id="pub-search"
                placeholder="🔍 출판사 · 장르 찾기" value="${esc(_query)}"
                aria-label="출판사나 장르로 찾기">
         ${칩들.length ? `<div class="pub-chips">${칩들.map(g => `
           <button type="button" class="pub-chip${_genre === g ? " on" : ""}"
                   data-pub-genre="${esc(g)}">${esc(g)}</button>`).join("")}</div>` : ""}
         <div class="pub-sortbar">
           <span class="pub-tally"><b>${단위들.length}곳</b>${(() => {
             const 총레이블 = pids.reduce((a, pid) => a + 레이블수(_pubs[pid].name), 0);
             return 총레이블 > 단위들.length ? ` · 레이블 ${총레이블}` : "";
           })()} · 품평 <b>${전체품평}</b>개</span>
           <span class="pub-sort" role="group" aria-label="정렬">
             <button type="button" class="pub-sort-btn${_sort === "abc" ? " on" : ""}"
                     data-pub-sort="abc">가나다순</button>
             <button type="button" class="pub-sort-btn${_sort === "talk" ? " on" : ""}"
                     data-pub-sort="talk">💬 많은 순</button>
           </span>
         </div>
       </div>` +
      (pids.length
        ? 줄
        : 전체.length
          ? `<p class="pub-empty">"${esc(_query || _genre || "")}" 에 맞는 곳이 없어요.</p>`
          : `<p class="pub-empty">아직 등록된 출판사가 없어요.</p>`) +
      `<button type="button" class="pub-add" data-pub-add>＋ 출판사 추가</button>
       <p class="pub-hint">🎋 대숲처럼 <b>완전 익명</b>이에요 — 닉네임·계정은 서버에 남지 않아요.
       내가 쓴 품평의 ✕ 는 이 기기에서만 보입니다.</p>`;

    if (draft) {
      const ta2 = box.querySelector("[data-pub-input]");
      if (ta2) { ta2.value = draft; }
    }
    if (찾는중) {
      const inp = el("pub-search");
      if (inp) { inp.focus(); try { inp.setSelectionRange(커서, 커서); } catch (e) {} }
    }
  }

  /* =====================================================================
     쓰기 — 익명이라 닉네임을 **절대** 싣지 않습니다
     ===================================================================== */
  async function sendReview(pid) {
    const ta = document.querySelector(`[data-pub-input="${CSS.escape(pid)}"]`);
    const text = (ta?.value || "").trim().slice(0, MAX_TEXT);
    if (!text) return;
    /* ★ 글칸은 **보내기 전에** 비웁니다 (고침 2026-08-12).
       서버에 올라가면 listener 가 그 자리에서 판을 다시 그리는데,
       다시 그리기는 "쓰던 글 지키기" 로 글칸 내용을 살려 둡니다.
       그 뒤에 비우려 하면 이미 갈아 끼워진 **옛 글칸**을 비우는 꼴이라,
       화면에는 보낸 글이 그대로 남아 있었어요. 실패하면 되살립니다. */
    if (ta) ta.value = "";
    try {
      const ref = window.db.ref("pubreview/" + pid).push();
      await ref.set({ text, at: Date.now(), hearts: 0 });
      window.dockMarkNew?.("pub");
      _addMine(MINE_KEY, ref.key);
      render();   // ✕ 가 바로 보이게 (키를 기억한 **뒤에** 한 번 더)
    } catch (e) {
      const ta2 = document.querySelector(`[data-pub-input="${CSS.escape(pid)}"]`);
      if (ta2) ta2.value = text;   // 쓴 글이 날아가면 안 되니까요
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
      window.dockMarkNew?.("pub");
      _openPub = ref.key;
    } catch (e) {
      console.warn("[품평] 출판사를 추가하지 못했어요", e);
      window.showCommandToast?.("추가하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    }
  }

  /* ── 방장 전용 — 명패 고치기·지우기 ── */
  async function editPub(pid) {
    const p = _pubs[pid];
    if (!p) return;
    const name = (prompt("출판사 이름", p.name) || "").trim().slice(0, MAX_NAME);
    if (!name) return;
    const genre = (prompt("주요 장르 — 없으면 비워 두세요", p.genre || "") || "").trim().slice(0, 30);
    try {
      await window.db.ref("pubs/" + pid)
        .set(genre ? { name, genre, at: p.at || Date.now() } : { name, at: p.at || Date.now() });
    } catch (e) {
      console.warn("[품평] 명패를 고치지 못했어요", e);
      window.showCommandToast?.("명패를 고치지 못했어요.");
    }
  }

  async function removePub(pid) {
    const p = _pubs[pid];
    if (!p) return;
    const n = Object.keys(_revs[pid] || {}).length;
    if (!confirm(`"${p.name}" 명패를 지울까요?` + (n ? `\n달려 있는 품평 ${n}개도 함께 사라져요.` : ""))) return;
    try {
      /* ★ 품평을 먼저, 명패를 나중에 지웁니다. 반대로 하면 명패 없는
         품평이 서버에 고아로 남아요 — 화면에는 안 보여서 못 찾습니다. */
      await window.db.ref("pubreview/" + pid).remove();
      await window.db.ref("pubs/" + pid).remove();
      if (_openPub === pid) _openPub = null;
    } catch (e) {
      console.warn("[품평] 명패를 지우지 못했어요", e);
      window.showCommandToast?.("명패를 지우지 못했어요.");
    }
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
      const d = e.target.closest("[data-pub-del]");
      if (d) { const [pid, rid] = d.dataset.pubDel.split(":"); delMine(pid, rid); return; }
      const ed = e.target.closest("[data-pub-edit]");
      if (ed) { editPub(ed.dataset.pubEdit); return; }
      const rm = e.target.closest("[data-pub-remove]");
      if (rm) { removePub(rm.dataset.pubRemove); return; }
      const chip = e.target.closest("[data-pub-genre]");
      if (chip) {
        /* 같은 칩을 다시 누르면 풀립니다 */
        _genre = _genre === chip.dataset.pubGenre ? null : chip.dataset.pubGenre;
        render();
        return;
      }
      const co = e.target.closest("[data-pub-co]");
      if (co) {
        const k = co.dataset.pubCo;
        if (_openCos.has(k)) _openCos.delete(k); else _openCos.add(k);
        render();
        return;
      }
      const srt = e.target.closest("[data-pub-sort]");
      if (srt) {
        _sort = srt.dataset.pubSort === "talk" ? "talk" : "abc";
        try { window.AppStore?.setItem(SORT_KEY, _sort); } catch (err) {}
        render();
      }
    });

    /* 🔍 치는 대로 좁혀집니다 — 단추도, Enter 도 필요 없어요.
       ★ 한글은 조합 중(ㅊ→추→출)이 있습니다. 그 중간에 판을 다시 그리면
         조합이 뚝 끊겨서 글자가 깨져요. 조합 중에는 걸러 두기만 하고,
         조합이 끝나는 순간(compositionend) 한 번에 그립니다. */
    box.addEventListener("input", (e) => {
      if (e.target.id !== "pub-search") return;
      _query = e.target.value;
      if (!e.isComposing) render();
    });
    box.addEventListener("compositionend", (e) => {
      if (e.target.id !== "pub-search") return;
      _query = e.target.value;
      render();
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
