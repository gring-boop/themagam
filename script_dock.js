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
    { id: "chat",   label: "💬 챗",              stay: true,  size: 1.2, move: ".chat-sidebar" },
    { id: "chatty", label: "☕ 수다방",           stay: true,  size: 1.8, move: null },
    { id: "wcall",  label: "📓 Letters 전체 기록", stay: true, size: 0,   move: null, modal: true },
    { id: "todo",   label: "📌 오늘 할 일",        stay: false, size: 0.7, move: null },
    { id: "achv",   label: "🏅 업적",             stay: false, size: 1,   move: null },
    { id: "pomo",   label: "🍅 뽀모도로",          stay: true,  size: 1.1, move: "#pomo-block" },
    { id: "wc",     label: "✍️ 글자수",           stay: true,  size: 1.2, move: "#wordcount-block" }
  ];

  /* 업적 판 높이를 1 로 봅니다 — 다른 판은 여기에 곱해서 정합니다 */
  const BASE_H = 430;

  let _open = "";      // 지금 열린 판의 id ("" 면 다 닫힘)

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

      if (d.modal) return;   // 가운데 창은 판을 안 만듭니다

      /* 판 */
      const p = document.createElement("div");
      p.className = "dock-panel";
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

    /* 📌 오늘 할 일 — 방 전체 진척 줄을 그대로 */
    const todoBody = el("dock-body-todo");
    const foot = document.querySelector(".room-foot");
    if (todoBody && foot) todoBody.appendChild(foot);
  }

  /* =====================================================================
     여닫기
     ===================================================================== */
  function open(id) {
    const d = DOCK.find(x => x.id === id);
    if (!d) return;

    /* 📓 전체 기록은 가운데 창 — 판을 안 씁니다 */
    if (d.modal) { closeAll(); window.openWcAll?.(); return; }

    if (_open === id) { closeAll(); return; }
    closeAll();

    const p = el("dock-panel-" + id);
    if (!p) return;
    p.hidden = false;
    _open = id;
    el("dock-pill-" + id)?.setAttribute("aria-expanded", "true");
    document.getElementById("dock")?.setAttribute("data-open", id);

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

  function closeAll() {
    DOCK.forEach(d => {
      const p = el("dock-panel-" + d.id);
      if (p) p.hidden = true;
      el("dock-pill-" + d.id)?.setAttribute("aria-expanded", "false");
    });
    _open = "";
    document.getElementById("dock")?.removeAttribute("data-open");
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
  function bind() {
    document.addEventListener("click", (e) => {
      const pill = e.target.closest("[data-dock]");
      if (pill) { open(pill.dataset.dock); return; }

      const x = e.target.closest("[data-dock-close]");
      if (x) { closeAll(); return; }

      if (!_open) return;
      const d = DOCK.find(v => v.id === _open);
      if (d && d.stay) return;                       // 머무는 판은 그대로

      if (!e.target.closest(".dock-panel")) closeAll();
    });

    /* Esc 는 어느 판이든 닫습니다 — 빠져나갈 길은 늘 있어야 하니까요.
       ★ 다만 글을 쓰는 중이면 한 번은 봐줍니다 (실수로 날리지 않게) */
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !_open) return;
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
  window.DOCK_LIST = DOCK;
})();
