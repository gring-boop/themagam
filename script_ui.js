
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

  function applyNarrowChatFocus() {
    const w = window.innerWidth || document.documentElement.clientWidth;
    const on = w <= 980;
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
    "📜 원고와 잉크":     { isDark:false, style:"ink",    bg:"#FAF6EC", text:"#2B2620", me:"#2B2620", other:"#FFFDF6", header:"#F4EEDF", meText:"#F5EFDF", otherText:"#2B2620", accent:"#B3372B" },
    "🌙 마감 전야":       { isDark:true,  style:"night",  bg:"#15171E", text:"#E6E4DC", me:"#FFB43C", other:"#232733", header:"#1B1E27", meText:"#231A05", otherText:"#E6E4DC", accent:"#FFB43C" },
    "💠 조용한 스튜디오": { isDark:false, style:"studio", bg:"#F1F2F4", text:"#20242B", me:"#2F6BFF", other:"#FFFFFF", header:"#FFFFFF", meText:"#FFFFFF", otherText:"#20242B", accent:"#2F6BFF" },
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
    const panel  = t.panel  || (isDark ? "rgba(22,24,28,.96)" : hexToRgba(bg, 0.70));
    const panel2 = t.panel2 || (isDark ? "rgba(22,24,28,.90)" : hexToRgba(bg, 0.62));
    const surface= t.surface|| (isDark ? "rgba(22,24,28,.88)" : hexToRgba(bg, 0.56));

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

    r.setProperty("--timer-a", hexToRgba(t.me || "#0A84FF", isDark ? 0.14 : 0.10));
    r.setProperty("--timer-b", hexToRgba("#30D158", isDark ? 0.14 : 0.10));
    r.setProperty("--timer-text", isDark ? "rgba(235,235,245,.92)" : "rgba(60,60,67,.95)");

    currentTheme = name;
    renderThemePalette();
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
          await saveThemeForNick(name);
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

  async function saveThemeForNick(themeName) {
    try {
      AppStore.setItem(_nickKey("writerTheme"), themeName);
      AppStore.setItem("writerTheme", themeName);
    } catch(e) {}

    if (!myNick || !window.db) return;

    try {
      await db.ref(`users/${myNick}/theme`).set({
        name: themeName,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn("[saveThemeForNick failed]", e);
    }
  }

  async function loadThemeForNick() {
    try {
      const localNick = AppStore.getItem(_nickKey("writerTheme"));
      if (localNick) return localNick;
    } catch(e) {}

    if (myNick && window.db) {
      try {
        const snap = await db.ref(`users/${myNick}/theme`).once("value");
        const v = snap.val();
        if (v && v.name) return String(v.name);
      } catch(e) {
        console.warn("[loadThemeForNick failed]", e);
      }
    }

    try {
      return AppStore.getItem("writerTheme") || "📜 원고와 잉크";
    } catch(e) {
      return "📜 원고와 잉크";
    }
  }

  // =====================================================
  // Settings modal
  // =====================================================
  let timerHidden = AppStore.getItem("timerHidden") === "true";
  let warnMinutes = parseInt(AppStore.getItem("warnMinutes") || "10", 10);

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

    const nsel = document.getElementById("set-narrow-panel");
    if (nsel) {
      nsel.value = window.narrowDefault?.() || "chat";
      nsel.onchange = () => window.setNarrowDefault?.(nsel.value);
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

    const warn = document.getElementById("set-warn-min");
    const warnLabel = document.getElementById("warn-min-label");
    if (warn && warnLabel) {
      warn.value = warnMinutes;
      warnLabel.innerText = String(warnMinutes);
      warn.oninput = () => {
        warnMinutes = parseInt(warn.value, 10);
        AppStore.setItem("warnMinutes", String(warnMinutes));
        warnLabel.innerText = String(warnMinutes);
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
    if (name === "theme") renderThemePalette();
    if (name === "chat") { renderLayoutPick(); window.bindLayoutUI?.(); window.renderSlotMap?.(); }
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
    if (!_pomoParticipating) return;         // 미참여면 알림도 없음
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

  /* [이식 2026-08-03 · 벨사탕 0802] 지금 도는 뽀모를 시작한 사람 — 참여 버튼에 표시 */
  let _pomoStarter = "";
  window.setPomoStarter = function (nick) {
    const n = String(nick || "");
    if (n === _pomoStarter) return;
    _pomoStarter = n;
    _renderParticipationButton();
  };

  function _renderParticipationButton() {
    /* 같은 스위치가 두 곳에 있습니다 — 뽀모도로 창과 설정 → 🍅 뽀모도로.
       둘이 다른 모습을 보이면 어느 쪽이 진짜인지 알 수 없으니
       한 함수에서 같이 칠합니다. */
    const btns = [
      document.getElementById("pomo-opt-btn"),
      document.getElementById("set-pomo-part")
    ].filter(Boolean);

    btns.forEach(btn => {
      if (_pomoParticipating) {
        btn.dataset.state = "on";
        btn.innerHTML = "Join ‣ 알림 ON" + (_pomoStarter
          ? ` // <span class="pomo-starter-lb">starter</span> <span class="pomo-starter-nm">${window.escapeHtml ? window.escapeHtml(_pomoStarter) : ""}</span>`
          : "");
        btn.classList.remove("danger");
        btn.classList.add("primary");
        btn.setAttribute("aria-pressed", "true");
      } else {
        btn.dataset.state = "off";
        btn.textContent = "Join ‣ 알림 OFF";
        btn.classList.remove("primary");
        btn.classList.add("danger");
        btn.setAttribute("aria-pressed", "false");
      }
    });
    {
    }
    // ✅ 미참가 시 뽀모 UI 전체를 은은한 회색으로
    document.body.classList.toggle("pomo-nonpart", !_pomoParticipating);
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
    btn.textContent = "🎵";

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

  function updatePomoProgressBar(totalSec, remainingSec) {
    const bar = document.getElementById("pomo-bar");
    if (!bar) return;

    const total = Math.max(1, Number(totalSec || 1));
    const remain = Math.max(0, Number(remainingSec || 0));
    const done = Math.max(0, total - remain);
    const pct = Math.max(0, Math.min(100, (done / total) * 100));

    bar.style.width = pct.toFixed(2) + "%";
  }

  function _todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  function _getTodaySessionCount() {
    const key = `pomoSessions_${_todayKey()}`;
    return Number(AppStore.getItem(key) || 0);
  }

  function _setTodaySessionCount(v) {
    const key = `pomoSessions_${_todayKey()}`;
    AppStore.setItem(key, String(Math.max(0, Number(v || 0))));
  }

  /* 화면 표시는 없앴지만 집계는 계속 쌓입니다(추후 통계용). */
  function renderTodaySessionCount() {
    const el = document.getElementById("today-session-count");
    if (!el) return;
    el.textContent = `오늘 집중 ${_getTodaySessionCount()}회`;
  }

  async function incrementTodayFocusSessions() {
    /* [FIX] 뽀모에 참여하지 않는 사람도 집중 횟수가 올라가던 문제

       타이머는 모두의 화면에서 함께 돌기 때문에, 세션이 끝나면
       참여 여부와 무관하게 이 함수가 불렸습니다. 그래서 "미참가"인데도
       카드에 🍅 개수가 붙었어요.
       참여 중일 때만 세도록 막습니다. */
    if (!_pomoParticipating) return;

    /* [FIX] 자리비움인데 🍅 가 쌓이던 문제

       참여를 끄지 않은 채 자리를 비우면, 남이 돌린 타이머가 끝날 때마다
       내 집중 횟수가 올라갔습니다. 자리에 없었으니 집중한 게 아닙니다.
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
        renderTodaySessionCount();
        window.updateStatus?.(false);
      }
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

    const warnMin = parseInt(AppStore.getItem("warnMinutes") || "10", 10);
    line.classList.toggle("pomo-mega-warn", remain <= warnMin * 60);
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
          btn.textContent = "🎵";
        }
      }
    } catch(e) {}

    await loadSoundPrefsFromFirebase();
    await loadPomoParticipationFromFirebase();
    await loadTodayFocusSessions();

    _renderParticipationButton();
    renderPomodoroSoundMini();
  };

  window.afterJoinLoadNickTheme = async function() {
    const theme = await loadThemeForNick();
    applyTheme(theme);
    try { AppStore.setItem("writerTheme", theme); } catch(e) {}
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

    _renderParticipationButton();

    // chat width 복원(있으면)
    const cw = parseInt(AppStore.getItem("chatWidth") || "", 10);
    if (Number.isFinite(cw)) resizeChat(cw);
  });

  // =====================================================
  // ✅ Admin Easter Egg (7번 클릭)
  // =====================================================
  let _adminClickCount = 0;
  let _adminClickTimer = null;
  let _adminLoggedIn = false;

  function bindAdminEasterEgg() {
    const titleEl = document.getElementById("reset-title");
    if (!titleEl || titleEl._adminBound) return;
    titleEl._adminBound = true;

    titleEl.style.cursor = "pointer";
    titleEl.title = "";

    titleEl.addEventListener("click", () => {
      _adminClickCount += 1;

      if (_adminClickTimer) clearTimeout(_adminClickTimer);
      _adminClickTimer = setTimeout(() => { _adminClickCount = 0; }, 2000);

      if (_adminClickCount >= 7) {
        _adminClickCount = 0;
        clearTimeout(_adminClickTimer);

        const egg = document.getElementById("admin-easter");
        if (egg) {
          egg.classList.remove("hidden");
          refreshAdminUiVisibility();
        }
      }
    });
  }

  function refreshAdminUiVisibility() {
    const egg = document.getElementById("admin-easter");
    const loginBtn = document.getElementById("admin-login-btn");
    const clearBtn = document.getElementById("admin-clear-btn");
    if (!egg) return;

    const isLoggedIn = AppSession.getItem("adminPinOk") === "true";
    _adminLoggedIn = isLoggedIn;

    if (loginBtn) loginBtn.classList.toggle("hidden", isLoggedIn);
    // ✅ admin-tools 전체 블록 토글 (핀 설정 + 채팅 삭제 포함)
    const adminTools = document.getElementById("admin-tools");
    if (adminTools) adminTools.classList.toggle("hidden", !isLoggedIn);

    // 버튼 이벤트 바인딩(중복 방지)
    if (loginBtn && !loginBtn._adminBound) {
      loginBtn._adminBound = true;
      loginBtn.addEventListener("click", () => {
        const ok = window.requireAdminPin?.();
        if (ok) refreshAdminUiVisibility();
      });
    }

    if (clearBtn && !clearBtn._adminBound) {
      clearBtn._adminBound = true;
      clearBtn.addEventListener("click", () => {
        window.clearAllChat?.();
      });
    }
  }

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

  window.updatePomoProgressBar = updatePomoProgressBar;
  window.incrementTodayFocusSessions = incrementTodayFocusSessions;
  window.renderTodaySessionCount = renderTodaySessionCount;

  window.updatePomoHeaderStatus = updatePomoHeaderStatus;
  window.updatePomoSetupUI = updatePomoSetupUI;

  window.loadSoundPrefsFromFirebase = loadSoundPrefsFromFirebase;
  window.loadPomoParticipationFromFirebase = loadPomoParticipationFromFirebase;

  window.saveThemeForNick = saveThemeForNick;
  window.loadThemeForNick = loadThemeForNick;
