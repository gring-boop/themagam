/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_profile.js — 채팅 접기 + 프로필 편집
   ---------------------------------------------------------------------
   기존 파일 수정을 최소화하려고 신규 모듈로 분리했습니다.
   index.html에서 script_realtime.js 다음에 로드됩니다.

   [1] 채팅 사이드바 접기/펼치기 (기기별 · localStorage)
   [2] 프로필 데이터 (닉네임별 · Firebase users/{닉}/profile)
   [3] 설정 모달 "프로필" 탭
   ===================================================================== */

/* =====================================================================
   [1] 채팅 사이드바 접기
   ===================================================================== */

let _chatCollapsed = false;
let _unreadWhileCollapsed = 0;

const COLLAPSE_KEY = "chatCollapsed";

/**
 * 접기 버튼을 쓸 수 있는 화면인지.
 * 모바일/좁은 화면은 이미 body.narrow-chat-focus(채팅만 남기는 모드)가
 * 동작 중이라, 여기서 또 접으면 화면에 아무것도 안 남습니다. → 비활성화.
 */
function _canCollapse() {
  if (window.isMobile) return false;
  return !document.body.classList.contains("narrow-chat-focus");
}

function applyChatCollapsed(collapsed, opts = {}) {
  const on = !!collapsed && _canCollapse();
  _chatCollapsed = on;

  document.body.classList.toggle("chat-collapsed", on);
  /* 채팅이 어느 자리에 있든 그 자리를 좁혀야 하므로 배치를 다시 만듭니다 */
  window.applyLayout?.();

  const rail = document.getElementById("chat-rail");
  const btn = document.getElementById("chat-collapse-btn");

  if (rail) rail.classList.toggle("hidden", !on);
  if (btn) {
    btn.setAttribute("aria-expanded", on ? "false" : "true");
    btn.setAttribute("aria-label", on ? "채팅 펼치기" : "채팅 접기");
  }

  if (!on) {
    // 펼치면 안 읽은 개수 초기화 + 하단으로
    _unreadWhileCollapsed = 0;
    renderRailBadge();
    setTimeout(() => window.scrollChatToBottom?.(true), 60);
  }

  if (!opts.silent) {
    try { AppStore.setItem(COLLAPSE_KEY, on ? "1" : "0"); } catch (e) {}
  }
}

function toggleChatCollapsed() {
  if (!_canCollapse()) return;
  applyChatCollapsed(!_chatCollapsed);
}

function applySavedChatCollapsed() {
  let saved = false;
  try { saved = AppStore.getItem(COLLAPSE_KEY) === "1"; } catch (e) {}
  applyChatCollapsed(saved, { silent: true });
}

function renderRailBadge() {
  const el = document.getElementById("chat-rail-badge");
  if (!el) return;
  const n = _unreadWhileCollapsed;
  el.textContent = n > 99 ? "99+" : String(n);
  el.classList.toggle("hidden", n <= 0);
}

/** 접힌 상태에서 새 메시지가 오면 레일 배지를 올린다 (chat 모듈에서 호출) */
function noteChatMessageWhileCollapsed() {
  if (!_chatCollapsed) return;
  _unreadWhileCollapsed += 1;
  renderRailBadge();
}

/* =====================================================================
   설정 → 개인정보 → "이 기기에서 설정 초기화"
   ---------------------------------------------------------------------
   원본부터 버튼만 있고 함수가 없어서, 누르면 콘솔에 에러만 나고
   아무 일도 일어나지 않던 자리입니다. 이제 실제로 동작합니다.

   지우는 것은 이 기기에만 저장되는 값들뿐입니다.
   프사·투두·목표처럼 닉네임에 묶여 서버에 있는 것은 건드리지 않습니다.
   ===================================================================== */
function resetLocalSettings() {
  const keys = [
    "writerTheme",          // 테마 (로그인 전 기본값)
    "writerFontSize",       // 글씨 크기
    "writerCardScale",      // 프로필 카드 크기
    "layoutOrient", "layoutOrientAsked",  // 모니터 방향
    "colChat", "colWork", "rowProf", "rowR1", "rowR2",   // 옛 칸 크기
    "splitSizeLand", "splitSizePort",  // 칸 크기
    "slotMapLand", "slotMapPort",      // 자리 배치
    "sidebarOrder",         // 채팅 좌/우 위치
    "timerHidden",          // 타이머 기본 숨김
    "warnMinutes",          // 임박 강조 기준
    "chatCollapsed",        // 채팅 접힘
    "pomoCollapsed"         // 뽀모도로 접힘
  ];

  if (!confirm(
    "이 기기에 저장된 화면 설정을 초기화할까요?\n\n" +
    "· 테마, 글씨 크기, 채팅 넓이와 위치, 접어둔 영역이 기본값으로 돌아갑니다.\n" +
    "· 프사, 투두, 오늘의 목표는 그대로 남습니다."
  )) return;

  try {
    keys.forEach(k => AppStore.removeItem(k));
    // 닉네임별로 저장된 테마 캐시도 함께 정리
    for (let i = AppStore.length - 1; i >= 0; i--) {
      const k = AppStore.key(i);
      if (k && k.startsWith("writerTheme_")) AppStore.removeItem(k);
    }
  } catch (e) {
    console.warn("[resetLocalSettings]", e);
  }

  alert("초기화했어요. 화면을 새로 불러올게요.");
  location.reload();
}
window.resetLocalSettings = resetLocalSettings;

/* =====================================================================
   칸 크기 조절
   ---------------------------------------------------------------------
   [이동] 예전엔 여기서 격자의 열·행 크기를 직접 다뤘습니다. 그런데
   격자는 세로선·가로선을 화면 전체가 공유해서, 손잡이 하나가 여러
   칸을 한꺼번에 밀어버렸습니다.

   이제 화면은 "둘로 쪼개기"를 겹쳐 쌓은 구조이고, 크기 조절은
   script_layout.js 가 각 쪼갬 안에서 따로 처리합니다.
   여기 있던 코드는 그쪽으로 옮겼습니다.
   ===================================================================== */
function applySavedColumnWidths() { /* script_layout.js 가 대신합니다 */ }
window.applySavedColumnWidths = applySavedColumnWidths;

function bindColumnGrips() { /* script_layout.js 가 대신합니다 */ }
window.bindColumnGrips = bindColumnGrips;

function bindChatCollapse() {
  const pairs = [
    ["chat-collapse-btn", toggleChatCollapsed],
    ["chat-rail-btn",     toggleChatCollapsed]
  ];

  pairs.forEach(([id, fn]) => {
    const el = document.getElementById(id);
    if (el && !el._collapseBound) {
      el._collapseBound = true;
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      });
    }
  });

  // 좁은 화면으로 전환되면 접힘을 강제 해제 (저장값은 유지)
  window.addEventListener("resize", () => {
    if (!_canCollapse() && _chatCollapsed) applyChatCollapsed(false, { silent: true });
  });
}

/* =====================================================================
   [1-B] 패널 접기 — 뽀모도로 · 개인 영역
   ---------------------------------------------------------------------
   채팅 접기와 달리 레일이 필요 없어서, body 클래스만 토글하고
   나머지는 CSS가 처리합니다. 상태는 기기별(localStorage) 저장.
   ===================================================================== */

/* 개인 영역(투두) 접기는 없앴습니다. 지금은 뽀모도로만 접힙니다. */
const PANELS = [
  { key: "pomoCollapsed", btn: "pomo-collapse-btn", cls: "pomo-collapsed", label: "뽀모도로" }
];

function applyPanelCollapsed(panel, collapsed, opts = {}) {
  const on = !!collapsed;
  document.body.classList.toggle(panel.cls, on);

  const btn = document.getElementById(panel.btn);
  if (btn) {
    btn.setAttribute("aria-expanded", on ? "false" : "true");
    const label = `${panel.label} ${on ? "펼치기" : "접기"}`;
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
  }

  if (!opts.silent) {
    try { AppStore.setItem(panel.key, on ? "1" : "0"); } catch (e) {}
  }
}

function togglePanelCollapsed(panel) {
  applyPanelCollapsed(panel, !document.body.classList.contains(panel.cls));
}

function bindPanelCollapse() {
  PANELS.forEach(panel => {
    const btn = document.getElementById(panel.btn);
    if (btn && !btn._panelBound) {
      btn._panelBound = true;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePanelCollapsed(panel);
      });
    }

    let saved = false;
    try { saved = AppStore.getItem(panel.key) === "1"; } catch (e) {}
    applyPanelCollapsed(panel, saved, { silent: true });
  });
}
window.bindPanelCollapse = bindPanelCollapse;

window.toggleChatCollapsed = toggleChatCollapsed;
window.applySavedChatCollapsed = applySavedChatCollapsed;
window.noteChatMessageWhileCollapsed = noteChatMessageWhileCollapsed;
window.bindChatCollapse = bindChatCollapse;


/* =====================================================================
   [2] 프로필 데이터
   ---------------------------------------------------------------------
   저장 위치: users/{닉}/profile
   status/{닉}은 퇴장 시 onDisconnect().remove()로 통째로 지워지므로
   영구 데이터를 여기에 두면 안 됩니다.
   ===================================================================== */

window._profileCache = window._profileCache || {};

const WRITING_SLOTS = [
  { id: "",         label: "" },
  { id: "allday",   label: "종일반" },
  { id: "night",    label: "심야반" },
  { id: "dawn",     label: "새벽반" },
  { id: "morning",  label: "오전반" },
  { id: "anytime",  label: "아무때나" },
  { id: "seulbool", label: "스불재" }
];

/**
 * 예전 시간대 값 호환.
 * "낮 10–18시"(day), "저녁 18–24시"(evening)는 새 목록에 대응이 없어서,
 * 이미 저장해둔 사람의 설정이 조용히 사라지지 않도록 가까운 값으로 넘겨줍니다.
 */
const LEGACY_SLOT_ALIAS = {
  day: "anytime",
  evening: "night"
};

const ACCENT_PRESETS = [
  // 기존 8색
  "#7F77DD", // 라벤더
  "#1D9E75", // 그린
  "#D85A30", // 코랄
  "#D4537E", // 핑크
  "#378ADD", // 블루
  "#BA7517", // 앰버
  "#E24B4A", // 레드
  "#888780", // 그레이
  // 추가 5색 — 위와 색상환에서 겹치지 않는 구간으로 골랐고,
  // 라이트/다크 배경 양쪽에서 띠가 보이도록 명도를 중간대로 맞췄습니다.
  "#00A6A6", // 틸
  "#A855C7", // 바이올렛
  "#7CB342", // 라임
  "#9C6B4F", // 모카
  "#456B8C", // 슬레이트 블루

  // 파스텔 10색.
  // 카드 왼쪽 3px 띠로 쓰이므로 흰 배경에서도 식별되도록
  // 명도를 0.62~0.80 사이로만 잡았습니다. (더 밝으면 안 보임)
  "#F49AC1", // 파스텔 핑크
  "#F5A9A9", // 파스텔 코랄
  "#F7B267", // 파스텔 살구
  "#EBC85B", // 파스텔 레몬
  "#A8D26D", // 파스텔 연두
  "#6FCFA8", // 파스텔 민트
  "#7FC7E8", // 파스텔 하늘
  "#9BA8E8", // 파스텔 라벤더
  "#C79BE0", // 파스텔 라일락
  "#B9A48C"  // 파스텔 베이지
];

function normalizeSlot(id) {
  const raw = String(id || "");
  return LEGACY_SLOT_ALIAS[raw] || raw;
}

function writingSlotLabel(id) {
  const hit = WRITING_SLOTS.find(s => s.id === normalizeSlot(id));
  return hit ? hit.label : "";
}

/** 임의 문자열이 스타일 속성에 주입되지 않도록 화이트리스트로만 통과 */
function sanitizeAccent(v) {
  const s = String(v || "");
  return ACCENT_PRESETS.includes(s) ? s : "";
}

/* =====================================================================
   프사 사진
   ---------------------------------------------------------------------
   Firebase Storage 대신 브라우저에서 축소한 이미지를 data URL 문자열로
   Realtime Database(users/{닉}/profile/photo)에 넣습니다.
   128px 정사각 JPEG면 보통 5~12KB라 RTDB에 부담이 없습니다.
   ===================================================================== */

const PHOTO_SIZE = 128;          // 정사각 한 변(px)
const PHOTO_MAX_BYTES = 60 * 1024;  // data URL 문자열 상한
const PHOTO_INPUT_MAX = 12 * 1024 * 1024; // 원본 파일 상한(12MB)
/* [추가 2026-08-05] 움직이는 GIF 프사 — 캔버스에 넣으면 첫 프레임만
   남아 정지화면이 됩니다. GIF만은 변환 없이 원본을 그대로 담는데,
   여러 사람 화면에 매번 내려가는 값이라 크기 상한을 따로 둡니다. */
const PHOTO_GIF_MAX_BYTES = 300 * 1024;  // GIF 원본 상한(300KB)

/**
 * 저장된 사진 값 검증.
 * data:image/... 로 시작하는 문자열만 통과시켜, 외부 URL이나
 * javascript: 같은 스킴이 img src에 들어가는 경로를 막습니다.
 */
function sanitizePhoto(v) {
  const s = String(v || "");
  if (!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s)) return "";
  /* GIF 는 원본 그대로라 상한이 더 큽니다 (base64 는 원본의 약 4/3배) */
  const cap = s.startsWith("data:image/gif")
    ? Math.ceil(PHOTO_GIF_MAX_BYTES * 4 / 3) + 64
    : PHOTO_MAX_BYTES * 2;
  if (s.length > cap) return "";
  return s;
}

/** File → 정사각 크롭 + 축소 → data URL */
/* =====================================================================
   🖥️ 가짜 화면용 — 액자와 같은 비율로 자릅니다 (2026-08-15)
   ---------------------------------------------------------------------
   [★ 자르지 않습니다 — 2026-08-15 고침]
   처음에는 액자에 맞춰 16:10 으로, 다음엔 4:5 로 **잘라** 담았습니다.
   그런데 여기 올리는 건 대개 **화면 캡쳐**예요. 가로로 긴 그림을 세로
   액자에 맞춰 자르면 이렇게 됩니다:
       1920×1080 → 가운데 864×1080 만 남음 (가로의 45%)
   남은 좁은 조각이 액자 가득 늘어나니, 문서가 위아래로 길쭉하게 늘어진
   것처럼 보였어요. 실제 제보였고, 원본을 절반 넘게 버리고 있었습니다.

   이제 **비율을 그대로 두고 크기만 줄입니다.** 긴 변이 520px 이 되게요.
   액자에서는 object-fit: contain 으로 통째로 보여주고, 남는 자리는
   카드 바탕색이 비칩니다 — 진짜 화면 공유의 "전체 보기" 와 같은 방식이에요.

   진짜 공유가 보내는 그림(40KB)보다 넉넉하게 잡습니다 — 이건 5초마다
   다시 보내는 게 아니라 한 번 놓아두면 끝이라서요.
   ===================================================================== */
const SHOT_BOX = 520;                  // 긴 변을 이만큼으로 줄입니다 (비율은 그대로)
const SHOT_MAX_BYTES = 90 * 1024;

function fileToShotDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("파일이 없어요."));
    if (!/^image\//.test(file.type)) return reject(new Error("이미지 파일만 올릴 수 있어요."));
    if (file.size > PHOTO_INPUT_MAX) return reject(new Error("파일이 너무 커요. 12MB 이하로 올려주세요."));

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        /* 비율 그대로, 긴 변만 SHOT_BOX 로 줄입니다 (원본이 더 작으면 그대로) */
        const k = Math.min(1, SHOT_BOX / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * k));
        const h = Math.max(1, Math.round(img.height * k));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);

        let out = "";
        for (const q of [0.82, 0.7, 0.6, 0.5, 0.4]) {
          out = canvas.toDataURL("image/jpeg", q);
          if (out.length <= SHOT_MAX_BYTES) break;
        }
        if (out.length > SHOT_MAX_BYTES) {
          return reject(new Error("이미지를 충분히 줄이지 못했어요. 다른 사진을 써주세요."));
        }
        resolve(out);
      } catch (e) { reject(new Error("이미지를 바꾸지 못했어요.")); }
      finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("이미지를 읽지 못했어요.")); };
    img.src = url;
  });
}

function fileToSquareDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("파일이 없어요."));
    if (!/^image\//.test(file.type)) return reject(new Error("이미지 파일만 올릴 수 있어요."));
    if (file.size > PHOTO_INPUT_MAX) return reject(new Error("파일이 너무 커요. 12MB 이하로 올려주세요."));

    /* [추가 2026-08-05] 움직이는 GIF — 변환 없이 원본 그대로.
       (캔버스를 거치면 첫 프레임만 남습니다) 크기만 확인합니다. */
    if (file.type === "image/gif") {
      if (file.size > PHOTO_GIF_MAX_BYTES) {
        return reject(new Error("움직이는 GIF는 300KB 이하만 올릴 수 있어요. 더 작은 GIF로 부탁해요!"));
      }
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(new Error("이미지를 읽지 못했어요."));
      fr.readAsDataURL(file);
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = PHOTO_SIZE;
        canvas.height = PHOTO_SIZE;
        const ctx = canvas.getContext("2d");

        // 가운데를 정사각으로 잘라 담습니다 (비율 왜곡 없음)
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;

        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);

        // 상한을 넘으면 품질을 낮춰가며 다시 인코딩
        let out = "";
        for (const q of [0.82, 0.7, 0.6, 0.5, 0.4]) {
          out = canvas.toDataURL("image/jpeg", q);
          if (out.length <= PHOTO_MAX_BYTES) break;
        }
        if (out.length > PHOTO_MAX_BYTES) {
          return reject(new Error("이미지를 충분히 줄이지 못했어요. 다른 사진을 써주세요."));
        }
        resolve(out);
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽지 못했어요."));
    };

    img.src = url;
  });
}

/* =====================================================================
   기본 프사 — 눈사람
   ---------------------------------------------------------------------
   사진을 안 올린 사람에게 이모지 대신 보여줍니다.
   배경색은 닉네임에서 계산하므로 같은 사람은 늘 같은 색이고,
   서버에 따로 저장할 값이 없습니다.

   머리와 몸통을 각각 반투명 흰색으로 겹쳐서, 겹치는 부분만
   더 밝아지도록 했습니다.
   ===================================================================== */

const SNOW_COLORS = [
  "#9FA8B4", "#E8A0B4", "#7FB3D5", "#8FC49B", "#E0B267",
  "#A99BD4", "#6FC3B8", "#E09A7C", "#C99BC4", "#B9C47F",
  "#7FC4C4", "#D49B9B", "#8FA6D9", "#D9B78F", "#9BC9A0",
  "#C48FB3", "#8FBFD9", "#BFA88F", "#A8C48F", "#B38FC4"
];

function snowColor(nick) {
  const s = String(nick || "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return SNOW_COLORS[Math.abs(hash) % SNOW_COLORS.length];
}

/** 닉네임으로 만든 눈사람 SVG 문자열 */
/* 카드 무늬 — CSS 그라데이션으로 그리므로 이미지 파일이 필요 없습니다 */
const CARD_PATTERNS = [
  { id: "none",           label: "무늬 없음" },
  /* 도트 네 크기 — 원단 용어를 빌렸습니다: 핀도트(아주 잘게) ·
     도트(중간) · 코인도트(동전만큼 큼) · 폴카도트(엇갈려 배치) */
  { id: "dots-pin",       label: "핀도트 (자잘)" },
  { id: "dots",           label: "도트" },
  { id: "dots-coin",      label: "코인도트 (큼)" },
  { id: "dots-polka",     label: "폴카도트 (엇갈림)" },
  { id: "grid",           label: "그리드" },
  { id: "grid-wide",      label: "성근 그리드" },
  { id: "grid-diamond",   label: "마름모 격자 ◇" },
  { id: "cross",          label: "십자" },
  { id: "check",          label: "체크" },
  { id: "check-gingham",  label: "깅엄 체크" },
  { id: "line",           label: "가로 줄무늬" },
  { id: "stripe",         label: "사선 줄무늬 ／" },
  { id: "stripe-rev",     label: "사선 줄무늬 ＼" },
  { id: "zigzag",         label: "지그재그" },
  { id: "scallop",        label: "비늘 (스캘럽)" },
  { id: "shape-star",     label: "⭐ 별" },
  { id: "shape-sun",      label: "☀️ 해" },
  { id: "shape-moon",     label: "🌙 달" },
  { id: "shape-heart",    label: "💗 하트" },
  { id: "shape-flower",   label: "🌸 꽃" },
  { id: "shape-paw",      label: "🐾 발바닥" },
  { id: "shape-cloud",    label: "☁️ 구름" },
  { id: "shape-leaf",     label: "🌿 잎" }
];
function sanitizePattern(v) {
  const t = String(v || "none");
  return CARD_PATTERNS.some(p => p.id === t) ? t : "none";
}
window.CARD_PATTERNS = CARD_PATTERNS;
window.sanitizePattern = sanitizePattern;

/* =====================================================================
   🧲 꾸미기 스티커 (2026-08-13) — 냉장고 자석처럼

   카드의 지정 자리 넷(A·B·C·D)에 낱말이나 표정을 골라 붙입니다.
   자리는 고정이고 스티커만 고릅니다 — 자유 배치로 하면 드래그 저장·
   겹침·화면 크기별 어긋남이 줄줄이 딸려 오고, 카드가 난장판 되는 것도
   막을 수 없어요. 자석 느낌은 자리마다 다른 기울기가 냅니다(CSS).

   저장은 프로필(users/{닉})의 stickers: {a,b,c,d} — 규칙 변경 없음.
   목록제인 이유: 자유 입력은 좁은 카드에서 터지고, 목록이라야
   sanitize 로 이상한 값을 걸러낼 수 있습니다.
   ===================================================================== */
const DECO_WORDS = [
  /* 낱말 → 고정 색 (배경/글자). 단어마다 색이 정해져 있어야 멀리서도
     "아 쟤 마감이구나"가 읽힙니다.
     [바꿈 2026-08-13] 진한 단색 → 사탕 파스텔. 배경은 연하게, 글자는
     같은 계열을 진하게 낮춰서 어느 카드 배경에서도 읽힙니다. */
  { t: "마감",     bg: "#FFCDD2", fg: "#AF2330" },   /* 딸기 */
  { t: "스불재",   bg: "#FFE0B5", fg: "#8F5407" },   /* 살구 */
  { t: "라이브",   bg: "#BFEBD9", fg: "#0B6B4F" },   /* 민트 */
  { t: "갈엎",     bg: "#E5E0DA", fg: "#55504A" },   /* 잿빛 모래 */
  { t: "투고",     bg: "#C5E3FF", fg: "#11518F" },   /* 하늘 */
  { t: "심사",     bg: "#DCD3FB", fg: "#4A3C9E" },   /* 라벤더 */
  { t: "수정궁",   bg: "#FFD9EA", fg: "#A93A6B" },   /* 벚꽃 */
  { t: "영감님!!", bg: "#FFF3B0", fg: "#7A5E00" },   /* 레몬 */
  { t: "투도!",    bg: "#BEE9EA", fg: "#0F5F66" },   /* 소다 */
  { t: "아자자!",  bg: "#FFD9C2", fg: "#A34715" }    /* 귤 */
];
const DECO_EMOJIS = ["😇","😭","🤩","🔥","😳","😍","😣","🤬","😰","🫠","🥹","😴","🔞","💋","✈️","🚨","☕️"];
/* [늘림 2026-08-13] E 자리 추가 — B(프사 옆) 근처, 조금 아래.
   프사 왼쪽에 위아래로 두 장을 겹쳐 붙일 수 있게 됐습니다 */
const DECO_SLOTS = ["a", "b", "c", "d", "e"];

/* 이모지로만 된 글인가 — 직접 쓴 값이 표정 스티커인지 낱말 스티커인지 가릅니다 */
function isEmojiOnly(t) {
  try {
    return /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Modifier}|\p{Regional_Indicator}|️|‍)+$/u
      .test(t);
  } catch (e) { return false; }
}
function sanitizeDeco(v) {
  const t = String(v || "").trim();
  if (!t) return "";
  if (DECO_WORDS.some(w => w.t === t)) return t;
  if (DECO_EMOJIS.includes(t)) return t;
  /* [2026-08-14] 직접 쓰기 — 8자까지 (콩이 정함). 목록이 아니어도
     짧으면 통과합니다. 그리는 쪽이 이스케이프하니 안전해요.
     이모지는 한 글자가 코드 여러 개라 이모지-전용이면 길이를 후하게. */
  if (isEmojiOnly(t) && t.length <= 16) return t;
  if (Array.from(t).length <= 8 && !t.includes("<") && !t.includes(">")) return t;
  return "";
}
function sanitizeStickers(obj) {
  const s = (obj && typeof obj === "object") ? obj : {};
  const out = {};
  DECO_SLOTS.forEach(k => { out[k] = sanitizeDeco(s[k]); });
  return out;
}
/* 자리별 색 (2026-08-13) — 낱말 스티커의 배경을 각자 고를 수 있습니다.
   비어 있으면 낱말의 기본 파스텔. 표정 스티커에는 색이 안 먹습니다. */
function sanitizeStickerColors(obj) {
  const s = (obj && typeof obj === "object") ? obj : {};
  const out = {};
  DECO_SLOTS.forEach(k => { out[k] = sanitizeHexColor(s[k]) || ""; });
  return out;
}
/* 스티커 모양 (2026-08-13) — 알약(pill) / 찢긴 종이테이프(tape).
   사람당 하나입니다: 한 카드에 두 양식이 섞이면 지저분하고,
   자리마다 고르게 하면 고르는 칸만 다섯 배가 돼요. */
function sanitizeStickerShape(v) {
  return v === "tape" ? "tape" : "pill";
}
/* 자유 배치 (2026-08-14) — 자리별 {x, y, r}. 없으면 기본 자리.
   x·y 는 카드 기준 %, 좌우 -14%까지 삐져나갈 수 있습니다(스티커 맛).
   r 은 ±20° — 더 돌리면 글자가 뒤집혀요. */
function sanitizeStickerPos(obj) {
  const s = (obj && typeof obj === "object") ? obj : {};
  const out = {};
  DECO_SLOTS.forEach(k => {
    const p = s[k];
    if (!p || typeof p !== "object") return;
    const x = Number(p.x), y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    out[k] = {
      x: Math.max(-14, Math.min(104, Math.round(x * 10) / 10)),
      y: Math.max(-10, Math.min(104, Math.round(y * 10) / 10)),
      r: Math.max(-20, Math.min(20, Math.round(Number(p.r) || 0)))
    };
    /* 길이(선택) — 일부러 늘인 폭. 24px 아래는 무의미, 230px 위는 카드 밖 */
    const w = Math.round(Number(p.w) || 0);
    if (w >= 24) out[k].w = Math.min(230, w);
  });
  return out;
}

/* 고른 배경색에서 읽히는 글자색을 만들어냅니다 — 같은 색상(hue)을
   진하게 낮춘 톤. 아무 색을 골라도 글자가 배경에 묻지 않아요.
   (검정/흰색 이지선다보다 파스텔 스티커의 결이 살아 있습니다) */
function decoInkFor(bgHex) {
  const c = sanitizeHexColor(bgHex);
  if (!c) return "#3B2A24";
  const r = parseInt(c.slice(1, 3), 16) / 255,
        g = parseInt(c.slice(3, 5), 16) / 255,
        b = parseInt(c.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0;
  const d = mx - mn;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (mx === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const s = mx === 0 ? 0 : d / mx;
  /* 같은 hue, 채도는 살리고, 밝기만 확 낮춘다 */
  const S = Math.min(Math.max(s * 1.15, s > .08 ? .5 : 0), .88);
  const V = .42;
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = V * (1 - S), q = V * (1 - f * S), t = V * (1 - (1 - f) * S);
  const [R, G, B] = [[V,t,p],[q,V,p],[p,V,t],[p,q,V],[t,p,V],[V,p,q]][i % 6];
  const hx = x => Math.round(x * 255).toString(16).padStart(2, "0");
  return "#" + hx(R) + hx(G) + hx(B);
}

/** 한 자리의 스티커 HTML — 카드를 그리는 쪽(script_realtime.js)이 씁니다.
    빈 자리는 빈 문자열: DOM 자체가 안 생겨서 카드에 흔적이 없어요.
    color 를 주면(낱말일 때만) 그 배경 + 어울리는 진한 글자색. */
function decoStickerHtml(slot, val, color, shape, pos) {
  const v = sanitizeDeco(val);
  if (!v) return "";
  /* 자유 배치 — 좌표가 있으면 그 자리에, 없으면 기본 자리(CSS 클래스).
     deco-free 가 기본 자리의 right/bottom 닻을 풀고, 오른쪽 벽에 밀리면
     글자가 세로로 서는 것도 이 클래스가 허용합니다(white-space).
     pos.w — 일부러 길게 늘인 폭. 테이프를 길게 찢어 붙이는 그 맛
     (원래 버그였는데 콩이 마음에 들어 해서 기능이 됨 ㅋㅋ) */
  const free = pos ? " deco-free" : "";
  const posStyle = pos
    ? `left:${pos.x}%;top:${pos.y}%;transform:rotate(${pos.r}deg);`
      + (pos.w ? `width:${pos.w}px;` : "")
    : "";
  const w = DECO_WORDS.find(x => x.t === v);
  const isEmo = !w && (DECO_EMOJIS.includes(v) || isEmojiOnly(v));
  if (!isEmo) {
    /* 목록 낱말이거나 직접 쓴 문구 — 직접 쓴 것은 잿빛 모래가 기본색 */
    const base = w || { bg: "#E5E0DA", fg: "#55504A" };
    const bg = sanitizeHexColor(color) || base.bg;
    const fg = sanitizeHexColor(color) ? decoInkFor(bg) : base.fg;
    const tape = sanitizeStickerShape(shape) === "tape" ? " is-tape" : "";
    return `<span class="card-deco card-deco-word deco-${slot}${tape}${free}"
      style="background:${bg};color:${fg};${posStyle}">${escapeHtml(v)}</span>`;
  }
  return `<span class="card-deco card-deco-emoji deco-${slot}${free}"
    style="${posStyle}">${v}</span>`;
}
window.DECO_WORDS = DECO_WORDS;
window.DECO_EMOJIS = DECO_EMOJIS;
window.sanitizeStickers = sanitizeStickers;
window.sanitizeStickerColors = sanitizeStickerColors;
window.sanitizeStickerShape = sanitizeStickerShape;
window.sanitizeStickerPos = sanitizeStickerPos;
window.decoStickerHtml = decoStickerHtml;

/* 채팅 말풍선 위에 뜨는 닉네임 색.
   프로필에서 고른 값이 없으면 테마 기본색을 그대로 씁니다. */
function nickColorOf(nick) {
  const prof = (window._profileCache || {})[String(nick || "")] || {};
  return sanitizeHexColor(prof.nickColor) || "";
}
function nickColorStyle(nick) {
  const c = nickColorOf(nick);
  return c ? ` style="color:${c}"` : "";
}
window.nickColorOf = nickColorOf;
window.nickColorStyle = nickColorStyle;

/** 이미 그려진 말풍선의 닉네임 색을 갱신합니다 */
function refreshChatNickColors() {
  document.querySelectorAll("[data-name-of]").forEach(el => {
    const c = nickColorOf(el.dataset.nameOf);
    el.style.color = c || "";
  });
}
window.refreshChatNickColors = refreshChatNickColors;

/** #RGB / #RRGGBB 만 통과시킵니다 (임의 CSS 주입 차단) */
function sanitizeHexColor(v) {
  const t = String(v || "").trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t) ? t : "";
}
window.sanitizeHexColor = sanitizeHexColor;

/** 눈사람 배경색 — 본인이 고른 색이 있으면 그것, 없으면 닉네임으로 자동 배정 */
function snowBgFor(nick) {
  const prof = (window._profileCache || {})[nick] || {};
  const mine = (nick === (typeof myNick !== "undefined" ? myNick : null))
    ? (window._myProfile || {})
    : {};
  return sanitizeHexColor(mine.snowBg) || sanitizeHexColor(prof.snowBg) || snowColor(nick);
}
window.snowBgFor = snowBgFor;

function snowmanSvg(nick, bgOverride) {
  const bg = sanitizeHexColor(bgOverride) || snowBgFor(nick);
  return `<svg class="snowman" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"
               role="img" aria-label="기본 프로필" focusable="false">
            <rect width="100" height="100" fill="${bg}"/>
            <circle cx="50" cy="31" r="13.5" fill="#ffffff" opacity="0.85"/>
            <circle cx="50" cy="56" r="24" fill="#ffffff" opacity="0.85"/>
          </svg>`;
}

window.snowColor = snowColor;
window.snowmanSvg = snowmanSvg;

/* ---------------------------------------------------------------------
   채팅 말풍선 아바타
   ---------------------------------------------------------------------
   메시지에는 보낸 시점의 이모지(data.emoji)만 저장돼 있습니다.
   사진을 메시지마다 복사하면 10KB씩 불어나므로, 렌더 시점에 프로필에서
   찾아옵니다. 대신 프사를 바꾸면 과거 말풍선까지 함께 갱신됩니다.
   ------------------------------------------------------------------- */
function chatAvatarHtml(user) {
  const nick = String(user || "");
  const prof = (window._profileCache || {})[nick] || {};
  const photo = sanitizePhoto(prof.photo);
  const attrs = `data-avatar-of="${escapeHtml(nick)}"`;

  return photo
    ? `<div class="profile-emoji has-photo" ${attrs}><img src="${escapeHtml(photo)}" alt="" loading="lazy"></div>`
    : `<div class="profile-emoji has-snow" ${attrs}>${snowmanSvg(nick)}</div>`;
}

/** 프로필이 갱신되면 이미 그려진 말풍선 아바타도 바꿔치기 */
function refreshChatAvatars() {
  const box = document.getElementById("chat-box");
  if (!box) return;

  box.querySelectorAll("[data-avatar-of]").forEach(el => {
    const nick = el.dataset.avatarOf || "";
    const photo = sanitizePhoto((window._profileCache || {})[nick]?.photo);

    if (photo) {
      const img = el.querySelector("img");
      if (img && img.getAttribute("src") === photo) return;  // 변화 없음
      el.classList.remove("has-snow");
      el.classList.add("has-photo");
      el.innerHTML = `<img src="${escapeHtml(photo)}" alt="" loading="lazy">`;
    } else if (el.classList.contains("has-photo")) {
      el.classList.remove("has-photo");
      el.classList.add("has-snow");
      el.innerHTML = snowmanSvg(nick);
    }
  });
}

window.writingSlotLabel = writingSlotLabel;
window.sanitizeAccent = sanitizeAccent;
window.sanitizePhoto = sanitizePhoto;
window.fileToSquareDataUrl = fileToSquareDataUrl;
window.chatAvatarHtml = chatAvatarHtml;
window.refreshChatAvatars = refreshChatAvatars;

/* =====================================================================
   프로필 구독 — 사람별로 따로 답니다

   [예전 방식과 왜 바꿨나]
   전에는 users 전체를 통째로 구독했습니다. 짧은 코드였지만 두 가지가
   걸렸어요.

     ① 남이 투두를 한 글자 칠 때마다 이 콜백이 돌았습니다.
        투두·오늘 목표가 프로필과 같은 users 아래 있으니까요.
        직전 값과 비교해 다시 그리는 것만 막아 뒀을 뿐, **받아오는 것 자체는
        막지 못했습니다.** 사람이 많을수록 계속 오갔어요.
     ② users 를 통째로 읽을 수 있어야 하니, 남의 할 일도 읽을 수 있는
        상태로 열어 둘 수밖에 없었습니다.

   그래서 **필요한 가지만** 봅니다 — users/{닉}/profile.
   지금 방에 있는 사람만 달고, 나가면 뗍니다. 카드에 쓰는 값은 그대로라
   보는 쪽(window._profileCache)은 아무것도 달라지지 않습니다.
   ===================================================================== */
let _profileRefs = {};        // { 닉: ref } — 지금 듣고 있는 사람들
let _profileSignature = null;
let _profileSyncBound = false;

function _profilesChanged() {
  const sig = JSON.stringify(window._profileCache || {});
  if (sig === _profileSignature) return;
  _profileSignature = sig;

  window.rerenderUserCards?.();
  try { refreshChatAvatars(); } catch (e) {}
  try { refreshChatNickColors(); } catch (e) {}
}

/* 방에 있는 사람 목록에 맞춰 리스너를 붙이고 뗍니다.
   status 가 바뀔 때마다 불려도 괜찮게, 이미 달린 사람은 건너뜁니다. */
function syncProfileRefs() {
  const cache = window._statusCache || {};
  const want = new Set(Object.keys(cache));
  if (myNick) want.add(myNick);          // 내 것은 늘 봅니다

  /* 나간 사람 — 리스너를 뗍니다 */
  Object.keys(_profileRefs).forEach(nick => {
    if (want.has(nick)) return;
    try { _profileRefs[nick].off(); } catch (e) {}
    delete _profileRefs[nick];
  });

  /* 캐시도 함께 정리합니다.

     리스너 목록을 기준으로 지우면 빈 곳이 생깁니다 — 리스너를 이미 뗀
     뒤에 캐시에만 남아 있는 사람은 영영 안 지워져요. 그래서 "지금 방에
     있는 사람"을 기준으로 캐시 쪽을 훑습니다. */
  const cacheNow = window._profileCache || {};
  Object.keys(cacheNow).forEach(nick => {
    if (!want.has(nick)) delete cacheNow[nick];
  });

  /* 새로 들어온 사람 */
  want.forEach(nick => {
    if (_profileRefs[nick]) return;
    const ref = db.ref(`users/${nick}/profile`);
    _profileRefs[nick] = ref;
    ref.on("value", snap => {
      const p = snap.val();
      window._profileCache = window._profileCache || {};
      if (p) window._profileCache[nick] = p;
      else delete window._profileCache[nick];
      _profilesChanged();
    });
  });

  _profilesChanged();
}

function listenProfiles() {
  window._profileCache = window._profileCache || {};
  syncProfileRefs();

  /* 접속자 목록이 바뀔 때마다 따라갑니다. renderUserCards 는 status 가
     올 때마다 불리므로 여기에 얹으면 딱 맞아요. */
  if (_profileSyncBound) return;
  _profileSyncBound = true;
  const _render = window.renderUserCards;
  if (typeof _render === "function" && !_render.__profileSynced) {
    const wrapped = function () {
      try { syncProfileRefs(); } catch (e) {}
      return _render.apply(this, arguments);
    };
    wrapped.__profileSynced = true;
    window.renderUserCards = wrapped;
  }
}

async function loadMyProfile() {
  if (!myNick) return {};
  try {
    const snap = await db.ref(`users/${myNick}/profile`).once("value");
    const p = snap.val() || {};

    return p;
  } catch (e) {
    console.warn("[loadMyProfile failed]", e);
    return {};
  }
}

/* [2026-08-15] 꾸밀 카드 고르기 — 🧘 혼자 방에서 유령 카드를 누르면
   그 카드를 편집합니다. 평소(진짜 방)에는 늘 내 카드예요. */
function profileTargetNick() {
  return window._profTargetNick || myNick;
}
window.getProfileTarget = profileTargetNick;

/** 그 카드의 지금 꾸밈 — 내 것이면 _myProfile, 남(유령)이면 캐시에서 */
function profileTargetData() {
  const t = profileTargetNick();
  if (t === myNick) return window._myProfile || {};
  return (window._profileCache || {})[t] || {};
}

async function saveMyProfile(patch) {
  const nick = profileTargetNick();
  if (!nick) return;
  const next = { ...profileTargetData(), ...patch };
  if (nick === myNick) {
    window._myProfile = next;
  } else {
    /* 유령 카드 — 캐시에 바로 반영해야 화면이 즉시 바뀝니다 */
    window._profileCache = window._profileCache || {};
    window._profileCache[nick] = next;
  }

  try {
    await db.ref(`users/${nick}/profile`).update(next);
  } catch (e) {
    console.warn("[saveMyProfile failed]", e);
  }
}

async function afterJoinLoadProfile() {
  if (!myNick) return;
  listenProfiles();

  const p = await loadMyProfile();
  window._myProfile = p;

}

window.listenProfiles = listenProfiles;
window.loadMyProfile = loadMyProfile;
window.saveMyProfile = saveMyProfile;
window.afterJoinLoadProfile = afterJoinLoadProfile;


/* =====================================================================
   [3] 설정 모달 — 프로필 탭
   ===================================================================== */

/* [뺌 2026-08-08] mountGoalBlocks — 카드 아래칸 팝업(#goals-modal)이
   없어지면서 함께 걷어냈습니다. 목표·할 일은 이제 🗂️ 나의 작업 창
   한 곳에서만 봅니다. 창이 두 벌이면 어느 쪽이 진짜인지 헷갈려요. */

/* [2026-08-06] 목표 덩어리만 따로 옮기기 — 🗂️ 나의 작업 창의 🎯 목표 탭용.
   그 탭에는 오늘 목표와 [⏱️ 오늘 작업 시간 초기화] 만 있으면 되고,
   할 일은 옆의 📌 할 일 탭이 날짜별로 따로 보여주니까요.
   (둘 다 #status-block 한 덩어리 안에 들어 있습니다)

   덩어리는 문서 전체에 하나뿐이라, 프로필 팝업을 열면 그쪽이 도로
   가져갑니다. 값이 두 벌로 갈라지지 않으니 그래도 괜찮습니다. */
function mountStatusBlock(host) {
  if (!host) return;
  const el = document.getElementById("status-block");
  if (!el) return;
  el.classList.add("in-profile");
  host.appendChild(el);
}
window.mountStatusBlock = mountStatusBlock;

/* [뺌 2026-08-08] openGoals · closeGoals — 카드 아래칸을 누르면 이제
   🗂️ 나의 작업 창이 열립니다 (script_timelog.js 의 카드 클릭 처리). */

/* =====================================================================
   🧘 혼자 방 — 카드 수와, 지금 고른 카드의 이름·목표·작업 스티커
   ---------------------------------------------------------------------
   진짜 방에서는 이런 게 있을 수 없습니다(남의 이름을 내가 정할 수는
   없으니까요). 혼자 방은 카드가 전부 자기 것이라, 프꾸 창 맨 위에서
   바로 고치는 게 가장 짧은 길입니다.
   ===================================================================== */
function soloProfileBlockHtml(tgt) {
  const isGhost = tgt !== myNick;
  const row = (window._statusCache || {})[tgt] || {};
  const tags = window.WORKTAGS || [];
  const n = Number(window.soloGetCount?.() || 9);
  const m = Number(window.soloGetShow?.() || n);
  /* data:image 인 것만 통과 — 다른 주소가 끼어들 자리를 안 만듭니다 */
  const _raw = (profileTargetData() || {}).shareImg;
  const shot = (typeof _raw === "string" && /^data:image\/(png|jpe?g|webp);base64,/.test(_raw))
    ? _raw : "";
  /* 잘라 보기(cover) 가 기본입니다 — 액자를 꽉 채워야 카드 줄이 가지런해요.
     가로로 긴 화면 캡쳐처럼 잘리면 곤란한 사진은 전체 보기로 바꿉니다. */
  const fitC = ((profileTargetData() || {}).shareFit === "contain") ? "contain" : "cover";
  return `
  <div class="solo-row">
    <div class="set-block solo-block">
      <div class="set-title">🧘 혼자 방</div>
      <div class="set-row">
        <label for="solo-count">만들어 둘 자리</label>
        <input type="range" id="solo-count" min="1" max="20" step="1" value="${n}">
        <span id="solo-count-val" class="solo-count-val">${n}</span>
      </div>
      <div class="set-row">
        <label for="solo-show">오늘 나올 수</label>
        <input type="range" id="solo-show" min="1" max="${n}" step="1" value="${m}">
        <span id="solo-show-val" class="solo-count-val">${m}</span>
      </div>
      <div class="set-row">
        <button type="button" class="ghost-btn compact" id="solo-reshuffle">🎲 다시 섞기</button>
        <span class="hint" style="margin:0;">
          ${m >= n ? "만들어 둔 자리가 전부 나옵니다." : `${n}자리 중 ${m}명이 그때그때 뽑혀요.`}
        </span>
      </div>
      <div class="set-row">
        <label for="solo-card-nick">${isGhost ? "이 카드 이름" : "내 이름"}</label>
        <input type="text" id="solo-card-nick" maxlength="12"
               value="${escapeHtml(tgt)}" autocomplete="off" spellcheck="false">
      </div>
      ${isGhost ? `
      <div class="set-row">
        <label for="solo-card-goal">오늘 목표</label>
        <input type="text" id="solo-card-goal" maxlength="30"
               value="${escapeHtml(row.todayGoalText || "")}" autocomplete="off">
      </div>
      <div class="set-row">
        <label for="solo-card-tag">작업 스티커</label>
        <select id="solo-card-tag">
          <option value="">(없음)</option>
          ${tags.map(t => `<option value="${t.v}"${row.tag === t.v ? " selected" : ""}>${t.emoji} ${t.label}</option>`).join("")}
        </select>
      </div>
      <p class="hint">이름을 바꾸면 이 카드에 붙여둔 꾸밈도 함께 따라갑니다.</p>
      ` : `<p class="hint">내 이름을 바꾸면 꾸밈·메모를 데리고 방을 다시 엽니다. 다른 카드는 눌러서 고르면 목표와 작업 스티커도 여기서 정할 수 있어요.</p>`}
    </div>

    <div class="set-block solo-block">
      <div class="set-title">🖥️ ${escapeHtml(tgt)}의 화면</div>
      <div class="solo-shot-prev${shot ? " has-shot" : ""} fit-${fitC}" id="solo-shot-prev">
        ${shot ? `<img src="${escapeHtml(shot)}" alt="">`
               : `<span class="solo-shot-empty">🖥️<br>아직 놓아둔 화면이 없어요</span>`}
        <span class="solo-shot-foot">${escapeHtml(tgt)}의 화면</span>
      </div>
      <div class="set-row" style="margin-top:8px;">
        <button type="button" class="ghost-btn compact" id="solo-shot-btn">사진 올리기</button>
        <button type="button" class="ghost-btn compact${shot ? "" : " hidden"}" id="solo-shot-clear">치우기</button>
        <input type="file" id="solo-shot-file" accept="image/*" class="hidden">
      </div>
      ${shot ? `
      <div class="solo-fit-row">
        <button type="button" class="solo-fit-btn" data-solo-fit="cover"
                aria-pressed="${fitC === "cover" ? "true" : "false"}">꽉 채우기</button>
        <button type="button" class="solo-fit-btn" data-solo-fit="contain"
                aria-pressed="${fitC === "contain" ? "true" : "false"}">전체 보기</button>
        <span class="hint">${fitC === "cover"
          ? "액자를 꽉 채워요. 넘치는 쪽은 잘립니다."
          : "사진을 통째로 보여줘요. 남는 쪽은 바탕색."}</span>
      </div>` : ""}
      <p class="hint">
        진짜 화면 공유와 같은 액자에, 고른 사진을 걸어 둡니다. 카드 옆에
        나란히 서요. 위 미리보기가 실제 크기 그대로입니다 —
        <b>사진은 자르지 않고 통째로</b> 넣습니다. 액자보다 납작하면
        위아래에 카드 바탕색이 비쳐요.
      </p>
    </div>
  </div>`;
}

function renderProfilePanel() {
  const host = document.getElementById("panel-profile");
  if (!host) return;

  if (!myNick) {
    host.innerHTML = `<div class="set-block"><p class="hint">입장 후에 프로필을 설정할 수 있어요.</p></div>`;
    return;
  }

  /* 꾸밀 카드 — 평소엔 내 카드, 혼자 방에서 유령 카드를 누르면 그 카드 */
  const _tgt = profileTargetNick();
  const p = profileTargetData();
  const photo = sanitizePhoto(p.photo);
  const curSnowBg = sanitizeHexColor(p.snowBg) || snowColor(_tgt);
  const curCardBg = sanitizeHexColor(p.cardBg) || "#FFFFFF";
  const curPat = sanitizePattern(p.cardPattern);
  const curPatColor = sanitizeHexColor(p.patColor) || "#D8DEE8";
  const curNickColor = sanitizeHexColor(p.nickColor) || "#5A6473";
  /* 📚 낱장 색 — 빈 값이면 "테마 기본" (인라인 변수를 아예 안 붙임) */
  const curPg1 = sanitizeHexColor(p.pageC1) || "";
  const curPg2 = sanitizeHexColor(p.pageC2) || "";
  /* 카드 글자색 3종 — 옛 단일색(cardTextColor)이 있으면 그걸 물려받습니다 */
  const _legacyInk = sanitizeHexColor(p.cardTextColor) || "";
  const curInkNick = sanitizeHexColor(p.cardNickColor) || _legacyInk;
  const curInkGoal = sanitizeHexColor(p.cardGoalColor) || _legacyInk;
  const curInkWh   = sanitizeHexColor(p.cardWhColor)   || _legacyInk;

  /* [2026-08-14] 두 칸 배치 — 탭이 세로로 너무 길었습니다. 왼쪽은 색·배경,
     오른쪽은 스티커(고르기 → 배치가 세로로 이어지는 동선). 좁은 화면에서는
     CSS 가 한 칸으로 되돌립니다. */
  host.innerHTML = `
    ${(_tgt !== myNick) ? `<div class="prof-target-bar">
      지금 <b>${escapeHtml(_tgt)}</b> 카드를 꾸미는 중이에요
      <button type="button" class="ghost-btn compact" id="prof-target-mine">내 카드로</button>
    </div>` : ""}
    ${window.SOLO ? soloProfileBlockHtml(_tgt) : ""}
    <div class="prof-cols">
    <div class="prof-col">
    <div class="set-block">
      <div class="set-title">프사 사진</div>
      <div class="profile-emoji-row">
        <div class="profile-photo-preview${photo ? " has-photo" : ""}" id="prof-photo-preview">
          ${photo ? `<img src="${escapeHtml(photo)}" alt="">` : snowmanSvg(_tgt)}
        </div>
        <div class="profile-emoji-meta">
          <div class="profile-emoji-name">${escapeHtml(_tgt)}</div>
          <div class="set-row" style="margin-top:8px;">
            <button type="button" class="ghost-btn compact" id="prof-photo-btn">사진 올리기</button>
            <button type="button" class="ghost-btn compact danger${photo ? "" : " hidden"}" id="prof-photo-clear">지우기</button>
          </div>
          <div class="hint" id="prof-photo-hint">${
            photo ? "카드와 채팅에 이 사진이 보여요."
                  : "정사각형으로 잘라 128px로 줄여서 저장해요. 안 올리면 닉네임에 맞는 색의 눈사람이 보여요."
          }</div>
        </div>
      </div>
      <input type="file" id="prof-photo-input" accept="image/*" class="sr-only">
    </div>

    <div class="set-block">
      <div class="set-title">카드 글자색</div>
      ${[
        ["nick", "닉네임",       curInkNick],
        ["goal", "목표 · 🍅",    curInkGoal],
        ["wh",   "작업 시간 ⏱",  curInkWh]
      ].map(([k, label, val]) => `
      <div class="color-row" style="margin-bottom:7px;">
        <span style="flex:0 0 84px;font-size:12.5px;font-weight:700;">${label}</span>
        <input type="color" id="prof-ink-${k}" class="color-well"
               value="${val || "#2B2620"}" aria-label="${label} 색 고르기">
        <input type="text" id="prof-ink-${k}-hex" class="color-hex"
               value="${val}" maxlength="7" spellcheck="false"
               placeholder="테마 기본" aria-label="${label} 색 코드">
        <button type="button" class="ghost-btn compact" data-ink-reset="${k}">기본</button>
      </div>`).join("")}
      <p class="hint">카드 아래칸의 글자색을 <b>세 군데 따로</b> 고를 수 있어요.
      비워두면(기본) 테마 색을 따라갑니다. 다른 분들 화면에도 이 색으로 보여요.</p>
    </div>

    <div class="set-block">
      <div class="set-title">카드 배경</div>
      <div class="color-row">
        <input type="color" id="prof-cardbg" class="color-well"
               value="${curCardBg}" aria-label="카드 배경색 고르기">
        <input type="text" id="prof-cardbg-hex" class="color-hex"
               value="${curCardBg}" maxlength="7" spellcheck="false" aria-label="배경색 코드">
        <button type="button" class="ghost-btn compact" id="prof-cardbg-reset">기본값</button>
      </div>

      <div class="set-row" style="margin-top:10px; gap:8px; align-items:center;">
        <label class="slot-name" for="prof-cardpat" style="flex:0 0 60px;">무늬</label>
        <select id="prof-cardpat" class="slot-sel">
          ${CARD_PATTERNS.map(pt => `
            <option value="${pt.id}"${pt.id === curPat ? " selected" : ""}>${pt.label}</option>
          `).join("")}
        </select>
        <input type="color" id="prof-patcolor" class="color-well"
               value="${curPatColor}" aria-label="무늬 색 고르기" title="무늬 색">
      </div>

      <div class="card-preview" id="prof-card-preview" aria-hidden="true">
        <span class="card-preview-foot" id="prof-foot-preview">닉네임 · 목표 · 진척</span>
      </div>
      <p class="hint">
        닉네임 · 목표 · 진척 바를 감싸는 <b>글자 상자는 반투명</b>이라
        고른 배경색과 무늬가 은은하게 비쳐 보입니다.<br>
        내 카드에만 적용되고, 다른 분들 화면에도 이 색으로 보입니다.
      </p>
    </div>
    </div><!-- /1칸 -->

    <div class="prof-col">
    <div class="set-block">
      <div class="set-title">채팅 닉네임 색</div>
      <div class="color-row">
        <input type="color" id="prof-nickcolor" class="color-well"
               value="${curNickColor}" aria-label="닉네임 색 고르기">
        <input type="text" id="prof-nickcolor-hex" class="color-hex"
               value="${curNickColor}" maxlength="7" spellcheck="false" aria-label="닉네임 색 코드">
        <button type="button" class="ghost-btn compact" id="prof-nickcolor-reset">기본값</button>
      </div>
      <div class="nick-preview" id="prof-nick-preview">${escapeHtml(_tgt)}</div>
      <p class="hint">채팅 말풍선 위에 뜨는 <b>내 이름 색</b>이에요. 다른 분들 화면에도 이 색으로 보입니다.</p>
    </div>

    <!-- 🧲 꾸미기 스티커 — 자리 다섯, 각자 낱말/표정/비움 -->
    <div class="set-block">
      <div class="set-title">꾸미기 스티커</div>
      <div class="set-row" style="margin-bottom:10px; gap:8px; align-items:center;">
        <span class="slot-name" style="flex:0 0 84px;">모양</span>
        <select id="prof-deco-shape" class="slot-sel" data-deco-shape="1">
          <option value="pill"${sanitizeStickerShape(p.stickerShape) !== "tape" ? " selected" : ""}>알약 (매끈)</option>
          <option value="tape"${sanitizeStickerShape(p.stickerShape) === "tape" ? " selected" : ""}>종이테이프 (찢긴)</option>
        </select>
      </div>
      ${[
        ["a", "오른쪽 위"],
        ["b", "프사 옆"],
        ["e", "프사 옆 아래"],
        ["c", "오른쪽 아래"],
        ["d", "왼쪽 허리"]
      ].map(([k, label]) => {
        const cur = (window.sanitizeStickers(p.stickers))[k];
        const curC = (window.sanitizeStickerColors(p.stickerColors))[k];
        return `
      <div class="set-row" style="margin-bottom:7px; gap:8px; align-items:center;">
        <span class="slot-name" style="flex:0 0 84px;">${label}</span>
        <select id="prof-deco-${k}" class="slot-sel" data-deco-slot="${k}">
          <option value="">(비움)</option>
          <option value="__custom">✏️ 직접 쓰기…</option>
          ${cur && !DECO_WORDS.some(w => w.t === cur) && !DECO_EMOJIS.includes(cur)
            ? `<option value="${escapeHtml(cur)}" selected>✏️ ${escapeHtml(cur)}</option>` : ""}
          <optgroup label="낱말">
            ${DECO_WORDS.map(w => `
              <option value="${w.t}"${w.t === cur ? " selected" : ""}>${w.t}</option>`).join("")}
          </optgroup>
          <optgroup label="표정">
            ${DECO_EMOJIS.map(e => `
              <option value="${e}"${e === cur ? " selected" : ""}>${e}</option>`).join("")}
          </optgroup>
        </select>
        <input type="color" id="prof-deco-${k}-color" class="color-well" data-deco-color="${k}"
               value="${curC || "#FFCDD2"}" aria-label="${label} 스티커 색" title="낱말 스티커 색">
        <button type="button" class="ghost-btn compact" data-deco-color-reset="${k}"
                title="낱말의 기본색으로">기본</button>
      </div>`;
      }).join("")}
      <p class="hint">
        캐리어에 스티커 붙이듯 카드의 <b>정해진 자리 다섯</b>에 골라 붙여요.
        <b>✏️ 직접 쓰기</b>로 나만의 문구(8자까지)나 아무 이모지나 넣을 수 있어요.
        비워도 되고 다 붙여도 됩니다. 다른 분들 화면에도 보여요.<br>
        색은 <b>낱말 스티커에만</b> 먹어요 — 글자색은 고른 색에서 읽히게
        저절로 맞춰집니다. [기본]을 누르면 낱말의 원래 색으로 돌아가요.
      </p>
    </div>


    <!-- 눈사람 배경색 — 사진을 안 올린 사람만 의미가 있으므로 그때만 보입니다 -->
    <div class="set-block${photo ? " hidden" : ""}" id="prof-snowbg-block">
      <div class="set-title">눈사람 배경색</div>
      <div class="color-row">
        <input type="color" id="prof-snowbg" class="color-well"
               value="${curSnowBg}" aria-label="눈사람 배경색 고르기">
        <input type="text" id="prof-snowbg-hex" class="color-hex"
               value="${curSnowBg}" maxlength="7" spellcheck="false"
               autocapitalize="off" aria-label="색상 코드 직접 입력">
        <button type="button" class="ghost-btn compact" id="prof-snowbg-reset">기본값</button>
      </div>
      <div class="color-presets" id="prof-snowbg-presets" role="group" aria-label="추천 색">
        ${SNOW_COLORS.map(c => `
          <button type="button" class="color-chip${c.toLowerCase() === curSnowBg.toLowerCase() ? " selected" : ""}"
                  data-color="${c}" style="--sw:${c}" aria-label="${c}"></button>
        `).join("")}
      </div>
      <p class="hint">색 상자를 누르면 자세한 색상 선택 창이 열려요. 코드(#RRGGBB)를 직접 적어도 됩니다.</p>
    </div>
    </div><!-- /2칸 -->

    <!-- 🧷 3칸 — 스티커 배치. 카드가 **실물 크기**(214px)에 실제 CSS 그대로라,
         여기서 놓은 자리가 진짜 카드와 1:1 로 같습니다 (2026-08-14 콩 지적:
         미니 카드는 실제와 어긋나서 까다로웠음) -->
    <div class="prof-col">
    <div class="set-block" id="prof-stk-place-block">
      <div class="set-title">스티커 배치</div>
      <p class="hint" style="margin-top:0">
        <b>내 진짜 카드</b> 그대로예요 — 스티커를 <b>끌어서</b> 자리를 옮기고,
        아래 슬라이더로 <b>기울기</b>를 돌려요. 여기서 놓은 그대로
        모두의 화면에 붙습니다. 오른쪽 벽에 바짝 붙이면 글자가 세로로 서요.
      </p>
      <div class="stk-card" id="prof-stk-card" aria-label="스티커 배치 카드 (내 카드 그대로)"></div>
      <div class="set-row" style="gap:8px; align-items:center; margin-top:9px;">
        <span class="slot-name" style="flex:0 0 44px;">기울기</span>
        <input type="range" id="prof-stk-rot" min="-20" max="20" step="1" value="0" disabled
               aria-label="고른 스티커 기울기">
        <span id="prof-stk-rotv" style="flex:0 0 34px; text-align:right; font-size:12px;">–</span>
        <button type="button" class="ghost-btn compact" id="prof-stk-reset">제자리로</button>
      </div>
      <!-- 길이 — 낱말 스티커를 마스킹테이프처럼 길게 찢어 붙이기.
           맨 왼쪽은 "자동"(글자만큼). 이모지에는 안 먹습니다 -->
      <div class="set-row" style="gap:8px; align-items:center; margin-top:5px;">
        <span class="slot-name" style="flex:0 0 44px;">길이</span>
        <input type="range" id="prof-stk-len" min="0" max="230" step="2" value="0" disabled
               aria-label="고른 스티커 길이 (맨 왼쪽은 자동)">
        <span id="prof-stk-lenv" style="flex:0 0 34px; text-align:right; font-size:12px;">–</span>
      </div>
      <p class="hint">고른 스티커: <b id="prof-stk-sel">없음</b> —
        스티커를 누르면 골라져요. 안 만진 스티커는 기본 자리 그대로입니다.</p>
    </div>

    <!-- 📚 낱장 색 (2026-08-18) — 카드 오른쪽·아래 겹친 종이 두 장.
         스티커 배치 바로 아래(콩 지정 자리). 위의 배치 카드가 내 진짜
         카드의 복제본이라, 색을 고르면 저 카드에서 바로 보입니다. -->
    <div class="set-block">
      <div class="set-title">📚 낱장 색</div>
      <p class="hint" style="margin-top:0">
        카드 가장자리 겹친 종이 두 장이에요. 고른 색이 그대로 진하게
        들어가요. [기본값]을 누르면 테마 낱장으로 돌아갑니다.</p>
      <div class="color-row">
        <span class="slot-name" style="flex:0 0 52px;">첫째 장</span>
        <input type="color" id="prof-pg1" class="color-well"
               value="${curPg1 || "#C9BB98"}" aria-label="첫째 장 색 고르기">
        <input type="text" id="prof-pg1-hex" class="color-hex"
               value="${curPg1}" placeholder="기본" maxlength="7" spellcheck="false">
        <button type="button" class="ghost-btn compact" id="prof-pg1-reset">기본값</button>
      </div>
      <div class="color-row" style="margin-top:6px;">
        <span class="slot-name" style="flex:0 0 52px;">둘째 장</span>
        <input type="color" id="prof-pg2" class="color-well"
               value="${curPg2 || "#C9BB98"}" aria-label="둘째 장 색 고르기">
        <input type="text" id="prof-pg2-hex" class="color-hex"
               value="${curPg2}" placeholder="기본" maxlength="7" spellcheck="false">
        <button type="button" class="ghost-btn compact" id="prof-pg2-reset">기본값</button>
      </div>
      <label class="hint" style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-top:8px;">
        <input type="checkbox" id="prof-pg-link"> 🔗 두 장 같은 색으로 움직이기
      </label>
    </div>
    </div><!-- /3칸 -->
    </div><!-- /prof-cols -->

  `;

  bindProfilePanel();
}

function bindSoloProfileBlock() {
  /* 카드가 줄거나 다시 뽑혀서 지금 고른 카드가 사라졌으면 내 카드로 */
  const 되돌리기 = () => {
    if (!(window._statusCache || {})[profileTargetNick()]) {
      window._profTargetNick = myNick;
    }
    renderProfilePanel();
  };

  const cnt = document.getElementById("solo-count");
  const cntVal = document.getElementById("solo-count-val");
  if (cnt) {
    cnt.oninput = () => { if (cntVal) cntVal.textContent = cnt.value; };
    /* 놓았을 때만 다시 짓습니다 — 끄는 동안 매번 지으면 눈이 어지러워요 */
    cnt.onchange = () => { window.soloSetCount?.(Number(cnt.value)); 되돌리기(); };
  }

  const shw = document.getElementById("solo-show");
  const shwVal = document.getElementById("solo-show-val");
  if (shw) {
    shw.oninput = () => { if (shwVal) shwVal.textContent = shw.value; };
    shw.onchange = () => { window.soloSetShow?.(Number(shw.value)); 되돌리기(); };
  }

  const shuf = document.getElementById("solo-reshuffle");
  if (shuf) shuf.onclick = () => { window.soloReshuffle?.(); 되돌리기(); };

  /* 🖥️ 가짜 화면 사진 */
  const shotBtn = document.getElementById("solo-shot-btn");
  const shotFile = document.getElementById("solo-shot-file");
  const shotClr = document.getElementById("solo-shot-clear");
  if (shotBtn && shotFile) {
    shotBtn.onclick = () => shotFile.click();
    shotFile.onchange = async () => {
      const f = shotFile.files?.[0];
      shotFile.value = "";
      if (!f) return;
      const 옛 = shotBtn.textContent;
      shotBtn.disabled = true; shotBtn.textContent = "줄이는 중…";
      try {
        const url = await fileToShotDataUrl(f);
        await saveMyProfile({ shareImg: url });
        window.soloSyncScreens?.();
        window.renderUserCards?.();
        renderProfilePanel();
      } catch (e) {
        alert(e?.message || "사진을 올리지 못했어요.");
        shotBtn.disabled = false; shotBtn.textContent = 옛;
      }
    };
  }
  document.querySelectorAll("[data-solo-fit]").forEach(b => {
    b.onclick = async () => {
      await saveMyProfile({ shareFit: b.dataset.soloFit });
      window.soloSyncScreens?.();
      window.renderUserCards?.();
      renderProfilePanel();
    };
  });

  if (shotClr) shotClr.onclick = async () => {
    await saveMyProfile({ shareImg: "" });
    window.soloSyncScreens?.();
    window.renderUserCards?.();
    renderProfilePanel();
  };

  const tgt = profileTargetNick();
  const nickIn = document.getElementById("solo-card-nick");
  const goalIn = document.getElementById("solo-card-goal");
  const tagSel = document.getElementById("solo-card-tag");

  const 적용 = (patch) => {
    const next = window.soloEditCard?.(tgt, patch);
    if (!next) return;
    if (next !== tgt) {
      window._profTargetNick = next;
      renderProfilePanel();
    }
  };

  if (nickIn) nickIn.onchange = () => {
    const v = nickIn.value.trim();
    if (!v || v === tgt) { nickIn.value = tgt; return; }
    if ((window._statusCache || {})[v]) {
      alert("같은 이름의 카드가 이미 있어요.");
      nickIn.value = tgt;
      return;
    }
    /* 내 카드는 방을 다시 여는 쪽 — myNick 을 여러 곳이 붙들고 있어서
       그 자리에서 갈아끼우면 반쪽만 바뀝니다 */
    if (tgt === myNick) {
      if (!confirm(`내 이름을 "${v}" 로 바꾸고 방을 다시 열까요?`)) {
        nickIn.value = tgt;
        return;
      }
      if (window.soloRename?.(v) === false) {
        alert("그 이름은 쓸 수 없어요.");
        nickIn.value = tgt;
      }
      return;
    }
    적용({ nick: v });
  };
  if (goalIn) goalIn.onchange = () => 적용({ goal: goalIn.value });
  if (tagSel) tagSel.onchange = () => 적용({ tag: tagSel.value });
}

function bindProfilePanel() {
  /* 🧘 혼자 방 — 카드 수 · 이 카드의 이름·목표·스티커 */
  if (window.SOLO) bindSoloProfileBlock();

  /* 🧘 혼자 방 — [내 카드로] 되돌리기 */
  const backBtn = document.getElementById("prof-target-mine");
  if (backBtn) backBtn.onclick = () => {
    window._profTargetNick = myNick;
    renderProfilePanel();
  };

  /* ---- 카드 글자색 3종 (2026-08-03) ---- */
  [["nick", "cardNickColor"], ["goal", "cardGoalColor"], ["wh", "cardWhColor"]]
    .forEach(([k, field]) => {
      const well  = document.getElementById(`prof-ink-${k}`);
      const hexIn = document.getElementById(`prof-ink-${k}-hex`);
      const reset = document.querySelector(`[data-ink-reset="${k}"]`);
      const save = (hex, opts = {}) => {
        const c = sanitizeHexColor(hex);
        if (!c) return;
        if (well && !opts.fromWell) well.value = c;
        if (hexIn && !opts.fromHex) hexIn.value = c;
        saveMyProfile({ [field]: c });
      };
      if (well) well.oninput = () => save(well.value, { fromWell: true });
      if (hexIn) {
        hexIn.oninput = () => { if (sanitizeHexColor(hexIn.value)) save(hexIn.value, { fromHex: true }); };
        hexIn.onblur  = () => { if (hexIn.value && !sanitizeHexColor(hexIn.value)) hexIn.value = ""; };
      }
      if (reset) reset.onclick = () => {
        if (hexIn) hexIn.value = "";
        saveMyProfile({ [field]: null });   // 지우면 테마 기본색
      };
    });

  /* ---- 채팅 닉네임 색 ---- */
  const ncWell  = document.getElementById("prof-nickcolor");
  const ncHex   = document.getElementById("prof-nickcolor-hex");
  const ncReset = document.getElementById("prof-nickcolor-reset");
  const ncPrev  = document.getElementById("prof-nick-preview");

  function saveNickColor(hex, opts = {}) {
    const c = sanitizeHexColor(hex);
    if (!c) return;
    if (ncWell && !opts.fromWell) ncWell.value = c;
    if (ncHex  && !opts.fromHex)  ncHex.value  = c;
    if (ncPrev) ncPrev.style.color = c;
    saveMyProfile({ nickColor: c });
    try { refreshChatNickColors(); } catch (e) {}
  }

  if (ncWell) {
    if (ncPrev) ncPrev.style.color = ncWell.value;
    ncWell.oninput = () => saveNickColor(ncWell.value, { fromWell: true });
  }
  if (ncHex) {
    ncHex.oninput = () => {
      if (sanitizeHexColor(ncHex.value)) saveNickColor(ncHex.value, { fromHex: true });
    };
    ncHex.onblur = () => {
      if (!sanitizeHexColor(ncHex.value) && ncWell) ncHex.value = ncWell.value;
    };
  }
  if (ncReset) ncReset.onclick = () => saveNickColor("#5A6473");

  /* ---- 📚 낱장 색 (2026-08-18) ----
     저장은 pageC1 · pageC2 두 칸. 빈 문자열이면 "테마 기본"으로 돌아가요
     (카드 그리기가 빈 값에는 인라인 변수를 아예 안 붙입니다).
     배치 카드(#prof-stk-card)가 내 진짜 카드의 복제본이라, 저장 →
     rerenderUserCards → 복제본 갱신으로 바로 보입니다. */
  function bindPageColor(which) {
    const well  = document.getElementById(`prof-pg${which}`);
    const hex   = document.getElementById(`prof-pg${which}-hex`);
    const reset = document.getElementById(`prof-pg${which}-reset`);
    const link  = document.getElementById("prof-pg-link");

    function apply(c, fromLink) {
      c = sanitizeHexColor(c) || "";
      if (well && c) well.value = c;
      if (hex) hex.value = c;
      saveMyProfile(which === 1 ? { pageC1: c } : { pageC2: c });
      window.rerenderUserCards?.();
      setTimeout(() => window._renderStkEditor?.(), 250);   // 배치 카드도 새 낱장으로
      /* 🔗 켜져 있으면 다른 장도 — fromLink 깃발이 무한 왕복을 막습니다 */
      if (!fromLink && link?.checked) window[`_applyPg${which === 1 ? 2 : 1}`]?.(c, true);
    }
    window[`_applyPg${which}`] = apply;

    if (well) well.oninput = () => apply(well.value);
    if (hex) hex.oninput = () => {
      const c = sanitizeHexColor(hex.value);
      if (c) apply(c);
    };
    if (reset) reset.onclick = () => apply("");
  }
  bindPageColor(1);
  bindPageColor(2);
  /* 🔗 를 켜는 순간 둘째 장을 첫째 장에 맞춥니다 */
  document.getElementById("prof-pg-link")?.addEventListener("change", (e) => {
    const c = document.getElementById("prof-pg1")?.value;
    if (e.target.checked && sanitizeHexColor(c)) window._applyPg2?.(c, true);
  });

  /* ---- 카드 배경 · 무늬 ---- */
  const cbWell  = document.getElementById("prof-cardbg");
  const cbHex   = document.getElementById("prof-cardbg-hex");
  const cbReset = document.getElementById("prof-cardbg-reset");
  const patSel  = document.getElementById("prof-cardpat");
  const patCol  = document.getElementById("prof-patcolor");
  const preview = document.getElementById("prof-card-preview");
  function paintPreview() {
    if (!preview) return;
    const bg = sanitizeHexColor(cbWell?.value) || "#FFFFFF";
    const pc = sanitizeHexColor(patCol?.value) || "#D8DEE8";
    preview.style.setProperty("--cbg", bg);
    preview.style.setProperty("--cpat", pc);
    preview.className = "card-preview pat-" + sanitizePattern(patSel?.value);
  }

  function saveCard() {
    const bg = sanitizeHexColor(cbWell?.value) || "#FFFFFF";
    const pc = sanitizeHexColor(patCol?.value) || "#D8DEE8";
    const pt = sanitizePattern(patSel?.value);
    if (cbHex) cbHex.value = bg;
    paintPreview();
    saveMyProfile({ cardBg: bg, cardPattern: pt, patColor: pc });
    window.rerenderUserCards?.();
  }

  if (cbWell) cbWell.oninput = saveCard;
  if (patSel) patSel.onchange = saveCard;
  if (patCol) patCol.oninput = saveCard;
  if (cbHex) {
    cbHex.oninput = () => {
      const c = sanitizeHexColor(cbHex.value);
      if (c && cbWell) { cbWell.value = c; saveCard(); }
    };
    cbHex.onblur = () => { if (!sanitizeHexColor(cbHex.value) && cbWell) cbHex.value = cbWell.value; };
  }
  if (cbReset) cbReset.onclick = () => {
    if (cbWell) cbWell.value = "#FFFFFF";
    if (patSel) patSel.value = "none";
    if (patCol) patCol.value = "#D8DEE8";
    saveCard();
  };
  paintPreview();

  /* ---- 🧲 꾸미기 스티커 — 넷 중 하나만 바꿔도 넷을 모아 저장합니다.
     낱개로 저장하면 "빈 값으로 되돌리기"가 지워지지 않고 남는 수가 있어요.

     [고침 2026-08-13 당일] host → document. 여기는 bindProfilePanel 안이라
     host 변수가 없습니다(그건 renderProfilePanel 것). ReferenceError 로
     이 연결이 즉사해서 "골라도 카드에 안 붙는" 상태였고, 아래 눈사람
     배경색 연결까지 같이 죽었습니다. */
  function _saveDeco() {
    const stickers = {}, stickerColors = {};
    ["a", "b", "c", "d", "e"].forEach(k => {
      stickers[k] = sanitizeDeco(
        document.getElementById("prof-deco-" + k)?.value || "");
      /* dirty 표시가 있는 자리만 색을 저장 — 색 우물의 기본값(#FFCDD2)이
         "고른 색"으로 잘못 저장되는 걸 막습니다 */
      const well = document.getElementById(`prof-deco-${k}-color`);
      stickerColors[k] = (well && well.dataset.dirty === "1")
        ? (sanitizeHexColor(well.value) || "") : "";
    });
    const stickerShape = sanitizeStickerShape(
      document.getElementById("prof-deco-shape")?.value);
    saveMyProfile({ stickers, stickerColors, stickerShape });
    window.rerenderUserCards?.();
    window._renderStkEditor?.();   // 배치 편집기의 미니 카드도 함께 갱신
  }
  document.querySelectorAll("[data-deco-slot]").forEach(sel => {
    sel.onchange = () => {
      /* ✏️ 직접 쓰기 — 문구(8자)든 이모지든 하나로 받습니다 */
      if (sel.value === "__custom") {
        const t = String(prompt("스티커에 쓸 말 (8자까지 · 이모지도 돼요)") || "").trim();
        const okv = sanitizeDeco(t);
        if (!okv || okv === "__custom") { sel.value = ""; _saveDeco(); return; }
        let opt = Array.from(sel.options).find(o => o.value === okv);
        if (!opt) {
          opt = document.createElement("option");
          opt.value = okv; opt.textContent = "✏️ " + okv;
          /* ★ 낱말 묶음(optgroup) **앞에** 끼웁니다. sel.options[n] 으로
             집으면 묶음 안의 자식이 잡혀서 insertBefore 가 거부됩니다 —
             "직접 쓰기가 적용이 안 돼요"의 범인이 이 한 줄이었어요 */
          sel.insertBefore(opt, sel.querySelector("optgroup"));
        }
        sel.value = okv;
      }
      _saveDeco();
    };
  });
  const shapeSel = document.getElementById("prof-deco-shape");
  if (shapeSel) shapeSel.onchange = _saveDeco;
  document.querySelectorAll("[data-deco-color]").forEach(well => {
    /* 저장된 색이 있던 자리는 dirty 로 시작해야 색이 유지됩니다 */
    const k = well.dataset.decoColor;
    const saved = (sanitizeStickerColors(window._myProfile?.stickerColors))[k];
    if (saved) well.dataset.dirty = "1";
    well.oninput = () => { well.dataset.dirty = "1"; _saveDeco(); };
  });
  document.querySelectorAll("[data-deco-color-reset]").forEach(btn => {
    btn.onclick = () => {
      const k = btn.dataset.decoColorReset;
      const well = document.getElementById(`prof-deco-${k}-color`);
      if (well) { delete well.dataset.dirty; well.value = "#FFCDD2"; }
      _saveDeco();
    };
  });

  /* ---- 🧷 스티커 배치 편집기 (2026-08-14, 같은 날 재수술) ----
     처음엔 축소판 카드였는데 실제 카드와 위치가 어긋나 까다로웠습니다.
     이제 **실물 크기(214px) + 실제 CSS 클래스 그대로**를 씁니다 —
     기본 자리는 진짜 카드의 deco-a…e 규칙이 그대로 적용되고,
     끌기 시작하는 순간 좌표(deco-free)로 갈아탑니다. 그래서 여기서
     보이는 그대로가 진짜 카드입니다. 만진 스티커만 좌표가 저장돼요. */
  let _stkSel = "";
  const _stkCard = document.getElementById("prof-stk-card");

  function _stkState() {
    const p = profileTargetData();
    return {
      stickers: sanitizeStickers(p.stickers),
      colors: sanitizeStickerColors(p.stickerColors),
      shape: sanitizeStickerShape(p.stickerShape),
      pos: sanitizeStickerPos(p.stickerPos)
    };
  }

  function _stkSaveDebounced() {
    clearTimeout(_stkSaveDebounced._t);
    _stkSaveDebounced._t = setTimeout(() => {
      const pos = {};
      _stkCard?.querySelectorAll("[data-stk]").forEach(s => {
        if (s.dataset.custom !== "1") return;
        pos[s.dataset.stk] = {
          x: Number(s.dataset.x), y: Number(s.dataset.y), r: Number(s.dataset.r)
        };
        if (Number(s.dataset.w) >= 24) pos[s.dataset.stk].w = Number(s.dataset.w);
      });
      saveMyProfile({ stickerPos: pos });
      window.rerenderUserCards?.();
    }, 250);
  }

  function _stkPaint(s) {
    s.style.left = s.dataset.x + "%";
    s.style.top = s.dataset.y + "%";
    s.style.transform = `rotate(${s.dataset.r}deg)`;
    const w = Number(s.dataset.w) || 0;
    s.style.width = w >= 24 ? w + "px" : "";
  }

  /* 기본 자리(CSS 닻) 스티커를 좌표(deco-free)로 갈아태웁니다 —
     지금 보이는 자리 그대로, 카드 기준 %로 환산해서 */
  function _stkToFree(s) {
    if (s.dataset.custom === "1") return;
    const r = _stkCard.getBoundingClientRect();
    const sr = s.getBoundingClientRect();
    s.dataset.x = Math.round(((sr.left - r.left) / r.width) * 1000) / 10;
    s.dataset.y = Math.round(((sr.top - r.top) / r.height) * 1000) / 10;
    s.dataset.custom = "1";
    s.classList.add("deco-free");
    _stkCard.appendChild(s);        // 프사 칸에 있던 B·E 도 카드 기준으로
    _stkPaint(s);
  }

  function _stkSelect(slot) {
    _stkSel = slot;
    const rot = document.getElementById("prof-stk-rot");
    const rotv = document.getElementById("prof-stk-rotv");
    const len = document.getElementById("prof-stk-len");
    const lenv = document.getElementById("prof-stk-lenv");
    const sel = document.getElementById("prof-stk-sel");
    _stkCard?.querySelectorAll("[data-stk]").forEach(x => {
      x.classList.toggle("is-sel", x.dataset.stk === slot);
    });
    const s = _stkCard?.querySelector(`[data-stk="${slot}"]`);
    if (sel) sel.textContent = s ? s.textContent : "없음";
    if (rot) { rot.disabled = !s; rot.value = s ? s.dataset.r : 0; }
    if (rotv) rotv.textContent = s ? `${s.dataset.r}°` : "–";
    /* 길이 — 낱말 스티커에만. 이모지는 잠급니다 */
    const isWord = !!(s && s.classList.contains("card-deco-word"));
    if (len) { len.disabled = !isWord; len.value = isWord ? (Number(s.dataset.w) || 0) : 0; }
    if (lenv) lenv.textContent = !isWord ? "–"
      : (Number(s.dataset.w) >= 24 ? `${s.dataset.w}px` : "자동");
  }

  /* [재수술 2026-08-14 2차 — 콩 제안: "아예 찐을 보여주자"]
     흉내 카드를 그리는 대신 **접속자 목록의 내 카드를 통째로 복제**해서
     그 위에서 붙입니다. 배경·무늬·사진·목표 글까지 전부 진짜라,
     어긋날 것이 원리적으로 없어요. 복제본이라 카드의 클릭 세 곳도
     안 움직입니다 (위임 리스너가 보드에만 붙어 있으니까). */
  function renderStkEditor() {
    if (!_stkCard) return;
    _stkCard.innerHTML = "";
    const src = Array.from(
      document.querySelectorAll("#user-cards > .user-card:not(.share-card)"))
      .find(el => el.getAttribute("data-card-nick") === profileTargetNick());
    if (!src) {
      _stkCard.innerHTML = `<p class="hint" style="padding:22px 8px;text-align:center;">
        카드를 준비하는 중이에요… 잠시 뒤 다시 열어 주세요.</p>`;
      return;
    }
    const clone = src.cloneNode(true);
    clone.classList.add("stk-clone");
    clone.classList.remove("is-me");
    clone.removeAttribute("data-card-nick");   // 진짜 카드 셈(fixLonelyCard 등)에 안 잡히게
    clone.style.width = "100%";
    clone.style.maxWidth = "none";
    _stkCard.appendChild(clone);

    /* 복제된 스티커들에 손잡이 달기 — 자리는 클래스(deco-a…e)에서 읽습니다 */
    const st = _stkState();
    clone.querySelectorAll(".card-deco").forEach(el => {
      const m = el.className.match(/deco-([abcde])(?:\s|$)/);
      if (!m) return;
      const k = m[1];
      el.dataset.stk = k;
      const p = st.pos[k];
      el.dataset.custom = p ? "1" : "0";
      el.dataset.r = p ? p.r : 0;
      if (p) { el.dataset.x = p.x; el.dataset.y = p.y; if (p.w) el.dataset.w = p.w; }
    });
    _stkSelect(_stkSel && _stkCard.querySelector(`[data-stk="${_stkSel}"]`) ? _stkSel : "");
  }
  window._renderStkEditor = renderStkEditor;   // 스티커 선택이 바뀌면 다시 그리게

  if (_stkCard && !_stkCard.__bound) {
    _stkCard.__bound = true;
    let drag = null;

    _stkCard.addEventListener("pointerdown", (e) => {
      const s = e.target.closest("[data-stk]");
      if (!s) return;
      _stkSelect(s.dataset.stk);
      const r = _stkCard.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      drag = { s, dx: e.clientX - sr.left, dy: e.clientY - sr.top, r,
               sx: e.clientX, sy: e.clientY };
      s.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    _stkCard.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const { s, r } = drag;
      /* 4px 문턱 — 고르기만 한 클릭이 "만졌다"가 되지 않게 */
      if (s.dataset.custom !== "1" &&
          Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      _stkToFree(s);
      /* 좌우 -14% 까지 삐져나갈 수 있게 (양쪽 같은 허용치).
         오른쪽 벽에 바짝 붙이면 글자가 세로로 서는 것도 여기서 나옵니다 */
      let x = ((e.clientX - r.left - drag.dx) / r.width) * 100;
      let y = ((e.clientY - r.top - drag.dy) / r.height) * 100;
      x = Math.max(-14, Math.min(94, x));
      y = Math.max(-10, Math.min(96, y));
      s.dataset.x = Math.round(x * 10) / 10;
      s.dataset.y = Math.round(y * 10) / 10;
      _stkPaint(s);
    });
    const drop = () => {
      if (!drag) return;
      const moved = drag.s.dataset.custom === "1";
      drag = null;
      if (moved) _stkSaveDebounced();
    };
    _stkCard.addEventListener("pointerup", drop);
    _stkCard.addEventListener("pointercancel", drop);

    document.getElementById("prof-stk-rot")?.addEventListener("input", (e) => {
      const s = _stkCard.querySelector(`[data-stk="${_stkSel}"]`);
      if (!s) return;
      _stkToFree(s);                      // 기본 자리였으면 그 자리 그대로 좌표화
      s.dataset.r = e.target.value;
      document.getElementById("prof-stk-rotv").textContent = `${e.target.value}°`;
      _stkPaint(s);
      _stkSaveDebounced();
    });
    /* 길이 — 마스킹테이프처럼 길게. 24px 아래로 내리면 "자동"으로 */
    document.getElementById("prof-stk-len")?.addEventListener("input", (e) => {
      const s = _stkCard.querySelector(`[data-stk="${_stkSel}"]`);
      if (!s || !s.classList.contains("card-deco-word")) return;
      _stkToFree(s);
      const v = Number(e.target.value);
      s.dataset.w = v >= 24 ? v : 0;
      document.getElementById("prof-stk-lenv").textContent = v >= 24 ? `${v}px` : "자동";
      _stkPaint(s);
      _stkSaveDebounced();
    });
    document.getElementById("prof-stk-reset")?.addEventListener("click", () => {
      const s = _stkCard.querySelector(`[data-stk="${_stkSel}"]`);
      if (!s) return;
      s.dataset.custom = "0";             // 좌표를 지우면 CSS 기본 자리로 돌아갑니다
      _stkSaveDebounced();
      setTimeout(renderStkEditor, 300);   // 저장 뒤 기본 자리로 다시 그림
    });
  }
  renderStkEditor();

  /* ---- 눈사람 배경색 ---- */
  const bgWell  = document.getElementById("prof-snowbg");
  const bgHex   = document.getElementById("prof-snowbg-hex");
  const bgReset = document.getElementById("prof-snowbg-reset");
  const bgPre   = document.getElementById("prof-snowbg-presets");

  function applySnowBg(hex, opts = {}) {
    const c = sanitizeHexColor(hex);
    if (!c) return;

    if (bgWell && !opts.fromWell) bgWell.value = c;
    if (bgHex  && !opts.fromHex)  bgHex.value  = c;

    bgPre?.querySelectorAll(".color-chip").forEach(b => {
      b.classList.toggle("selected", (b.dataset.color || "").toLowerCase() === c.toLowerCase());
    });

    // 설정 창 안 미리보기도 즉시 갱신
    const prev = document.getElementById("prof-photo-preview");
    if (prev && !prev.classList.contains("has-photo")) {
      prev.innerHTML = snowmanSvg(profileTargetNick(), c);
    }

    saveMyProfile({ snowBg: c });
    window.rerenderUserCards?.();
    window.refreshChatAvatars?.();
  }

  if (bgWell) bgWell.oninput = () => applySnowBg(bgWell.value, { fromWell: true });
  if (bgHex) {
    bgHex.oninput = () => {
      // 다 치기 전에는 저장하지 않습니다 (#a 만 쳐도 반응하면 곤란해요)
      if (sanitizeHexColor(bgHex.value)) applySnowBg(bgHex.value, { fromHex: true });
    };
    bgHex.onblur = () => {
      if (!sanitizeHexColor(bgHex.value)) bgHex.value = bgWell ? bgWell.value : "";
    };
  }
  if (bgReset) bgReset.onclick = () => applySnowBg(snowColor(profileTargetNick()));
  bgPre?.querySelectorAll(".color-chip").forEach(btn => {
    btn.onclick = () => applySnowBg(btn.dataset.color);
  });

  /* ---- 사진 ---- */
  const photoBtn = document.getElementById("prof-photo-btn");
  const photoInput = document.getElementById("prof-photo-input");
  const photoClear = document.getElementById("prof-photo-clear");
  const photoPrev = document.getElementById("prof-photo-preview");
  const photoHint = document.getElementById("prof-photo-hint");

  if (photoBtn && photoInput) {
    photoBtn.onclick = () => photoInput.click();

    photoInput.onchange = async () => {
      const file = photoInput.files?.[0];
      photoInput.value = "";           // 같은 파일을 다시 골라도 change가 뜨게
      if (!file) return;

      photoBtn.disabled = true;
      const prevLabel = photoBtn.textContent;
      photoBtn.textContent = "줄이는 중…";

      try {
        const dataUrl = await fileToSquareDataUrl(file);
        await saveMyProfile({ photo: dataUrl });

        if (photoPrev) {
          photoPrev.classList.add("has-photo");
          photoPrev.innerHTML = "";
          const img = document.createElement("img");
          img.src = dataUrl;
          img.alt = "";
          photoPrev.appendChild(img);
        }
        photoClear?.classList.remove("hidden");
        if (photoHint) {
          photoHint.textContent =
            `카드와 채팅에 이 사진이 보여요. (${Math.round(dataUrl.length / 1024)}KB)`;
        }
        window.rerenderUserCards?.();
        // 사진을 올리면 눈사람이 안 보이므로 배경색 칸도 숨깁니다
        document.getElementById("prof-snowbg-block")?.classList.add("hidden");
      } catch (e) {
        alert(e?.message || "사진을 올리지 못했어요.");
      } finally {
        photoBtn.disabled = false;
        photoBtn.textContent = prevLabel;
      }
    };
  }

  if (photoClear) {
    photoClear.onclick = async () => {
      await saveMyProfile({ photo: "" });
      if (photoPrev) {
        photoPrev.classList.remove("has-photo");
        photoPrev.innerHTML = snowmanSvg(profileTargetNick());
      }
      photoClear.classList.add("hidden");
      if (photoHint) {
        photoHint.textContent =
          "정사각형으로 잘라 128px로 줄여서 저장해요. 안 올리면 닉네임에 맞는 색의 눈사람이 보여요.";
      }
      window.rerenderUserCards?.();
      document.getElementById("prof-snowbg-block")?.classList.remove("hidden");
    };
  }

}

window.renderProfilePanel = renderProfilePanel;

/**
 * 설정 모달을 열고 곧바로 프로필 탭으로 이동.
 * 내 카드의 ✏️ 버튼과, 필요하면 다른 곳에서도 호출할 수 있게 노출합니다.
 */
function openProfileEditor(nick) {
  if (!myNick) {
    alert("입장 후에 프로필을 설정할 수 있어요.");
    return;
  }
  /* [2026-08-15] 🧘 혼자 방 — 유령 카드를 누르면 그 카드를 꾸밉니다.
     진짜 방에서는 남의 카드를 건드릴 수 없으니 늘 내 카드로 되돌립니다. */
  window._profTargetNick = (window.SOLO && nick) ? String(nick) : myNick;
  window.openSettings?.();
  window.openTab?.("profile");
}
window.openProfileEditor = openProfileEditor;

/**
 * 카드는 status가 바뀔 때마다 통째로 다시 그려지므로
 * 버튼마다 리스너를 다는 대신 컨테이너에 위임합니다.
 */
function bindCardEditDelegate() {
  const host = document.getElementById("user-cards");
  if (!host || host._editDelegateBound) return;
  host._editDelegateBound = true;

  host.addEventListener("click", (e) => {
    /* [2026-08-09] 스티커 자리는 한 번 눌러서는 아무 일도 없습니다.
       카드 구석의 빈 자리라, 지나가다 스치듯 눌리기 쉬워요. 고르기 판은
       아래 dblclick 에서만 엽니다. 여기서는 다른 손잡이로 새어 나가지
       않게 막기만 합니다. */
    if (e.target?.closest?.("[data-pick-worktag]")) {
      e.preventDefault(); e.stopPropagation();
      return;
    }
    /* 프사 → 프로필 설정 */
    if (e.target?.closest?.("[data-edit-profile]")) {
      e.preventDefault(); e.stopPropagation();
      openProfileEditor(myNick);
      return;
    }
    /* 🧘 혼자 방 — 유령 카드의 프사를 눌러도 그 카드를 꾸밉니다.
       (진짜 방에는 [data-edit-profile] 가 내 카드에만 붙어 있어서
        여기까지 오지 않습니다) */
    if (window.SOLO) {
      const wrap = e.target?.closest?.(".card-avatar-wrap");
      const card = wrap && wrap.closest("[data-card-nick]");
      if (card) {
        e.preventDefault(); e.stopPropagation();
        openProfileEditor(card.getAttribute("data-card-nick"));
        return;
      }
    }
    /* 상태표 → 고르기 판 (2026-08-03: 4가지로 확장하며 팝업 방식 복귀) */
    if (e.target?.closest?.("[data-pick-status]")) {
      e.preventDefault(); e.stopPropagation();
      window.openStatusPicker?.(e.target.closest("[data-pick-status]"));
      return;
    }
  });

  /* [2026-08-09] 오늘의 작업 스티커 — **더블클릭**으로만 열립니다. */
  host.addEventListener("dblclick", (e) => {
    const slot = e.target?.closest?.("[data-pick-worktag]");
    if (!slot) return;
    e.preventDefault(); e.stopPropagation();
    window.openWorkTagPicker?.(slot);
  });

  /* 키보드로도 열 수 있게 (Enter · Space) */
  host.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const t = e.target;
    if (t?.closest?.("[data-pick-worktag]")) { e.preventDefault(); window.openWorkTagPicker?.(t); }
    else if (t?.closest?.("[data-edit-profile]")) { e.preventDefault(); openProfileEditor(myNick); }
    else if (t?.closest?.("[data-pick-status]")) { e.preventDefault(); window.openStatusPicker?.(t); }
  });
}
window.bindCardEditDelegate = bindCardEditDelegate;


/* =====================================================================
   [4] 기존 함수에 훅 연결
   ---------------------------------------------------------------------
   기존 파일을 크게 고치는 대신, 이미 정의된 함수를 감싸는 방식으로
   진입점을 추가합니다. (로드 순서상 여기가 마지막이라 안전)
   ===================================================================== */
(function installHooks() {

  // 설정 모달 탭 전환 시 프로필 패널 렌더
  const _openTab = window.openTab;
  if (typeof _openTab === "function" && !_openTab.__profilePatched) {
    const wrapped = function (name) {
      _openTab.apply(this, arguments);
      if (name === "profile") renderProfilePanel();
      /* [2026-08-06] 설정의 🎯 목표·투두 탭은 없앴습니다 (중복이라서).
         덩어리는 카드 아래칸 팝업과 🗂️ 나의 작업이 나눠 씁니다. */
      /* [2026-08-06] "📊 나의 작업" 탭은 설정에서 뺐습니다 —
         머리말의 [🗂️ 나의 작업] → 📊 기록 탭이 같은 것을 그립니다. */
    };
    wrapped.__profilePatched = true;
    window.openTab = wrapped;
  }

  /* 입장 완료 후 프로필 로드 + 시간 기록 시작

     [왜 입장 뒤인가] startTimelog 는 닉네임이 있어야 동작합니다.
     페이지 로드(init) 시점에는 닉네임이 아직 없어서 첫 줄에서 그냥
     돌아가므로, 입장한 뒤에 다시 불러줍니다. 여러 번 불려도
     안전하도록 만들어져 있습니다. */
  const _join = window.join;
  if (typeof _join === "function" && !_join.__profilePatched) {
    const wrapped = async function () {
      await _join.apply(this, arguments);
      if (myNick) {
        try { await afterJoinLoadProfile(); } catch (e) { console.warn("[afterJoinLoadProfile]", e); }
        try { window.startTimelog?.(); }      catch (e) { console.warn("[startTimelog]", e); }
        try { window.startWordcount?.(); }    catch (e) {}
      }
    };
    wrapped.__profilePatched = true;
    window.join = wrapped;
  }

  // init 시 접힘 상태 복원 + 바인딩
  const _init = window.init;
  if (typeof _init === "function" && !_init.__profilePatched) {
    const wrapped = function () {
      _init.apply(this, arguments);
      try { bindChatCollapse(); } catch (e) { console.warn("[bindChatCollapse]", e); }
      try { applySavedChatCollapsed(); } catch (e) { console.warn("[applySavedChatCollapsed]", e); }
      try { bindColumnGrips(); } catch (e) { console.warn("[bindColumnGrips]", e); }
      try { applySavedColumnWidths(); } catch (e) { console.warn("[applySavedColumnWidths]", e); }
      try { bindCardEditDelegate(); } catch (e) { console.warn("[bindCardEditDelegate]", e); }
      try { bindPanelCollapse(); } catch (e) { console.warn("[bindPanelCollapse]", e); }
      /* 시간 기록 — 카드 아래 상자 클릭, 상태변경 감지, 구간 기록 시작 */
      try { window.bindRecordOpen?.(); }    catch (e) { console.warn("[bindRecordOpen]", e); }
      try { window.hookTimelogStatus?.(); } catch (e) { console.warn("[hookTimelogStatus]", e); }
      try { window.startTimelog?.(); }      catch (e) { console.warn("[startTimelog]", e); }
    };
    wrapped.__profilePatched = true;
    window.init = wrapped;
  }

  // 퇴장 시 프로필 구독 해제
  const _leave = window.leaveRoom;
  if (typeof _leave === "function" && !_leave.__profilePatched) {
    const wrapped = async function () {
      /* 사람별로 달아 둔 리스너를 모두 뗍니다 */
      Object.values(_profileRefs).forEach(r => { try { r.off(); } catch (e) {} });
      _profileRefs = {};
      _profileSignature = null;
      window._profileCache = {};
      window._myProfile = null;
      return _leave.apply(this, arguments);
    };
    wrapped.__profilePatched = true;
    window.leaveRoom = wrapped;
  }

  // 접힌 상태에서 새 메시지 → 레일 배지
  const _render = window.renderChatMessage;
  if (typeof _render === "function" && !_render.__profilePatched) {
    const wrapped = function (box, data, key) {
      const r = _render.apply(this, arguments);
      try {
        /* [2026-08-04] Chatty 메시지는 레일 배지에 세지 않습니다 —
           접힘 중 레일 카운트는 메인 Chat 전용 (script_chatty.js 깃발) */
        if (data && data.type !== "system" && data.user !== myNick
            && !window._chattySuppressCount) {
          noteChatMessageWhileCollapsed();
        }
      } catch (e) {}
      return r;
    };
    wrapped.__profilePatched = true;
    window.renderChatMessage = wrapped;
  }
})();

/**
 * status 리스너를 다시 태우지 않고 카드만 다시 그리기.
 * script_realtime.js가 분리·노출한 renderUserCards를 캐시된 status로 호출합니다.
 */
window.rerenderUserCards = function () {
  try {
    if (window._statusCache) window.renderUserCards?.(window._statusCache);
  } catch (e) {}
};

/* =====================================================================
   TheMagam — 상태표를 누르면 뜨는 작은 고르기 판

   왜 돌려막기(누를 때마다 다음 상태)가 아니라 목록인가.
     네 가지를 돌리면 자리비움까지 가는 데 세 번을 눌러야 합니다.
     그리고 지금 무엇을 고르는 중인지가 안 보입니다.
     목록은 한 번에 원하는 것을 짚을 수 있습니다.

   실제 저장은 기존 <select id="db-status"> 를 대신 조작해서 합니다.
   그러면 이미 있는 저장·집계 흐름을 그대로 타므로, 시간 기록도
   따로 손댈 필요가 없습니다.
   ===================================================================== */
(function () {
  const CHOICES = [
    { v: "writing", label: "🔥WRITE🔥", cls: "status-writing" },   /* 집필 */
    { v: "focus",   label: "💻JOB💻",   cls: "status-focus"   },   /* 본업·다른 작업 */
    { v: "rest",    label: "☕BREAK☕",  cls: "status-rest"    },   /* 휴식 */
    { v: "away",    label: "💤AWAY💤",  cls: "status-away"    }    /* 자리비움 */
  ];

  let _pop = null;

  function close() {
    if (!_pop) return;
    _pop.remove();
    _pop = null;
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", close);
    window.removeEventListener("scroll", close, true);
  }
  function onDocClick(e) { if (_pop && !_pop.contains(e.target)) close(); }
  function onKey(e) { if (e.key === "Escape") close(); }

  function pick(v) {
    const sel = document.getElementById("db-status");
    if (sel) {
      sel.value = v;
      /* 원래 화면에서 고르는 것과 똑같이 취급되도록 알림을 냅니다.
         (이 select 에는 oninput 이 걸려 있습니다) */
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      window.renderQuickStatusBtn?.();
    }
    close();
  }

  window.openStatusPicker = function (anchor) {
    close();
    if (!anchor) return;

    const cur = document.getElementById("db-status")?.value || "";
    const pop = document.createElement("div");
    pop.className = "status-pop";
    pop.setAttribute("role", "menu");
    pop.innerHTML = CHOICES.map(c => `
      <button type="button" class="status-pop-item ${c.cls}${c.v === cur ? " on" : ""}"
              role="menuitem" data-status-val="${c.v}">${c.label}</button>`).join("");

    document.body.appendChild(pop);

    /* 카드 위에 겹치지 않게 상태표 바로 아래에 붙입니다.
       화면 오른쪽·아래로 넘치면 안쪽으로 밀어 넣습니다. */
    const r = anchor.getBoundingClientRect();
    /* 🧘 혼자 방의 확대·축소 — 재는 자를 하나로 맞춥니다 (진짜 방은 늘 1) */
    const _z = (window.uiZoom?.() || 1);
    const VW = innerWidth / _z, VH = innerHeight / _z;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = r.left / _z;
    let top  = r.bottom / _z + 6;
    if (left + w > VW - 8) left = VW - w - 8;
    if (top  + h > VH - 8) top  = r.top / _z - h - 6;
    pop.style.left = Math.max(8, left) + "px";
    pop.style.top  = Math.max(8, top)  + "px";

    pop.addEventListener("click", (e) => {
      const b = e.target.closest("[data-status-val]");
      if (b) pick(b.dataset.statusVal);
    });

    _pop = pop;
    setTimeout(() => {
      document.addEventListener("click", onDocClick, true);
      document.addEventListener("keydown", onKey, true);
      window.addEventListener("resize", close);
      window.addEventListener("scroll", close, true);
    }, 0);
  };
})();
