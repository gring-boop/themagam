/* =====================================================================
   script_timelog.js — 상태별 작업 시간 기록 + 기록 팝업
   ---------------------------------------------------------------------
   [왜 이렇게 만들었나]

   "몇 초마다 시간을 더하는" 방식으로 짜면 반드시 틀어집니다.
   브라우저는 가려진 탭의 타이머를 늦추거나 멈추기 때문입니다.
   작가님들은 대개 다른 앱(한글·스크리브너 등)에서 글을 쓰므로,
   이 창은 거의 항상 백그라운드에 있습니다. 그 상태로 타이머를 믿으면
   실제로 세 시간 쓴 사람이 20분으로 기록됩니다.

   그래서 "구간"으로 남깁니다.
       상태가 바뀌는 순간에만  {상태, 시작, 끝} 을 한 줄 적습니다.
   중간에 타이머가 멈춰도 양 끝점만 정확하면 총량은 정확합니다.

   [무엇을 근거로 "없었다"고 볼 것인가]

   처음에는 "타이머가 10분간 안 돌았으면 자리비움"으로 잡았습니다.
   그런데 이건 위험한 규칙이었습니다. 브라우저가 백그라운드 탭을 얼려
   버리면 타이머도 멈추는데, 그때 작가님은 다른 앱에서 열심히 쓰고 있을
   수 있습니다. 실제로 글을 쓴 시간이 자리비움으로 찍히는 셈입니다.

   그래서 기준을 **소켓**으로 바꿨습니다. 타이머가 멈추는 것과 달리,
   연결이 끊기는 것은 컴퓨터가 잠들거나 꺼졌다는 분명한 신호입니다.

     연결이 유지되는 동안  → 고른 상태를 그대로 인정 (전액 인정)
     연결이 끊긴 구간      → 아예 집계에서 뺍니다 (자리비움으로 찍지 않음)

   끊긴 구간을 자리비움으로 찍지 않는 것도 의도한 것입니다. 잠든 사이를
   "자리비움 3시간"으로 적으면 그것도 사실과 다르니까요. 그냥 세지 않습니다.

   [상식 밖 값 막기]
   드물게 잠든 사이에도 소켓이 살아 있으면 한 구간이 하루로 잡힐 수
   있습니다. 그래서 한 구간의 길이를 6시간에서 자릅니다. 실제 집필
   세션이 6시간을 넘는 경우는 거의 없으니 안전한 상한입니다.

   저장 위치
       users/{닉}/timeSegs/{YYYY-MM-DD}  — 닫힌 구간 목록
       users/{닉}/timeCur                — 지금 열려 있는 구간 하나
   ===================================================================== */

(function () {

  const STATUSES = [
    { id: "writing", label: "WORK",       color: "#C0392B" },
    { id: "focus",   label: "🔥초집중",    color: "#C2701A" },
    { id: "rest",    label: "휴식",        color: "#2E8B6B" },
    { id: "away",    label: "자리비움",    color: "#8A8F98" }
  ];
  const STATUS_IDS = STATUSES.map(s => s.id);

  const OFFLINE_MIN_MS = 5 * 60 * 1000;   // 이보다 오래 끊겼으면 그 구간을 집계에서 뺍니다
  const SEG_CAP_MS     = 6 * 60 * 60 * 1000; // 한 구간의 상한 (상식 밖 값 방지)
  const ALIVE_TICK_MS  = 30 * 1000;

  /* 예전 이름을 쓰는 곳이 있을 수 있어 남겨둡니다 */
  const GAP_LIMIT_MS = OFFLINE_MIN_MS;

  const KEY_ALIVE = "timelogAliveAt";

  function ymd(ms) {
    const d = new Date(ms);
    const p = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function dayStart(ms) { const d = new Date(ms); d.setHours(0,0,0,0); return d.getTime(); }
  function normStatus(s) { return STATUS_IDS.includes(s) ? s : "rest"; }

  function nowMs() {
    return (typeof window.serverNow === "function") ? window.serverNow() : Date.now();
  }

  /* ---------------------------------------------------------------
     [1] 살아 있음 표시 — 절전/방치 감지에만 씁니다
     --------------------------------------------------------------- */
  function markAlive() {
    try { AppStore.setItem(KEY_ALIVE, String(nowMs())); } catch (e) {}
  }
  function lastAlive() {
    try {
      const n = parseInt(AppStore.getItem(KEY_ALIVE) || "0", 10);
      return Number.isFinite(n) ? n : 0;
    } catch (e) { return 0; }
  }

  /* ---------------------------------------------------------------
     [2] 구간 쓰기
     --------------------------------------------------------------- */
  let _cur = null;      // { s, a }  지금 열려 있는 구간

  function curRef() { return db.ref(`users/${myNick}/timeCur`); }

  /** 하루를 넘기는 구간은 날짜별로 쪼개서 저장합니다 */
  async function pushSegment(status, from, to) {
    if (!myNick) return;
    if (!(to > from)) return;

    // 한 구간이 지나치게 길면 잘라냅니다 (잠든 사이가 통째로 잡히는 경우)
    if (to - from > SEG_CAP_MS) to = from + SEG_CAP_MS;

    let a = from;
    while (a < to) {
      const end = Math.min(to, dayStart(a) + 24 * 60 * 60 * 1000);
      const seg = { s: normStatus(status), a, b: end };
      try {
        await db.ref(`users/${myNick}/timeSegs/${ymd(a)}`).push(seg);
      } catch (e) { /* 저장 실패는 조용히 넘깁니다 */ }

      /* 펫 밥 — WORK 와 초집중만 누적합니다.

         날짜별 기록(timeSegs)을 매번 전부 더해서 누적을 구하면 기록이
         쌓일수록 무거워집니다. 그래서 닫을 때마다 한 값에 더해 둡니다.
         트랜잭션으로 올려서 여러 창을 열어둬도 어긋나지 않습니다. */
      if (seg.s === "writing" || seg.s === "focus") {
        const len = end - a;
        try {
          await db.ref(`users/${myNick}/workMsTotal`)
                  .transaction(v => (Number(v) || 0) + len);
        } catch (e) {}
      }
      a = end;
    }
  }

  /** 지금 열린 구간을 닫고 새 상태로 다시 엽니다 */
  async function switchTo(status, at) {
    const t = at || nowMs();
    const next = normStatus(status);

    if (_cur && _cur.s === next) return;      // 같은 상태면 그대로

    if (_cur) await pushSegment(_cur.s, _cur.a, t);

    _cur = { s: next, a: t };
    try { await curRef().set(_cur); } catch (e) {}
  }

  /* ---------------------------------------------------------------
     끊긴 구간 처리 — 자리비움으로 찍지 않고 "빼기"만 합니다
     ---------------------------------------------------------------
     .info/connected 가 false 로 떨어지면 그 시각을 적어두고,
     다시 true 가 되면 그 사이를 집계에서 뺍니다.
     (컴퓨터가 잠들어 JS 까지 멈춘 경우엔 끊긴 시각을 알 수 없으므로
      쪼개지 않고 그대로 인정합니다. 대신 위의 6시간 상한이 걸립니다.
      실제로 쓴 시간을 자리비움으로 찍는 것보다 이쪽이 낫다고 봤습니다.) */
  let _offlineSince = 0;
  let _connWatched = false;

  function watchConnection() {
    if (_connWatched) return;
    _connWatched = true;

    db.ref(".info/connected").on("value", async (snap) => {
      const up = !!snap.val();

      if (!up) {                       // 끊김 — 시각만 적어둡니다
        if (!_offlineSince) _offlineSince = nowMs();
        return;
      }

      // 다시 붙음
      if (!_offlineSince || !myNick) { _offlineSince = 0; return; }

      const gone = nowMs() - _offlineSince;
      if (gone >= OFFLINE_MIN_MS && _cur) {
        // 끊긴 시각까지만 인정하고, 그 뒤부터 다시 시작 (그 사이는 안 셈)
        await pushSegment(_cur.s, _cur.a, _offlineSince);
        _cur = { s: _cur.s, a: nowMs() };
        try { await curRef().set(_cur); } catch (e) {}
      }
      _offlineSince = 0;
    });
  }

  /* ---------------------------------------------------------------
     [3] 입장·상태변경·퇴장에 물리기
     --------------------------------------------------------------- */
  let _lastSeenStatus = null;

  function currentUiStatus() {
    return normStatus(document.getElementById("db-status")?.value || "rest");
  }

  let _tlStarted = false;
  async function startTimelog() {
    if (!myNick) return;
    if (_tlStarted) return;           // 두 번 불려도 타이머가 겹치지 않게
    _tlStarted = true;

    // 이전 세션이 남긴 열린 구간을 이어받거나 정리합니다
    try {
      const snap = await curRef().once("value");
      const prev = snap.val();
      if (prev && Number(prev.a) > 0) {
        /* 지난번에 창을 닫으면서 못 닫은 구간이 남아 있습니다.
           마지막으로 살아 있던 시각까지만 인정하고, 그 뒤(창이 닫혀 있던
           시간)는 아예 세지 않습니다. 자리비움으로 찍지도 않습니다. */
        const alive = lastAlive();
        const cut = (alive && alive > Number(prev.a)) ? alive : Number(prev.a);
        await pushSegment(prev.s, Number(prev.a), cut);
      }
    } catch (e) {}

    _cur = null;
    _lastSeenStatus = currentUiStatus();
    await switchTo(_lastSeenStatus, nowMs());
    markAlive();

    setInterval(() => {
      if (!myNick) return;
      markAlive();
      const s = currentUiStatus();
      if (s !== _lastSeenStatus) { _lastSeenStatus = s; switchTo(s); }
    }, ALIVE_TICK_MS);

    watchConnection();

    const wake = () => {
      if (!myNick || document.visibilityState === "hidden") return;
      markAlive();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    document.addEventListener("resume", wake);

    window.addEventListener("pagehide", () => {
      // 마지막 구간을 닫아둡니다 (실패해도 다음 입장 때 정리됩니다)
      try {
        if (_cur) {
          const t = nowMs();
          db.ref(`users/${myNick}/timeSegs/${ymd(_cur.a)}`).push({ s: _cur.s, a: _cur.a, b: t });
          curRef().remove();
        }
      } catch (e) {}
    });
  }
  window.startTimelog = startTimelog;

  /** 상태가 바뀔 때 즉시 반영 (updateStatus 를 감싸서) */
  function hookStatusChange() {
    const orig = window.updateStatus;
    if (typeof orig !== "function" || orig.__timelogWrapped) return;

    const wrapped = function (...args) {
      const r = orig.apply(this, args);
      try {
        if (myNick) {
          const s = currentUiStatus();
          if (s !== _lastSeenStatus) { _lastSeenStatus = s; switchTo(s); }
        }
      } catch (e) {}
      return r;
    };
    wrapped.__timelogWrapped = true;
    window.updateStatus = wrapped;
  }
  window.hookTimelogStatus = hookStatusChange;

  /* ---------------------------------------------------------------
     [4] 합계 계산
     --------------------------------------------------------------- */
  async function loadSummary(nick, days) {
    const out = [];               // [{ date, totals:{status:ms}, pomo }]
    const t = nowMs();

    let segsAll = {}, pomoAll = {}, cur = null;
    try {
      const snap = await db.ref(`users/${nick}`).once("value");
      const v = snap.val() || {};
      segsAll = v.timeSegs || {};
      pomoAll = v.pomoSessions || {};
      cur = v.timeCur || null;
    } catch (e) {}

    for (let i = days - 1; i >= 0; i--) {
      const dayMs = dayStart(t) - i * 24 * 60 * 60 * 1000;
      const key = ymd(dayMs);
      const totals = {}; STATUS_IDS.forEach(s => totals[s] = 0);

      const bucket = segsAll[key] || {};
      for (const k in bucket) {
        const seg = bucket[k] || {};
        const s = normStatus(seg.s);
        const len = Number(seg.b || 0) - Number(seg.a || 0);
        if (len > 0) totals[s] += len;
      }

      /* 아직 열려 있는 구간은 지금까지로 계산해 더합니다.

         단, 여기에도 6시간 상한을 겁니다. 닫힌 구간에는 pushSegment 가
         이미 상한을 걸고 있었는데 열린 구간에는 빠져 있어서, WORK 로
         두고 며칠 방치하면 그 며칠이 전부 집필 시간으로 잡혔습니다.
         상한을 넘긴 뒤로는 더 늘지 않고 6시간에서 멈춥니다. */
      if (cur && Number(cur.a) > 0) {
        const curStart = Number(cur.a);
        const curEnd   = Math.min(t, curStart + SEG_CAP_MS);   // ← 상한
        const a = Math.max(curStart, dayMs);
        const b = Math.min(curEnd, dayMs + 24 * 60 * 60 * 1000);
        if (b > a) totals[normStatus(cur.s)] += (b - a);
      }

      out.push({
        date: key,
        totals,
        pomo: Number(pomoAll?.[key]?.count || 0)
      });
    }
    return out;
  }
  window.loadTimeSummary = loadSummary;

  /* ---------------------------------------------------------------
     [5] 기록 팝업
     --------------------------------------------------------------- */
  function fmtDur(ms) {
    const m = Math.round(ms / 60000);
    if (m < 1) return "0분";
    if (m < 60) return `${m}분`;
    const h = Math.floor(m / 60), mm = m % 60;
    return mm ? `${h}시간 ${mm}분` : `${h}시간`;
  }
  const DOW = ["일","월","화","수","목","금","토"];

  async function openRecord(nick) {
    const modal = document.getElementById("record-modal");
    const body  = document.getElementById("record-body");
    const title = document.getElementById("record-title");
    if (!modal || !body) return;

    title.textContent = `📊 ${nick} 님의 기록`;
    body.innerHTML = `<p class="hint">불러오는 중…</p>`;
    modal.style.display = "flex";

    body.innerHTML = recordHtml(await loadSummary(nick, 7));
  }
  window.openRecord = openRecord;

  /* ---------------------------------------------------------------
     기록 화면 만들기 — 팝업과 설정 탭이 **같은 것**을 씁니다.

     예전에는 openRecord 안에 HTML 이 통째로 박혀 있었습니다. 설정에도
     같은 걸 띄우려면 복사해야 했는데, 그러면 한쪽만 고치는 사고가
     반드시 납니다. 함수로 떼어내 한 곳에서만 만듭니다.
     --------------------------------------------------------------- */
  function recordHtml(rows) {
    const today = rows[rows.length - 1];
    const sumWork = today.totals.writing + today.totals.focus;
    const maxDay = Math.max(1, ...rows.map(r => r.totals.writing + r.totals.focus));
    const weekWork = rows.reduce((a, r) => a + r.totals.writing + r.totals.focus, 0);
    const weekPomo = rows.reduce((a, r) => a + r.pomo, 0);

    return `
      <div class="rec-today">
        <div class="rec-big">${fmtDur(sumWork)}</div>
        <div class="rec-sub">오늘 집필 시간 (WORK + 초집중)</div>
      </div>

      <div class="rec-bars">
        ${STATUSES.map(s2 => {
          const v = today.totals[s2.id];
          const all = Math.max(1, STATUS_IDS.reduce((a, k) => a + today.totals[k], 0));
          return `<div class="rec-row">
                    <span class="rec-name">${s2.label}</span>
                    <span class="rec-track"><i style="width:${(v / all * 100).toFixed(1)}%;background:${s2.color}"></i></span>
                    <span class="rec-val">${fmtDur(v)}</span>
                  </div>`;
        }).join("")}
      </div>

      <div class="rec-h2">지난 7일 · 집필 시간</div>
      <div class="rec-week">
        ${rows.map(r => {
          const v = r.totals.writing + r.totals.focus;
          const h = Math.max(3, Math.round(v / maxDay * 74));
          const d = new Date(r.date + "T00:00:00");
          const isToday = r === today;
          return `<span title="${r.date} · ${fmtDur(v)} · 🍅 ${r.pomo}">
                    <i style="height:${h}px${v ? "" : ";background:var(--fill-2)"}"></i>
                    <s${isToday ? ' class="on"' : ""}>${DOW[d.getDay()]}</s>
                  </span>`;
        }).join("")}
      </div>

      <div class="rec-foot">
        이번 주 <b>${fmtDur(weekWork)}</b> · 🍅 <b>${weekPomo}회</b>
      </div>
      <p class="hint">
        상태를 바꾼 시각을 기준으로 계산합니다. <b>창을 내려두고 다른 앱에서
        글을 쓰셔도 시간은 그대로 쌓입니다.</b><br>
        컴퓨터가 잠들거나 꺼져서 <b>연결이 끊긴 구간만 집계에서 빠집니다.</b>
        (자리비움으로 찍지는 않습니다)
      </p>`;
  }

  /* ---------------------------------------------------------------
     설정 → 📊 나의 기록

     팝업과 다른 점은 **글자수까지 함께 본다**는 것뿐입니다.
     집필 시간과 글자수는 같은 하루를 다른 각도에서 본 값이라,
     나란히 두면 "오래 앉아 있었는데 덜 썼네" 같은 게 보입니다.
     --------------------------------------------------------------- */
  async function renderMyRecordPanel() {
    const host = document.getElementById("panel-record");
    if (!host) return;

    if (!myNick) {
      host.innerHTML = `<div class="set-block"><p class="hint">입장 후에 볼 수 있어요.</p></div>`;
      return;
    }

    host.innerHTML = `<div class="set-block"><p class="hint">불러오는 중…</p></div>`;

    let timeHtml = "";
    try { timeHtml = recordHtml(await loadSummary(myNick, 7)); }
    catch (e) { timeHtml = `<p class="hint">기록을 불러오지 못했어요.</p>`; }

    host.innerHTML = `
      <div class="set-block">
        <div class="set-title">⏱️ 집필 시간</div>
        ${timeHtml}
      </div>
      <div class="set-block">
        <div class="set-title">✍️ 글자수</div>
        ${window.Wordcount?.myWeekHtml?.() || `<p class="hint">글자수 기록을 불러오지 못했어요.</p>`}
      </div>`;
  }
  window.renderMyRecordPanel = renderMyRecordPanel;

  function closeRecord() {
    const m = document.getElementById("record-modal");
    if (m) m.style.display = "none";
  }
  window.closeRecord = closeRecord;

  /** 카드 아래쪽 상자를 누르면 그 사람의 기록을 엽니다 */
  function bindRecordOpen() {
    const host = document.getElementById("user-cards");
    if (!host || host._recordBound) return;
    host._recordBound = true;

    host.addEventListener("click", (e) => {
      // ✏️ 편집 버튼은 그쪽이 먼저 처리합니다
      if (e.target.closest("[data-edit-profile]")) return;
      const foot = e.target.closest("[data-record-of]");
      if (!foot) return;
      e.preventDefault();

      /* TheMagam — 내 카드 아래칸은 "오늘 목표 · 나의 투두" 입구입니다.
         프사는 프로필 설정, 상태표는 상태 고르기로 각각 갈라져 있습니다.
         남의 카드 아래칸은 그대로 기록 보기입니다. */
      const who = foot.dataset.recordOf;
      if (who && who === myNick) {
        window.openGoals?.();
        return;
      }
      openRecord(who);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const m = document.getElementById("record-modal");
      if (m && m.style.display === "flex") closeRecord();
    });
  }
  window.bindRecordOpen = bindRecordOpen;

  /* =================================================================
     펫 — 누적 집필 시간으로 자랍니다

     저장 자리
       users/{닉}/workMsTotal        집필 누적 (ms)
       users/{닉}/pet                { species, color }
       users/{닉}/petDex/{종/색}      만렙 찍은 것들

     레벨과 승계 계산은 script_pet.js 가 합니다. 여기서는 값을 읽고
     쓰는 일만 합니다.
     ================================================================= */
  function petRef() { return db.ref(`users/${myNick}/pet`); }
  function dexRef() { return db.ref(`users/${myNick}/petDex`); }

  let _petCache = null;      // { species, color }
  let _dexCache = {};
  let _workTotal = 0;

  /** 지금 열려 있는 구간까지 더한 집필 누적 */
  function workTotalLive() {
    let extra = 0;
    if (_cur && (_cur.s === "writing" || _cur.s === "focus")) {
      extra = Math.max(0, Math.min(nowMs() - Number(_cur.a), SEG_CAP_MS));
    }
    return _workTotal + extra;
  }
  window.petWorkTotal = workTotalLive;
  window.petDex = () => ({ ..._dexCache });
  window.petCurrent = () => (_petCache ? { ..._petCache } : null);

  /** 지금 펫의 진행 상태 (없으면 null) */
  function petState() {
    if (!window.Pet) return null;
    const done = Object.keys(_dexCache).length;
    const prog = window.Pet.petProgress(workTotalLive(), done);
    const cur = _petCache || { species: "cat" };
    return { ...prog, species: cur.species };
  }
  window.petState = petState;

  /** 만렙이면 도감에 넣고 다음 펫을 시작합니다 */
  async function promoteIfMaxed() {
    if (!myNick || !window.Pet || !_petCache) return false;
    const st = petState();
    if (!st || !st.isMax) return false;

    const key = window.Pet.dexKey(_petCache.species);
    _dexCache[key] = Date.now();
    try { await dexRef().child(key).set(Date.now()); } catch (e) {}

    const next = window.Pet.pickNextPet(_dexCache);
    _petCache = next;
    try { await petRef().set(next); } catch (e) {}

    try {
      window.showPetLevelUp?.(key, next);
      window.rerenderUserCards?.();
      window.renderPetPanel?.();
      window.pushPetToStatus?.();
    } catch (e) {}
    return true;
  }
  window.promotePetIfMaxed = promoteIfMaxed;

  /** 카드에 보이도록 status 에 요약을 실어 보냅니다 */
  window.pushPetToStatus = function () {
    try { window.updateStatus?.(false); } catch (e) {}
  };

  let _petStarted = false;
  async function startPet() {
    if (!myNick || !window.Pet) return;
    if (_petStarted) return;          // 두 번 불려도 타이머가 겹치지 않게
    _petStarted = true;

    try {
      const snap = await db.ref(`users/${myNick}`).once("value");
      const v = snap.val() || {};
      _workTotal = Number(v.workMsTotal || 0);
      _dexCache = v.petDex || {};
      _petCache = (v.pet && v.pet.species) ? v.pet : null;
    } catch (e) {}

    if (!_petCache) {
      _petCache = window.Pet.pickNextPet(_dexCache);
      try { await petRef().set(_petCache); } catch (e) {}
    }

    // 누적이 바뀌면 카드와 관리 창을 갱신합니다
    try {
      db.ref(`users/${myNick}/workMsTotal`).on("value", s2 => {
        _workTotal = Number(s2.val() || 0);
        promoteIfMaxed();
        try { window.renderPetPanel?.(); } catch (e) {}
      });
    } catch (e) {}

    await promoteIfMaxed();
    window.pushPetToStatus();

    /* 1분마다 한 번 — 열린 구간이 자라면서 레벨이 오를 수 있습니다.
       레벨이 실제로 바뀔 때만 화면을 건드립니다. */
    let lastLv = petState()?.level;
    setInterval(() => {
      if (!myNick) return;
      const st = petState();
      if (!st) return;
      if (st.level !== lastLv || st.isMax) {
        lastLv = st.level;
        promoteIfMaxed();
        try { window.renderPetPanel?.(); } catch (e) {}
        window.pushPetToStatus();
      }
    }, 60 * 1000);
  }
  window.startPet = startPet;

  /** 껍데기를 바꿉니다 — 아직 안 태어난 Lv.1 에서만.

      안에 든 것은 그룹 안에서 다시 무작위로 뽑습니다. 고르는 것은
      껍데기까지이고, 무엇이 들었는지는 태어나야 압니다. */
  window.setPetShell = async function (group) {
    if (!myNick || !window.Pet || !_petCache) return;
    const st = petState();
    if (!st || st.level !== 1) return;          // 태어난 뒤에는 못 바꿉니다

    const sp = window.Pet.pickInGroup(group, _dexCache);
    if (!sp) return;
    _petCache = { species: sp };
    try { await petRef().set(_petCache); } catch (e) {}
    try { window.renderPetPanel?.(); window.rerenderUserCards?.(); } catch (e) {}
    window.pushPetToStatus();
  };

  window.TimeLog = { STATUSES, STATUS_IDS, GAP_LIMIT_MS, OFFLINE_MIN_MS, SEG_CAP_MS,
                     loadSummary, fmtDur, pushSegment };
  if (typeof module !== "undefined" && module.exports) module.exports = window.TimeLog;
})();
