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
   users/{필명}/schedule 에 적어두던 "일정"(집필·마감·송고…)은 통째로
   뺐습니다. 사용자가 "일정은 지워줘, 할 일만 남길게"라고 했어요.
   서버에 남아 있는 옛 schedule 데이터는 **일부러 손대지 않습니다** —
   지우는 코드를 두면 실수로 남의 것까지 지울 위험만 생기고, 그냥
   두어도 아무 화면에도 나타나지 않아 무해합니다.

   [할 일은 여기서 만들지 않습니다 — 주인은 script_data.js]
   할 일 한 덩어리(users/{필명}/todos)의 주인은 script_data.js 입니다.
   여기서는 그 배열을 읽어 날짜별로 늘어놓고, 넣고 빼는 일은
   script_data.js 가 열어둔 창구(window.addTodoWithDue · toggleTodoDone ·
   editTodo · deleteTodo · toggleRoutineTodo · setTodoDue)에 부탁합니다.
   한 물건을 두 곳에서 고치게 만들면 언젠가 반드시 어긋나니까요.

   [어느 화면이 무엇을 보여주는가 — 이게 이 기능의 핵심 규칙입니다]
       프로필 팝업(#goals-modal)의 투두 목록
           → 오늘 날짜(due === 오늘) + 날짜 없는 것(due 없음)만
       나의 작업 · 📌 할 일 탭
           → 고른 날짜의 것 + (아래 칸에) 날짜 없는 것
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

  /* 내 필명 읽기.
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

  /* 반복(🔁)과 날짜는 함께 쓰지 않습니다 — 반복이 켜져 있으면 날짜가
     남아 있어도 "날짜 없음"으로 봅니다. (script_data.js 와 같은 규칙) */
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
  async function toggleVac(ds) {
    const nick = me();
    if (!nick || !window.db || !DUE_RE.test(ds)) return;
    const ref = window.db.ref(`users/${nick}/vacations/${ds}`);
    const next = !_vacs[ds];

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
        <span>🏖️ 이번 달 휴가 <b>${vacCount}일</b></span>
      </div>
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
  function todoRowHtml(t) {
    const routine = !!t.routine;
    return `
      <li class="mw-todo${t.done ? " is-done" : ""}" data-id="${esc(t.id)}">
        <label class="mw-todo-l">
          <input type="checkbox" class="mw-chk" data-id="${esc(t.id)}" ${t.done ? "checked" : ""}
                 aria-label="${esc(t.text || "할 일")} 완료">
          <span class="mw-todo-t">${esc(t.text || "")}</span>
          ${routine ? `<span class="mw-rbadge" title="매일 반복 — 자정에 체크가 풀려요">🔁</span>` : ""}
          ${t.archived ? `<span class="mw-abadge" title="프로필 목록에서 치운 할 일이에요 — 여기엔 기록으로 남습니다">🗃</span>` : ""}
        </label>
        <span class="mw-todo-btns">
          <button type="button" data-act="edit" data-id="${esc(t.id)}" title="고치기" aria-label="고치기">✏️</button>
          <button type="button" data-act="routine" data-id="${esc(t.id)}"
                  title="${routine ? "매일 반복 끄기" : "매일 반복으로 (날짜는 지워져요)"}"
                  aria-label="반복 바꾸기">🔁</button>
          <button type="button" data-act="del" data-id="${esc(t.id)}" title="지우기" aria-label="지우기">🗑</button>
        </span>
      </li>`;
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
      : `<p class="mw-empty">날짜 없는 할 일이 없어요.</p>`;

    return `
      <div class="mw-dayhead">
        <span class="mw-daytitle">${dowLabel(ds)}</span>
        ${isToday ? `<span class="mw-todaytag">오늘</span>` : ""}
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
        <span class="mw-daytitle">📎 날짜 없는 할 일</span>
        <span class="mw-daycount">${free.length}개</span>
      </div>

      ${freeList}

      <div class="mw-add">
        <label class="sr-only" for="mw-add-free">날짜 없는 할 일 추가</label>
        <input type="text" id="mw-add-free" class="mw-add-in" data-add="free"
               maxlength="${MAX_TEXT}" value="${esc(_draft.free)}"
               placeholder="날짜 없이 할 일 추가…" enterkeyhint="done">
        <button type="button" class="mw-add-btn" data-act="add-free" aria-label="날짜 없는 할 일 추가">＋</button>
      </div>

      <p class="mw-hint">
        프로필 팝업의 투두에는 <b>오늘 것과 날짜 없는 것</b>만 보여요.
        다른 날짜로 적어둔 일은 <b>그날이 되면 저절로</b> 거기에도 뜹니다.
        🔁 반복은 날짜와 함께 쓸 수 없어서 늘 이 아래 칸에 있어요.
      </p>`;
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
     --------------------------------------------------------------- */
  function syncTabs() {
    document.querySelectorAll("#mywork-tabs [data-mw-tab]").forEach(b => {
      const on = b.dataset.mwTab === _tab;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    ["todo", "goal", "time", "wc"].forEach(k => {
      const p = el("mywork-panel-" + k);
      if (p) p.classList.toggle("is-on", k === _tab);
    });
  }

  /* [2026-08-08] 탭이 넷이 됐습니다 — 할 일 · 목표 · 작업 시간 · 글자수.
     예전 "rec"(기록) 한 탭에 시간 그래프와 글자수 그래프가 함께 있었는데,
     한 화면에 그래프가 둘이면 지금 뭘 보는 건지 헷갈립니다. */
  const MW_TABS = ["todo", "goal", "time", "wc"];

  function switchMyWorkTab(name) {
    _tab = MW_TABS.includes(name) ? name : "todo";
    syncTabs();
    if (_tab === "todo") renderTodoPanel();
    else if (_tab === "goal") renderGoalPanel();
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

    /* 2) 버튼들 */
    const act = e.target.closest("[data-act]");
    if (act) { handleAct(act.dataset.act, act); return; }

    /* 3) 날짜 칸 — 단일 클릭은 잠깐 기다렸다가 "고르기" */
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

    if (act === "edit")    { window.editTodo?.(id); return; }
    if (act === "del")     { window.deleteTodo?.(id); return; }
    if (act === "routine") { window.toggleRoutineTodo?.(id); return; }
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
