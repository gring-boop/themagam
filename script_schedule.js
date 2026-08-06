/* =====================================================================
   script_schedule.js — 개인 일정 팝업 (🗓️ 달력 · 📋 일정)
   ---------------------------------------------------------------------
   헤더의 🗓️ 일정 버튼을 누르면 열리는, 나 혼자 쓰는 일정표입니다.
   마감일·송고일처럼 "날짜가 정해진 일"을 적어두는 자리예요.

   [저장 위치]
       users/{내 필명}/schedule/{자동키}
         = { date: "YYYY-MM-DD", title, kind, state, memo, at }

   [비밀 이야기는 적지 마세요 — 솔직한 안내]
   보안규칙상 users/{필명} 아래는 **그 필명의 주인만 쓸 수 있습니다.**
   그러니 남이 내 일정을 고치거나 지울 수는 없습니다. 다만 users 노드는
   .read: true 라서, 마음먹고 데이터베이스를 들여다보는 사람은 남의
   일정도 읽을 수 있습니다. 채팅 기록이나 출석부와 같은 조건이에요.
   그래서 팝업 아래에도 "정말 비밀인 일정은 적지 마세요"라고 적어둡니다.
   (이 기능 때문에 보안규칙을 고칠 일은 없습니다 — 이미 충분합니다.)

   [왜 실시간 listener 인가]
   on("value") 로 붙여둡니다. 그래야 집 컴퓨터와 노트북처럼 두 탭을
   같이 켜 두어도 늘 같은 것을 봅니다. 또 달력 탭과 일정 탭이 **같은
   _items 한 덩어리**를 보고 그리므로, 한쪽에서 고치면 다른 쪽도
   저절로 맞춰집니다. (탭마다 따로 불러오면 반드시 어긋납니다)

   [화면을 다시 그리는 시점 — 조심한 곳]
   표 안에서 제목·메모를 직접 고칠 수 있게 만들었습니다. 그런데 글을
   치는 도중에 서버 신호가 와서 다시 그려버리면, 입력칸이 통째로
   새로 생기면서 **글자가 사라지고 커서가 튑니다.** 그래서 지금 무언가
   입력 중이면 다시 그리기를 미뤄뒀다가(_pending), 입력칸에서 손을 뗀
   뒤에 그립니다.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------------------------------------------------------------
     종류·상태 색표 — 여기만 고치면 팝업과 달력이 함께 바뀝니다.
     테마와 무관한 고정 색입니다. "마감은 늘 이 색"이어야 눈이
     기억하니까요. bg=칠, fg=글자.
     --------------------------------------------------------------- */
  const SCHEDULE_KINDS = [
    { id: "write",  label: "집필", bg: "#FAE3E1", fg: "#8C2A1F" },
    { id: "due",    label: "마감", bg: "#F5D9A8", fg: "#7A5A16" },
    { id: "send",   label: "송고", bg: "#E2EAD8", fg: "#3E5230" },
    { id: "submit", label: "투고", bg: "#DCEDF8", fg: "#2C4657" },
    { id: "judge",  label: "심사", bg: "#EDE5F5", fg: "#4B3A62" },
    { id: "none",   label: "무연", bg: "#E8E4DC", fg: "#4A443A" },
    { id: "etc",    label: "기타", bg: "#F1EEE7", fg: "#7A6A55" }
  ];

  const SCHEDULE_STATES = [
    { id: "todo",  label: "예정",   bg: "#F2ECDF", fg: "#7A6A55" },
    { id: "doing", label: "진행 중", bg: "#FAE3E1", fg: "#8C2A1F" },
    { id: "done",  label: "완료",   bg: "#E2EAD8", fg: "#3E5230" }
  ];

  /* 밖에서도 들여다볼 수 있게 (색만 살짝 바꿔보고 싶을 때) */
  window.SCHEDULE_KINDS  = SCHEDULE_KINDS;
  window.SCHEDULE_STATES = SCHEDULE_STATES;

  const KIND_DEFAULT  = "write";
  const STATE_DEFAULT = "todo";

  const MAX_PILL = 3;      // 달력 한 칸에 보여줄 알약 개수
  const MAX_TITLE = 80;
  const MAX_MEMO  = 200;

  const DOW = ["일", "월", "화", "수", "목", "금", "토"];

  /* ---------------------------------------------------------------
     상태
     --------------------------------------------------------------- */
  let _items = {};             // { 키: {date,title,kind,state,memo,at} }
  let _ref = null;             // 지금 붙어 있는 firebase ref
  let _refNick = "";           // 그 ref 가 누구 것인지
  let _tab = "cal";            // "cal" | "list"
  let _cur = null;             // { y, m }  (m 은 0~11)
  let _showAll = false;        // 일정 탭 "전체 보기"
  let _bound = false;          // 이벤트 한 번만 묶기
  let _pending = false;        // 입력 중이라 미뤄둔 다시 그리기

  /* 달력 탭 인라인 폼 */
  let _formDate = "";          // 폼이 열린 날짜 ("" 면 닫힘)
  let _formKey = "";           // 고치는 중인 일정 키 ("" 면 새 일정)
  let _formDraft = blankDraft();

  /* 일정 탭 "+ 새 일정" 줄 */
  let _newDraft = blankDraft();

  function blankDraft() {
    return { title: "", kind: KIND_DEFAULT, state: STATE_DEFAULT, memo: "" };
  }

  /* ---------------------------------------------------------------
     자잘한 도구
     --------------------------------------------------------------- */

  /* 내 필명 읽기.
     script_core.js 의 `let myNick` 은 window 에 붙지 않습니다(let/const
     규칙). 이름 그대로 읽되 window 쪽도 함께 봅니다.
     — script_wordcount.js 와 같은 방식입니다. */
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

  /* 오늘 날짜를 "그 사람의 시계"로. new Date().toISOString() 은 UTC라서
     한국 시간 아침 9시 이전이면 하루 전으로 나옵니다. 직접 만듭니다. */
  function todayStr() {
    const d = new Date();
    return dateStr(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function dateStr(y, m0, d) {
    return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function kindOf(id) {
    return SCHEDULE_KINDS.find(k => k.id === id) || SCHEDULE_KINDS[0];
  }
  function stateOf(id) {
    return SCHEDULE_STATES.find(s => s.id === id) || SCHEDULE_STATES[0];
  }

  function optionsHtml(list, cur) {
    return list.map(o =>
      `<option value="${o.id}"${o.id === cur ? " selected" : ""}>${esc(o.label)}</option>`
    ).join("");
  }

  /** 저장된 덩어리를 배열로 — 날짜순, 같은 날이면 적은 순서대로 */
  function allItems() {
    return Object.keys(_items).map(k => {
      const v = _items[k] || {};
      return {
        key: k,
        date: String(v.date || ""),
        title: String(v.title || ""),
        kind: v.kind || KIND_DEFAULT,
        state: v.state || STATE_DEFAULT,
        memo: String(v.memo || ""),
        at: Number(v.at || 0)
      };
    }).filter(it => /^\d{4}-\d{2}-\d{2}$/.test(it.date))
      .sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at);
  }

  function groupByDate() {
    const g = {};
    allItems().forEach(it => { (g[it.date] = g[it.date] || []).push(it); });
    return g;
  }

  function isOpen() {
    const m = el("schedule-modal");
    return !!m && m.style.display === "flex";
  }

  /* ---------------------------------------------------------------
     데이터베이스 붙이기
     --------------------------------------------------------------- */
  function scheduleRef() {
    const nick = me();
    if (!nick || !window.db) return null;
    if (_ref && _refNick === nick) return _ref;
    return null;
  }

  function attach() {
    const nick = me();
    if (!nick || !window.db) return;
    if (_ref && _refNick === nick) return;   // 이미 붙어 있음

    detach();
    _refNick = nick;
    _ref = window.db.ref(`users/${nick}/schedule`);
    _ref.on("value", snap => {
      _items = snap.val() || {};
      if (isOpen()) render();
    }, err => {
      console.warn("[일정] 불러오기 실패", err);
    });
  }

  function detach() {
    if (_ref) { try { _ref.off(); } catch (e) {} }
    _ref = null;
    _refNick = "";
    _items = {};
  }

  /* 필명이 바뀌면(다른 사람으로 재입장) 남의 일정이 보이면 안 되니 끊습니다 */
  window.addEventListener("beforeunload", detach);

  /* ---------------------------------------------------------------
     쓰기 — 추가 / 고치기 / 지우기
     --------------------------------------------------------------- */
  function addItem(o) {
    const ref = scheduleRef();
    if (!ref) { alert("입장 후에 쓸 수 있어요."); return false; }

    const title = String(o.title || "").trim();
    if (!title) { alert("일정 제목을 적어 주세요."); return false; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date || "")) { alert("날짜를 골라 주세요."); return false; }

    ref.push({
      date: o.date,
      title: title.slice(0, MAX_TITLE),
      kind: kindOf(o.kind).id,
      state: stateOf(o.state).id,
      memo: String(o.memo || "").trim().slice(0, MAX_MEMO),
      at: Date.now()
    }).catch(e => {
      console.warn("[일정] 저장 실패", e);
      alert("일정을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    });
    return true;
  }

  function updateItem(key, patch) {
    const ref = scheduleRef();
    if (!ref || !key) return;
    /* 화면이 먼저 반응하도록 손에 든 값도 같이 고쳐둡니다.
       (서버 신호가 오면 어차피 같은 값으로 덮어씁니다) */
    if (_items[key]) Object.assign(_items[key], patch);
    ref.child(key).update(patch).catch(e => {
      console.warn("[일정] 수정 실패", e);
    });
  }

  function removeItem(key) {
    const ref = scheduleRef();
    if (!ref || !key) return;
    delete _items[key];
    ref.child(key).remove().catch(e => {
      console.warn("[일정] 삭제 실패", e);
    });
  }

  /* ---------------------------------------------------------------
     화면 그리기
     --------------------------------------------------------------- */

  /** 지금 팝업 안에서 무언가 치고 있는가 (다시 그리면 커서가 튐) */
  function isTyping() {
    const a = document.activeElement;
    if (!a || !a.closest) return false;
    if (!a.closest("#schedule-body")) return false;
    return a.tagName === "INPUT" || a.tagName === "TEXTAREA";
  }

  function render() {
    const body = el("schedule-body");
    if (!body) return;

    if (isTyping()) { _pending = true; return; }
    _pending = false;

    body.innerHTML = _tab === "cal" ? calHtml() : listHtml();
    syncTabs();
  }

  function syncTabs() {
    document.querySelectorAll("#sch-tabs .tab").forEach(b => {
      const on = b.dataset.schTab === _tab;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  /* ── 🗓️ 달력 ─────────────────────────────────────────────── */
  function calHtml() {
    const y = _cur.y, m = _cur.m;
    const startDow = new Date(y, m, 1).getDay();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const today = todayStr();
    const g = groupByDate();

    let cells = "";
    /* 1일이 시작되기 전 빈 칸 */
    for (let i = 0; i < startDow; i++) {
      cells += `<div class="sch-cell sch-cell-blank" aria-hidden="true"></div>`;
    }
    for (let d = 1; d <= lastDay; d++) {
      const ds = dateStr(y, m, d);
      const list = g[ds] || [];
      const shown = list.slice(0, MAX_PILL);
      const rest = list.length - shown.length;
      const cls = [
        "sch-cell",
        ds === today ? "is-today" : "",
        ds === _formDate ? "is-picked" : ""
      ].filter(Boolean).join(" ");

      cells += `<div class="${cls}" data-date="${ds}" role="button" tabindex="0"
                     aria-label="${y}년 ${m + 1}월 ${d}일, 일정 ${list.length}개">
          <span class="sch-daynum">${d}</span>
          <span class="sch-pills">
            ${shown.map(pillHtml).join("")}
            ${rest > 0 ? `<span class="sch-more">+${rest}</span>` : ""}
          </span>
        </div>`;
    }

    return `
      <div class="sch-calhead">
        <button type="button" class="sch-nav" data-mv="-1" aria-label="지난 달">‹</button>
        <span class="sch-caltitle">${y}년 ${m + 1}월</span>
        <button type="button" class="sch-nav" data-mv="1" aria-label="다음 달">›</button>
        <button type="button" class="ghost-btn compact sch-todaybtn" data-act="today">오늘</button>
      </div>

      <div class="sch-dow">${DOW.map((d, i) =>
        `<span class="${i === 0 ? "sun" : i === 6 ? "sat" : ""}">${d}</span>`).join("")}</div>

      <div class="sch-grid">${cells}</div>

      ${formHtml()}

      <div class="sch-legend">
        ${SCHEDULE_KINDS.map(k =>
          `<span class="sch-pill sch-pill-static" style="background:${k.bg};color:${k.fg}">${k.label}</span>`
        ).join("")}
      </div>`;
  }

  function pillHtml(it) {
    const k = kindOf(it.kind);
    return `<button type="button" class="sch-pill${it.state === "done" ? " is-done" : ""}"
              data-key="${esc(it.key)}" style="background:${k.bg};color:${k.fg}"
              title="${esc(it.title)} · ${k.label} · ${stateOf(it.state).label}">${esc(it.title || "(제목 없음)")}</button>`;
  }

  /** 달력 아래에 열리는 인라인 폼 — 새로 넣기와 고치기가 같은 폼입니다 */
  function formHtml() {
    if (!_formDate) {
      return `<p class="hint sch-formhint">
        날짜 칸을 누르면 <b>그날 일정을 넣는 줄</b>이 열려요.
        이미 있는 알약을 누르면 그 일정을 고칠 수 있고요.</p>`;
    }

    const editing = !!_formKey;
    const d = _formDraft;
    const dd = new Date(_formDate + "T00:00:00");
    const label = `${dd.getMonth() + 1}월 ${dd.getDate()}일 (${DOW[dd.getDay()]})`;

    return `
      <div class="sch-form">
        <div class="sch-form-head">${label} · ${editing ? "일정 고치기" : "새 일정"}</div>
        <div class="sch-form-row">
          <input type="text" class="sch-in sch-in-grow" data-form="title"
                 placeholder="일정 제목" maxlength="${MAX_TITLE}" value="${esc(d.title)}">
          <select class="sch-sel" data-form="kind" aria-label="종류">${optionsHtml(SCHEDULE_KINDS, d.kind)}</select>
          <select class="sch-sel" data-form="state" aria-label="상태">${optionsHtml(SCHEDULE_STATES, d.state)}</select>
        </div>
        <div class="sch-form-row">
          <input type="text" class="sch-in sch-in-grow" data-form="memo"
                 placeholder="메모 (없어도 돼요)" maxlength="${MAX_MEMO}" value="${esc(d.memo)}">
          <button type="button" class="ghost-btn compact primary" data-act="${editing ? "save" : "add"}">${editing ? "저장" : "추가"}</button>
          ${editing ? `<button type="button" class="ghost-btn compact danger" data-act="del" data-k="${esc(_formKey)}">삭제</button>` : ""}
          <button type="button" class="ghost-btn compact" data-act="closeform">취소</button>
        </div>
      </div>`;
  }

  /* ── 📋 일정 (표) ─────────────────────────────────────────── */
  function listHtml() {
    const y = _cur.y, m = _cur.m;
    const prefix = `${y}-${String(m + 1).padStart(2, "0")}`;
    const rows = allItems().filter(it => _showAll || it.date.startsWith(prefix));
    const today = todayStr();

    const body = rows.length
      ? rows.map(it => rowHtml(it, today)).join("")
      : `<tr><td class="sch-empty" colspan="6">${_showAll
            ? "아직 적어둔 일정이 없어요."
            : `${y}년 ${m + 1}월에는 일정이 없어요. 전체 보기를 켜면 다른 달도 보여요.`}</td></tr>`;

    return `
      <div class="sch-listtop">
        <span class="sch-monthlabel">${_showAll ? "모든 일정" : `${y}년 ${m + 1}월`} · ${rows.length}개</span>
        <label class="sch-allchk">
          <input type="checkbox" data-act="showall"${_showAll ? " checked" : ""}> 전체 보기
        </label>
      </div>

      <div class="sch-tablewrap">
        <table class="sch-table">
          <thead>
            <tr>
              <th class="c-date">날짜</th>
              <th class="c-title">일정</th>
              <th class="c-kind">종류</th>
              <th class="c-state">상태</th>
              <th class="c-memo">메모</th>
              <th class="c-del"><span class="sr-only">삭제</span></th>
            </tr>
          </thead>
          <tbody>
            <tr class="sch-newrow">
              <td><input type="date" class="sch-in" data-new="date"
                         value="${esc(_newDraft.date || defaultNewDate())}" aria-label="새 일정 날짜"></td>
              <td><input type="text" class="sch-in" data-new="title" placeholder="+ 새 일정"
                         maxlength="${MAX_TITLE}" value="${esc(_newDraft.title)}" aria-label="새 일정 제목"></td>
              <td><select class="sch-sel" data-new="kind" aria-label="새 일정 종류">${optionsHtml(SCHEDULE_KINDS, _newDraft.kind)}</select></td>
              <td><select class="sch-sel" data-new="state" aria-label="새 일정 상태">${optionsHtml(SCHEDULE_STATES, _newDraft.state)}</select></td>
              <td><input type="text" class="sch-in" data-new="memo" placeholder="메모"
                         maxlength="${MAX_MEMO}" value="${esc(_newDraft.memo)}" aria-label="새 일정 메모"></td>
              <td><button type="button" class="ghost-btn compact primary sch-addbtn" data-act="newadd">추가</button></td>
            </tr>
            ${body}
          </tbody>
        </table>
      </div>

      <p class="hint">
        제목·메모는 <b>눌러서 바로 고칠 수</b> 있어요 (Enter 또는 다른 곳을 누르면 저장).
        종류·상태는 고르는 즉시 저장됩니다.
      </p>`;
  }

  function rowHtml(it, today) {
    const k = kindOf(it.kind), s = stateOf(it.state);
    const dd = new Date(it.date + "T00:00:00");
    const dow = DOW[dd.getDay()];
    const done = it.state === "done";

    return `
      <tr class="sch-row${done ? " is-done" : ""}${it.date === today ? " is-today" : ""}" data-k="${esc(it.key)}">
        <td class="c-date"><span class="sch-date">${it.date.slice(5).replace("-", ".")}</span><span class="sch-dowmark">(${dow})</span></td>
        <td class="c-title">
          <input type="text" class="sch-inline sch-inline-title" data-k="${esc(it.key)}" data-f="title"
                 maxlength="${MAX_TITLE}" value="${esc(it.title)}" aria-label="일정 제목">
        </td>
        <td class="c-kind">
          <select class="sch-sel sch-sel-tag" data-k="${esc(it.key)}" data-f="kind"
                  style="background:${k.bg};color:${k.fg}" aria-label="종류">${optionsHtml(SCHEDULE_KINDS, it.kind)}</select>
        </td>
        <td class="c-state">
          <select class="sch-sel sch-sel-tag" data-k="${esc(it.key)}" data-f="state"
                  style="background:${s.bg};color:${s.fg}" aria-label="상태">${optionsHtml(SCHEDULE_STATES, it.state)}</select>
        </td>
        <td class="c-memo">
          <input type="text" class="sch-inline" data-k="${esc(it.key)}" data-f="memo"
                 maxlength="${MAX_MEMO}" value="${esc(it.memo)}" placeholder="—" aria-label="메모">
        </td>
        <td class="c-del">
          <button type="button" class="sch-del" data-act="del" data-k="${esc(it.key)}"
                  aria-label="이 일정 지우기" title="지우기">✕</button>
        </td>
      </tr>`;
  }

  /** 새 일정 줄의 기본 날짜 — 보고 있는 달의 오늘, 다른 달이면 그 달 1일 */
  function defaultNewDate() {
    const t = new Date();
    if (!_cur) return todayStr();
    if (t.getFullYear() === _cur.y && t.getMonth() === _cur.m) return todayStr();
    return dateStr(_cur.y, _cur.m, 1);
  }

  /* ---------------------------------------------------------------
     손가락 붙이기 — 팝업 안은 통째로 위임합니다.
     다시 그릴 때마다 버튼에 하나씩 달면 반드시 새는 곳이 생겨요.
     --------------------------------------------------------------- */
  function bind() {
    if (_bound) return;
    const body = el("schedule-body");
    if (!body) return;
    _bound = true;

    body.addEventListener("click", onClick);
    body.addEventListener("change", onChange);
    body.addEventListener("input", onInput);
    body.addEventListener("keydown", onKeydown);

    /* 입력칸에서 손을 떼면 → 저장하고, 미뤄둔 다시 그리기를 처리 */
    body.addEventListener("focusout", () => {
      setTimeout(() => {
        if (_pending && !isTyping()) render();
      }, 0);
    });
  }

  function onClick(e) {
    /* 1) 달력 알약 — 그 일정을 폼에 채워 엽니다 (칸 클릭보다 먼저) */
    const pill = e.target.closest(".sch-pill[data-key]");
    if (pill) {
      e.stopPropagation();
      const key = pill.dataset.key;
      const it = _items[key];
      if (!it) return;
      _formDate = String(it.date || "");
      _formKey = key;
      _formDraft = {
        title: String(it.title || ""),
        kind: kindOf(it.kind).id,
        state: stateOf(it.state).id,
        memo: String(it.memo || "")
      };
      render();
      focusForm();
      return;
    }

    /* 2) 버튼들 */
    const act = e.target.closest("[data-act]");
    if (act) {
      handleAct(act.dataset.act, act);
      return;
    }

    /* 3) 달 이동 */
    const nav = e.target.closest(".sch-nav[data-mv]");
    if (nav) {
      moveMonth(Number(nav.dataset.mv));
      return;
    }

    /* 4) 날짜 칸 — 그 날짜로 새 일정 폼 */
    const cell = e.target.closest(".sch-cell[data-date]");
    if (cell) {
      const ds = cell.dataset.date;
      if (_formDate === ds && !_formKey) { closeForm(); return; }  // 같은 칸을 또 누르면 닫기
      _formDate = ds;
      _formKey = "";
      _formDraft = blankDraft();
      render();
      focusForm();
    }
  }

  function handleAct(act, node) {
    if (act === "today") {
      const t = new Date();
      _cur = { y: t.getFullYear(), m: t.getMonth() };
      render();
      return;
    }

    if (act === "closeform") { closeForm(); return; }

    if (act === "add") {
      if (addItem({ ..._formDraft, date: _formDate })) closeForm();
      return;
    }

    if (act === "save") {
      const title = String(_formDraft.title || "").trim();
      if (!title) { alert("일정 제목을 적어 주세요."); return; }
      updateItem(_formKey, {
        title: title.slice(0, MAX_TITLE),
        kind: _formDraft.kind,
        state: _formDraft.state,
        memo: String(_formDraft.memo || "").trim().slice(0, MAX_MEMO)
      });
      closeForm();
      return;
    }

    if (act === "del") {
      const key = node.dataset.k || _formKey;
      const it = _items[key];
      const name = it && it.title ? `“${it.title}”` : "이 일정";
      if (!confirm(`${name} 을(를) 지울까요?`)) return;
      removeItem(key);
      if (key === _formKey) closeForm(); else render();
      return;
    }

    if (act === "newadd") {
      const row = node.closest("tr");
      const dateEl = row && row.querySelector('[data-new="date"]');
      const date = dateEl ? dateEl.value : "";
      if (addItem({ ..._newDraft, date })) {
        _newDraft = blankDraft();
        _newDraft.date = date;    // 같은 날 여러 개 적는 일이 많아서 날짜는 남깁니다
        render();
      }
      return;
    }
  }

  function onChange(e) {
    const t = e.target;

    /* 표 안의 종류·상태 드롭다운 — 고르는 즉시 저장 */
    if (t.matches("select[data-k][data-f]")) {
      updateItem(t.dataset.k, { [t.dataset.f]: t.value });
      render();
      return;
    }

    /* 달력 폼 드롭다운 */
    if (t.matches("[data-form]")) {
      _formDraft[t.dataset.form] = t.value;
      return;
    }

    /* 새 일정 줄 */
    if (t.matches("[data-new]")) {
      _newDraft[t.dataset.new] = t.value;
      return;
    }

    /* 전체 보기 */
    if (t.matches('[data-act="showall"]')) {
      _showAll = !!t.checked;
      render();
    }
  }

  function onInput(e) {
    const t = e.target;
    /* 글을 치는 동안에는 다시 그리지 않고 초안만 기억합니다 */
    if (t.matches("[data-form]")) { _formDraft[t.dataset.form] = t.value; return; }
    if (t.matches("[data-new]"))  { _newDraft[t.dataset.new] = t.value; return; }
  }

  function onKeydown(e) {
    if (e.key !== "Enter") return;
    const t = e.target;

    /* 표 안 인라인 편집 — Enter 로 저장(=손 떼기) */
    if (t.matches("input.sch-inline[data-k][data-f]")) {
      e.preventDefault();
      saveInline(t);
      t.blur();
      return;
    }

    /* 달력 폼에서 Enter → 추가/저장 */
    if (t.matches("[data-form]")) {
      e.preventDefault();
      const btn = document.querySelector('#schedule-body .sch-form [data-act="add"], #schedule-body .sch-form [data-act="save"]');
      if (btn) btn.click();
      return;
    }

    /* 새 일정 줄에서 Enter → 추가 */
    if (t.matches("[data-new]")) {
      e.preventDefault();
      const btn = document.querySelector('#schedule-body [data-act="newadd"]');
      if (btn) btn.click();
    }
  }

  /* 인라인 편집 저장 — focusout 로 잡습니다(위임이 되도록 capture) */
  function bindInlineBlur() {
    const body = el("schedule-body");
    if (!body || body._schBlurBound) return;
    body._schBlurBound = true;
    body.addEventListener("focusout", (e) => {
      const t = e.target;
      if (t && t.matches && t.matches("input.sch-inline[data-k][data-f]")) saveInline(t);
    });
  }

  function saveInline(input) {
    const key = input.dataset.k, f = input.dataset.f;
    const it = _items[key];
    if (!it) return;
    const max = f === "title" ? MAX_TITLE : MAX_MEMO;
    const v = String(input.value || "").trim().slice(0, max);

    if (f === "title" && !v) {          // 제목을 비우면 원래대로 되돌립니다
      input.value = String(it.title || "");
      return;
    }
    if (String(it[f] || "") === v) return;   // 안 바뀌었으면 쓰지 않습니다
    updateItem(key, { [f]: v });
  }

  function focusForm() {
    const inp = document.querySelector('#schedule-body .sch-form [data-form="title"]');
    if (inp) { try { inp.focus(); inp.select(); } catch (e) {} }
  }

  function closeForm() {
    _formDate = "";
    _formKey = "";
    _formDraft = blankDraft();
    render();
  }

  function moveMonth(delta) {
    const d = new Date(_cur.y, _cur.m + delta, 1);
    _cur = { y: d.getFullYear(), m: d.getMonth() };
    closeForm();          // 달을 옮기면 열려 있던 폼은 닫습니다 (날짜가 어긋나니까)
  }

  /* ---------------------------------------------------------------
     열기 / 닫기 / 탭
     --------------------------------------------------------------- */
  function openSchedule() {
    if (!me()) { alert("입장 후에 쓸 수 있어요."); return; }
    const modal = el("schedule-modal");
    if (!modal) return;

    if (!_cur) {
      const t = new Date();
      _cur = { y: t.getFullYear(), m: t.getMonth() };
    }
    _tab = "cal";              // 열면 늘 달력부터
    _formDate = "";
    _formKey = "";
    _formDraft = blankDraft();

    attach();
    bind();
    bindInlineBlur();

    modal.style.display = "flex";
    render();
  }

  function closeSchedule() {
    const modal = el("schedule-modal");
    if (modal) modal.style.display = "none";
    /* listener 는 끊지 않습니다 — 다시 열 때 바로 보이게 하려고요.
       (데이터가 작아서 붙어 있어도 부담이 없습니다) */
  }

  function switchScheduleTab(name) {
    _tab = (name === "list") ? "list" : "cal";
    if (!_newDraft.date) _newDraft.date = defaultNewDate();
    render();
  }

  /* ESC 로도 닫히게 — 팝업이 열려 있을 때만 */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) closeSchedule();
  });

  window.openSchedule = openSchedule;
  window.closeSchedule = closeSchedule;
  window.switchScheduleTab = switchScheduleTab;
})();
