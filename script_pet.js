/* =====================================================================
   script_pet.js — 펫 키우기

   ---------------------------------------------------------------------
   무엇을 하는가

     집필 시간(WORK + 🔥초집중)이 쌓이면 펫이 자랍니다.
       · 5시간마다 1레벨, 100시간에 Lv.20 만렙
       · 만렙을 찍으면 도감에 들어가고, 안 가진 종류가 자동으로 시작
       · 20종 · 색은 종류마다 고정

   ---------------------------------------------------------------------
   Lv.1 은 "껍데기" 입니다

     무엇이 나올지 모르는 채로 시작합니다. 종류에 따라 담긴 것이 달라요.
       알        용 · 공작 · 병아리 · 펭귄
       보자기     고양이 · 강아지 · 토끼 · 다람쥐
       나무 상자  곰 · 물개 · 고래 · 판다
       씨앗       꽃 · 나무 · 풀
       선물 상자  구름 · 돌멩이 · 해 · 별

     Lv.2 에서 껍데기를 걸친 모습으로 태어나고, Lv.3 부터 온전해집니다.
     껍데기에는 펫 색이 들어가므로 "색은 미리, 종류는 나중에" 보입니다.

   ---------------------------------------------------------------------
   그림을 왜 계산으로 만드는가

     20종 × 20레벨 = 400장을 손으로 그릴 수는 없습니다.

     그래서 레벨을 0~1 값(t)으로 바꿔서 비율을 이어 움직이고, 특정
     레벨에서 부품을 붙입니다 (Lv.5 꼬리 · Lv.10 무늬 · Lv.15 날개 · 만렙 반짝이).
     색도 하나만 받아서 밝은 색·어두운 색을 계산해 씁니다.

     새 종류를 넣을 때는 DRAW 에 함수 하나만 추가하면 됩니다.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------------------------------------------------------------
     [1] 규칙
     --------------------------------------------------------------- */
  /* [변경] 4시간 10레벨(40시간) → 5시간 20레벨(100시간)

     너무 빨리 다 자란다는 이야기가 있어서 늦췄습니다. 하루 2시간 쓰는
     분이 50일쯤 걸립니다. 부품이 붙는 자리도 Lv.5 / 10 / 15 / 20 으로
     벌려서, 오래 볼 거리가 생기게 했습니다. */
  const HOURS_PER_LEVEL = 5;
  const MAX_LEVEL       = 20;

  /* 부품이 붙는 레벨 — 한곳에 모아두면 다 같이 옮기기 쉽습니다 */
  const AT_TAIL = 5;    // 꼬리·날갯짓 같은 첫 변화
  const AT_MARK = 10;   // 무늬·잔가지
  const AT_WING = 15;   // 날개·수염

  const MS_PER_HOUR     = 60 * 60 * 1000;
  const PET_MS          = HOURS_PER_LEVEL * MAX_LEVEL * MS_PER_HOUR;   // 40시간

  const INK        = "#4A3F35";   // 껍데기 윤곽선 — 늘 같은 진한 갈색
  const HORN_GOLD  = "#E9B44C";   // 용의 뿔
  const RIBBON     = "#FFD028";   // 선물 상자 리본

  /* 종류 — group 이 Lv.1 껍데기를, hex 가 몸 색을 정합니다.

     [변경] 색은 이제 고를 수 없습니다. 종류마다 하나로 못박았어요.
     그래야 "무엇이 나왔나" 가 색으로도 읽히고, 도감이 20칸으로
     단순해집니다. 20색이 서로 겹치지 않게 골랐습니다. */
  const SPECIES = [
    { id: "dragon",   label: "용",      group: "egg",   hex: "#17A67F" },
    { id: "peacock",  label: "공작",    group: "egg",   hex: "#0E7C86" },
    { id: "chick",    label: "병아리",  group: "egg",   hex: "#FFD447" },
    { id: "penguin",  label: "펭귄",    group: "egg",   hex: "#2C4E8A" },

    { id: "cat",      label: "고양이",  group: "cloth", hex: "#9C988E" },
    { id: "dog",      label: "강아지",  group: "cloth", hex: "#C08A3E" },
    { id: "rabbit",   label: "토끼",    group: "cloth", hex: "#F4A9C0" },
    { id: "squirrel", label: "다람쥐",  group: "cloth", hex: "#D9744A" },

    { id: "bear",     label: "곰",      group: "crate", hex: "#7E5233" },
    { id: "seal",     label: "물개",    group: "crate", hex: "#8095A8" },
    { id: "whale",    label: "고래",    group: "crate", hex: "#52A8E0" },
    { id: "panda",    label: "판다",    group: "crate", hex: "#3A3A38" },
    { id: "octopus",  label: "문어",    group: "crate", hex: "#B54A8C" },

    { id: "flower",   label: "꽃",      group: "seed",  hex: "#E8574C" },
    { id: "tree",     label: "나무",    group: "seed",  hex: "#45822A" },
    { id: "grass",    label: "풀",      group: "seed",  hex: "#9DC94F" },

    { id: "cloud",    label: "구름",    group: "gift",  hex: "#B7CFE4" },
    { id: "stone",    label: "돌멩이",  group: "gift",  hex: "#6B6760" },
    { id: "sun",      label: "해",      group: "gift",  hex: "#F7A62B" },
    { id: "star",     label: "별",      group: "gift",  hex: "#A78BE0" }
  ];

  const SHELLS = {
    egg:   "알",
    cloth: "보자기",
    crate: "나무 상자",
    seed:  "씨앗",
    gift:  "선물 상자"
  };

  /* 껍데기 색은 종류와 무관하게 고정입니다.

     [중요] 몸 색이 종류마다 다르니, 껍데기에 그 색을 쓰면 색만 보고
     무엇이 들었는지 알 수 있습니다. 껍데기의 뜻이 사라지므로 껍데기
     종류마다 정해진 색을 씁니다. */
  const SHELL_COLOR = {
    egg:   "#EFC7D8",
    cloth: "#A9A0E8",
    crate: "#B98A52",
    seed:  "#C69A5E",
    gift:  "#F4A9C0"
  };

  const SPECIES_IDS = SPECIES.map(s => s.id);

  function spec(id) { return SPECIES.find(s => s.id === id) || SPECIES[0]; }
  function speciesLabel(id) { return spec(id).label; }
  function speciesGroup(id) { return spec(id).group; }
  function shellLabel(id) { return SHELLS[speciesGroup(id)] || "알"; }
  function colorHex(id) { return spec(id).hex; }

  /* ---------------------------------------------------------------
     [2] 색 계산 — 몸통색 하나에서 나머지를 만듭니다
     --------------------------------------------------------------- */
  function hexToRgb(hex) {
    const h = String(hex).replace("#", "");
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  function rgbToHex(r, g, b) {
    const c = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
    return "#" + c(r) + c(g) + c(b);
  }
  /** amt > 0 이면 밝게, < 0 이면 어둡게 (−1 ~ 1) */
  function shade(hex, amt) {
    const { r, g, b } = hexToRgb(hex);
    if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
    const k = 1 + amt;
    return rgbToHex(r * k, g * k, b * k);
  }

  /** 색표는 종류 하나로 만듭니다 (색은 고를 수 없습니다) */
  function palette(species) {
    const base = spec(species).hex;
    const p = {
      body:  base,
      light: shade(base, 0.42),
      pale:  shade(base, 0.72),
      soft:  shade(base, 0.86),
      dark:  shade(base, -0.55),
      line:  shade(base, -0.30)
    };
    /* 판다만 예외 — 몸은 늘 흰빛이고 고른 색이 무늬로 들어갑니다.
       판다의 매력이 대비라서, 여기서만 규칙을 뒤집습니다. */
    if (species === "panda") {
      p.body = "#F2F0EA";
      p.mark = base;
      p.markDark = shade(base, -0.35);
      p.dark = shade(base, -0.6);
    }
    return p;
  }

  /* ---------------------------------------------------------------
     [3] 레벨 계산
     --------------------------------------------------------------- */
  function levelFromMs(ms) {
    const lv = Math.floor(Math.max(0, ms) / (HOURS_PER_LEVEL * MS_PER_HOUR)) + 1;
    return Math.max(1, Math.min(MAX_LEVEL, lv));
  }

  function petProgress(totalMs, doneCount) {
    const used = Math.max(0, Number(doneCount) || 0) * PET_MS;
    const curMs = Math.max(0, (Number(totalMs) || 0) - used);
    const capped = Math.min(curMs, PET_MS);
    const isMax = capped >= PET_MS;
    const intoLevel = capped % (HOURS_PER_LEVEL * MS_PER_HOUR);
    return {
      level: levelFromMs(capped),
      isMax,
      curMs: capped,
      totalNeed: PET_MS,
      ratio: Math.max(0, Math.min(1, capped / PET_MS)),
      toNextMs: isMax ? 0 : (HOURS_PER_LEVEL * MS_PER_HOUR) - intoLevel,
      overflowMs: Math.max(0, curMs - PET_MS)
    };
  }

  /* ---------------------------------------------------------------
     [4] 다음 펫 뽑기 — 같은 것이 또 나오지 않게
     --------------------------------------------------------------- */
  function pickNextPet(dex, rnd) {
    const rand = typeof rnd === "function" ? rnd : Math.random;
    const owned = new Set(Object.keys(dex || {}));

    /* 색이 종류에 묶였으니 도감은 20칸입니다.
       아직 못 모은 종류가 있으면 그중에서, 다 모았으면 아무거나. */
    const fresh = SPECIES_IDS.filter(sp => !owned.has(sp));
    const pool = fresh.length ? fresh : SPECIES_IDS;
    return { species: pool[Math.floor(rand() * pool.length)] };
  }

  /* 도감 열쇠는 종류뿐입니다 (색을 못 고르므로 조합이 없습니다) */
  function dexKey(species) { return species; }

  /* 껍데기를 고르면 그 그룹 안에서 무작위로 하나를 뽑습니다.

     고르는 것은 "껍데기"까지이고 안에 든 것은 여전히 비밀입니다.
     그래서 고르는 행위가 결과를 조작하지 않아요 — 원하는 종류를
     노려서 뽑을 수는 없습니다.
     아직 못 모은 종류를 먼저 씁니다. */
  function pickInGroup(group, dex, rnd) {
    const rand = typeof rnd === "function" ? rnd : Math.random;
    const owned = new Set(Object.keys(dex || {}));
    const inGroup = SPECIES_IDS.filter(id => speciesGroup(id) === group);
    if (!inGroup.length) return null;
    const fresh = inGroup.filter(id => !owned.has(id));
    const pool = fresh.length ? fresh : inGroup;
    return pool[Math.floor(rand() * pool.length)];
  }

  /* ---------------------------------------------------------------
     [5] 그림 — 좌표계는 60 × 56 고정
     --------------------------------------------------------------- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  const n1 = v => Number(v).toFixed(1);

  function sparkles(show) {
    if (!show) return "";
    const s = (x, y, r) =>
      `<path d="M${x} ${y}l${r} ${n1(r * 2.9)} ${n1(r * 2.9)} ${r}-${n1(r * 2.9)} ${r}L${x} ${n1(y + r * 8)}l-${r} -${n1(r * 3.3)}-${n1(r * 2.9)} -${r}z" fill="#EF9F27"/>`;
    return s(52, 8, 1.1) + s(7, 24, 0.85);
  }

  /** 눈·입 — 거의 모든 종류가 같이 씁니다 */
  function face(cx, cy, r, p, smile) {
    const dx = r * 0.36, ey = cy - r * 0.05, er = Math.max(1.2, r * 0.18);
    return `
      <circle cx="${n1(cx - dx)}" cy="${n1(ey)}" r="${n1(er)}" fill="${p.dark}"/>
      <circle cx="${n1(cx + dx)}" cy="${n1(ey)}" r="${n1(er)}" fill="${p.dark}"/>
      ${smile ? `<path d="M${n1(cx - r * 0.22)} ${n1(cy + r * 0.38)}q${n1(r * 0.22)} ${n1(r * 0.2)} ${n1(r * 0.44)} 0" stroke="${p.dark}" stroke-width="1.2" fill="none" stroke-linecap="round"/>` : ""}`;
  }

  /* ===============================================================
     [5-1] Lv.1 껍데기
     =============================================================== */
  /* 보자기는 clipPath 를 씁니다. id 가 겹치면 한 화면에 여러 마리를 그릴 때
     (도감처럼) 서로의 잘라내기 틀을 물어와 줄무늬가 사라집니다.
     그래서 그릴 때마다 새 id 를 붙입니다. */
  let _clipSeq = 0;

  /** 껍데기용 색표 — 껍데기 종류의 고정색에서 만듭니다 */
  function shellPalette(group) {
    const base = SHELL_COLOR[group] || SHELL_COLOR.egg;
    return {
      body:  base,
      light: shade(base, 0.30),
      pale:  shade(base, 0.58),
      soft:  shade(base, 0.78),
      dark:  shade(base, -0.55),
      line:  shade(base, -0.30)
    };
  }

  const SHELL_DRAW = {

    egg(p) {
      return `
        <ellipse cx="30" cy="32" rx="11" ry="14" fill="#F4F1E8" stroke="${INK}" stroke-width="1.4"/>
        <ellipse cx="28" cy="27" rx="6.5" ry="8" fill="#FFFFFF" opacity=".55"/>
        <circle cx="24" cy="37" r="2.2" fill="${p.light}"/>
        <circle cx="34" cy="30" r="1.7" fill="${p.light}"/>
        <circle cx="31" cy="41" r="1.4" fill="${p.light}"/>`;
    },

    /* 보자기 — 세로 줄무늬 + 큰 두 갈래 리본 */
    cloth(p) {
      const body = "M30 22C13 24 9 35 13 43 17 50 43 50 47 43 51 35 47 24 30 22Z";
      const cid = "petclip" + (++_clipSeq);
      return `
        <defs><clipPath id="${cid}"><path d="${body}"/></clipPath></defs>
        <g clip-path="url(#${cid})">
          <rect x="8"  y="20" width="12" height="32" fill="${p.light}"/>
          <rect x="20" y="20" width="10" height="32" fill="${p.soft}"/>
          <rect x="30" y="20" width="9"  height="32" fill="${p.pale}"/>
          <rect x="39" y="20" width="13" height="32" fill="${p.body}"/>
        </g>
        <path d="${body}" fill="none" stroke="${INK}" stroke-width="1.5"/>
        <path d="M20 22.6v25M30 21.8v27M39 22.4v25.6" stroke="${INK}" stroke-width="1.1"/>
        <path d="M27 21C18 9 5 7 8 15 10 20 21 23 27 21Z" fill="${p.soft}" stroke="${INK}" stroke-width="1.5"/>
        <path d="M33 21C42 9 55 7 52 15 50 20 39 23 33 21Z" fill="${p.light}" stroke="${INK}" stroke-width="1.5"/>
        <path d="M27 18.5q-2.5 -1.5 -1 -3.5" stroke="${INK}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
        <path d="M33 18.5q2.5 -1.5 1 -3.5" stroke="${INK}" stroke-width="1.1" fill="none" stroke-linecap="round"/>
        <rect x="26.6" y="16.5" width="6.8" height="6.5" rx="2" fill="${p.pale}" stroke="${INK}" stroke-width="1.4"/>`;
    },

    crate(p) {
      return `
        <rect x="14" y="24" width="28" height="20" rx="2.5" fill="#B98A52" stroke="${INK}" stroke-width="1.4"/>
        <rect x="14" y="24" width="28" height="5"  rx="2"   fill="#A0743F" stroke="${INK}" stroke-width="1.2"/>
        <path d="M14 34h28M22 29v15M34 29v15" stroke="${INK}" stroke-width="1.1" opacity=".55"/>
        <circle cx="18.5" cy="26.5" r="1" fill="${INK}" opacity=".6"/>
        <circle cx="37.5" cy="26.5" r="1" fill="${INK}" opacity=".6"/>
        <path d="M19 22h22" stroke="${p.body}" stroke-width="2.6" stroke-linecap="round"/>`;
    },

    seed(p) {
      return `
        <path d="M30 45q-8.5 -4.5 -8.5 -12.5 0 -8.5 8.5 -12.5 8.5 4 8.5 12.5 0 8 -8.5 12.5z"
              fill="#C69A5E" stroke="${INK}" stroke-width="1.4"/>
        <path d="M30 42q-5 -4 -5 -10 0 -6 5 -10" stroke="${INK}" stroke-width="1" fill="none" opacity=".45"/>
        <path d="M30 20v-5" stroke="${p.body}" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M30 16q4.5 -4.5 6.5 -1 -3 3.5 -6.5 1z" fill="${p.light}" stroke="${INK}" stroke-width="1.1"/>`;
    },

    /* 선물 상자 — 납작한 정면 상자 + 노란 리본 */
    gift(p) {
      return `
        <rect x="14" y="26" width="28" height="18" rx="2.5" fill="${p.light}" stroke="${INK}" stroke-width="1.4"/>
        <rect x="12" y="21.5" width="32" height="6.5" rx="2" fill="${p.body}" stroke="${INK}" stroke-width="1.4"/>
        <path d="M30 22v22" stroke="${RIBBON}" stroke-width="3.4"/>
        <path d="M30 21.5q-7.5 -9.5 -10.5 -3 3 4.5 10.5 3z" fill="${RIBBON}" stroke="${INK}" stroke-width="1.2"/>
        <path d="M30 21.5q7.5 -9.5 10.5 -3 -3 4.5 -10.5 3z" fill="${RIBBON}" stroke="${INK}" stroke-width="1.2"/>
        <circle cx="30" cy="20" r="2.3" fill="${shade(RIBBON, -0.2)}" stroke="${INK}" stroke-width="1.1"/>`;
    }
  };

  /* Lv.2 — 껍데기를 걸친 모습 (몸 위에 조각만 얹습니다) */
  function shellRemnant(group, p, head) {
    const h = head || { cx: 28, cy: 20, r: 9 };
    switch (group) {
      case "egg":
        return `
          <path d="M${n1(h.cx - h.r - 1)} ${n1(h.cy - h.r * 0.35)}
                   l3 3 3 -3 3 3 3 -3 3 3 3 -3"
                stroke="#E4DFD2" stroke-width="2" fill="none" stroke-linejoin="round"/>
          <path d="M${n1(h.cx - h.r - 1)} ${n1(h.cy - h.r * 0.35)}
                   a${n1(h.r + 1)} ${n1(h.r + 1)} 0 0 1 ${n1((h.r + 1) * 2)} 0z"
                fill="#F4F1E8" stroke="${INK}" stroke-width="1.1"/>`;
      case "cloth":
        return `<path d="M${n1(h.cx - 10)} ${n1(h.cy + h.r)}q10 14 20 0 -4 12 -20 0z"
                      fill="${p.soft}" stroke="${INK}" stroke-width="1.1"/>`;
      case "crate":
        return `<rect x="${n1(h.cx - 13)}" y="38" width="26" height="10" rx="2"
                      fill="#B98A52" stroke="${INK}" stroke-width="1.2"/>`;
      case "seed":
        return `<path d="M${n1(h.cx - 5)} 46q5 4 10 0 -2 -5 -10 0z"
                      fill="#C69A5E" stroke="${INK}" stroke-width="1.1"/>`;
      case "gift":
        return `
          <path d="M${n1(h.cx)} ${n1(h.cy - h.r + 1)}q-6 -7 -8.5 -2 2.5 3.5 8.5 2z" fill="${RIBBON}" stroke="${INK}" stroke-width="1"/>
          <path d="M${n1(h.cx)} ${n1(h.cy - h.r + 1)}q6 -7 8.5 -2 -2.5 3.5 -8.5 2z" fill="${RIBBON}" stroke="${INK}" stroke-width="1"/>`;
      default: return "";
    }
  }

  /* ===============================================================
     [5-2] 종류별 그리기
     =============================================================== */
  const DRAW = {

    cat(g) {
      const { p, t, lv, body: b, head: h } = g;
      const earH = lerp(5, 8, t);
      return `
        ${lv >= AT_TAIL ? `<path d="M${n1(b.cx + b.rx * 1.05)} ${n1(b.cy - 2)}q${n1(lerp(8, 12, t))} -1 ${n1(lerp(6, 9, t))} ${n1(lerp(9, 12, t))}" stroke="${p.body}" stroke-width="${n1(lerp(3, 4, t))}" fill="none" stroke-linecap="round"/>` : ""}
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.body}"/>
        <path d="M${n1(h.cx - h.r * 0.85)} ${n1(h.cy - h.r * 0.75)}l${n1(h.r * 0.06)} -${n1(earH)} ${n1(h.r * 0.68)} ${n1(earH * 0.58)}z" fill="${p.body}"/>
        <path d="M${n1(h.cx + h.r * 0.85)} ${n1(h.cy - h.r * 0.75)}l-${n1(h.r * 0.06)} -${n1(earH)} -${n1(h.r * 0.68)} ${n1(earH * 0.58)}z" fill="${p.body}"/>
        ${lv >= AT_WING ? `<path d="M${n1(h.cx - h.r - 5)} ${n1(h.cy + 2)}h6M${n1(h.cx + h.r - 1)} ${n1(h.cy + 2)}h6" stroke="${p.body}" stroke-width="1.1" stroke-linecap="round"/>` : ""}
        ${face(h.cx, h.cy, h.r, p, lv >= AT_TAIL)}`;
    },

    dog(g) {
      const { p, t, lv, body: b, head: h } = g;
      const w = lerp(5.4, 7.2, t), len = lerp(8, 11.2, t);
      const ear = sx => `<path d="M${n1(h.cx + sx * (h.r + 1.4))} ${n1(h.cy - h.r * 0.62)}h${n1(-sx * w)}l${n1(sx * w / 2)} ${n1(len)}z" fill="${p.line}" stroke="${p.line}" stroke-width="4" stroke-linejoin="round"/>`;
      return `
        ${lv >= AT_TAIL ? `<path d="M${n1(b.cx + b.rx)} ${n1(b.cy - 4)}q7 -6 9 2" stroke="${p.body}" stroke-width="4" fill="none" stroke-linecap="round"/>` : ""}
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.body}"/>
        ${ear(-1)}${ear(1)}
        ${face(h.cx, h.cy, h.r, p, false)}
        <ellipse cx="${h.cx}" cy="${n1(h.cy + h.r * 0.48)}" rx="${n1(h.r * 0.44)}" ry="${n1(h.r * 0.33)}" fill="${p.pale}"/>
        <ellipse cx="${h.cx}" cy="${n1(h.cy + h.r * 0.38)}" rx="${n1(h.r * 0.2)}" ry="${n1(h.r * 0.15)}" fill="${p.dark}"/>`;
    },

    rabbit(g) {
      const { p, t, lv, body: b, head: h } = g;
      const earH = lerp(7.5, 11.5, t);
      const ear = sx => `
        <ellipse cx="${n1(h.cx + sx * h.r * 0.6)}" cy="${n1(h.cy - h.r - earH * 0.45)}" rx="${n1(lerp(2.8, 3.6, t))}" ry="${n1(earH)}" fill="${p.body}"/>
        <ellipse cx="${n1(h.cx + sx * h.r * 0.6)}" cy="${n1(h.cy - h.r - earH * 0.4)}" rx="${n1(lerp(1.1, 1.6, t))}" ry="${n1(earH * 0.68)}" fill="${p.light}"/>`;
      return `
        ${lv >= AT_TAIL ? `<circle cx="${n1(b.cx + b.rx * 1.05)}" cy="${n1(b.cy + 3)}" r="${n1(lerp(3.4, 5, t))}" fill="${p.pale}"/>` : ""}
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        ${ear(-1)}${ear(1)}
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.body}"/>
        ${face(h.cx, h.cy, h.r, p, true)}`;
    },

    chick(g) {
      const { p, t, lv, body: b, head: h } = g;
      return `
        <path d="M${n1(b.cx - 3)} ${n1(b.cy + b.ry)}v3.5M${n1(b.cx + 3)} ${n1(b.cy + b.ry)}v3.5" stroke="${p.line}" stroke-width="2" stroke-linecap="round"/>
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        ${lv >= AT_TAIL ? `<ellipse cx="${n1(b.cx - b.rx * 0.92)}" cy="${n1(b.cy - 1)}" rx="${n1(lerp(3.4, 4.6, t))}" ry="${n1(lerp(5.4, 7, t))}" fill="${p.light}"/>
                     <ellipse cx="${n1(b.cx + b.rx * 0.92)}" cy="${n1(b.cy - 1)}" rx="${n1(lerp(3.4, 4.6, t))}" ry="${n1(lerp(5.4, 7, t))}" fill="${p.light}"/>` : ""}
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.body}"/>
        ${lv >= AT_WING ? `<path d="M${n1(h.cx - 4)} ${n1(h.cy - h.r - 0.5)}q4 -6 8 0z" fill="${p.light}"/>` : ""}
        ${face(h.cx, h.cy, h.r, p, false)}
        <path d="M${h.cx} ${n1(h.cy + h.r * 0.3)}l-2.4 3h4.8z" fill="#D85A30"/>`;
    },

    penguin(g) {
      const { p, lv, body: b, head: h } = g;
      return `
        ${lv >= AT_WING ? `<path d="M${n1(b.cx - 8)} ${n1(b.cy + b.ry)}l-5 4h10zM${n1(b.cx + 8)} ${n1(b.cy + b.ry)}l5 4h-10z" fill="#EF9F27"/>` : ""}
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        <ellipse cx="${b.cx}" cy="${n1(b.cy + 2)}" rx="${n1(b.rx * 0.6)}" ry="${n1(b.ry * 0.78)}" fill="${p.pale}"/>
        ${lv >= AT_TAIL ? `<path d="M${n1(b.cx - b.rx)} ${n1(b.cy - 5)}q-6 4 -2 12" stroke="${p.body}" stroke-width="4" fill="none" stroke-linecap="round"/>
                     <path d="M${n1(b.cx + b.rx)} ${n1(b.cy - 5)}q6 4 2 12" stroke="${p.body}" stroke-width="4" fill="none" stroke-linecap="round"/>` : ""}
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.body}"/>
        ${face(h.cx, h.cy, h.r, p, false)}
        <path d="M${h.cx} ${n1(h.cy + h.r * 0.3)}l-2.8 3.2h5.6z" fill="#EF9F27"/>`;
    },

    bear(g) {
      const { p, t, body: b, head: h } = g;
      const er = lerp(4.2, 5.6, t);
      const ear = sx => `
        <circle cx="${n1(h.cx + sx * h.r * 0.92)}" cy="${n1(h.cy - h.r * 0.78)}" r="${n1(er)}" fill="${p.body}"/>
        <circle cx="${n1(h.cx + sx * h.r * 0.92)}" cy="${n1(h.cy - h.r * 0.78)}" r="${n1(er * 0.48)}" fill="${p.light}"/>`;
      return `
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        ${ear(-1)}${ear(1)}
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.body}"/>
        ${face(h.cx, h.cy, h.r, p, false)}
        <ellipse cx="${h.cx}" cy="${n1(h.cy + h.r * 0.5)}" rx="${n1(h.r * 0.5)}" ry="${n1(h.r * 0.36)}" fill="${p.pale}"/>
        <ellipse cx="${h.cx}" cy="${n1(h.cy + h.r * 0.4)}" rx="${n1(h.r * 0.2)}" ry="${n1(h.r * 0.15)}" fill="${p.dark}"/>`;
    },

    dragon(g) {
      const { p, t, lv, body: b, head: h } = g;
      const stem = lerp(6, 9.5, t);
      const antler = sx => {
        const x0 = h.cx + sx * h.r * 0.38, y0 = h.cy - h.r * 0.86;
        let d = `<path d="M${n1(x0)} ${n1(y0)}C${n1(x0 + sx * 0.6)} ${n1(y0 - stem * 0.42)} ${n1(x0 + sx * 1.6)} ${n1(y0 - stem * 0.7)} ${n1(x0 + sx * 3.2)} ${n1(y0 - stem)}"/>`;
        if (lv >= AT_MARK) d += `<path d="M${n1(x0 + sx * 1.0)} ${n1(y0 - stem * 0.48)}L${n1(x0 - sx * 1.4)} ${n1(y0 - stem * 0.72)}"/>`;
        if (lv >= AT_WING) d += `<path d="M${n1(x0 + sx * 2.1)} ${n1(y0 - stem * 0.78)}L${n1(x0 + sx * 4.6)} ${n1(y0 - stem * 0.62)}"/>`;
        return d;
      };
      return `
        ${lv >= AT_WING ? `<path d="M${n1(b.cx + b.rx * 0.95)} ${n1(b.cy - b.ry)}q10 -17 15 -5 -3 11 -15 5z" fill="${p.light}"/>` : ""}
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        ${lv >= AT_TAIL ? `<path d="M${n1(b.cx - 7)} ${n1(b.cy - b.ry * 0.85)}l3 -3 3 3 3 -3 3 3" stroke="${p.line}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` : ""}
        <g stroke="${HORN_GOLD}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">${antler(-1)}${antler(1)}</g>
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.body}"/>
        ${face(h.cx, h.cy, h.r, p, true)}`;
    },

    squirrel(g) {
      const { p, t, lv, body: b, head: h } = g;
      return `
        ${lv >= AT_TAIL ? `<path d="M${n1(b.cx + b.rx * 0.85)} ${n1(b.cy + 2)}q${n1(lerp(12, 16, t))} 2 ${n1(lerp(7, 10, t))} -${n1(lerp(11, 15, t))} -${n1(lerp(4, 6, t))} -3 -${n1(lerp(6, 9, t))} ${n1(lerp(5, 7, t))}" fill="${p.pale}"/>` : ""}
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.body}"/>
        ${lv >= AT_WING ? `<path d="M${n1(h.cx - h.r * 0.9)} ${n1(h.cy - h.r * 0.7)}q-3 -8 5 -5z" fill="${p.line}"/>
                     <path d="M${n1(h.cx + h.r * 0.9)} ${n1(h.cy - h.r * 0.7)}q3 -8 -5 -5z" fill="${p.line}"/>` : ""}
        ${face(h.cx, h.cy, h.r, p, false)}
        <path d="M${h.cx} ${n1(h.cy + h.r * 0.32)}l-2 2.4h4z" fill="${p.dark}"/>`;
    },

    /* ---- 새로 추가된 종류들 ---- */

    peacock(g) {
      const { p, t, lv, body: b, head: h } = g;
      const spread = lerp(0.45, 1, t);
      const fan = `
        <path d="M${h.cx} ${n1(h.cy + 12)}C${n1(h.cx - 18 * spread)} ${n1(h.cy + 12)} ${n1(h.cx - 22 * spread)} ${n1(h.cy - 8)} ${n1(h.cx - 16 * spread)} ${n1(h.cy - 12)}
                 c${n1(4 * spread)} ${n1(7 * spread)} ${n1(11 * spread)} ${n1(9 * spread)} ${n1(16 * spread)} ${n1(9 * spread)}
                 s${n1(12 * spread)} -2 ${n1(16 * spread)} -${n1(9 * spread)}
                 c${n1(6 * spread)} ${n1(4 * spread)} ${n1(2 * spread)} ${n1(24 * spread)} -${n1(16 * spread)} ${n1(24 * spread)}z"
              fill="${p.pale}" opacity=".75"/>`;
      const eyes = lv >= AT_TAIL
        ? [-14, -6, 6, 14].map((dx, i) =>
            `<circle cx="${n1(h.cx + dx * spread)}" cy="${n1(h.cy - (i === 0 || i === 3 ? 6 : 11) * spread)}" r="${n1(2.4 * spread)}" fill="${p.line}"/>`).join("")
        : "";
      return `
        ${fan}${eyes}
        <ellipse cx="${b.cx}" cy="${n1(b.cy + 2)}" rx="${n1(b.rx * 0.62)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r * 0.78)}" fill="${p.body}"/>
        ${lv >= AT_WING ? `<path d="M${h.cx} ${n1(h.cy - h.r * 0.85)}v-3M${n1(h.cx - 2.4)} ${n1(h.cy - h.r * 0.7)}l-1 -2.4M${n1(h.cx + 2.4)} ${n1(h.cy - h.r * 0.7)}l1 -2.4" stroke="${HORN_GOLD}" stroke-width="1.4" stroke-linecap="round"/>` : ""}
        ${face(h.cx, h.cy, h.r * 0.78, p, false)}
        <path d="M${h.cx} ${n1(h.cy + h.r * 0.3)}l-2 2.4h4z" fill="${HORN_GOLD}"/>`;
    },

    seal(g) {
      const { p, t, lv, body: b, head: h } = g;
      return `
        ${lv >= AT_TAIL ? `<path d="M${n1(b.cx + b.rx * 0.95)} ${n1(b.cy + 2)}q11 2 9 -6 -5 -3 -8 2" fill="${p.pale}"/>` : ""}
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx * 1.15)}" ry="${n1(b.ry * 0.82)}" fill="${p.body}"/>
        <ellipse cx="${b.cx}" cy="${n1(b.cy + 2)}" rx="${n1(b.rx * 0.66)}" ry="${n1(b.ry * 0.45)}" fill="${p.pale}"/>
        <path d="M${n1(b.cx - b.rx)} ${n1(b.cy - 4)}q-7 3 -3 8" stroke="${p.body}" stroke-width="4" fill="none" stroke-linecap="round"/>
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r * 0.92)}" fill="${p.body}"/>
        ${face(h.cx, h.cy, h.r * 0.92, p, false)}
        <ellipse cx="${h.cx}" cy="${n1(h.cy + h.r * 0.45)}" rx="${n1(h.r * 0.26)}" ry="${n1(h.r * 0.19)}" fill="${p.dark}"/>
        ${lv >= AT_WING ? `<path d="M${n1(h.cx - h.r - 4)} ${n1(h.cy + 2)}h6M${n1(h.cx + h.r - 2)} ${n1(h.cy + 2)}h6" stroke="${p.pale}" stroke-width="1" stroke-linecap="round"/>` : ""}`;
    },

    whale(g) {
      const { p, t, lv, body: b } = g;
      const cx = b.cx - 2, cy = b.cy - 2;
      const rx = b.rx * 1.25, ry = b.ry * 0.9;
      return `
        ${lv >= AT_WING ? `<path d="M${n1(cx - rx * 0.72)} ${n1(cy - ry - 4)}q2 -8 -3 -9 1 5 -2 7z" fill="${p.pale}"/>` : ""}
        ${lv >= AT_TAIL ? `<path d="M${n1(cx + rx * 0.95)} ${n1(cy)}q10 -3 11 6 -6 4 -12 -2" fill="${p.body}"/>` : ""}
        <ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${n1(ry)}" fill="${p.body}"/>
        <path d="M${n1(cx - rx * 0.9)} ${n1(cy + ry * 0.2)}q${n1(rx * 0.8)} ${n1(ry * 0.75)} ${n1(rx * 1.7)} ${n1(ry * 0.1)}
                 q-${n1(rx * 0.7)} ${n1(ry * 0.85)} -${n1(rx * 1.7)} -${n1(ry * 0.1)}z" fill="${p.pale}"/>
        <circle cx="${n1(cx - rx * 0.55)}" cy="${n1(cy - ry * 0.3)}" r="1.8" fill="${p.dark}"/>
        <path d="M${n1(cx - rx * 0.78)} ${n1(cy + ry * 0.1)}q3 2 6 0" stroke="${p.dark}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
    },

    panda(g) {
      const { p, t, body: b, head: h } = g;
      const er = lerp(4.4, 5.6, t);
      return `
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        <ellipse cx="${n1(b.cx - b.rx * 0.8)}" cy="${n1(b.cy + b.ry * 0.45)}" rx="${n1(er * 0.9)}" ry="${n1(er)}" fill="${p.mark}"/>
        <ellipse cx="${n1(b.cx + b.rx * 0.8)}" cy="${n1(b.cy + b.ry * 0.45)}" rx="${n1(er * 0.9)}" ry="${n1(er)}" fill="${p.mark}"/>
        <circle cx="${n1(h.cx - h.r * 0.95)}" cy="${n1(h.cy - h.r * 0.8)}" r="${n1(er)}" fill="${p.mark}"/>
        <circle cx="${n1(h.cx + h.r * 0.95)}" cy="${n1(h.cy - h.r * 0.8)}" r="${n1(er)}" fill="${p.mark}"/>
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.body}"/>
        <ellipse cx="${n1(h.cx - h.r * 0.42)}" cy="${n1(h.cy - h.r * 0.05)}" rx="${n1(h.r * 0.3)}" ry="${n1(h.r * 0.36)}" fill="${p.mark}"/>
        <ellipse cx="${n1(h.cx + h.r * 0.42)}" cy="${n1(h.cy - h.r * 0.05)}" rx="${n1(h.r * 0.3)}" ry="${n1(h.r * 0.36)}" fill="${p.mark}"/>
        <circle cx="${n1(h.cx - h.r * 0.38)}" cy="${n1(h.cy - h.r * 0.02)}" r="1.3" fill="#FFFFFF"/>
        <circle cx="${n1(h.cx + h.r * 0.38)}" cy="${n1(h.cy - h.r * 0.02)}" r="1.3" fill="#FFFFFF"/>
        <ellipse cx="${h.cx}" cy="${n1(h.cy + h.r * 0.52)}" rx="${n1(h.r * 0.22)}" ry="${n1(h.r * 0.16)}" fill="${p.markDark}"/>`;
    },

    /* 문어 — 다리가 레벨에 따라 늘어납니다 (Lv.1 둘 → Lv.10 여섯).
       머리는 둥근 종 모양이고, 몸통 자리를 다리가 대신합니다. */
    octopus(g) {
      const { p, t, lv, body: b, head: h } = g;
      const legs = Math.max(2, Math.min(6, 2 + Math.floor(t * 4.2)));
      const baseY = b.cy + b.ry * 0.35;
      let arms = "";
      for (let i = 0; i < legs; i++) {
        const span = b.rx * 1.25;
        const x = b.cx - span + (span * 2 * i) / Math.max(1, legs - 1);
        const dir = x < b.cx ? -1 : 1;
        const len = lerp(7, 11, t);
        arms += `<path d="M${n1(x)} ${n1(baseY - 2)}q${n1(dir * 2)} ${n1(len * 0.6)} ${n1(dir * 3.4)} ${n1(len)}"
                       stroke="${p.body}" stroke-width="${n1(lerp(3, 4, t))}" fill="none" stroke-linecap="round"/>`;
      }
      return `
        ${arms}
        <path d="M${n1(b.cx - b.rx)} ${n1(baseY)}q0 -${n1(b.ry * 1.9)} ${n1(b.rx)} -${n1(b.ry * 1.9)}
                 q${n1(b.rx)} 0 ${n1(b.rx)} ${n1(b.ry * 1.9)}z" fill="${p.body}"/>
        <ellipse cx="${b.cx}" cy="${n1(baseY - b.ry * 1.15)}" rx="${n1(b.rx * 0.52)}" ry="${n1(b.ry * 0.42)}" fill="${p.light}" opacity=".55"/>
        ${lv >= AT_WING ? `<circle cx="${n1(b.cx - b.rx * 0.45)}" cy="${n1(baseY - b.ry * 0.35)}" r="1.6" fill="${p.pale}"/>
                     <circle cx="${n1(b.cx + b.rx * 0.45)}" cy="${n1(baseY - b.ry * 0.35)}" r="1.6" fill="${p.pale}"/>` : ""}
        ${face(b.cx, baseY - b.ry * 1.0, h.r * 0.78, p, lv >= AT_TAIL)}`;
    },

    flower(g) {
      const { p, t, lv } = g;
      const cy = lerp(26, 21, t), pr = lerp(4, 5.2, t);
      const petal = (dx, dy, rx, ry) =>
        `<ellipse cx="${n1(28 + dx)}" cy="${n1(cy + dy)}" rx="${n1(rx)}" ry="${n1(ry)}" fill="${p.body}"/>`;
      return `
        <path d="M28 48V${n1(cy + 8)}" stroke="#639922" stroke-width="2.4" stroke-linecap="round"/>
        ${lv >= AT_TAIL ? `<path d="M28 ${n1(cy + 18)}q-8 -1 -9 -7 7 -1 9 4z" fill="#97C459"/>` : ""}
        ${lv >= AT_WING ? `<path d="M28 ${n1(cy + 23)}q8 -1 9 -7 -7 -1 -9 4z" fill="#B4D686"/>` : ""}
        ${petal(0, -7, pr, pr * 1.4)}${petal(0, 7, pr, pr * 1.4)}
        ${petal(-7, 0, pr * 1.4, pr)}${petal(7, 0, pr * 1.4, pr)}
        <circle cx="28" cy="${n1(cy)}" r="${n1(pr * 1.08)}" fill="${p.pale}"/>
        ${face(28, cy, pr * 1.08, p, true)}`;
    },

    tree(g) {
      const { p, t, lv } = g;
      const r = lerp(9, 13, t), cy = lerp(24, 20, t);
      return `
        <path d="M28 50V${n1(cy + r * 0.6)}" stroke="#8D6434" stroke-width="${n1(lerp(3, 4.2, t))}" stroke-linecap="round"/>
        ${lv >= AT_TAIL ? `<path d="M28 ${n1(cy + r * 0.9)}l-6 -5" stroke="#8D6434" stroke-width="2.2" stroke-linecap="round"/>` : ""}
        ${lv >= AT_WING ? `<path d="M28 ${n1(cy + r * 0.55)}l6 -5" stroke="#8D6434" stroke-width="2.2" stroke-linecap="round"/>` : ""}
        <circle cx="28" cy="${n1(cy)}" r="${n1(r)}" fill="${p.body}"/>
        ${lv >= AT_TAIL ? `<circle cx="${n1(28 - r * 0.78)}" cy="${n1(cy + r * 0.5)}" r="${n1(r * 0.58)}" fill="${p.light}"/>
                     <circle cx="${n1(28 + r * 0.78)}" cy="${n1(cy + r * 0.5)}" r="${n1(r * 0.58)}" fill="${p.light}"/>` : ""}
        ${face(28, cy, r * 0.82, p, true)}`;
    },

    grass(g) {
      const { p, t, lv } = g;
      const top = lerp(28, 22, t);
      const blade = (sx, h2, fill) =>
        `<path d="M28 46q${n1(sx * 2)} -${n1(h2 * 0.6)} ${n1(sx * 9)} -${n1(h2)} -${n1(sx * 8)} 1 -${n1(sx * 9)} ${n1(h2 - 1)}z" fill="${fill}"/>`;
      return `
        ${lv >= AT_TAIL ? blade(-1, lerp(14, 20, t), p.light) : ""}
        ${lv >= AT_WING ? blade(1, lerp(14, 20, t), p.pale) : ""}
        <path d="M28 47V${n1(top + 4)}" stroke="${p.line}" stroke-width="3.2" stroke-linecap="round"/>
        <path d="M28 ${n1(top + 6)}q-7 -8 -3 -14 5 4 3 14z" fill="${p.body}"/>
        <path d="M28 ${n1(top + 6)}q7 -8 3 -14 -5 4 -3 14z" fill="${p.light}"/>
        ${face(28, top + 12, 5.4, p, true)}`;
    },

    cloud(g) {
      const { p, t, lv } = g;
      const w = lerp(11, 14, t);
      return `
        <path d="M${n1(28 - w)} 34a7.5 7.5 0 0 1 1 -13 9.5 9.5 0 0 1 18 -2 7.5 7.5 0 0 1 6 15z" fill="${p.light}"/>
        ${face(28, 26, 6.6, p, true)}
        <circle cx="${n1(28 - 5.5)}" cy="30.5" r="2.3" fill="#F4C0D1" opacity=".65"/>
        <circle cx="${n1(28 + 5.5)}" cy="30.5" r="2.3" fill="#F4C0D1" opacity=".65"/>
        ${lv >= AT_TAIL ? `<path d="M22 39v5M34 39v5" stroke="${p.body}" stroke-width="2" stroke-linecap="round"/>` : ""}
        ${lv >= AT_WING ? `<path d="M28 40v6" stroke="${p.body}" stroke-width="2" stroke-linecap="round"/>` : ""}`;
    },

    stone(g) {
      const { p, t, lv } = g;
      const s = lerp(0.82, 1, t);
      return `
        <path d="M${n1(28 - 15 * s)} ${n1(42)}q-2 -${n1(12 * s)} ${n1(8 * s)} -${n1(17 * s)}
                 ${n1(12 * s)} -${n1(6 * s)} ${n1(18 * s)} ${n1(4 * s)}
                 ${n1(5 * s)} ${n1(8 * s)} -${n1(3 * s)} ${n1(13 * s)}z" fill="${p.body}"/>
        <path d="M${n1(28 - 13 * s)} ${n1(40)}q${n1(6 * s)} -${n1(14 * s)} ${n1(22 * s)} -${n1(12 * s)}" stroke="${p.light}" stroke-width="2" fill="none" opacity=".6"/>
        ${lv >= AT_TAIL ? `<path d="M${n1(28 - 8)} ${n1(25)}q-4 -6 2 -7 3 3 1 7z" fill="#97C459"/>` : ""}
        ${lv >= AT_WING ? `<path d="M${n1(28 + 6)} ${n1(22)}q5 -5 7 1 -3 3 -7 -1z" fill="#B4D686"/>` : ""}
        ${face(28, 34, 6.4, p, true)}`;
    },

    sun(g) {
      const { p, t, lv } = g;
      const r = lerp(9.5, 13, t);
      const count = lv >= AT_WING ? 8 : (lv >= AT_TAIL ? 6 : 4);
      let rays = "";
      for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 * i) / count - Math.PI / 2;
        const x1 = 28 + Math.cos(a) * (r + 3), y1 = 28 + Math.sin(a) * (r + 3);
        const x2 = 28 + Math.cos(a) * (r + 8), y2 = 28 + Math.sin(a) * (r + 8);
        rays += `<path d="M${n1(x1)} ${n1(y1)}L${n1(x2)} ${n1(y2)}"/>`;
      }
      return `
        <g stroke="${p.body}" stroke-width="2.6" stroke-linecap="round">${rays}</g>
        <circle cx="28" cy="28" r="${n1(r)}" fill="${p.light}"/>
        <circle cx="28" cy="28" r="${n1(r * 0.72)}" fill="${p.body}" opacity=".3"/>
        ${face(28, 28, r * 0.8, p, true)}
        <circle cx="${n1(28 - r * 0.62)}" cy="${n1(28 + r * 0.3)}" r="2.3" fill="#E88A6A" opacity=".45"/>
        <circle cx="${n1(28 + r * 0.62)}" cy="${n1(28 + r * 0.3)}" r="2.3" fill="#E88A6A" opacity=".45"/>`;
    },

    star(g) {
      const { p, t, lv } = g;
      const R = lerp(14, 19, t), r2 = R * 0.45;
      let d = "";
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * i) / 5 - Math.PI / 2;
        const rr = i % 2 === 0 ? R : r2;
        d += (i ? "L" : "M") + n1(28 + Math.cos(a) * rr) + " " + n1(26 + Math.sin(a) * rr);
      }
      d += "Z";
      const minis = lv >= AT_WING
        ? `<circle cx="48" cy="14" r="1.6" fill="${p.light}"/><circle cx="10" cy="42" r="1.3" fill="${p.light}"/><circle cx="46" cy="40" r="1.1" fill="${p.light}"/>`
        : (lv >= AT_TAIL ? `<circle cx="48" cy="14" r="1.5" fill="${p.light}"/>` : "");
      return `
        ${minis}
        <path d="${d}" fill="${p.light}"/>
        <circle cx="28" cy="26" r="${n1(R * 0.42)}" fill="${p.body}" opacity=".25"/>
        ${face(28, 26, R * 0.42, p, true)}`;
    }
  };

  /* ===============================================================
     [5-3] 한 마리 그리기
     =============================================================== */
  /**
   * @param maxed 정말로 40시간을 다 채웠는가 (Lv.10 도달과 4시간 차이가 납니다)
   */
  function petSvg(species, level, size, maxed) {
    const sp = SPECIES_IDS.includes(species) ? species : SPECIES_IDS[0];
    const lv = Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1));
    const t = (lv - 1) / (MAX_LEVEL - 1);
    const p = palette(sp);
    const px = Number(size) || 56;
    const group = speciesGroup(sp);
    const showSpark = (maxed === undefined) ? (lv >= MAX_LEVEL) : !!maxed;

    let inner;
    if (lv === 1) {
      /* 아직 껍데기 — 무엇이 나올지 모릅니다.

         껍데기 색은 껍데기 종류로만 정합니다. 몸 색을 쓰면 색만 보고
         무엇이 들었는지 알 수 있어서, 껍데기의 뜻이 사라집니다. */
      inner = (SHELL_DRAW[group] || SHELL_DRAW.egg)(shellPalette(group));
    } else {
      /* 아기일 때는 머리가 크고 몸이 작습니다. 자라면서 반대가 됩니다.
         이 비율 하나가 "자랐다"는 느낌의 대부분을 만듭니다. */
      const headR  = lerp(9.6, 8.4, t);
      const bodyRx = lerp(8.6, 14, t);
      const bodyRy = lerp(8.2, 12, t);
      const bodyCy = lerp(34, 37, t);
      const headCy = bodyCy - lerp(11.5, 16, t);

      const g = {
        p, t, lv,
        body: { cx: 28, cy: bodyCy, rx: bodyRx, ry: bodyRy },
        head: { cx: 28, cy: headCy, r: headR }
      };
      inner = (DRAW[sp] || DRAW.cat)(g);
      // Lv.2 는 껍데기를 걸치고 나옵니다
      if (lv === 2) inner += shellRemnant(group, p, g.head);
    }

    const label = lv === 1
      ? `${shellLabel(sp)} · 아직 안 태어났어요`
      : `${speciesLabel(sp)} 레벨 ${lv}${showSpark ? " 만렙" : ""}`;

    return `<svg class="pet-svg" viewBox="0 0 60 56" width="${px}" height="${Math.round(px * 56 / 60)}"
      role="img" aria-label="${label}">${inner}${sparkles(showSpark)}</svg>`;
  }

  /* ---------------------------------------------------------------
     [6] 시간 표기
     --------------------------------------------------------------- */
  function fmtHM(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(m / 60), mm = m % 60;
    if (h <= 0) return `${mm}분`;
    return mm ? `${h}시간 ${mm}분` : `${h}시간`;
  }

  const api = {
    HOURS_PER_LEVEL, MAX_LEVEL, PET_MS, MS_PER_HOUR, AT_TAIL, AT_MARK, AT_WING,
    SPECIES, SPECIES_IDS, SHELLS, SHELL_COLOR, INK, HORN_GOLD, RIBBON,
    speciesLabel, speciesGroup, shellLabel, colorHex, palette, shellPalette, shade,
    levelFromMs, petProgress, pickNextPet, pickInGroup, dexKey, petSvg, fmtHM
  };

  if (typeof window !== "undefined") window.Pet = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
