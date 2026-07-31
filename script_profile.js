/* =====================================================================
   script_profile.js — 채팅 접기 + 프로필 편집
   ---------------------------------------------------------------------
   기존 파일 수정을 최소화하려고 신규 모듈로 분리했습니다.
   index.html에서 script_realtime.js 다음에 로드됩니다.

   [1] 채팅 사이드바 접기/펼치기 (기기별 · localStorage)
   [2] 프로필 데이터 (필명별 · Firebase users/{닉}/profile)
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
   프사·투두·목표처럼 필명에 묶여 서버에 있는 것은 건드리지 않습니다.
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
    // 필명별로 저장된 테마 캐시도 함께 정리
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

/**
 * 저장된 사진 값 검증.
 * data:image/... 로 시작하는 문자열만 통과시켜, 외부 URL이나
 * javascript: 같은 스킴이 img src에 들어가는 경로를 막습니다.
 */
function sanitizePhoto(v) {
  const s = String(v || "");
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) return "";
  if (s.length > PHOTO_MAX_BYTES * 2) return "";
  return s;
}

/** File → 정사각 크롭 + 축소 → data URL */
function fileToSquareDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("파일이 없어요."));
    if (!/^image\//.test(file.type)) return reject(new Error("이미지 파일만 올릴 수 있어요."));
    if (file.size > PHOTO_INPUT_MAX) return reject(new Error("파일이 너무 커요. 12MB 이하로 올려주세요."));

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
   배경색은 필명에서 계산하므로 같은 사람은 늘 같은 색이고,
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

/** 필명으로 만든 눈사람 SVG 문자열 */
/* 카드 무늬 — CSS 그라데이션으로 그리므로 이미지 파일이 필요 없습니다 */
const CARD_PATTERNS = [
  { id: "none",           label: "무늬 없음" },
  { id: "dots",           label: "도트" },
  { id: "grid",           label: "그리드" },
  { id: "cross",          label: "십자" },
  { id: "check",          label: "체크" },
  { id: "line",           label: "가로 줄무늬" },
  { id: "stripe",         label: "사선 줄무늬 ／" },
  { id: "stripe-rev",     label: "사선 줄무늬 ＼" },
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

/** 눈사람 배경색 — 본인이 고른 색이 있으면 그것, 없으면 필명으로 자동 배정 */
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

/** 전체 프로필 구독 — 카드 렌더가 window._profileCache를 참조합니다 */
let _profilesRef = null;
let _profileSignature = null;

function listenProfiles() {
  if (_profilesRef) return;
  _profilesRef = db.ref("users");
  _profilesRef.on("value", snap => {
    const all = snap.val() || {};
    const out = {};
    for (const nick in all) {
      const p = all[nick]?.profile;
      if (p) out[nick] = p;
    }

    /* ✅ [FIX] 프로필 사진 깜빡임

       users 경로 전체를 구독하고 있어서, 같은 경로에 저장되는 투두·오늘 목표가
       바뀔 때도 이 콜백이 돌았습니다. 누군가 목표를 타이핑하면 그때마다
       카드가 통째로 다시 그려지면서 사진이 깜빡였어요.

       프로필 부분만 뽑아 직전 값과 비교하고, 실제로 달라졌을 때만 다시 그립니다.
       (구독 경로를 좁히려면 필명별로 리스너를 달아야 해서, 인원이 드나드는
        구조상 이 방식이 더 단순합니다.) */
    const sig = JSON.stringify(out);
    if (sig === _profileSignature) return;
    _profileSignature = sig;

    window._profileCache = out;

    // 카드·채팅 아바타에 즉시 반영 (status 리스너를 기다리지 않음)
    window.rerenderUserCards?.();
    try { refreshChatAvatars(); } catch (e) {}
    try { refreshChatNickColors(); } catch (e) {}
  });
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

async function saveMyProfile(patch) {
  if (!myNick) return;
  const next = { ...(window._myProfile || {}), ...patch };
  window._myProfile = next;

  try {
    await db.ref(`users/${myNick}/profile`).update(next);
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

/* TheMagam — 오늘 목표와 나의 투두는 창이 아니라 "옮겨 다니는 덩어리"입니다.

   이 둘을 보여줄 곳이 두 군데예요.
     · 카드 아래칸을 눌렀을 때 뜨는 팝업 (#goals-body)
     · 설정 → 🎯 목표 · 투두 탭        (#panel-goals)

   같은 것을 두 벌 만들면 한쪽에 적은 게 다른 쪽에 안 보이고, 저장도
   엉킵니다. 그래서 실제 덩어리는 하나만 두고 필요한 곳으로 옮깁니다.
   안에 걸린 이벤트와 저장 로직이 그대로 따라오니까요.
   (다시 그리면 조용히 저장이 끊깁니다 — 예전에 겪은 적이 있습니다.) */
function mountGoalBlocks(host) {
  if (!host) return;
  /* 목표를 위, 투두를 아래로. 역순으로 넣습니다. */
  ["todo-block", "status-block"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("in-profile");
    host.insertBefore(el, host.firstChild);
  });
}
window.mountGoalBlocks = mountGoalBlocks;

/** 카드 아래칸 → 목표·투두 팝업 */
function openGoals() {
  if (!myNick) { alert("입장 후에 쓸 수 있어요."); return; }
  const modal = document.getElementById("goals-modal");
  if (!modal) return;
  mountGoalBlocks(document.getElementById("goals-body"));
  modal.style.display = "flex";
}
function closeGoals() {
  const modal = document.getElementById("goals-modal");
  if (modal) modal.style.display = "none";
}
window.openGoals = openGoals;
window.closeGoals = closeGoals;

function renderProfilePanel() {
  const host = document.getElementById("panel-profile");
  if (!host) return;

  if (!myNick) {
    host.innerHTML = `<div class="set-block"><p class="hint">입장 후에 프로필을 설정할 수 있어요.</p></div>`;
    return;
  }

  const p = window._myProfile || {};
  const photo = sanitizePhoto(p.photo);
  const curSnowBg = sanitizeHexColor(p.snowBg) || snowColor(myNick);
  const curCardBg = sanitizeHexColor(p.cardBg) || "#FFFFFF";
  const curPat = sanitizePattern(p.cardPattern);
  const curPatColor = sanitizeHexColor(p.patColor) || "#D8DEE8";
  const curNickColor = sanitizeHexColor(p.nickColor) || "#5A6473";

  host.innerHTML = `
    <div class="set-block">
      <div class="set-title">프사 사진</div>
      <div class="profile-emoji-row">
        <div class="profile-photo-preview${photo ? " has-photo" : ""}" id="prof-photo-preview">
          ${photo ? `<img src="${escapeHtml(photo)}" alt="">` : snowmanSvg(myNick)}
        </div>
        <div class="profile-emoji-meta">
          <div class="profile-emoji-name">${escapeHtml(myNick)}</div>
          <div class="set-row" style="margin-top:8px;">
            <button type="button" class="ghost-btn compact" id="prof-photo-btn">사진 올리기</button>
            <button type="button" class="ghost-btn compact danger${photo ? "" : " hidden"}" id="prof-photo-clear">지우기</button>
          </div>
          <div class="hint" id="prof-photo-hint">${
            photo ? "카드와 채팅에 이 사진이 보여요."
                  : "정사각형으로 잘라 128px로 줄여서 저장해요. 안 올리면 필명에 맞는 색의 눈사람이 보여요."
          }</div>
        </div>
      </div>
      <input type="file" id="prof-photo-input" accept="image/*" class="sr-only">
    </div>

    <div class="set-block">
      <div class="set-title">채팅 닉네임 색</div>
      <div class="color-row">
        <input type="color" id="prof-nickcolor" class="color-well"
               value="${curNickColor}" aria-label="닉네임 색 고르기">
        <input type="text" id="prof-nickcolor-hex" class="color-hex"
               value="${curNickColor}" maxlength="7" spellcheck="false" aria-label="닉네임 색 코드">
        <button type="button" class="ghost-btn compact" id="prof-nickcolor-reset">기본값</button>
      </div>
      <div class="nick-preview" id="prof-nick-preview">${escapeHtml(myNick)}</div>
      <p class="hint">채팅 말풍선 위에 뜨는 <b>내 이름 색</b>이에요. 다른 분들 화면에도 이 색으로 보입니다.</p>
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

  `;

  bindProfilePanel();
}

function bindProfilePanel() {
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
      prev.innerHTML = snowmanSvg(myNick, c);
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
  if (bgReset) bgReset.onclick = () => applySnowBg(snowColor(myNick));
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
        photoPrev.innerHTML = snowmanSvg(myNick);
      }
      photoClear.classList.add("hidden");
      if (photoHint) {
        photoHint.textContent =
          "정사각형으로 잘라 128px로 줄여서 저장해요. 안 올리면 필명에 맞는 색의 눈사람이 보여요.";
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
function openProfileEditor() {
  if (!myNick) {
    alert("입장 후에 프로필을 설정할 수 있어요.");
    return;
  }
  window.openSettings?.();
  window.openTab?.("profile");
}
window.openProfileEditor = openProfileEditor;

/** 카드의 펫을 누르면 설정 → 🐾 펫 으로 바로 갑니다 */
function openPetPanel() {
  if (!myNick) { alert("입장 후에 볼 수 있어요."); return; }
  window.openSettings?.();
  window.openTab?.("pet");
}
window.openPetPanel = openPetPanel;

/**
 * 카드는 status가 바뀔 때마다 통째로 다시 그려지므로
 * 버튼마다 리스너를 다는 대신 컨테이너에 위임합니다.
 */
function bindCardEditDelegate() {
  const host = document.getElementById("user-cards");
  if (!host || host._editDelegateBound) return;
  host._editDelegateBound = true;

  host.addEventListener("click", (e) => {
    /* 프사 → 프로필 설정 */
    if (e.target?.closest?.("[data-edit-profile]")) {
      e.preventDefault(); e.stopPropagation();
      openProfileEditor();
      return;
    }
    /* 펫 → 펫 관리 창 */
    if (e.target?.closest?.("[data-open-pet]")) {
      e.preventDefault(); e.stopPropagation();
      window.openPetPanel?.();
      return;
    }
    /* 상태표 → 상태 고르기 */
    if (e.target?.closest?.("[data-pick-status]")) {
      e.preventDefault(); e.stopPropagation();
      window.openStatusPicker?.(e.target.closest("[data-pick-status]"));
      return;
    }
  });

  /* 키보드로도 열 수 있게 (Enter · Space) */
  host.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const t = e.target;
    if (t?.closest?.("[data-open-pet]")) { e.preventDefault(); window.openPetPanel?.(); }
    else if (t?.closest?.("[data-edit-profile]")) { e.preventDefault(); openProfileEditor(); }
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
      if (name === "goals")   mountGoalBlocks(document.getElementById("panel-goals"));
      if (name === "pet")     window.renderPetPanel?.();
      if (name === "record")  window.renderMyRecordPanel?.();
    };
    wrapped.__profilePatched = true;
    window.openTab = wrapped;
  }

  /* 입장 완료 후 프로필 로드 + 시간 기록·펫 시작

     [FIX] 펫 관리 창에서 아무것도 안 눌리던 문제

     startTimelog 와 startPet 을 init(페이지 로드) 에서만 불렀습니다.
     그 시점에는 필명이 아직 없어서 두 함수가 첫 줄에서 그냥 돌아갑니다.
     그래서 펫 정보가 비어 있었고, 껍데기·색을 눌러도 저장할 대상이
     없어 조용히 아무 일도 일어나지 않았습니다.

     화면에는 펫이 보였습니다. 값이 없을 때 기본값으로 그리게 해둔
     탓입니다 — "보이는데 안 먹는다" 가 그래서 나왔습니다.

     입장한 뒤에 다시 불러줍니다. 두 함수 모두 여러 번 불려도
     안전하도록 만들어져 있습니다. */
  const _join = window.join;
  if (typeof _join === "function" && !_join.__profilePatched) {
    const wrapped = async function () {
      await _join.apply(this, arguments);
      if (myNick) {
        try { await afterJoinLoadProfile(); } catch (e) { console.warn("[afterJoinLoadProfile]", e); }
        try { window.startTimelog?.(); }      catch (e) { console.warn("[startTimelog]", e); }
        try { window.startWordcount?.(); }    catch (e) {}
        try { await window.startPet?.(); }    catch (e) { console.warn("[startPet]", e); }
        try { window.renderPetPanel?.(); }    catch (e) {}
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
      try { window.startPet?.(); }          catch (e) { console.warn("[startPet]", e); }
    };
    wrapped.__profilePatched = true;
    window.init = wrapped;
  }

  // 퇴장 시 프로필 구독 해제
  const _leave = window.leaveRoom;
  if (typeof _leave === "function" && !_leave.__profilePatched) {
    const wrapped = async function () {
      try { _profilesRef?.off(); } catch (e) {}
      _profilesRef = null;
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
        if (data && data.type !== "system" && data.user !== myNick) {
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
    { v: "writing", label: "WORK",      cls: "status-writing" },
    { v: "focus",   label: "🔥초집중🔥", cls: "status-focus"   },
    { v: "rest",    label: "휴식",       cls: "status-rest"    },
    { v: "away",    label: "자리비움",   cls: "status-away"    }
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
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = r.left;
    let top  = r.bottom + 6;
    if (left + w > innerWidth - 8)  left = innerWidth - w - 8;
    if (top  + h > innerHeight - 8) top  = r.top - h - 6;
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
