/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_dock.js — 아래 알약 줄 (리뉴얼 시험판, index2.html 전용)
   ---------------------------------------------------------------------
   [무엇이 달라지나]
   지금은 화면이 세 칸입니다 — 채팅 · 접속자 · 뽀모.
   그런데 채팅은 출·퇴근 인사에 거의 다 쓰이고, 대부분은 접어 둡니다.
   접속자 카드는 위에서부터 차오르니 아래쪽이 놀고요.

   그래서 **접속자 창을 화면 전체로** 펴고, 나머지는 아래 알약 줄로
   내렸습니다. 알약을 누르면 그 자리에서 **위로** 펼쳐져요.

       📢 공지 · 💬 챗 · ☕ 수다방 · 📓 Letters 전체 기록
       📌 오늘 할 일 · 🏅 업적 · 🍅 뽀모도로 · ✍️ 글자수

   [새로 짜지 않고 옮겨 씁니다]
   ★ 채팅·뽀모·글자수는 **원래 있던 그 요소를 그대로 옮겨** 담습니다.
     새로 그리면 멘션·답장·스티커·반응이 전부 따라오지 않아요.
     요소를 통째로 옮기면 붙어 있던 손가락(이벤트)도 같이 갑니다.
     script_layout.js 가 칸을 다시 짤 때 쓰는 것과 같은 수법이에요.

   [여닫는 규칙이 둘로 갈립니다]
   · **머무는 판** (공지·챗·수다방·뽀모·글자수)
     글을 쓰거나 오래 들여다보는 곳입니다. 바깥을 눌러도 안 닫혀요.
     ✕ 나 같은 알약을 다시 눌러야 닫힙니다.
     ★ 채팅은 특히 중요합니다 — 쓰다가 실수로 한 번 잘못 누르면
       쓰던 글이 통째로 날아가니까요.
   · **스쳐 보는 판** (오늘 할 일·업적)
     한눈에 보고 마는 것이라 바깥을 누르면 닫힙니다.

   [📓 Letters 전체 기록만 가운데 창]
   한 달 달력이라 위로 펼치는 좁은 판에 안 들어갑니다. 원래 쓰던
   가운데 창을 그대로 엽니다.
   ===================================================================== */
(function () {
  "use strict";

  /* 이 파일은 index2.html 에서만 돕니다 — 지금 쓰는 화면은 안 건드려요 */
  if (!document.getElementById("dock")) return;

  const el = (id) => document.getElementById(id);

  /* =====================================================================
     알약 목록
     ---------------------------------------------------------------------
     stay : true  = 머무는 판 (✕ 로만 닫힘)
            false = 스쳐 보는 판 (바깥 누르면 닫힘)
     size : 판 크기. 업적 판을 1 로 보고 견준 값입니다.
     move : 원래 화면에서 옮겨 올 요소 (없으면 판을 새로 채웁니다)
     ===================================================================== */
  const DOCK = [
    { id: "notice", label: "📢 공지",            stay: true,  size: 1.2, move: null },
    { id: "chat",   label: "💬 Chat",            stay: true,  size: 1.2, move: ".chat-sidebar", drag: true },
    /* 수다방은 뜨거울 때만 뜨겁고 조용할 땐 절간이라, 처음 잡은 1.8 에서
       75% 로 낮췄습니다 (1.35). 빈 판이 크면 더 허전해 보여요. */
    { id: "chatty", label: "☕ 수다방",           stay: true,  size: 1.35, move: null, drag: true },
    { id: "wcall",  label: "📓 Letters 전체 기록", stay: true, size: 0,   move: null, modal: true },
    /* 📌 오늘 할 일은 **판이 없습니다.** 방 전체의 진척을 한 줄로 보여줄
       뿐이라 펼칠 것이 없어요 — 알약 줄에 글자로 그대로 놓입니다. */
    { id: "todo",   label: "",                   stay: false, size: 0, move: null, inline: true },
    { id: "achv",   label: "🏅 업적",             stay: false, size: 1,   move: null },
    /* 고리가 자리를 많이 먹어서 1.1 → 0.77 (70%). 고리 자체도 아래
       CSS 에서 줄입니다 — 판만 줄이면 안이 잘려요. */
    { id: "pomo",   label: "🍅 Pomodoro",         stay: true,  size: 0.77, move: "#pomo-block", drag: true },
    { id: "wc",     label: "✍️ Letters",          stay: true,  size: 1.45, move: "#wordcount-block", drag: true }
  ];

  /* 업적 판 높이를 1 로 봅니다 — 다른 판은 여기에 곱해서 정합니다 */
  const BASE_H = 430;

  /* =====================================================================
     판이 뜨는 자리 (2026-08-12)
     ---------------------------------------------------------------------
     [기본] **제 알약 바로 위**에서 뜹니다.
       알약 차례가 공지·챗·수다방 … 뽀모·글자수 이므로, 그것만으로
       "공지·챗·수다방은 왼쪽, 뽀모·글자수는 오른쪽, 업적은 업적 위"가
       저절로 지켜집니다. 규칙을 따로 적을 필요가 없어요.

     [옮기기] 머리말을 잡고 끌면 원하는 자리에 놓입니다 (챗·수다방·
       뽀모·글자수 넷). 놓은 자리는 **이 기기에** 남아요.
       머리말을 두 번 누르면 제자리로 돌아갑니다.

     ★ 화면 밖으로 못 나갑니다. 끌다가 놓쳐서 판이 사라지면 되찾을
       길이 없으니까요 — 늘 8px 은 화면 안에 남습니다.
     ===================================================================== */
  const POS_KEY = "dockPos";
  const EDGE = 8;

  function loadPos(id) {
    try {
      const raw = window.AppStore?.getItem(POS_KEY + ":" + id);
      const v = raw ? JSON.parse(raw) : null;
      return (v && Number.isFinite(v.x) && Number.isFinite(v.y)) ? v : null;
    } catch (e) { return null; }
  }
  function savePos(id, x, y) {
    try { window.AppStore?.setItem(POS_KEY + ":" + id, JSON.stringify({ x, y })); } catch (e) {}
  }
  function clearPos(id) {
    try { window.AppStore?.removeItem(POS_KEY + ":" + id); } catch (e) {}
  }

  /** 제 알약 위 — 판 가운데가 알약 가운데에 오게 */
  function defaultPos(id) {
    const pill = el("dock-pill-" + id);
    const p = el("dock-panel-" + id);
    const host = el("dock-panels");
    if (!pill || !p || !host) return { x: 0, y: 0 };
    const pr = pill.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    const w = p.offsetWidth || 360;
    return { x: (pr.left + pr.width / 2) - hr.left - w / 2, y: 0 };
  }

  /** 화면 밖으로 나가지 않게 */
  function clampPos(p, x, y) {
    const host = el("dock-panels");
    const hr = host.getBoundingClientRect();
    const w = p.offsetWidth || 360, h = p.offsetHeight || 300;
    const maxX = hr.width - w - EDGE;
    const maxY = hr.top - EDGE;              // 위로 화면 끝까지
    return {
      x: Math.max(EDGE - hr.left, Math.min(maxX, x)),
      y: Math.max(0, Math.min(maxY, y))
    };
  }

  function place(id, pos) {
    const p = el("dock-panel-" + id);
    if (!p) return;
    const c = clampPos(p, pos.x, pos.y);
    p.style.left = Math.round(c.x) + "px";
    p.style.bottom = Math.round(c.y) + "px";
  }

  /* =====================================================================
     열린 판들 — **여럿을 동시에** 열 수 있습니다 (2026-08-12)
     ---------------------------------------------------------------------
     처음에는 하나만 열리게 했는데, 실제로 쓰는 모습을 보면 뽀모와
     글자수를 같이 켜 두고 작업하고, 챗과 수다방도 함께 봅니다.
     판은 나란히 놓이고, 한 줄에 다 못 들어가면 위로 접힙니다.
     ===================================================================== */
  const _open = new Set();

  /* =====================================================================
     판 만들기 — 알약마다 하나씩
     ===================================================================== */
  function build() {
    const bar = el("dock-bar");
    const host = el("dock-panels");
    if (!bar || !host) return;

    DOCK.forEach(d => {
      /* 알약 */
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dock-pill";
      b.id = "dock-pill-" + d.id;
      b.dataset.dock = d.id;
      b.setAttribute("aria-expanded", "false");
      b.innerHTML = `<span class="dock-pill-label">${d.label}</span>` +
                    `<span class="dock-badge hidden" id="dock-badge-${d.id}">0</span>`;
      bar.appendChild(b);

      if (d.inline) {
        /* 판이 없는 것 — 누르는 단추가 아니라 **보여주는 글자**입니다 */
        b.classList.add("dock-inline");
        b.removeAttribute("aria-expanded");
        delete b.dataset.dock;
        b.disabled = true;
        return;
      }
      if (d.modal) return;   // 가운데 창은 판을 안 만듭니다

      /* 판 */
      const p = document.createElement("div");
      p.className = "dock-panel" + (d.drag ? " can-drag" : "");
      p.id = "dock-panel-" + d.id;
      p.hidden = true;
      p.style.setProperty("--dock-h", Math.round(BASE_H * d.size) + "px");
      p.innerHTML =
        `<div class="dock-head">
           <span class="dock-title">${d.label}</span>
           <button type="button" class="dock-x" data-dock-close="${d.id}"
                   aria-label="${d.label} 닫기" title="닫기">✕</button>
         </div>
         <div class="dock-body" id="dock-body-${d.id}"></div>`;
      host.appendChild(p);
    });
  }

  /* =====================================================================
     원래 있던 요소를 판 안으로 옮깁니다
     ---------------------------------------------------------------------
     ★ 새로 그리지 않고 **옮깁니다.** 붙어 있던 손가락(이벤트)과 그동안
       쌓인 내용이 그대로 따라와요. 새로 그리면 채팅의 멘션·답장·스티커가
       전부 죽습니다.
     ★ 글자수는 원래 뽀모 칸 **안**에 들어 있었습니다. 알약이 둘로
       갈렸으니 여기서 떼어 냅니다 — 떼는 순서가 중요해요.
       (뽀모를 먼저 옮기면 글자수가 딸려 들어갑니다)
     ===================================================================== */
  function relocate() {
    /* 글자수를 **먼저** 떼어 냅니다 */
    const wc = document.querySelector("#wordcount-block");
    const wcBody = el("dock-body-wc");
    if (wc && wcBody) wcBody.appendChild(wc);

    DOCK.forEach(d => {
      if (!d.move) return;
      const node = document.querySelector(d.move);
      const body = el("dock-body-" + d.id);
      if (node && body) body.appendChild(node);
    });

    /* 📢 공지 — 원래 가운데 창의 알맹이를 그대로 가져옵니다.
       (손가락이 .modal-content 에 걸려 있어서 통째로 옮겨야 합니다) */
    const nt = document.querySelector("#notice-modal .modal-content");
    const ntBody = el("dock-body-notice");
    if (nt && ntBody) {
      nt.querySelector(".modal-x")?.remove();   // 판에는 우리 ✕ 가 있습니다
      ntBody.appendChild(nt);
    }

    /* 🏅 업적 — 판 내용은 script_achv.js 가 만들어 줍니다 */
    const achvBody = el("dock-body-achv");
    if (achvBody && window.achvPanelHtml) achvBody.innerHTML = window.achvPanelHtml();

    /* ☕ 수다방 — 접속자 줄과 대화 상자를 옮겨 옵니다 */
    const chattyBody = el("dock-body-chatty");
    if (chattyBody) {
      ["chatty-online-bar", "chat-box2"].forEach(id => {
        const n = el(id);
        if (n) chattyBody.appendChild(n);
      });
    }

    /* 📌 오늘 할 일 — 방 전체 진척을 알약 자리에 **글자로** 놓습니다.
       원래 줄(.room-foot)에는 전체기록·업적 알약도 함께 들어 있었는데,
       그것들은 이제 아래 알약 줄이 맡으므로 진척 칸만 꺼내 옵니다. */
    const pillTodo = el("dock-pill-todo");
    const roomTodo = el("room-todo");
    if (pillTodo && roomTodo) {
      pillTodo.innerHTML = "";
      pillTodo.appendChild(roomTodo);
      roomTodo.hidden = false;
    }
    /* 남은 껍데기는 치웁니다 — 화면 어딘가에 떠 있으면 안 되니까요 */
    document.querySelector(".room-foot")?.remove();
  }

  /* =====================================================================
     여닫기
     ===================================================================== */
  function open(id) {
    const d = DOCK.find(x => x.id === id);
    if (!d) return;

    /* 📓 전체 기록은 가운데 창 — 판을 안 씁니다.
       ★ 다른 판은 닫지 않습니다. 가운데 창이 뜬 동안 뒤에 뽀모가
         켜져 있어도 아쉬울 게 없어요. */
    if (d.modal) { window.openWcAll?.(); return; }

    if (_open.has(id)) { close(id); return; }

    const p = el("dock-panel-" + id);
    if (!p) return;
    p.hidden = false;
    _open.add(id);
    /* 자리 — 놓아둔 곳이 있으면 거기, 없으면 제 알약 위 */
    place(id, (d.drag && loadPos(id)) || defaultPos(id));
    el("dock-pill-" + id)?.setAttribute("aria-expanded", "true");
    document.getElementById("dock")?.setAttribute("data-open", [..._open].join(" "));

    /* 판마다 열 때 해줄 일 */
    if (id === "achv") {
      const body = el("dock-body-achv");
      if (body && window.achvPanelHtml) body.innerHTML = window.achvPanelHtml();
    }
    if (id === "notice") window.listenNoticeBoard?.();
    if (id === "chat")   window.scrollChatToBottom?.(true);
    if (id === "chatty") window.scrollChattyToBottom?.();

    /* 안 읽음 표시는 열면 지웁니다 */
    badge(id, 0);
  }

  /** 하나만 닫기 */
  function close(id) {
    const p = el("dock-panel-" + id);
    if (p) p.hidden = true;
    el("dock-pill-" + id)?.setAttribute("aria-expanded", "false");
    _open.delete(id);
    const dock = document.getElementById("dock");
    if (!dock) return;
    if (_open.size) dock.setAttribute("data-open", [..._open].join(" "));
    else dock.removeAttribute("data-open");
  }

  /** 전부 닫기 */
  function closeAll() {
    [..._open].forEach(close);
    DOCK.forEach(d => {
      const p = el("dock-panel-" + d.id);
      if (p) p.hidden = true;
      el("dock-pill-" + d.id)?.setAttribute("aria-expanded", "false");
    });
    _open.clear();
    document.getElementById("dock")?.removeAttribute("data-open");
  }

  /** 스쳐 보는 판만 닫기 — 바깥을 눌렀을 때 */
  function closeGlances() {
    [..._open].forEach(id => {
      const d = DOCK.find(x => x.id === id);
      if (d && !d.stay) close(id);
    });
  }

  /** 안 읽음 숫자 — 0 이면 감춥니다 */
  function badge(id, n) {
    const b = el("dock-badge-" + id);
    if (!b) return;
    const v = Math.max(0, Number(n) || 0);
    b.textContent = v > 99 ? "99+" : String(v);
    b.classList.toggle("hidden", v === 0);
  }
  window.dockBadge = badge;

  /* =====================================================================
     손가락
     ---------------------------------------------------------------------
     ★ 머무는 판은 바깥을 눌러도 안 닫힙니다. 채팅에서 쓰던 글이 날아가는
       일을 막으려는 것이라, 이 규칙이 이 화면의 핵심입니다.
     ===================================================================== */
  /* =====================================================================
     머리말을 잡고 끌기
     ---------------------------------------------------------------------
     ★ ✕ 위에서는 안 잡힙니다 — 닫으려다 끌려가면 안 되니까요.
     ★ pointer 를 잡아 둡니다(setPointerCapture). 안 그러면 빨리 끌 때
       손가락이 판 밖으로 나가면서 끌기가 끊깁니다.
     ===================================================================== */
  let _drag = null;

  function bindDrag() {
    document.addEventListener("pointerdown", (e) => {
      const head = e.target.closest(".dock-head");
      if (!head || e.target.closest("[data-dock-close]")) return;
      const panel = head.closest(".dock-panel");
      if (!panel) return;
      const id = panel.id.replace("dock-panel-", "");
      const d = DOCK.find(x => x.id === id);
      if (!d || !d.drag) return;                 // 옮길 수 있는 판만

      const r = panel.getBoundingClientRect();
      const host = el("dock-panels").getBoundingClientRect();
      _drag = {
        id, panel,
        dx: e.clientX - r.left,
        dy: r.bottom - e.clientY,
        hostLeft: host.left, hostBottom: host.bottom
      };
      panel.classList.add("dragging");
      head.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });

    document.addEventListener("pointermove", (e) => {
      if (!_drag) return;
      place(_drag.id, {
        x: e.clientX - _drag.dx - _drag.hostLeft,
        y: _drag.hostBottom - (e.clientY + _drag.dy)
      });
    });

    const 놓기 = () => {
      if (!_drag) return;
      const p = _drag.panel;
      p.classList.remove("dragging");
      savePos(_drag.id, parseFloat(p.style.left) || 0, parseFloat(p.style.bottom) || 0);
      _drag = null;
    };
    document.addEventListener("pointerup", 놓기);
    document.addEventListener("pointercancel", 놓기);

    /* 머리말을 두 번 누르면 제자리로 — 끌다가 이상해졌을 때의 되돌리기 */
    document.addEventListener("dblclick", (e) => {
      const head = e.target.closest(".dock-head");
      if (!head) return;
      const panel = head.closest(".dock-panel");
      if (!panel) return;
      const id = panel.id.replace("dock-panel-", "");
      if (!DOCK.find(x => x.id === id)?.drag) return;
      clearPos(id);
      place(id, defaultPos(id));
    });
  }

  function bind() {
    document.addEventListener("click", (e) => {
      const pill = e.target.closest("[data-dock]");
      if (pill) { open(pill.dataset.dock); return; }

      const x = e.target.closest("[data-dock-close]");
      if (x) { close(x.dataset.dockClose); return; }   // ★ 그 판만 닫습니다

      if (!_open.size) return;
      /* 판 안을 누른 것이면 아무것도 닫지 않습니다 */
      if (e.target.closest(".dock-panel")) return;
      /* 바깥을 눌렀을 때 — **스쳐 보는 판만** 닫습니다.
         머무는 판(챗·수다방…)은 그대로예요. 여럿이 열려 있어도
         각자 제 규칙을 지킵니다. */
      closeGlances();
    });

    /* Esc 는 어느 판이든 닫습니다 — 빠져나갈 길은 늘 있어야 하니까요.
       ★ 다만 글을 쓰는 중이면 한 번은 봐줍니다 (실수로 날리지 않게) */
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !_open.size) return;
      const t = document.activeElement;
      const 쓰는중 = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA") && t.value;
      if (쓰는중) { t.blur(); return; }
      closeAll();
    });
  }

  function start() {
    build();
    relocate();
    bind();
    bindDrag();
    /* 처음에는 다 닫아 둡니다 — 카드가 제일 넓게 보이는 상태 */
    closeAll();
    console.log("[dock] 알약 " + DOCK.length + "개 준비 완료");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  window.dockOpen  = open;
  window.dockClose = closeAll;
  window.dockCloseOne = close;
  window.dockOpened = () => [..._open];
  window.DOCK_LIST = DOCK;
})();
