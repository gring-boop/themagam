/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_achv.js — 🏅 업적 (2026-08-11)
   ---------------------------------------------------------------------
   [무엇인가]
   출석·글자수·작업 시간·뽀모·표현을 바탕으로 저절로 붙는 배지입니다.
   접속자 명단 맨 아래, 방 전체 할 일 줄 **오른쪽**에 대표 업적 하나가
   걸리고, 누르면 위로 지금까지 딴 것이 쭉 펼쳐집니다.

   [왜 랭킹이 아니라 업적인가]
   랭킹은 "누가 위인가"를 묻습니다. 18명이면 열 명 넘게가 매일 아래를
   확인하게 되고, 그건 방을 떠나는 이유가 돼요. 글자수 화면에서 사람별
   막대를 걷어낸 것도 같은 이유였습니다(script_wordcount.js 머리말).

   업적은 "내가 무엇을 해냈나"를 묻습니다. 퇴고만 석 달 하는 사람도
   자기 궤도에서 딸 것이 있어야 해서, 글자수가 늘지 않는 작업(퇴고 장인·
   팔방미인)도 일부러 넣었습니다.

   [누가 계산하나 — 각자의 브라우저]
   서버에서 돌려줄 방법이 없습니다(무료 요금제라 Cloud Functions 가
   없어요). 그래서 **각자 자기 것만** 계산합니다. 마침 작업 시간과 뽀모는
   본인만 읽을 수 있게 잠겨 있어서, 이 방식이라야 남의 잠긴 자료를
   건드리지 않고도 셀 수 있습니다.

   딴 결과만 공개 칸에 올립니다:

       achv/{필명} = {
         got:  { 업적id: 딴시각 },     ← 무엇을 땄나
         pick: "업적id",                ← 대표로 걸어둔 것 (없으면 최근 것)
         c:    { greet: 12, chat: 340 } ← 오늘부터 세는 것들
       }

   ★ 여기에는 **결과만** 올라갑니다. 몇 시간 일했는지, 몇 자 썼는지는
     올라가지 않아요. 남이 보는 건 "이 사람이 딴 배지" 뿐입니다.

   [소급되는 것과 오늘부터인 것]
   출석·글자수·뽀모·작업 시간은 서버에 날짜별로 쌓여 있어서 **지난 것까지
   소급**됩니다. 반대로 스티커·채팅·대숲은 여태 세지 않았으므로 **오늘부터**
   0 에서 시작해요. 이걸 숨기면 "왜 난 안 뜨지" 가 되니 목록에 적어 둡니다.

   [훑는 양]
   attendance 와 wordlog 은 날짜별로 방 전체가 한 칸에 들어 있어서, 통째로
   받으면 사람이 늘수록 무거워집니다. 그래서 **최근 200일만**, 그리고
   **날짜가 바뀐 날 한 번만** 훑습니다. 결과는 이 기기에 적어 둬요.
   ===================================================================== */
(function () {
  "use strict";

  const SCAN_DAYS = 200;              // 훑을 날짜 수 (약 반년)
  const CACHE_KEY = "achvScanDay";    // 마지막으로 훑은 날

  const el = (id) => document.getElementById(id);
  const esc = (s) => (window.escapeHtml ? window.escapeHtml(String(s ?? "")) : String(s ?? ""));

  function me() {
    try { if (typeof myNick === "string" && myNick) return myNick; } catch (e) {}
    return window.myNick || "";
  }
  function dayKey(d) {
    d = d || new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${dd}`;
  }

  /* =====================================================================
     업적 목록
     ---------------------------------------------------------------------
     n  : 목표 숫자 (달성 정도를 막대로 보여줄 때 씁니다)
     at : 어떤 값으로 재는가 — 아래 stats() 가 만드는 이름
     new: true 면 "오늘부터 세는 것" (소급되지 않음)
     rep: 되풀이되는 업적이면, **몇 번 해냈나**를 담은 값의 이름

     [되풀이 — 2026-08-11 추가]
     "하루 1만 자" 같은 것은 한 번 따고 끝날 일이 아닙니다. 두 번째,
     열 번째가 더 대단해요. 그래서 그런 업적에는 rep 를 달아 **×12** 처럼
     횟수를 함께 보여줍니다.

     ★ 되풀이를 셀 수 있는 것과 없는 것이 갈립니다.
       · 셀 수 있다 — "그날 1만 자를 넘겼나" 처럼 **하루하루 따로 판정**되는 것
       · 셀 수 없다 — "누적 10만 자", "출석 100일" 처럼 **한 번뿐**인 것
       움직이는 이레로 재는 "한 주 3만"도 뺐습니다. 이레를 하루씩 밀며
       세면 한 번 잘 쓴 주가 일곱 번으로 부풀거든요.
     ===================================================================== */
  const ACHV = [
    /* ── 출석 ─────────────────────────────────────────────── */
    { id: "att1",    g: "출석", icon: "👣", label: "첫 발자국",     at: "attTotal",   n: 1,   desc: "작업실에 처음 들어온 날" },
    { id: "att3",    g: "출석", icon: "🌱", label: "사흘 연속",     at: "attStreak",  n: 3,   desc: "사흘 내리 출석" },
    { id: "att7",    g: "출석", icon: "🌿", label: "일주일 개근",   at: "attStreak",  n: 7,   desc: "이레 내리 출석" },
    { id: "att14",   g: "출석", icon: "🌳", label: "2주 연속",      at: "attStreak",  n: 14,  desc: "열나흘 내리 출석" },
    { id: "att30",   g: "출석", icon: "🏞", label: "한 달 개근",    at: "attStreak",  n: 30,  desc: "서른 날 내리 출석" },
    { id: "att100",  g: "출석", icon: "💯", label: "백일",          at: "attTotal",   n: 100, desc: "모두 100일 출석" },
    { id: "dawn10",  g: "출석", icon: "🌙", label: "새벽반",        at: "dawnDays",   n: 10,  desc: "0~6시에 들어온 날 10일" },
    { id: "wknd8",   g: "출석", icon: "🛋", label: "주말 지킴이",   at: "weekendDays",n: 8,   desc: "주말 출석 8일" },

    /* ── 글자수 ───────────────────────────────────────────── */
    { id: "wc1k",    g: "글자수", icon: "✏️", label: "첫 천 자",     at: "wcBestDay",  n: 1000,    desc: "하루에 1,000자" },
    { id: "wc1m",    g: "글자수", icon: "📄", label: "1만 자",       at: "wcTotal",    n: 10000,   desc: "누적 1만 자" },
    { id: "wc10m",   g: "글자수", icon: "📚", label: "10만 자",      at: "wcTotal",    n: 100000,  desc: "누적 10만 자" },
    { id: "wc50m",   g: "글자수", icon: "🗂", label: "50만 자",      at: "wcTotal",    n: 500000,  desc: "누적 50만 자" },
    { id: "wc100m",  g: "글자수", icon: "🏛", label: "100만 자",     at: "wcTotal",    n: 1000000, desc: "누적 100만 자" },
    { id: "wcd5k",   g: "글자수", icon: "🔥", label: "하루 5천",     at: "wcBestDay",  n: 5000,    rep: "wcDays5k",  desc: "하루에 5,000자" },
    { id: "wcd10k",  g: "글자수", icon: "🌋", label: "폭주",         at: "wcBestDay",  n: 10000,   rep: "wcDays10k", desc: "하루에 10,000자" },
    { id: "wc7d",    g: "글자수", icon: "🪄", label: "이레 내리",    at: "wcStreak",   n: 7,       desc: "이레 연속 기록" },
    { id: "wcw3m",   g: "글자수", icon: "🚀", label: "한 주 3만",    at: "wcBestWeek", n: 30000,   desc: "한 주에 30,000자" },
    /* 작가들 사이의 우스갯소리 — "하루 5천 자만 꾸준히 쓰면 글먹 된다".
       하루 잘 쓴 것보다 **이레를 내리** 지킨 쪽이 훨씬 어렵습니다. */
    { id: "burst7",  g: "글자수", icon: "💥", label: "성실 폭발",    at: "sincereBursts", n: 1, rep: "sincereBursts",
      desc: "이레 내리 하루 5,000자 이상" },

    /* ── 작업 시간 ────────────────────────────────────────── */
    { id: "run3h",   g: "작업 시간", icon: "🎯", label: "집중왕",    at: "bestSeg",  n: 3 * 3600e3,  rep: "seg3hCount", desc: "한 번에 3시간" },
    { id: "run5h",   g: "작업 시간", icon: "🧿", label: "초집중왕",  at: "bestSeg",  n: 5 * 3600e3,  desc: "한 번에 5시간" },
    { id: "day8h",   g: "작업 시간", icon: "⛰", label: "하루 8시간", at: "bestDayMs", n: 8 * 3600e3, rep: "day8hCount", desc: "하루에 8시간" },
    { id: "t100h",   g: "작업 시간", icon: "⏳", label: "100시간",   at: "msTotal",  n: 100 * 3600e3, desc: "누적 100시간" },
    { id: "t500h",   g: "작업 시간", icon: "🗿", label: "500시간",   at: "msTotal",  n: 500 * 3600e3, desc: "누적 500시간" },
    { id: "owl10",   g: "작업 시간", icon: "🦉", label: "올빼미",    at: "owlDays",  n: 10, desc: "자정~새벽에 작업한 날 10일" },
    { id: "lark10",  g: "작업 시간", icon: "🐓", label: "아침형",    at: "larkDays", n: 10, desc: "6~9시에 작업한 날 10일" },

    /* ── 뽀모 ─────────────────────────────────────────────── */
    { id: "pom1",    g: "뽀모", icon: "🍅", label: "첫 토마토",     at: "pomoTotal",   n: 1,   desc: "집중 1회" },
    { id: "pomd8",   g: "뽀모", icon: "🧺", label: "하루 여덟 알",  at: "pomoBestDay", n: 8,   rep: "pomoDay8Count", desc: "하루에 8회" },
    { id: "pom100",  g: "뽀모", icon: "🥫", label: "100알",         at: "pomoTotal",   n: 100, desc: "누적 100회" },
    { id: "pom500",  g: "뽀모", icon: "🏺", label: "500알",         at: "pomoTotal",   n: 500, desc: "누적 500회" },
    { id: "pom7d",   g: "뽀모", icon: "🧭", label: "이레 연속 뽀모", at: "pomoStreak", n: 7,   desc: "이레 내리 집중" },
    /* 🌾 토마토 수확왕 — 성실 폭발의 뽀모판입니다.
       하루 열 알이면 250분, 네 시간이 넘는 집중이에요. 그걸 이레 내리
       지킨 것이라 "왕" 을 붙일 만합니다. 세는 방식도 성실 폭발과 같게
       맞췄어요 — 열나흘이면 ×2 입니다. */
    { id: "harv7",   g: "뽀모", icon: "🌾", label: "토마토 수확왕", at: "tomatoBursts", n: 1, rep: "tomatoBursts",
      desc: "이레 내리 하루 10알 이상" },

    /* ── 표현 (오늘부터) ──────────────────────────────────── */
    { id: "greet50", g: "표현", icon: "👋", label: "인사왕",        at: "cGreet",   n: 50,   new: true, desc: "방가·리하이 50번" },
    { id: "pat30",   g: "표현", icon: "🫶", label: "토닥이",        at: "cPat",     n: 30,   new: true, desc: "토닥토닥 30번" },
    { id: "chat1k",  g: "표현", icon: "💬", label: "수다왕",        at: "cChat",    n: 1000, new: true, desc: "채팅 1,000줄" },
    { id: "stkall",  g: "표현", icon: "🖍", label: "스티커 수집가",  at: "cStkKind", n: 20,   new: true, desc: "스무 종을 모두 한 번씩" },
    { id: "forest10",g: "표현", icon: "🎋", label: "대숲지기",      at: "cForest",  n: 10,   new: true, desc: "대숲에 10번" },

    /* ── 작업의 결 ────────────────────────────────────────── */
    /* ★ id 는 rew30 그대로 둡니다. 이름표(label)만 바꿔요 —
       id 를 바꾸면 이미 딴 사람의 배지가 목록에서 사라집니다
       (achv/{필명}/got 에 옛 id 로 적혀 있으니까요). */
    { id: "rew30",   g: "작업의 결", icon: "🪵", label: "퇴고 장인",  at: "cRewrite", n: 30, new: true,
      desc: "퇴고 스티커로 30일 — 방망이 깎는 노인의 마음으로" },
    { id: "tagall",  g: "작업의 결", icon: "🎨", label: "팔방미인",  at: "cTagKind", n: 8,  new: true, desc: "작업 스티커 여덟 종을 모두" },
    { id: "todo100", g: "작업의 결", icon: "✅", label: "마감러",    at: "cTodo",    n: 100, new: true, desc: "할 일 100개 완료" },
    { id: "rout30",  g: "작업의 결", icon: "🔁", label: "루틴킹",    at: "cRoutine", n: 30, new: true, desc: "루틴을 30일 채움" }
  ];

  const GROUPS = ["출석", "글자수", "작업 시간", "뽀모", "표현", "작업의 결"];
  const byId = (id) => ACHV.find(a => a.id === id) || null;

  /* 지금까지 딴 것 · 대표 · 세어둔 값 */
  let _got  = {};
  let _rep  = {};        // { 업적id: 몇 번 해냈나 } — 되풀이되는 것만
  let _pick = "";
  let _c    = {};
  let _stats = null;
  let _open = false;
  let _busy = false;

  /* =====================================================================
     세어둔 값 올리기 — 다른 파일들이 부릅니다.

       window.achvBump("greet")        1 올리기
       window.achvBump("stk", "hi")    "본 적 있는 것" 목록에 넣기

     ★ 여기서 곧바로 서버에 쓰지 않습니다. 채팅 한 줄마다 쓰기가 날아가면
       요금과 속도가 함께 나빠져요. 값은 이 기기에 모아 뒀다가
       10초에 한 번, 그리고 창을 닫을 때 한 번 올립니다.
     ===================================================================== */
  let _dirty = false;

  window.achvBump = function (key, member) {
    try {
      if (!me()) return;
      if (member === undefined) {
        _c[key] = (Number(_c[key]) || 0) + 1;
      } else {
        /* 종류를 세는 것 — 같은 것을 여러 번 써도 하나로 봅니다 */
        const k = key + "_" + String(member).replace(/[.#$/[\]]/g, "");
        if (_c[k]) return;
        _c[k] = 1;
      }
      _dirty = true;
      evaluate();            // 방금 넘겼을 수도 있으니 그 자리에서 확인
    } catch (e) {}
  };

  /* 종류 세기 — cStkKind 처럼 "몇 가지를 써봤나" */
  function kindCount(prefix) {
    return Object.keys(_c).filter(k => k.startsWith(prefix + "_")).length;
  }

  /* =====================================================================
     서버에서 훑기
     ---------------------------------------------------------------------
     ★ 날짜가 바뀌지 않았으면 다시 훑지 않습니다. 방 인원이 늘수록
       attendance·wordlog 한 칸이 커지므로, 접속할 때마다 받으면 낭비예요.
     ===================================================================== */
  async function scan(force) {
    const nick = me();
    if (!nick || !window.db) return null;

    const today = dayKey();
    if (!force && window.AppStore?.getItem(CACHE_KEY) === today && _stats) return _stats;

    const [attSnap, wcSnap, meSnap] = await Promise.all([
      window.db.ref("attendance").orderByKey().limitToLast(SCAN_DAYS).once("value"),
      window.db.ref("wordlog").orderByKey().limitToLast(SCAN_DAYS).once("value"),
      /* 잠긴 칸 — 내 것이라 읽힙니다 */
      window.db.ref(`users/${nick}`).once("value")
    ]);

    const att = attSnap.val() || {};
    const wcs = wcSnap.val() || {};
    const mine = meSnap.val() || {};

    _stats = computeStats({
      att, wcs,
      pomo: mine.pomoSessions || {},
      segs: mine.timeSegs || {},
      nick
    });
    window.AppStore?.setItem(CACHE_KEY, today);
    return _stats;
  }

  /* =====================================================================
     숫자 만들기 — 여기가 업적의 심장입니다.

     ★ 연속(streak)은 **오늘 또는 어제**에서 거꾸로 세야 합니다.
       오늘부터만 세면, 아직 안 들어온 아침에 연속이 0 으로 뚝 떨어져서
       어제까지 29일을 채운 사람이 "한 달 개근"을 코앞에서 잃습니다.
     ===================================================================== */
  function computeStats(src) {
    const { att, wcs, pomo, segs, nick } = src;

    /* ── 출석 ── */
    const attDays = Object.keys(att).filter(d => att[d] && att[d][nick]).sort();
    const attSet = new Set(attDays);

    let dawnDays = 0, weekendDays = 0;
    attDays.forEach(d => {
      const row = att[d][nick] || {};
      const t = Number(row.firstAt || row.at || 0);
      if (t) {
        const h = new Date(t).getHours();
        if (h < 6) dawnDays++;
      }
      const wd = new Date(d + "T12:00:00").getDay();
      if (wd === 0 || wd === 6) weekendDays++;
    });

    /* ── 글자수 ── */
    const wcDay = {};
    Object.keys(wcs).forEach(d => {
      const v = Number(wcs[d]?.[nick]?.total || 0);
      if (v > 0) wcDay[d] = v;
    });
    const wcDays = Object.keys(wcDay).sort();
    const wcTotal = wcDays.reduce((a, d) => a + wcDay[d], 0);
    const wcBestDay = wcDays.reduce((a, d) => Math.max(a, wcDay[d]), 0);
    const wcDays5k  = wcDays.filter(d => wcDay[d] >= 5000).length;
    const wcDays10k = wcDays.filter(d => wcDay[d] >= 10000).length;

    /* 💥 성실 폭발 — "이레 내리 하루 5,000자 이상".

       ★ 이레마다 새로 셉니다. 열나흘을 내리 지켰으면 2회예요.
         "7일 넘긴 구간 하나 = 1회" 로 하면 서른 날을 지킨 사람과
         이레만 지킨 사람이 같아집니다. 계속할 이유가 있어야 해요.

       ★ 중간에 하루라도 5,000자 아래면 거기서 끊고 처음부터 다시 셉니다
         (연달아 이레여야 하니까요). 기록이 아예 없는 날도 끊긴 것입니다. */
    let sincereBursts = 0, sincereRun = 0, _run = 0;
    if (wcDays.length) {
      const from = new Date(wcDays[0] + "T12:00:00");
      const to = new Date();
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        if ((wcDay[dayKey(d)] || 0) >= 5000) {
          _run++;
          if (_run > sincereRun) sincereRun = _run;
          if (_run % 7 === 0) sincereBursts++;
        } else {
          _run = 0;
        }
      }
    }

    /* 어느 이레를 잘라도 가장 많았던 합 (달력 주가 아니라 움직이는 이레) */
    let wcBestWeek = 0;
    if (wcDays.length) {
      const first = new Date(wcDays[0] + "T12:00:00");
      const last = new Date(wcDays[wcDays.length - 1] + "T12:00:00");
      for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
        let sum = 0;
        for (let i = 0; i < 7; i++) {
          const x = new Date(d);
          x.setDate(d.getDate() + i);
          sum += wcDay[dayKey(x)] || 0;
        }
        if (sum > wcBestWeek) wcBestWeek = sum;
      }
    }

    /* ── 뽀모 ── */
    const pomoDay = {};
    Object.keys(pomo).forEach(d => {
      const v = Number(pomo[d]?.count || 0);
      if (v > 0) pomoDay[d] = v;
    });
    const pomoTotal = Object.values(pomoDay).reduce((a, b) => a + b, 0);
    const pomoBestDay = Object.values(pomoDay).reduce((a, b) => Math.max(a, b), 0);
    const pomoDay8Count = Object.values(pomoDay).filter(v => v >= 8).length;

    /* 🌾 토마토 수확왕 — 이레 내리 하루 10알 이상.
       ★ 성실 폭발과 **같은 방식**으로 셉니다(이레마다 새로). 두 업적이
         다르게 세면 "왜 저건 2회고 이건 1회지?" 가 되니까요.
       ★ 뽀모를 아예 안 돌린 날도 끊긴 것입니다 — pomoDay 에 그 날짜가
         없으므로 0 으로 읽혀 자연히 끊깁니다. */
    let tomatoBursts = 0, tomatoRun = 0, _tRun = 0;
    const pomoKeys = Object.keys(pomoDay).sort();
    if (pomoKeys.length) {
      const pFrom = new Date(pomoKeys[0] + "T12:00:00");
      const pTo = new Date();
      for (let d = new Date(pFrom); d <= pTo; d.setDate(d.getDate() + 1)) {
        if ((pomoDay[dayKey(d)] || 0) >= 10) {
          _tRun++;
          if (_tRun > tomatoRun) tomatoRun = _tRun;
          if (_tRun % 7 === 0) tomatoBursts++;
        } else {
          _tRun = 0;
        }
      }
    }

    /* ── 작업 시간 ──
       timeSegs/{날짜} 는 { s(상태), a(시작), b(끝) } 들입니다.
       ⏱️ 작업 시간 화면과 같은 기준으로 writing·focus 만 셉니다. */
    let msTotal = 0, bestSeg = 0, bestDayMs = 0, owlDays = 0, larkDays = 0;
    let seg3hCount = 0, day8hCount = 0;
    Object.keys(segs).forEach(d => {
      let dayMs = 0, owl = false, lark = false;
      Object.values(segs[d] || {}).forEach(seg => {
        if (!seg) return;
        if (seg.s !== "writing" && seg.s !== "focus") return;
        const len = Math.max(0, Number(seg.b || 0) - Number(seg.a || 0));
        dayMs += len;
        if (len >= 3 * 3600e3) seg3hCount++;
        if (len > bestSeg) bestSeg = len;
        const h = new Date(Number(seg.a || 0)).getHours();
        if (h < 5) owl = true;
        if (h >= 6 && h < 9) lark = true;
      });
      msTotal += dayMs;
      if (dayMs >= 8 * 3600e3) day8hCount++;
      if (dayMs > bestDayMs) bestDayMs = dayMs;
      if (owl) owlDays++;
      if (lark) larkDays++;
    });

    return {
      attTotal: attDays.length,
      attStreak: streak(attSet),
      dawnDays, weekendDays,
      wcTotal, wcBestDay, wcBestWeek, wcDays5k, wcDays10k,
      sincereBursts, sincereRun,
      wcStreak: streak(new Set(wcDays)),
      pomoTotal, pomoBestDay, pomoDay8Count, tomatoBursts, tomatoRun,
      pomoStreak: streak(new Set(Object.keys(pomoDay))),
      msTotal, bestSeg, bestDayMs, owlDays, larkDays, seg3hCount, day8hCount
    };
  }

  /** 오늘(없으면 어제)에서 거꾸로 이어진 날 수 */
  function streak(daySet) {
    const start = new Date();
    if (!daySet.has(dayKey(start))) {
      start.setDate(start.getDate() - 1);
      if (!daySet.has(dayKey(start))) return 0;
    }
    let n = 0;
    const d = new Date(start);
    while (daySet.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  /** 되풀이 횟수 — rep 가 없으면 1 */
  function repOf(a) {
    if (!a.rep) return 1;
    return Math.max(1, Number(_stats?.[a.rep] || 0));
  }

  /** 업적 하나의 지금 값 */
  function valueOf(a) {
    /* ★ 아래 넷은 "몇 번" 이 아니라 "몇 가지 / 며칠" 입니다.
       cRoutine 을 빠뜨리면 이름이 c 로 시작한다는 이유로 아래 줄에 걸려
       늘 0 이 나옵니다 — 루틴킹을 영영 못 땁니다. */
    if (a.at === "cStkKind") return kindCount("stk");
    if (a.at === "cTagKind") return kindCount("tag");
    if (a.at === "cRewrite") return kindCount("rew");
    if (a.at === "cRoutine") return kindCount("rout");
    if (a.at && a.at.startsWith("c")) return Number(_c[a.at] || 0);
    return Number(_stats?.[a.at] || 0);
  }

  /* =====================================================================
     판정 — 넘긴 것을 got 에 적습니다.
     ★ 한 번 딴 것은 **절대 도로 빼지 않습니다.** 연속 출석이 끊겼다고
       "일주일 개근" 이 사라지면, 그건 업적이 아니라 순위표예요.
     ===================================================================== */
  function evaluate() {
    let 새로 = [];
    ACHV.forEach(a => {
      if (_got[a.id]) {
        /* 이미 딴 것이라도 **횟수는 늘 수 있습니다.**
           ★ 늘었을 때만 알립니다. 매번 알리면 새로고침마다 뜹니다. */
        if (a.rep) {
          const n = repOf(a);
          if (n > (Number(_rep[a.id]) || 1)) {
            _rep[a.id] = n;
            _dirty = true;
            toast(a, n);
          } else if (_rep[a.id] !== n) {
            _rep[a.id] = n;
            _dirty = true;
          }
        }
        return;
      }
      if (valueOf(a) >= a.n) {
        _got[a.id] = Date.now();
        if (a.rep) _rep[a.id] = repOf(a);
        새로.push(a);
      }
    });
    if (새로.length) { _dirty = true; 새로.forEach(a => toast(a, repOf(a))); }
    paint();
    return 새로;
  }

  /* 딴 순간 — 내 화면에만 조용히. 18명이 따는 것을 다 채팅에 흘리면
     금방 시끄러워집니다. */
  function toast(a, n) {
    const box = document.createElement("div");
    box.className = "achv-toast";
    const 횟수 = Number(n) > 1 ? ` <span class="achv-x">×${Number(n)}</span>` : "";
    box.innerHTML = `<span class="achv-ic">${a.icon}</span>
      <span><b>${esc(a.label)}</b>${횟수}<br><small>${esc(a.desc)}</small></span>`;
    document.body.appendChild(box);
    setTimeout(() => box.classList.add("go"), 20);
    setTimeout(() => box.remove(), 5200);
  }

  /* =====================================================================
     서버에 올리기 — 결과만. 몇 자·몇 시간은 올라가지 않습니다.
     ===================================================================== */
  async function save() {
    if (!_dirty || !me() || !window.db) return;
    _dirty = false;
    try {
      await window.db.ref(`achv/${me()}`).update({ got: _got, rep: _rep, pick: _pick || "", c: _c });
    } catch (e) { console.warn("[업적] 저장 실패", e); }
  }
  setInterval(save, 10000);
  window.addEventListener("pagehide", () => { try { save(); } catch (e) {} });

  /* =====================================================================
     대표 업적 — 고정한 것이 있으면 그것, 없으면 가장 최근에 딴 것
     ===================================================================== */
  function repAchv() {
    if (_pick && _got[_pick]) return byId(_pick);
    let best = null, bestT = -1;
    Object.keys(_got).forEach(id => {
      const t = Number(_got[id] || 0);
      if (t > bestT && byId(id)) { bestT = t; best = byId(id); }
    });
    return best;
  }

  /* =====================================================================
     그리기 — 알약 하나 + 위로 펼쳐지는 판
     ===================================================================== */
  function paint() {
    const pill = el("achv-pill");
    if (!pill) return;
    const a = repAchv();
    const n = Object.keys(_got).length;

    pill.hidden = false;
    pill.innerHTML = a
      ? `<span class="achv-ic">${a.icon}</span><span class="achv-nm">${esc(a.label)}${
            a.rep && repOf(a) > 1 ? ` ×${repOf(a)}` : ""}</span><span class="achv-n">${n}</span>`
      : `<span class="achv-ic">🏅</span><span class="achv-nm">업적</span>`;
    pill.setAttribute("aria-expanded", _open ? "true" : "false");
    if (_open) renderPanel();
  }

  function rowHtml(a) {
    const has = !!_got[a.id];
    const v = valueOf(a);
    const pct = Math.max(0, Math.min(100, Math.round((v / a.n) * 100)));
    return `
      <li class="achv-row${has ? " is-got" : ""}${_pick === a.id ? " is-pick" : ""}"
          ${has ? `data-pick="${esc(a.id)}" role="button" tabindex="0" title="대표로 걸기"` : ""}>
        <span class="achv-ic">${has ? a.icon : "🔒"}</span>
        <span class="achv-t">
          <b>${esc(a.label)}</b>${has && a.rep && repOf(a) > 1
            ? ` <span class="achv-x">×${repOf(a)}</span>` : ""}
          <small>${esc(a.desc)}${a.rep ? " · 되풀이" : ""}${a.new ? " · 오늘부터 셈" : ""}</small>
          ${has ? "" : `<span class="achv-bar"><i style="width:${pct}%"></i></span>`}
        </span>
        ${has ? `<span class="achv-ok">✓</span>` : `<span class="achv-p">${pct}%</span>`}
      </li>`;
  }

  function renderPanel() {
    const box = el("achv-panel");
    if (!box) return;
    const n = Object.keys(_got).length;
    box.innerHTML = `
      <div class="achv-head">
        <b>🏅 나의 업적</b>
        <span>${n} / ${ACHV.length}</span>
      </div>
      <div class="achv-scroll">
        ${GROUPS.map(g => {
          const list = ACHV.filter(a => a.g === g);
          const done = list.filter(a => _got[a.id]).length;
          return `<div class="achv-g">${esc(g)} <small>${done}/${list.length}</small></div>
                  <ul class="achv-list">${list.map(rowHtml).join("")}</ul>`;
        }).join("")}
      </div>
      <p class="achv-foot">딴 업적을 누르면 <b>대표</b>로 걸려요. 안 고르면 가장 최근 것이 걸립니다.</p>`;
  }

  function toggle(force) {
    _open = force === undefined ? !_open : !!force;
    const box = el("achv-panel");
    if (box) box.hidden = !_open;
    paint();
  }

  /* =====================================================================
     남의 업적 — 카드의 **프사**를 누르면 열립니다.
     (닉네임 칸은 그대로 📮 쪽지예요)
     ★ 여기서는 딴 것만 보여줍니다. 못 딴 것의 달성률까지 보이면
       "쟤는 몇 %네" 가 되어 결국 순위표가 됩니다.
     ===================================================================== */
  async function openOther(nick) {
    const modal = el("achv-other");
    if (!modal || !nick) return;
    const body = el("achv-other-body");
    el("achv-other-title").textContent = `${nick} 님의 업적`;
    body.innerHTML = `<p class="achv-empty">불러오는 중…</p>`;
    modal.style.display = "flex";
    try {
      const snap = await window.db.ref(`achv/${nick}`).once("value");
      const v = snap.val() || {};
      const got = v.got || {};
      const rep = v.rep || {};
      const list = Object.keys(got).map(byId).filter(Boolean)
        .sort((a, b) => Number(got[b.id]) - Number(got[a.id]));
      body.innerHTML = list.length
        ? `<ul class="achv-list">${list.map(a => `
            <li class="achv-row is-got">
              <span class="achv-ic">${a.icon}</span>
              <span class="achv-t"><b>${esc(a.label)}</b>${Number(rep[a.id]) > 1
                ? ` <span class="achv-x">×${Number(rep[a.id])}</span>` : ""}
                <small>${esc(a.desc)}</small></span>
            </li>`).join("")}</ul>`
        : `<p class="achv-empty">아직 딴 업적이 없어요.</p>`;
    } catch (e) {
      body.innerHTML = `<p class="achv-empty">불러오지 못했어요.</p>`;
    }
  }
  function closeOther() {
    const m = el("achv-other");
    if (m) m.style.display = "none";
  }

  /* =====================================================================
     시작
     ===================================================================== */
  async function start() {
    if (_busy || !me()) return;
    _busy = true;
    try {
      const snap = await window.db.ref(`achv/${me()}`).once("value");
      const v = snap.val() || {};
      _got  = v.got  || {};
      _rep  = v.rep  || {};
      _pick = v.pick || "";
      _c    = v.c    || {};
      await scan(false);
      evaluate();
    } catch (e) {
      console.warn("[업적] 시작 실패", e);
    }
    _busy = false;
  }

  /* 손가락 — 알약과 판은 한 번만 걸어 둡니다 */
  function bind() {
    document.addEventListener("click", (e) => {
      if (e.target.closest("#achv-pill")) { toggle(); return; }

      const pickEl = e.target.closest("#achv-panel [data-pick]");
      if (pickEl) {
        const id = pickEl.getAttribute("data-pick");
        _pick = (_pick === id) ? "" : id;   // 다시 누르면 자동으로 되돌아갑니다
        _dirty = true;
        paint();
        return;
      }
      /* 판 밖을 누르면 접습니다 */
      if (_open && !e.target.closest("#achv-panel")) toggle(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (el("achv-other")?.style.display === "flex") { closeOther(); return; }
      if (_open) toggle(false);
    });
  }
  bind();

  /* 🗂️ 나의 작업 · 🏅 업적 탭이 쓰는 창구 */
  window.achvPanelHtml = function () {
    renderPanel();
    return el("achv-panel")?.innerHTML || "";
  };

  window.startAchv     = start;
  window.openAchvOf    = openOther;
  window.closeAchvOther = closeOther;
  window.achvEvaluate  = evaluate;
  window.achvRescan    = async () => { await scan(true); evaluate(); };
  /* 검사와 콘솔 확인용 */
  window.ACHV_LIST = ACHV;
})();
