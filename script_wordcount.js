/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_wordcount.js — 글자수 기록

   [세는 방식: 스냅샷 차이]
   "이번에 몇 자 썼는지"를 사람이 계산하게 하면 매번 뺄셈을 해야 하고,
   틀리기도 쉽습니다. 그래서 **지금 원고의 전체 글자수**만 적게 하고,
   직전에 적은 값과의 차이를 프로그램이 대신 계산합니다.

       1,000 적음  →  기준 1,000        (아직 누적 0)
       2,500 적음  →  +1,500 누적       (기준 2,500 으로 옮김)
       2,900 적음  →  +400 누적 (1,900) (기준 2,900)

   글자수가 줄었을 때(퇴고로 덜어냈을 때)는 누적을 깎지 않고 기준만
   옮깁니다. 덜어낸 것도 작업이니 벌을 줄 이유가 없고, 음수가 쌓이면
   숫자가 이상해집니다.

   [버튼 셋]
     ▶ 기준   — 누적은 그대로, 기준만 지금 값으로. 이어 쓸 때.
     🧹 초기화 — 오늘 누적을 0으로. 잘못 적었을 때.
     🆕 새 편  — 기준을 0으로. 빈 문서에서 시작할 때.

   [저장하는 곳]
       wordlog/{날짜}/{닉네임}   = { total, base, at }   ← 합계와 기준
       wordfeed/{날짜}/{자동}  = { nick, add, snap, at } ← 올라온 기록 하나씩

   날짜별로 나눠 담으면 "오늘"과 "이번 주"를 따로 세기 쉽고, 오래된
   것을 지우기도 편합니다. base(기준)까지 서버에 두는 이유는, 다른
   기기에서 이어 적어도 기준이 따라오게 하기 위해서입니다.

   [순위를 보여주지 않는 이유]
   처음에는 오늘 탭에 사람별 합계를 막대로 줄 세웠습니다. 그런데
   그날 많이 쓴 사람에게는 뿌듯한 화면이, 그렇지 못한 사람에게는
   위축되는 화면이 됩니다. 작가들에게는 특히요.

   그래서 오늘 탭은 **채팅처럼 흐르는 기록**으로 바꿨습니다.
   시간순으로 두 줄씩 쌓일 뿐, 누가 위인지 아래인지는 어디에도
   나오지 않습니다.

       호랑 : 800자
       [호랑님 +300자 / 전체 글자수 800자]

   윗줄은 그 사람이 적어 올린 숫자, 아랫줄은 계산 결과입니다.
   윗줄은 채팅처럼 **내 것은 오른쪽, 남의 것은 왼쪽**에 붙이고,
   아랫줄(계산 결과)은 방이 알려주는 말이라 **가운데**에 둡니다.
   순위표가 아니라 대화 기록으로 읽히게 하려는 배치예요.

   [고침 2026-08-02] 시간을 채팅처럼 말풍선 옆에 붙입니다. (요청)

   남과 견주는 화면은 '내 기록' 탭 하나뿐이고, 거기서 견주는 상대는
   지난 요일의 나입니다.
   ===================================================================== */
(function () {
  "use strict";

  const el = (id) => document.getElementById(id);

  let _tab   = "today";
  let _today = {};        // { 닉네임: {total, base} }
  let _week  = {};        // { 날짜: { 닉네임: {total} } }
  let _feed  = [];        // [{ nick, add, at }] — 오늘 올라온 것들
  let _ref   = null;
  let _feedRef = null;
  let _weekRefs = [];
  let _started = false;
  let _day     = null;    // 지금 듣고 있는 날짜 — 자정 감시에 씁니다

  /* [2026-08-06] 내 뽀모 알림 — 이 화면에만 있는 줄입니다.
     뽀모가 개인 타이머가 되면서, 남의 시작·휴식까지 여기 흐르면
     사람 수만큼 줄이 쌓여 정작 글자수 기록이 밀려납니다. 그래서
     서버(wordfeed)에 올리지 않고 이 배열에만 담아 내 화면에 그립니다.
     새로고침하면 사라집니다 — 지나간 알림이라 남길 이유가 없어요. */
  let _pomoLines = [];

  /* =====================================================================
     ✍️ 메모 · 할 일 명령 — **나만 보는 줄** (2026-08-16)
     ---------------------------------------------------------------------
     콩(방장)이 개인으로 쓰던 작업 프로그램 "콩트" 의 Work Log 를
     가져왔습니다. 숫자만 적으면 예전 그대로, 글만 적으면 메모,
     "/" 로 시작하면 할 일 명령이에요.

     [왜 나만 보나] 이 피드는 **모두가 같이 봅니다** — 서로의 글자수가
     흐르는 자리예요. 그런데 "6화 초고 시작!!!" 이나 "내일 할 일에
     담았어요" 는 혼잣말입니다. 남의 화면에 흐르면 정작 글자수 기록이
     밀려나고, 무엇보다 혼잣말을 편히 못 적게 돼요.
     그래서 서버에 올리지 않고 **이 기기에** 적습니다 — 통신량 0.

     [뽀모 알림과 다른 점] 뽀모 알림(_pomoLines)은 기억에만 두고
     새로고침하면 사라집니다. 지나간 알림이라 남길 이유가 없어서요.
     메모는 **다시 읽으려고 적는 것**이라 기기에 저장하고, 콩트와 같이
     14일치를 남깁니다.
     ===================================================================== */
  const MINE_KEY = "wcMine";        // 이 기기에만 — 서버로 안 나갑니다
  const MINE_DAYS = 14;             // 콩트와 같이 2주치
  const MINE_MAX = 400;
  let _mineLines = [];

  /* =====================================================================
     📅 지난 메모 되짚기 (2026-08-16) — ✍️ 내 메모 탭에서만
     ---------------------------------------------------------------------
     [왜 메모에만] 처음엔 오늘 탭에서도 지난 날을 볼 수 있게 했는데,
     방장 말대로 **지난 글자수를 다시 볼 이유가 없습니다.** 그건 이미
     [내 기록] 탭의 요일 그래프가 보여줘요. 되짚고 싶은 건 "그날 내가
     뭐라고 적었더라" 쪽입니다.

     [덕분에 통신량 0] 메모는 이미 이 기기에 2주치가 있습니다. 지난
     날짜를 아무리 넘겨봐도 **서버에 한 번도 묻지 않아요.** 한때는
     그날의 wordfeed 를 받아오게 해 뒀는데, 그 코드를 통째로 걷어냈습니다.
     ★ 되살리고 싶어지면 먼저 물어보세요 — 지난 날을 훑는 일은 하루치
       10KB 씩 쌓이고, 정작 잘 안 보게 됩니다.
     ===================================================================== */
  const BACK_MAX = 6;        // 오늘 포함 이레
  let _back = 0;             // 0 = 오늘, 1 = 어제 …

  function 보는날() {
    return _back === 0 ? dayKey() : dayKey(new Date(Date.now() - _back * 86400000));
  }
  function 보는날말() {
    if (_back === 0) return "오늘";
    if (_back === 1) return "어제";
    const k = 보는날(), d = new Date(k + "T00:00:00");
    return `${d.getMonth() + 1}/${d.getDate()}(${DOW_NAMES[d.getDay()]})`;
  }

  function loadMine() {
    try {
      const raw = JSON.parse(window.AppStore?.getItem(MINE_KEY) || "[]");
      const from = dayKey(new Date(Date.now() - (MINE_DAYS - 1) * 86400000));
      _mineLines = Array.isArray(raw) ? raw.filter(x => x && (x.day || "") >= from) : [];
    } catch (e) { _mineLines = []; }
  }
  function saveMine() {
    if (_mineLines.length > MINE_MAX) _mineLines = _mineLines.slice(-MINE_MAX);
    try { window.AppStore?.setItem(MINE_KEY, JSON.stringify(_mineLines)); } catch (e) {}
  }
  function addMine(kind, msg, extra) {
    _mineLines.push({ ...(extra || {}), type: "mine", kind, msg: String(msg || ""),
                      at: Date.now(), day: dayKey() });
    saveMine();
    render();
  }

  /* 뽀모도로 알림도 같은 자리에 흐르므로, 글자수 기록이 밀려나지 않게
     넉넉히 잡습니다 (하루치라 양은 크지 않습니다) */
  const FEED_MAX = 200;   // 너무 길어지지 않게 최근 것만 봅니다

  /* ---------------------------------------------------------------
     날짜 — 기기 시간 기준입니다.

     서버 시간을 쓰면 자정 근처에서 더 정확하지만, 글자수는 "내가
     오늘이라고 느끼는 하루"에 붙는 게 자연스럽습니다. 새벽 2시에 쓴
     글이 어제로 잡히면 오히려 이상해요.
     --------------------------------------------------------------- */
  function dayKey(d) {
    d = d || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  /* 이번 주 = 월요일부터 오늘까지 */
  function weekDays() {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;         // 월=0 … 일=6
    const out = [];
    for (let i = dow; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      out.push(dayKey(d));
    }
    return out;
  }

  /* =====================================================================
     [고침 2026-08-10] 주(週) 단위로 날짜 뽑기

     ★ 실제로 터진 버그입니다 — 월요일 아침에 "지난 주 기록이 싹 날아갔다".

     화면을 그리는 쪽(myWeekHtml)이 **오늘부터 거꾸로 7일**을 그렸는데,
     값을 받아오는 쪽(attach)은 **월요일부터 오늘까지**만 듣고 있었습니다.
     일요일에는 둘이 딱 맞아떨어져서 멀쩡했지만, 월요일이 되는 순간
     듣는 날짜가 하루로 줄어드는 바람에 나머지 여섯 칸이 전부 0 이 됐어요.
     서버에는 멀쩡히 있는데 화면에서만 사라진 겁니다.

     게다가 [‹ 1주 전]도 "7~13일 전"이라 요일이 어긋나 있었습니다.
     월요일에 보면 지난주 화요일~월요일이 나와서, 정작 지난 주말이
     어느 화면에도 안 나왔어요.

     이제 양쪽 모두 이 함수 하나만 씁니다. 기준이 하나면 어긋날 수가 없습니다.

       back = 0  이번 주 → 월요일부터 **오늘까지** (아직 오지 않은 날은 빼고)
       back ≥ 1  지난 주 → 월요일부터 일요일까지 **일곱 날 모두**
     ===================================================================== */
  function weekKeys(back = 0) {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;          // 월=0 … 일=6
    const mon = new Date(now);
    mon.setDate(now.getDate() - dow - back * 7); // 그 주의 월요일
    const last = back === 0 ? dow : 6;
    const out = [];
    for (let i = 0; i <= last; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      out.push(dayKey(d));
    }
    return out;
  }

  /* =====================================================================
     [2026-08-11] 지난 7일 보기 — ⏱️ 작업 시간과 같은 방식

     [왜 두 가지인가]
     월~일로 끊으면 "이번 주 얼마 썼나"를 재기 좋습니다. 대신 월요일
     아침에는 막대가 하나뿐이라 화면이 허전하고, 주말에 몰아 쓴 흐름이
     월요일에 뚝 끊겨 보입니다.
     지난 7일로 보면 늘 일곱 칸이라 요즘 페이스가 한눈에 들어옵니다.
     대신 합계가 매일 조금씩 밀려나서 **주간 목표의 잣대로는 못 씁니다.**

     둘 중 하나가 옳은 게 아니라 무엇을 보려느냐의 차이라, 각자 고르게
     하고 그 선택을 이 기기에 적어 둡니다.
     ===================================================================== */
  function rollKeys(back = 0) {
    const now = new Date();
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i - back * 7);
      out.push(dayKey(d));
    }
    return out;
  }


  const DOW_LABEL = ["월", "화", "수", "목", "금", "토", "일"];

  function fmt(n) { return Number(n || 0).toLocaleString(); }

  /* 그래프 위에 얹는 짧은 숫자. 일곱 개가 나란히 서니 길면 겹칩니다.
     만 단위부터 줄이고 그 아래는 그대로 둡니다 — 우리말로는 1.2만이
     12k 보다 바로 읽혀요. */
  function shortNum(n) {
    n = Number(n) || 0;
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, "") + "만";
    return n.toLocaleString();
  }

  /* =====================================================================
     최근 7일 꺾은선 (2026-08-11)
     ---------------------------------------------------------------------
     위쪽 막대는 **월~일 한 주**라 "이번 주 얼마 썼나"를 재는 자리입니다.
     그 아래 이 그래프는 **오늘부터 거꾸로 7일** — 주가 바뀌어도 끊기지
     않아서 요즘 페이스가 이어져 보입니다. 둘은 같은 자료를 다르게
     자른 것뿐이라 서로 어긋날 일이 없어요.

     [왜 꺾은선인가]
     막대는 "그날 얼마"를 재기 좋고, 꺾은선은 "오르내림"을 보기 좋습니다.
     같은 모양을 두 번 겹쳐 놓으면 아래쪽을 볼 이유가 없어집니다.

     [그림은 SVG 로 직접 그립니다]
     차트 라이브러리를 하나 붙이면 그 파일만 수십 KB 인데, 점 일곱 개를
     잇는 선 하나 때문에 그럴 이유가 없습니다.

     ★ 좌표 계산에서 조심할 곳이 둘입니다.
       ① 이레 내내 0 이면 최댓값이 0 이라 나누기에서 NaN 이 됩니다.
       ② 점이 위아래 끝에 붙으면 숫자 글자가 그림 밖으로 잘립니다.
     ===================================================================== */
  function lineChartHtml(pts) {
    /* ★ preserveAspectRatio 를 건드리지 않습니다.
       "none" 으로 두면 가로와 세로가 따로 늘어나서 **숫자 글자가
       찌그러집니다.** 기본값(비율 유지)으로 두고, 높이는 CSS 에서
       auto 로 둬 폭에 맞춰 따라오게 합니다. */
    const W = 640, H = 210;
    const L = 26, R = 26, T = 34, B = 26;      // 숫자와 날짜가 앉을 여백
    const iw = W - L - R, ih = H - T - B;

    const max = Math.max(1, ...pts.map(p => p.v));   // ① 0 나누기 막이
    const n = pts.length;
    const x = i => L + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
    const y = v => T + ih - (ih * (Number(v) || 0)) / max;

    const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");

    const dots = pts.map((p, i) => `
      <circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4.5" class="wcl-dot"/>`).join("");

    /* 0 인 날은 숫자를 적지 않습니다 — 바닥에 0 이 줄줄이 늘어서면
       정작 쓴 날의 숫자가 묻힙니다. */
    const nums = pts.map((p, i) => p.v > 0 ? `
      <text x="${x(i).toFixed(1)}" y="${(y(p.v) - 12).toFixed(1)}"
            class="wcl-num" text-anchor="middle">${shortNum(p.v)}</text>` : "").join("");

    const days = pts.map((p, i) => `
      <text x="${x(i).toFixed(1)}" y="${H - 6}" class="wcl-day${p.today ? " is-today" : ""}"
            text-anchor="middle">${p.label}</text>`).join("");

    return `
      <div class="wcl-wrap">
        <div class="wcl-h">최근 7일 · 글자수</div>
        <svg class="wcl" viewBox="0 0 ${W} ${H}"
             role="img" aria-label="최근 7일 글자수 꺾은선 그래프">
          <line x1="${L}" y1="${T + ih}" x2="${W - R}" y2="${T + ih}" class="wcl-base"/>
          <polyline points="${line}" class="wcl-line"/>
          ${dots}${nums}${days}
        </svg>
      </div>`;
  }

  /* 내 닉네임 읽기.

     ★ `window.myNick` 이 아닙니다.

     script_core.js 는 `let myNick` 을 파일 맨 바깥에 둡니다. 이렇게
     선언한 값은 다른 script 파일에서 **이름 그대로** 보이지만,
     `window.myNick` 에는 올라가지 않습니다. (let/const 는 window 에
     붙지 않는다는 규칙이에요. var 였다면 붙었습니다.)

     그걸 몰라서 늘 빈 값이 나왔고, 입장해 있는데도 "입장한 뒤에 쓸 수
     있어요"가 떴습니다. 이름 그대로 읽되, 혹시 없을 때를 대비해
     window 쪽도 함께 봅니다. */
  function me() {
    try { if (typeof myNick === "string" && myNick) return myNick; } catch (e) {}
    return window.myNick || "";
  }

  function myRow() { return _today[me()] || { total: 0, base: null }; }

  /* ---------------------------------------------------------------
     화면 그리기
     --------------------------------------------------------------- */
  function render() {
    const big  = el("wc-big");
    const unit = el("wc-unit");
    const rows = el("wc-rows");
    const hint = el("wc-hint");
    if (!big || !rows) return;

    const mine = myRow();

    if (_tab === "me") {
      /* 내 요일별 기록 — 여기서만 그래프를 씁니다.
         견주는 상대가 남이 아니라 지난 요일의 나라서 괜찮습니다. */
      const days = weekDays();
      const vals = days.map((k, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (days.length - 1 - i));
        return [DOW_LABEL[(d.getDay() + 6) % 7], Number(_week[k]?.[me()]?.total || 0)];
      });
      const sum = vals.reduce((a, b) => a + b[1], 0);
      big.textContent  = fmt(sum);
      unit.textContent = "자 · 이번 주 내 합계";
      /* [추가 2026-08-02] 요일별 그래프 아래에 "오늘 내 기록"을 붙입니다.
         오늘 탭과 같은 흐르는 기록이지만, 내가 올린 것만 골라 보여줍니다. */
      const myFeed = _feed.filter(f => f.nick === me() && f.type !== "pomo");
      rows.innerHTML = drawRows(vals, vals.length - 1)
        + `<div class="wc-me-h">오늘 내 기록</div>`
        + (myFeed.length
            ? drawFeed(myFeed)
            : `<div class="wc-empty">오늘 올린 기록이 아직 없어요.</div>`);
    } else if (_tab === "memo") {
      /* ✍️ 내 메모 — 명령 없이 적은 혼잣말만. 전부 나만 보는 줄입니다.
         할 일 담기·완료·모아보기와 뽀모 알림은 뺍니다 — 그것들은
         "무슨 일이 있었나" 이고, 여기는 "내가 뭐라고 적었나" 예요. */
      const 날 = 보는날();
      const 내메모 = _mineLines.filter(x => x.day === 날 && x.kind === "memo");
      big.textContent  = String(내메모.length);
      unit.textContent = `줄 · ${보는날말()} 내 메모`;
      rows.innerHTML = 내메모.length
        ? drawFeed(내메모)
        : `<div class="wc-empty">${보는날말()}에 적어 둔 메모가 없어요.<br>
           아래 칸에 그냥 적으면 여기 쌓입니다.</div>`;
      rows.scrollTop = rows.scrollHeight;
    } else {
      /* 오늘 탭 — 흐르는 기록. 순위도 막대도 없습니다. */
      const roomSum = Object.values(_today)
        .reduce((a, v) => a + Number(v?.total || 0), 0);
      big.textContent  = fmt(roomSum);
      unit.textContent = "자 · 오늘 방 전체 · 나 " + fmt(mine.total || 0) + "자";
      rows.innerHTML = drawFeed(mergedFeed());
      /* 새 줄이 아래에 붙으므로 맨 아래를 보여줍니다 */
      rows.scrollTop = rows.scrollHeight;
    }

    /* 날짜 넘기기 줄 — ✍️ 내 메모 탭에서만 */
    const nav = el("wc-daynav");
    if (nav) {
      nav.hidden = (_tab !== "memo");
      const t = el("wc-day-t");
      if (t) t.textContent = 보는날말();
      const pv = el("wc-day-prev"), nx = el("wc-day-next");
      if (pv) pv.disabled = _back >= BACK_MAX;
      if (nx) nx.disabled = _back <= 0;
    }

    if (hint) {
      hint.textContent = (mine.base === null || mine.base === undefined)
        ? "지금 원고의 전체 글자수를 적고 기록을 누르세요. 그 숫자가 출발선이 됩니다."
        : `기준 ${fmt(mine.base)}자 · 다음에도 그때의 전체 글자수를 적으면 차이만 쌓여요.`;
    }
  }

  /* =====================================================================
     "/" 명령 읽기 — 콩트에서 그대로 옮겼습니다 (일정 계열만 뺌)
     ---------------------------------------------------------------------
       /할일        · /할일 18            뒤 3일 ~ 앞 7일 모아보기
       /완료 내용                          최근 3주 안에서 찾아 체크
       /오늘 /내일 /모레 /글피 내용         그 날 할 일에 담기
       /월 … /일 내용                      다음에 오는 그 요일
       /18  /8-18  /8.18  /8/18 내용       그 날짜
     ★ 명령 이름을 콩트와 **똑같이** 둡니다. 방장이 두 곳을 오가며 쓰고,
       멤버에게 설명할 때도 말이 하나여야 해요.
     ===================================================================== */
  const DOW_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
  const SLASH_HELP = [
    { cmd: "/오늘",  what: "오늘 할 일에 담기" },
    { cmd: "/내일",  what: "내일 할 일에 담기" },
    { cmd: "/모레",  what: "모레 할 일에 담기" },
    { cmd: "/글피",  what: "사흘 뒤 할 일에 담기" },
    { cmd: "/완료",  what: "할 일 체크하기" },
    { cmd: "/할일",  what: "이번 주 할 일 모아보기" }
  ];

  function parseSlash(raw) {
    const t = String(raw || "").trim();
    /* /할일 · /할일 18 — 기간 요약 */
    const li = t.match(/^\/(할일|할\s*일|list|목록)(?:\s+(\S+))?$/);
    if (li) {
      let base = dayKey();
      if (li[2]) {
        const sub = parseSlash("/" + li[2] + " x");
        if (sub && sub.key) base = sub.key;
      }
      return { list: true, key: base };
    }
    const m = t.match(/^\/(\S+)\s+(.+)$/);
    if (!m) return null;
    const word = m[1], body = m[2].trim();
    if (!body) return null;

    const now = new Date();
    const plus = (n) => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+n); return d; };

    if (/^(완료|done|끝)$/i.test(word)) return { done: true, text: body };
    if (/^(오늘|today)$/i.test(word))   return { key: dayKey(), text: body };
    if (/^(내일|tomorrow)$/i.test(word))return { key: dayKey(plus(1)), text: body };
    if (/^모레$/.test(word))            return { key: dayKey(plus(2)), text: body };
    if (/^글피$/.test(word))            return { key: dayKey(plus(3)), text: body };

    /* 요일 — 다음에 오는 그 요일 (오늘이면 다음 주) */
    const dowIdx = DOW_NAMES.indexOf(word.replace(/요일$/, ""));
    if (dowIdx >= 0) {
      let diff = (dowIdx - now.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      return { key: dayKey(plus(diff)), text: body };
    }
    /* 8-18 · 8.18 · 8/18 → 월-일 */
    let mm = word.match(/^(\d{1,2})[-./](\d{1,2})$/);
    if (mm) {
      const mo = parseInt(mm[1], 10), da = parseInt(mm[2], 10);
      if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
        let y = now.getFullYear();
        if (mo < now.getMonth() + 1) y += 1;      // 지난 달이면 내년
        return { key: dayKey(new Date(y, mo - 1, da)), text: body };
      }
    }
    /* 18 → 이번 달 18일 (지났으면 다음 달) */
    mm = word.match(/^(\d{1,2})$/);
    if (mm) {
      const da = parseInt(mm[1], 10);
      if (da >= 1 && da <= 31) {
        let y = now.getFullYear(), mo = now.getMonth();
        if (da < now.getDate()) { mo += 1; if (mo > 11) { mo = 0; y += 1; } }
        return { key: dayKey(new Date(y, mo, da)), text: body };
      }
    }
    return null;
  }
  window.wcParseSlash = parseSlash;      // 검사와 시험이 씁니다

  /** 날짜를 사람 말로 — "오늘" · "8/18(월)" */
  function 날말(k) {
    if (k === dayKey()) return "오늘";
    const d = new Date(k + "T00:00:00");
    return `${d.getMonth() + 1}/${d.getDate()}(${DOW_NAMES[d.getDay()]})`;
  }

  /* ---------------------------------------------------------------
     명령 실행 — 할 일은 기존 자리(users/{닉}/todos)를 그대로 씁니다.
     새 저장소를 만들지 않아요. 🗂️ 나의 작업에서 보던 그 목록입니다.
     --------------------------------------------------------------- */

  /** /완료 — 오늘 기준 뒤로 3주 ~ 앞으로 두 달 안에서 비슷한 이름 찾기 */
  function 완료처리(text) {
    const 찾을것 = String(text).replace(/\s+/g, "").toLowerCase();
    const 앞 = dayKey(new Date(Date.now() - 21 * 86400000));
    const 뒤 = dayKey(new Date(Date.now() + 60 * 86400000));
    const 목록 = (window.getTodoItems?.() || []).filter(x => x && !x.done && !x.archived);
    /* 날짜가 가까운 것부터 — 오늘 것을 먼저 집습니다 */
    const 후보 = 목록.filter(x => {
      if (!x.due) return true;                       // 날짜 없는 것도 대상
      return x.due >= 앞 && x.due <= 뒤;
    }).filter(x => String(x.text || "").replace(/\s+/g, "").toLowerCase().includes(찾을것));
    if (!후보.length) return null;
    후보.sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
    const hit = 후보[0];
    /* ★★ [고침 2026-08-16] 두 번째 인수를 빠뜨렸었습니다.
       toggleTodoDone(id, done) 은 done 을 **받아서** 그대로 씁니다 —
       안 주면 undefined → !!undefined → false 라, 완료가 아니라
       **완료를 푸는** 셈이었어요. 화면에는 "완료 처리했어요" 가 떴는데
       🗂️ 나의 작업에는 체크가 안 되던 이유입니다 (실제 제보).
       ★ 이름이 toggleTodoDone(토글) 인데 실제로는 값을 받는 함수예요.
         부를 때 반드시 true 를 함께 주세요. */
    try { window.toggleTodoDone?.(hit.id, true); } catch (e) { return null; }
    return hit;
  }

  /** /할일 — 기준일에서 뒤 3일 ~ 앞 7일, 안 끝난 것만 */
  function 모아보기(baseKey) {
    const base = new Date(baseKey + "T00:00:00");
    const 옮김 = (n) => { const x = new Date(base); x.setDate(x.getDate() + n); return dayKey(x); };
    const 처음 = 옮김(-3), 끝 = 옮김(7), 오늘 = dayKey();
    const 목록 = (window.getTodoItems?.() || []).filter(x => x && !x.done && !x.archived);

    const 날별 = {};
    let 없는날 = [];
    목록.forEach(x => {
      const d = x.due;
      if (!d) { 없는날.push(x.text); return; }
      if (d < 처음 || d > 끝) return;
      (날별[d] = 날별[d] || []).push(x.text);
    });
    const 묶음 = Object.keys(날별).sort().map(k => ({
      key: k, 밀림: k < 오늘, 오늘인가: k === 오늘,
      이름: k === 오늘 ? "오늘" : (k < 오늘 ? "밀림 " + 날말(k) : 날말(k)),
      항목: 날별[k]
    }));
    const 총 = 묶음.reduce((n, g) => n + g.항목.length, 0) + 없는날.length;
    const 밀린수 = 묶음.filter(g => g.밀림).reduce((n, g) => n + g.항목.length, 0);
    return { 묶음, 없는날, 총, 밀린수, 기준: 날말(baseKey) };
  }

  /** 글칸에 적힌 것을 실행합니다. 숫자 기록과 함께 불립니다. */
  function 메모처리() {
    const inp = el("wc-memo");
    const raw = String(inp?.value || "").trim();
    if (!raw) return false;

    const cmd = parseSlash(raw);

    if (cmd && cmd.list) {
      const r = 모아보기(cmd.key);
      addMine("list", "", { list: r });
      if (inp) inp.value = "";
      메모힌트("");
      return true;
    }
    if (cmd && cmd.done) {
      const hit = 완료처리(cmd.text);
      if (!hit) { 메모힌트("그런 할 일을 못 찾았어요 🤔"); return true; }
      addMine("done", `✓ 완료 — ${hit.text}`);
      if (inp) inp.value = "";
      메모힌트("완료 처리했어요");
      return true;
    }
    if (cmd && cmd.key) {
      try { window.addTodoWithDue?.(cmd.text, cmd.key); }
      catch (e) { 메모힌트("담지 못했어요"); return true; }
      addMine("todo", `📌 ${날말(cmd.key)} 할 일 — ${cmd.text}`);
      if (inp) inp.value = "";
      메모힌트(`${날말(cmd.key)} 할 일에 담았어요`);
      return true;
    }
    if (/^\//.test(raw)) {           // 명령처럼 생겼는데 못 알아들음
      메모힌트("그런 명령은 없어요 — /할일 을 쳐보세요");
      return true;
    }
    /* 그냥 메모 */
    addMine("memo", raw);
    if (inp) inp.value = "";
    메모힌트("");
    return true;
  }

  /* [고침 2026-08-16] 메모칸 아래에 힌트 줄을 따로 뒀더니 글자수 칸과
     사이가 벌어졌습니다. 위쪽에 이미 안내 줄(#wc-log)이 있어요 —
     거기를 같이 씁니다. 줄이 하나 줄고 간격도 붙습니다. */
  function 메모힌트(msg) {
    if (!msg) return;
    say(msg);
    setTimeout(() => { const b = el("wc-log"); if (b && b.textContent === msg) b.textContent = ""; }, 3000);
  }

  /* 방의 글자수 기록 + 내 뽀모 알림을 시간순으로 섞습니다.
     오늘 탭에서만 씁니다 — '내 기록' 탭은 숫자만 봅니다. */
  function mergedFeed() {
    /* 오늘 탭은 늘 **오늘**입니다 — 되짚기는 내 메모 탭에만 있어요 */
    const 오늘 = dayKey();
    const 내줄 = _mineLines.filter(x => x.day === 오늘);
    if (!_pomoLines.length && !내줄.length) return _feed;
    return _feed.concat(_pomoLines, 내줄)
                .sort((a, b) => Number(a.at || 0) - Number(b.at || 0));
  }

  /* 뽀모 쪽(script_realtime.js)에서 부릅니다 */
  function addMyPomoLine(msg) {
    if (!msg) return;
    _pomoLines.push({ type: "pomo", msg: String(msg), at: Date.now() });
    if (_pomoLines.length > 40) _pomoLines = _pomoLines.slice(-40);
    render();
  }
  window.addMyPomoLine = addMyPomoLine;

  /* 흐르는 기록 — 하나당 두 줄입니다.

         호랑 : 800자                          ← 올린 숫자
         [호랑님 +300자 / 전체 글자수 800자]    ← 계산 결과

     한 줄로 줄이면 "누가 얼마"만 남아 순위표처럼 보입니다. 두 줄로
     두면 대화 기록처럼 읽혀요. 캡쳐로 보여주신 그 느낌입니다. */
  function drawFeed(list) {
    if (!list.length) {
      return `<div class="wc-empty">아직 올라온 기록이 없어요.<br>
              지금 전체 글자수를 적으면 여기에 올라옵니다.</div>`;
    }
    return list.slice(-FEED_MAX).map(f => {
      /* [추가 2026-08-04] 뽀모도로 알림 — 채팅방 대신 여기(오늘 탭)에
         가운데 줄로 흐릅니다. 버튼 누른 사람 nick 으로 저장되지만
         방이 알려주는 말이라 이름은 보여주지 않습니다. */
      /* ✍️ 나만 보는 줄 — 메모 · 할 일 (2026-08-16)
         오른쪽에 작은 자물쇠를 두어 "이건 나만 본다"를 눈에 남깁니다. */
      if (f.type === "mine") {
        const tm2 = (f.at && window.formatHHMM)
          ? `<span class="wc-priv-t">${window.formatHHMM(f.at)}</span>` : "";
        if (f.kind === "list") {
          const L = f.list || {};
          const 줄 = (L.묶음 || []).map(g => `
            <div class="wc-priv-g${g.밀림 ? " late" : ""}${g.오늘인가 ? " today" : ""}">
              <span class="wc-priv-gd">${esc(g.이름)}</span>
              <span class="wc-priv-gi">${g.항목.map(esc).join(" · ")}</span>
            </div>`).join("");
          const 없는 = (L.없는날 || []).length
            ? `<div class="wc-priv-g"><span class="wc-priv-gd">날짜 없음</span>
               <span class="wc-priv-gi">${L.없는날.map(esc).join(" · ")}</span></div>` : "";
          return `<div class="wc-feed"><div class="wc-priv">
            ${tm2}
            <div class="wc-priv-h">📋 할 일 ${L.총 || 0}개${L.밀린수 ? ` · 밀림 ${L.밀린수}` : ""}</div>
            ${줄 || 없는 ? 줄 + 없는 : `<div class="wc-priv-none">안 끝난 할 일이 없어요</div>`}
          </div></div>`;
        }
        return `<div class="wc-feed"><div class="wc-priv wc-priv-${esc(f.kind || "memo")}">
          ${tm2}<span class="wc-priv-x">${esc(f.msg || "")}</span>
        </div></div>`;
      }

      if (f.type === "pomo") {
        /* [고침 2026-08-04] 시각은 붙이지 않습니다 — 방이 알려주는 말이라
           글자수 기록과 달리 '언제'가 중요하지 않아요 (사용자 요청). */
        return `<div class="wc-feed">
          <div class="wc-feed-sys wc-pomo-line">${esc(f.msg || "")}</div>
        </div>`;
      }
      const isMe = f.nick === me();
      const nick = esc(f.nick);
      /* 옛 기록에는 snap 이 없습니다. 그럴 땐 윗줄을 생략합니다. */
      const snap = (f.snap === undefined || f.snap === null) ? null : Number(f.snap);
      /* [추가 2026-08-02] 채팅처럼 말풍선 안쪽 옆에 시각을 붙입니다.
         내 것은 왼쪽에, 남의 것은 오른쪽에 — 채팅 창과 같은 배치예요. */
      const tm = (f.at && window.formatHHMM)
        ? `<span class="wc-said-t">${window.formatHHMM(f.at)}</span>` : "";

      return `<div class="wc-feed${isMe ? " me" : ""}">
        ${snap === null ? "" : `
        <div class="wc-said-line">
          ${isMe ? tm : ""}
          <div class="wc-said">
            ${isMe ? "" : `<span class="wc-said-nm">${nick}</span>`}
            <span class="wc-said-n">${fmt(snap)}자</span>
          </div>
          ${isMe ? "" : tm}
        </div>`}
        <div class="wc-feed-sys">
          [<b>${nick}</b>님 <b>+${fmt(f.add)}자</b>${
            snap === null ? "" : ` / 전체 ${fmt(snap)}자`}]
        </div>
      </div>`;
    }).join("");
  }

  function sumWeek() {
    const out = {};
    weekDays().forEach(k => {
      Object.entries(_week[k] || {}).forEach(([n, v]) => {
        out[n] = (out[n] || 0) + Number(v?.total || 0);
      });
    });
    return out;
  }

  function drawRows(list, meIdx) {
    const max = Math.max(1, ...list.map(x => x[1]));
    return list.map(([n, v], i) => {
      /* 막대 길이는 비율로만 정합니다. 칸 폭이 좁아도 넘치지 않게
         퍼센트를 쓰고, 0자도 보이도록 최소 폭을 CSS에서 줍니다. */
      const w = Math.round(v / max * 100);
      return `<div class="wc-row${i === meIdx ? " me" : ""}">
                <span class="wc-nm">${esc(n)}</span>
                <span class="wc-bar" style="width:${w}%"></span>
                <span class="wc-n">${fmt(v)}</span>
              </div>`;
    }).join("");
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function say(t) {
    const box = el("wc-log");
    if (box) box.textContent = t || "";
  }

  /* ---------------------------------------------------------------
     서버에 쓰기

     update 를 쓰는 이유: set 은 그 자리를 통째로 갈아치웁니다.
     total 만 바꾸려다 base 를 날려버릴 수 있어요.

     ★ 손안의 값을 **먼저** 고칩니다.

     [무엇이 잘못됐었나]
     예전에는 서버에만 쓰고, 화면은 서버가 되돌려주는 값을 기다렸습니다.
     그런데 그 왕복은 눈 깜짝할 사이가 아니에요. 그 틈에 다음 버튼을
     누르면 **아직 옛 기준**을 보고 계산합니다.

     실제로 이렇게 됐습니다.
       🆕 새 편 (기준 0으로) → 곧바로 300 기록
       → 손안에는 아직 기준이 5,000 → 300 - 5,000 = 음수
       → "글자수가 줄었네요" 가 뜨고, 채팅에도 안 올라감

     초기화 뒤 계산이 이상했던 것, 남이 올린 직후 내 차례에 엉킨 것도
     모두 같은 원인입니다.

     그래서 서버에 보내기 전에 손안의 값부터 고칩니다. 서버 답이
     오면 그 값으로 덮이는데, 둘은 같은 값이라 깜빡이지 않습니다.
     --------------------------------------------------------------- */
  async function save(patch) {
    const nick = me();
    if (!nick || !window.db) return false;

    const stamp = Date.now();
    const before = _today[nick];
    _today[nick] = { ...(before || { total: 0, base: null }), ...patch, at: stamp };
    render();

    try {
      await window.db.ref(`wordlog/${dayKey()}/${nick}`)
        .update({ ...patch, at: stamp });
    } catch (e) {
      /* 서버가 거절하면 손안의 값도 되돌립니다.
         안 그러면 화면만 맞고 실제로는 저장이 안 된 상태가 됩니다. */
      if (before === undefined) delete _today[nick]; else _today[nick] = before;
      render();
      say(denyMsg(e));
      console.warn("[wordcount save failed]", e);
      return false;
    }
    return true;
  }

  /* 흐르는 기록에 한 줄 올리기.

     합계와 따로 두는 이유: 합계는 덮어쓰는 값이라 "언제 얼마나
     올렸는지"가 남지 않습니다. 채팅처럼 보여주려면 순간마다 한 줄이
     따로 있어야 해요. */
  async function pushFeed(add, snap) {
    if (!me() || !window.db || !(add > 0)) return;
    try {
      await window.db.ref(`wordfeed/${dayKey()}`)
        .push({ nick: me(), add: Number(add), snap: Number(snap), at: Date.now() });
    } catch (e) {
      say(denyMsg(e));
      console.warn("[wordfeed push failed]", e);
    }
  }

  /* 서버가 거절했을 때 무슨 일인지 알려줍니다.

     예전에는 "저장하지 못했어요" 한 줄뿐이라, 왜 안 되는지 알 길이
     없었습니다. 가장 흔한 원인이 **로그인이 풀린 것**이라 따로 짚어줍니다. */
  function denyMsg(e) {
    const c = String(e && (e.code || e.message) || "");
    if (/permission|PERMISSION_DENIED/i.test(c)) {
      return "저장이 거부됐어요. 다른 창에서 다른 닉네임으로 들어가면 이 창의 로그인이 풀립니다. 새로고침 후 다시 입장해 주세요.";
    }
    return "저장하지 못했어요. 잠시 뒤 다시 해주세요.";
  }

  function inputVal() {
    const v = parseInt(el("wc-input")?.value, 10);
    return Number.isFinite(v) && v >= 0 ? v : null;
  }
  function clearInput() { const i = el("wc-input"); if (i) i.value = ""; }

  /* ---------------------------------------------------------------
     버튼이 하는 일
     --------------------------------------------------------------- */
  async function send() {
    /* 자정 직후 첫 기록 보호 — 어제 값으로 계산하지 않게 오늘로 먼저 갈아탑니다.
       갈아탄 직후에는 기준이 비어 있으므로, 적은 숫자가 자연스럽게 출발선이 됩니다. */
    rolloverIfNeeded();
    const v = inputVal();

    /* ✍️ [2026-08-16] 숫자가 없으면 메모칸만 처리합니다.
       콩트와 같은 동작이에요 — 숫자만·글만·둘 다 전부 됩니다.
       ★ 메모는 나만 보는 줄이라 서버로 안 나갑니다(메모처리 참고). */
    if (v === null) {
      if (메모처리()) return;
      say("숫자를 적어주세요.");
      return;
    }
    /* 숫자와 글을 함께 적었으면, 글은 나만 보는 줄로 따로 남깁니다 */
    메모처리();

    if (!me()) { say("잠시만요, 아직 준비 중이에요."); return; }

    const mine = myRow();
    const base = mine.base;

    if (base === null || base === undefined) {
      await save({ base: v, total: Number(mine.total || 0) });
      clearInput();
      say(`출발선을 ${fmt(v)}자로 잡았어요`);
      return;
    }

    const diff = v - Number(base);
    if (diff > 0) {
      const next = Number(mine.total || 0) + diff;
      /* 저장이 안 됐으면 채팅에도 올리지 않습니다.
         한쪽만 남으면 숫자와 기록이 어긋나 보입니다. */
      const okSave = await save({ base: v, total: next });
      if (okSave === false) { clearInput(); return; }
      await pushFeed(diff, v);
      say(`+${fmt(diff)}자 · 오늘 누적 ${fmt(next)}자`);
    } else if (diff === 0) {
      say("그대로예요");
    } else {
      /* 줄었을 때는 누적을 깎지 않고 기준만 옮깁니다 */
      await save({ base: v });
      say("글자수가 줄었네요. 기준만 옮겼어요");
    }
    clearInput();
  }

  async function setBase() {
    rolloverIfNeeded();
    const v = inputVal();
    if (v === null) { say("먼저 지금 글자수를 적어주세요."); return; }
    await save({ base: v });
    clearInput();
    say(`기준을 ${fmt(v)}자로`);
  }

  async function resetTotal() {
    rolloverIfNeeded();
    await save({ total: 0 });
    say("오늘 누적을 0으로 되돌렸어요");
  }

  /* =====================================================================
     🕛 어제 채우기 (2026-08-10)
     ---------------------------------------------------------------------
     밤 11시부터 자정 사이에 쓴 만큼을 못 적고 날짜가 넘어가는 일이
     자주 생깁니다. 그 한 칸만 뒤늦게 메우는 자리예요.

     [왜 '덮어쓰기'가 아니라 '더하기'인가]
     여기 적는 숫자는 오늘과 똑같이 **원고의 전체 글자수**입니다.
     그날 쓴 양은 늘 `전체 글자수 − 그날의 기준` 으로 계산되고, 기준은
     그대로 두므로 결과는 이미 적힌 것에 **이어붙는** 셈이 됩니다.
     그래서 어제 칸이 비어 있는지 아닌지 따질 필요가 없습니다.

     [새 편은 계산이 다릅니다]
     10시에 한 회차를 끝내고 새 파일로 다음 회차를 쓰다가 놓친 경우,
     새 파일의 글자수(예: 800)는 어제 기준(12,500)보다 작습니다. 빼면
     음수가 되니 아무것도 안 더해져요. 그래서 [🆕 새 편이었어요] 를
     체크하면 뺄셈 없이 **적은 숫자를 통째로** 더합니다.

     [저장 전에 결과를 보여줍니다]
     체크 하나로 결과가 크게 달라지므로, 누르기 전에 한 줄로 미리
     보여줍니다 — "어제 2,500자 → 3,300자 (+800)".
     ===================================================================== */
  let _ydayRow = null;                    // 어제 { total, base }

  function ydayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dayKey(d);
  }

  /* 지금 적힌 값으로 결과를 계산합니다. 화면에도, 저장할 때도 이 하나만
     씁니다 — 미리보기와 실제 저장이 어긋나면 안 되니까요. */
  function ydayCalc() {
    const prev = Number(_ydayRow?.total || 0);
    const base = _ydayRow?.base;
    const raw  = el("wc-yday-input")?.value ?? "";
    const v    = parseInt(raw, 10);
    const isNew = !!el("wc-yday-new")?.checked;

    if (!Number.isFinite(v) || v < 0)
      return { ok: false, prev, msg: `어제 ${fmt(prev)}자 — 마지막 글자수를 적어주세요` };

    if (isNew) {
      if (v <= 0) return { ok: false, prev, msg: "0자는 더할 게 없어요" };
      return { ok: true, prev, v, add: v, next: prev + v };
    }
    if (base === null || base === undefined)
      return { ok: false, prev, msg: "어제 출발선이 없어요. 새 편이었다면 아래를 체크해 주세요" };

    const add = v - Number(base);
    if (add <= 0)
      return { ok: false, prev,
               msg: `어제 마지막 기준(${fmt(base)}자)보다 커야 해요. 새 편이었다면 체크해 주세요` };
    return { ok: true, prev, v, add, next: prev + add };
  }

  function renderYdayPreview() {
    const p = el("wc-yday-pre");
    if (!p) return;
    const r = ydayCalc();
    p.textContent = r.ok
      ? `어제 ${fmt(r.prev)}자 → ${fmt(r.next)}자 (+${fmt(r.add)})`
      : r.msg;
    p.classList.toggle("is-warn", !r.ok);
  }

  async function toggleYdayBox() {
    const box = el("wc-yday");
    const btn = el("wc-yday-btn");
    if (!box) return;
    if (!box.hasAttribute("hidden")) {
      box.setAttribute("hidden", "");
      btn?.setAttribute("aria-expanded", "false");
      return;
    }
    if (!me()) { say("잠시만요, 아직 준비 중이에요."); return; }

    /* 열 때 어제 값을 한 번 읽어옵니다. 어제는 늘 듣고 있는 날이 아니라
       (월요일에는 지난주라서) 캐시를 믿을 수 없습니다. */
    _ydayRow = {};
    try {
      const s = await window.db.ref(`wordlog/${ydayKey()}/${me()}`).once("value");
      _ydayRow = s.val() || {};
    } catch (e) { say(denyMsg(e)); return; }

    const key = ydayKey();
    const t = el("wc-yday-title");
    if (t) t.textContent = `🕛 어제(${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}) 채우기`;
    const inp = el("wc-yday-input");
    if (inp) inp.value = "";
    const chk = el("wc-yday-new");
    if (chk) chk.checked = false;

    box.removeAttribute("hidden");
    btn?.setAttribute("aria-expanded", "true");
    renderYdayPreview();
    inp?.focus();
  }

  async function saveYday() {
    const r = ydayCalc();
    if (!r.ok) { say(r.msg); return; }
    const nick = me();
    const day  = ydayKey();
    try {
      await window.db.ref(`wordlog/${day}/${nick}`)
        .update({ total: r.next, base: r.v, at: Date.now() });
      /* 흐르는 기록에도 한 줄. late 표시를 남기는 이유는, 시각이
         '지금'으로 찍히기 때문입니다 — 나중에 봐도 헷갈리지 않게. */
      await window.db.ref(`wordfeed/${day}`)
        .push({ nick, add: r.add, snap: r.v, at: Date.now(), late: true });
    } catch (e) { say(denyMsg(e)); return; }

    _ydayRow = { total: r.next, base: r.v };

    /* 오늘 출발선이 아직 없으면 이어서 잡아 줍니다.
       어제 마지막 상태에서 오늘도 계속 쓰는 게 보통이니까요.
       이미 잡아 둔 사람의 값은 건드리지 않습니다. */
    const mine = myRow();
    let alsoBase = false;
    if (mine.base === null || mine.base === undefined) {
      await save({ base: r.v, total: Number(mine.total || 0) });
      alsoBase = true;
    }

    el("wc-yday")?.setAttribute("hidden", "");
    el("wc-yday-btn")?.setAttribute("aria-expanded", "false");
    say(`어제에 +${fmt(r.add)}자 · 어제 누적 ${fmt(r.next)}자`
        + (alsoBase ? ` · 오늘 출발선도 ${fmt(r.v)}자로 잡았어요` : ""));
    render();
  }

  async function freshStart() {
    rolloverIfNeeded();
    await save({ base: 0 });
    clearInput();
    say("새 편 시작 · 기준 0자");
  }

  /* ---------------------------------------------------------------
     듣기 시작 — 입장한 뒤에 부릅니다
     --------------------------------------------------------------- */
  function startWordcount() {
    if (_started || !window.db) return;
    _started = true;

    /* ★★★ [고침 2026-08-17] 이 한 줄이 빠져 있었습니다.
       ---------------------------------------------------------------
       [무엇이 잘못됐었나] loadMine() 을 만들어 놓고 **아무도 부르지
       않았어요.** 그래서 새로고침하거나 자정이 지나 방을 다시 열면
       _mineLines 가 빈 배열로 시작했고, [내 메모]에서 어제로 넘겨도
       늘 비어 보였습니다 ("날이 바뀌면서 리셋된 후에 내 메모 어제를
       보니까 메모가 안 남아 있어" — 콩).

       [더 나빴던 것] 그냥 안 보이는 데서 그치지 않았습니다.
       addMine() 은 _mineLines 에 밀어 넣고 **배열 전체를** 저장해요.
       빈 배열에서 시작했으니 메모를 하나 적는 순간 곳간에 남아 있던
       2주치가 한 줄로 덮여 사라졌습니다. 읽기를 빠뜨리면 쓰기가
       지워 버리는 꼴 — 불러오기와 저장하기는 반드시 짝으로 답니다.

       [왜 여기인가] attach() 앞입니다. attach() 가 곧 render() 를
       부르는데, 그때 _mineLines 가 이미 채워져 있어야 첫 화면부터
       메모가 보여요. 서버를 타지 않으니 늦출 이유도 없습니다. */
    loadMine();

    attach();

    /* [추가 2026-08] 자정 감시.

       [무엇이 잘못됐었나]
       듣는 날짜를 입장할 때 한 번만 계산했습니다. 자정이 지나도 화면은
       어제 노드를 듣고("자정이 지나도 그대로"), 저장은 오늘 노드에
       되는데 계산은 어제 값(어제 누적 total)으로 해서, 오늘 노드에
       **어제 누적이 합쳐진 숫자**가 저장됐습니다. 새벽까지 쓰는 방에서는
       반드시 터지는 버그였어요.

       1분마다, 그리고 화면이 다시 보일 때(절전 복귀·탭 전환) 날짜를
       검사해서 바뀌었으면 오늘 날짜로 갈아탑니다. 버튼을 누르는 순간에도
       한 번 더 검사합니다 (자정 직후 첫 기록 보호). */
    setInterval(rolloverIfNeeded, 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") rolloverIfNeeded();
    });
  }

  /** 듣기 붙이기 — 지금 날짜 기준으로. 자정이 지나면 다시 부릅니다 */
  function attach() {
    detach();
    _day = dayKey();
    _today = {}; _feed = []; _week = {}; _pomoLines = [];

    _ref = window.db.ref(`wordlog/${_day}`);
    _ref.on("value", snap => {
      const server = snap.val() || {};
      /* 내 줄은 손안의 값이 더 새것일 수 있습니다 (방금 눌렀는데
         서버 답이 아직 안 온 경우). at 이 더 큰 쪽을 남깁니다. */
      const nick = me();
      const local = _today[nick];
      _today = server;
      if (nick && local && (!server[nick] || Number(local.at || 0) > Number(server[nick].at || 0))) {
        _today[nick] = local;
      }
      render();
    });

    /* 흐르는 기록 — 최근 것만 받아옵니다 */
    /* [고침 2026-08-06] 키 순서가 아니라 **시각(at) 순서**로 최근 것을 받습니다.

       [무엇이 잘못됐었나]
       limitToLast 는 아무것도 지정하지 않으면 **키 이름 순서**로 자릅니다.
       글자수 기록은 push 키(-Oa…)라 '-' 로 시작하고, 뽀모도로 알림은
       sys_pomo_12 처럼 's' 로 시작합니다. 이름 순서로는 s 가 뒤라서,
       뽀모 알림이 60개를 넘는 순간 **최근 60개가 전부 뽀모 알림**이 되고
       글자수 기록은 한 줄도 안 내려왔습니다. 서버에는 멀쩡히 있는데
       화면에서만 사라져 "기록이 날아간" 것처럼 보였어요.

       at 으로 줄 세우면 두 종류가 시간순으로 섞이므로 이런 일이 없습니다. */
    _feedRef = window.db.ref(`wordfeed/${_day}`).orderByChild("at").limitToLast(FEED_MAX);
    _feedRef.on("value", snap => {
      const v = snap.val() || {};
      /* 옛 방식(공용 뽀모)으로 서버에 쌓인 알림은 걸러냅니다.
         내 뽀모 알림은 _pomoLines 로 따로 들어와요. */
      _feed = Object.values(v)
        .filter(f => f && f.type !== "pomo")
        .sort((a, b) => Number(a.at || 0) - Number(b.at || 0));
      render();
    });

    /* 주간은 날짜마다 따로 붙습니다. 하루치씩이라 양이 적어요.
       [고침 2026-08-10] weekDays() 대신 weekKeys(0) — 같은 값이지만
       화면과 같은 함수를 써야 어긋나지 않습니다(위 주석 참고).

       ★ [2026-08-11] weekKeys(0) → rollKeys(0) 으로 넓혔습니다.
         [주간/7일] 단추가 생기면서 화면이 **이번 주 월요일보다 앞선
         날짜**를 그릴 수 있게 됐습니다. 듣는 쪽이 월~오늘 뿐이면 그
         앞의 칸들이 0 으로 보입니다 — 8월 10일에 터졌던 "월요일 아침에
         지난 주가 싹 날아갔다" 와 똑같은 어긋남이에요.
         지난 7일은 언제나 월~오늘을 품으므로(둘 다 오늘로 끝나니까)
         이 하나로 두 보기를 모두 덮습니다. 붙는 날짜 수는 최대 일곱으로
         전과 같습니다 — 일요일에 보던 개수예요. */
    rollKeys(0).forEach(k => {
      const r = window.db.ref(`wordlog/${k}`);
      r.on("value", snap => { _week[k] = snap.val() || {}; render(); });
      _weekRefs.push(r);
    });

    render();
  }

  /** 날짜가 바뀌었으면 오늘로 갈아탑니다. 갈아탔으면 true */
  function rolloverIfNeeded() {
    if (!_started) return false;
    if (_day === dayKey()) return false;
    attach();
    say("자정이 지나 오늘 기록으로 넘어왔어요. 전체 글자수를 적어 출발선부터 잡아주세요.");
    return true;
  }

  function detach() {
    try { _ref?.off(); } catch (e) {}
    try { _feedRef?.off(); } catch (e) {}
    _feedRef = null;
    _weekRefs.forEach(r => { try { r.off(); } catch (e) {} });
    _ref = null; _weekRefs = [];
  }

  /* ---------------------------------------------------------------
     버튼 걸기 — 화면이 준비되면 한 번만
     --------------------------------------------------------------- */
  function bind() {
    const host = el("wordcount-block");
    if (!host || host._wcBound) return;
    host._wcBound = true;

    el("wc-send")?.addEventListener("click", send);
    el("wc-base")?.addEventListener("click", setBase);
    el("wc-reset")?.addEventListener("click", resetTotal);
    el("wc-fresh")?.addEventListener("click", freshStart);

    /* 🕛 어제 채우기 */
    el("wc-yday-btn")?.addEventListener("click", toggleYdayBox);
    el("wc-yday-save")?.addEventListener("click", saveYday);
    el("wc-yday-input")?.addEventListener("input", renderYdayPreview);
    el("wc-yday-new")?.addEventListener("change", renderYdayPreview);
    el("wc-yday-input")?.addEventListener("keydown", (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter") { e.preventDefault(); saveYday(); }
      if (e.key === "Escape") { el("wc-yday")?.setAttribute("hidden", ""); }
    });

    /* ✍️ 메모칸 — 엔터로 바로, 그리고 "/" 를 치면 명령 목록 */
    const memo = el("wc-memo");
    if (memo && !memo._wcBound) {
      memo._wcBound = true;
      memo.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || e.shiftKey || e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        /* 숫자도 적혀 있으면 함께 기록합니다 (콩트와 같은 동작) */
        const n = el("wc-input");
        if (n && String(n.value).trim() !== "") { el("wc-send")?.click(); return; }
        메모처리();
      });
      memo.addEventListener("input", () => {
        const v = String(memo.value || "");
        const box = el("wc-slash");
        if (!box) return;
        if (!/^\//.test(v) || /\s/.test(v)) { box.hidden = true; box.innerHTML = ""; return; }
        const q = v.slice(1);
        const 후보 = SLASH_HELP.filter(c => !q || c.cmd.includes(q));
        if (!후보.length) { box.hidden = true; box.innerHTML = ""; return; }
        box.innerHTML = 후보.map(c =>
          `<button type="button" class="wc-slash-i" data-slash="${c.cmd}">
             <b>${c.cmd}</b> <span>${esc(c.what)}</span></button>`).join("");
        box.hidden = false;
      });
      el("wc-slash")?.addEventListener("mousedown", (e) => {
        const b = e.target.closest("[data-slash]");
        if (!b) return;
        e.preventDefault();
        memo.value = b.dataset.slash + " ";
        el("wc-slash").hidden = true;
        memo.focus();
      });
      memo.addEventListener("blur", () => {
        setTimeout(() => { const b = el("wc-slash"); if (b) b.hidden = true; }, 120);
      });
    }

    el("wc-input")?.addEventListener("keydown", (e) => {
      /* 한글 조합 중의 Enter 는 무시 — 숫자 칸이지만 습관대로 둡니다 */
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter") { e.preventDefault(); send(); }
    });

    /* [전체 기록] 은 탭이 아니라 창을 엽니다 — 눌러도 오늘/내 기록 선택은 그대로 */
    /* [2026-08-11] 단추가 접속자 명단 맨 아래로 옮겨갔습니다.
       옛 자리도 그대로 부릅니다 — 단일파일처럼 오래 열어 둔 화면에서
       옛 뼈대가 남아 있을 수 있어요. */
    el("wc-all-btn")?.addEventListener("click", openWcAll);
    el("wcall-pill")?.addEventListener("click", openWcAll);

    host.querySelectorAll("[data-wc-tab]").forEach(b => {
      b.addEventListener("click", () => {
        _tab = b.dataset.wcTab;
        _back = 0;                     // 탭을 옮기면 오늘부터 — 안 그러면 어제가 따라옵니다
        host.querySelectorAll("[data-wc-tab]").forEach(x => {
          const on = x === b;
          x.classList.toggle("on", on);
          x.setAttribute("aria-selected", on ? "true" : "false");
        });
        render();
      });
    });

    /* 📅 날짜 넘기기 */
    el("wc-day-prev")?.addEventListener("click", () => {
      if (_back < BACK_MAX) { _back++; render(); }
    });
    el("wc-day-next")?.addEventListener("click", () => {
      if (_back > 0) { _back--; render(); }
    });

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }

  window.startWordcount = startWordcount;
  window.renderWordcount = render;
  window.wordcountMyWeekHtml = myWeekHtml;
  /* ---------------------------------------------------------------
     설정 → 📊 나의 기록 에 넣을 글자수 요약.

     '내 기록' 탭과 같은 값을 쓰되, 설정에서는 오늘 숫자도 같이
     보여줍니다. 설정을 여는 사람은 "오늘 얼마나 썼지"를 먼저
     궁금해하니까요.
     --------------------------------------------------------------- */
  async function myWeekHtml(wcBack = 0, timeBack = 0) {
    /* [2026-08-03] 지난 주 넘겨보기 — 이번 주(wcBack 0)는 듣고 있는
       캐시(_week)를 그대로 쓰고, 지난 주는 그때 노드를 한 번 읽어옵니다. */
    const isThisWeek = wcBack === 0;
    const vals = [];
    /* [고침 2026-08-10] "오늘부터 거꾸로 7일"이 아니라 **그 주의 월~일**.
       예전 방식은 요일이 어긋나서, 월요일에 보면 지난 주말이 이번 주에도
       지난 주에도 안 나왔습니다 (weekKeys 주석 참고).
       [2026-08-11] 이제 보기 방식(주간/7일)에 따라 갈라집니다. */
    const keys = weekKeys(wcBack);

    /* ★ 지금 실시간으로 듣고 있는 날짜들.
       "이번 주냐" 가 아니라 **"듣고 있느냐"** 로 갈라야 합니다.
       7일 보기의 첫 화면에는 이번 주 월요일보다 앞선 날이 섞여 있는데,
       그걸 캐시에서 찾으면 0 이 나옵니다. */
    const live = new Set(rollKeys(0));

    for (const key of keys) {
      let total = 0;
      if (live.has(key)) {
        total = Number(_week[key]?.[me()]?.total || 0);
      } else {
        try {
          const snap = await db.ref(`wordlog/${key}/${me()}`).once("value");
          total = Number(snap.val()?.total || 0);
        } catch (e) {}
      }
      const d = new Date(key + "T12:00:00");
      vals.push([DOW_LABEL[(d.getDay() + 6) % 7], total]);
    }
    const week = vals.reduce((a, b) => a + b[1], 0);
    const today = Number(myRow().total || 0);
    const base = myRow().base;
    const weekLabel = isThisWeek ? "이번 주" : `${wcBack}주 전`;

    const todayHtml = !isThisWeek ? "" : `
      <div class="rec-today">
        <div class="rec-big">${fmt(today)}자</div>
        <div class="rec-sub">오늘 쓴 글자수</div>
      </div>`;

    /* ── 아래쪽 최근 7일 꺾은선 ──────────────────────────────────────
       ★ 이 그래프는 ‹ › 를 따라가지 **않습니다.** 늘 오늘까지의 7일이에요.
         위쪽에서 지난 주를 넘겨보는 동안 아래도 함께 옮겨가면, 두 그림이
         같은 기간을 조금 다르게 자른 꼴이 되어 볼 이유가 없어집니다.
         위는 "그 주에 얼마", 아래는 "요즘 페이스" — 역할이 다릅니다.

       날짜는 전부 지금 듣고 있는 범위(rollKeys(0)) 안에 있으므로
       서버를 다시 읽지 않습니다. */
    const linePts = rollKeys(0).map(k => {
      const d = new Date(k + "T12:00:00");
      return {
        v: Number(_week[k]?.[me()]?.total || 0),
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        today: k === dayKey()
      };
    });

    return `
      ${todayHtml}
      <div class="rec-h2 rec-weeknav">
        <button type="button" class="rec-nav" title="한 주 전"
                onclick="renderMyRecordPanel(${timeBack}, ${wcBack + 1})">‹</button>
        <span>${weekLabel} · 요일별</span>
        <button type="button" class="rec-nav" title="한 주 뒤" ${isThisWeek ? "disabled" : ""}
                onclick="renderMyRecordPanel(${timeBack}, ${wcBack - 1})">›</button>
      </div>
      <div class="wc-rows" style="max-height:none">${drawRows(vals, isThisWeek ? vals.length - 1 : -1)}</div>
      <div class="rec-foot">${weekLabel} <b>${fmt(week)}자</b></div>
      ${lineChartHtml(linePts)}
      ${isThisWeek && (base === null || base === undefined)
        ? `<p class="hint">아직 출발선을 안 잡았어요. 글자수 칸에서 지금 원고의 전체 글자수를 적어주세요.</p>`
        : ""}`;
  }

  /* =====================================================================
     📓 전체 기록 — 방 전체를 달 단위 달력으로

     [어디서 끌어오나]
       글자수 : wordlog/{날짜}/{닉} = { total } — 그날 사람들이 쓴 양.
                한 달치를 키 범위로 한 번에 읽습니다.
       🍅     : users/{닉}/pomoSessions/{날짜} = { count }
                이건 사람별로 흩어져 있어서, 그 달에 흔적이 있는 닉만
                골라 한 명씩 읽습니다. 방 인원이 열댓이라 부담이 없어요.
                (users 를 통째로 읽으면 투두·작업구간까지 딸려 와 무겁습니다)

     [왜 캐시를 두는가]
     달을 앞뒤로 넘길 때마다 같은 달을 다시 받아오면 느립니다.
     한 번 받은 달은 창을 닫기 전까지 들고 있습니다.
     ===================================================================== */
  const _wcAllCache = {};      // { "2026-08": { days:{일:{chars,pomo,byNick}}, total, pomo } }
  let _wcAllOffset = 0;        // 0 = 이번 달, 1 = 지난 달 …

  function monthKeyOf(offset) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  async function loadMonthAll(mKey) {
    if (_wcAllCache[mKey]) return _wcAllCache[mKey];

    const from = `${mKey}-01`, to = `${mKey}-31`;
    const days = {};

    /* ── 글자수 — 한 달치 한 번에 ── */
    const wSnap = await window.db.ref("wordlog").orderByKey()
      .startAt(from).endAt(to).once("value");
    const nicks = new Set();
    wSnap.forEach(dayNode => {
      const day = dayNode.key;
      const byNick = {};
      let sum = 0;
      dayNode.forEach(nickNode => {
        const n = nickNode.key;
        const t = Math.max(0, Number(nickNode.val()?.total || 0));
        if (t > 0) { byNick[n] = t; sum += t; nicks.add(n); }
      });
      days[day] = { chars: sum, pomo: 0, byNick };
    });

    /* ── 🍅 — 그 달에 흔적이 있는 사람 + 지금 접속 중인 사람 ── */
    Object.keys(window._statusCache || {}).forEach(n => nicks.add(n));
    await Promise.all([...nicks].map(async (n) => {
      try {
        const s = await window.db.ref(`users/${n}/pomoSessions`).once("value");
        const v = s.val() || {};
        Object.entries(v).forEach(([day, o]) => {
          if (!day.startsWith(mKey)) return;
          const c = Math.max(0, Number(o?.count || 0));
          if (!c) return;
          (days[day] = days[day] || { chars: 0, pomo: 0, byNick: {} }).pomo += c;
        });
      } catch (e) {}
    }));

    const total = Object.values(days).reduce((a, v) => a + v.chars, 0);
    const pomo  = Object.values(days).reduce((a, v) => a + v.pomo, 0);
    const wrote = Object.values(days).filter(v => v.chars > 0).length;
    const out = { days, total, pomo, wrote };
    _wcAllCache[mKey] = out;
    return out;
  }

  function wcAllHtml(mKey, data) {
    const [y, m] = mKey.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const last  = new Date(y, m, 0).getDate();
    const lead  = first.getDay();                 // 0=일
    const today = dayKey();
    const isThisMonth = mKey === monthKeyOf(0);

    let cells = "";
    for (let i = 0; i < lead; i++) cells += `<div class="wcal-cell is-blank"></div>`;
    for (let d = 1; d <= last; d++) {
      const key = `${mKey}-${String(d).padStart(2, "0")}`;
      const v = data.days[key] || { chars: 0, pomo: 0, byNick: {} };
      const has = v.chars > 0 || v.pomo > 0;
      const who = Object.entries(v.byNick)
        .sort((a, b) => b[1] - a[1])
        .map(([n, t]) => `${n} ${fmt(t)}자`).join(" · ");
      const tip = has ? `${key}\n${who || "글자수 기록 없음"}${v.pomo ? `\n🍅 ${v.pomo}회` : ""}` : key;
      cells += `<div class="wcal-cell${has ? " has" : ""}${key === today ? " is-today" : ""}"
                     title="${esc(tip)}">
        <span class="wcal-d">${d}</span>
        ${v.pomo ? `<span class="wcal-p">🍅${v.pomo}</span>` : ""}
        ${v.chars ? `<span class="wcal-c">${short(v.chars)}</span>` : ""}
      </div>`;
    }

    return `
      <div class="wcal-head">
        <button type="button" class="wcal-nav" data-wcall-move="1" title="지난 달">‹</button>
        <span class="wcal-title">${y}년 ${m}월</span>
        <button type="button" class="wcal-nav" data-wcall-move="-1" title="다음 달"
                ${isThisMonth ? "disabled" : ""}>›</button>
      </div>
      <div class="wcal-sum">이 달 <b>${fmt(data.total)}자</b> · 🍅 <b>${data.pomo}</b>회 · ${data.wrote}일 썼어요</div>
      <div class="wcal-dow">${["일","월","화","수","목","금","토"].map(s => `<span>${s}</span>`).join("")}</div>
      <div class="wcal-grid">${cells}</div>`;
  }

  /* 1,234 → 1.2k — 칸이 좁아서 네 자리가 넘으면 줄입니다 */
  function short(n) {
    n = Number(n) || 0;
    if (n < 1000) return String(n);
    const k = n / 1000;
    return (k >= 10 ? Math.round(k) : Math.round(k * 10) / 10) + "k";
  }

  async function renderWcAll() {
    const body = el("wcall-body");
    if (!body) return;
    const mKey = monthKeyOf(_wcAllOffset);
    body.innerHTML = `<div class="wc-empty">불러오는 중…</div>`;
    try {
      body.innerHTML = wcAllHtml(mKey, await loadMonthAll(mKey));
    } catch (e) {
      console.warn("[전체 기록]", e);
      body.innerHTML = `<div class="wc-empty">기록을 불러오지 못했어요.</div>`;
      return;
    }
    body.querySelectorAll("[data-wcall-move]").forEach(b => {
      b.addEventListener("click", () => {
        const next = _wcAllOffset + Number(b.dataset.wcallMove);
        if (next < 0) return;
        _wcAllOffset = next;
        renderWcAll();
      });
    });
  }

  function openWcAll() {
    const m = el("wcall-modal");
    if (!m) return;
    m.style.display = "flex";
    _wcAllOffset = 0;
    renderWcAll();
  }
  function closeWcAll() {
    const m = el("wcall-modal");
    if (m) m.style.display = "none";
  }
  window.openWcAll = openWcAll;
  window.closeWcAll = closeWcAll;

  window.Wordcount = { dayKey, weekDays, weekKeys, rollKeys, drawRows, drawFeed, sumWeek, myWeekHtml, addMyPomoLine,
                       _state: () => ({ today: _today, week: _week, feed: _feed,
                                        pomoLines: _pomoLines, tab: _tab }) };
})();
