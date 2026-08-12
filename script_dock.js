/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_dock.js — 아래 알약 줄 (2026-08-12 부터 본 배치)
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

  /* #dock 이 있는 화면에서만 돕니다.
     예전 세 칸 배치(index-classic.html)로 되돌려도 여기서 조용히 나가요. */
  if (!document.getElementById("dock")) return;

  const el = (id) => document.getElementById(id);

  /* =====================================================================
     알약 목록
     ---------------------------------------------------------------------
     stay : true  = 머무는 판 (✕ 로만 닫힘)
            false = 스쳐 보는 판 (바깥 누르면 닫힘)
     size : 판 크기. 업적 판을 1 로 보고 견준 값입니다.
     move : 원래 화면에서 옮겨 올 요소 (없으면 판을 새로 채웁니다)
     panel: 제 판을 안 갖고 **남의 판을 같이 쓰는** 알약 (수다방)
     tab  : 그 판에서 켜 둘 탭
     ===================================================================== */
  const DOCK = [
    { id: "notice", label: "📢 공지",            stay: true,  size: 1.2, move: null },
    { id: "chat",   label: "💬 Chat",            stay: true,  size: 1.2, move: ".chat-sidebar", drag: true, tab: "main" },
    /* =====================================================================
       ☕ 수다방은 **챗과 같은 판의 다른 탭**입니다 (고침 2026-08-12)
       ---------------------------------------------------------------------
       [무엇이 잘못됐었나]
       알약을 눌러도 수다방이 **텅 빈 판**으로 떴습니다. 두 가지가 겹쳤어요.

         ① #chat-box2 는 switchChatTab("chatty") 가 .hidden 을 떼기
            전까지 감춰져 있습니다. 알약은 판만 열 뿐 탭을 안 켰으니,
            안에 든 것이 계속 숨어 있었어요.
         ② 더 근본은 **글칸이 하나**라는 것입니다. #message 와 보내기
            단추는 챗과 수다방이 함께 씁니다. script_chat.js 의 send()
            가 "지금 켜진 탭" 을 보고 messages / messages2 로 갈라
            보내거든요.

       그래서 둘을 따로 띄우면, 어느 한쪽은 반드시 **글칸이 없는 판**이
       됩니다. 원래 앱이 이것을 탭으로 만든 이유가 그거였어요.
       알약은 둘로 두되(찾기 쉬우니까) 판은 하나를 나눠 씁니다.
       ===================================================================== */
    { id: "chatty", label: "☕ 수다방", stay: true, size: 1.35, move: null, panel: "chat", tab: "chatty" },
    { id: "wcall",  label: "📓 Letters 전체 기록", stay: true, size: 0,   move: null, modal: true },
    /* 📌 오늘 할 일은 **판이 없습니다.** 방 전체의 진척을 한 줄로 보여줄
       뿐이라 펼칠 것이 없어요 — 알약 줄에 글자로 그대로 놓입니다. */
    { id: "todo",   label: "",                   stay: false, size: 0, move: null, inline: true },
    { id: "achv",   label: "🏅 업적",             stay: false, size: 1,   move: null },
    /* 고리가 자리를 많이 먹어서 1.1 → 0.77 (70%). 고리 자체도 아래
       CSS 에서 줄입니다 — 판만 줄이면 안이 잘려요. */
    { id: "pomo",   label: "🍅 Pomodoro",         stay: true,  size: 0.77, move: "#pomo-block", drag: true },
    /* 글자수만 유독 높아서 카드 맨 윗줄까지 올라왔습니다. 1.45 → 1.23 (85%) */
    { id: "wc",     label: "✍️ Letters",          stay: true,  size: 1.23, move: "#wordcount-block", drag: true }
  ];

  /* 업적 판 높이를 1 로 봅니다 — 다른 판은 여기에 곱해서 정합니다 */
  const BASE_H = 430;

  /* 알약 id → 그 알약이 여는 판의 id.
     수다방만 남의 판(chat)을 가리키고, 나머지는 제 이름 그대로입니다.
     _open · 자리 기억 · 맨 위로 올리기 모두 **판 id** 로 셈합니다. */
  const _PANEL = {};
  DOCK.forEach(d => { _PANEL[d.id] = d.panel || d.id; });
  const panelOf = (id) => _PANEL[id] || id;

  /** 지금 챗 판이 어느 탭인지 ("main" | "chatty") */
  let _tab = "main";

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

  /** 누른 알약 위 — 판 가운데가 알약 가운데에 오게
      (수다방처럼 남의 판을 여는 알약은 **누른 쪽** 위에서 뜹니다) */
  function defaultPos(id, pillId) {
    const pill = el("dock-pill-" + (pillId || id));
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
     방금 만진 판이 맨 위로 (2026-08-12)
     ---------------------------------------------------------------------
     [무엇이 불편했나]
     판들이 만들어진 차례대로 쌓여서, **왼쪽 알약의 판이 늘 아래**로
     깔렸습니다. 챗을 왼쪽에 두고 수다방을 그 위에 겹쳐 놓으면, 새 글이
     와서 답하려 해도 챗이 가려져 있었어요. 옮기거나 닫는 수밖에요.

     [어떻게]
     판을 만지는 순간(누르거나 글칸에 커서를 두는 순간) 그 판을 맨 위로
     올립니다. 종이 여러 장을 책상에 늘어놓고 쓰는 것과 같아요 —
     방금 손댄 것이 위로 옵니다.

     ★ 자리(left·bottom)는 안 건드립니다. 위아래 차례만 바뀌어요.
     ===================================================================== */
  let _zTop = 10;

  function raise(id) {
    const p = el("dock-panel-" + id);
    if (!p) return;
    if (Number(p.style.zIndex) === _zTop) return;   // 이미 맨 위
    p.style.zIndex = String(++_zTop);
  }
  window.dockRaise = raise;

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
      /* ★ 배지는 알약 **바깥**(오른쪽 위 모서리)에 띄웁니다.
         안쪽에 넣으면 배지가 뜰 때마다 알약이 넓어져서 줄 전체가
         밀립니다 — 새 글이 올 때마다 아래 줄이 들썩이면 눈에 거슬려요. */
      b.innerHTML = `<span class="dock-pill-label">${d.label}</span>` +
                    `<span class="dock-badge hidden" id="dock-badge-${d.id}">0</span>` +
                    `<span class="dock-dot hidden" id="dock-dot-${d.id}" aria-hidden="true"></span>`;
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
      if (d.panel) return;   // 남의 판을 같이 쓰는 알약 (수다방)

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

    /* =====================================================================
       🏅 업적 — 원래 칸을 **지우지 말고 숨겨 둡니다** (고침 2026-08-12)
       ---------------------------------------------------------------------
       achvPanelHtml() 은 이렇게 돕니다.

           renderPanel();                        // #achv-panel 에 그리고
           return el("achv-panel")?.innerHTML;   // 그 알맹이를 돌려준다

       그런데 #achv-panel 은 .room-foot 안에 살고 있었습니다. 아래에서
       .room-foot 을 통째로 치우는 바람에 그릴 자리가 사라졌고,
       achvPanelHtml() 은 조용히 **빈 문자열**을 돌려줬어요.
       그래서 업적 알약이 새하얀 판으로 떴습니다.

       ★ 지우지 않고 화면 밖으로 옮겨 둡니다. script_mywork.js 의
         🏅 업적 탭도 같은 창구를 쓰므로, 살려 둬야 둘 다 삽니다.
       ===================================================================== */
    const achvBar = el("achv-bar");
    if (achvBar) {
      achvBar.classList.add("dock-offstage");
      document.body.appendChild(achvBar);
    }
    const achvBody = el("dock-body-achv");
    if (achvBody && window.achvPanelHtml) achvBody.innerHTML = window.achvPanelHtml();

    /* ☕ 수다방은 옮길 것이 없습니다 — #chatty-online-bar 와 #chat-box2 는
       원래부터 .chat-sidebar 안에 있어서 챗 판과 함께 따라왔습니다. */

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
     좁은 화면 — 한 번에 한 판만 (2026-08-12)
     ---------------------------------------------------------------------
     예전 세 칸 배치에는 "폭이 좁으면 창 하나만" 규칙이 있었습니다
     (body.narrow-chat-focus). 알약 줄로 오면서 그 규칙이 갈 곳을 잃었어요.
     여기서 이어 받습니다 — 좁으면 판이 화면 폭을 다 쓰고, 새로 열면
     먼저 열려 있던 판은 닫힙니다. 손바닥만 한 화면에 판 두 개를 겹쳐
     놓아 봐야 둘 다 못 읽으니까요.

     기준 너비는 script_ui.js 의 applyNarrowChatFocus() 가 정합니다.
     ===================================================================== */
  function isNarrow() {
    return document.body.classList.contains("narrow-chat-focus");
  }

  /** 알약의 눌린 표시를 지금 상태에 맞춥니다 (수다방은 탭까지 봅니다) */
  function syncPills() {
    DOCK.forEach(d => {
      if (d.inline || d.modal) return;
      const on = _open.has(panelOf(d.id)) && (!d.tab || _tab === d.tab);
      el("dock-pill-" + d.id)?.setAttribute("aria-expanded", on ? "true" : "false");
    });
  }

  /** 챗 판의 머리말과 높이를 지금 탭에 맞춥니다 */
  function applyChatTab() {
    const p = el("dock-panel-chat");
    if (!p) return;
    const d = DOCK.find(x => x.tab === _tab && panelOf(x.id) === "chat");
    if (!d) return;
    p.querySelector(".dock-title") && (p.querySelector(".dock-title").textContent = d.label);
    p.querySelector(".dock-x")?.setAttribute("aria-label", d.label + " 닫기");
    p.style.setProperty("--dock-h", Math.round(BASE_H * d.size) + "px");
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

    const pid = panelOf(id);

    /* 같은 알약을 다시 누르면 닫힙니다.
       ★ 챗·수다방은 **탭까지 같을 때만** 닫습니다. 챗을 보다가 수다방을
         누른 것은 "닫아 줘" 가 아니라 "옮겨 줘" 니까요. */
    if (_open.has(pid) && (!d.tab || _tab === d.tab)) { close(pid); return; }

    const p = el("dock-panel-" + pid);
    if (!p) return;

    /* 판의 주인 — 수다방처럼 남의 판을 쓰는 알약이라도, 크기·끌기·
       자리 기억은 **판 주인**의 것을 따라야 합니다. */
    const own = DOCK.find(x => !x.panel && panelOf(x.id) === pid) || d;
    const 이미열림 = _open.has(pid);

    /* 좁은 화면이면 먼저 열려 있던 판을 접습니다 */
    if (isNarrow()) [..._open].forEach(o => { if (o !== pid) close(o); });

    if (d.tab) { _tab = d.tab; window.switchChatTab?.(d.tab); applyChatTab(); }

    p.hidden = false;
    _open.add(pid);
    /* 자리 — 놓아둔 곳이 있으면 거기, 없으면 제 알약 위.
       ★ 이미 열려 있던 판(탭만 갈아탄 경우)은 **안 옮깁니다.** 애써
         끌어다 놓은 자리가 탭 한 번에 튕겨 나가면 안 되니까요. */
    if (!이미열림) place(pid, (own.drag && loadPos(pid)) || defaultPos(pid, id));
    raise(pid);                      // 방금 연 것이 맨 위로
    syncPills();
    document.getElementById("dock")?.setAttribute("data-open", [..._open].join(" "));

    /* 판마다 열 때 해줄 일 */
    if (pid === "achv") {
      const body = el("dock-body-achv");
      if (body && window.achvPanelHtml) body.innerHTML = window.achvPanelHtml();
    }
    /* 📢 공지 — **여는 일은 공지판 제 손으로** 시킵니다 (고침 2026-08-12).
       render() 는 #notice-modal 의 display 가 flex 일 때만 도는데,
       알약은 그 값을 건드리지 않아서 목록이 영영 안 그려졌습니다.
       ("아직 공지가 없어요" 도 아니고 아예 빈 칸이었어요 — 그리는
        일 자체가 없었으니까요.) 겉창은 CSS 로 감춰 뒀습니다. */
    if (pid === "notice") { window.listenNoticeBoard?.(); window.openNoticeBoard?.(); }
    if (pid === "chat") {
      if (_tab === "chatty") window.scrollChattyToBottom?.();
      else window.scrollChatToBottom?.(true);
    }

    /* 보고 있는 동안에는 표시를 지웁니다 */
    badge(id, 0);
    dot(id, false);
  }

  /** 하나만 닫기 — **판** id 를 받습니다 */
  function close(id) {
    const pid = panelOf(id);
    const p = el("dock-panel-" + pid);
    if (p) p.hidden = true;
    if (pid === "notice") window.closeNoticeBoard?.();
    setTimeout(syncBadges, 0);      // 닫으면 다시 쌓이기 시작합니다
    _open.delete(pid);
    syncPills();
    const dock = document.getElementById("dock");
    if (!dock) return;
    if (_open.size) dock.setAttribute("data-open", [..._open].join(" "));
    else dock.removeAttribute("data-open");
  }

  /** 전부 닫기 */
  function closeAll() {
    [..._open].forEach(close);
    DOCK.forEach(d => {
      const p = el("dock-panel-" + panelOf(d.id));
      if (p) p.hidden = true;
    });
    _open.clear();
    syncPills();
    document.getElementById("dock")?.removeAttribute("data-open");
  }

  /** 스쳐 보는 판만 닫기 — 바깥을 눌렀을 때 */
  function closeGlances() {
    [..._open].forEach(pid => {
      const d = DOCK.find(x => panelOf(x.id) === pid && !x.panel);
      if (d && !d.stay) close(pid);
    });
  }

  /** 안 읽음 숫자 — 0 이면 감춥니다 (챗·수다방) */
  function badge(id, n) {
    const b = el("dock-badge-" + id);
    if (!b) return;
    const v = Math.max(0, Number(n) || 0);
    b.textContent = v > 99 ? "99+" : String(v);
    b.classList.toggle("hidden", v === 0);
  }
  window.dockBadge = badge;

  /** 붉은 점 — 개수 없이 "새 것 있음" 만 (공지) */
  function dot(id, on) {
    el("dock-dot-" + id)?.classList.toggle("hidden", !on);
  }
  window.dockDot = dot;

  /* =====================================================================
     안 읽음 표시를 원래 있던 것에서 그대로 가져옵니다
     ---------------------------------------------------------------------
     채팅·수다방은 script_chatty.js 가, 공지는 script_notice.js 가 이미
     세고 있습니다. 여기서 다시 세면 **두 벌이 되어 언젠가 어긋나요.**
     그쪽이 만들어 둔 표시를 지켜보다가 그대로 옮겨 적습니다.

       #chat-tab-badge-main    → 💬 Chat
       #chat-tab-badge-chatty  → ☕ 수다방
       #notice-dot             → 📢 공지

     ★ 판이 **열려 있는 동안**에는 표시를 지웁니다. 보고 있는데 숫자가
       쌓이면 이상하니까요.
     ===================================================================== */
  function syncBadges() {
    const 읽기 = (id) => {
      const n = el(id);
      if (!n) return 0;
      if (n.classList.contains("hidden")) return 0;
      return parseInt(String(n.textContent).replace(/\D/g, ""), 10) || 0;
    };
    /* ★ 챗과 수다방은 한 판을 나눠 쓰므로, 판이 열려 있는 것만으로는
         부족합니다 — **지금 보고 있는 탭**의 표시만 지웁니다. */
    const 보는중 = (tab) => _open.has("chat") && _tab === tab;
    badge("chat",   보는중("main")   ? 0 : 읽기("chat-tab-badge-main"));
    badge("chatty", 보는중("chatty") ? 0 : 읽기("chat-tab-badge-chatty"));
    const nd = el("notice-dot");
    dot("notice", !_open.has("notice") && !!nd && !nd.classList.contains("hidden"));
  }

  function watchBadges() {
    ["chat-tab-badge-main", "chat-tab-badge-chatty", "notice-dot"].forEach(id => {
      const n = el(id);
      if (!n) return;
      try {
        new MutationObserver(syncBadges).observe(n, {
          attributes: true, attributeFilter: ["class"], childList: true, characterData: true, subtree: true
        });
      } catch (e) {}
    });
    /* 지켜보기가 안 되는 경우를 대비해 이따금 한 번씩 맞춥니다 */
    setInterval(syncBadges, 3000);
    syncBadges();
  }

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
    /* ★ 판을 만지면 맨 위로. capture 로 받는 이유 —
       글칸·단추가 이벤트를 멈추더라도(stopPropagation) 여기까지는
       먼저 오기 때문입니다. 채팅 입력칸을 눌렀는데 안 올라오면
       고친 뜻이 없어요. */
    const 올리기 = (e) => {
      const p = e.target.closest?.(".dock-panel");
      if (p) raise(p.id.replace("dock-panel-", ""));
    };
    document.addEventListener("pointerdown", 올리기, true);
    document.addEventListener("focusin", 올리기, true);

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

    /* 판 **안**의 탭 단추(제목 = 메인, ☕ 수다방)로 넘어갔을 때도
       알약 표시를 맞춥니다. 저쪽이 켠 탭을 여기서 다시 물어봐요 —
       탭을 켜는 일은 script_chatty.js 하나만 맡게 두려는 것입니다. */
    document.addEventListener("click", () => {
      setTimeout(() => {
        const t = window.isChattyActive?.() ? "chatty" : "main";
        if (t === _tab) return;
        _tab = t;
        applyChatTab();
        syncPills();
        syncBadges();
      }, 0);
    });

    /* 넓다가 좁아지면 여러 판이 겹쳐 남습니다 — 맨 위 하나만 남깁니다 */
    window.addEventListener("resize", () => {
      if (!isNarrow() || _open.size < 2) return;
      const 남길 = [..._open].sort((a, b) =>
        (Number(el("dock-panel-" + a)?.style.zIndex) || 0) -
        (Number(el("dock-panel-" + b)?.style.zIndex) || 0)).pop();
      [..._open].forEach(o => { if (o !== 남길) close(o); });
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
    watchBadges();
    _tab = window.isChattyActive?.() ? "chatty" : "main";
    applyChatTab();
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
