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
       wordlog/{날짜}/{필명}   = { total, base, at }   ← 합계와 기준
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

   시간은 넣지 않습니다. 줄마다 시각이 붙으면 좁은 칸이 금세
   지저분해지고, 몇 시에 올렸는지는 사실 아무도 안 봅니다.

   남과 견주는 화면은 '내 기록' 탭 하나뿐이고, 거기서 견주는 상대는
   지난 요일의 나입니다.
   ===================================================================== */
(function () {
  "use strict";

  const el = (id) => document.getElementById(id);

  let _tab   = "today";
  let _today = {};        // { 필명: {total, base} }
  let _week  = {};        // { 날짜: { 필명: {total} } }
  let _feed  = [];        // [{ nick, add, at }] — 오늘 올라온 것들
  let _ref   = null;
  let _feedRef = null;
  let _weekRefs = [];
  let _started = false;

  const FEED_MAX = 60;    // 너무 길어지지 않게 최근 것만 봅니다

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

  const DOW_LABEL = ["월", "화", "수", "목", "금", "토", "일"];

  function fmt(n) { return Number(n || 0).toLocaleString(); }

  /* 내 필명 읽기.

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
      rows.innerHTML = drawRows(vals, vals.length - 1);
    } else {
      /* 오늘 탭 — 흐르는 기록. 순위도 막대도 없습니다. */
      const roomSum = Object.values(_today)
        .reduce((a, v) => a + Number(v?.total || 0), 0);
      big.textContent  = fmt(roomSum);
      unit.textContent = "자 · 오늘 방 전체 · 나 " + fmt(mine.total || 0) + "자";
      rows.innerHTML = drawFeed(_feed);
      /* 새 줄이 아래에 붙으므로 맨 아래를 보여줍니다 */
      rows.scrollTop = rows.scrollHeight;
    }

    if (hint) {
      hint.textContent = (mine.base === null || mine.base === undefined)
        ? "지금 원고의 전체 글자수를 적고 기록을 누르세요. 그 숫자가 출발선이 됩니다."
        : `기준 ${fmt(mine.base)}자 · 다음에도 그때의 전체 글자수를 적으면 차이만 쌓여요.`;
    }
  }

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
      const isMe = f.nick === me();
      const nick = esc(f.nick);
      /* 옛 기록에는 snap 이 없습니다. 그럴 땐 윗줄을 생략합니다. */
      const snap = (f.snap === undefined || f.snap === null) ? null : Number(f.snap);

      return `<div class="wc-feed${isMe ? " me" : ""}">
        ${snap === null ? "" : `
        <div class="wc-said-line">
          <div class="wc-said">
            ${isMe ? "" : `<span class="wc-said-nm">${nick}</span>`}
            <span class="wc-said-n">${fmt(snap)}자</span>
          </div>
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
      return "저장이 거부됐어요. 다른 창에서 다른 필명으로 들어가면 이 창의 로그인이 풀립니다. 새로고침 후 다시 입장해 주세요.";
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
    const v = inputVal();
    if (v === null) { say("숫자를 적어주세요."); return; }
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
    const v = inputVal();
    if (v === null) { say("먼저 지금 글자수를 적어주세요."); return; }
    await save({ base: v });
    clearInput();
    say(`기준을 ${fmt(v)}자로`);
  }

  async function resetTotal() {
    await save({ total: 0 });
    say("오늘 누적을 0으로 되돌렸어요");
  }

  async function freshStart() {
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

    detach();

    _ref = window.db.ref(`wordlog/${dayKey()}`);
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
    _feedRef = window.db.ref(`wordfeed/${dayKey()}`).limitToLast(FEED_MAX);
    _feedRef.on("value", snap => {
      const v = snap.val() || {};
      _feed = Object.values(v).sort((a, b) => Number(a.at || 0) - Number(b.at || 0));
      render();
    });

    /* 주간은 날짜마다 따로 붙습니다. 하루치씩이라 양이 적어요. */
    weekDays().forEach(k => {
      const r = window.db.ref(`wordlog/${k}`);
      r.on("value", snap => { _week[k] = snap.val() || {}; render(); });
      _weekRefs.push(r);
    });

    render();
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

    el("wc-input")?.addEventListener("keydown", (e) => {
      /* 한글 조합 중의 Enter 는 무시 — 숫자 칸이지만 습관대로 둡니다 */
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter") { e.preventDefault(); send(); }
    });

    host.querySelectorAll("[data-wc-tab]").forEach(b => {
      b.addEventListener("click", () => {
        _tab = b.dataset.wcTab;
        host.querySelectorAll("[data-wc-tab]").forEach(x => {
          const on = x === b;
          x.classList.toggle("on", on);
          x.setAttribute("aria-selected", on ? "true" : "false");
        });
        render();
      });
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
  function myWeekHtml() {
    const days = weekDays();
    const vals = days.map((k, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days.length - 1 - i));
      return [DOW_LABEL[(d.getDay() + 6) % 7], Number(_week[k]?.[me()]?.total || 0)];
    });
    const week = vals.reduce((a, b) => a + b[1], 0);
    const today = Number(myRow().total || 0);
    const base = myRow().base;

    return `
      <div class="rec-today">
        <div class="rec-big">${fmt(today)}자</div>
        <div class="rec-sub">오늘 쓴 글자수</div>
      </div>
      <div class="rec-h2">이번 주 · 요일별</div>
      <div class="wc-rows" style="max-height:none">${drawRows(vals, vals.length - 1)}</div>
      <div class="rec-foot">이번 주 <b>${fmt(week)}자</b></div>
      <p class="hint">
        ${base === null || base === undefined
          ? "아직 출발선을 안 잡았어요. 글자수 칸에서 지금 원고의 전체 글자수를 적어주세요."
          : `지금 기준은 <b>${fmt(base)}자</b>예요. 다음에도 그때의 전체 글자수를 적으면 차이만 쌓입니다.`}
      </p>`;
  }

  window.Wordcount = { dayKey, weekDays, drawRows, drawFeed, sumWeek, myWeekHtml,
                       _state: () => ({ today: _today, week: _week, feed: _feed, tab: _tab }) };
})();
