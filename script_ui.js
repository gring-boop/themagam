/* TheMagam © 그링링 · 무단 복제·재배포 금지 */

  // =====================================================
  // [0] Helpers
  // =====================================================
  function _nickKey(suffix) {
    // 닉 귀속 로컬키
    const n = (typeof myNick === "string" && myNick.trim()) ? myNick.trim() : "";
    return n ? `${suffix}_${n}` : suffix;
  }

  // =====================================================
  // ✅ Layout + Narrow Chat Focus (FIX)
  // =====================================================
  /**
   * 채팅을 화면 왼쪽/오른쪽 중 어디에 둘지 정합니다.
   * 3단 구조라 카드 영역은 항상 가운데, 작업 패널은 채팅 반대편으로 갑니다.
   *
   *   o = -1  →  채팅(1) · 카드(2) · 작업(3)   ← 기본
   *   o =  1  →  작업(1) · 카드(2) · 채팅(3)
   */
  function setLayout(order) {
    const o = Number(order) === 1 ? 1 : -1;
    // 격자에서는 body 클래스 하나로 좌우가 통째로 뒤집힙니다.
    document.body.classList.toggle("chat-right", o === 1);
    try { AppStore.setItem("sidebarOrder", String(o)); } catch (e) {}
    window.applyLayout?.();     // 좌우가 바뀌면 배치 그림도 다시 만듭니다
  }
  window.setLayout = setLayout;

  function applySavedLayout() {
    let saved = -1;
    try { saved = parseInt(AppStore.getItem("sidebarOrder") || "-1", 10) === 1 ? 1 : -1; } catch (e) {}
    setLayout(saved);
  }

  /* ===================================================================
     화면 방향 — TheMagam 은 가로 배치만 씁니다.

     세로 모니터용 배치를 없앴습니다. 창이 세 개뿐이라 세로로 세워도
     이득이 없고, 배치를 두 벌 기억해야 해서 설정만 복잡해졌습니다.
     좌우 뒤집기는 그대로 남깁니다 — 이건 실제로 취향이 갈립니다.

     아래 함수들은 다른 파일이 아직 부르고 있어서 이름만 남겨둡니다.
     무엇을 넣어도 언제나 "가로"로 답합니다.
     =================================================================== */
  function setOrientation() {
    document.body.classList.remove("layout-portrait");
    window.applyLayout?.();
    renderLayoutPick();
  }
  window.setOrientation = setOrientation;

  function currentOrientation() { return "landscape"; }
  window.currentOrientation = currentOrientation;

  function applySavedOrientation() { setOrientation(); }
  window.applySavedOrientation = applySavedOrientation;

  function maybeSuggestPortrait() { /* 물어볼 것이 없습니다 */ }
  window.maybeSuggestPortrait = maybeSuggestPortrait;

  /* ===================================================================
     설정 — 배치 고르기 (방향 2 × 좌우 2)
     =================================================================== */
  function renderLayoutPick() {
    const host = document.getElementById("layout-pick");
    if (!host) return;
    bindLayoutPick();

    const orient = currentOrientation();
    let side = -1;
    try { side = parseInt(AppStore.getItem("sidebarOrder") || "-1", 10) === 1 ? 1 : -1; } catch (e) {}

    /* [FIX] 버튼이 안 눌리던 문제

       예전에는 이 함수가 돌 때 버튼마다 클릭 리스너를 하나씩 달았습니다.
       그래서 이 함수가 한 번이라도 안 돌면(설정을 여는 도중 앞쪽 코드에서
       예외가 나거나, 패널이 아직 안 그려졌거나) 버튼은 그냥 죽은 채로
       남았습니다. 눌러도 아무 일이 없던 이유입니다.

       이제 리스너는 아래에서 document 에 딱 하나만 답니다. 언제 그려지든,
       몇 번을 다시 그리든 상관없이 항상 눌립니다. 여기서는 선택 표시만
       칠합니다. */
    host.querySelectorAll("[data-orient]").forEach(btn => {
      const on = btn.dataset.orient === orient;
      btn.classList.toggle("selected", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
    });

    host.querySelectorAll("[data-side]").forEach(btn => {
      const on = (Number(btn.dataset.side) === 1 ? 1 : -1) === side;
      btn.classList.toggle("selected", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
    });
  }
  window.renderLayoutPick = renderLayoutPick;

  /* ===================================================================
     [FIX 3차] 배치 버튼이 안 눌리던 진짜 원인

     지난번에 document 에 위임 리스너를 하나 달아서 해결하려 했는데,
     그게 오히려 확실히 죽는 길이었습니다. index.html 을 보면

         <div class="modal-content" onclick="event.stopPropagation()">

     설정 창 내용물 전체가 클릭을 여기서 끊습니다. 바깥을 눌러야 창이
     닫히도록 만든 장치인데, 그 탓에 설정 창 안의 클릭은 document 까지
     절대 올라오지 못합니다. 위임 리스너가 한 번도 안 불린 이유입니다.

     그래서 두 겹으로 막습니다.
       1) index.html 의 버튼에 onclick 을 직접 적었습니다.
          — 요소 자신의 핸들러라 전파와 무관하게 항상 실행됩니다.
       2) 아래 위임은 설정 창 '안쪽'(#layout-pick)에 답니다.
          — 버튼 → #layout-pick 까지는 전파가 끊기기 전이라 도달합니다.

     둘 중 하나만 살아도 동작합니다.
     =================================================================== */
  function bindLayoutPick() {
    const host = document.getElementById("layout-pick");
    if (!host || host._pickBound) return;
    host._pickBound = true;

    host.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-orient], [data-side]");
      if (!btn || !host.contains(btn)) return;

      e.preventDefault();
      if (btn.dataset.orient) {
        setOrientation(btn.dataset.orient);      // 안에서 renderLayoutPick 호출
      } else {
        setLayout(Number(btn.dataset.side) === 1 ? 1 : -1);
        renderLayoutPick();
      }
    });
  }
  window.bindLayoutPick = bindLayoutPick;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindLayoutPick);
  } else {
    bindLayoutPick();
  }

  /* 좁은 화면으로 넘어가는 문턱.

     [2026-08-12] 980 → 833 (85%).
     알약 줄 배치로 오면서 좁은 화면에서도 카드가 꽤 잘 보이게 됐습니다.
     예전 기준이면 아직 넓게 써도 될 창까지 "한 번에 하나" 로 접혔어요.
     15인치 작은 모니터에서도 겹쳐 쓸 수 있게 문턱을 낮춥니다. */
  const NARROW_W = 833;
  window.NARROW_W = NARROW_W;

  function applyNarrowChatFocus() {
    const w = window.innerWidth || document.documentElement.clientWidth;
    const on = w <= NARROW_W;
    const was = document.body.classList.contains("narrow-chat-focus");
    document.body.classList.toggle("narrow-chat-focus", on);

    /* 좁아졌다 넓어질 때는 배치를 다시 짜야 합니다.
       좁은 화면은 창 하나만 뿌리에 넣으므로, 넓어지면 다섯 칸을
       도로 조립해야 하거든요. */
    if (was !== on) { try { window.applyLayout?.(true); } catch (e) {} }

    if (on && typeof window.scrollChatToBottom === "function") {
      setTimeout(() => window.scrollChatToBottom(true), 50);
    }
  }
  window.applyNarrowChatFocus = applyNarrowChatFocus;

  function applyChatOnlyModeIfMobile() {
    const isMobile =
      /Android|iPhone|iPod|iPad/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));

    window.isMobile = isMobile;

    if (isMobile) {
      document.body.classList.add("narrow-chat-focus");
      try { window.applyLayout?.(true); } catch (e) {}
      if (typeof window.scrollChatToBottom === "function") {
        setTimeout(() => window.scrollChatToBottom(true), 50);
      }
    }
  }
  window.applyChatOnlyModeIfMobile = applyChatOnlyModeIfMobile;

  window.addEventListener("resize", () => {
    // 모바일이면 고정, 데스크탑이면 폭 기반
    if (window.isMobile) return;
    applyNarrowChatFocus();
  });

  // =====================================================
  // [1] 전역 상태
  // =====================================================
  let currentTheme = AppStore.getItem("writerTheme") || "📜 원고와 잉크"; // 로그인 전 기본값
  let _soundPrefs = { enabled: true, volume: 60, workSound: "soft_bell", restSound: "calm_chime" };
  let _pomoParticipating = true;

  const SOUND_PRESETS = [
    { id: "soft_bell",    name: "Soft Bell" },
    { id: "calm_chime",   name: "Calm Chime" },
    { id: "digital_beep", name: "Digital Beep" },
    { id: "retro_ping",   name: "Retro Ping" },
    { id: "tiny_pop",     name: "Tiny Pop" },
    { id: "deep_gong",    name: "Deep Gong" },
    { id: "sparkle",      name: "Sparkle" },
    { id: "focus_tick",   name: "Focus Tick" }
  ];

  // =====================================================
  // ✅ Method B: 시스템 메시지 dedupe wrapper
  // =====================================================
  function installChatRenderDedupeWrapper() {
    const fn = window.renderChatMessage;
    if (typeof fn !== "function") return false;
    if (fn.__dedupeInstalled) return true;

    const seenPomo = new Set(); // "seq|phase"
    let lastSys = { msg: "", time: 0 };

    function isDuplicateSystem(data) {
      if (!data || data.type !== "system") return false;
      // [FIX] 입장/퇴장 메시지는 키가 이미 고유하므로 문구 중복 검사 제외
      if (data.joinOf || data.leaveOf) return false;

      const msg = String(data.msg || "");
      const t = Number(data.time || Date.now());

      const seq = data.pomoSeq;
      const phase = data.pomoPhase;
      if (seq !== undefined && phase !== undefined) {
        const k = `${seq}|${phase}`;
        if (seenPomo.has(k)) return true;
        seenPomo.add(k);
        return false;
      }

      if (msg && msg === lastSys.msg && Math.abs(t - lastSys.time) <= 90000) return true;
      lastSys = { msg, time: t };
      return false;
    }

    const wrapped = function(box, data, key) {
      try { if (isDuplicateSystem(data)) return; } catch(e) {}
      // ✅ [FIX] key(3번째 인자)까지 그대로 전달해야 답장 기능의 data-key가 채워짐
      return fn.call(this, box, data, key);
    };

    wrapped.__dedupeInstalled = true;
    window.renderChatMessage = wrapped;
    return true;
  }

  // =====================================================
  // 🎨 Themes
  // =====================================================
  const themes = {
    "📜 원고와 잉크":     { isDark:false, style:"ink",    bg:"#FAF6EC", text:"#2B2620", me:"#2B2620", other:"#FFFDF6", header:"#F4EEDF", meText:"#F5EFDF", otherText:"#2B2620", accent:"#B3372B", grid:"rgba(163,88,70,.16)" },
    /* [2026-08-11] me 와 accent 가 같은 색이던 세 테마에 **두 번째 포인트**를
       넣었습니다. 두 겹 고리 타이머(바깥=오늘 목표, 안=뽀모)가 한 색이라
       두 고리가 겹쳐 보였거든요. 말풍선 색(me)은 방 전체 인상이라
       원칙적으로 안 건드렸습니다 — 조용한 스튜디오만 예외입니다. */
    /* 🌙 산딸기. 어두운 바탕에서는 호박빛과 둘 다 따뜻한 쪽이라
       초록 바탕만큼 갈리지는 않습니다. 붉은기를 더 넣은 #D9614F 도
       미리 봤지만, 산딸기 결을 살리는 쪽을 골랐습니다. */
    "🌙 마감 전야":       { isDark:true,  style:"night",  bg:"#15171E", text:"#E6E4DC", me:"#FFB43C", other:"#232733", header:"#1B1E27", meText:"#231A05", otherText:"#E6E4DC", accent:"#DD7F5E" },
    /* 💠 세이지 청록 + 파랑 채도 낮춤(#2F6BFF → #4C74B4).
       ★ 여기만 me 를 바꿉니다. "쨍한 파랑이 눈이 아프다" 는 말에 맞춰
         한 걸음 더 내렸어요. 흰 글자 대비는 4.7:1 로 기준(4.5)을 넘습니다. */
    "💠 조용한 스튜디오": { isDark:false, style:"studio", bg:"#F1F2F4", text:"#20242B", me:"#4C74B4", other:"#FFFFFF", header:"#FFFFFF", meText:"#FFFFFF", otherText:"#20242B", accent:"#2E9E7E" },
    /* [추가 2026-08-04] 새 테마 5종 — 전용 style 표식 없이 색만 바꿉니다(style:"default").
       솜사탕의 포인트는 옐로 대신 하늘색(사용자 요청). */
    /* [고침 2026-08-11] 🍬 솜사탕 — 흰 글자가 뿌옇게 보이던 것.
       보라(#A98BDE)가 밝아서 흰 글자와 대비가 2.82 밖에 안 됐습니다
       (읽기 기준 4.5). 밝은 데서 폰으로 보면 글자가 배경에 반쯤 녹았어요.
       ★ 말풍선 색은 **그대로** 두고 글자만 짙은 자주로 바꿉니다 → 4.64.
         🍭 롤리팝이 이미 쓰는 방식이라 방 인상이 거의 안 바뀝니다. */
    "🍬 솜사탕":         { isDark:false, style:"default", bg:"#FBEDF3", text:"#463A50", me:"#A98BDE", other:"#FFFFFF", header:"#F6E1ED", meText:"#3B2168", otherText:"#463A50", accent:"#5CA8E0" },
    "🍭 롤리팝":         { isDark:false, style:"default", bg:"#E9F4FB", text:"#2C4657", me:"#F5A8C2", other:"#FFFFFF", header:"#DCEDF8", meText:"#5C2038", otherText:"#2C4657", accent:"#35C4A5" },
    "🔩 인더스트리":     { isDark:false, style:"default", bg:"#E4E6EA", text:"#2A2E33", me:"#3A6EA5", other:"#FFFFFF", header:"#D6D9DE", meText:"#FFFFFF", otherText:"#2A2E33", accent:"#CF4141" },
    /* [고침 2026-08-11] 🌿 허브티 — 같은 문제(3.65).
       ★ 여기는 글자만 바꿔서는 못 고칩니다. 초록(#6E8F5E)이 중간 밝기라
         글자를 거의 검정으로 해도 4.35 에서 멈춰요. 그래서 말풍선 쪽을
         **연둣빛으로 올리고** 짙은 초록 글자를 얹었습니다 → 7.09.
       ※ 말풍선이 밝아진 만큼, --me 를 쓰는 **가는 선들**(뽀모 안쪽 고리,
         카드 왼쪽 띠)은 옅어집니다. 바탕과의 대비가 3.25 → 1.90 이에요.
         고리가 잘 안 보이면 #85A571 로 한 톤만 내리면 됩니다
         (글자 5.49 / 고리 2.45 로 둘 다 지켜집니다). */
    "🌿 허브티":         { isDark:false, style:"default", bg:"#EFF3EA", text:"#33402B", me:"#9DBA8C", other:"#FFFFFF", header:"#E2EAD8", meText:"#1B2A13", otherText:"#33402B", accent:"#C6754A" },
    "🌌 오로라":         { isDark:true,  style:"default", bg:"#141B2A", text:"#D9E2F2", me:"#57D9C0", other:"#243049", header:"#1C2537", meText:"#0B2B24", otherText:"#D9E2F2", accent:"#9D8BE8" },
    /* [추가 2026-08-09] 칠판 같은 짙은 녹색에 금빛 포인트.
       미리보기의 B안을 골랐고, "녹색 느낌을 더" 라는 말에 맞춰
       회색기를 걷어내고 채도를 올렸습니다 (#1E2E22 → #16321F).
       금빛은 그대로 뒀어요 — 녹색을 진하게 할수록 금이 더 살아납니다. */
    /* [2026-08-11] 포인트 둘째 색으로 캐러멜.
       ※ 금빛(#E2C074)과 같은 갈색 계열이라 두 고리가 또렷하게 갈리지는
         않습니다. 미리보기에서 그렇게 알려드렸고, 그래도 이 결이
         좋다고 하셔서 넣었어요. 나중에 더 갈리길 원하시면 붉은기가 있는
         구운 벽돌(#B06A45) 로 이 한 줄만 바꾸면 됩니다. */
    "🌲 포레스트 그린":   { isDark:true,  style:"default", bg:"#16321F", text:"#E7EFE4", me:"#E2C074", other:"#234630", header:"#1B3B25", meText:"#1C3320", otherText:"#E7EFE4", accent:"#C48A5C" },
  };

  function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(10,132,255,${alpha})`;
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const r = parseInt(full.substring(0, 2), 16);
    const g = parseInt(full.substring(2, 4), 16);
    const b = parseInt(full.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function applyTheme(name) {
    /* 옛 테마(파스텔 30여 종) 저장값 마이그레이션 —
       목록에 없는 이름이 오면 기본 테마로 흘려보냅니다. */
    if (!themes[name]) name = "📜 원고와 잉크";
    const t = themes[name];
    const r = document.documentElement.style;
    const root = document.documentElement;
    const isDark = !!t.isDark;

    root.setAttribute("data-theme-mode", "manual");
    root.setAttribute("data-is-dark", isDark ? "true" : "false");
    /* 테마별 전용 스타일(원고지 괘선 · 명조 제목 · 모노 숫자 등)을 CSS가 읽는 표식 */
    root.setAttribute("data-theme-style", t.style || "default");

    const bg = t.bg || "#E9EDF3";
    /* [고침 2026-08-04] 다크 테마도 기본 테마와 같은 반투명도로 —
       .96 은 사실상 불투명이라 뒤에 깐 원고지 격자가 전혀 비치지 않았습니다. */
    const panel  = t.panel  || (isDark ? "rgba(22,24,28,.70)" : hexToRgba(bg, 0.70));
    const panel2 = t.panel2 || (isDark ? "rgba(22,24,28,.62)" : hexToRgba(bg, 0.62));
    const surface= t.surface|| (isDark ? "rgba(22,24,28,.56)" : hexToRgba(bg, 0.56));

    r.setProperty("--panel", panel);
    r.setProperty("--panel2", panel2);
    r.setProperty("--surface", surface);

    /* [FIX] 경계선이 안 보이던 문제
       배경이 옅게 물든 테마에서는 검정 10% 테두리가 거의 사라졌습니다.
       진하게 올리고, 칸과 칸 사이 손잡이도 같이 또렷하게 만듭니다. */
    r.setProperty("--border", isDark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.20)");
    r.setProperty("--fill-2", isDark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.13)");
    r.setProperty("--fill-3", isDark ? "rgba(255,255,255,.20)" : "rgba(0,0,0,.20)");
    r.setProperty("--glass", isDark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.55)");
    r.setProperty("--glass2", isDark ? "rgba(255,255,255,.06)" : "rgba(242,242,247,.70)");
    r.setProperty("--modal-bg", isDark ? "rgba(18,18,22,.92)" : "rgba(255,255,255,.92)");
    r.setProperty("--modal-border", isDark ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.65)");
    r.setProperty("--focus-bg", isDark ? "rgba(255,255,255,.08)" : "#fff");

    r.setProperty("--muted", isDark ? "rgba(235,235,245,.68)" : "rgba(60,60,67,.72)");
    r.setProperty("--muted-strong", isDark ? "rgba(235,235,245,.86)" : "rgba(60,60,67,.88)");
    r.setProperty("--sub-muted", isDark ? "rgba(235,235,245,.72)" : "rgba(60,60,67,.75)");
    r.setProperty("--name-muted", isDark ? "rgba(235,235,245,.75)" : "rgba(60,60,67,.60)");
    r.setProperty("--time-muted", isDark ? "rgba(235,235,245,.42)" : "rgba(60,60,67,.45)");

    r.setProperty("--input-bg", isDark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.92)");
    r.setProperty("--input-text", isDark ? (t.text || "#f2f3f5") : (t.text || "#111111"));

    r.setProperty("--bg", bg);
    r.setProperty("--text", t.text);
    r.setProperty("--me", t.me);
    r.setProperty("--other", t.other);
    r.setProperty("--header", t.header);
    r.setProperty("--me-text", t.meText);
    r.setProperty("--other-text", t.otherText || (isDark ? "#f2f3f5" : "#111111"));

    /* 포인트 컬러 — 버튼 · 강조선 · 포커스 테두리까지 함께 바꿉니다.

       [FIX] 여태 --accent 는 :root 에 iOS 파랑으로 고정돼 있었습니다.
       그래서 어떤 테마를 골라도 배경과 말풍선만 바뀌고 버튼은 그대로라,
       테마를 바꿔도 밋밋하게 느껴졌습니다.
       accent 를 지정하지 않은 예전 테마는 me(내 말풍선) 색을 씁니다. */
    const accent = t.accent || t.me || "#0A84FF";
    r.setProperty("--accent", accent);
    r.setProperty("--accent-soft",   hexToRgba(accent, isDark ? 0.18 : 0.10));
    r.setProperty("--accent-softer", hexToRgba(accent, isDark ? 0.12 : 0.06));
    r.setProperty("--accent-line",   hexToRgba(accent, isDark ? 0.34 : 0.22));
    r.setProperty("--accent-ring",   hexToRgba(accent, isDark ? 0.48 : 0.32));

    /* [추가 2026-08-04] 원고지 격자를 모든 테마에 — 색만 테마 따라.
       기본 테마의 인주색 괘선이 좋다는 요청이라, 다른 테마도 포인트색을
       옅게 푼 괘선을 깝니다. grid 를 따로 적은 테마(원고와 잉크)는 그 색을. */
    /* [고침 2026-08-04] 괘선 농도를 기본 테마(0.16)와 맞춤 —
       0.09 는 반투명 카드 너머로는 보이지 않을 만큼 옅었습니다. */
    r.setProperty("--grid-line", t.grid || hexToRgba(accent, isDark ? 0.14 : 0.16));

    r.setProperty("--timer-a", hexToRgba(t.me || "#0A84FF", isDark ? 0.14 : 0.10));
    r.setProperty("--timer-b", hexToRgba("#30D158", isDark ? 0.14 : 0.10));
    r.setProperty("--timer-text", isDark ? "rgba(235,235,245,.92)" : "rgba(60,60,67,.95)");

    currentTheme = name;
    renderThemePalette();
    /* 방 배경의 덮개는 테마 종이색으로 만듭니다 — 테마가 바뀌면 다시 */
    window.applyRoomBg?.();
  }

  function renderThemePalette() {
    const grid = document.querySelector(".theme-grid");
    if (!grid) return;

    const names = Object.keys(themes || {});
    if (!names.length) return;

    const existing = grid.querySelectorAll(".theme-chip");
    if (existing.length !== names.length) {
      grid.innerHTML = "";
      names.forEach((name) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "theme-chip";
        btn.setAttribute("data-theme", name);
        btn.title = name;

        const dot = document.createElement("span");
        dot.className = "chip-dot";
        btn.appendChild(dot);

        const label = document.createElement("span");
        label.className = "chip-name";
        label.textContent = name;
        btn.appendChild(label);

        btn.addEventListener("click", async () => {
          applyTheme(name);
          /* 저장은 script_data.js 가 맡습니다 (이 파일보다 나중에 읽혀요) */
          await window.saveThemeForNick?.(name);
        });

        grid.appendChild(btn);
      });
    }

    grid.querySelectorAll(".theme-chip").forEach((btn) => {
      const name = btn.getAttribute("data-theme");
      const t = themes[name];
      if (!t) return;

      const bg = t.bg || "#E9EDF3";
      // 칩 오른쪽 절반은 그 테마의 포인트 컬러를 보여줍니다
      const me = t.accent || t.me || "#0A84FF";

      btn.style.setProperty("--chip-bg", bg);
      btn.style.setProperty("--chip-me", me);
      btn.style.setProperty("--chip-label", t.text || "#141618");
      btn.style.background = `linear-gradient(90deg, ${bg} 0 50%, ${me} 50% 100%)`;
      btn.style.borderColor = t.isDark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.10)";
      btn.classList.toggle("selected", name === currentTheme);
    });
  }

  /* [뺌 2026-08-09] saveThemeForNick · loadThemeForNick 는 여기서 걷어냈습니다.

     같은 이름의 함수가 script_data.js 에도 있었습니다. 두 파일 모두 모듈이
     아니라 그냥 <script> 라, 나중에 읽히는 script_data.js 것이 이쪽을
     조용히 덮어쓰고 있었어요 — 여기 있던 서른 몇 줄은 한 번도 돌지 않았습니다.
     (let/const 였다면 문법 오류로 바로 걸렸을 텐데, function 끼리는 아무 말
      없이 덮어쓰기만 합니다. 그래서 몇 달을 몰랐습니다.)

     남긴 쪽은 script_data.js 판입니다. 이유가 둘 있어요.
       · 저장 자리가 users/{닉}/prefs/themeName 로, 지금 모두의 테마가
         실제로 들어 있는 곳입니다. 이쪽을 지우면 다들 테마를 잃습니다.
       · 서버를 먼저 보고 없을 때 이 기기 값을 씁니다. 다른 기기에서
         테마를 바꿔도 따라옵니다 (여기 있던 판은 이 기기 값이 먼저라
         기기끼리 어긋났습니다).

     users/{닉}/theme 노드는 이제 아무도 쓰지 않습니다. */

  // =====================================================
  // Settings modal
  // =====================================================
  let timerHidden = AppStore.getItem("timerHidden") === "true";
  /* [뺌 2026-08-12] 임박 강조 기준(분) — 임박 표시를 없애면서 함께 뺐습니다.
     조절 슬라이더(#set-warn-min)는 이미 화면에서 빠져 있어서, 이 값은
     아무도 안 바꾸고 아무도 안 쓰는 채로 남아 있었어요. */

  function openSettings() {
    if (window.isMobile) return;

    const modal = document.getElementById("settings-modal");
    if (!modal) return;
    modal.style.display = "flex";

    const chk = document.getElementById("set-timer-hide");
    if (chk) {
      chk.checked = timerHidden;
      chk.onchange = () => {
        timerHidden = chk.checked;
        AppStore.setItem("timerHidden", String(timerHidden));
        applyTimerVisibility();
      };
    }

    _renderParticipationButton();

    /* [철거 2026-08-18] "창이 좁아지면 보여줄 창" 고르기 — 폰 접속자가
       없고 좁아져도 쓸 만해서 걷었습니다. 좁은 화면은 채팅부터 열리고
       위쪽 탭으로 옮겨 다닙니다 (script_layout.js 그대로). */

    /* 📊 오늘 접속 띠 (2026-08-18) — 스위치의 처음 상태만 맞춰 줍니다.
       켜고 끄는 일은 onchange 의 setPulse 가 합니다 (script_realtime.js) */
    const pulseChk = document.getElementById("set-pulse");
    if (pulseChk) pulseChk.checked = !!window.isPulseOn?.();
    /* 📊 띠 항목 체크 — 지금 고른 것들에 맞춥니다.
       하나도 안 남으면 pulseWhat() 이 '오늘 접속' 으로 되돌리므로,
       그 값을 그대로 비춰 주면 화면과 실제가 어긋나지 않아요. */
    window.syncPulseChecks = function () {
      const now = window.pulseWhat?.() || ["live"];
      document.querySelectorAll(".set-pulse-what").forEach(c => {
        c.checked = now.indexOf(c.value) >= 0;
      });
    };
    window.syncPulseChecks();

    /* 접속자 카드 정렬 (2026-08-13) — 이 기기에만. 바꾸면 그 자리에서 재배열 */
    const csort = document.getElementById("set-card-sort");
    if (csort) {
      csort.value = AppStore.getItem("cardSort") || "abc";
      csort.onchange = () => {
        AppStore.setItem("cardSort", csort.value);
        window.rerenderUserCards?.();
      };
    }

    const joinChk = document.getElementById("set-join-noti");
    if (joinChk) {
      joinChk.checked = _joinNoti;
      joinChk.onchange = () => {
        _joinNoti = joinChk.checked;
        AppStore.setItem("joinNoti", String(_joinNoti));
        // 체크한 그 클릭이 곧 사용자 동작이라, 여기서 물어봐야 통과합니다
        /* 뽀모가 이미 한 번 물어봤다면 askNotifyPermissionOnce 는 그냥 돌아갑니다.
           여기서는 사용자가 직접 켠 것이니 다시 물어봅니다. */
        if (_joinNoti && typeof Notification !== "undefined"
            && Notification.permission === "default") {
          try { Notification.requestPermission(); } catch (e) {}
        }
      };
    }

    renderThemePalette();
    renderLayoutPick();
    window.bindLayoutUI?.();
    window.bindAdminEasterEgg?.();
    window.refreshAdminUiVisibility?.();
  }

  function closeSettings() {
    const m = document.getElementById("settings-modal");
    if (m) m.style.display = "none";
  }

  function openTab(name) {
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === `panel-${name}`));
    /* [2026-08-14] 프로필 탭만 두 칸이라 창을 넓힙니다 — CSS 가 이 표식을 봅니다 */
    document.querySelector("#settings-modal .modal-content")?.setAttribute("data-tab", name);
    if (name === "theme") { renderThemePalette(); window.bindRoomBgUI?.(); }
    if (name === "pomo") { renderPomodoroSoundMini(); applyPomoShape(loadPomoShape()); }
    if (name === "chat") { renderLayoutPick(); window.bindLayoutUI?.(); window.renderSlotMap?.(); }
    if (name === "alive") window.renderAliveButton?.();   // 스위치를 지금 상태에 맞춥니다
    if (name === "privacy") {
      window.bindAdminEasterEgg?.();
      window.refreshAdminUiVisibility?.();
    }
  }

  /* 예전 설정 슬라이더용 함수. 이제 칸 사이 손잡이가 대신하지만,
     외부에서 부를 수 있어 남겨둡니다. */
  function resizeChat(val) {
    document.documentElement.style.setProperty("--sidebar-width", val + "px");
  }

  function applyTimerVisibility() {
    const wrap = document.getElementById("timer-wrap");
    if (!wrap) return;
    wrap.style.display = timerHidden ? "none" : "flex";

    const detail = document.getElementById("pomo-detail");
    if (detail) detail.style.display = timerHidden ? "none" : "block";
  }

  // =====================================================
  // 🔊 Pomodoro Sound Engine
  // =====================================================
  let _audioCtx = null;
  let _audioUnlocked = false;

  function _getAudioCtx() {
    if (_audioCtx) return _audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    _audioCtx = new Ctx();
    return _audioCtx;
  }

  async function _unlockAudio() {
    const ctx = _getAudioCtx();
    if (!ctx) return false;
    try {
      if (ctx.state === "suspended") await ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0.00001;
      o.connect(g).connect(ctx.destination);
      o.frequency.value = 440;
      o.start();
      o.stop(ctx.currentTime + 0.02);
      _audioUnlocked = true;
      return true;
    } catch (e) {
      console.warn("[audio unlock failed]", e);
      return false;
    }
  }

  function _playEnvelopeTone({ freq=440, type="sine", start=0, dur=0.18, vol=0.2 }) {
    const ctx = _getAudioCtx();
    if (!ctx) return;

    const t0 = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = type;
    o.frequency.setValueAtTime(freq, t0);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function _playPreset(presetId, volume01) {
    const v = Math.max(0, Math.min(1, volume01));
    const base = 0.30 * v;

    switch (presetId) {
      case "soft_bell":
        _playEnvelopeTone({ freq: 784, type:"sine",   start:0.00, dur:0.16, vol:base });
        _playEnvelopeTone({ freq: 1046, type:"sine",  start:0.05, dur:0.18, vol:base*0.9 });
        break;
      case "calm_chime":
        _playEnvelopeTone({ freq: 659, type:"triangle", start:0.00, dur:0.22, vol:base });
        _playEnvelopeTone({ freq: 880, type:"triangle", start:0.07, dur:0.24, vol:base*0.85 });
        break;
      case "digital_beep":
        _playEnvelopeTone({ freq: 880, type:"square", start:0.00, dur:0.10, vol:base*0.9 });
        _playEnvelopeTone({ freq: 988, type:"square", start:0.12, dur:0.10, vol:base*0.9 });
        break;
      case "retro_ping":
        _playEnvelopeTone({ freq: 523, type:"sine", start:0.00, dur:0.12, vol:base });
        _playEnvelopeTone({ freq: 784, type:"sine", start:0.10, dur:0.14, vol:base*0.85 });
        break;
      case "tiny_pop":
        _playEnvelopeTone({ freq: 1200, type:"triangle", start:0.00, dur:0.07, vol:base });
        _playEnvelopeTone({ freq: 800,  type:"triangle", start:0.06, dur:0.08, vol:base*0.7 });
        break;
      case "deep_gong":
        _playEnvelopeTone({ freq: 196, type:"sine", start:0.00, dur:0.28, vol:base });
        _playEnvelopeTone({ freq: 98,  type:"sine", start:0.00, dur:0.32, vol:base*0.55 });
        break;
      case "sparkle":
        _playEnvelopeTone({ freq: 1046, type:"sine", start:0.00, dur:0.10, vol:base*0.9 });
        _playEnvelopeTone({ freq: 1318, type:"sine", start:0.08, dur:0.10, vol:base*0.8 });
        _playEnvelopeTone({ freq: 1568, type:"sine", start:0.16, dur:0.10, vol:base*0.7 });
        break;
      case "focus_tick":
      default:
        _playEnvelopeTone({ freq: 740, type:"square", start:0.00, dur:0.06, vol:base*0.75 });
        _playEnvelopeTone({ freq: 740, type:"square", start:0.10, dur:0.06, vol:base*0.75 });
        break;
    }
  }

  /* ===================================================================
     [추가] 뽀모도로 브라우저 알림

     지금까지는 알림음뿐이라, 다른 창을 보고 있으면 세션이 끝난 걸
     놓쳤습니다. 브라우저 알림은 탭이 가려져 있어도 뜹니다.

     지키는 규칙
       · 권한은 사용자가 ▶ 시작을 누른 "그 순간"에만 물어봅니다.
         (페이지를 열자마자 묻는 건 무례하고 대체로 거부당합니다)
       · 한 번 거부하면 다시 묻지 않습니다.
       · 알림음을 끈 분(미참여)에게는 알림도 보내지 않습니다.
       · 화면을 보고 있을 때는 굳이 띄우지 않습니다.
     =================================================================== */
  const NOTI_ASKED_KEY = "pomoNotiAsked";

  function canNotify() {
    return typeof Notification !== "undefined" && Notification.permission === "granted";
  }

  /** 사용자 동작(시작 버튼) 직후에만 부릅니다 */
  function askNotifyPermissionOnce() {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;      // 이미 허용/거부됨
    try {
      if (AppStore.getItem(NOTI_ASKED_KEY)) return;     // 이미 물어봤음
      AppStore.setItem(NOTI_ASKED_KEY, "1");
    } catch (e) {}
    try { Notification.requestPermission(); } catch (e) {}
  }
  window.askNotifyPermissionOnce = askNotifyPermissionOnce;

  function notifyPomodoro(kind) {
    /* [고침 2026-08-09] ♪ 는 **소리만** 끕니다.

       예전에는 이 스위치 하나가 소리와 브라우저 알림을 함께 껐습니다.
       그런데 소리를 끄는 이유는 대개 "옆에 사람이 있어서" 이지, 세션이
       끝난 걸 모르고 싶어서가 아니에요. 다른 창을 보고 있을 때 조용히
       알려주는 알림은 그대로 두는 편이 맞습니다. */
    if (!canNotify()) return;
    if (document.visibilityState === "visible") return;  // 보고 있으면 불필요

    const text = {
      work: { title: "🍅 집중 시간 시작!", body: "다들 함께 달리는 중이에요." },
      rest: { title: "☕ 집중 시간 끝!",   body: "휴식이 시작됐어요. 잠깐 쉬어요." },
      stop: { title: "⏹️ 뽀모도로 정지",   body: "타이머가 멈췄어요." }
    }[kind];
    if (!text) return;

    try {
      const n = new Notification(text.title, {
        body: text.body + " · TheMagam",
        tag: "belsatang-pomo",     // 같은 태그는 덮어써서 알림이 쌓이지 않습니다
        renotify: false
      });
      n.onclick = () => { try { window.focus(); n.close(); } catch (e) {} };
      setTimeout(() => { try { n.close(); } catch (e) {} }, 12000);
    } catch (e) {}
  }
  window.notifyPomodoro = notifyPomodoro;

  /* ===================================================================
     입장 알림 — 누군가 들어오면 알려줍니다.

     뽀모 알림과 규칙을 똑같이 맞췄습니다.
       · 설정에서 켜야 뜹니다 (기본 꺼짐 — 원치 않는 사람에게 안 튀도록)
       · 화면을 보고 있으면 뜨지 않습니다. 카드가 바로 생기니까요.
       · 태그를 공유해서, 여럿이 동시에 들어와도 알림이 쌓이지 않습니다.
     =================================================================== */
  let _joinNoti = AppStore.getItem("joinNoti") === "true";

  function notifyJoin(nicks) {
    if (!_joinNoti) return;
    if (!canNotify()) return;
    if (document.visibilityState === "visible") return;
    if (!nicks || !nicks.length) return;

    const body = nicks.length === 1
      ? `${nicks[0]} 님이 들어왔어요.`
      : `${nicks.slice(0, 3).join(", ")}${nicks.length > 3 ? ` 외 ${nicks.length - 3}명` : ""} 님이 들어왔어요.`;

    try {
      const n = new Notification("👋 새 작가님 입장", {
        body: body + " · TheMagam",
        tag: "belsatang-join",
        renotify: false
      });
      n.onclick = () => { try { window.focus(); n.close(); } catch (e) {} };
      setTimeout(() => { try { n.close(); } catch (e) {} }, 10000);
    } catch (e) {}
  }
  window.notifyJoin = notifyJoin;

  async function playPomodoroSound(eventType) {
    if (!_pomoParticipating) return;
    if (!_soundPrefs?.enabled) return;
    if (!_audioUnlocked) await _unlockAudio();

    const vol01 = (Number(_soundPrefs.volume) || 0) / 100;
    if (vol01 <= 0) return;

    const preset = (eventType === "rest_start")
      ? (_soundPrefs.restSound || "calm_chime")
      : (_soundPrefs.workSound || "soft_bell");

    _playPreset(preset, vol01);
  }

  async function testPresetSound(presetId) {
    await _unlockAudio();
    const vol01 = (Number(_soundPrefs.volume) || 0) / 100;
    if (vol01 <= 0) return;
    _playPreset(String(presetId || "soft_bell"), vol01);
  }

  async function saveSoundPrefsToFirebase(prefs) {
    if (!myNick) return;
    try {
      await db.ref(`users/${myNick}/soundPrefs`).update({
        enabled: !!prefs.enabled,
        volume: Number(prefs.volume) || 0,
        workSound: String(prefs.workSound || "soft_bell"),
        restSound: String(prefs.restSound || "calm_chime"),
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn("[saveSoundPrefsToFirebase failed]", e);
    }
  }

  async function loadSoundPrefsFromFirebase() {
    if (!myNick) return _soundPrefs;
    try {
      const snap = await db.ref(`users/${myNick}/soundPrefs`).once("value");
      const v = snap.val();
      if (v) {
        _soundPrefs = {
          enabled: (v.enabled !== undefined ? !!v.enabled : true),
          volume: Math.max(0, Math.min(100, parseInt(v.volume ?? 60, 10))),
          workSound: String(v.workSound || "soft_bell"),
          restSound: String(v.restSound || "calm_chime")
        };
      }
    } catch (e) {
      console.warn("[loadSoundPrefsFromFirebase failed]", e);
    }
    return _soundPrefs;
  }

  async function savePomoParticipationToFirebase(isOn) {
    if (!myNick) return;
    try {
      await db.ref(`users/${myNick}/pomoParticipation`).set({
        participating: !!isOn,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn("[savePomoParticipationToFirebase failed]", e);
    }
  }

  async function loadPomoParticipationFromFirebase() {
    if (!myNick) return _pomoParticipating;
    try {
      const snap = await db.ref(`users/${myNick}/pomoParticipation`).once("value");
      const v = snap.val();
      if (v && typeof v.participating === "boolean") _pomoParticipating = v.participating;
    } catch (e) {
      console.warn("[loadPomoParticipationFromFirebase failed]", e);
    }
    return _pomoParticipating;
  }

  /* [뺌 2026-08-06] "starter"(지금 도는 뽀모를 시작한 사람)는 없어졌습니다.
     뽀모가 각자 것이 되면서 시작한 사람이 곧 나 자신이니까요.
     함수는 껍데기만 남겨 둡니다 — 옛 코드가 부르더라도 조용히 넘어가게. */
  window.setPomoStarter = function () {};

  function _renderParticipationButton() {
    /* 같은 스위치가 두 곳에 있습니다 — 뽀모도로 창과 설정 → 🍅 뽀모도로.
       둘이 다른 모습을 보이면 어느 쪽이 진짜인지 알 수 없으니
       한 함수에서 같이 칠합니다. */
    /* [고침 2026-08-09] 조작 줄의 ♪ 하나로 모았습니다.
       예전에는 맨 아랫줄에 폭 전체를 쓰는 [🔔 소리·알림] 버튼이 따로
       있었는데, 뽀모 칸만 세로로 길어지는 원인이었어요. */
    const btns = [
      document.getElementById("pomo-sound-btn"),
      document.getElementById("set-pomo-part")
    ].filter(Boolean);

    btns.forEach(btn => {
      const isMini = btn.id === "pomo-sound-btn";
      btn.dataset.state = _pomoParticipating ? "on" : "off";
      btn.setAttribute("aria-pressed", _pomoParticipating ? "true" : "false");
      btn.title = _pomoParticipating
        ? "세션이 바뀔 때 소리가 나요 — 누르면 조용해집니다"
        : "지금은 소리가 나지 않아요 — 누르면 켜집니다 (알림은 그대로)";
      if (isMini) return;                    // ♪ 는 글자를 바꾸지 않습니다
      btn.innerHTML = `알림음 <span class="pomo-sw ${_pomoParticipating ? "on" : "off"}"><i></i></span>`;
      btn.classList.toggle("primary", _pomoParticipating);
      btn.classList.toggle("danger", !_pomoParticipating);
    });
    /* 소리를 껐다고 뽀모 화면 전체를 흐리게 하지는 않습니다 —
       타이머는 멀쩡히 돌고 있으니까요. (옛 pomo-nonpart 칠은 없앴습니다) */
  }
  window.syncPomoSettingBtn = _renderParticipationButton;

  async function togglePomodoroParticipation() {
    _pomoParticipating = !_pomoParticipating;
    _renderParticipationButton();

    try { AppStore.setItem(_nickKey("pomoParticipating"), _pomoParticipating ? "true" : "false"); } catch(e) {}
    await savePomoParticipationToFirebase(_pomoParticipating);

    try { await _unlockAudio(); } catch(e) {}
  }
  window.togglePomodoroParticipation = togglePomodoroParticipation;

  function togglePomoDetail(forceState) {
    const detail = document.getElementById("pomo-detail");
    const btn = document.getElementById("pomo-detail-toggle");
    if (!detail || !btn) return;

    const collapsed = detail.classList.contains("collapsed");
    const nextCollapsed = (typeof forceState === "boolean") ? !forceState : !collapsed;

    detail.classList.toggle("collapsed", nextCollapsed);
    /* [고침 2026-08-09] 여기서 btn.textContent = "🎵" 로 덮어쓰고 있었습니다.

       이 버튼은 이제 [⚙️ 설정] 이라 안에 두 조각(아이콘·글자)이 들어 있는데,
       textContent 를 넣는 순간 그 둘이 통째로 지워지고 음표만 남았습니다.
       HTML 을 아무리 고쳐도 화면에는 음표가 뜨던 이유예요 —
       **저장된 pomoDetailCollapsed 값이 있는 사람에게만** 일어나서
       (아래 초기화 코드에서도 같은 줄이 돌았습니다) 새 브라우저로 열면
       멀쩡해 보였습니다. 그래서 찾는 데 오래 걸렸습니다.

       내용은 HTML 이 정하게 두고, 여기서는 열림·닫힘만 표시합니다. */
    btn.setAttribute("aria-expanded", nextCollapsed ? "false" : "true");

    try { AppStore.setItem(_nickKey("pomoDetailCollapsed"), nextCollapsed ? "true" : "false"); } catch(e) {}
  }
  window.togglePomoDetail = togglePomoDetail;

  function renderPomodoroSoundMini() {
    const host = document.getElementById("pomo-sound-mini");
    if (!host) return;

    const options = SOUND_PRESETS.map(p => `<option value="${p.id}">${p.name}</option>`).join("");

    host.innerHTML = `
      <div class="pomo-sound-card">
        <div class="pomo-sound-title">🔊 알림음(개인)</div>
        <div class="pomo-sound-row">
          <label class="pomo-sound-item">
            <span>사용</span>
            <input id="pomo-sound-enabled" type="checkbox">
          </label>
          <label class="pomo-sound-item" style="flex:1;">
            <span>볼륨</span>
            <input id="pomo-sound-vol" type="range" min="0" max="100" step="1" style="width:100%;">
          </label>
        </div>

        <div class="pomo-sound-row">
          <label class="pomo-sound-item" style="flex:1;">
            <span>작업</span>
            <select id="pomo-sound-work" style="width:100%;">${options}</select>
          </label>
          <label class="pomo-sound-item" style="flex:1;">
            <span>휴식</span>
            <select id="pomo-sound-rest" style="width:100%;">${options}</select>
          </label>
        </div>

        <div class="pomo-sound-row">
          <button id="pomo-sound-test-work" class="ghost-btn compact" type="button">작업음 테스트</button>
          <button id="pomo-sound-test-rest" class="ghost-btn compact" type="button">휴식음 테스트</button>
        </div>

        <div class="hint">참가를 끄면(🔕) 알림음이 나에게만 꺼져요.</div>
      </div>
    `;

    const chk = document.getElementById("pomo-sound-enabled");
    const vol = document.getElementById("pomo-sound-vol");
    const selW = document.getElementById("pomo-sound-work");
    const selR = document.getElementById("pomo-sound-rest");

    if (chk) chk.checked = !!_soundPrefs.enabled;
    if (vol) vol.value = String(Number(_soundPrefs.volume ?? 60));
    if (selW) selW.value = String(_soundPrefs.workSound || "soft_bell");
    if (selR) selR.value = String(_soundPrefs.restSound || "calm_chime");

    const syncAndSave = async () => {
      _soundPrefs = {
        enabled: !!(chk?.checked),
        volume: Math.max(0, Math.min(100, parseInt(vol?.value ?? "60", 10))),
        workSound: String(selW?.value || "soft_bell"),
        restSound: String(selR?.value || "calm_chime")
      };
      await saveSoundPrefsToFirebase(_soundPrefs);
    };

    chk?.addEventListener("change", syncAndSave);
    vol?.addEventListener("input", () => { syncAndSave(); });
    selW?.addEventListener("change", syncAndSave);
    selR?.addEventListener("change", syncAndSave);

    document.getElementById("pomo-sound-test-work")?.addEventListener("click", async () => {
      await _unlockAudio();
      await testPresetSound(selW?.value || "soft_bell");
    });
    document.getElementById("pomo-sound-test-rest")?.addEventListener("click", async () => {
      await _unlockAudio();
      await testPresetSound(selR?.value || "calm_chime");
    });
  }

  /* =====================================================================
     🍅 두 겹 고리 (2026-08-11)
     ---------------------------------------------------------------------
     예전에는 가로 진행 바 하나였습니다. 이제 고리 둘이에요 —
       바깥 : 오늘 작업 시간 ÷ 하루 목표
       안쪽 : 지금 뽀모 세션

     ★ 고리를 채우는 방법은 stroke-dasharray/offset 입니다.
       둘레만큼 점선을 만들어 두고, 안 채운 만큼을 밀어내면(offset)
       채워진 것처럼 보입니다. 반지름이 다르면 둘레도 다르므로
       **고리마다 따로** 계산해야 합니다 — 한 값을 돌려 쓰면 안쪽 고리가
       엉뚱하게 찹니다.

     ★ 오늘 작업 시간은 이미 status 에 실려 있습니다(카드의 ⏱ 과 같은 값).
       따로 세지 않아요 — 두 곳에서 세면 언젠가 어긋납니다. */
  /* =====================================================================
     🍅 타이머 모양 — 원형 / 가로 바 (2026-08-12)
     ---------------------------------------------------------------------
     ★ 이 기기에만 저장합니다. 서버로 안 올라가요.
       같은 방이라도 각자 제 눈에 맞는 모양을 쓸 수 있습니다. 작업방은
       하루에 몇 시간씩 보는 화면이라, 이런 건 방 규칙이 아니라 취향으로
       두는 편이 맞습니다.
       (다만 폰과 PC 는 따로 골라야 합니다 — 기기별 저장이라서요)

     ★ 두 모양을 각각 그리지 않습니다. 화면에는 둘 다 들어 있고 CSS 가
       한쪽만 보여줘요. 아래 그리는 코드는 **늘 둘 다** 채웁니다.
       모양에 따라 갈라 쓰면, 안 보이는 쪽이 조용히 썩습니다.
     ===================================================================== */
  const POMO_SHAPES = ["ring", "bar"];
  const SHAPE_KEY = "pomoShape";

  function loadPomoShape() {
    try {
      const v = window.AppStore?.getItem(SHAPE_KEY);
      return POMO_SHAPES.includes(v) ? v : "ring";
    } catch (e) { return "ring"; }
  }

  function applyPomoShape(shape) {
    const v = POMO_SHAPES.includes(shape) ? shape : "ring";
    document.getElementById("pomo-block")?.setAttribute("data-shape", v);
    document.querySelectorAll("#pomo-shape-pick .pomo-shape-opt").forEach(b =>
      b.setAttribute("aria-checked", b.dataset.shape === v ? "true" : "false"));
    return v;
  }

  function setPomoShape(shape) {
    const v = applyPomoShape(shape);
    try { window.AppStore?.setItem(SHAPE_KEY, v); } catch (e) {}
    /* 방금 보이게 된 쪽은 값이 비어 있을 수 있으니 그 자리에서 채웁니다 */
    renderDayRing();
    renderPomoHeadState();
  }
  window.setPomoShape = setPomoShape;

  const RING_R_DAY = 86, RING_R_POM = 66;

  function _ringSet(id, r, ratio) {
    const c = document.getElementById(id);
    if (!c) return;
    const len = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(1, Number(ratio) || 0));
    c.setAttribute("stroke-dasharray", len.toFixed(2));
    c.setAttribute("stroke-dashoffset", (len * (1 - p)).toFixed(2));
  }

  /** 오늘 내가 일한 밀리초 — 카드에 뜨는 ⏱ 과 같은 값 */
  function _todayWorkMs() {
    try {
      const nick = (typeof myNick === "string" && myNick) ? myNick : window.myNick;
      const row = (window._statusCache || {})[nick];
      return Math.max(0, Number(row && row.workMs || 0));
    } catch (e) { return 0; }
  }

  /** 하루 목표 시간 (시간 단위, 안 정했으면 0) */
  function goalHours() {
    const v = Number(window._goalHours);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }

  function _hm(ms) {
    const m = Math.round(ms / 60000);
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
  }

  function updatePomoProgressBar(totalSec, remainingSec) {
    /* ── 안쪽 : 뽀모 ── */
    const total = Math.max(1, Number(totalSec || 1));
    const remain = Math.max(0, Number(remainingSec || 0));
    const done = Math.max(0, total - remain);
    _ringSet("ring-pom", RING_R_POM, done / total);

    /* ── 바깥 : 오늘 작업 시간 ── */
    renderDayRing();

    /* 가로 바 — 원형과 같은 값입니다 (모양만 다릅니다) */
    const pom = document.getElementById("pomo-bar-pom");
    if (pom) pom.style.width = ((done / total) * 100).toFixed(2) + "%";

    /* 옛 가로 바가 남아 있는 화면(단일파일 등)에서도 어긋나지 않게 */
    const bar = document.getElementById("pomo-bar");
    if (bar) bar.style.width = ((done / total) * 100).toFixed(2) + "%";
  }

  function renderDayRing() {
    const wrap = document.getElementById("pomo-ring-wrap");
    const sub  = document.getElementById("pomo-ring-sub");
    const ms   = _todayWorkMs();
    const gh   = goalHours();

    if (wrap) wrap.classList.toggle("no-goal", gh <= 0);
    if (gh > 0) _ringSet("ring-day", RING_R_DAY, ms / (gh * 3600e3));

    if (sub) {
      sub.textContent = gh > 0
        ? `오늘 ${_hm(ms)} / ${gh % 1 ? gh.toFixed(1) : gh}h`
        : `오늘 ${_hm(ms)}`;
    }

    /* ── 가로 바도 같은 값으로 ── */
    const row = document.querySelector(".pomo-barrow");
    if (row) row.classList.toggle("no-goal", gh <= 0);
    const dayBar = document.getElementById("pomo-bar-day");
    if (dayBar && gh > 0) {
      const p = Math.max(0, Math.min(1, ms / (gh * 3600e3)));
      dayBar.style.width = (p * 100).toFixed(2) + "%";
    }
    const bsub = document.getElementById("pomo-bar-sub");
    if (bsub) {
      bsub.innerHTML = gh > 0
        ? `<b>${_hm(ms)}</b> / ${gh % 1 ? gh.toFixed(1) : gh}시간`
        : `오늘 <b>${_hm(ms)}</b>`;
    }
  }

  /* =====================================================================
     [뺌 2026-08-12] 머리말의 "집중 중 · 오늘 n회"
     ---------------------------------------------------------------------
     이 방에서는 🍅 를 **수확**합니다. 오늘 딴 토마토는 카드에도 뜨고
     🌾 토마토 수확왕 업적도 그걸로 셉니다. 같은 것을 머리말에 한 번 더
     적으면 숫자만 늘고 뜻은 안 늘어요.

     ★ 세는 일은 그대로입니다 — _getTodaySessionCount() 는 업적이 씁니다.
       "화면에서 안 보인다" 와 "안 센다" 는 전혀 다른 일이에요.

     ★ 부르는 곳이 여럿(script_realtime.js 포함)이라 빈 함수로 남깁니다.
       지우면 그쪽에서 터집니다.
     ===================================================================== */
  function renderPomoHeadState() { /* 화면 표시는 없앴습니다 */ }
  window.renderPomoHeadState = renderPomoHeadState;

  /* =====================================================================
     🍅 그림을 누르면 ⚙️ 설정 → 🍅 뽀모
     ---------------------------------------------------------------------
     카드 프사를 눌러 편집창이 열리는 것과 같은 결입니다. "이 모양을
     바꾸고 싶다" 는 생각이 드는 자리가 바로 그림 위니까요.

     ★ 남은 시간 알약(#timer-pill)은 뺍니다 — 그 안에도 눌리는 것이
       있어서, 통째로 먹으면 그쪽이 안 눌립니다.
     ===================================================================== */
  /* =====================================================================
     ★★ [고침 2026-08-12] 가로 바 숫자가 25:00 에서 안 움직이던 것
     ---------------------------------------------------------------------
     [무엇을 빠뜨렸나]
     남은 시간을 적는 곳은 **#timer-text** 하나뿐입니다(원형 안의 숫자).
     가로 바를 만들면서 자리(#pomo-bar-time)만 만들고, 거기에 숫자를
     넣는 코드를 안 붙였어요. 그래서 처음 그려진 25:00 이 그대로 남았습니다.

     [왜 세 군데를 고치지 않고 이렇게 하나]
     #timer-text 에 글자를 쓰는 곳이 세 군데입니다 —
       ① 1초마다 도는 몸통  ② "멈춰 있음" 그리기  ③ 집중 시간 입력칸
     세 곳에 한 줄씩 더 붙이면, 나중에 **네 번째 자리**가 생겼을 때 또
     빠집니다. 이 방에서 여러 번 겪은 사고예요.

     그래서 원본이 바뀌는 것을 지켜보다가 그대로 옮겨 적습니다.
     누가 어디서 쓰든 가로 바가 따라옵니다.
     ===================================================================== */
  function bindPomoTimeMirror() {
    const src = document.getElementById("timer-text");
    const dst = document.getElementById("pomo-bar-time");
    const pill = document.getElementById("timer-pill");
    const row = document.querySelector(".pomo-barrow");
    if (!src || !dst || src._mirrorBound) return;
    src._mirrorBound = true;

    const 옮기기 = () => {
      dst.textContent = src.textContent;
      /* 단계(집중·휴식·멈춤)도 함께 — 멈췄을 때 흐려지는 표시가
         원형에만 걸려 있으면 두 모양이 달라 보입니다. */
      if (row && pill) {
        row.dataset.phase = pill.dataset.phase || "idle";
        /* 임박 표시는 2026-08-12 에 없앴습니다 — 옮길 것이 없어요 */
      }
    };
    옮기기();
    try {
      new MutationObserver(옮기기).observe(src, {
        childList: true, characterData: true, subtree: true
      });
      if (pill) new MutationObserver(옮기기).observe(pill, {
        attributes: true, attributeFilter: ["data-phase", "class"]
      });
    } catch (e) { /* 아주 옛 브라우저 — 숫자만 안 따라올 뿐 나머지는 멀쩡합니다 */ }
  }

  function bindPomoShapeHit() {
    document.querySelectorAll(".pomo-shape-hit").forEach(el => {
      if (el._hitBound) return;
      el._hitBound = true;
      const 열기 = () => { openSettings(); openTab("pomo"); };
      el.addEventListener("click", (e) => {
        if (e.target.closest("#timer-pill, button, input, select, a")) return;
        열기();
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); 열기(); }
      });
    });
  }

  /* 🎯 목표 칸의 숫자를 바꾸면 — 이 기기와 서버에 함께 적습니다.
     ★ 목표는 **나만 봅니다.** 카드에 나가지 않아요 — 남과 견주는
       숫자를 하나 더 만들지 않으려고요. */
  let _goalSaveT = null;
  function saveGoalHours() {
    const inp = document.getElementById("db-goal-hours");
    if (!inp) return;
    const raw = String(inp.value || "").trim();
    const v = raw === "" ? 0 : Math.max(0, Math.min(24, Number(raw) || 0));
    window._goalHours = v;
    try { window.AppStore?.setItem("goalHours", String(v)); } catch (e) {}
    renderDayRing();

    clearTimeout(_goalSaveT);
    _goalSaveT = setTimeout(() => {
      try {
        const nick = (typeof myNick === "string" && myNick) ? myNick : window.myNick;
        if (nick && window.db) window.db.ref(`users/${nick}/prefs/goalHours`).set(v);
      } catch (e) {}
    }, 600);
  }

  async function loadGoalHours() {
    let v = 0;
    try { v = Number(window.AppStore?.getItem("goalHours") || 0) || 0; } catch (e) {}
    try {
      const nick = (typeof myNick === "string" && myNick) ? myNick : window.myNick;
      if (nick && window.db) {
        const snap = await window.db.ref(`users/${nick}/prefs/goalHours`).once("value");
        const sv = Number(snap.val());
        if (Number.isFinite(sv) && sv >= 0) v = sv;   // 서버 값이 우선
      }
    } catch (e) {}
    window._goalHours = v;
    const inp = document.getElementById("db-goal-hours");
    if (inp) inp.value = v > 0 ? String(v) : "";
    renderDayRing();
  }

  window.saveGoalHours = saveGoalHours;
  window.loadGoalHours = loadGoalHours;
  window.renderDayRing = renderDayRing;

  function _todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  /* [고침 2026-08-03] 🍅 오늘 집중 횟수 — 닉네임 귀속으로.
     기기 단위 키(pomoSessions_날짜)로 저장하던 탓에, 같은 브라우저에서
     새 닉네임으로 들어오면 이전 닉네임이 쌓은 오늘 횟수를 물려받았습니다. */
  function _sessKey() {
    return `pomoSessions_${myNick || "게스트"}_${_todayKey()}`;
  }
  function _getTodaySessionCount() {
    return Number(AppStore.getItem(_sessKey()) || 0);
  }

  function _setTodaySessionCount(v) {
    AppStore.setItem(_sessKey(), String(Math.max(0, Number(v || 0))));
  }

  /* 화면 표시는 없앴지만 집계는 계속 쌓입니다(추후 통계용). */
  function renderTodaySessionCount() {
    /* [2026-08-12] 머리말의 "집중 중 · 오늘 n회" 도 같은 값을 씁니다.
       세는 곳은 하나(_getTodaySessionCount)로 두고, 보여주는 곳만 둘입니다. */
    renderPomoHeadState();
    const el = document.getElementById("today-session-count");
    if (!el) return;
    el.textContent = `오늘 집중 ${_getTodaySessionCount()}회`;
  }

  async function incrementTodayFocusSessions() {
    /* [고침 2026-08-06] "참여 중일 때만 센다"는 조건을 뺐습니다.

       예전에는 타이머가 방 전체에서 하나로 돌아서, 참여를 끈 사람의
       화면에서도 세션이 끝나면 이 함수가 불렸습니다. 그래서 막아야 했어요.
       지금은 내가 직접 시작한 내 타이머만 여기까지 옵니다. 소리를 껐다고
       내가 한 집중을 안 센다면 그게 더 이상하죠.

       [FIX] 자리비움인데 🍅 가 쌓이던 문제 — 이건 그대로 둡니다.
       자리를 비운 채 타이머만 굴러가는 경우가 있어서요.
       휴식은 일부러 그대로 셉니다. 뽀모의 휴식 구간과 상태의 "휴식"이
       겹치는 순간이 흔해서, 빼면 정상적으로 집중한 회차까지 사라집니다. */
    const st = document.getElementById("db-status")?.value || "";
    if (st === "away") return;

    const next = _getTodaySessionCount() + 1;
    _setTodaySessionCount(next);
    renderTodaySessionCount();

    if (myNick) {
      try {
        await db.ref(`users/${myNick}/pomoSessions/${_todayKey()}`).set({
          count: next,
          updatedAt: Date.now()
        });
      } catch (e) {}
    }

    // 카드에 바로 반영되도록 상태를 한 번 다시 써줍니다
    window.updateStatus?.(false);
  }

  async function loadTodayFocusSessions() {
    renderTodaySessionCount();
    if (!myNick) return;
    try {
      const snap = await db.ref(`users/${myNick}/pomoSessions/${_todayKey()}`).once("value");
      const v = snap.val();
      if (v && typeof v.count === "number") {
        _setTodaySessionCount(v.count);
      } else {
        /* 서버에 오늘 기록이 없으면 0 — 남은 옛 값을 믿지 않습니다 */
        _setTodaySessionCount(0);
      }
      renderTodaySessionCount();
      window.updateStatus?.(false);
    } catch (e) {}
  }

  // 카드가 읽어 갈 수 있도록 밖으로 내줍니다
  window.getTodayFocusSessions = _getTodaySessionCount;

  function _ensurePomoStatusLine() {
    let el = document.getElementById("pomo-status-line");
    if (el) return el;

    const chatSidebar = document.querySelector(".chat-sidebar");
    const header = chatSidebar ? chatSidebar.querySelector(".header") : null;
    if (!chatSidebar || !header) return null;

    el = document.createElement("div");
    el.id = "pomo-status-line";
    el.className = "pomo-status-line hidden";
    // ✅ 채팅 상단 초대형 고정 타이머: 태그(모드 표시) + 큰 숫자
    el.innerHTML = `
      <span class="tag" id="pomo-mega-tag">🍅 집중 세션 중</span>
      <span class="pomo-mega-digits" id="pomo-mega-digits">00:00</span>
    `;
    header.insertAdjacentElement("afterend", el);
    return el;
  }

  function _fmtMMSS(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  // ✅ 뽀모도로가 진행 중이면(집중/휴식 모두) 채팅 상단에 아주 크고 굵은 숫자로 고정 표시
  function updatePomoHeaderStatus(state) {
    const line = _ensurePomoStatusLine();
    if (!line) return;

    const tag    = document.getElementById("pomo-mega-tag");
    const digits = document.getElementById("pomo-mega-digits");

    const running = !!state?.running;
    const mode    = String(state?.mode || "");
    const remain  = Number(state?.remainingSec ?? state?.remaining ?? 0);

    if (!running) {
      line.classList.add("hidden");
      line.classList.remove("pomo-mega-warn");
      return;
    }

    line.classList.remove("hidden");
    line.dataset.mode = (mode === "rest") ? "rest" : "work";

    /* [2026-08-03] "집중 세션 중" 문구는 뺐습니다 — 아이콘만 */
    if (tag) tag.textContent = (mode === "rest") ? "☕" : "🍅";
    if (digits) digits.textContent = _fmtMMSS(remain);

    /* [뺌 2026-08-12] 임박 강조 — 없앴습니다. (이 줄 자체가 화면에서
       빠져 있어 보이지도 않던 코드예요) */
    line.classList.remove("pomo-mega-warn");
  }

  // ✅ 뽀모도로 호스트 시간 설정 UI: 실행 중이면 잠그고, 진행 중인 세션의 실제 시간을 보여줌
  function updatePomoSetupUI(state) {
    const wrap        = document.getElementById("pomo-setup");
    const runningBadge = document.getElementById("pomo-setup-running");
    const workInput    = document.getElementById("pomo-work-min");
    const restInput    = document.getElementById("pomo-rest-min");
    if (!wrap) return;

    const running = !!state?.running;

    if (running) {
      wrap.classList.add("locked");
      if (workInput) workInput.disabled = true;
      if (restInput) restInput.disabled = true;

      const workMin = Number.isFinite(state.workMin) ? state.workMin : Number(workInput?.value || 25);
      const restMin = Number.isFinite(state.restMin) ? state.restMin : Number(restInput?.value || 5);
      if (workInput) workInput.value = workMin;
      if (restInput) restInput.value = restMin;

      if (runningBadge) {
        runningBadge.textContent = `⏳ 진행 중 (${workMin}분 / ${restMin}분)`;
        runningBadge.classList.remove("hidden");
      }
    } else {
      wrap.classList.remove("locked");
      if (workInput) workInput.disabled = false;
      if (restInput) restInput.disabled = false;
      if (runningBadge) runningBadge.classList.add("hidden");
    }
  }

  // =====================================================
  // ✅ Font size (유지)
  // =====================================================
  const FONT_MIN = 12;
  /* 말풍선이 실제로 이 크기로 보이게 고쳤으므로(styles.css .msg-bubble)
     더 키우고 싶은 분을 위해 상한을 올렸습니다. */
  const FONT_MAX = 30;
  const FONT_STEP = 1;

  function getCurrentFontSize() {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--font-size").trim().replace("px","");
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 18;
  }

  function setFontSize(px) {
    const next = Math.max(FONT_MIN, Math.min(FONT_MAX, px));
    document.documentElement.style.setProperty("--font-size", `${next}px`);
    AppStore.setItem("writerFontSize", String(next));
    updateFontPill(next);
  }

  let _fontPillTimer = null;
  function updateFontPill(size) {
    const pill = document.getElementById("font-size-pill");
    if (!pill) return;

    pill.textContent = `${size}px`;
    pill.style.transform = "scale(1.03)";
    pill.style.background = "rgba(10,132,255,.10)";

    if (_fontPillTimer) clearTimeout(_fontPillTimer);
    _fontPillTimer = setTimeout(() => {
      pill.style.transform = "scale(1)";
      pill.style.background = "rgba(255,255,255,.72)";
    }, 220);
  }

  /* ===================================================================
     프로필 카드 크기 — 머리말의 [− 🪪 100% +]
     ---------------------------------------------------------------------
     채팅 글씨 크기(--font-size)와는 완전히 별개입니다.
     기준 폭 229px에 배율을 곱해 --card-w 를 바꾸면, 카드 격자가
     그 폭에 맞춰 한 줄에 들어가는 장수를 알아서 다시 계산합니다.
     이 기기에만 저장돼요.
     =================================================================== */
  /* [삭제] 머리말의 프로필 카드 크기 조절은 요청에 따라 없앴습니다.
     카드 폭은 styles.css 의 --card-w 값(214px)으로 고정됩니다.
     저장돼 있던 값이 남아 화면이 예전 크기로 나오지 않도록 지워줍니다. */
  function applySavedCardScale() {
    try { AppStore.removeItem("writerCardScale"); } catch (e) {}
    document.documentElement.style.removeProperty("--card-w");
  }
  window.applySavedCardScale = applySavedCardScale;

  function increaseFont() { setFontSize(getCurrentFontSize() + FONT_STEP); }
  function decreaseFont() { setFontSize(getCurrentFontSize() - FONT_STEP); }

  function applySavedFontSize() {
    const saved = parseInt(AppStore.getItem("writerFontSize") || "", 10);
    if (Number.isFinite(saved)) setFontSize(saved);
    else updateFontPill(getCurrentFontSize());
  }

  // =====================================================
  // ✅ join 이후 초기화 훅 (core가 호출)
  // =====================================================
  window.afterJoinInitSoundPrefs = async function() {
    try {
      const v = AppStore.getItem(_nickKey("pomoParticipating"));
      if (v === "true" || v === "false") _pomoParticipating = (v === "true");
    } catch(e) {}

    try {
      const c = AppStore.getItem(_nickKey("pomoDetailCollapsed"));
      if (c === "true" || c === "false") {
        const detail = document.getElementById("pomo-detail");
        const btn = document.getElementById("pomo-detail-toggle");
        if (detail && btn) {
          detail.classList.toggle("collapsed", c === "true");
          btn.setAttribute("aria-expanded", c === "true" ? "false" : "true");
        }
      }
    } catch(e) {}

    await loadSoundPrefsFromFirebase();
    await loadPomoParticipationFromFirebase();
    await loadTodayFocusSessions();

    _renderParticipationButton();
    renderPomodoroSoundMini();
    renderPomoHeadState();
  };

  /* [고침 2026-08-09] 입장 직후 테마 적용.

     예전에는 `applyTheme(await loadThemeForNick())` 였습니다. 그런데 남은
     쪽(script_data.js) 은 스스로 테마를 칠하고 **아무것도 돌려주지 않습니다.**
     그래서 undefined 가 applyTheme 로 들어가 기본 테마로 되돌아갔고,
     곧이어 loadPersonalData 가 제 테마를 다시 칠했습니다.
     입장할 때마다 [내 테마 → 기본 → 내 테마] 로 한 번 번쩍인 이유예요.
     게다가 그 undefined 가 "undefined" 라는 글자로 저장까지 됐습니다.

     이제 부르기만 합니다. 칠하는 일은 그쪽이 알아서 해요. */
  window.afterJoinLoadNickTheme = async function() {
    await window.loadThemeForNick?.();
  };

  // =====================================================
  // ✅ DOMContentLoaded (로그인 전 기본 세팅 + Layout/Narrow FIX)
  // =====================================================
  document.addEventListener("DOMContentLoaded", () => {
    // ✅ layout/narrow 먼저
    applySavedLayout();
    applySavedOrientation();
    maybeSuggestPortrait();
    applyChatOnlyModeIfMobile();
    if (!window.isMobile) applyNarrowChatFocus();

    // renderChatMessage wrapper는 렌더 함수 생긴 뒤에 설치
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      const ok = installChatRenderDedupeWrapper();
      if (ok || tries >= 25) clearInterval(t);
    }, 80);

    applySavedFontSize();
    applySavedCardScale();
    applyTheme(currentTheme);
    renderThemePalette();
    renderTodaySessionCount();

    /* 🍅 타이머 모양 — 저장해 둔 것으로 바로 맞춥니다.
       ★ 로그인 전에도 해야 합니다. 나중에 하면 켤 때마다 원형이 잠깐
         보였다가 가로 바로 바뀌어 번쩍입니다. */
    applyPomoShape(loadPomoShape());
    bindPomoTimeMirror();
    bindPomoShapeHit();
    document.getElementById("pomo-shape-pick")?.addEventListener("click", (e) => {
      const b = e.target.closest(".pomo-shape-opt");
      if (b) setPomoShape(b.dataset.shape);
    });

    _renderParticipationButton();

    // chat width 복원(있으면)
    const cw = parseInt(AppStore.getItem("chatWidth") || "", 10);
    if (Number.isFinite(cw)) resizeChat(cw);
  });

  // =====================================================
  // Admin Easter Egg — [2026-08-06] 없앴습니다
  // =====================================================
  /* 예전에는 설정 › 개인정보의 "로컬 설정 초기화" 제목을 7번 누르면
     관리자 모드 블록(#admin-easter)이 나타났습니다. 그 블록을 통째로
     걷어냈으므로(관리자 일은 admin.html 이 합니다) 여기도 아무것도
     하지 않습니다.

     제목에 cursor:pointer 를 씌우던 것도 함께 뺐습니다 — 그것만으로도
     "여기 뭔가 있다"는 흔적이 되니까요.

     함수 자체는 남겨둡니다. script_core.js 와 script_realtime.js 가
     여러 곳에서 부르고 있어서, 이름이 사라지면 그쪽을 다 손봐야 해요. */
  function bindAdminEasterEgg() { /* 하는 일 없음 */ }
  function refreshAdminUiVisibility() { /* 하는 일 없음 */ }

  window.bindAdminEasterEgg = bindAdminEasterEgg;
  window.refreshAdminUiVisibility = refreshAdminUiVisibility;

  // =====================================================
  // exports
  // =====================================================
  window.applyTheme = applyTheme;
  window.renderThemePalette = renderThemePalette;
  window.openSettings = openSettings;
  window.closeSettings = closeSettings;
  window.openTab = openTab;
  window.resizeChat = resizeChat;
  window.applyTimerVisibility = applyTimerVisibility;

  window.increaseFont = increaseFont;
  window.decreaseFont = decreaseFont;
  window.applySavedFontSize = applySavedFontSize;

  window.playPomodoroSound = playPomodoroSound;
  window.testPresetSound = testPresetSound;

  /* =====================================================================
     ⌨️ 한글 조합 블랙박스 — imeDiag() (2026-08-13)
     ---------------------------------------------------------------------
     "베ㄹㅔ니ㅁㅣ" 처럼 자모가 안 뭉치고 낱개로 찍히는 일이 보고됐습니다.
     조합(ㅂ+ㅔ→베)이 음절이 되기 전에 끊기는 것인데, 끊는 손은 보통
     넷 중 하나예요 — 입력칸이 DOM 에서 옮겨짐 · 강제 blur/focus ·
     코드가 커서를 옮김 · 코드가 값을 씀. 정적으로는 범인이 안 보여서,
     **끊기는 순간을 현장에서 잡는** 블랙박스를 둡니다.

     쓰는 법: 콘솔(F12)에 imeDiag() → 채팅에 한글을 쳐서 재현 →
     증상이 나면 🚨 와 함께 직전 기록이 찍힙니다. 그걸 캡쳐하면 됩니다.

     ★★★ [고침 2026-08-17] 판정을 바꿨습니다 — 처음 규칙이 틀렸어요.
     처음에는 "조합이 **자모 한 개**로 끝나면 무조건 비정상" 으로 봤습니다.
     그런데 한국 사람은 자모 낱개를 **일부러** 칩니다 —
       ㅋㅋㅋ  ㅎㅎ  ㅜㅜ  ㅠㅠ  ㅇㅇ  ㄷㄷ
     방장이 검사를 켜고 "계속 ㅜㅜ ㅋㅋ" 를 쳤더니 🚨 가 줄줄이 떴어요.
     전부 정상 타자였습니다. 이 방은 웹소설 작가들이 쓰는 곳이라
     ㅋㅋㅋ 가 안 나오는 게 오히려 이상합니다. 규칙이 세상을 몰랐어요.

     [지금 규칙 — "후퇴"를 봅니다]
     조합은 앞으로만 자랍니다: ㄱ → 가 → 간. 그러니
       · 끝난 값이 **마지막으로 자란 모양과 다르면** (간 까지 갔는데 ㄱ 로 끝남)
       · 또는 끝난 값이 **비어 있으면** (자란 게 통째로 사라짐)
     그때만 신고합니다. ㅋ 하나만 치고 ㅋ 로 끝나는 건 후퇴가 아니에요.
     ★ "겟 → 게" 처럼 조합 **도중** 짧아지는 건 정상입니다 — 받침이
       다음 글자로 넘어가는 것뿐이에요(계속: 겟+ㅗ → 게+소). 그래서
       가장 길었던 값이 아니라 **마지막 값**과 견줍니다.

     [자모가 조합을 안 거치는 그물도 3개 연속부터]
     ㅋ 한 번은 예사입니다. "베ㄹㅔ니ㅁㅣ" 처럼 **연달아** 나올 때만
     신고해요.

     [★ 진짜 증거는 따로 있습니다]
     후퇴보다 확실한 건 이 둘입니다. 하나라도 찍히면 그게 범인이에요.
       ★★ 입력칸이 옮겨지거나 지워짐   ← 조합 중에 DOM 이 흔들림
       blur ← … ★ 조합 중이었음!        ← 조합 중에 초점이 뺏김
     ===================================================================== */
  window.imeDiag = function () {
    if (window._imeDiagStop) window._imeDiagStop();

    const 기록 = [];
    const t0 = performance.now();
    const 이름 = (n) => n ? (n.id ? "#" + n.id : (n.className ? "." + String(n.className).split(" ")[0] : n.nodeName)) : "?";
    const 적기 = (m) => {
      기록.push(`[${(performance.now() - t0).toFixed(0).padStart(6)}ms] ${m}`);
      if (기록.length > 300) 기록.shift();
    };

    let 조합중 = false, 칸 = null;
    let 마지막모양 = "";     // 이번 조합에서 마지막으로 자란 모양
    let 마지막때 = -1e9;     // 그 시각 — 커서 움직임이 내 타자 탓인지 가리는 데 씁니다
    let 맨자모연속 = 0;      // 조합을 안 거친 자모가 몇 개나 잇달았나

    const 신고 = (왜) => {
      console.warn("🚨 " + 왜 + " — 직전 기록:");
      console.log(기록.slice(-30).join("\n"));
      console.log("── 이 내용을 통째로 캡쳐해 주세요 ──");
    };

    const onStart = (e) => {
      조합중 = true; 칸 = e.target;
      마지막모양 = ""; 마지막때 = performance.now(); 맨자모연속 = 0;
      적기(`조합 시작 @${이름(e.target)}`);
    };
    const onUpd   = (e) => {
      마지막모양 = e.data || "";
      마지막때 = performance.now();
      적기(`조합 중 "${e.data}"`);
    };
    const onEnd   = (e) => {
      조합중 = false;
      const 끝 = e.data || "";
      적기(`조합 끝 "${끝}" @${이름(e.target)}`);
      /* ★ 후퇴만 봅니다 — ㅋㅋ·ㅜㅜ 는 일부러 치는 글자예요 (위 머리말) */
      if (마지막모양 && !끝) {
        신고(`"${마지막모양}" 까지 조합됐는데 아무것도 안 남고 사라졌습니다`);
      } else if (마지막모양 && 끝 !== 마지막모양 && 끝.length < 마지막모양.length) {
        신고(`조합이 "${마지막모양}" 까지 갔다가 "${끝}" 로 후퇴했습니다`);
      }
      마지막모양 = ""; 맨자모연속 = 0;
    };
    /* ★ 그물 둘 — 조합을 **거치지도 않고** 자모가 낱개로 박히는 경우.
       (조합이 끊기는 게 아니라 시작조차 못 하는 형태면 위 그물엔 안 걸려요)
       ★ 3개 연속부터 신고합니다. ㅋ 한 번은 예사고, "베ㄹㅔ니ㅁㅣ" 처럼
         잇달아 박힐 때가 진짜예요. */
    const onInput = (e) => {
      if (e.isComposing) return;
      if (/^[ㄱ-ㅎㅏ-ㅣ]$/.test(e.data || "")) {
        맨자모연속++;
        적기(`조합 없이 자모 입력 "${e.data}" (${맨자모연속}번째 연속) @${이름(e.target)}`);
        if (맨자모연속 >= 3) {
          신고(`자모 ${맨자모연속}개가 잇달아 조합 없이 들어왔습니다!`);
          맨자모연속 = 0;
        }
      } else if (e.data) {
        맨자모연속 = 0;
      }
    };
    const onFocus = (e) => { if (e.target?.tagName === "TEXTAREA" || e.target?.tagName === "INPUT") 적기(`focus → ${이름(e.target)}`); };
    const onBlur  = (e) => { if (e.target?.tagName === "TEXTAREA" || e.target?.tagName === "INPUT") 적기(`blur ← ${이름(e.target)}${조합중 ? "  ★ 조합 중이었음!" : ""}`); };
    /* ★ [고침 2026-08-17] 예전에는 조합 중 커서가 움직일 때마다 적었습니다.
       그런데 **글자를 치면 커서는 당연히 움직입니다.** 한 타에 한 줄씩
       쌓여서 정작 봐야 할 줄이 파묻혔어요 (실제 로그가 절반이 이것이었습니다).
       내 타자 직후(40ms 안)의 움직임은 조용히 넘기고, **누가 딴 데서
       커서를 옮긴 경우만** 적습니다 — 그게 조합을 끊는 손이거든요. */
    const onSel   = () => {
      if (!조합중 || !칸) return;
      if (performance.now() - 마지막때 < 40) return;   // 방금 친 글자 때문 — 예사
      적기(`★ 누군가 커서를 옮겼습니다 @${이름(document.activeElement)}`);
    };

    const mo = new MutationObserver((muts) => {
      if (!칸) return;
      muts.forEach(m => {
        const 이사 = [...m.addedNodes, ...m.removedNodes].some(n =>
          n === 칸 || (n.contains && n.contains(칸)));
        if (이사) 적기(`★★ 입력칸이 옮겨지거나 지워짐! ${m.target ? "부모 " + 이름(m.target) : ""}${조합중 ? "  (조합 중!)" : ""}`);
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("compositionstart", onStart, true);
    document.addEventListener("compositionupdate", onUpd, true);
    document.addEventListener("compositionend", onEnd, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("focusout", onBlur, true);
    document.addEventListener("selectionchange", onSel, true);

    window._imeDiagStop = () => {
      mo.disconnect();
      document.removeEventListener("compositionstart", onStart, true);
      document.removeEventListener("compositionupdate", onUpd, true);
      document.removeEventListener("compositionend", onEnd, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("focusout", onBlur, true);
      document.removeEventListener("selectionchange", onSel, true);
      window._imeDiagStop = null;
      try { window.AppStore?.removeItem("imeDiagOn"); } catch (e) {}
      console.log("[imeDiag] 껐습니다. (다음 접속에도 안 켜집니다)");
    };
    /* ★ 증상이 드물게 나서, 한 번 켜면 **다음 접속에도 켜진 채**로 둡니다.
       그날그날 콘솔을 다시 열 필요 없이, 걸리는 순간만 기다리면 돼요. */
    try { window.AppStore?.setItem("imeDiagOn", "1"); } catch (e) {}
    console.log("[imeDiag] 지켜보는 중 — 한글을 쳐서 증상을 재현해 주세요. 끄기: _imeDiagStop()");
    return "켜짐";
  };

  /* 지난번에 켜 뒀으면 입장하자마자 다시 켭니다 */
  try {
    if (window.AppStore?.getItem("imeDiagOn") === "1") {
      setTimeout(() => window.imeDiag(), 800);
    }
  } catch (e) {}

  /* =====================================================================
     ⇪ Caps Lock 지킴이 (2026-08-13)
     ---------------------------------------------------------------------
     맥에서 한/영 전환을 Caps Lock 으로 하다 보면, 실수로 Shift+Caps Lock
     을 눌러 **진짜 대문자 잠금**이 걸릴 때가 있습니다. 맥 한글 입력기는
     Caps Lock 이 켜진 채면 자모를 조합하지 않고 낱개로 풀어 칩니다 —
     "베" 가 "ㅂㅔ" 로. (방장이 겪은 "타자가 풀려요" 의 정체)

     증상만 보면 고장 같아서 키보드 탓, 사이트 탓을 하게 되니,
     입력칸에서 그 상태로 치는 순간 **방이 먼저 알려줍니다.**
     ★ 켜져 있는 동안 한 번만 — 매 타자마다 울리면 그게 더 시끄러워요.
     ===================================================================== */
  let _capsWarned = false;
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (!t || (t.tagName !== "TEXTAREA" && t.tagName !== "INPUT")) return;
    let on = false;
    try { on = e.getModifierState && e.getModifierState("CapsLock"); } catch (err) { return; }
    if (!on) { _capsWarned = false; return; }   // 풀리면 다음에 또 알려줄 수 있게
    if (_capsWarned) return;
    /* Caps Lock 키 자체를 누르는 중이면 넘어갑니다 — 막 끄는 참일 수 있어요 */
    if (e.key === "CapsLock") return;
    _capsWarned = true;
    window.showCommandToast?.("⇪ Caps Lock이 켜져 있어요 — 한글이 ㅂㅔ처럼 풀려서 쳐져요! (Shift+Caps Lock을 누르셨을 수 있어요)");
  }, true);

  window.updatePomoProgressBar = updatePomoProgressBar;
  window.incrementTodayFocusSessions = incrementTodayFocusSessions;
  window.renderTodaySessionCount = renderTodaySessionCount;

  window.updatePomoHeaderStatus = updatePomoHeaderStatus;
  window.updatePomoSetupUI = updatePomoSetupUI;

  window.loadSoundPrefsFromFirebase = loadSoundPrefsFromFirebase;
  window.loadPomoParticipationFromFirebase = loadPomoParticipationFromFirebase;


/* =====================================================================
   🕐 머리말 시계 (2026-08-14) — 한줄 공지가 있던 자리

   "8월 14일 (금)  PM 2:59 ☕" — 날짜·요일은 옅게, 시각은 진하게,
   PM 은 작게 (콩이 정한 모양). 오른쪽 이모지는 시간대 옷입니다:

     🦉 22시~새벽 2시   올빼미 (이 방의 황금 시간대라 제일 깁니다 ㅋㅋ)
     🌙 2~5   깊은 밤      🌅 5~7   새벽        🍳 7~9   아침밥
     ☀️ 9~12  오전         🍚 12~13 점심밥      ☕ 13~15 오후 커피
     🚶 15~17 산책         🌇 17~18 노을        🍽️ 18~19 저녁밥
     🌃 19~22 밤 작업

   1초마다 돌지만 하는 일이 글자 몇 개 비교뿐이라 무게는 없습니다.
   ===================================================================== */
(function () {
  "use strict";

  /* [시각, 이모지] — 그 시각부터 이 이모지. 22시 뒤와 2시 전은 🦉 */
  const CLOCK_EMOJI = [
    [2, "🌙"], [5, "🌅"], [7, "🍳"], [9, "☀️"], [12, "🍚"],
    [13, "☕"], [15, "🚶"], [17, "🌇"], [18, "🍽️"], [19, "🌃"], [22, "🦉"]
  ];
  const 요일 = ["일", "월", "화", "수", "목", "금", "토"];

  function emojiFor(h) {
    let e = "🦉";                       // 0~2시 — 올빼미의 연장전
    for (const [from, emo] of CLOCK_EMOJI) if (h >= from) e = emo;
    return e;
  }

  function tickHeadClock() {
    const d = document.getElementById("head-clock-date");
    if (!d) return;
    const n = new Date();
    d.textContent = `${n.getMonth() + 1}월 ${n.getDate()}일 (${요일[n.getDay()]})`;
    const h = n.getHours();
    const ap = document.getElementById("head-clock-ap");
    const t = document.getElementById("head-clock-time");
    const emo = document.getElementById("head-clock-emo");
    if (ap) ap.textContent = h < 12 ? "AM" : "PM";
    if (t) t.textContent = `${h % 12 || 12}:${String(n.getMinutes()).padStart(2, "0")}`;
    if (emo) emo.textContent = emojiFor(h);
  }
  tickHeadClock();
  setInterval(tickHeadClock, 1000);
  window.tickHeadClock = tickHeadClock;
})();

/* =====================================================================
   🖼️ 방 배경 (2026-08-14) — 젭처럼, 카드 마당 뒤에 은은하게

   [구조 — 세 겹]
     ① 배경 그림 (기본 5종 SVG 또는 내 사진)
     ② 덮개 — 테마 종이색을 반투명으로 (농도는 각자 40~96%)
     ③ 카드들
   덮개가 테마색이라 잉크 테마면 미색, 마감 전야면 어두운 덮개가 깔려
   여덟 테마 어디서든 저절로 어울립니다.

   [저장은 이 기기에만 — 일부러]
   내 사진을 프로필(서버)에 올리면 **모든 멤버가 내 배경을 내려받게**
   됩니다(카드 프로필은 전원이 읽으니까). 배경은 내 화면에만 보이는
   것이라 localStorage 가 맞아요. 사진은 긴 변 1600px 로 줄여 저장합니다
   — 브라우저 저장 한도(약 5MB)를 지키기 위해서요.

   [기본 배경 5종]
   그림 파일 없이 SVG 를 코드로 품고 있습니다 — 납작한 색면으로 그린
   사무실·스터디 카페·서재·야외 카페·창가. 한 장에 1~2KB 라 가볍습니다.
   ===================================================================== */
(function () {
  "use strict";

  const BG_KEY = "roomBg";          // none | office | studycafe | library | terrace | window | custom
  const VEIL_KEY = "roomBgVeil";    // 40~96 (%)
  const PHOTO_KEY = "roomBgPhoto";  // 내 사진 (dataURL, 줄여서)
  const VEIL_DEF = 82;

  /* =====================================================================
     ---- 기본 배경 — 🖍️ 짱구 9장 (2026-08-15) ----
     ---------------------------------------------------------------------
     [바뀐 것] 예전에는 사무실·스터디 카페·서재·야외 카페·창가를 **SVG 로
     코드 안에 그려** 넣었습니다. 한 장에 1~2KB 라 가볍긴 했지만 납작한
     색면이라 밋밋했어요. 방장 요청으로 짱구 그림 9장으로 바꿉니다.

     [파일로 두는 이유] SVG 는 코드였지만 이건 사진입니다. data URL 로
     품으면 script 가 그만큼 무거워지고, 안 고른 배경까지 매번 받게 돼요.
     bg/ 폴더에 두면 **고른 사람만, 한 번만** 받고 그 뒤로는 브라우저가
     기억합니다.

     [통신량] 이 그림들은 깃허브 페이지가 내보냅니다 — 파이어베이스와
     아무 상관이 없어요. 무료치를 축내지 않습니다.

     [크기] 긴 변 1600px, 75~250KB. 배경은 덮개(기본 82%) 아래로 은은하게
     비치는 것이라 이보다 클 이유가 없습니다. 원본 30MB → 1.4MB.
     ===================================================================== */
  const 장면 = {
    field:    "bg/field.jpg",      // 🦋 들판
    cloud:    "bg/cloud.jpg",      // ☁️ 구름 보는 날
    country:  "bg/country.jpg",    // 🚙 시골길
    pool:     "bg/pool.jpg",       // 🏊 물놀이
    cafe:     "bg/cafe.jpg",       // ☕ 벚꽃 카페
    toys:     "bg/toys.jpg",       // 🧸 장난감
    seaside:  "bg/seaside.jpg",    // 🚌 바닷가 정류장
    campfire: "bg/campfire.jpg",   // 🔥 밤 모닥불
    books:    "bg/books.jpg"       // 📚 책방 앞
  };

  /* 옛 이름으로 저장해 둔 분들을 데려옵니다 — 안 하면 배경이 그냥
     사라져서 "설정이 날아갔나" 싶어집니다 (가장 가까운 그림으로) */
  const 옛이름 = {
    office: "cloud", studycafe: "cafe", library: "books",
    terrace: "field", window: "seaside"
  };

  function 그림주소(id) {
    if (id === "custom") return AppStore.getItem(PHOTO_KEY) || "";
    return 장면[id] || "";
  }

  /** 저장된 값 읽기 — 옛 이름이면 새 이름으로 바꿔 두고 돌려줍니다 */
  function 지금배경() {
    let id = AppStore.getItem(BG_KEY) || "none";
    if (옛이름[id]) {
      id = 옛이름[id];
      try { AppStore.setItem(BG_KEY, id); } catch (e) {}
    }
    return id;
  }

  /* ---- 적용 — 몸통(body)에 그림+덮개를 깝니다.
     [고침 2026-08-14] 카드 마당에만 깔았더니 헤드·바텀이 섬처럼 따로
     놀았어요. body 에 깔면 화면 전체가 한 장으로 이어집니다. ---- */
  function applyRoomBg() {
    const b = document.body;
    if (!b) return;
    const id = 지금배경();
    const src = id === "none" ? "" : 그림주소(id);
    if (!src) {
      b.classList.remove("room-bg-on");
      b.style.removeProperty("--room-bg-img");
      b.style.removeProperty("--room-veil");
      return;
    }
    /* 덮개 색 = 지금 테마의 종이색. 계산된 값을 읽어야 8테마 다 맞아요.
       ★ 반드시 클래스를 붙이기 **전에** 읽습니다 — 붙인 뒤에 읽으면
         저번 그림이 섞인 값이 나올 수 있어요 */
    b.classList.remove("room-bg-on");
    const veil = Math.max(40, Math.min(96, Number(AppStore.getItem(VEIL_KEY)) || VEIL_DEF));
    let base = getComputedStyle(b).backgroundColor || "rgb(250,246,236)";
    const m = base.match(/(\d+),\s*(\d+),\s*(\d+)/);
    const rgba = m ? `rgba(${m[1]},${m[2]},${m[3]},${veil / 100})` : `rgba(250,246,236,${veil / 100})`;
    b.style.setProperty("--room-bg-img", `url("${src}")`);
    b.style.setProperty("--room-veil", rgba);
    b.classList.add("room-bg-on");
  }
  window.applyRoomBg = applyRoomBg;

  /* ---- 내 사진 — 긴 변 1600px 로 줄여 이 기기에 저장 ---- */
  function shrinkPhoto(file, cb) {
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k);
      cv.height = Math.round(img.height * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv.toDataURL("image/jpeg", 0.78));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => cb("");
    img.src = URL.createObjectURL(file);
  }

  /* ---- 설정 (🎨 테마 탭) ---- */
  function bindRoomBgUI() {
    const sel = document.getElementById("set-roombg");
    const rng = document.getElementById("set-roombg-veil");
    const val = document.getElementById("set-roombg-veilv");
    const file = document.getElementById("set-roombg-file");
    if (!sel || sel.__bound) return;
    sel.__bound = true;

    sel.value = 지금배경();
    const v0 = Math.max(40, Math.min(96, Number(AppStore.getItem(VEIL_KEY)) || VEIL_DEF));
    if (rng) rng.value = v0;
    if (val) val.textContent = v0 + "%";

    sel.onchange = () => {
      if (sel.value === "custom" && !AppStore.getItem(PHOTO_KEY)) {
        file?.click();               // 사진이 아직 없으면 먼저 고르게
        return;
      }
      AppStore.setItem(BG_KEY, sel.value);
      applyRoomBg();
    };
    /* [고침 2026-08-14] 사진 바꾸기 — "내 사진"이 이미 골라져 있으면
       같은 항목을 다시 눌러도 변화가 아니라서(onchange 안 옴) 폴더가
       안 떴어요. 바꾸는 길은 이 단추입니다. */
    const chg = document.getElementById("set-roombg-change");
    if (chg) chg.onclick = () => file?.click();
    if (file) file.onchange = () => {
      const f = file.files && file.files[0];
      file.value = "";
      if (!f) { sel.value = 지금배경(); return; }
      shrinkPhoto(f, (url) => {
        if (!url) { alert("사진을 읽지 못했어요."); return; }
        try {
          AppStore.setItem(PHOTO_KEY, url);
          AppStore.setItem(BG_KEY, "custom");
        } catch (e) {
          alert("사진이 너무 커서 저장하지 못했어요. 조금 작은 사진으로 다시 해 주세요.");
          return;
        }
        sel.value = "custom";
        applyRoomBg();
      });
    };
    if (rng) rng.oninput = () => {
      AppStore.setItem(VEIL_KEY, rng.value);
      if (val) val.textContent = rng.value + "%";
      applyRoomBg();
    };
  }
  window.bindRoomBgUI = bindRoomBgUI;

  /* 입장 화면이 그려진 뒤 한 번 — 저장해 둔 배경을 되살립니다 */
  window.addEventListener("load", () => setTimeout(applyRoomBg, 300));
})();
