/* =====================================================================
   script_layout.js — 칸 배치 (자리 바꾸기 · 비우기 · 각자 크기 조절)
   ---------------------------------------------------------------------
   [왜 구조를 바꿨나]

   예전에는 화면 전체를 하나의 큰 격자(CSS Grid)로 짰습니다. 격자는
   세로선·가로선을 열과 행이 통째로 공유하기 때문에, 손잡이를 끌면
   그 선이 화면 끝에서 끝까지 한 번에 움직였습니다.
   (주황 캡처가 그 모습입니다)

   원하시는 건 "칸과 칸 사이마다 따로 노는 손잡이"였습니다.
   그래서 격자를 버리고 **둘로 쪼개기(split)를 겹쳐 쌓는 방식**으로
   바꿨습니다. 각 쪼갬은 자기 안에서만 크기를 나누므로, 손잡이가
   서로를 간섭하지 않습니다.

     가로 보기 :  가로쪼갬( ①  ②  세로쪼갬(③ ④ ⑤) )
     세로 보기 :  세로쪼갬( 가로쪼갬(① ②)
                            가로쪼갬(③ 세로쪼갬(④ ⑤)) )

   자리를 비우면 그 가지를 통째로 떼어냅니다. 가지가 하나만 남으면
   쪼갬 자체가 사라지고 남은 가지가 그 자리를 다 씁니다.
   → 빈 칸도, 남는 손잡이도 생기지 않습니다.

   저장은 이 기기에만. 가로 보기와 세로 보기를 따로 기억합니다.
   ===================================================================== */

(function () {

  /* ---------------------------------------------------------------
     [1] 창과 자리
     --------------------------------------------------------------- */
  /* TheMagam 은 세 칸 고정입니다.
     오늘 목표·상태·투두는 창이 아니라 프로필 편집 팝업 안으로 들어갔습니다. */
  const PANELS = [
    { id: "prof", label: "👥 접속자",   icon: "👥", sel: ".cards-area"   },
    { id: "pomo", label: "🍅 뽀모도로", icon: "🍅", sel: "#pomo-block"   },
    { id: "chat", label: "💬 채팅",     icon: "💬", sel: ".chat-sidebar" }
  ];
  const PANEL_IDS = PANELS.map(p => p.id);
  const SLOT_IDS  = ["s1", "s2", "s3"];

  const SLOT_LABELS = {
    landscape: { s1: "왼쪽", s2: "오른쪽 위", s3: "오른쪽 아래" },
    portrait:  { s1: "위",   s2: "가운데",    s3: "아래" }
  };

  const DEFAULT_MAP = {
    landscape: { s1: "prof", s2: "pomo", s3: "chat" },
    portrait:  { s1: "prof", s2: "pomo", s3: "chat" }
  };

  const KEY  = { landscape: "tmSlotLand", portrait: "tmSlotPort" };
  /* 저장 키에 2를 붙인 이유 — 세로 보기의 쪼개는 순서가 바뀌면서
     "portrait/0" 같은 키의 뜻이 달라졌습니다(예전엔 위쪽 높이, 지금은 왼쪽 폭).
     예전 값을 그대로 쓰면 엉뚱한 크기가 들어가므로 새 키로 시작합니다. */
  const SKEY = { landscape: "tmSizeLand", portrait: "tmSizePort" };

  /* ---------------------------------------------------------------
     [2] 배치 나무 — 어떤 자리를 어떻게 쪼갤지
     ---------------------------------------------------------------
       h : 가로로 쪼갬(좌우)   v : 세로로 쪼갬(위아래)
       각 가지는 자리 이름이거나, 또 다른 쪼갬입니다.
     --------------------------------------------------------------- */
  /* 왼쪽에 접속자, 오른쪽 줄을 위아래로 갈라 뽀모와 채팅.
     세로 화면에서는 위아래로 뒤집습니다. */
  const TREES = {
    landscape: { dir: "h", kids: ["s1", { dir: "v", kids: ["s2", "s3"] }] },
    portrait:  { dir: "v", kids: ["s1", { dir: "v", kids: ["s2", "s3"] }] }
  };

  /* 처음 열었을 때의 크기 (px). 마지막 가지는 남는 만큼 차지합니다. */
  const DEFAULT_SIZE = {
    "landscape/0":   760,   // 접속자 칸 폭
    "landscape/1/0": 150,   // 뽀모 높이
    "portrait/0":    460,   // 접속자 높이
    "portrait/1/0":  150    // 뽀모 높이
  };

  const MIN_PX = 120;        // 어떤 칸도 이보다 작아지지 않습니다

  /* ---------------------------------------------------------------
     [3] 저장값 다듬기
     --------------------------------------------------------------- */
  function normalizeSlotMap(raw, orient) {
    const out = {};
    const used = new Set();
    for (const slot of SLOT_IDS) {
      const v = raw && raw[slot];
      if (PANEL_IDS.includes(v) && !used.has(v)) { out[slot] = v; used.add(v); }
      else out[slot] = null;
    }
    if (!used.size) return { ...DEFAULT_MAP[orient] };
    return out;
  }

  function loadSlotMap(orient) {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY[orient]) || "null"); } catch (e) {}
    if (!raw) return { ...DEFAULT_MAP[orient] };
    return normalizeSlotMap(raw, orient);
  }
  function saveSlotMap(orient, map) {
    try { localStorage.setItem(KEY[orient], JSON.stringify(map)); } catch (e) {}
  }

  function loadSizes(orient) {
    try { return JSON.parse(localStorage.getItem(SKEY[orient]) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveSizes(orient, sizes) {
    try { localStorage.setItem(SKEY[orient], JSON.stringify(sizes)); } catch (e) {}
  }

  /* ---------------------------------------------------------------
     [4] 나무 가지치기 — 비운 자리를 떼어냅니다
     ---------------------------------------------------------------
     가지가 하나만 남으면 쪼갬을 없애고 그 가지를 그대로 올립니다.
     그래서 손잡이가 혼자 남거나 빈 칸이 생기는 일이 없습니다.
     --------------------------------------------------------------- */
  function prune(node, map) {
    if (typeof node === "string") return map[node] ? node : null;

    const kids = node.kids.map(k => prune(k, map)).filter(Boolean);
    if (kids.length === 0) return null;
    if (kids.length === 1) return kids[0];
    return { dir: node.dir, kids };
  }

  /** 가지의 저장 키 — 원래 나무에서의 위치로 매깁니다(가지치기와 무관하게 유지) */
  function pathOf(orient, node, target, path) {
    if (node === target) return path;
    if (typeof node === "string") return null;
    for (let i = 0; i < node.kids.length; i++) {
      const r = pathOf(orient, node.kids[i], target, path + "/" + i);
      if (r) return r;
    }
    return null;
  }

  /* ---------------------------------------------------------------
     [5] 화면 만들기
     --------------------------------------------------------------- */
  function currentOrient() {
    return (window.currentOrientation && window.currentOrientation() === "portrait")
      ? "portrait" : "landscape";
  }

  function panelEl(slotId, map) {
    const pid = map[slotId];
    if (!pid) return null;
    const p = PANELS.find(x => x.id === pid);
    return document.querySelector(p.sel);
  }

  /** 가지치기한 나무를 실제 DOM으로 만듭니다 */
  function buildDom(node, orient, map, sizes, keyPrefix) {
    if (typeof node === "string") {
      const el = panelEl(node, map);
      if (el) {
        el.classList.remove("panel-off");
        el.style.gridArea = "";
        el.dataset.slot = node;
      }
      return el;
    }

    const box = document.createElement("div");
    box.className = "split split-" + node.dir;

    node.kids.forEach((kid, i) => {
      const child = buildDom(kid, orient, map, sizes, keyPrefix + "/" + i);
      if (!child) return;

      /* 채팅을 접었으면 그 칸만 레일 폭으로 좁힙니다.
         (자리를 어디로 옮겼든 "채팅이 있는 칸"이 좁혀집니다) */
      const isCollapsedChat =
        typeof kid === "string" && map[kid] === "chat" &&
        document.body.classList.contains("chat-collapsed");

      const last = (i === node.kids.length - 1);
      if (isCollapsedChat) {
        child.style.flex = "0 0 46px";
        child.style.minWidth = "0";
        child.style.minHeight = "0";
      } else if (last) {
        // 마지막 가지는 남는 공간을 다 차지합니다
        child.style.flex = "1 1 0";
        child.style.minWidth = "0";
        child.style.minHeight = "0";
      } else {
        const key = keyPrefix + "/" + i;
        const px = Math.max(MIN_PX, Number(sizes[key] ?? DEFAULT_SIZE[key] ?? 260));

        /* [FIX] 예전엔 flex: 0 0 <크기> 로 못 박았습니다. 그래서 저장된
           크기의 합이 화면보다 크면, 뒤쪽 칸이 밀려나 아예 안 보였습니다.
           (세로 보기에서 창 몇 개가 사라진 원인)

           0 1 <크기> 로 두면 자리가 모자랄 때 서로 조금씩 양보하며
           줄어듭니다. 최소 크기는 아래에서 따로 잡아줍니다. */
        child.style.flex = "0 1 " + px + "px";
        if (node.dir === "h") {
          child.style.minWidth = MIN_PX + "px";
          child.style.minHeight = "0";
        } else {
          child.style.minHeight = MIN_PX + "px";
          child.style.minWidth = "0";
        }
      }
      box.appendChild(child);

      if (!last) {
        // 이 가지와 다음 가지 사이의 손잡이
        const grip = document.createElement("div");
        grip.className = "split-grip " + (node.dir === "h" ? "grip-v" : "grip-h");
        grip.dataset.key = keyPrefix + "/" + i;
        grip.dataset.dir = node.dir;
        grip.tabIndex = 0;
        grip.setAttribute("role", "separator");
        grip.setAttribute("aria-orientation", node.dir === "h" ? "vertical" : "horizontal");
        grip.title = "끌어서 칸 크기 조절 · 더블클릭하면 기본값";
        grip.innerHTML = "<span></span>";
        box.appendChild(grip);
      }
    });

    return box;
  }

  let _lastSignature = "";

  /* ---------------------------------------------------------------
     좁은 화면 — 창 하나만 보여주고 탭으로 넘나듭니다

     폭이 좁으면 다섯 칸을 나눠도 아무것도 못 읽습니다. 그래서 한 창만
     띄우는데, 예전엔 그게 늘 채팅으로 못박혀 있었습니다. 폰으로 들어온
     분은 오늘 목표를 적을 방법이 아예 없었죠.

     이제 위쪽 탭으로 골라서 넘나들 수 있고, 처음에 열릴 창은 설정에서
     정합니다. 쪼갬 나무를 건드리지 않고, 고른 창 하나만 뿌리에 직접
     넣습니다 — 칸 나누기·손잡이 계산을 전부 건너뛰니 훨씬 단단합니다.
     --------------------------------------------------------------- */
  const NARROW_KEY  = "narrowPanel";     // 기본으로 열릴 창
  const NARROW_CUR  = "narrowPanelCur";  // 마지막으로 보던 창

  function narrowDefault() {
    const v = localStorage.getItem(NARROW_KEY);
    return PANEL_IDS.includes(v) ? v : "chat";
  }
  function narrowCurrent() {
    const v = localStorage.getItem(NARROW_CUR);
    return PANEL_IDS.includes(v) ? v : narrowDefault();
  }
  function isNarrow() {
    return document.body.classList.contains("narrow-chat-focus");
  }
  window.narrowDefault = narrowDefault;
  window.setNarrowDefault = function (id) {
    if (!PANEL_IDS.includes(id)) return;
    localStorage.setItem(NARROW_KEY, id);
    /* 기본값을 바꾸면 지금 보는 것도 그리로 옮깁니다.
       설정에서 고르자마자 화면이 안 바뀌면 안 먹힌 줄 알게 되니까요. */
    localStorage.setItem(NARROW_CUR, id);
    if (isNarrow()) applyLayout(true);
  };

  function setNarrowPanel(id) {
    if (!PANEL_IDS.includes(id)) return;
    localStorage.setItem(NARROW_CUR, id);
    applyLayout(true);
    if (id === "chat") setTimeout(() => window.scrollChatToBottom?.(true), 60);
  }
  window.setNarrowPanel = setNarrowPanel;

  /* 좁은 화면에서 채팅을 안 보고 있을 때 쌓인 개수.
     접어둔 채팅의 레일 배지와 같은 발상인데, 좁은 화면에는 레일이
     아예 없어서 따로 셉니다. */
  let _narrowUnread = 0;

  function renderNarrowBadge() {
    const el = document.querySelector('[data-narrow-tab="chat"] .nt-badge');
    if (!el) return;
    const n = _narrowUnread;
    el.textContent = n > 99 ? "99+" : String(n);
    el.classList.toggle("hidden", n <= 0);
  }

  /** 새 메시지가 왔을 때 (script_profile.js 가 부릅니다) */
  window.noteNarrowChatUnread = function () {
    if (!isNarrow()) return;            // 넓은 화면이면 채팅이 보이고 있습니다
    if (narrowCurrent() === "chat") return;
    _narrowUnread += 1;
    renderNarrowBadge();
  };

  /** 좁은 화면 탭줄 — 없으면 만들고, 활성 표시만 갱신합니다 */
  function renderNarrowTabs(active) {
    const container = document.querySelector(".container");
    const root = document.getElementById("split-root");
    if (!container || !root) return;

    let bar = document.getElementById("narrow-tabs");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "narrow-tabs";
      bar.className = "narrow-tabs";
      bar.setAttribute("role", "tablist");
      bar.setAttribute("aria-label", "볼 창 고르기");
      bar.innerHTML = PANELS.map(p => `
        <button type="button" class="narrow-tab" role="tab" data-narrow-tab="${p.id}"
                title="${p.label}" aria-label="${p.label}">
          <span class="nt-ico" aria-hidden="true">${p.icon}</span>
          ${p.id === "chat" ? '<span class="nt-badge hidden" aria-live="polite">0</span>' : ""}
        </button>`).join("") + `
        <button type="button" class="narrow-tab nt-exit" data-narrow-exit
                title="나가기" aria-label="나가기"><span class="nt-ico" aria-hidden="true">🚪</span></button>`;
      bar.addEventListener("click", (e) => {
        /* 폰에는 머리말이 없어서 나가기 버튼이 아예 안 보였습니다.
           그냥 창을 닫으면 서버가 눈치채는 데 시간이 걸려서, 남들 화면에
           한동안 남습니다. 여기에 두면 제대로 인사하고 나갈 수 있어요. */
        if (e.target.closest("[data-narrow-exit]")) {
          try { window.leaveRoom?.(); } catch (err) {}
          return;
        }
        const b = e.target.closest("[data-narrow-tab]");
        if (b) setNarrowPanel(b.dataset.narrowTab);
      });
      container.insertBefore(bar, root);
    }
    bar.querySelectorAll("[data-narrow-tab]").forEach(b => {
      const on = b.dataset.narrowTab === active;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function applyLayout(force) {
    const root = document.getElementById("split-root");
    if (!root) return;

    const orient = currentOrient();
    const chatRight = document.body.classList.contains("chat-right");
    const map = loadSlotMap(orient);
    const sizes = loadSizes(orient);

    // 같은 상태면 다시 만들지 않습니다 (화면 깜빡임 방지)
    /* 좁은 화면 여부와 지금 보는 창도 서명에 넣습니다.
       안 넣으면 탭을 눌러도 "같은 상태"로 보고 그냥 돌아갑니다. */
    const sig = JSON.stringify([orient, chatRight, map,
                                isNarrow(), isNarrow() ? narrowCurrent() : null]);
    if (!force && sig === _lastSignature) { syncSizes(); return; }
    _lastSignature = sig;

    let tree = prune(TREES[orient], map);

    /* [중요] 다시 조립하기 전에, 창들을 먼저 보관함으로 옮깁니다.

       예전엔 여기서 곧장 뿌리를 통째로 비웠는데, 그러면 안에 있던
       채팅·프로필·투두 같은 창이 통째로 삭제됐습니다. 그 뒤 다시 찾으려 해도
       이미 문서에 없으니 화면이 텅 비고, 입장 과정에서 오류가 났습니다.
       (#chat-box 가 사라지니 채팅을 그릴 수 없었습니다)

       보관함으로 먼저 피신시켜 두면 지워지지 않고, 필요한 것만 도로
       꺼내 쓸 수 있습니다. */
    const attic = document.getElementById("panel-attic");
    const rail0 = document.getElementById("chat-rail");
    if (attic) {
      for (const p of PANELS) {
        document.querySelectorAll(p.sel).forEach(el => attic.appendChild(el));
      }
      if (rail0) attic.appendChild(rail0);
    }

    // 치워둔 창은 보관함에 남겨둡니다
    const shown = new Set(Object.values(map).filter(Boolean));
    for (const p of PANELS) {
      if (shown.has(p.id)) continue;
      document.querySelectorAll(p.sel).forEach(el => el.classList.add("panel-off"));
    }

    /* 좁은 화면 — 고른 창 하나만 */
    if (isNarrow()) {
      const want = narrowCurrent();
      const p = PANELS.find(x => x.id === want) || PANELS[0];
      const el = document.querySelector(p.sel);

      root.innerHTML = "";
      root.classList.remove("flip");
      if (el) {
        el.classList.remove("panel-off");
        el.style.flex = "1 1 auto";
        root.appendChild(el);
      }
      /* 채팅을 열면 쌓인 개수를 지웁니다 */
      if (p.id === "chat") _narrowUnread = 0;
      renderNarrowTabs(p.id);
      renderNarrowBadge();
      renderHiddenChips(map);
      renderSlotMap();
      renderSlotPicker();
      return;
    }

    /* 넓은 화면으로 돌아오면 좁은 화면에서 준 인라인 크기를 지웁니다 */
    for (const p of PANELS) {
      document.querySelectorAll(p.sel).forEach(el => { el.style.flex = ""; });
    }
    document.getElementById("narrow-tabs")?.remove();

    root.innerHTML = "";
    if (tree) {
      const dom = buildDom(tree, orient, map, sizes, orient);
      dom.style.flex = "1 1 auto";
      root.appendChild(dom);
    }
    root.classList.toggle("flip", chatRight);

    // 채팅 레일은 채팅 옆에 붙어 다닙니다
    const rail = document.getElementById("chat-rail");
    const chatEl = document.querySelector(".chat-sidebar");
    if (rail && chatEl && chatEl.parentNode) {
      chatEl.parentNode.insertBefore(rail, chatEl);
      rail.style.flex = "0 0 auto";
    }

    renderHiddenChips(map);
    renderSlotMap();
    renderSlotPicker();
    bindGrips();
  }

  /** 크기만 다시 반영 (구조는 그대로) */
  function syncSizes() {
    const orient = currentOrient();
    const sizes = loadSizes(orient);
    document.querySelectorAll("#split-root .split > *").forEach(el => {
      if (el.classList.contains("split-grip")) return;
    });
    void sizes;
  }

  /* ---------------------------------------------------------------
     [6] 손잡이 끌기 — 자기 앞 가지의 크기만 바꿉니다
     --------------------------------------------------------------- */
  /* ---------------------------------------------------------------
     [6] 손잡이 끌기 — 자기 앞 가지의 크기만 바꿉니다
     ---------------------------------------------------------------
     [FIX] 채팅 글자가 선택되지 않던 문제

     예전에는 쪼갬 뿌리(#split-root) 전체에 pointerdown 을 걸고 그 안에서
     "손잡이인지" 가려냈습니다. 뿌리 안에는 채팅·입력칸이 전부 들어 있어서,
     이 방식은 채팅 쪽 입력을 방해할 여지가 있었습니다.

     이제 이벤트를 손잡이 요소 자신에게만 겁니다. 채팅 영역에는 아무
     리스너도 걸리지 않으므로 글자 선택·복사·붙여넣기가 방해받지 않습니다.
     끄는 동안에만 body 에 표시를 달아 선택을 잠시 막고, 놓으면 바로 풉니다.
     --------------------------------------------------------------- */
  let _drag = null;

  function endDrag() {
    if (!_drag) return;
    try { _drag.grip.releasePointerCapture?.(_drag.pointerId); } catch (e) {}
    _drag.grip.classList.remove("dragging");
    document.body.classList.remove("split-dragging");
    _drag = null;
  }

  function onDragMove(e) {
    if (!_drag) return;
    const now = _drag.horiz ? e.clientX : e.clientY;
    setSize(_drag.key, _drag.startPx + (now - _drag.start) * _drag.sign, _drag.prev, _drag.horiz);
  }

  /* 끌기 중의 움직임·놓기는 문서에서 받습니다.
     창 밖에서 손을 떼도 붙잡힌 채로 남지 않게 하려는 것입니다. */
  if (!window._splitDragBound) {
    window._splitDragBound = true;
    document.addEventListener("pointermove", onDragMove);
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
    window.addEventListener("blur", endDrag);
    document.addEventListener("visibilitychange", () => { if (document.hidden) endDrag(); });
  }

  function bindGrip(grip) {
    grip.addEventListener("pointerdown", (e) => {
      const prev = grip.previousElementSibling;
      if (!prev) return;

      const horiz = grip.dataset.dir === "h";
      _drag = {
        grip, prev, horiz,
        key: grip.dataset.key,
        pointerId: e.pointerId,
        start: horiz ? e.clientX : e.clientY,
        startPx: horiz ? prev.getBoundingClientRect().width
                       : prev.getBoundingClientRect().height,
        sign: (horiz && document.body.classList.contains("chat-right")) ? -1 : 1
      };
      grip.classList.add("dragging");
      document.body.classList.add("split-dragging");
      grip.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });

    grip.addEventListener("dblclick", (e) => {
      e.preventDefault();
      const prev = grip.previousElementSibling;
      if (!prev) return;
      const def = DEFAULT_SIZE[grip.dataset.key] ?? 260;
      setSize(grip.dataset.key, def, prev, grip.dataset.dir === "h");
    });

    grip.addEventListener("keydown", (e) => {
      const horiz = grip.dataset.dir === "h";
      const keys = horiz ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
      if (!keys.includes(e.key)) return;
      e.preventDefault();

      const prev = grip.previousElementSibling;
      if (!prev) return;
      const cur = horiz ? prev.getBoundingClientRect().width
                        : prev.getBoundingClientRect().height;
      const dir = (e.key === "ArrowRight" || e.key === "ArrowDown") ? 1 : -1;
      setSize(grip.dataset.key, cur + dir * (e.shiftKey ? 32 : 10), prev, horiz);
    });
  }

  function bindGrips() {
    document.querySelectorAll("#split-root .split-grip").forEach(g => {
      if (g._bound) return;
      g._bound = true;
      bindGrip(g);
    });
  }

  function setSize(key, px, el, horiz) {
    // 이 쪼갬 안에서 쓸 수 있는 전체 크기
    const box = el.parentElement;
    const total = horiz ? box.clientWidth : box.clientHeight;
    // 뒤에 오는 가지들도 최소 크기는 확보해야 합니다
    const others = [...box.children].filter(c => c !== el && !c.classList.contains("split-grip"));
    const max = Math.max(MIN_PX, total - others.length * MIN_PX - 20);

    const next = Math.round(Math.max(MIN_PX, Math.min(max, px)));
    el.style.flex = "0 0 " + next + "px";

    const orient = currentOrient();
    const sizes = loadSizes(orient);
    sizes[key] = next;
    saveSizes(orient, sizes);
  }

  function resetSizes() {
    const orient = currentOrient();
    saveSizes(orient, {});
    applyLayout(true);
  }

  /* ---------------------------------------------------------------
     [7] 치운 창 되돌리기
     --------------------------------------------------------------- */
  function renderHiddenChips(map) {
    const host = document.getElementById("hidden-panels");
    if (!host) return;
    const shown = new Set(Object.values(map).filter(Boolean));
    const hidden = PANELS.filter(p => !shown.has(p.id));

    host.classList.toggle("hidden", hidden.length === 0);
    host.innerHTML = hidden.map(p => `
      <button type="button" class="hidden-chip" data-restore="${p.id}"
              title="${p.label} 다시 열기" aria-label="${p.label} 다시 열기">
        <span aria-hidden="true">${p.icon}</span>
      </button>
    `).join("");
  }

  function restorePanel(pid) {
    const orient = currentOrient();
    const map = loadSlotMap(orient);
    let target = SLOT_IDS.find(s => !map[s]) || SLOT_IDS[SLOT_IDS.length - 1];
    for (const s of SLOT_IDS) if (map[s] === pid) map[s] = null;
    map[target] = pid;
    saveSlotMap(orient, map);
    applyLayout(true);
  }

  /* ---------------------------------------------------------------
     [8] 설정 — 자리 그림과 목록
     --------------------------------------------------------------- */
  /* 실제 화면 모양을 그대로 축소한 그림.
     세로 보기는 세로로 길쭉하게 세워야 "세로 모니터"라는 게 눈에 들어옵니다. */
  const MAP_SHAPE = {
    landscape: "height:150px; max-width:100%;" +
               "grid-template-columns: 0.9fr 1.5fr 1fr; grid-template-rows: 1fr 1fr 1fr;" +
               "grid-template-areas:'s1 s2 s3' 's1 s2 s4' 's1 s2 s5';",
    portrait:  "height:300px; max-width:230px; margin-left:auto; margin-right:auto;" +
               "grid-template-columns: 1fr 1.05fr; grid-template-rows: 1.2fr 1fr 1fr;" +
               "grid-template-areas:'s1 s2' 's3 s4' 's3 s5';"
  };

  function renderSlotMap() {
    const host = document.getElementById("slot-map");
    if (!host) return;
    const orient = currentOrient();
    const map = loadSlotMap(orient);
    const labels = SLOT_LABELS[orient];
    const flip = document.body.classList.contains("chat-right");

    host.setAttribute("style", MAP_SHAPE[orient] + (flip ? "direction:rtl;" : ""));
    host.innerHTML = SLOT_IDS.map((slot, i) => {
      const p = PANELS.find(x => x.id === map[slot]);
      return `<div class="slot-cell${p ? "" : " empty"}" style="grid-area:${slot};direction:ltr">
                <span class="slot-cell-head">
                  <span class="slot-no">${i + 1}</span>
                  <span class="slot-cell-name">${p ? p.label : "비움"}</span>
                </span>
                <span class="slot-cell-pos">${labels[slot]}</span>
              </div>`;
    }).join("");
  }

  function renderSlotPicker() {
    const host = document.getElementById("slot-picker");
    if (!host) return;
    const orient = currentOrient();
    const map = loadSlotMap(orient);
    const labels = SLOT_LABELS[orient];

    host.innerHTML = SLOT_IDS.map((slot, i) => `
      <div class="slot-row">
        <label class="slot-name" for="slot-${slot}">
          <span class="slot-no">${i + 1}</span>${labels[slot]}
        </label>
        <select class="slot-sel" id="slot-${slot}" data-slot="${slot}">
          <option value=""${map[slot] ? "" : " selected"}>— 비우기 —</option>
          ${PANELS.map(p => `
            <option value="${p.id}"${map[slot] === p.id ? " selected" : ""}>${p.label}</option>
          `).join("")}
        </select>
      </div>
    `).join("");
  }

  /** 이미 다른 자리에 있는 창을 고르면 서로 맞바꿉니다 */
  function assignSlot(slot, panelId) {
    const orient = currentOrient();
    const map = loadSlotMap(orient);

    if (!panelId) {
      map[slot] = null;
    } else {
      const from = SLOT_IDS.find(s => map[s] === panelId);
      if (from && from !== slot) {
        const tmp = map[slot];
        map[slot] = panelId;
        map[from] = tmp;
      } else {
        map[slot] = panelId;
      }
    }
    saveSlotMap(orient, map);
    applyLayout(true);
  }

  function resetSlotMap() {
    const orient = currentOrient();
    saveSlotMap(orient, { ...DEFAULT_MAP[orient] });
    saveSizes(orient, {});
    applyLayout(true);
  }

  /* ---------------------------------------------------------------
     [9] 이벤트 — 설정 창은 클릭이 위로 못 올라가므로 안쪽에 답니다
     --------------------------------------------------------------- */
  function bindLayoutUI() {
    const picker = document.getElementById("slot-picker");
    if (picker && !picker._bound) {
      picker._bound = true;
      picker.addEventListener("change", (e) => {
        const sel = e.target.closest("[data-slot]");
        if (sel) assignSlot(sel.dataset.slot, sel.value);
      });
    }
    const rst = document.getElementById("slot-reset");
    if (rst && !rst._bound) {
      rst._bound = true;
      rst.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation(); resetSlotMap();
      });
    }
    const chips = document.getElementById("hidden-panels");
    if (chips && !chips._bound) {
      chips._bound = true;
      chips.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-restore]");
        if (!btn) return;
        e.preventDefault(); e.stopPropagation();
        restorePanel(btn.dataset.restore);
      });
    }
  }

  /* ---------------------------------------------------------------
     [10] 바깥으로
     --------------------------------------------------------------- */
  window.LayoutSlots = {
    PANELS, SLOT_IDS, SLOT_LABELS, DEFAULT_MAP, TREES, DEFAULT_SIZE, MIN_PX,
    normalizeSlotMap, prune, loadSlotMap, saveSlotMap,
    assignSlot, restorePanel, resetSlotMap, resetSizes
  };
  window.applyLayout      = () => applyLayout(true);
  window.renderSlotPicker = renderSlotPicker;
  window.renderSlotMap    = renderSlotMap;
  window.bindLayoutUI     = bindLayoutUI;
  window.resetSplitSizes  = resetSizes;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { bindLayoutUI(); applyLayout(true); });
  } else {
    bindLayoutUI(); applyLayout(true);
  }

  if (typeof module !== "undefined" && module.exports) module.exports = window.LayoutSlots;
})();
