/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_mywork.js — 🗂️ 나의 작업 (출석 달력 · 할 일 · 목표 · 기록)
   ---------------------------------------------------------------------
   머리말의 [🗂️ 나의 작업] 버튼 하나로 열리는, 나 혼자 쓰는 책상입니다.
   예전에는 [📅 출석부]와 [🗓️ 일정]이 따로 있었는데, 결국 둘 다
   "내 하루를 들여다보는 창"이라 한 창으로 합쳤습니다.

   [화면]
       왼쪽 — 출석 달력 (붉은 ✓ 도장 · 🏖️ 휴가 · 그날 할 일 점)
       오른쪽 — 📌 할 일 / 🎯 목표 / 📊 기록  세 탭

   [일정 기능은 없앴습니다]
   users/{닉네임}/schedule 에 적어두던 "일정"(집필·마감·송고…)은 통째로
   뺐습니다. 사용자가 "일정은 지워줘, 할 일만 남길게"라고 했어요.
   서버에 남아 있는 옛 schedule 데이터는 **일부러 손대지 않습니다** —
   지우는 코드를 두면 실수로 남의 것까지 지울 위험만 생기고, 그냥
   두어도 아무 화면에도 나타나지 않아 무해합니다.

   [할 일은 여기서 만들지 않습니다 — 주인은 script_data.js]
   할 일 한 덩어리(users/{닉네임}/todos)의 주인은 script_data.js 입니다.
   여기서는 그 배열을 읽어 날짜별로 늘어놓고, 넣고 빼는 일은
   script_data.js 가 열어둔 창구(window.addTodoWithDue · toggleTodoDone ·
   editTodo · deleteTodo · toggleRoutineTodo · setTodoDue)에 부탁합니다.
   한 물건을 두 곳에서 고치게 만들면 언젠가 반드시 어긋나니까요.

   [어느 화면이 무엇을 보여주는가 — 이게 이 기능의 핵심 규칙입니다]
       프로필 팝업(#goals-modal)의 투두 목록
           → 오늘 날짜(due === 오늘) + 루틴(날짜 없는 것)만
       나의 작업 · 📌 할 일 탭
           → 고른 날짜의 것 + (아래 칸에) 루틴

   [2026-08-11 — 날짜 없는 할 일 = 루틴]
   전에는 아래 칸이 "📎 날짜 없는 할 일" 이었고, 줄마다 🔁 단추로 반복을
   따로 켰습니다. 그런데 마감 없는 큰 일정은 여기서 관리하지 않는다는
   게 방의 쓰임이었어요 — 대부분 오늘 할 일로 씁니다.
   그래서 아래 칸을 통째로 [🔁 루틴 (매일 반복)] 으로 바꿨습니다.
   거기 넣으면 무조건 매일 반복이고, 🔁 단추는 없앴습니다.
   그러니 "8월 20일" 이라고 적어둔 할 일은 프로필에 안 보이다가
   그날이 되면 저절로 뜹니다. 같은 배열이라 어느 쪽에서 고쳐도 곧바로
   양쪽에 반영됩니다.

   [누가 볼 수 있나 — 2026-08-08 부터 달라졌습니다]
   예전에는 users 노드가 .read: true 라 마음먹으면 남이 들여다볼 수
   있었습니다. 지금은 **본인과 방장만** 읽도록 규칙으로 막았어요.
   카드에 필요한 profile · pomoSessions · chattyParticipation 세 가지만
   따로 열어 두었습니다. 그래서 팝업 아래 문구도 고쳤습니다.

   ※ 방장은 관리자 페이지에서 모아 볼 수 있습니다. 서버를 가진 사람이
      데이터를 볼 수 있는 건 어느 서비스나 같지만, 멤버들이 그 사실을
      모르면 안 되므로 가이드에 적어 두었습니다.
   ===================================================================== */
(function () {
  "use strict";

  const DOW = ["일", "월", "화", "수", "목", "금", "토"];
  const MAX_TEXT = 120;
  const DUE_RE = /^\d{4}-\d{2}-\d{2}$/;

  /* 단일 클릭과 더블 클릭을 가르는 시간.
     브라우저는 더블클릭을 해도 click 을 먼저 두 번 보냅니다. 그래서
     첫 click 에서 곧장 날짜를 고르면, 휴가를 켜려고 두 번 눌렀을 때
     "고르기"까지 함께 일어나 화면이 덜컹거립니다. 잠깐 기다렸다가
     그 사이에 dblclick 이 오지 않으면 그때 고릅니다. */
  const DBL_MS = 280;

  /* ---------------------------------------------------------------
     상태
     --------------------------------------------------------------- */
  let _y = 0, _m = 0;          // 보고 있는 달 (m 은 0~11)
  let _sel = "";               // 고른 날짜 "YYYY-MM-DD"
  let _tab = "todo";           // "todo" | "goal" | "rec"
  let _days = {};              // 출석 도장   users/{닉}/attend/days
  let _vacs = {};              // 🏖️ 휴가     users/{닉}/vacations
  let _marksFor = "";          // 위 둘을 누구 것으로 읽어왔는가
  let _clickTimer = null;
  let _bound = false;
  let _draft = { day: "", free: "" };   // 입력칸에 치던 글 (다시 그려도 안 날아가게)
  let _wantFocus = "";                  // 다시 그린 뒤 초점을 돌려줄 입력칸

  /* ---------------------------------------------------------------
     자잘한 도구
     --------------------------------------------------------------- */

  /* 내 닉네임 읽기.
     script_core.js 의 `let myNick` 은 window 에 붙지 않습니다(let 규칙).
     이름 그대로 읽되 window 쪽도 함께 봅니다. */
  function me() {
    try { if (typeof myNick === "string" && myNick) return myNick; } catch (e) {}
    return window.myNick || "";
  }

  function esc(s) {
    if (window.escapeHtml) return window.escapeHtml(s);
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function el(id) { return document.getElementById(id); }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function dateStr(y, m0, d) { return `${y}-${pad2(m0 + 1)}-${pad2(d)}`; }

  /* 오늘 날짜를 "그 사람의 시계"로. toISOString() 은 UTC라서 한국 시간
     아침 9시 이전이면 하루 전으로 나옵니다. 직접 만듭니다. */
  function todayStr() {
    const d = new Date();
    return dateStr(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function dowLabel(ds) {
    const d = new Date(ds + "T00:00:00");
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
  }

  /* ---------------------------------------------------------------
     할 일 — 읽기 전용 창구
     --------------------------------------------------------------- */
  function items() {
    const src = (typeof window.getTodoItems === "function")
      ? window.getTodoItems()
      : window._todoItems;
    return (Array.isArray(src) ? src : []).filter(t => t && t.id);
  }

  /* 루틴과 날짜는 함께 쓰지 않습니다 — 루틴이면 날짜가 남아 있어도
     "날짜 없음"으로 봅니다. (script_data.js 와 같은 규칙)
     날짜가 없는 것은 곧 루틴이므로, undated() 가 루틴 목록이 됩니다. */
  function dueOf(t) {
    return (!t.routine && DUE_RE.test(String(t.due || ""))) ? String(t.due) : "";
  }

  function todosOf(ds) { return items().filter(t => dueOf(t) === ds); }
  function undated()   { return items().filter(t => !dueOf(t)); }

  /** 달력에 찍을 점 — { "2026-08-06": { n: 3, undone: 1 } } */
  function todoMarks() {
    const g = {};
    items().forEach(t => {
      const d = dueOf(t);
      if (!d) return;
      const o = g[d] || (g[d] = { n: 0, undone: 0 });
      o.n++;
      if (!t.done) o.undone++;
    });
    return g;
  }

  /* ---------------------------------------------------------------
     출석 도장 · 휴가 읽어오기
     --------------------------------------------------------------- */
  async function loadMarks(force) {
    const nick = me();
    if (!nick || !window.db) return;
    if (!force && _marksFor === nick) return;   // 같은 사람이면 다시 읽지 않습니다
    _marksFor = nick;
    try {
      _days = (await window.db.ref(`users/${nick}/attend/days`).once("value")).val() || {};
    } catch (e) { _days = {}; }
    try {
      _vacs = (await window.db.ref(`users/${nick}/vacations`).once("value")).val() || {};
    } catch (e) { _vacs = {}; }
  }

  /* 🏖️ 휴가 켜고 끄기 — users/{닉}/vacations/{YYYY-MM-DD} = true.
     users 하위라 기존 보안규칙(닉 주인만 쓰기)이 그대로 적용됩니다.

     script_realtime.js 의 toggleMyVacation 을 쓰지 않는 이유:
     그 함수는 끝에 showMyAttendance() 를 불러 **옛 출석 팝업**을
     띄웁니다. 여기서 부르면 팝업이 두 개 겹쳐요. */
  /* =====================================================================
     🏖️ 휴가 상한 (2026-08-13 콩의 결정 · 2026-08-17 입장일 비례로 고침)
     ---------------------------------------------------------------------
     [왜 상한이 있나]
     상한이 없으면 "이번 달 못 채울 것 같다 → 휴가 30일!" 로 18일 규칙이
     통째로 무력화됩니다. 7일이면 다 써도 의무가 14일 밑으로 안 내려가요.

     [왜 고정 7일이 문제였나 — 2026-08-17]
     의무 출석은 입장일에 따라 비율로 줄어드는데 휴가만 늘 7일이었습니다.
     그래서 **25일에 들어온 사람은 남은 7일을 전부 휴가로 찍어** 의무를
     0으로 만들 수 있었어요. 늦게 들어올수록 규칙이 헐거워지는 셈입니다.

     [셈법 — 의무 출석과 같은 비례식]
       상한 = 반올림( 멤버였던 날 ÷ 그 달 날수 × 7 )   (최소 1일)
     ★ 여기서는 휴가를 빼지 않습니다 — 휴가 상한을 정하는 데 휴가를
       쓰면 자기를 물고 도는 셈이 됩니다.
     ★ **최소 1일**은 보장합니다. 31일에 들어온 사람도 하루는 쉴 수
       있어야 해요 (반올림만 하면 0.23 → 0일이 됩니다).

     31일 달 기준 — 1일 입장 7일 · 11일 입장 5일 · 21일 입장 2일 ·
     29일 입장 1일.

     ★ 상한이 낮아져 **이미 찍은 휴가가 넘치는 경우**는 건드리지
       않습니다 (7/5 처럼 붉게 보일 뿐). 켜는 것만 막고, 푸는 길은
       늘 열어 둡니다.
     ★ 상한을 넘는 사정(장기 부재)은 휴가가 아니라 방장과 상의할 일 —
       안내 문구가 그 길을 알려줍니다.
     ===================================================================== */
  const VAC_DAYS = 7;   // ★ script_admin.js 와 같은 값이어야 합니다

  /* 내가 이 방에 처음 나타난 날 — 출석과 휴가 중 이른 쪽.
     (휴가만 찍힌 날도 "이미 멤버였다" 는 뜻이라 함께 봅니다) */
  function bornDay() {
    return [...Object.keys(_days), ...Object.keys(_vacs)].sort()[0] || null;
  }

  /* 이 달에서 "아직 없었던" 날이 며칠인가 */
  function beforeNOf(y, m, daysInMonth) {
    const born = bornDay();
    if (!born || born <= dateStr(y, m, 1)) return 0;
    let n = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (dateStr(y, m, d) >= born) break;
      n++;
    }
    return n;
  }

  /* 🏖️ 이 달 휴가 상한 — ★ script_admin.js 의 vacCapOf 와 같은 셈법 */
  function vacCapOf(y, m) {
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const member = daysInMonth - beforeNOf(y, m, daysInMonth);
    if (member <= 0) return 0;                       // 아직 멤버가 아니던 달
    return Math.max(1, Math.round((member / daysInMonth) * VAC_DAYS));
  }

  function vacCountOfMonth(ym) {
    return Object.keys(_vacs).filter(k => k.startsWith(ym)).length;
  }

  async function toggleVac(ds) {
    const nick = me();
    if (!nick || !window.db || !DUE_RE.test(ds)) return;
    const ref = window.db.ref(`users/${nick}/vacations/${ds}`);
    const next = !_vacs[ds];

    /* 켜는 것만 막습니다 — 끄는 것은 언제나 됩니다 (풀 길은 늘 열려 있게) */
    const cap = vacCapOf(Number(ds.slice(0, 4)), Number(ds.slice(5, 7)) - 1);
    if (next && vacCountOfMonth(ds.slice(0, 7)) >= cap) {
      alert(`🏖️ 이 달 휴가는 ${cap}일까지예요.\n` +
            `들어온 날부터 남은 날수에 맞춰 정해집니다 (한 달을 꽉 채우면 ${VAC_DAYS}일).\n` +
            `더 길게 쉬어야 하는 사정이 있으면 방장에게 말씀해 주세요!`);
      return;
    }

    /* 화면이 먼저 반응하도록 손에 든 값을 먼저 고칩니다 */
    if (next) _vacs[ds] = true; else delete _vacs[ds];
    renderCal();

    try {
      if (next) await ref.set(true); else await ref.remove();
    } catch (e) {
      console.warn("[나의 작업] 휴가 저장 실패", e);
      alert("휴가 표시를 저장하지 못했어요. 연결을 확인해 주세요.");
      /* 못 썼으면 되돌립니다 */
      if (next) delete _vacs[ds]; else _vacs[ds] = true;
      renderCal();
    }
  }

  /* ---------------------------------------------------------------
     화면 그리기 — 왼쪽 달력
     --------------------------------------------------------------- */
  /* =====================================================================
     📏 이번 달 의무 출석 (2026-08-13)
     ---------------------------------------------------------------------
     관리자 출석부의 규칙 칸과 **같은 셈법**입니다 (script_admin.js 의
     ruleOf — 고치면 둘 다 고쳐야 해요, checks 가 어긋남을 잡습니다).

       · 기준은 한 달 18일 — 달이 28일이든 31일이든 **똑같이 18일**입니다.
         비율식(eff/daysInMonth × 18)이라 달을 꽉 채운 사람은 언제나
         eff = daysInMonth 이 되어 정확히 18이 나와요.
       · 이 달 중간에 들어온 사람은 있은 날만큼 비율로 줄고,
       · 🏖️ 휴가를 찍으면 그 날수만큼 기준이 자동으로 내려갑니다.
     ===================================================================== */
  const RULE_DAYS = 18;   // ★ script_admin.js 와 같은 값이어야 합니다

  function ruleInfo(y, m, attended, vacCount) {
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = todayStr();
    const 이달첫날 = dateStr(y, m, 1);
    const 이달끝날 = dateStr(y, m, daysInMonth);
    if (이달첫날 > today) return null;                  // 다음 달 — 셀 것이 없어요

    /* 입장 전 날 세기 — 내 기록(출석·휴가)의 첫 날 이전은 셈에서 뺍니다.
       ★ 휴가 상한(vacCapOf)도 같은 beforeNOf 를 씁니다 — 두 숫자가
         같은 자를 쓰게 해야 "의무는 줄었는데 휴가는 안 줄었네" 가
         안 생깁니다. */
    const beforeN = beforeNOf(y, m, daysInMonth);
    const member = daysInMonth - beforeN;
    const eff = Math.max(0, member - vacCount);
    const need = Math.round((eff / daysInMonth) * RULE_DAYS);

    /* 남은 날 — 오늘 이후, 앞으로 낼 휴가는 뺍니다 (두 번 봐주지 않게) */
    const 이번달인가 = today >= 이달첫날 && today <= 이달끝날;
    let daysLeft = 0;
    if (이번달인가) {
      for (let d = 1; d <= daysInMonth; d++) {
        const k = dateStr(y, m, d);
        if (k > today && _vacs[k] !== true) daysLeft++;
      }
    }
    const state = attended >= need ? "ok"
                : (이번달인가 && attended + daysLeft >= need) ? "maybe" : "bad";
    return { need, daysInMonth, vacCount, beforeN, daysLeft, state, 이번달인가,
             vacCap: vacCapOf(y, m) };
  }

  function ruleHtml(y, m, attended, vacCount) {
    const r = ruleInfo(y, m, attended, vacCount);
    if (!r) return "";
    const pct = r.need ? Math.min(100, Math.round((attended / r.need) * 100)) : 100;

    let pill, cls;
    if (r.state === "ok") { cls = "ok"; pill = `${attended}일 — 다 채웠어요 🎉`; }
    else if (r.state === "maybe") {
      const 더 = r.need - attended;
      cls = 더 <= r.daysLeft / 2 ? "ok" : "maybe";
      pill = 더 <= r.daysLeft / 2
        ? `지금 ${attended}일 · 순항 중`
        : `지금 ${attended}일 · 남은 ${r.daysLeft}일 중 ${더}일!`;
    } else {
      cls = "bad";
      pill = r.이번달인가 ? `지금 ${attended}일 · 남은 날로는 어려워요` : `${attended}일 — 미달`;
    }

    /* 셈이 어디서 왔는지 보여줍니다 — 숫자가 하늘에서 떨어지면 억울해요 */
    const 조각 = [];
    if (r.beforeN) 조각.push(`입장 전 ${r.beforeN}일`);
    if (r.vacCount) 조각.push(`휴가 ${r.vacCount}일`);
    const 셈 = 조각.length
      ? ` (이번 달: ${r.daysInMonth}일 중 ${조각.join(" · ")} → <b>${r.need}일</b>)`
      : "";

    /* 🏖️ 상한도 입장일에 따라 줄어듭니다 (2026-08-17).
       달을 꽉 채운 사람에게는 굳이 "비율" 을 설명하지 않습니다 —
       7일이 그냥 7일인 사람에게는 없는 이야기라서요. */
    const 휴가줄 = r.vacCap >= VAC_DAYS
      ? `(한 달 ${VAC_DAYS}일까지)`
      : `(이 달은 <b>${r.vacCap}일</b>까지 — 늦게 들어온 만큼 ${VAC_DAYS}일에서 비율로 줄어요)`;

    return `
      <div class="mw-rule">
        <div class="mw-rule-head">
          <span class="mw-rule-t">📏 ${r.이번달인가 ? "이번 달" : "이 달"} 의무 출석 <b>${r.need}일</b></span>
          <span class="mw-rule-pill ${cls}">${pill}</span>
        </div>
        <div class="mw-rule-bar"><span class="mw-rule-fill ${cls}" style="width:${pct}%"></span></div>
        <p class="mw-rule-why">
          한 달 <b>${RULE_DAYS}일</b>이 기준이에요 — 달이 며칠이든 같아요.<br>
          이 달 중간에 들어왔으면 있은 날만큼 비율로 줄고,
          🏖️ <b>휴가를 찍으면 그만큼 자동으로 내려가요</b> ${휴가줄}${셈}
        </p>
      </div>`;
  }

  function calHtml() {
    const y = _y, m = _m;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const firstDow = new Date(y, m, 1).getDay();
    const today = todayStr();
    const marks = todoMarks();

    let attended = 0, vacCount = 0;
    let cells = DOW.map(d => `<span class="att-dow">${d}</span>`).join("");
    for (let i = 0; i < firstDow; i++) cells += `<span></span>`;

    for (let d = 1; d <= lastDay; d++) {
      const key = dateStr(y, m, d);
      const on = !!_days[key];
      const vac = !!_vacs[key];
      if (on) attended++;
      if (vac) vacCount++;

      const mk = marks[key];
      /* 미완료가 하나도 없으면 점을 옅게 — "다 했다"가 한눈에 보이게 */
      const dot = mk
        ? `<i class="mw-dot${mk.undone ? "" : " is-clear"}" aria-hidden="true"></i>`
        : "";

      const cls = ["att-day",
        on ? "on" : "", vac ? "vac" : "",
        key === today ? "today" : "",
        key === _sel ? "picked" : ""
      ].filter(Boolean).join(" ");

      const label = `${m + 1}월 ${d}일`
        + (on ? ", 출석" : "") + (vac ? ", 휴가" : "")
        + (mk ? `, 할 일 ${mk.n}개` : "");

      cells += `<span class="${cls}" data-d="${key}" role="button" tabindex="0"
                      aria-label="${label}" aria-pressed="${key === _sel ? "true" : "false"}"
                      title="${dowLabel(key)} — 클릭: 그날 할 일 · 더블 클릭: 휴가">${
        vac ? "🏖️" : (on ? "✓" : d)}${dot}</span>`;
    }

    return `
      <div class="mw-calhead">
        <button type="button" class="mw-nav" data-mv="-1" aria-label="지난 달">‹</button>
        <span class="mw-caltitle">${y}년 ${m + 1}월</span>
        <button type="button" class="mw-nav" data-mv="1" aria-label="다음 달">›</button>
        <button type="button" class="mw-todaybtn" data-act="today">오늘</button>
      </div>

      <div class="att-grid">${cells}</div>

      <div class="mw-calfoot">
        <span>${esc(me())} · 이 달 <b>${attended}일</b> 출석했어요</span>
        ${(() => {
          /* 🏖️ 쓴 날 / 이 달 상한 (2026-08-17). 상한은 입장일에 따라
             줄어듭니다 — vacCapOf 참고. 넘친 사람은 붉게만 보이고
             막지는 않습니다 (상한이 낮아지기 전에 찍어 둔 것). */
          const cap = vacCapOf(y, m);
          const over = vacCount > cap;
          return `<span class="mw-vac${over ? " over" : ""}"
                        title="휴가는 들어온 날부터 남은 날수에 맞춰 정해져요 (한 달을 꽉 채우면 ${VAC_DAYS}일)${
                          over ? " — 상한이 줄기 전에 찍어 둔 날은 그대로 둡니다" : ""}">
                    🏖️ 이 달 휴가 <b>${vacCount}/${cap}일</b></span>`;
        })()}
      </div>
      ${ruleHtml(y, m, attended, vacCount)}
      <p class="mw-calhint">
        <b>클릭</b> — 그날 할 일 보기 · <b>더블 클릭</b> — 휴가로 표시
      </p>`;
  }

  function renderCal() {
    const host = el("mywork-cal");
    if (!host) return;
    host.innerHTML = calHtml();
  }

  /* ---------------------------------------------------------------
     화면 그리기 — 📌 할 일 탭
     --------------------------------------------------------------- */
  /* =====================================================================
     할 일 한 줄 (2026-08-10 손봄)
     ---------------------------------------------------------------------
     [무엇이 바뀌었나]
       · ✏️ 단추를 없앴습니다. **글자를 누르면 그 자리에서** 고쳐집니다.
         예전에는 브라우저 기본 입력창(prompt)이 떠서, 한 글자 고치려고
         창이 뜨고 화면이 잠기고 확인을 눌러야 했어요.
       · 완료는 앞의 **체크 상자**만 맡습니다.
       · 지난 날짜인데 아직 안 끝낸 할 일에는 **[오늘 하기]** 가 붙습니다.

     ★ 예전에는 <label> 이 체크 상자와 글자를 **함께** 감싸고 있었습니다.
       그래서 글자를 눌러도 체크가 켜졌어요. 글자 클릭을 편집으로 쓰려면
       이 감싸기를 풀어야 합니다 — 안 그러면 고치려고 누를 때마다 완료로
       바뀝니다. 라벨을 걷어내고 체크 상자만 따로 세웠습니다.
     ===================================================================== */
  /* [2026-08-11] 🔁 단추와 🔁 딱지를 없앴습니다.
     반복은 이제 "루틴 칸에 있느냐" 로 정해지므로, 줄마다 켜고 끄는
     단추가 필요 없어졌어요. 칸 제목이 이미 [🔁 루틴 (매일 반복)] 이라
     딱지도 같은 말을 두 번 하는 셈이라 뺐습니다. */
  function todoRowHtml(t) {
    const routine = !!t.routine;
    /* 지난 날짜 + 아직 안 끝냄 → [오늘 하기].
       반복(🔁)은 날짜를 가질 수 없으니 해당 없습니다. */
    const due = String(t.due || "");
    const overdue = !t.done && !routine && DUE_RE.test(due) && due < todayStr();
    return `
      <li class="mw-todo${t.done ? " is-done" : ""}${overdue ? " is-overdue" : ""}" data-id="${esc(t.id)}">
        <input type="checkbox" class="mw-chk" data-id="${esc(t.id)}" ${t.done ? "checked" : ""}
               aria-label="${esc(t.text || "할 일")} 완료">
        <span class="mw-todo-t" data-act="edit-inline" data-id="${esc(t.id)}"
              role="button" tabindex="0" title="눌러서 고치기">${esc(t.text || "")}</span>
        ${t.archived ? `<span class="mw-abadge" title="프로필 목록에서 치운 할 일이에요 — 여기엔 기록으로 남습니다">🗃</span>` : ""}
        <span class="mw-todo-btns">
          ${overdue ? `<button type="button" class="mw-today-move" data-act="move-today" data-id="${esc(t.id)}"
                  title="오늘 날짜로 옮기기">오늘 하기</button>` : ""}
          <button type="button" data-act="del" data-id="${esc(t.id)}" title="지우기" aria-label="지우기">🗑</button>
        </span>
      </li>`;
  }

  /* ---------------------------------------------------------------
     제자리 편집 — 글자를 <input> 으로 바꿔치기
     ---------------------------------------------------------------
     Enter · 칸 밖을 누르면 저장, Esc 면 취소.
     빈 칸으로 두고 나가면 **원래 글이 그대로 남습니다** — 실수로 다
     지우고 빠져나갔을 때 이름 없는 할 일이 되면 안 되니까요.
     (지우려면 🗑 을 눌러야 합니다. 그쪽은 확인을 한 번 물어요) */
  function startInlineEdit(span) {
    if (!span || span.querySelector("input")) return;
    const id = span.dataset.id;
    const before = span.textContent;

    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "mw-todo-edit";
    inp.value = before;
    inp.setAttribute("aria-label", "할 일 고치기");
    span.textContent = "";
    span.appendChild(inp);
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);

    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      const next = inp.value;
      span.textContent = before;                 // 먼저 원래대로 (실패해도 글이 안 사라지게)
      if (save && window.setTodoText?.(id, next)) {
        renderTodoPanel();
        renderCal();
      }
    };
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter")  { e.preventDefault(); finish(true); }
      if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
    inp.addEventListener("blur", () => finish(true));
    /* 편집 중 클릭이 바깥 처리로 새지 않게 */
    inp.addEventListener("click", (e) => e.stopPropagation());
  }

  function todoPanelHtml() {
    const ds = _sel || todayStr();
    const isToday = ds === todayStr();
    const list = todosOf(ds);
    const doneN = list.filter(t => t.done).length;
    const free = undated();

    const dayList = list.length
      ? `<ul class="mw-todolist">${list.map(todoRowHtml).join("")}</ul>`
      : `<p class="mw-empty">이 날은 아직 적어둔 할 일이 없어요.</p>`;

    const freeList = free.length
      ? `<ul class="mw-todolist">${free.map(todoRowHtml).join("")}</ul>`
      : `<p class="mw-empty">아직 루틴이 없어요.</p>`;

    /* [2026-08-12] 날짜 앞뒤로 한 칸씩. 달력에서 짚는 것보다 빠르고,
       [오늘 하기] 로 어제 것을 정리할 때 특히 편합니다.
       ★ 앞으로 가는 [>] 는 막지 않습니다 — 내일 할 일을 미리 적어 두는
         분이 있어서요. 대신 오늘이 아니면 [오늘] 로 바로 돌아옵니다. */
    return `
      <div class="mw-dayhead">
        <button type="button" class="mw-daynav" data-act="day-prev"
                aria-label="하루 앞으로" title="하루 앞으로">‹</button>
        <span class="mw-daytitle">${dowLabel(ds)}</span>
        <button type="button" class="mw-daynav" data-act="day-next"
                aria-label="하루 뒤로" title="하루 뒤로">›</button>
        ${isToday
          ? `<span class="mw-todaytag">오늘</span>`
          : `<button type="button" class="mw-todaybtn" data-act="day-today"
                     title="오늘로 돌아가기">오늘로</button>`}
        <span class="mw-daycount">${list.length}개 중 ${doneN}개 완료</span>
      </div>

      ${dayList}

      <div class="mw-add">
        <label class="sr-only" for="mw-add-day">이 날짜에 할 일 추가</label>
        <input type="text" id="mw-add-day" class="mw-add-in" data-add="day"
               maxlength="${MAX_TEXT}" value="${esc(_draft.day)}"
               placeholder="${dowLabel(ds)}에 할 일 추가…" enterkeyhint="done">
        <button type="button" class="mw-add-btn" data-act="add-day" aria-label="이 날짜에 할 일 추가">＋</button>
      </div>

      <hr class="mw-sep">

      <div class="mw-dayhead">
        <span class="mw-daytitle">🔁 루틴 (매일 반복)</span>
        <span class="mw-daycount">${free.length}개</span>
      </div>

      ${freeList}

      <div class="mw-add">
        <label class="sr-only" for="mw-add-free">루틴 추가</label>
        <input type="text" id="mw-add-free" class="mw-add-in" data-add="free"
               maxlength="${MAX_TEXT}" value="${esc(_draft.free)}"
               placeholder="매일 반복할 일 추가…" enterkeyhint="done">
        <button type="button" class="mw-add-btn" data-act="add-free" aria-label="루틴 추가">＋</button>
      </div>

      <p class="mw-hint">
        여기 넣은 건 <b>매일 반복</b>돼요 — 자정이 지나면 체크가 다시 풀립니다.
      </p>

      <!-- [옮김 2026-08-09] 🧹 치우기.
           예전에는 카드 아래칸 팝업(#todo-block)에 있었는데, 그 팝업이
           없어지면서 누를 데가 사라졌습니다. 기능은 그대로예요 —
           지우는 게 아니라 완료한 것을 이 목록에서만 감춥니다. -->
      <div class="mw-foot">
        <button type="button" class="mw-btn" data-mw-clear="1"
                title="완료한 것을 이 목록에서만 감춰요 — 기록은 남습니다">🧹 완료한 것 치우기</button>
      </div>`;
  }

  function renderTodoPanel() {
    const host = el("mywork-panel-todo");
    if (!host) return;

    /* 다시 그리면 입력칸이 통째로 새로 생기면서 초점이 날아갑니다.
       치던 글은 _draft 에 남겨두고, 초점도 그 자리로 돌려줍니다. */
    const act = document.activeElement;
    const keep = (act && act.dataset && act.dataset.add) ? act.dataset.add : "";

    host.innerHTML = todoPanelHtml();

    const want = _wantFocus || keep;
    _wantFocus = "";
    if (want) {
      const inp = host.querySelector(`[data-add="${want}"]`);
      if (inp) {
        try {
          inp.focus();
          const n = inp.value.length;
          inp.setSelectionRange(n, n);
        } catch (e) {}
      }
    }
  }

  /* ---------------------------------------------------------------
     화면 그리기 — 🎯 목표 탭

     오늘 목표 입력칸과 [⏱️ 오늘 작업 시간 초기화] 버튼은 #status-block
     한 덩어리입니다. **다시 그리지 않고 통째로 옮겨옵니다** — 다시
     그리면 안에 걸린 저장 로직이 조용히 끊깁니다(예전에 겪었습니다).
     프로필 팝업을 열면 그쪽이 도로 가져가고, 여기 탭을 다시 누르면
     또 이쪽으로 옵니다. 덩어리는 늘 하나뿐이라 값이 어긋나지 않아요.
     --------------------------------------------------------------- */
  function renderGoalPanel() {
    const slot = el("mywork-goal-slot");
    if (!slot) return;
    if (typeof window.mountStatusBlock === "function") window.mountStatusBlock(slot);
  }

  /* ---------------------------------------------------------------
     화면 그리기 — 📊 기록 탭
     script_timelog.js 의 renderMyRecordPanel 이 #mywork-panel-rec 을
     찾아 그립니다. (예전에는 설정 모달의 📊 나의 작업 탭에 그렸어요)
     --------------------------------------------------------------- */
  function renderRecPanel() {
    if (typeof window.renderMyRecordPanel === "function") window.renderMyRecordPanel();
  }

  /* ---------------------------------------------------------------
     탭

     [2026-08-08] 넷으로 나눴습니다 — 할 일 · 목표 · 작업 시간 · 글자수.
     예전 "기록" 한 탭에 그래프가 둘이라 뭘 보는지 헷갈렸어요.
     [2026-08-09] 📮 쪽지가 붙어 다섯이 됐습니다.

     ※ 이 목록은 쓰는 곳(syncTabs)보다 **위에** 있어야 합니다.
        const 는 끌어올려지지 않아서, 아래에 두면 먼저 부를 때 터집니다.
     --------------------------------------------------------------- */
  const MW_TABS = ["todo", "goal", "time", "wc", "note", "achv"];

  function syncTabs() {
    document.querySelectorAll("#mywork-tabs [data-mw-tab]").forEach(b => {
      const on = b.dataset.mwTab === _tab;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    MW_TABS.forEach(k => {
      const p = el("mywork-panel-" + k);
      if (p) p.classList.toggle("is-on", k === _tab);
    });
  }

  function switchMyWorkTab(name) {
    _tab = MW_TABS.includes(name) ? name : "todo";
    syncTabs();
    if (_tab === "todo") renderTodoPanel();
    else if (_tab === "goal") renderGoalPanel();
    else if (_tab === "note") {
      /* 📮 쪽지 — 열면 받은 것을 읽음으로 바꿉니다 */
      window.renderNotePanel?.();
      window.markNotesRead?.();
    }
    else if (_tab === "achv") {
      /* 🏅 업적 — 알약을 눌러 여는 판과 **같은 내용**입니다.
         두 곳에서 따로 그리면 언젠가 어긋나므로, script_achv.js 가
         만든 것을 그대로 옮겨 담습니다. */
      const box = el("mywork-panel-achv");
      if (box) box.innerHTML = window.achvPanelHtml?.() || "";
    }
    else renderRecPanel();          // 작업 시간·글자수 둘 다 여기서 갈라집니다
  }

  /* ---------------------------------------------------------------
     손가락 붙이기 — 팝업 안은 통째로 위임합니다.
     다시 그릴 때마다 버튼에 하나씩 달면 반드시 새는 곳이 생겨요.
     --------------------------------------------------------------- */
  function bind() {
    if (_bound) return;
    const root = el("mywork-modal");
    if (!root) return;
    _bound = true;

    /* [고침 2026-08-06] 리스너를 바깥 덮개가 아니라 **안쪽 상자**에 답니다.

       [무엇이 잘못됐었나]
       팝업 껍데기(#mywork-modal)에는 "바깥을 누르면 닫기"가 걸려 있고,
       안쪽 상자(.modal-content)에는 onclick="event.stopPropagation()" 이
       붙어 있습니다. 그래서 안에서 누른 click 은 껍데기까지 올라오지
       못했고, 껍데기에 달아둔 이 리스너는 한 번도 불리지 않았습니다.
       (dblclick 은 막히지 않아서 휴가 토글만 되던 이유입니다) */
    const box = root.querySelector(".modal-content") || root;
    box.addEventListener("click", onClick);
    box.addEventListener("dblclick", onDblClick);
    box.addEventListener("input", onInput);
    box.addEventListener("change", onChange);
    box.addEventListener("keydown", onKeydown);
  }

  function onClick(e) {
    /* 1) 달 이동 */
    const nav = e.target.closest(".mw-nav[data-mv]");
    if (nav) {
      const d = new Date(_y, _m + Number(nav.dataset.mv), 1);
      _y = d.getFullYear(); _m = d.getMonth();
      renderCal();
      return;
    }

    /* 2) 🧹 치우기 */
    if (e.target.closest("[data-mw-clear]")) {
      window.clearCompletedTodos?.();
      renderTodoPanel();
      renderCal();
      return;
    }

    /* 3) 버튼들 */
    const act = e.target.closest("[data-act]");
    if (act) { handleAct(act.dataset.act, act); return; }

    /* 4) 날짜 칸 — 단일 클릭은 잠깐 기다렸다가 "고르기" */
    const cell = e.target.closest(".att-day[data-d]");
    if (cell) {
      const ds = cell.dataset.d;
      if (_clickTimer) { clearTimeout(_clickTimer); _clickTimer = null; }
      _clickTimer = setTimeout(() => { _clickTimer = null; selectDate(ds); }, DBL_MS);
    }
  }

  /* 두 번 누르면 🏖️ 휴가 토글 — 기다리던 "고르기"는 취소합니다 */
  function onDblClick(e) {
    const cell = e.target.closest(".att-day[data-d]");
    if (!cell) return;
    if (_clickTimer) { clearTimeout(_clickTimer); _clickTimer = null; }
    toggleVac(cell.dataset.d);
  }

  function selectDate(ds) {
    if (!DUE_RE.test(String(ds || ""))) return;
    _sel = ds;
    _tab = "todo";
    syncTabs();
    renderCal();
    renderTodoPanel();
  }

  function handleAct(act, node) {
    const id = node.dataset.id || "";

    if (act === "today") {
      const t = new Date();
      _y = t.getFullYear(); _m = t.getMonth();
      selectDate(todayStr());
      return;
    }

    if (act === "add-day")  { addFrom("day");  return; }
    if (act === "add-free") { addFrom("free"); return; }

    if (act === "edit-inline") { startInlineEdit(node); return; }

    /* 날짜 넘기기 — 달이 바뀌면 달력도 그 달로 따라갑니다.
       ★ 안 따라가면 "고른 날" 표시가 달력 밖에 있어서, 지금 어디를
         보고 있는지 알 수 없게 됩니다. */
    if (act === "day-prev" || act === "day-next") {
      const d = new Date((_sel || todayStr()) + "T12:00:00");
      d.setDate(d.getDate() + (act === "day-next" ? 1 : -1));
      const ds2 = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      _y = d.getFullYear(); _m = d.getMonth();
      selectDate(ds2);
      return;
    }
    if (act === "day-today") {
      const t = new Date();
      _y = t.getFullYear(); _m = t.getMonth();
      selectDate(todayStr());
      return;
    }

    /* [오늘 하기] — 못 끝낸 지난 할 일을 오늘 칸으로.
       날짜만 바꿉니다. 완료 여부·반복·글자는 그대로예요.

       ★ [고침 2026-08-12] 예전에는 옮긴 뒤 **보던 날짜까지 오늘로**
         넘겼습니다("옮긴 곳이 바로 보이게"). 그런데 어제 못 한 일이
         여러 개면, 하나 옮길 때마다 화면이 오늘로 튀어서 다시 어제로
         돌아와야 했어요. 세 개 옮기려면 여섯 번을 눌러야 합니다.

         이제 보던 날짜에 그대로 머뭅니다. 옮긴 것은 그 자리에서
         사라지니 무슨 일이 일어났는지도 보이고, 남은 것을 이어서
         누르면 됩니다. */
    if (act === "move-today") {
      window.setTodoDue?.(id, todayStr());
      renderCal();                               // 달력의 개수 표시만 새로
      renderTodoPanel();                         // 옮긴 줄이 목록에서 빠집니다
      return;
    }
    if (act === "del")     { window.deleteTodo?.(id); return; }
    /* [뺌 2026-08-11] act === "routine" (🔁 켜고 끄기).
       루틴 칸에 있는 것이 곧 반복이라 단추 자체를 없앴습니다.
       ★ script_data.js 의 toggleRoutineTodo 는 그대로 둡니다 — 부르는
         쪽이 없어도 해가 없고, 반대로 함수만 지우고 부르는 줄을 남기면
         그 자리에서 멈춥니다(8월 11일 [오늘 하기] 가 그랬어요). */
  }

  function onChange(e) {
    const t = e.target;
    if (t.matches && t.matches(".mw-chk[data-id]")) {
      window.toggleTodoDone?.(t.dataset.id, !!t.checked);
    }
  }

  function onInput(e) {
    const t = e.target;
    if (t.dataset && t.dataset.add) _draft[t.dataset.add] = t.value;
  }

  function onKeydown(e) {
    if (e.key !== "Enter") return;
    const t = e.target;
    if (!t.dataset || !t.dataset.add) return;
    /* 한글은 조합이 끝날 때 Enter 가 한 번 더 들어옵니다.
       그 Enter 를 받으면 마지막 자모가 별개의 할 일로 남아요. */
    if (e.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    addFrom(t.dataset.add);
  }

  /** 새 할 일 넣기 — 저장은 script_data.js 가 합니다 */
  function addFrom(kind) {
    const key = (kind === "free") ? "free" : "day";
    const text = String(_draft[key] || "").trim();
    if (!text) return;
    if (!me()) { alert("입장 후에 쓸 수 있어요."); return; }

    const due = (key === "day") ? (_sel || todayStr()) : "";
    _draft[key] = "";
    _wantFocus = key;

    if (typeof window.addTodoWithDue === "function") {
      window.addTodoWithDue(text, due);
      /* 저장 함수가 setTodoItemsToUI → renderMyWorkIfOpen 을 거쳐
         이 화면도 다시 그려주므로 여기서 또 그리지 않습니다. */
    } else {
      /* 창구가 없는 아주 옛 화면 대비 */
      const list = items().slice();
      const item = { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                     text, done: false, createdAt: Date.now() };
      if (due) item.due = due;
      list.unshift(item);
      window._todoItems = list;
      try { window.savePersonalData?.(); } catch (e) {}
      renderCal();
      renderTodoPanel();
    }
  }

  /* ---------------------------------------------------------------
     열기 / 닫기
     --------------------------------------------------------------- */
  function isOpen() {
    const m = el("mywork-modal");
    return !!m && m.style.display === "flex";
  }

  async function openMyWork() {
    if (!me()) { alert("입장 후에 볼 수 있어요."); return; }
    const modal = el("mywork-modal");
    if (!modal) return;

    const t = new Date();
    _y = t.getFullYear();
    _m = t.getMonth();
    _sel = todayStr();          // 열면 늘 오늘부터
    _tab = "todo";
    _draft = { day: "", free: "" };

    bind();
    modal.style.display = "flex";

    /* 출석·휴가는 먼저 빈 달력을 보여주고 나서 채웁니다 —
       서버를 기다리는 동안 화면이 멈춘 것처럼 보이지 않게. */
    syncTabs();
    renderCal();
    renderTodoPanel();

    await loadMarks(true);
    if (isOpen()) renderCal();
  }

  function closeMyWork() {
    const modal = el("mywork-modal");
    if (modal) modal.style.display = "none";
  }

  /* ESC 로도 닫히게 — 팝업이 열려 있을 때만 */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) closeMyWork();
  });

  /* 날짜 칸은 <span> 이라 Enter·Space 가 저절로 눌리지 않습니다.
     키보드로도 쓸 수 있게 직접 이어줍니다. */
  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    const cell = e.target.closest && e.target.closest("#mywork-cal .att-day[data-d]");
    if (!cell) return;
    e.preventDefault();
    selectDate(cell.dataset.d);
  });

  /* 할 일이 바뀌었을 때 script_data.js 가 불러주는 창구.
     팝업이 닫혀 있으면 아무것도 하지 않습니다(괜히 그리면 낭비니까요).

     프로필 팝업에서 ⋯ → 날짜 정하기로 날짜를 바꾸면, 여기를 거쳐
     달력의 점과 목록이 곧바로 따라 바뀝니다. */
  function renderMyWorkIfOpen() {
    if (!isOpen()) return;
    renderCal();
    if (_tab === "todo") renderTodoPanel();
  }

  window.openMyWork = openMyWork;
  window.closeMyWork = closeMyWork;
  window.switchMyWorkTab = switchMyWorkTab;
  window.renderMyWorkIfOpen = renderMyWorkIfOpen;
})();
