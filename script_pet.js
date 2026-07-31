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

     42종 × 20레벨 = 840장을 손으로 그릴 수는 없습니다.

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
    { id: "frog",     label: "개구리",  group: "egg",   hex: "#5FB84A" },
    { id: "owl",      label: "부엉이",  group: "egg",   hex: "#8A6A4A" },
    { id: "parrot",   label: "앵무새",  group: "egg",   hex: "#E0453C" },
    { id: "turtle",   label: "거북이",  group: "egg",   hex: "#4E9A6B" },
    { id: "butterfly",label: "나비",    group: "egg",   hex: "#C46BD4" },
    { id: "bee",      label: "벌",      group: "egg",   hex: "#F2B417" },

    { id: "cat",      label: "고양이",  group: "cloth", hex: "#9C988E" },
    { id: "dog",      label: "강아지",  group: "cloth", hex: "#C08A3E" },
    { id: "rabbit",   label: "토끼",    group: "cloth", hex: "#F4A9C0" },
    { id: "squirrel", label: "다람쥐",  group: "cloth", hex: "#D9744A" },
    { id: "hedgehog", label: "고슴도치", group: "cloth", hex: "#8A6F5C" },
    { id: "hamster",  label: "햄스터",  group: "cloth", hex: "#E8C48A" },

    { id: "bear",     label: "곰",      group: "crate", hex: "#7E5233" },
    { id: "seal",     label: "물개",    group: "crate", hex: "#8095A8" },
    { id: "whale",    label: "고래",    group: "crate", hex: "#52A8E0" },
    { id: "panda",    label: "판다",    group: "crate", hex: "#3A3A38" },
    { id: "octopus",  label: "문어",    group: "crate", hex: "#B54A8C" },
    { id: "fox",      label: "여우",    group: "crate", hex: "#E07A33" },
    { id: "unicorn",  label: "유니콘",  group: "crate", hex: "#EFE6F2" },
    { id: "deer",     label: "사슴",    group: "crate", hex: "#B98552" },
    { id: "sheep",    label: "양",      group: "crate", hex: "#F0EDE6" },
    { id: "monkey",   label: "원숭이",  group: "crate", hex: "#B07A46" },
    { id: "coral",    label: "산호",    group: "crate", hex: "#F2736A" },

    { id: "rose",      label: "장미",    group: "seed",  hex: "#D8384C" },
    { id: "tulip",     label: "튤립",    group: "seed",  hex: "#E8574C" },
    { id: "lily",      label: "백합",    group: "seed",  hex: "#E8E3D6" },
    { id: "chrysanth", label: "국화",    group: "seed",  hex: "#F2C13D" },
    { id: "hydrangea", label: "수국",    group: "seed",  hex: "#7E9BE0" },
    { id: "sunflower", label: "해바라기", group: "seed", hex: "#F5A81C" },
    { id: "berry",     label: "열매",    group: "seed",  hex: "#C4304E" },
    { id: "tree",      label: "나무",    group: "seed",  hex: "#45822A" },
    { id: "grass",     label: "풀",      group: "seed",  hex: "#9DC94F" },

    { id: "cloud",    label: "구름",    group: "gift",  hex: "#B7CFE4" },
    { id: "stone",    label: "돌멩이",  group: "gift",  hex: "#6B6760" },
    { id: "sun",      label: "해",      group: "gift",  hex: "#F7A62B" },
    { id: "star",     label: "별",      group: "gift",  hex: "#A78BE0" },
    { id: "rainbow",  label: "무지개",  group: "gift",  hex: "#E86A6A" },
    { id: "moon",     label: "달",      group: "gift",  hex: "#F2D98C" }
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

  /* 이름이 바뀐 종류들.

     예전에 "꽃" 하나였던 것을 장미·튤립·백합·국화·수국·해바라기로
     나눴습니다. 이미 "flower" 를 키우고 계시거나 도감에 넣어두신 분이
     있어서, 옛 이름이 들어오면 장미로 읽습니다. 이 표가 없으면 그런
     분들의 펫이 엉뚱하게 용으로 보입니다. */
  const ALIAS = { flower: "rose" };

  function spec(id) {
    const key = ALIAS[id] || id;
    return SPECIES.find(s => s.id === key) || SPECIES[0];
  }
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
    /* 판다만 예외 — 몸이 **검고** 배와 얼굴이 흽니다.

       [바뀐 이야기]
       처음엔 몸을 흰빛으로 두고 검은 무늬를 얹었는데, 흰 덩어리가
       너무 커서 곰인지 판다인지 애매했습니다. 실제 판다는 몸통과
       팔다리가 검고 배·얼굴이 흰 쪽이라, 그대로 뒤집었습니다.
       판다의 매력이 대비라서 여기서만 규칙이 다릅니다. */
    if (species === "panda") {
      p.body = base;                    // 몸 — 검정
      p.mark = "#F4F2EC";               // 무늬 — 흰빛 (배·얼굴)
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
/* ── 씨앗에서 나오는 무리 (꽃) ────────────────────────────────
     [성장 단계]
     화분은 두지 않습니다. 땅에서 바로 자라는 모습이 더 시원해요.

       Lv.2~4    싹     — 짧은 줄기에 떡잎 두 장
       Lv.5~9    잎     — 줄기가 자라고 잎이 붙습니다
       Lv.10~14  꽃봉오리 — 아직 다물고 있어요
       Lv.15~    꽃     — 활짝 핍니다

     여섯 꽃이 이 뼈대를 그대로 씁니다. 다른 것은 **핀 모습**뿐이라,
     줄기·잎·봉오리를 한 곳에 모아두고 꽃만 갈아 끼웁니다.
     그래야 여섯 꽃이 한 식구로 보이고, 고칠 때도 한 번만 고칩니다. */

  /* 단계 나누기 — 숫자를 여기 한 곳에만 둡니다 */
  function plantStage(lv) {
    if (lv < AT_TAIL)  return "sprout";   // Lv.2~4
    if (lv < AT_MARK)  return "leaf";     // Lv.5~9
    if (lv < AT_WING)  return "bud";      // Lv.10~14
    return "bloom";                       // Lv.15~
  }

  const STEM = "#5E9130";
  const LEAF = "#7FB53F";

  /* 줄기와 잎 — 단계에 따라 키가 자랍니다 */
  function plantBase(lv, t, topY) {
    const st = plantStage(lv);
    const leafR = lerp(4.6, 6.4, t);
    const leaf = (sx, y, scale) => `
      <path d="M28 ${n1(y)}q${n1(sx * leafR * scale * 1.5)} -${n1(leafR * scale * 0.9)} ${n1(sx * leafR * scale * 2)} ${n1(leafR * scale * 0.1)}
               q-${n1(sx * leafR * scale * 0.9)} ${n1(leafR * scale * 1.1)} -${n1(sx * leafR * scale * 2)} -${n1(leafR * scale * 0.1)}z"
            fill="${LEAF}"/>`;
    if (st === "sprout") {
      /* 싹 — 떡잎 두 장. 줄기는 아주 짧게 */
      return `
        <path d="M28 50V${n1(topY + 2)}" stroke="${STEM}" stroke-width="2.2" stroke-linecap="round"/>
        ${leaf(-1, topY + 4, 0.72)}${leaf(1, topY + 4, 0.72)}`;
    }
    return `
      <path d="M28 50V${n1(topY)}" stroke="${STEM}" stroke-width="${n1(lerp(2.4, 3.2, t))}" stroke-linecap="round"/>
      ${leaf(-1, 40, 1)}
      ${st !== "leaf" ? leaf(1, 34, 0.92) : ""}`;
  }

  /* 아직 다문 봉오리 — 꽃마다 색만 다릅니다 */
  function plantBud(p, cy, r) {
    return `
      <ellipse cx="28" cy="${n1(cy)}" rx="${n1(r * 0.62)}" ry="${n1(r * 0.95)}" fill="${p.body}"/>
      <path d="M${n1(28 - r * 0.62)} ${n1(cy + r * 0.5)}q${n1(r * 0.62)} ${n1(r * 0.5)} ${n1(r * 1.24)} 0" fill="${LEAF}"/>`;
  }

  /* 꽃 한 종류를 만드는 틀.
     bloom(p, cy, r, t) 만 넘기면 나머지는 다 같습니다. */
  function makeFlower(bloom) {
    return function (g) {
      const { p, t, lv } = g;
      const st = plantStage(lv);
      const cy = st === "sprout" ? 34 : lerp(26, 21, t);
      const r  = lerp(5.4, 7.4, t);
      const topY = st === "sprout" ? 38 : cy + r * 0.8;
      return `
        ${plantBase(lv, t, topY)}
        ${st === "sprout" ? "" : st === "leaf" ? "" : st === "bud"
          ? plantBud(p, cy, r)
          : bloom(p, cy, r, t)}`;
    };
  }

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

/* ── 보자기에서 나오는 무리 (2차) ───────────────────────────── */

    hedgehog(g) {
      /* 고슴도치 — 등의 가시가 전부입니다.
         얼굴은 밝게 빼서 가시와 대비를 줍니다. 가시는 레벨이 오르면
         촘촘해져요 — 개수를 늘리는 것만으로 "자랐다"가 보입니다. */
      const { p, t, lv, body: b, head: h } = g;
      const spikes = Math.round(lerp(7, 13, t));
      const spikeL = lerp(4.6, 6.4, t);
      const faceC = p.pale;
      let quills = "";
      for (let i = 0; i < spikes; i++) {
        /* 등 위쪽 반원에 고르게 뿌립니다 (왼쪽 위 → 오른쪽 위) */
        const a = Math.PI * (0.08 + 0.84 * (i / (spikes - 1)));
        const x = b.cx - Math.cos(a) * b.rx * 0.98;
        const y = b.cy - Math.sin(a) * b.ry * 0.98;
        const tx = b.cx - Math.cos(a) * (b.rx + spikeL);
        const ty = b.cy - Math.sin(a) * (b.ry + spikeL);
        quills += `<path d="M${n1(x)} ${n1(y)}L${n1(tx)} ${n1(ty)}"
                     stroke="${p.dark}" stroke-width="${n1(lerp(1.6, 2.1, t))}" stroke-linecap="round"/>`;
      }
      return `
        ${quills}
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        ${lv >= AT_MARK ? `<path d="M${n1(b.cx - b.rx * 0.5)} ${n1(b.cy - b.ry * 0.35)}l${n1(b.rx * 0.3)} -${n1(b.ry * 0.3)}
                                 M${n1(b.cx + b.rx * 0.1)} ${n1(b.cy - b.ry * 0.5)}l${n1(b.rx * 0.28)} -${n1(b.ry * 0.28)}"
                               stroke="${p.dark}" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>` : ""}
        <!-- 얼굴 — 앞쪽 아래로 쑥 나옵니다 -->
        <circle cx="${n1(h.cx - h.r * 0.1)}" cy="${n1(h.cy + h.r * 0.55)}" r="${n1(h.r * 0.82)}" fill="${faceC}"/>
        <!-- 코 — 뾰족하게 -->
        <path d="M${n1(h.cx - h.r * 0.82)} ${n1(h.cy + h.r * 0.55)}
                 q-${n1(h.r * 0.5)} ${n1(h.r * 0.14)} -${n1(h.r * 0.62)} ${n1(h.r * 0.4)}
                 q${n1(h.r * 0.42)} ${n1(h.r * 0.1)} ${n1(h.r * 0.66)} -${n1(h.r * 0.16)}z" fill="${faceC}"/>
        <circle cx="${n1(h.cx - h.r * 1.4)}" cy="${n1(h.cy + h.r * 0.9)}" r="${n1(Math.max(1, h.r * 0.13))}" fill="${p.dark}"/>
        <circle cx="${n1(h.cx - h.r * 0.28)}" cy="${n1(h.cy + h.r * 0.42)}" r="${n1(Math.max(1.1, h.r * 0.15))}" fill="${p.dark}"/>
        <circle cx="${n1(h.cx + h.r * 0.36)}" cy="${n1(h.cy + h.r * 0.42)}" r="${n1(Math.max(1.1, h.r * 0.15))}" fill="${p.dark}"/>
        ${lv >= AT_TAIL ? `<circle cx="${n1(h.cx + h.r * 0.62)}" cy="${n1(h.cy + h.r * 0.02)}" r="${n1(h.r * 0.26)}" fill="${faceC}"/>` : ""}`;
    },

    hamster(g) {
      /* 햄스터 — 볼주머니가 빵빵하고 귀는 작고 동그랗습니다.
         꼬리는 아주 짧게. 길면 쥐가 됩니다. */
      const { p, t, lv, body: b, head: h } = g;
      const er = lerp(2.8, 3.6, t);
      return `
        ${lv >= AT_TAIL ? `<circle cx="${n1(b.cx + b.rx * 0.98)}" cy="${n1(b.cy + b.ry * 0.3)}" r="${n1(lerp(2, 2.7, t))}" fill="${p.pale}"/>` : ""}
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        <ellipse cx="${b.cx}" cy="${n1(b.cy + b.ry * 0.3)}" rx="${n1(b.rx * 0.58)}" ry="${n1(b.ry * 0.55)}" fill="${p.pale}"/>
        ${lv >= AT_MARK ? `<path d="M${n1(b.cx - b.rx * 0.66)} ${n1(b.cy - b.ry * 0.35)}q${n1(b.rx * 0.66)} ${n1(b.ry * 0.3)} ${n1(b.rx * 1.32)} 0"
                               stroke="${p.line}" stroke-width="1.4" fill="none" opacity=".55"/>` : ""}
        <!-- 발 -->
        <ellipse cx="${n1(b.cx - b.rx * 0.44)}" cy="${n1(b.cy + b.ry * 0.86)}" rx="${n1(lerp(2.2, 2.9, t))}" ry="${n1(lerp(1.4, 1.8, t))}" fill="${p.pale}"/>
        <ellipse cx="${n1(b.cx + b.rx * 0.44)}" cy="${n1(b.cy + b.ry * 0.86)}" rx="${n1(lerp(2.2, 2.9, t))}" ry="${n1(lerp(1.4, 1.8, t))}" fill="${p.pale}"/>
        <!-- 귀 — 작고 동그랗게 -->
        <circle cx="${n1(h.cx - h.r * 0.78)}" cy="${n1(h.cy - h.r * 0.72)}" r="${n1(er)}" fill="${p.body}"/>
        <circle cx="${n1(h.cx + h.r * 0.78)}" cy="${n1(h.cy - h.r * 0.72)}" r="${n1(er)}" fill="${p.body}"/>
        <circle cx="${n1(h.cx - h.r * 0.78)}" cy="${n1(h.cy - h.r * 0.72)}" r="${n1(er * 0.5)}" fill="${p.line}"/>
        <circle cx="${n1(h.cx + h.r * 0.78)}" cy="${n1(h.cy - h.r * 0.72)}" r="${n1(er * 0.5)}" fill="${p.line}"/>
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.body}"/>
        <!-- 볼주머니 — 양쪽으로 빵빵하게 -->
        <circle cx="${n1(h.cx - h.r * 0.74)}" cy="${n1(h.cy + h.r * 0.42)}" r="${n1(h.r * 0.46)}" fill="${p.pale}"/>
        <circle cx="${n1(h.cx + h.r * 0.74)}" cy="${n1(h.cy + h.r * 0.42)}" r="${n1(h.r * 0.46)}" fill="${p.pale}"/>
        <ellipse cx="${h.cx}" cy="${n1(h.cy + h.r * 0.4)}" rx="${n1(h.r * 0.44)}" ry="${n1(h.r * 0.34)}" fill="${p.pale}"/>
        ${face(h.cx, h.cy, h.r, p, false)}
        <ellipse cx="${h.cx}" cy="${n1(h.cy + h.r * 0.3)}" rx="${n1(h.r * 0.15)}" ry="${n1(h.r * 0.11)}" fill="${p.dark}"/>
        ${lv >= AT_WING ? `<path d="M${n1(h.cx - h.r * 0.3)} ${n1(h.cy + h.r * 0.34)}l-${n1(h.r * 0.8)} -${n1(h.r * 0.12)}
                                 M${n1(h.cx + h.r * 0.3)} ${n1(h.cy + h.r * 0.34)}l${n1(h.r * 0.8)} -${n1(h.r * 0.12)}"
                               stroke="${p.dark}" stroke-width=".8" stroke-linecap="round" opacity=".6"/>` : ""}`;
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

/* ── 알에서 나오는 무리 (2차) ──────────────────────────────────
       기존 넷(용·공작·병아리·펭귄)과 같은 결로 그립니다.
       몸통 타원 + 머리 원을 기본으로 두고, 그 종만의 표시를 얹어요. */

    frog(g) {
      /* 개구리 — 눈이 머리 위로 볼록 솟은 게 전부입니다.
         입을 넓게 그으면 개구리다움이 확 살아나서 얼굴은 따로 그립니다. */
      const { p, t, lv, body: b, head: h } = g;
      const eyeR = lerp(2.6, 3.2, t);
      const eye = sx => `
        <circle cx="${n1(h.cx + sx * h.r * 0.52)}" cy="${n1(h.cy - h.r * 0.72)}" r="${n1(eyeR)}" fill="${p.light}"/>
        <circle cx="${n1(h.cx + sx * h.r * 0.52)}" cy="${n1(h.cy - h.r * 0.72)}" r="${n1(eyeR * 0.45)}" fill="${p.dark}"/>`;
      return `
        ${lv >= AT_TAIL ? `<ellipse cx="${n1(b.cx - b.rx * 0.9)}" cy="${n1(b.cy + b.ry * 0.8)}" rx="${n1(lerp(3.4, 4.6, t))}" ry="${n1(lerp(1.8, 2.4, t))}" fill="${p.dark}"/>
                     <ellipse cx="${n1(b.cx + b.rx * 0.9)}" cy="${n1(b.cy + b.ry * 0.8)}" rx="${n1(lerp(3.4, 4.6, t))}" ry="${n1(lerp(1.8, 2.4, t))}" fill="${p.dark}"/>` : ""}
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        <ellipse cx="${b.cx}" cy="${n1(b.cy + 2)}" rx="${n1(b.rx * 0.58)}" ry="${n1(b.ry * 0.7)}" fill="${p.pale}"/>
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.body}"/>
        ${eye(-1)}${eye(1)}
        <path d="M${n1(h.cx - h.r * 0.55)} ${n1(h.cy + h.r * 0.25)}q${n1(h.r * 0.55)} ${n1(h.r * 0.45)} ${n1(h.r * 1.1)} 0" stroke="${p.dark}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
        ${lv >= AT_MARK ? `<circle cx="${n1(b.cx - 4)}" cy="${n1(b.cy - 2)}" r="1.6" fill="${p.dark}" opacity=".55"/>
                     <circle cx="${n1(b.cx + 5)}" cy="${n1(b.cy + 2)}" r="1.3" fill="${p.dark}" opacity=".55"/>` : ""}`;
    },

    owl(g) {
      /* 부엉이 — 큰 눈테와 머리 위 뿔깃.
         눈테를 두 겹으로 그려야 "부엉이 눈"으로 읽힙니다. */
      const { p, t, lv, body: b, head: h } = g;
      const tuftH = lerp(3.6, 5.4, t);
      const ring = sx => `
        <circle cx="${n1(h.cx + sx * h.r * 0.42)}" cy="${n1(h.cy - h.r * 0.05)}" r="${n1(h.r * 0.42)}" fill="${p.pale}"/>
        <circle cx="${n1(h.cx + sx * h.r * 0.42)}" cy="${n1(h.cy - h.r * 0.05)}" r="${n1(h.r * 0.2)}" fill="${p.dark}"/>`;
      const tuft = sx => `<path d="M${n1(h.cx + sx * h.r * 0.7)} ${n1(h.cy - h.r * 0.72)}l${n1(sx * 1.6)} -${n1(tuftH)} ${n1(sx * 2.4)} ${n1(tuftH * 0.75)}z" fill="${p.line}"/>`;
      return `
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        ${lv >= AT_MARK ? `<path d="M${n1(b.cx - b.rx * 0.5)} ${n1(b.cy - 2)}q${n1(b.rx * 0.5)} 3 ${n1(b.rx)} 0" stroke="${p.pale}" stroke-width="1.3" fill="none"/>
                     <path d="M${n1(b.cx - b.rx * 0.5)} ${n1(b.cy + 3)}q${n1(b.rx * 0.5)} 3 ${n1(b.rx)} 0" stroke="${p.pale}" stroke-width="1.3" fill="none"/>` : ""}
        ${lv >= AT_WING ? `<ellipse cx="${n1(b.cx - b.rx * 0.95)}" cy="${n1(b.cy)}" rx="${n1(lerp(3, 4, t))}" ry="${n1(lerp(6, 8, t))}" fill="${p.line}"/>
                     <ellipse cx="${n1(b.cx + b.rx * 0.95)}" cy="${n1(b.cy)}" rx="${n1(lerp(3, 4, t))}" ry="${n1(lerp(6, 8, t))}" fill="${p.line}"/>` : ""}
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.body}"/>
        ${tuft(-1)}${tuft(1)}
        ${ring(-1)}${ring(1)}
        <path d="M${h.cx} ${n1(h.cy + h.r * 0.3)}l-2 2.6h4z" fill="#E0A02B"/>
        ${lv >= AT_TAIL ? `<path d="M${n1(b.cx - 3)} ${n1(b.cy + b.ry)}v3M${n1(b.cx + 3)} ${n1(b.cy + b.ry)}v3" stroke="#E0A02B" stroke-width="1.8" stroke-linecap="round"/>` : ""}`;
    },

    parrot(g) {
      /* 앵무새 — 굽은 부리와 머리 볏, 그리고 긴 꼬리깃.
         부리를 굽히지 않으면 그냥 새가 되어버립니다. */
      const { p, t, lv, body: b, head: h } = g;
      const tailL = lerp(9, 15, t);
      return `
        ${lv >= AT_TAIL ? `<path d="M${n1(b.cx + b.rx * 0.7)} ${n1(b.cy + b.ry * 0.5)}q${n1(tailL * 0.7)} ${n1(tailL * 0.5)} ${n1(tailL)} ${n1(tailL * 0.95)}"
                       stroke="${p.line}" stroke-width="${n1(lerp(3.2, 4.4, t))}" fill="none" stroke-linecap="round"/>` : ""}
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        ${lv >= AT_WING ? `<path d="M${n1(b.cx - b.rx * 0.2)} ${n1(b.cy - b.ry * 0.5)}q-${n1(b.rx)} ${n1(b.ry * 0.5)} -${n1(b.rx * 0.55)} ${n1(b.ry * 1.1)}q${n1(b.rx * 0.6)} 0 ${n1(b.rx * 0.75)} -${n1(b.ry * 0.6)}z" fill="${p.light}"/>` : ""}
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.body}"/>
        <path d="M${n1(h.cx - 1)} ${n1(h.cy - h.r * 0.9)}q1 -${n1(lerp(4, 6.5, t))} ${n1(lerp(3.5, 5, t))} -${n1(lerp(3.2, 5, t))}q-1 ${n1(lerp(3.5, 5.5, t))} -1.5 ${n1(lerp(3.4, 5, t))}z" fill="${p.light}"/>
        ${face(h.cx, h.cy, h.r, p, false)}
        <path d="M${h.cx} ${n1(h.cy + h.r * 0.18)}q${n1(h.r * 0.42)} 0 ${n1(h.r * 0.4)} ${n1(h.r * 0.34)}q0 ${n1(h.r * 0.3)} -${n1(h.r * 0.4)} ${n1(h.r * 0.16)}z" fill="#E8A33C"/>`;
    },

    turtle(g) {
      /* 거북이 — 등껍질이 주인공이라 몸통 타원을 껍질로 씁니다.
         머리는 앞으로 쭉 내밀어야 거북이로 보입니다. */
      const { p, t, lv, body: b, head: h } = g;
      const hx = h.cx + lerp(5, 8, t);       // 머리를 오른쪽으로 내밉니다
      const hy = h.cy + lerp(5, 7, t);
      const hr = h.r * 0.72;
      const foot = (sx, dy) => `<ellipse cx="${n1(b.cx + sx * b.rx * 0.72)}" cy="${n1(b.cy + b.ry * 0.72 + dy)}" rx="${n1(lerp(2.8, 3.8, t))}" ry="${n1(lerp(1.9, 2.5, t))}" fill="${p.line}"/>`;
      return `
        ${lv >= AT_TAIL ? `<path d="M${n1(b.cx - b.rx * 0.95)} ${n1(b.cy + 2)}l-${n1(lerp(3.5, 5, t))} ${n1(lerp(1.5, 2.2, t))} ${n1(lerp(3.5, 5, t))} ${n1(lerp(1.6, 2.4, t))}z" fill="${p.line}"/>` : ""}
        ${foot(-1, 0)}${foot(1, 0)}
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry * 0.9)}" fill="${p.line}"/>
        <ellipse cx="${b.cx}" cy="${n1(b.cy - 0.6)}" rx="${n1(b.rx * 0.82)}" ry="${n1(b.ry * 0.72)}" fill="${p.body}"/>
        ${lv >= AT_MARK ? `<path d="M${n1(b.cx - b.rx * 0.5)} ${n1(b.cy - 1)}h${n1(b.rx)}M${b.cx} ${n1(b.cy - b.ry * 0.6)}v${n1(b.ry * 1.1)}" stroke="${p.dark}" stroke-width="1.1" opacity=".5"/>
                     <circle cx="${b.cx}" cy="${n1(b.cy - 0.6)}" r="${n1(b.rx * 0.3)}" fill="none" stroke="${p.dark}" stroke-width="1.1" opacity=".5"/>` : ""}
        <circle cx="${n1(hx)}" cy="${n1(hy)}" r="${n1(hr)}" fill="${p.light}"/>
        ${face(hx, hy, hr, p, true)}`;
    },

    butterfly(g) {
      /* 나비 — 날개가 전부입니다. 몸통은 가늘게.
         날개는 위·아래 두 쌍이라야 나비로 읽혀요. */
      const { p, t, lv, body: b, head: h } = g;
      const wr = lerp(5.5, 9, t);
      const wing = sx => `
        <ellipse cx="${n1(b.cx + sx * wr * 0.95)}" cy="${n1(b.cy - wr * 0.42)}" rx="${n1(wr)}" ry="${n1(wr * 0.82)}" fill="${p.light}" opacity=".95"/>
        <ellipse cx="${n1(b.cx + sx * wr * 0.8)}" cy="${n1(b.cy + wr * 0.55)}" rx="${n1(wr * 0.76)}" ry="${n1(wr * 0.62)}" fill="${p.body}" opacity=".95"/>
        ${lv >= AT_MARK ? `<circle cx="${n1(b.cx + sx * wr * 1.05)}" cy="${n1(b.cy - wr * 0.45)}" r="${n1(wr * 0.24)}" fill="${p.pale}"/>` : ""}`;
      const ant = sx => `<path d="M${n1(h.cx + sx * 1.4)} ${n1(h.cy - h.r * 0.8)}q${n1(sx * 3)} -${n1(lerp(3.5, 5, t))} ${n1(sx * 5)} -${n1(lerp(3, 4.2, t))}" stroke="${p.dark}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
      return `
        ${wing(-1)}${wing(1)}
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx * 0.28)}" ry="${n1(b.ry * 0.95)}" fill="${p.dark}"/>
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r * 0.62)}" fill="${p.dark}"/>
        ${ant(-1)}${ant(1)}
        <circle cx="${n1(h.cx - h.r * 0.24)}" cy="${n1(h.cy)}" r="1.1" fill="${p.pale}"/>
        <circle cx="${n1(h.cx + h.r * 0.24)}" cy="${n1(h.cy)}" r="1.1" fill="${p.pale}"/>`;
    },

    bee(g) {
      /* 벌 — 몸통의 검은 줄무늬와 작고 투명한 날개.
         줄무늬는 몸통 밖으로 삐져나오면 안 돼서 잘라내기 틀을 씁니다. */
      const { p, t, lv, body: b, head: h } = g;
      const cid = `beeclip${++_clipSeq}`;
      const wr = lerp(4.2, 6, t);
      const wing = sx => `<ellipse cx="${n1(b.cx + sx * b.rx * 0.55)}" cy="${n1(b.cy - b.ry * 0.85)}" rx="${n1(wr)}" ry="${n1(wr * 0.62)}" fill="#FFFFFF" opacity=".72" transform="rotate(${sx * -22} ${n1(b.cx + sx * b.rx * 0.55)} ${n1(b.cy - b.ry * 0.85)})"/>`;
      const ant = sx => `<path d="M${n1(h.cx + sx * 1.6)} ${n1(h.cy - h.r * 0.85)}q${n1(sx * 2.4)} -${n1(lerp(3, 4.4, t))} ${n1(sx * 4)} -${n1(lerp(2.6, 3.6, t))}" stroke="${INK}" stroke-width="1" fill="none" stroke-linecap="round"/>`;
      return `
        ${wing(-1)}${wing(1)}
        <clipPath id="${cid}"><ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}"/></clipPath>
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        <g clip-path="url(#${cid})">
          <rect x="${n1(b.cx - b.rx - 2)}" y="${n1(b.cy - b.ry * 0.55)}" width="${n1(b.rx * 2 + 4)}" height="${n1(b.ry * 0.42)}" fill="${INK}"/>
          <rect x="${n1(b.cx - b.rx - 2)}" y="${n1(b.cy + b.ry * 0.2)}" width="${n1(b.rx * 2 + 4)}" height="${n1(b.ry * 0.42)}" fill="${INK}"/>
        </g>
        ${lv >= AT_TAIL ? `<path d="M${n1(b.cx)} ${n1(b.cy + b.ry)}l-2 ${n1(lerp(2.4, 3.4, t))} 2 -1 2 1z" fill="${INK}"/>` : ""}
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r * 0.86)}" fill="${INK}"/>
        ${ant(-1)}${ant(1)}
        <circle cx="${n1(h.cx - h.r * 0.3)}" cy="${n1(h.cy)}" r="${n1(h.r * 0.16)}" fill="#FFFFFF"/>
        <circle cx="${n1(h.cx + h.r * 0.3)}" cy="${n1(h.cy)}" r="${n1(h.r * 0.16)}" fill="#FFFFFF"/>`;
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
      /* 물개 — 다시 그렸습니다.

         [무엇이 달라졌나]
         예전에는 몸통 위에 머리를 얹은 평범한 모양이라 곰이나 강아지와
         잘 구분되지 않았습니다. 캡쳐로 보여주신 물개는 **몸이 통짜로
         이어지고, 앞지느러미로 상체를 세워 앉은** 자세였어요.

         그래서 머리와 몸을 하나의 흐름으로 잇고, 지느러미를 몸 앞에
         붙였습니다. 코 끝에 흰 점을 찍어 반짝임도 넣었어요. */
      const { p, t, lv, body: b, head: h } = g;
      const cy = b.cy + 1;
      const rx = b.rx * 1.02, ry = b.ry * 1.0;
      const hr = h.r * 0.86;
      const hy = h.cy + 2;
      const whisk = sx => `<path d="M${n1(h.cx + sx * hr * 0.5)} ${n1(hy + hr * 0.5)}l${n1(sx * hr * 0.9)} -${n1(hr * 0.16)}
                                 M${n1(h.cx + sx * hr * 0.5)} ${n1(hy + hr * 0.62)}l${n1(sx * hr * 0.85)} ${n1(hr * 0.14)}"
                             stroke="${p.dark}" stroke-width=".8" stroke-linecap="round" opacity=".65"/>`;
      return `
        ${lv >= AT_TAIL ? `<path d="M${n1(b.cx + rx * 0.82)} ${n1(cy + ry * 0.5)}
                                 q${n1(lerp(7, 10, t))} ${n1(lerp(2, 3, t))} ${n1(lerp(9, 13, t))} -${n1(lerp(2, 3, t))}
                                 q-${n1(lerp(3, 4, t))} ${n1(lerp(4, 5.5, t))} -${n1(lerp(9, 13, t))} ${n1(lerp(2, 3, t))}z"
                               fill="${p.line}"/>` : ""}

        <!-- 몸 — 머리 쪽이 좁고 뒤가 두툼한 물방울 -->
        <ellipse cx="${b.cx}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${n1(ry)}" fill="${p.body}"/>
        <ellipse cx="${b.cx}" cy="${n1(cy + ry * 0.22)}" rx="${n1(rx * 0.62)}" ry="${n1(ry * 0.62)}" fill="${p.pale}"/>

        <!-- 목 — 머리와 몸을 하나로 잇습니다. 이게 물개다움의 절반 -->
        <path d="M${n1(h.cx - hr * 0.78)} ${n1(hy)}
                 q-${n1(hr * 0.25)} ${n1(hr * 1.5)} ${n1(hr * 0.5)} ${n1(hr * 1.9)}
                 h${n1(hr * 1.35)}
                 q${n1(hr * 0.75)} -${n1(hr * 0.4)} ${n1(hr * 0.28)} -${n1(hr * 1.9)}z" fill="${p.body}"/>

        <!-- 앞지느러미 — 몸 앞으로 짚어 상체를 세웁니다 -->
        <ellipse cx="${n1(b.cx - rx * 0.66)}" cy="${n1(cy + ry * 0.52)}" rx="${n1(lerp(3, 4.2, t))}" ry="${n1(lerp(4.6, 6.2, t))}"
                 fill="${p.line}" transform="rotate(24 ${n1(b.cx - rx * 0.66)} ${n1(cy + ry * 0.52)})"/>
        <ellipse cx="${n1(b.cx + rx * 0.66)}" cy="${n1(cy + ry * 0.52)}" rx="${n1(lerp(3, 4.2, t))}" ry="${n1(lerp(4.6, 6.2, t))}"
                 fill="${p.line}" transform="rotate(-24 ${n1(b.cx + rx * 0.66)} ${n1(cy + ry * 0.52)})"/>

        <circle cx="${h.cx}" cy="${n1(hy)}" r="${n1(hr)}" fill="${p.body}"/>
        <!-- 주둥이 — 둥글게 튀어나옵니다 -->
        <ellipse cx="${h.cx}" cy="${n1(hy + hr * 0.46)}" rx="${n1(hr * 0.52)}" ry="${n1(hr * 0.4)}" fill="${p.pale}"/>
        <circle cx="${n1(h.cx - hr * 0.4)}" cy="${n1(hy - hr * 0.12)}" r="${n1(Math.max(1.3, hr * 0.19))}" fill="${p.dark}"/>
        <circle cx="${n1(h.cx + hr * 0.4)}" cy="${n1(hy - hr * 0.12)}" r="${n1(Math.max(1.3, hr * 0.19))}" fill="${p.dark}"/>
        <circle cx="${n1(h.cx - hr * 0.34)}" cy="${n1(hy - hr * 0.2)}" r=".55" fill="#FFFFFF"/>
        <circle cx="${n1(h.cx + hr * 0.46)}" cy="${n1(hy - hr * 0.2)}" r=".55" fill="#FFFFFF"/>
        <ellipse cx="${h.cx}" cy="${n1(hy + hr * 0.3)}" rx="${n1(hr * 0.2)}" ry="${n1(hr * 0.15)}" fill="${p.dark}"/>
        ${lv >= AT_WING ? whisk(-1) + whisk(1) : ""}
        ${lv >= AT_MARK ? `<circle cx="${n1(b.cx - rx * 0.35)}" cy="${n1(cy - ry * 0.4)}" r="1.5" fill="${p.dark}" opacity=".35"/>
                     <circle cx="${n1(b.cx + rx * 0.42)}" cy="${n1(cy - ry * 0.2)}" r="1.2" fill="${p.dark}" opacity=".35"/>` : ""}`;
    },

    whale(g) {
      /* 고래 — 다시 그렸습니다.

         [무엇이 달라졌나]
         예전에는 옆으로 누운 타원 하나라 물고기처럼 보였습니다.
         캡쳐의 고래는 **몸이 통통하고, 꼬리가 위로 갈라져 올라가며,
         물줄기를 뿜고** 있었어요. 그 셋이 고래를 고래로 만듭니다.

         물줄기는 Lv.15 부터 나옵니다. 처음부터 뿜으면 아기 고래가
         너무 요란해져서요. */
      const { p, t, lv, body: b } = g;
      const cx = b.cx - 2.5, cy = b.cy - 1;
      const rx = b.rx * 1.16, ry = b.ry * 1.0;
      const tw = lerp(8, 12, t);        // 꼬리 크기
      return `
        <!-- 꼬리 — 위아래로 갈라져 올라갑니다 -->
        ${lv >= AT_TAIL ? `<path d="M${n1(cx + rx * 0.85)} ${n1(cy)}
                                 q${n1(tw * 0.5)} -${n1(tw * 0.1)} ${n1(tw * 0.75)} -${n1(tw * 0.85)}
                                 q-${n1(tw * 0.1)} ${n1(tw * 0.55)} ${n1(tw * 0.35)} ${n1(tw * 0.75)}
                                 q-${n1(tw * 0.45)} ${n1(tw * 0.5)} -${n1(tw * 1.1)} ${n1(tw * 0.1)}z"
                               fill="${p.line}"/>` : ""}

        <!-- 몸 — 앞이 둥글고 뒤로 갈수록 가늘어집니다 -->
        <path d="M${n1(cx - rx)} ${n1(cy)}
                 q0 -${n1(ry * 1.05)} ${n1(rx * 0.95)} -${n1(ry * 0.95)}
                 q${n1(rx * 0.9)} 0 ${n1(rx * 1.85)} ${n1(ry * 0.85)}
                 q-${n1(rx * 0.95)} ${n1(ry * 1.1)} -${n1(rx * 1.85)} ${n1(ry * 0.25)}
                 q-${n1(rx * 0.95)} -${n1(ry * 0.3)} -${n1(rx * 0.95)} -${n1(ry * 0.15)}z" fill="${p.body}"/>

        <!-- 배 — 밝은 색으로 아랫배를 나눕니다 -->
        <path d="M${n1(cx - rx * 0.86)} ${n1(cy + ry * 0.22)}
                 q${n1(rx * 0.85)} ${n1(ry * 0.85)} ${n1(rx * 1.75)} ${n1(ry * 0.05)}
                 q-${n1(rx * 0.85)} ${n1(ry * 0.75)} -${n1(rx * 1.75)} -${n1(ry * 0.05)}z" fill="${p.pale}"/>
        ${lv >= AT_MARK ? `<path d="M${n1(cx - rx * 0.5)} ${n1(cy + ry * 0.5)}v${n1(ry * 0.4)}
                                 M${n1(cx - rx * 0.2)} ${n1(cy + ry * 0.62)}v${n1(ry * 0.34)}
                                 M${n1(cx + rx * 0.1)} ${n1(cy + ry * 0.66)}v${n1(ry * 0.28)}"
                               stroke="${p.dark}" stroke-width=".9" opacity=".3" stroke-linecap="round"/>` : ""}

        <!-- 가슴지느러미 -->
        <ellipse cx="${n1(cx - rx * 0.15)}" cy="${n1(cy + ry * 0.6)}" rx="${n1(lerp(3.2, 4.4, t))}" ry="${n1(lerp(1.8, 2.4, t))}"
                 fill="${p.line}" transform="rotate(22 ${n1(cx - rx * 0.15)} ${n1(cy + ry * 0.6)})"/>

        <!-- 물줄기 -->
        ${lv >= AT_WING ? `<path d="M${n1(cx - rx * 0.42)} ${n1(cy - ry * 0.92)}q-1 -${n1(lerp(5, 7, t))} ${n1(lerp(2.5, 3.5, t))} -${n1(lerp(7, 9.5, t))}"
                               stroke="${p.pale}" stroke-width="${n1(lerp(1.8, 2.4, t))}" fill="none" stroke-linecap="round"/>
                     <circle cx="${n1(cx - rx * 0.24)}" cy="${n1(cy - ry * 1.55)}" r="${n1(lerp(1.2, 1.8, t))}" fill="${p.pale}"/>
                     <circle cx="${n1(cx - rx * 0.6)}" cy="${n1(cy - ry * 1.35)}" r="${n1(lerp(.9, 1.3, t))}" fill="${p.pale}" opacity=".8"/>` : ""}

        <circle cx="${n1(cx - rx * 0.58)}" cy="${n1(cy - ry * 0.22)}" r="${n1(lerp(1.5, 1.9, t))}" fill="${p.dark}"/>
        <circle cx="${n1(cx - rx * 0.62)}" cy="${n1(cy - ry * 0.32)}" r=".55" fill="#FFFFFF"/>
        <path d="M${n1(cx - rx * 0.86)} ${n1(cy + ry * 0.14)}q${n1(rx * 0.2)} ${n1(ry * 0.2)} ${n1(rx * 0.4)} 0"
              stroke="${p.dark}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
    },

/* ── 나무 상자에서 나오는 무리 (2차) ────────────────────────── */

    fox(g) {
      /* 여우 — 뾰족한 삼각 귀와 크고 풍성한 꼬리.
         꼬리 끝을 밝게 해야 여우로 읽힙니다. */
      const { p, t, lv, body: b, head: h } = g;
      const ear = sx => `<path d="M${n1(h.cx + sx * h.r * 0.62)} ${n1(h.cy - h.r * 0.62)}
                                  l${n1(sx * h.r * 0.1)} -${n1(lerp(6, 8.5, t))}
                                  ${n1(sx * h.r * 0.72)} ${n1(lerp(4, 5.4, t))}z"
                              fill="${p.body}" stroke="${p.body}" stroke-width="2" stroke-linejoin="round"/>
                         <path d="M${n1(h.cx + sx * h.r * 0.72)} ${n1(h.cy - h.r * 0.7)}
                                  l${n1(sx * h.r * 0.06)} -${n1(lerp(3.4, 4.6, t))}
                                  ${n1(sx * h.r * 0.36)} ${n1(lerp(2.2, 3, t))}z" fill="${p.dark}" opacity=".45"/>`;
      return `
        ${lv >= AT_TAIL ? `<path d="M${n1(b.cx + b.rx * 0.9)} ${n1(b.cy)}
                                 q${n1(lerp(10, 14, t))} -${n1(lerp(3, 4, t))} ${n1(lerp(8, 11, t))} ${n1(lerp(8, 11, t))}
                                 q-${n1(lerp(5, 7, t))} ${n1(lerp(2, 3, t))} -${n1(lerp(9, 12, t))} -${n1(lerp(4, 5, t))}z"
                               fill="${p.body}"/>
                     <path d="M${n1(b.cx + b.rx * 0.9 + lerp(9, 12.5, t))} ${n1(b.cy + lerp(2, 3, t))}
                              q${n1(lerp(2, 3, t))} ${n1(lerp(3, 4, t))} -${n1(lerp(1, 1.5, t))} ${n1(lerp(4, 5, t))}
                              q-${n1(lerp(2, 3, t))} -${n1(lerp(1, 1.5, t))} -${n1(lerp(1, 1.5, t))} -${n1(lerp(4, 5, t))}z"
                            fill="${p.pale}"/>` : ""}
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        <ellipse cx="${b.cx}" cy="${n1(b.cy + b.ry * 0.3)}" rx="${n1(b.rx * 0.5)}" ry="${n1(b.ry * 0.55)}" fill="${p.pale}"/>
        ${ear(-1)}${ear(1)}
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.body}"/>
        <path d="M${n1(h.cx - h.r * 0.46)} ${n1(h.cy + h.r * 0.18)}
                 q${n1(h.r * 0.46)} ${n1(h.r * 0.9)} ${n1(h.r * 0.92)} 0z" fill="${p.pale}"/>
        ${face(h.cx, h.cy, h.r, p, false)}
        <ellipse cx="${h.cx}" cy="${n1(h.cy + h.r * 0.62)}" rx="${n1(h.r * 0.16)}" ry="${n1(h.r * 0.12)}" fill="${p.dark}"/>`;
    },

    unicorn(g) {
      /* 유니콘 — 이마의 나선 뿔과 색색의 갈기.
         몸이 거의 흰색이라, 갈기 색으로 살아납니다. */
      const { p, t, lv, body: b, head: h } = g;
      const hornH = lerp(7, 10.5, t);
      const mane = "#C48BE0";
      return `
        <!-- 꼬리 — 위로 뻗쳐 올립니다.

             처음엔 아래로 늘어뜨렸는데 말꼬리처럼 축 처져 보였어요.
             위로 휘어 올리면 갈기와 이어져 한 덩어리로 읽히고,
             유니콘다운 기세가 납니다. -->
        ${lv >= AT_TAIL ? `<path d="M${n1(b.cx + b.rx * 0.92)} ${n1(b.cy + 1)}
                                 q${n1(lerp(8, 11, t))} -${n1(lerp(3, 4, t))} ${n1(lerp(9, 12.5, t))} -${n1(lerp(11, 15, t))}"
                               stroke="${mane}" stroke-width="${n1(lerp(3.4, 4.6, t))}" fill="none" stroke-linecap="round"/>
                     <path d="M${n1(b.cx + b.rx * 0.92 + lerp(5, 7, t))} ${n1(b.cy - lerp(3, 4, t))}
                              q${n1(lerp(6, 8, t))} -${n1(lerp(2, 3, t))} ${n1(lerp(6, 8.5, t))} -${n1(lerp(8, 11, t))}"
                            stroke="#7EC8E3" stroke-width="${n1(lerp(2, 2.8, t))}" fill="none" stroke-linecap="round" opacity=".9"/>` : ""}
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.body}"/>

        <!-- 갈기 — 머리 뒤로 흘러내립니다 -->
        <path d="M${n1(h.cx - h.r * 0.9)} ${n1(h.cy - h.r * 0.5)}
                 q-${n1(h.r * 0.7)} ${n1(h.r * 0.9)} -${n1(h.r * 0.2)} ${n1(h.r * 1.7)}
                 q${n1(h.r * 0.5)} -${n1(h.r * 0.4)} ${n1(h.r * 0.75)} -${n1(h.r * 1.3)}z" fill="${mane}"/>
        ${lv >= AT_MARK ? `<path d="M${n1(h.cx - h.r * 0.72)} ${n1(h.cy - h.r * 0.75)}
                                 q-${n1(h.r * 0.5)} ${n1(h.r * 0.7)} -${n1(h.r * 0.1)} ${n1(h.r * 1.2)}"
                               stroke="#7EC8E3" stroke-width="1.6" fill="none" stroke-linecap="round"/>` : ""}

        <!-- 귀 -->
        <path d="M${n1(h.cx + h.r * 0.62)} ${n1(h.cy - h.r * 0.66)}l${n1(h.r * 0.1)} -${n1(h.r * 0.5)} ${n1(h.r * 0.4)} ${n1(h.r * 0.34)}z" fill="${p.line}"/>

        <!-- 뿔 — 나선 세 칸 -->
        <path d="M${h.cx} ${n1(h.cy - h.r)}l-${n1(lerp(1.8, 2.4, t))} 0 ${n1(lerp(1.8, 2.4, t))} -${n1(hornH)} ${n1(lerp(1.8, 2.4, t))} ${n1(lerp(1.8, 2.4, t) * 0)}z"
              fill="${HORN_GOLD}"/>
        <path d="M${n1(h.cx - 1.4)} ${n1(h.cy - h.r - hornH * 0.28)}h2.8M${n1(h.cx - 1)} ${n1(h.cy - h.r - hornH * 0.55)}h2"
              stroke="#C9922E" stroke-width=".8" stroke-linecap="round"/>
        ${face(h.cx, h.cy, h.r, p, true)}`;
    },

    deer(g) {
      /* 사슴 — 나뭇가지 뿔과 등의 흰 점무늬.
         뿔은 용의 뿔과 같은 결로, 레벨이 오르면 가지가 늘어납니다. */
      const { p, t, lv, body: b, head: h } = g;
      const aH = lerp(6, 10, t);
      const antler = sx => `
        <path d="M${n1(h.cx + sx * h.r * 0.5)} ${n1(h.cy - h.r * 0.78)}l${n1(sx * 1.2)} -${n1(aH)}"
              stroke="${HORN_GOLD}" stroke-width="${n1(lerp(1.6, 2.2, t))}" stroke-linecap="round"/>
        <path d="M${n1(h.cx + sx * (h.r * 0.5 + 0.7))} ${n1(h.cy - h.r * 0.78 - aH * 0.45)}l${n1(sx * 3.2)} -${n1(aH * 0.4)}"
              stroke="${HORN_GOLD}" stroke-width="${n1(lerp(1.3, 1.8, t))}" stroke-linecap="round"/>
        ${lv >= AT_MARK ? `<path d="M${n1(h.cx + sx * (h.r * 0.5 + 1))} ${n1(h.cy - h.r * 0.78 - aH * 0.78)}l${n1(sx * 2.6)} -${n1(aH * 0.34)}"
                               stroke="${HORN_GOLD}" stroke-width="${n1(lerp(1.2, 1.6, t))}" stroke-linecap="round"/>` : ""}`;
      return `
        ${lv >= AT_TAIL ? `<ellipse cx="${n1(b.cx + b.rx * 0.95)}" cy="${n1(b.cy - 1)}" rx="${n1(lerp(2.4, 3.2, t))}" ry="${n1(lerp(3, 4, t))}" fill="${p.pale}"/>` : ""}
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        ${lv >= AT_MARK ? `<circle cx="${n1(b.cx - b.rx * 0.4)}" cy="${n1(b.cy - b.ry * 0.3)}" r="1.5" fill="${p.pale}"/>
                     <circle cx="${n1(b.cx + b.rx * 0.1)}" cy="${n1(b.cy - b.ry * 0.5)}" r="1.3" fill="${p.pale}"/>
                     <circle cx="${n1(b.cx + b.rx * 0.5)}" cy="${n1(b.cy - b.ry * 0.2)}" r="1.4" fill="${p.pale}"/>` : ""}
        ${antler(-1)}${antler(1)}
        <ellipse cx="${n1(h.cx - h.r * 0.92)}" cy="${n1(h.cy - h.r * 0.42)}" rx="${n1(h.r * 0.24)}" ry="${n1(h.r * 0.4)}" fill="${p.line}"/>
        <ellipse cx="${n1(h.cx + h.r * 0.92)}" cy="${n1(h.cy - h.r * 0.42)}" rx="${n1(h.r * 0.24)}" ry="${n1(h.r * 0.4)}" fill="${p.line}"/>
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.body}"/>
        <ellipse cx="${h.cx}" cy="${n1(h.cy + h.r * 0.5)}" rx="${n1(h.r * 0.42)}" ry="${n1(h.r * 0.32)}" fill="${p.pale}"/>
        ${face(h.cx, h.cy, h.r, p, true)}
        <ellipse cx="${h.cx}" cy="${n1(h.cy + h.r * 0.42)}" rx="${n1(h.r * 0.15)}" ry="${n1(h.r * 0.11)}" fill="${p.dark}"/>`;
    },

    sheep(g) {
      /* 양 — 몸 전체가 뭉게뭉게. 원을 여러 개 겹쳐 털을 만듭니다.
         얼굴만 어두운 색으로 빼면 양으로 확 읽혀요. */
      const { p, t, lv, body: b, head: h } = g;
      const puff = (dx, dy, r) => `<circle cx="${n1(b.cx + dx)}" cy="${n1(b.cy + dy)}" r="${n1(r)}" fill="${p.body}"/>`;
      const R = b.rx * 0.52;
      const faceC = shade(p.body, -0.42);
      return `
        ${lv >= AT_TAIL ? `<path d="M${n1(b.cx - 3)} ${n1(b.cy + b.ry * 0.95)}v${n1(lerp(3, 4, t))}
                                 M${n1(b.cx + 3)} ${n1(b.cy + b.ry * 0.95)}v${n1(lerp(3, 4, t))}"
                               stroke="${faceC}" stroke-width="2" stroke-linecap="round"/>` : ""}
        ${puff(-b.rx * 0.62, 0, R)}${puff(b.rx * 0.62, 0, R)}
        ${puff(0, -b.ry * 0.42, R * 1.05)}${puff(0, b.ry * 0.34, R * 1.05)}
        ${puff(-b.rx * 0.36, b.ry * 0.36, R * 0.85)}${puff(b.rx * 0.36, b.ry * 0.36, R * 0.85)}
        <ellipse cx="${n1(h.cx - h.r * 0.95)}" cy="${n1(h.cy + h.r * 0.1)}" rx="${n1(h.r * 0.34)}" ry="${n1(h.r * 0.24)}" fill="${faceC}"/>
        <ellipse cx="${n1(h.cx + h.r * 0.95)}" cy="${n1(h.cy + h.r * 0.1)}" rx="${n1(h.r * 0.34)}" ry="${n1(h.r * 0.24)}" fill="${faceC}"/>
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r * 0.82)}" fill="${faceC}"/>
        <circle cx="${h.cx}" cy="${n1(h.cy - h.r * 0.72)}" r="${n1(h.r * 0.5)}" fill="${p.body}"/>
        <circle cx="${n1(h.cx - h.r * 0.5)}" cy="${n1(h.cy - h.r * 0.58)}" r="${n1(h.r * 0.36)}" fill="${p.body}"/>
        <circle cx="${n1(h.cx + h.r * 0.5)}" cy="${n1(h.cy - h.r * 0.58)}" r="${n1(h.r * 0.36)}" fill="${p.body}"/>
        <circle cx="${n1(h.cx - h.r * 0.3)}" cy="${n1(h.cy + h.r * 0.05)}" r="${n1(Math.max(1.1, h.r * 0.14))}" fill="#FFFFFF"/>
        <circle cx="${n1(h.cx + h.r * 0.3)}" cy="${n1(h.cy + h.r * 0.05)}" r="${n1(Math.max(1.1, h.r * 0.14))}" fill="#FFFFFF"/>`;
    },

    monkey(g) {
      /* 원숭이 — 옆으로 큰 동그란 귀, 밝은 얼굴판, 말린 꼬리 */
      const { p, t, lv, body: b, head: h } = g;
      const er = lerp(3.2, 4.2, t);
      return `
        ${lv >= AT_TAIL ? `<path d="M${n1(b.cx + b.rx * 0.9)} ${n1(b.cy)}
                                 q${n1(lerp(8, 11, t))} -${n1(lerp(1, 2, t))} ${n1(lerp(7, 9, t))} ${n1(lerp(5, 7, t))}
                                 q-${n1(lerp(1, 2, t))} ${n1(lerp(4, 5, t))} -${n1(lerp(5, 6, t))} ${n1(lerp(2, 3, t))}"
                               stroke="${p.body}" stroke-width="${n1(lerp(2.4, 3.2, t))}" fill="none" stroke-linecap="round"/>` : ""}
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        <ellipse cx="${b.cx}" cy="${n1(b.cy + b.ry * 0.22)}" rx="${n1(b.rx * 0.58)}" ry="${n1(b.ry * 0.6)}" fill="${p.pale}"/>
        <circle cx="${n1(h.cx - h.r - er * 0.35)}" cy="${n1(h.cy)}" r="${n1(er)}" fill="${p.body}"/>
        <circle cx="${n1(h.cx + h.r + er * 0.35)}" cy="${n1(h.cy)}" r="${n1(er)}" fill="${p.body}"/>
        <circle cx="${n1(h.cx - h.r - er * 0.35)}" cy="${n1(h.cy)}" r="${n1(er * 0.55)}" fill="${p.pale}"/>
        <circle cx="${n1(h.cx + h.r + er * 0.35)}" cy="${n1(h.cy)}" r="${n1(er * 0.55)}" fill="${p.pale}"/>
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.body}"/>
        <ellipse cx="${h.cx}" cy="${n1(h.cy + h.r * 0.18)}" rx="${n1(h.r * 0.72)}" ry="${n1(h.r * 0.66)}" fill="${p.pale}"/>
        ${face(h.cx, h.cy, h.r, p, true)}
        <circle cx="${n1(h.cx - h.r * 0.14)}" cy="${n1(h.cy + h.r * 0.3)}" r=".9" fill="${p.dark}"/>
        <circle cx="${n1(h.cx + h.r * 0.14)}" cy="${n1(h.cy + h.r * 0.3)}" r=".9" fill="${p.dark}"/>`;
    },

    coral(g) {
      /* 산호 — 손가락처럼 갈라져 올라가는 가지.

         [지난 이야기]
         처음엔 가지 끝에 동그란 머리를 얹었는데 롤리팝 같다고 하셔서,
         **동그란 머리만 빼고** 손가락처럼 뻗은 모양으로 두었습니다.
         그 결정을 그대로 지킵니다 — 끝을 둥글리되 혹은 달지 않아요. */
      const { p, t, lv, body: b } = g;
      const baseY = 46;
      const h1 = lerp(14, 22, t);
      const arm = (dx, len, w, tilt) => `
        <path d="M${n1(b.cx + dx)} ${n1(baseY)}
                 q${n1(tilt)} -${n1(len * 0.55)} ${n1(tilt * 1.5)} -${n1(len)}"
              stroke="${p.body}" stroke-width="${n1(w)}" fill="none" stroke-linecap="round"/>`;
      return `
        <!-- 바닥 돌 -->
        <ellipse cx="${b.cx}" cy="${n1(baseY + 2)}" rx="${n1(lerp(9, 12, t))}" ry="${n1(lerp(2.6, 3.4, t))}" fill="${p.dark}" opacity=".35"/>
        ${arm(-6, h1 * 0.78, lerp(3.4, 4.6, t), -3)}
        ${arm(6, h1 * 0.72, lerp(3.4, 4.6, t), 3)}
        ${arm(0, h1, lerp(4, 5.4, t), 0)}
        ${lv >= AT_TAIL ? arm(-2.5, h1 * 0.9, lerp(2.8, 3.8, t), -5) + arm(3, h1 * 0.86, lerp(2.8, 3.8, t), 5) : ""}
        ${lv >= AT_WING ? arm(-9, h1 * 0.56, lerp(2.4, 3.2, t), -4) + arm(9, h1 * 0.52, lerp(2.4, 3.2, t), 4) : ""}
        ${lv >= AT_MARK ? `<circle cx="${n1(b.cx - 4)}" cy="${n1(baseY - h1 * 0.5)}" r="1.3" fill="${p.pale}"/>
                     <circle cx="${n1(b.cx + 5)}" cy="${n1(baseY - h1 * 0.4)}" r="1.1" fill="${p.pale}"/>
                     <circle cx="${n1(b.cx + 1)}" cy="${n1(baseY - h1 * 0.75)}" r="1.2" fill="${p.pale}"/>` : ""}`;
    },

    panda(g) {
      /* 판다 — 몸은 검고, 배와 얼굴이 흽니다.
         귀는 검게 남겨야 판다로 읽혀요. */
      const { p, t, body: b, head: h } = g;
      const er = lerp(4.4, 5.6, t);
      return `
        <!-- 몸 — 검정 -->
        <ellipse cx="${b.cx}" cy="${n1(b.cy)}" rx="${n1(b.rx)}" ry="${n1(b.ry)}" fill="${p.body}"/>
        <!-- 배 — 흰 무늬. 몸 안쪽에 크게 -->
        <ellipse cx="${b.cx}" cy="${n1(b.cy + b.ry * 0.12)}" rx="${n1(b.rx * 0.62)}" ry="${n1(b.ry * 0.7)}" fill="${p.mark}"/>
        <!-- 팔 — 검정이라 몸에 묻히므로 배 위로 살짝 걸칩니다 -->
        <ellipse cx="${n1(b.cx - b.rx * 0.74)}" cy="${n1(b.cy + b.ry * 0.3)}" rx="${n1(er * 0.72)}" ry="${n1(er * 0.95)}" fill="${p.body}"/>
        <ellipse cx="${n1(b.cx + b.rx * 0.74)}" cy="${n1(b.cy + b.ry * 0.3)}" rx="${n1(er * 0.72)}" ry="${n1(er * 0.95)}" fill="${p.body}"/>
        <!-- 귀 — 검정 -->
        <circle cx="${n1(h.cx - h.r * 0.95)}" cy="${n1(h.cy - h.r * 0.8)}" r="${n1(er)}" fill="${p.body}"/>
        <circle cx="${n1(h.cx + h.r * 0.95)}" cy="${n1(h.cy - h.r * 0.8)}" r="${n1(er)}" fill="${p.body}"/>
        <!-- 얼굴 — 흰빛 -->
        <circle cx="${h.cx}" cy="${n1(h.cy)}" r="${n1(h.r)}" fill="${p.mark}"/>
        <!-- 눈 둘레 — 검정 -->
        <ellipse cx="${n1(h.cx - h.r * 0.42)}" cy="${n1(h.cy - h.r * 0.05)}" rx="${n1(h.r * 0.3)}" ry="${n1(h.r * 0.36)}" fill="${p.body}"/>
        <ellipse cx="${n1(h.cx + h.r * 0.42)}" cy="${n1(h.cy - h.r * 0.05)}" rx="${n1(h.r * 0.3)}" ry="${n1(h.r * 0.36)}" fill="${p.body}"/>
        <circle cx="${n1(h.cx - h.r * 0.38)}" cy="${n1(h.cy - h.r * 0.02)}" r="1.3" fill="#FFFFFF"/>
        <circle cx="${n1(h.cx + h.r * 0.38)}" cy="${n1(h.cy - h.r * 0.02)}" r="1.3" fill="#FFFFFF"/>
        <ellipse cx="${h.cx}" cy="${n1(h.cy + h.r * 0.42)}" rx="${n1(h.r * 0.2)}" ry="${n1(h.r * 0.15)}" fill="${p.body}"/>
        <path d="M${n1(h.cx - h.r * 0.2)} ${n1(h.cy + h.r * 0.62)}q${n1(h.r * 0.2)} ${n1(h.r * 0.18)} ${n1(h.r * 0.4)} 0"
              stroke="${p.body}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
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

/* 여섯 꽃 — 핀 모습만 다릅니다 */

    rose: makeFlower((p, cy, r) => {
      /* 장미 — 겹겹이 말린 꽃잎. 원을 세 겹 겹쳐서 소용돌이처럼 */
      return `
        <circle cx="28" cy="${n1(cy)}" r="${n1(r)}" fill="${p.body}"/>
        <circle cx="28" cy="${n1(cy)}" r="${n1(r * 0.72)}" fill="${p.light}"/>
        <circle cx="${n1(28 + r * 0.14)}" cy="${n1(cy - r * 0.1)}" r="${n1(r * 0.44)}" fill="${p.body}"/>
        <circle cx="${n1(28 - r * 0.1)}" cy="${n1(cy + r * 0.08)}" r="${n1(r * 0.2)}" fill="${p.light}"/>`;
    }),

    tulip: makeFlower((p, cy, r) => {
      /* 튤립 — 컵 모양. 위쪽에 뾰족한 세 갈래 */
      return `
        <path d="M${n1(28 - r * 0.78)} ${n1(cy - r * 0.5)}q0 ${n1(r * 1.5)} ${n1(r * 0.78)} ${n1(r * 1.5)}
                 q${n1(r * 0.78)} 0 ${n1(r * 0.78)} -${n1(r * 1.5)}
                 l-${n1(r * 0.5)} ${n1(r * 0.42)} -${n1(r * 0.28)} -${n1(r * 0.6)}
                 -${n1(r * 0.28)} ${n1(r * 0.6)}z" fill="${p.body}"/>
        <path d="M28 ${n1(cy - r * 0.62)}v${n1(r * 1.35)}" stroke="${p.light}" stroke-width="1.1" opacity=".7"/>`;
    }),

    lily: makeFlower((p, cy, r) => {
      /* 백합 — 길쭉한 꽃잎 여섯 장이 별처럼. 안쪽에 수술 */
      const petal = i => {
        const a = (i * 60) * Math.PI / 180;
        return `<ellipse cx="${n1(28 + Math.sin(a) * r * 0.62)}" cy="${n1(cy - Math.cos(a) * r * 0.62)}"
                  rx="${n1(r * 0.34)}" ry="${n1(r * 0.86)}" fill="${p.body}"
                  transform="rotate(${i * 60} ${n1(28 + Math.sin(a) * r * 0.62)} ${n1(cy - Math.cos(a) * r * 0.62)})"/>`;
      };
      return `
        ${[0,1,2,3,4,5].map(petal).join("")}
        <circle cx="28" cy="${n1(cy)}" r="${n1(r * 0.3)}" fill="${p.dark}" opacity=".5"/>
        <path d="M28 ${n1(cy)}l-${n1(r * 0.3)} -${n1(r * 0.5)}M28 ${n1(cy)}l${n1(r * 0.3)} -${n1(r * 0.5)}"
              stroke="#C99A2E" stroke-width="1" stroke-linecap="round"/>`;
    }),

    chrysanth: makeFlower((p, cy, r) => {
      /* 국화 — 가는 꽃잎이 아주 많이. 열두 장을 돌려 붙입니다 */
      const petal = i => {
        const a = i * 30;
        return `<ellipse cx="28" cy="${n1(cy - r * 0.66)}" rx="${n1(r * 0.2)}" ry="${n1(r * 0.66)}"
                  fill="${i % 2 ? p.light : p.body}"
                  transform="rotate(${a} 28 ${n1(cy)})"/>`;
      };
      return `
        ${Array.from({length: 12}, (_, i) => petal(i)).join("")}
        <circle cx="28" cy="${n1(cy)}" r="${n1(r * 0.32)}" fill="${p.dark}"/>`;
    }),

    hydrangea: makeFlower((p, cy, r) => {
      /* 수국 — 작은 꽃이 뭉쳐 공이 됩니다. 알갱이를 흩뿌려요 */
      const pts = [[0,-0.62],[-0.58,-0.28],[0.58,-0.28],[-0.36,0.34],[0.36,0.34],[0,0.06],[0,0.72]];
      return `
        <circle cx="28" cy="${n1(cy)}" r="${n1(r * 0.96)}" fill="${p.pale}" opacity=".6"/>
        ${pts.map(([dx, dy], i) => `
          <circle cx="${n1(28 + dx * r)}" cy="${n1(cy + dy * r)}" r="${n1(r * 0.3)}"
                  fill="${i % 2 ? p.light : p.body}"/>`).join("")}`;
    }),

    sunflower: makeFlower((p, cy, r) => {
      /* 해바라기 — 넓은 꽃잎 열두 장에 크고 진한 씨앗판 */
      const petal = i => `<ellipse cx="28" cy="${n1(cy - r * 0.78)}" rx="${n1(r * 0.26)}" ry="${n1(r * 0.56)}"
                            fill="${p.body}" transform="rotate(${i * 30} 28 ${n1(cy)})"/>`;
      return `
        ${Array.from({length: 12}, (_, i) => petal(i)).join("")}
        <circle cx="28" cy="${n1(cy)}" r="${n1(r * 0.52)}" fill="#6B4A22"/>
        <circle cx="28" cy="${n1(cy)}" r="${n1(r * 0.34)}" fill="#4E361A"/>`;
    }),

    berry(g) {
      /* 열매 — 꽃이 아니라 가지에 알맹이가 달립니다.
         꽃 무리와 같은 줄기·잎을 쓰되, 위에 열매를 답니다. */
      const { p, t, lv } = g;
      const st = plantStage(lv);
      const cy = st === "sprout" ? 34 : lerp(27, 22, t);
      const br = lerp(3, 4.4, t);
      const topY = st === "sprout" ? 38 : cy + br;
      const one = (dx, dy, scale) => `
        <circle cx="${n1(28 + dx)}" cy="${n1(cy + dy)}" r="${n1(br * scale)}" fill="${p.body}"/>
        <circle cx="${n1(28 + dx - br * scale * 0.3)}" cy="${n1(cy + dy - br * scale * 0.3)}" r="${n1(br * scale * 0.26)}" fill="${p.pale}" opacity=".8"/>`;
      return `
        ${plantBase(lv, t, topY)}
        ${st === "sprout" || st === "leaf" ? "" :
          st === "bud" ? one(0, 0, 0.72)
                       : one(-br * 0.95, 1, 1) + one(br * 0.95, 1, 1) + one(0, -br * 0.85, 1)}`;
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
      /* 돌멩이 — 다시 그렸습니다.

         [무엇이 달라졌나]
         예전엔 윤곽이 흐물흐물해서 감자처럼 보였습니다. 캡쳐로 보여주신
         돌은 **모난 면이 각각 다른 밝기로 나뉜** 모습이었어요.
         돌은 곡선이 아니라 **면**으로 읽힙니다.

         그래서 바깥을 각지게 깎고, 안쪽에 밝은 면과 어두운 면을 나눠
         넣었습니다. 위쪽 모서리에 흰 반짝임도 하나 얹었어요. */
      const { p, t, lv } = g;
      const s = lerp(0.86, 1, t);
      /* ★ 좌표 도우미는 **문자열**을 돌려줍니다 (n1 이 toFixed 라서요).
         그래서 이 값을 다시 계산에 쓰면 안 됩니다 — `+` 가 더하기가
         아니라 이어붙이기가 되어 "35.02.2" 같은 게 나옵니다.
         실제로 face() 에 넘겼다가 NaN 이 됐습니다.
         계산에 쓸 값은 숫자 그대로 두고, 그릴 때만 n1 을 붙입니다. */
      const sxN = v => 28 + v * s;            // 가로 (숫자)
      const syN = v => 40 + v * s;            // 세로 (숫자)
      const S = v => n1(sxN(v));              // 가로 (그리기용)
      const Y = v => n1(syN(v));              // 세로 (그리기용)
      return `
        <!-- 그림자 -->
        <ellipse cx="28" cy="${Y(4)}" rx="${n1(15 * s)}" ry="${n1(2.6 * s)}" fill="${p.dark}" opacity=".22"/>

        <!-- 바깥 — 모난 육각. 각 꼭짓점을 서로 다른 각도로 둬야
             "깎인 돌"로 보입니다. 좌우가 대칭이면 공깃돌이 돼요. -->
        <path d="M${S(-14)} ${Y(1)}L${S(-10)} ${Y(-11)}L${S(-1)} ${Y(-16)}
                 L${S(10)} ${Y(-12)}L${S(15)} ${Y(-2)}L${S(9)} ${Y(4)}
                 L${S(-6)} ${Y(5)}Z" fill="${p.body}"/>

        <!-- 밝은 면 — 빛이 드는 왼쪽 위 -->
        <path d="M${S(-10)} ${Y(-11)}L${S(-1)} ${Y(-16)}L${S(2)} ${Y(-6)}
                 L${S(-9)} ${Y(-3)}Z" fill="${p.light}"/>

        <!-- 어두운 면 — 오른쪽 아래 -->
        <path d="M${S(2)} ${Y(-6)}L${S(10)} ${Y(-12)}L${S(15)} ${Y(-2)}
                 L${S(9)} ${Y(4)}Z" fill="${p.line}"/>

        <!-- 면과 면 사이 금 -->
        <path d="M${S(2)} ${Y(-6)}L${S(-9)} ${Y(-3)}M${S(2)} ${Y(-6)}L${S(9)} ${Y(4)}"
              stroke="${p.dark}" stroke-width=".9" opacity=".35"/>

        ${lv >= AT_MARK ? `<path d="M${S(-6)} ${Y(0)}l${n1(4 * s)} ${n1(2 * s)}M${S(4)} ${Y(-10)}l${n1(3 * s)} ${n1(2 * s)}"
                               stroke="${p.dark}" stroke-width=".8" opacity=".3" stroke-linecap="round"/>` : ""}

        <!-- 반짝임 -->
        <path d="M${S(-4)} ${Y(-13)}l${n1(2.5 * s)} -${n1(1 * s)}" stroke="#FFFFFF" stroke-width="1.4"
              opacity=".7" stroke-linecap="round"/>

        <!-- 이끼 — 자라면서 붙습니다 -->
        ${lv >= AT_TAIL ? `<path d="M${S(-11)} ${Y(-9)}q-4 -6 2 -7 3 3 1 7z" fill="#97C459"/>` : ""}
        ${lv >= AT_WING ? `<path d="M${S(9)} ${Y(-11)}q5 -5 7 1 -3 3 -7 -1z" fill="#B4D686"/>` : ""}
        ${face(28, syN(-5), 5.8, p, true)}`;
    },

/* ── 선물 상자에서 나오는 무리 (2차) ────────────────────────── */

    rainbow(g) {
      /* 무지개 — 겹친 반원 띠.
         띠를 밖에서 안으로 그려야 색이 제대로 겹칩니다.
         (안쪽부터 그리면 나중 띠가 앞의 것을 덮어버립니다) */
      const { p, t, lv } = g;
      const cy = 42;
      const R = lerp(15, 21, t);
      const w = lerp(3, 4, t);
      const bands = ["#E86A6A", "#F0A03C", "#F2D44C", "#6FBF6A", "#5A9BE0", "#9B72D4"];
      const shown = Math.max(3, Math.min(6, 3 + Math.round(t * 3)));
      let arcs = "";
      for (let i = 0; i < shown; i++) {
        const r = R - i * w;
        if (r < w) break;
        arcs += `<path d="M${n1(28 - r)} ${n1(cy)}a${n1(r)} ${n1(r)} 0 0 1 ${n1(r * 2)} 0"
                   stroke="${bands[i]}" stroke-width="${n1(w)}" fill="none" stroke-linecap="butt"/>`;
      }
      return `
        ${arcs}
        <!-- 구름 받침 — 무지개는 무언가에서 솟아야 그림이 됩니다 -->
        <circle cx="${n1(28 - R + w * 0.5)}" cy="${n1(cy + 1)}" r="${n1(lerp(4, 5.4, t))}" fill="#FFFFFF"/>
        <circle cx="${n1(28 - R + w * 2.2)}" cy="${n1(cy + 2)}" r="${n1(lerp(3.2, 4.2, t))}" fill="#F2F4F8"/>
        <circle cx="${n1(28 + R - w * 0.5)}" cy="${n1(cy + 1)}" r="${n1(lerp(4, 5.4, t))}" fill="#FFFFFF"/>
        <circle cx="${n1(28 + R - w * 2.2)}" cy="${n1(cy + 2)}" r="${n1(lerp(3.2, 4.2, t))}" fill="#F2F4F8"/>
        ${lv >= AT_MARK ? `<circle cx="${n1(28 - 2)}" cy="${n1(cy - R - 3)}" r="1.4" fill="#FFFFFF" opacity=".9"/>
                     <circle cx="${n1(28 + 6)}" cy="${n1(cy - R + 1)}" r="1.1" fill="#FFFFFF" opacity=".8"/>` : ""}
        ${face(28, cy - R * 0.42, lerp(5, 6.4, t), { dark: "#5B5148" }, true)}`;
    },

    moon(g) {
      /* 달 — 초승달. 큰 원에서 작은 원을 도려냅니다.

         [왜 도려내는가]
         초승달 모양을 곡선 둘로 직접 그리면 굵기가 고르지 않아
         손톱처럼 보입니다. 원 두 개를 겹쳐 빼면 어디를 봐도 두께가
         자연스러워요. 도려내기 틀은 그릴 때마다 새 id 를 씁니다 —
         도감처럼 여러 마리를 한 화면에 그릴 때 서로 물어오거든요. */
      const { p, t, lv } = g;
      const cid = `moonclip${++_clipSeq}`;
      const cx = 28, cy = 30;
      const R = lerp(11, 14.5, t);
      const bite = R * 0.82;                     // 도려낼 원의 크기
      const bx = cx + R * 0.52;                  // 도려낼 위치
      return `
        <clipPath id="${cid}">
          <path d="M${n1(cx - R - 1)} ${n1(cy - R - 1)}h${n1(R * 2 + 2)}v${n1(R * 2 + 2)}h-${n1(R * 2 + 2)}z"/>
        </clipPath>
        <mask id="${cid}m">
          <rect x="0" y="0" width="60" height="56" fill="#000"/>
          <circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(R)}" fill="#FFF"/>
          <circle cx="${n1(bx)}" cy="${n1(cy - R * 0.14)}" r="${n1(bite)}" fill="#000"/>
        </mask>
        <g mask="url(#${cid}m)">
          <circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(R)}" fill="${p.body}"/>
          ${lv >= AT_MARK ? `<circle cx="${n1(cx - R * 0.42)}" cy="${n1(cy - R * 0.3)}" r="${n1(R * 0.16)}" fill="${p.line}" opacity=".7"/>
                       <circle cx="${n1(cx - R * 0.5)}" cy="${n1(cy + R * 0.3)}" r="${n1(R * 0.11)}" fill="${p.line}" opacity=".7"/>` : ""}
        </g>
        <!-- 얼굴은 두꺼운 쪽(왼쪽)에 얹습니다 -->
        ${face(cx - R * 0.42, cy, R * 0.5, p, true)}
        ${lv >= AT_TAIL ? `<path d="M${n1(cx + R * 0.9)} ${n1(cy - R * 0.9)}l1.4 3 3 1.4 -3 1.4 -1.4 3 -1.4 -3 -3 -1.4 3 -1.4z"
                               fill="#F7E7A8"/>` : ""}
        ${lv >= AT_WING ? `<path d="M${n1(cx + R * 1.15)} ${n1(cy + R * 0.5)}l1 2.2 2.2 1 -2.2 1 -1 2.2 -1 -2.2 -2.2 -1 2.2 -1z"
                               fill="#F7E7A8" opacity=".85"/>` : ""}`;
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
