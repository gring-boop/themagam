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
    { id: "chat",   label: "💬 Chat",  stay: true, size: 1.2, move: ".chat-sidebar", drag: true, tab: "main", resize: true },
    /* =====================================================================
       ☕ 수다방 — 제 판을 갖습니다 (2026-08-12, 두 번째 고침)
       ---------------------------------------------------------------------
       [처음에 왜 한 판으로 묶었나]
       글 쓰는 칸(#message)과 보내기 단추가 **하나뿐**입니다. send() 가
       "지금 켜진 방" 을 보고 messages / messages2 로 갈라 보내요.
       그래서 판을 둘로 나누면 한쪽은 글칸 없는 판이 됩니다.

       [그런데 한 판으로 묶으니]
       챗을 열어 둔 채 수다방을 누르면 **같은 판이 키만 커지면서** 수다방이
       됐습니다. 둘이 따로 놀지도 않고, 돌아갈 길도 안 보였어요.

       [그래서 — 창은 둘, 펜은 하나]
       판은 각자 띄웁니다. 지난 이야기도 **둘 다 동시에 보입니다.**
       다만 **글칸은 방금 누른 판으로 옮겨 갑니다.** 책상에 공책 두 권을
       펴 두고 펜 하나로 번갈아 쓰는 셈이에요. 글칸이 없는 쪽에는
       "여기에 쓰기" 줄이 남아서, 누르면 펜이 그리로 옵니다.
       ===================================================================== */
    { id: "chatty", label: "☕ 수다방", stay: true, size: 1.35, move: null, drag: true, tab: "chatty", resize: true },
    /* 🏢 출판사 품평 — 익명 게시판 (2026-08-12, script_pubreview.js).
       공지처럼 목록형이지만 댓글이 길게 달리는 곳이라 키울 수 있게 했어요. */
    { id: "pub", label: "🏢 출판사 품평", stay: true, size: 1.35, move: null, drag: true, resize: true },
    /* ♪ BGM (2026-08-13, script_music.js) — 유튜브 추천 리스트 + 작은
       플레이어. 접어도 소리가 이어집니다(판은 hidden 으로 가려질 뿐,
       iframe 은 DOM 에 남으니까). 키는 위 가장자리로 조절. */
    /* [2026-08-14] 기본 키를 도로 전부 보이게(0.5 → 0.72) — "영상까지만"을
       기본으로 했더니 처음 여는 사람이 까만 상자만 보고 뭘 눌러야 할지
       몰랐습니다(실제 제보 ㅋㅋ). 리스트·입력칸이 보여야 쓰는 법을 알아요.
       영상만 남기고 싶은 사람은 위 가장자리를 아래로 끌어 줄이면 되고,
       줄인 키는 이 기기에 남습니다. */
    { id: "music", label: "♪ BGM", stay: true, size: 0.72, move: null, drag: true, resize: true },
    /* 📁 자료실 (2026-08-18) — 한글·엑셀 같은 자료를 올리고 내려받는 자리.
       BGM 오른쪽 (콩 지정). 목록이 길어지니 키울 수 있게 resize. */
    { id: "files", label: "📁 자료실", stay: true, size: 1.35, move: null, drag: true, resize: true },
    /* 📌 오늘 할 일은 **판이 없습니다.** 방 전체의 진척을 한 줄로 보여줄
       뿐이라 펼칠 것이 없어요 — 알약 줄에 글자로 그대로 놓입니다.
       [2026-08-13] 자리를 전체기록 앞으로 — 왼쪽(소통)과 오른쪽(기록)을
       가르는 기준선 역할입니다. */
    { id: "todo",   label: "",                   stay: false, size: 0, move: null, inline: true },
    { id: "wcall",  label: "📓 Letters 전체 기록", stay: true, size: 0,   move: null, modal: true },
    /* [2026-08-16] 🆘 살려주세요‼️ — "이거 맞나요?" 하고 후다닥 묻는
       익명 자리. 맞춤법·단어·문장. 채택도 하트도 없고 💡 아하 스티커만
       겹쳐 붙습니다 (채택은 은근히 자존심 문제라 아무도 답을 안 달게 돼요).
       ★ id 는 help 그대로 둡니다 — 이름표만 바뀐 것이고, id 를 바꾸면
         저장해 둔 판 높이·자리가 통째로 날아갑니다. */
    { id: "help",   label: "🆘 살려주세요‼️",      stay: true,  size: 1.35, move: null, drag: true, resize: true },
    { id: "achv",   label: "🏅 업적",             stay: false, size: 1,   move: null },
    /* 고리가 자리를 많이 먹어서 1.1 → 0.77 (70%). 고리 자체도 아래
       CSS 에서 줄입니다 — 판만 줄이면 안이 잘려요. */
    { id: "pomo",   label: "🍅 Pomodoro",         stay: true,  size: 0.77, move: "#pomo-block", drag: true },
    /* 글자수만 유독 높아서 카드 맨 윗줄까지 올라왔습니다. 1.45 → 1.23 (85%) */
    /* [2026-08-16] ✍️ Letters → Work Log.
       숫자만 적던 자리에 메모와 할 일 명령이 붙으면서, 이제 하는 일이
       "글자수" 보다 넓어졌습니다. 콩트에서 쓰던 이름을 그대로 씁니다.
       ★ resize: true — 일지가 길어지니 챗처럼 위 가장자리를 잡아
         키울 수 있어야 합니다 (2026-08-16 방장 요청). */
    { id: "wc",     label: "✍️ Work Log",        stay: true,  size: 1.23, move: "#wordcount-block", drag: true, resize: true }
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
    /* ★★ [고침 2026-08-15] 여기도 자가 섞여 있었습니다.
       pr·hr 은 화면 값이고 w(offsetWidth)는 요소 값이에요.
       **화면에서 잰 거리**를 먼저 구하고, 그것만 배율로 나눠 판이 사는
       자리(요소 기준)로 옮깁니다. 그러면 알약이 되돌려 확대돼 있든
       아니든(머리말·알약 줄은 제 크기로 두니까요) 늘 맞습니다. */
    const z = (window.uiZoom?.() || 1);
    const 알약가운데 = pr.left + pr.width / 2;      // 화면 기준
    return { x: (알약가운데 - hr.left) / z - w / 2, y: 0 };
  }

  /* 화면 배율 — 🧘 혼자 방의 확대·축소. 진짜 방에서는 늘 1 입니다.

     [왜 나눠야 하나] getBoundingClientRect 와 마우스 좌표는 **확대된 뒤**
     의 화면 값이고, style.left 와 offsetWidth 는 **확대 전** 요소 값입니다.
     섞어 쓰면 95% 에서 판이 오른쪽 끝에 닿기도 전에 막혔어요 — 화면
     너비(작아진 값)로 재고 판 너비(원래 값)를 빼니까요. */
  const Z = () => (window.uiZoom?.() || 1);

  /** 화면 밖으로 나가지 않게 */
  function clampPos(p, x, y) {
    const host = el("dock-panels");
    const hr = host.getBoundingClientRect();
    const z = Z();
    /* 재는 자를 하나로 맞춥니다 — 전부 요소 기준(확대 전)으로 */
    const hostLeft = hr.left / z, hostTop = hr.top / z, hostW = hr.width / z;
    const w = p.offsetWidth || 360, h = p.offsetHeight || 300;
    const maxX = hostW - w - EDGE;
    const maxY = hostTop - EDGE;             // 위로 화면 끝까지
    return {
      x: Math.max(EDGE - hostLeft, Math.min(maxX, x)),
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
        (d.resize ? `<div class="dock-grip" data-dock-grip="${d.id}"
                          role="separator" aria-orientation="horizontal"
                          title="위로 끌면 커져요 · 두 번 누르면 원래대로"></div>` : "") +
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

    /* ☕ 수다방 — 접속자 줄과 대화 상자를 제 판으로 떼어 옵니다.
       (원래는 .chat-sidebar 안에서 챗과 자리를 바꿔 가며 살았어요) */
    const chattyBody = el("dock-body-chatty");
    if (chattyBody) {
      ["chatty-online-bar", "chat-box2"].forEach(id => {
        const n = el(id);
        if (n) chattyBody.appendChild(n);
      });
    }

    /* ✍️ 글칸이 앉을 자리 — 두 판에 하나씩. 글칸은 이 둘 사이를 오갑니다. */
    const 자리 = (host, id, hint) => {
      if (!host) return;
      const s = document.createElement("div");
      s.className = "dock-write";
      s.id = id;
      s.dataset.hint = hint;
      host.appendChild(s);
    };
    자리(document.querySelector("#dock-body-chat .chat-sidebar") || el("dock-body-chat"),
         "dock-write-chat", "✍️ 여기에 쓰기");
    자리(chattyBody, "dock-write-chatty", "✍️ 수다방에 쓰기");
    moveInput("main");

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

  /* =====================================================================
     ✍️ 펜 하나, 공책 둘 — 글칸 옮기기
     ---------------------------------------------------------------------
     #message · 보내기 · 답장 미리보기는 챗과 수다방이 **함께 씁니다.**
     그래서 물건 자체를 방금 누른 판으로 옮겨 놓습니다. 비어 있는 쪽에는
     "여기에 쓰기" 줄이 남고, 그 줄을 누르면 펜이 그리로 옵니다.

     ★ 스티커 판은 안 옮겨도 됩니다 — 누른 단추 자리를 재서 body 에
       띄우는 방식이라 글칸이 어디 있든 그 옆에 붙어요.
     ===================================================================== */
  /* 글칸과 함께 다니는 것들.
     [고침 2026-08-13] mention-dropdown 추가 — 빠져 있어서 수다방에서
     @ 를 치면 드롭다운이 **닫혀 있는 챗 판 안에서** 열렸습니다.
     열리긴 열려요. 보이지 않는 곳에서. 그래서 "무반응"으로 보였습니다. */
  const 펜 = ["reply-preview-bar", "mention-dropdown"];

  /* ★★ [고침 2026-08-13] 글칸 이사가 한글을 깨뜨리고 있었습니다.

     [무엇이 잘못됐었나]
     요소를 appendChild 로 옮기면 DOM 에서 **뽑았다가 다시 꽂는** 것이라,
     그 순간 두 가지가 부서집니다.
       ① 초점 — 초점이 있던 채로 옮기면 브라우저가 조용히 떨어뜨립니다.
          겉보기엔 커서가 있는 것 같은데 실제로는 아무 데도 아니어서
          "그냥 안 쳐져요" 가 됩니다.
       ② 한글 조합 — 조합(ㅂ+ㅔ→베) 중에 옮기면 조합이 끊기고,
          크롬에서는 그 뒤로 IME 상태가 끼어 자모가 낱개로 풀려
          나오기도 합니다 ("베ㄹㅔ니ㅁㅣ" 의 정체로 의심).

     [고침]
     · 조합 중이면 **조합이 끝날 때까지 이사를 미룹니다.**
     · 초점이 글칸에 있었다면 이사 직후 **초점과 커서를 되살립니다.** */
  let _composing = false;
  document.addEventListener("compositionstart", (e) => {
    if (e.target?.id === "message") _composing = true;
  }, true);
  document.addEventListener("compositionend", (e) => {
    if (e.target?.id === "message") _composing = false;
  }, true);

  function moveInput(tab) {
    const 이쪽 = tab === "chatty" ? "chatty" : "chat";
    const host = el("dock-write-" + 이쪽);
    if (!host) return;

    /* 한글 조합 중이면 끝나고 나서 옮깁니다 — 지금 옮기면 글자가 깨져요 */
    if (_composing) {
      document.addEventListener("compositionend",
        () => moveInput(tab), { once: true });
      return;
    }

    const ta = el("message");
    const 초점있던 = ta && document.activeElement === ta;
    const s = 초점있던 ? ta.selectionStart : 0;
    const e2 = 초점있던 ? ta.selectionEnd : 0;

    펜.forEach(id => { const n = el(id); if (n) host.appendChild(n); });
    const ia = document.querySelector(".input-area");
    if (ia) host.appendChild(ia);

    /* 이사하느라 떨어진 초점을 제자리에 — 커서 위치까지 */
    if (초점있던) {
      try {
        ta.focus({ preventScroll: true });
        ta.setSelectionRange(s, e2);
      } catch (err) {}
    }
    /* 빈 자리 표시 — :empty 를 못 쓰는 이유는 답장 미리보기가 늘 붙어
       다녀서입니다 (감춰져 있어도 자식은 자식이라 :empty 가 아니에요) */
    ["chat", "chatty"].forEach(k => {
      const h = el("dock-write-" + k);
      if (!h) return;
      if (k === 이쪽) delete h.dataset.empty;
      else h.dataset.empty = "1";
    });
  }

  /* =====================================================================
     "그 방이 지금 보이나?" — script_chatty.js 가 물어봅니다
     ---------------------------------------------------------------------
     안 읽음을 세는 조건이 원래 "저쪽 탭이 켜져 있나" 였습니다. 칸이
     하나뿐이던 시절엔 그게 곧 "안 보인다" 였지만, 지금은 판이 따로
     떠서 **글칸이 어디 있든 판만 열려 있으면 보입니다.**

     ★ 세는 일은 저쪽이 그대로 맡습니다 — 여기서 또 세면 두 벌이 되어
       언젠가 어긋나요. 이 창구는 "보이나?" 한 마디만 답합니다.
     ===================================================================== */
  window.dockSeeing = (room) => _open.has(room === "chatty" ? "chatty" : "chat");

  /** 지금 글을 쓰는 방을 정합니다 (탭 전환 + 글칸 이사) */
  function setTab(tab) {
    const t = tab === "chatty" ? "chatty" : "main";
    if (_tab === t) return;
    _tab = t;
    window.switchChatTab?.(t);
    moveInput(t);
    syncPills();
    syncBadges();
  }
  window.dockSetTab = setTab;

  /* =====================================================================
     판 높이 늘이기 — 챗과 수다방만 (2026-08-12)
     ---------------------------------------------------------------------
     대화가 길어지면 더 보고 싶고, 조용하면 자리만 먹습니다.
     머리말 **위 가장자리**를 잡고 위로 끌면 커져요. 판은 바닥에 붙어
     자라므로 위로 끄는 것이 곧 "키우기" 입니다.

     ★ 지금 높이보다 **작아지지는 않습니다.** 더 줄이면 말풍선 두어 줄만
       남아서 읽을 수가 없어요. 두 번 누르면 원래 높이로 돌아갑니다.
     ===================================================================== */
  const H_KEY = "dockH";

  function baseH(pid) {
    const d = DOCK.find(x => x.id === pid);
    return Math.round(BASE_H * (d ? d.size : 1));
  }
  /* CSS 의 max-height 와 같은 값이어야 합니다 — 어긋나면 끌리는 대로
     안 커지고 어중간한 데서 멎어 고장 난 것처럼 보여요. */
  function maxH() {
    return Math.max(240, (window.innerHeight || 800) - 190);
  }
  function setH(pid, h) {
    const p = el("dock-panel-" + pid);
    if (!p) return;
    /* 바닥 — 보통은 기본 키 아래로 못 줄입니다(내용이 뭉개져서).
       ♪ BGM 만 예외: 영상만 남기고 줄여 두는 쓰임(작업 중 리스트가
       거슬림)이 있어서 150px 까지 내려갑니다 (2026-08-14 콩 요청) */
    const lo = pid === "music" ? 150 : baseH(pid);
    const v = Math.round(Math.max(lo, Math.min(maxH(), h)));
    p.style.setProperty("--dock-h", v + "px");
    return v;
  }
  function loadH(pid) {
    const v = Number(window.AppStore?.getItem(H_KEY + ":" + pid) || 0);
    return Number.isFinite(v) && v > 0 ? v : baseH(pid);
  }
  function saveH(pid, h) {
    try { window.AppStore?.setItem(H_KEY + ":" + pid, String(h)); } catch (e) {}
  }
  function clearH(pid) {
    try { window.AppStore?.removeItem(H_KEY + ":" + pid); } catch (e) {}
    setH(pid, baseH(pid));
  }

  /** 알약의 눌린 표시를 지금 상태에 맞춥니다 (수다방은 탭까지 봅니다) */
  function syncPills() {
    DOCK.forEach(d => {
      if (d.inline || d.modal) return;
      el("dock-pill-" + d.id)?.setAttribute(
        "aria-expanded", _open.has(panelOf(d.id)) ? "true" : "false");
      /* 지금 펜이 놓인 방에는 옅은 표시를 둡니다 — 어디로 보내지는지
         알약만 봐도 알 수 있게요. */
      if (d.tab) el("dock-pill-" + d.id)?.classList.toggle("writing", _tab === d.tab);
    });
    ["chat", "chatty"].forEach(k => {
      const p = el("dock-panel-" + k);
      if (p) p.classList.toggle("writing", _tab === (k === "chatty" ? "chatty" : "main"));
    });
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
       ★ 다만 챗·수다방은 **펜이 저쪽에 있으면 먼저 펜을 데려옵니다.**
         한 번 눌러서 아무 일도 안 일어나거나, 보려던 판이 닫혀 버리면
         둘 다 당황스러우니까요. 한 번 더 누르면 그때 닫힙니다. */
    if (_open.has(pid)) {
      if (d.tab && _tab !== d.tab) { setTab(d.tab); raise(pid); return; }
      close(pid);
      return;
    }

    const p = el("dock-panel-" + pid);
    if (!p) return;

    /* 좁은 화면이면 먼저 열려 있던 판을 접습니다 */
    if (isNarrow()) [..._open].forEach(o => { if (o !== pid) close(o); });

    /* 방금 연 방으로 펜을 옮깁니다 */
    if (d.tab) setTab(d.tab);

    p.hidden = false;
    _open.add(pid);
    if (d.resize) setH(pid, loadH(pid));       // 늘려·줄여 뒀던 키를 되살립니다
    /* 자리 — 놓아둔 곳이 있으면 거기, 없으면 제 알약 위 */
    place(pid, (d.drag && loadPos(pid)) || defaultPos(pid, id));
    raise(pid);                      // 방금 연 것이 맨 위로
    syncPills();
    document.getElementById("dock")?.setAttribute("data-open", [..._open].join(" "));

    /* 판마다 열 때 해줄 일 */
    if (pid === "achv") {
      const body = el("dock-body-achv");
      if (body && window.achvPanelHtml) body.innerHTML = window.achvPanelHtml();
      /* 제목이 두 줄이었습니다 — 판 머리말 "🏅 업적" 과 그 바로 아래
         "🏅 나의 업적". 안쪽 것은 CSS 로 감추고, 거기 붙어 있던
         **개수만** 머리말로 끌어올립니다 (11 / 49 는 아까우니까요). */
      const n = body?.querySelector(".achv-head span")?.textContent || "";
      const t = el("dock-panel-achv")?.querySelector(".dock-title");
      if (t) t.innerHTML = "🏅 업적" + (n ? ` <span class="dock-count">${n}</span>` : "");
    }
    /* 📢 공지 — **여는 일은 공지판 제 손으로** 시킵니다 (고침 2026-08-12).
       render() 는 #notice-modal 의 display 가 flex 일 때만 도는데,
       알약은 그 값을 건드리지 않아서 목록이 영영 안 그려졌습니다.
       ("아직 공지가 없어요" 도 아니고 아예 빈 칸이었어요 — 그리는
        일 자체가 없었으니까요.) 겉창은 CSS 로 감춰 뒀습니다. */
    if (pid === "notice") { window.listenNoticeBoard?.(); window.openNoticeBoard?.(); }
    /* 판을 열면 그 방은 읽은 것으로 — 쌓여 있던 숫자를 털어 냅니다.
       ★ 알약의 배지만 지우면 안 됩니다. 숫자는 script_chatty.js 가
         들고 있어서, 판을 닫는 순간 옛 숫자가 도로 올라와요. */
    if (pid === "chat")   { window.markChatRead?.("main");   window.scrollChatToBottom?.(true); }
    if (pid === "chatty") { window.markChatRead?.("chatty"); window.scrollChattyToBottom?.(); }
    if (pid === "pub")    window.openPubReview?.();
    if (pid === "help")   window.openHelp?.();
    if (pid === "files")  window.openFiles?.();

    /* 보고 있는 동안에는 표시를 지웁니다 */
    badge(id, 0);
    dot(id, false);
    if (NEW_BOARDS.indexOf(id) >= 0) 봤다(id, _newAt[id] || Date.now());
  }

  /** 하나만 닫기 — **판** id 를 받습니다 */
  function close(id) {
    const pid = panelOf(id);
    const p = el("dock-panel-" + pid);
    if (p) p.hidden = true;
    if (pid === "notice") window.closeNoticeBoard?.();
    setTimeout(syncBadges, 0);      // 닫으면 다시 쌓이기 시작합니다
    _open.delete(pid);
    /* ✍️ 펜이 놓여 있던 판을 닫으면 펜은 다른 방으로 옮겨 둡니다 —
       안 그러면 글칸이 감춰진 판에 갇혀 아무 데도 못 씁니다. */
    if (pid === "chatty" && _tab === "chatty") setTab("main");
    if (pid === "chat" && _tab === "main" && _open.has("chatty")) setTab("chatty");
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
     🔴 새 글 빨간 점 — 🏢 출판사 품평 · 🆘 살려주세요 · ♪ BGM (2026-08-17)
     ---------------------------------------------------------------------
     [무엇을 하나] 공지처럼, 안 본 새 글이 있으면 알약에 붉은 점이 뜹니다.
     판을 열면 사라져요. 개수는 세지 않습니다 — 게시판은 "몇 개" 보다
     "새 게 있나" 가 궁금한 자리라, 숫자는 도리어 부담이 됩니다.

     [★ 왜 게시판을 통째로 구독하지 않았나 — 여기가 핵심입니다]
     가장 쉬운 길은 세 게시판을 입장할 때부터 듣게 하는 것이었습니다.
     그런데 품평(pubreview)과 살려주세요(help)는 **판을 열 때에만**
     듣도록 일부러 그렇게 짜 두었어요. 안 여는 사람에게는 한 글자도
     안 보내려고요. 점 하나 띄우자고 이걸 풀면, 방에 들어온 **모든**
     사람이 매번 게시판 전체를 내려받습니다. 8월에 통신량이 15일 만에
     4.87GB 까지 갔던 걸 생각하면 그 반대로 가야 합니다.

     [그래서 — 표식만 봅니다]
     newmark/{게시판} 에 **마지막으로 글이 올라온 시각(숫자 하나)** 만
     적습니다. 셋을 다 합쳐 60바이트 남짓이에요. 글이 올라올 때마다
     이 숫자만 오갑니다. 글 내용은 판을 열 때 받는 그대로고요.
     ★ limitToLast(1) 로 해결하려다 접었습니다 — 품평은
       pubreview/{출판사}/{글} 로 한 겹 깊어서 자식이 글이 아니라
       출판사 묶음이고, help 는 .indexOn 없이 정렬하면 **전부**
       내려받은 뒤 브라우저에서 고릅니다. 아낀 게 없어져요.

     [처음 온 기기]
     본 적 없는 기기에 점 세 개가 켜져 있으면 반가운 게 아니라 숙제입니다.
     기억이 없으면 "지금까지는 다 본 것" 으로 치고 조용히 시작해요.
     ===================================================================== */
  const NEW_BOARDS = ["pub", "help", "music"];
  const SEEN_KEY = (id) => "dockSeen:" + id;
  const _newAt = {};

  function 본시각(id) {
    const v = window.AppStore?.getItem(SEEN_KEY(id));
    return (v == null || v === "") ? null : (Number(v) || 0);
  }
  function 봤다(id, at) {
    try { window.AppStore?.setItem(SEEN_KEY(id), String(Number(at) || 0)); } catch (e) {}
  }
  function 새글표시(id) {
    const at = Number(_newAt[id]) || 0;
    /* 판을 보고 있으면 곧 읽은 것입니다 — 보는 앞에서 점이 켜지면 이상해요 */
    if (_open.has(panelOf(id))) { 봤다(id, at); dot(id, false); return; }
    const 본 = 본시각(id);
    if (본 === null) { 봤다(id, at); dot(id, false); return; }   // 처음 온 기기
    dot(id, at > 본);
  }

  /** 글을 올린 쪽에서 부릅니다 — "여기 새 글" 이라고 표식만 찍어요 */
  window.dockMarkNew = function (board) {
    if (NEW_BOARDS.indexOf(board) < 0) return;
    _newAt[board] = Date.now();
    /* 내가 올린 글로 내 점이 켜지면 안 되니, 내 쪽은 먼저 본 것으로 */
    봤다(board, _newAt[board]);
    dot(board, false);
    try { window.db?.ref("newmark/" + board).set(_newAt[board]); } catch (e) {}
  };

  /** 표식 듣기 — 입장한 뒤에 한 번 부릅니다 (script_core.js) */
  window.dockWatchNew = function () {
    if (!window.db || window._dockNewOn) return;
    window._dockNewOn = true;
    window.db.ref("newmark").on("value", snap => {
      const v = snap.val() || {};
      NEW_BOARDS.forEach(id => { _newAt[id] = Number(v[id]) || 0; 새글표시(id); });
    }, err => console.warn("[새 글 표식] 못 받아왔어요", err));
  };

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
    /* ★ 판이 떠 있으면 대화가 보이는 것이니 곧 읽은 것입니다.
         펜이 저쪽에 있어도 눈은 여기 있으니까요. */
    badge("chat",   _open.has("chat")   ? 0 : 읽기("chat-tab-badge-main"));
    badge("chatty", _open.has("chatty") ? 0 : 읽기("chat-tab-badge-chatty"));
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

  /* =====================================================================
     위 가장자리를 잡고 키우기 (챗 · 수다방)
     ---------------------------------------------------------------------
     ★ 지금 높이보다 작아지지 않습니다. 아래로 끌어도 제자리에서 멈춰요.
     ★ 늘린 키는 이 기기에 남습니다. 두 번 누르면 원래대로.
     ===================================================================== */
  let _grip = null;

  function bindResize() {
    document.addEventListener("pointerdown", (e) => {
      const g = e.target.closest?.("[data-dock-grip]");
      if (!g) return;
      const pid = g.dataset.dockGrip;
      const p = el("dock-panel-" + pid);
      if (!p) return;
      /* ★ 여기도 자를 맞춥니다 — 잰 값(화면)과 넣을 값(요소)이 다릅니다.
         안 맞추면 95% 에서 판을 잡는 순간 5% 쪼그라듭니다. */
      _grip = { pid, y: e.clientY, h: p.getBoundingClientRect().height / Z() };
      p.classList.add("resizing");
      g.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });

    document.addEventListener("pointermove", (e) => {
      if (!_grip) return;
      /* 위로 끌수록(=clientY 가 작아질수록) 커집니다.
         마우스가 움직인 거리도 화면 값이라 요소 기준으로 바꿔 줍니다 */
      setH(_grip.pid, _grip.h + (_grip.y - e.clientY) / Z());
    });

    const 놓기 = () => {
      if (!_grip) return;
      const p = el("dock-panel-" + _grip.pid);
      p?.classList.remove("resizing");
      const h = Math.round((p?.getBoundingClientRect().height || 0) / Z());
      if (h) saveH(_grip.pid, h);
      _grip = null;
    };
    document.addEventListener("pointerup", 놓기);
    document.addEventListener("pointercancel", 놓기);

    document.addEventListener("dblclick", (e) => {
      const g = e.target.closest?.("[data-dock-grip]");
      if (g) clearH(g.dataset.dockGrip);
    });
  }

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
      const z = Z();
      _drag = {
        id, panel,
        dx: (e.clientX - r.left) / z,
        dy: (r.bottom - e.clientY) / z,
        hostLeft: host.left / z, hostBottom: host.bottom / z
      };
      panel.classList.add("dragging");
      head.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });

    document.addEventListener("pointermove", (e) => {
      if (!_drag) return;
      const z = Z();
      place(_drag.id, {
        x: e.clientX / z - _drag.dx - _drag.hostLeft,
        y: _drag.hostBottom - (e.clientY / z + _drag.dy)
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

    /* ♪ BGM 알약만 더블클릭이 있습니다 — 두 번 누르면 재생/일시정지.
       더블클릭은 클릭 두 번이라 그냥 걸면 판이 열렸다 닫히며 깜빡여요.
       그래서 이 알약만 250ms 기다렸다가 "한 번이면 열기"를 실행합니다.
       (음악이 없을 때는 기다릴 이유가 없으니 바로 엽니다) */
    let _musicClickTimer = null;
    document.addEventListener("click", (e) => {
      const pill = e.target.closest("[data-dock]");
      if (pill) {
        const id = pill.dataset.dock;
        if (id === "music" && window.musicHasPlayer?.()) {
          if (_musicClickTimer) {                      // 두 번째 클릭 — 일시정지 토글
            clearTimeout(_musicClickTimer);
            _musicClickTimer = null;
            window.musicTogglePlay?.();
            return;
          }
          _musicClickTimer = setTimeout(() => {        // 한 번뿐이면 — 열기
            _musicClickTimer = null;
            open(id);
          }, 250);
          return;
        }
        open(id);
        return;
      }

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

    /* ✍️ 누른 판이 곧 쓰는 방 — 판 안을 누르면 글칸이 그리로 옵니다.
       ★ ✕ 위에서는 안 됩니다 (닫으려는 것이니까요)
       ★ 지금 글칸을 만지는 중이면 옮기지 않습니다 — 제자리 클릭이라 */
    document.addEventListener("pointerdown", (e) => {
      if (e.target.closest?.("[data-dock-close], [data-dock-grip]")) return;
      const p = e.target.closest?.("#dock-panel-chat, #dock-panel-chatty");
      if (!p) return;
      setTab(p.id === "dock-panel-chatty" ? "chatty" : "main");
    }, true);

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
    bindResize();
    watchBadges();
    syncPills();
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
