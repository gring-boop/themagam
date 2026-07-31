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
       wordlog/{날짜}/{필명} = { total, base, at }

   날짜별로 나눠 담으면 "오늘"과 "이번 주"를 따로 세기 쉽고, 오래된
   것을 지우기도 편합니다. base(기준)까지 서버에 두는 이유는, 다른
   기기에서 이어 적어도 기준이 따라오게 하기 위해서입니다.
   ===================================================================== */
(function () {
  "use strict";

  const el = (id) => document.getElementById(id);

  let _tab   = "today";
  let _today = {};        // { 필명: {total, base} }
  let _week  = {};        // { 날짜: { 필명: {total} } }
  let _ref   = null;
  let _weekRefs = [];
  let _started = false;

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
      /* 내 요일별 기록 */
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
      /* 오늘·주간 탭은 **방 전체**를 보여줍니다.
         큰 숫자도 방 합계예요 — 다 같이 얼마나 썼는지가 이 칸의 재미라서,
         내 숫자만 크게 띄우면 볼 이유가 줄어듭니다. 내 기록은 아래
         한 줄과 '내 기록' 탭에서 봅니다. */
      const src = _tab === "today"
        ? Object.entries(_today).map(([n, v]) => [n, Number(v?.total || 0)])
        : Object.entries(sumWeek()).map(([n, v]) => [n, v]);
      const list = src.filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
      const roomSum = list.reduce((a, b) => a + b[1], 0);
      const mineVal = _tab === "today"
        ? Number(mine.total || 0)
        : Number(sumWeek()[me()] || 0);

      big.textContent  = fmt(roomSum);
      unit.textContent = "자 · " + (_tab === "today" ? "오늘" : "이번 주")
                       + " 방 전체 · 나 " + fmt(mineVal) + "자";
      rows.innerHTML = list.length
        ? drawRows(list, list.findIndex(x => x[0] === me()))
        : `<div class="wc-empty">아직 아무도 안 적었어요</div>`;
    }

    if (hint) {
      hint.textContent = (mine.base === null || mine.base === undefined)
        ? "지금 원고의 전체 글자수를 적고 기록을 누르세요. 그 숫자가 출발선이 됩니다."
        : `기준 ${fmt(mine.base)}자 · 다음에도 그때의 전체 글자수를 적으면 차이만 쌓여요.`;
    }
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
     --------------------------------------------------------------- */
  async function save(patch) {
    if (!me() || !window.db) return;
    try {
      await window.db.ref(`wordlog/${dayKey()}/${me()}`)
        .update({ ...patch, at: Date.now() });
    } catch (e) {
      say("저장하지 못했어요. 잠시 뒤 다시 해주세요.");
      console.warn("[wordcount save failed]", e);
    }
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
      await save({ base: v, total: next });
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
    _ref.on("value", snap => { _today = snap.val() || {}; render(); });

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
  window.Wordcount = { dayKey, weekDays, drawRows, sumWeek,
                       _state: () => ({ today: _today, week: _week, tab: _tab }) };
})();
