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
    { id: "writing", label: "Work",        color: "#C0392B" },
    { id: "focus",   label: "Work(집중)",  color: "#C2701A" },   /* 옛 기록용 */
    { id: "rest",    label: "Break",       color: "#2E8B6B" },
    { id: "away",    label: "Away",        color: "#8A8F98" }
  ];
  const STATUS_IDS = STATUSES.map(s => s.id);

  const OFFLINE_MIN_MS = 5 * 60 * 1000;   // 이보다 오래 끊겼으면 그 구간을 집계에서 뺍니다
  const SEG_CAP_MS     = 6 * 60 * 60 * 1000; // 한 구간의 상한 (상식 밖 값 방지)
  const ALIVE_TICK_MS  = 30 * 1000;
  /* [추가 2026-08-02] 열린 구간이 이 길이를 넘으면 잘라서 저장하고 새로 엽니다.
     같은 상태로 밤새 달리면 한 구간이 6시간 상한(SEG_CAP_MS)에 걸려
     그 뒤가 통째로 잘렸습니다. 1시간마다 미리 닫아두면 상한에 걸릴 일이
     없고, 자정을 넘길 때도 날짜별로 제때 나뉩니다. */
  const CHECKPOINT_MS  = 60 * 60 * 1000;

  /* 예전 이름을 쓰는 곳이 있을 수 있어 남겨둡니다 */
  const GAP_LIMIT_MS = OFFLINE_MIN_MS;

  const KEY_ALIVE = "timelogAliveAt";

  /* [추가 2026-08] 이 페이지(세션)의 표식.
     timeCur 는 계정당 하나인데 기기는 여러 대일 수 있습니다. 누가 열어둔
     구간인지 구분해야, 다른 기기가 이어받을 때 시간이 증발하거나 이중으로
     잡히는 것을 막을 수 있습니다. */
  const SID = Math.random().toString(36).slice(2) + Date.now().toString(36);

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
    /* [추가 2026-08] 서버의 열린 구간에도 도장을 찍습니다.
       localStorage 도장은 기기별이라 다른 기기가 구간을 정리할 때 못 보고,
       백그라운드 탭은 타이머가 얼어 도장 자체가 멈춥니다. 서버에 찍어두면
       어느 기기가 정리하든 이 구간의 실제 마지막 활동 시각을 압니다. */
    try {
      if (_cur && myNick) curRef().child("alive").set(nowMs());
    } catch (e) {}
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
  let _cur = null;      // { s, a, sid }  지금 열려 있는 구간

  function curRef() { return db.ref(`users/${myNick}/timeCur`); }

  /* [추가 2026-08] 연결이 끊기면 **서버가** 끊긴 시각을 적습니다.

     탭이 얼거나(백그라운드), 브라우저가 죽거나, 컴퓨터가 잠들면 JS 는
     아무것도 못 남깁니다. 하지만 파이어베이스 서버는 소켓이 끊긴 순간을
     정확히 알고, onDisconnect 로 그 시각을 대신 적어줄 수 있습니다.
     다음 입장 때 이 시각까지 전액 인정하므로, 백그라운드에서 쌓은
     시간이 증발하지 않습니다 — "연결이 살아있는 동안은 전액 인정"이라는
     이 파일의 원칙을 이걸로 실제로 지킵니다. */
  function armDisc() {
    try {
      /* [고침 2026-08-02] 묵은 disc 를 먼저 지웁니다.

         잠깐 끊겼다 붙으면(5분 미만) 구간을 새로 쓰지 않는데, 그 사이
         서버가 onDisconnect 로 적어둔 disc 는 지워지지 않고 남았습니다.
         loadSummary 가 이 묵은 disc 까지만 세는 바람에, 계속 접속해서
         쓰고 있는데도 오늘 합계가 그 시각(예: 2분)에서 멈췄습니다. */
      curRef().child("disc").remove();
      curRef().child("disc").onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
    } catch (e) {}
  }

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

  /* [추가 2026-08-02] 구간을 뺏겼으면 되찾습니다.

     timeCur 는 계정당 하나라, 같은 계정으로 두 번째 탭·기기가 열리면
     그쪽이 구간을 가져가고 이 탭은 _cur 를 놓습니다. 예전엔 상태를
     바꾸기 전까지 다시 시작하지 않아서, 그 뒤로 몇 시간을 써도 서버에
     아무것도 안 쌓였습니다 (펫 레벨이 되돌아가던 원인).

     이제 화면에 보이는 탭이 30초 안에 구간을 되찾아 이어갑니다.
     되찾기 전에 상대가 열어둔 구간을 alive/disc 시각까지 닫아 주므로
     양쪽 다 시간이 새지 않고, 숨어 있는 탭은 되찾지 않으므로 두 탭이
     서로 뺏고 빼앗는 일도 없습니다. */
  let _remoteCur = null;
  let _reclaimBusy = false;
  async function reclaimIfDropped() {
    if (_reclaimBusy || _cur || !myNick || !_tlStarted) return;
    if (document.visibilityState !== "visible") return;
    _reclaimBusy = true;
    try {
      const t = nowMs();
      const v = _remoteCur;
      if (v && v.sid && v.sid !== SID && Number(v.a) > 0) {
        const cut = Math.min(t, Math.max(
          Number(v.a), Number(v.alive) || 0, Number(v.disc) || 0));
        await pushSegment(v.s, Number(v.a), cut);
      }
      _lastSeenStatus = currentUiStatus();
      _cur = { s: _lastSeenStatus, a: t, sid: SID };
      await curRef().set(_cur);
      markAlive();
      armDisc();
    } catch (e) {}
    _reclaimBusy = false;
  }

  /* [추가 2026-08-02] 열린 구간이 너무 길면 잘라서 저장하고 같은 상태로
     다시 엽니다. 합계는 변하지 않고(닫힌 구간 + 새 열린 구간), 한 구간이
     6시간 상한에 걸려 뒤가 잘리는 일만 막습니다. */
  let _ckptBusy = false;
  async function checkpointIfLong() {
    if (_ckptBusy || !_cur || !myNick) return;
    if (nowMs() - Number(_cur.a) < CHECKPOINT_MS) return;
    _ckptBusy = true;
    try {
      const at = nowMs();
      const prev = _cur;
      _cur = { s: prev.s, a: at, sid: SID };
      await pushSegment(prev.s, prev.a, at);
      await curRef().set(_cur);
    } catch (e) {}
    _ckptBusy = false;
  }

  /** 지금 열린 구간을 닫고 새 상태로 다시 엽니다 */
  async function switchTo(status, at) {
    const t = at || nowMs();
    const next = normStatus(status);

    if (_cur && _cur.s === next) return;      // 같은 상태면 그대로

    if (_cur) await pushSegment(_cur.s, _cur.a, t);

    _cur = { s: next, a: t, sid: SID };
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
        _cur = { s: _cur.s, a: nowMs(), sid: SID };
        try { await curRef().set(_cur); } catch (e) {}
      }
      _offlineSince = 0;

      /* [추가 2026-08] 다시 붙을 때마다 onDisconnect 를 재장전합니다.
         (onDisconnect 예약은 연결 단위라, 끊겼다 붙으면 새로 걸어야 합니다.
          set(_cur) 이 노드를 통째로 덮어써서 지난 disc 는 함께 지워집니다.) */
      armDisc();
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
           살아 있었다고 확인되는 가장 늦은 시각까지 인정하고, 그 뒤는
           세지 않습니다. 자리비움으로 찍지도 않습니다.

           [고침 2026-08] 예전엔 이 기기의 localStorage 도장만 봤습니다.
           그래서 ① 다른 기기가 열어둔 구간을 정리하면 통째로 증발했고,
           ② 백그라운드 탭은 도장 타이머가 얼어 그 사이가 잘렸습니다.
           이제 서버가 적어준 끊긴 시각(disc)과 서버 도장(alive)을 함께
           봐서, 가장 늦은 시각까지 전액 인정합니다. */
        const cut = Math.min(nowMs(), Math.max(
          Number(prev.a),
          Number(prev.alive) || 0,
          Number(prev.disc) || 0,
          lastAlive() || 0
        ));
        await pushSegment(prev.s, Number(prev.a), cut);
      }
    } catch (e) {}

    _cur = null;
    _lastSeenStatus = currentUiStatus();
    await switchTo(_lastSeenStatus, nowMs());
    markAlive();
    armDisc();

    /* [추가 2026-08] 다른 기기가 timeCur 를 이어받으면 이쪽은 조용히 놓습니다.
       저쪽이 이 구간을 disc/alive 시각까지 정리했으니, 여기서 또 닫으면
       같은 시간이 이중으로 잡힙니다. 놓기만 하고 아무것도 더하지 않습니다.
       (놓은 뒤 이 기기에서 상태를 바꾸면 그때 새 구간으로 다시 시작합니다) */
    try {
      curRef().on("value", s3 => {
        const v = s3.val();
        _remoteCur = v || null;          // 되찾을 때 상대 구간을 닫는 데 씁니다
        if (_cur && v && v.sid && v.sid !== SID) _cur = null;
      });
    } catch (e) {}

    setInterval(() => {
      if (!myNick) return;
      markAlive();
      if (!_cur) { reclaimIfDropped(); return; }   // 다른 탭에 뺏긴 경우
      const s = currentUiStatus();
      if (s !== _lastSeenStatus) { _lastSeenStatus = s; switchTo(s); return; }
      checkpointIfLong();
    }, ALIVE_TICK_MS);

    watchConnection();

    const wake = () => {
      if (!myNick || document.visibilityState === "hidden") return;
      markAlive();
      if (!_cur) reclaimIfDropped();   // 뺏긴 채 돌아왔으면 바로 되찾기
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    document.addEventListener("resume", wake);

    /* [고침 2026-08] 창이 닫힐 때 여기서 직접 구간을 닫지 않습니다.

       예전엔 pagehide 에서 timeSegs 에 한 줄 적고 timeCur 를 지웠는데,
       두 가지 문제가 있었습니다.
         ① 기록장에는 적으면서 펫 누적(workMsTotal)에는 안 더해서,
            곱게 닫을 때마다 마지막 집필 구간이 펫에게만 누락됐습니다.
         ② 닫히는 순간의 전송은 어디까지 도착할지 알 수 없어서, 절반만
            성공하면 같은 구간이 안 잡히거나 두 번 잡힐 수 있었습니다.

       이제는 아무것도 하지 않습니다. 소켓이 닫히면 서버가 onDisconnect 로
       끊긴 시각(disc)을 적어주고, 다음 입장 때 그 시각까지 **한 번만**
       정산합니다 (기록장과 펫 누적이 같은 경로로 함께 처리됩니다).
       그동안의 오늘 합계는 loadSummary 가 disc 를 보고 계산합니다. */
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
  async function loadSummary(nick, days, backWeeks = 0) {
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
      const dayMs = dayStart(t) - (i + backWeeks * 7) * 24 * 60 * 60 * 1000;
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
        /* [고침 2026-08] 끊긴 사람의 열린 구간은 disc 까지만 셉니다.
           [고침 2026-08-02] 단 alive 가 disc 보다 최신이면 disc 무시 —
           잠깐 끊겼다 붙은 뒤 남은 묵은 disc 가 합계를 멈추던 버그. */
        const disc     = Number(cur.disc) || 0;
        const alive    = Number(cur.alive) || 0;
        const hardEnd  = (disc > 0 && disc >= alive) ? Math.min(t, disc) : t;
        const curEnd   = Math.min(hardEnd, curStart + SEG_CAP_MS);   // ← 상한
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
    if (m < 1) return "0m";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60), mm = m % 60;
    return mm ? `${h}h ${mm}m` : `${h}h`;
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
  function recordHtml(rows, backWeeks = 0, wcBack = 0) {
    const today = rows[rows.length - 1];
    const isThisWeek = backWeeks === 0;
    const sumWork = today.totals.writing + today.totals.focus;
    const maxDay = Math.max(1, ...rows.map(r => r.totals.writing + r.totals.focus));
    const weekWork = rows.reduce((a, r) => a + r.totals.writing + r.totals.focus, 0);
    const weekPomo = rows.reduce((a, r) => a + r.pomo, 0);
    const weekLabel = isThisWeek ? "지난 7일" : `${backWeeks}주 전`;

    /* 지난 주를 보는 동안에는 "오늘" 요약은 접어둡니다 — 그 주의 값이 아니니까요 */
    const todayHtml = !isThisWeek ? "" : `
      <div class="rec-today">
        <div class="rec-big">${fmtDur(sumWork)}</div>
        <div class="rec-sub">오늘 작업 시간 (Work)</div>
      </div>

      <div class="rec-bars">
        ${[
          { label: "Work",  color: "#C0392B", v: today.totals.writing + today.totals.focus },
          { label: "Break", color: "#2E8B6B", v: today.totals.rest },
          { label: "Away",  color: "#8A8F98", v: today.totals.away }
        ].map(s2 => {
          const all = Math.max(1, STATUS_IDS.reduce((a, k) => a + today.totals[k], 0));
          return `<div class="rec-row">
                    <span class="rec-name">${s2.label}</span>
                    <span class="rec-track"><i style="width:${(s2.v / all * 100).toFixed(1)}%;background:${s2.color}"></i></span>
                    <span class="rec-val">${fmtDur(s2.v)}</span>
                  </div>`;
        }).join("")}
      </div>`;

    return `
      ${todayHtml}

      <div class="rec-h2 rec-weeknav">
        <button type="button" class="rec-nav" title="한 주 전"
                onclick="renderMyRecordPanel(${backWeeks + 1}, ${wcBack})">‹</button>
        <span>${weekLabel} · Working hours</span>
        <button type="button" class="rec-nav" title="한 주 뒤" ${isThisWeek ? "disabled" : ""}
                onclick="renderMyRecordPanel(${backWeeks - 1}, ${wcBack})">›</button>
      </div>
      <div class="rec-week">
        ${rows.map(r => {
          const v = r.totals.writing + r.totals.focus;
          const h = Math.max(3, Math.round(v / maxDay * 74));
          const d = new Date(r.date + "T00:00:00");
          const isToday = isThisWeek && r === today;
          return `<span title="${r.date} · ${fmtDur(v)} · 🍅 ${r.pomo}">
                    <b class="rec-bar-v">${v ? fmtDur(v) : ""}</b>
                    <i style="height:${h}px${v ? "" : ";background:var(--fill-2)"}"></i>
                    <s${isToday ? ' class="on"' : ""}>${DOW[d.getDay()]}</s>
                  </span>`;
        }).join("")}
      </div>

      <div class="rec-foot">
        ${isThisWeek ? "이번 주" : weekLabel} <b>${fmtDur(weekWork)}</b> · 🍅 <b>${weekPomo}회</b>
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
  async function renderMyRecordPanel(backWeeks = 0, wcBack = 0) {
    const host = document.getElementById("panel-record");
    if (!host) return;

    if (!myNick) {
      host.innerHTML = `<div class="set-block"><p class="hint">입장 후에 볼 수 있어요.</p></div>`;
      return;
    }

    host.innerHTML = `<div class="set-block"><p class="hint">불러오는 중…</p></div>`;

    let timeHtml = "";
    try { timeHtml = recordHtml(await loadSummary(myNick, 7, backWeeks), backWeeks, wcBack); }
    catch (e) { timeHtml = `<p class="hint">기록을 불러오지 못했어요.</p>`; }

    host.innerHTML = `
      <div class="set-block">
        <div class="set-title">⏱️ Working hours</div>
        ${timeHtml}
      </div>
      <div class="set-block">
        <button class="ghost-btn w-full" type="button"
                onclick="exportMyRecord(${backWeeks}, ${wcBack})">📤 보고 있는 주를 텍스트로 내보내기</button>
        <p class="hint">위의 Working hours 주와 아래 Letters 주를 .txt 파일로 저장해요.</p>
      </div>
      <div class="set-block">
        <div class="set-title">✍️ Letters</div>
        ${(window.Wordcount?.myWeekHtml ? await window.Wordcount.myWeekHtml(wcBack, backWeeks) : null)
          || `<p class="hint">글자수 기록을 불러오지 못했어요.</p>`}
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
      /* [2026-08-03] 남의 카드는 눌리지 않습니다 — 작업시간은 본인만
         설정 → 📊 나의 기록에서 봅니다. (마크업에서도 남의 카드에는
         data-record-of 를 붙이지 않으므로 여기는 이중 안전장치) */
      return;
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const m = document.getElementById("record-modal");
      if (m && m.style.display === "flex") closeRecord();
    });
  }
  window.bindRecordOpen = bindRecordOpen;

  /* [2026-08-03] 나가기 직전 마무리 — 열린 구간을 지금까지로 저장하고
     timeCur 를 지웁니다. 묵은 timeCur 가 남아 다음 입장을 어지럽히거나
     지금까지의 작업 시간이 사라지는 일을 막습니다. */
  window.finalizeTimelogOnLeave = async function () {
    if (!myNick) return;
    try {
      if (_cur && Number(_cur.a) > 0) {
        await pushSegment(_cur.s, Number(_cur.a), nowMs());
      }
      _cur = null;
      await curRef().remove();
    } catch (e) { console.warn("[finalizeTimelogOnLeave]", e); }
    _tlStarted = false;   // 같은 화면에서 다시 입장하면 새로 시작
  };

  /* [2026-08-03] 나의 작업 — 텍스트 내보내기 */
  window.exportMyRecord = async function (backWeeks = 0, wcBack = 0) {
    if (!myNick) { alert("입장 후에 쓸 수 있어요."); return; }
    const rows = await loadSummary(myNick, 7, backWeeks);
    const L = [];
    L.push(`TheMagam — ${myNick} 작업 기록`);
    L.push(`내보낸 시각: ${new Date().toLocaleString("ko-KR")}`);
    L.push("");
    L.push(`■ Working hours (${backWeeks === 0 ? "이번 주" : backWeeks + "주 전"})`);
    let tw = 0, tp = 0;
    rows.forEach(r => {
      const v = r.totals.writing + r.totals.focus;
      tw += v; tp += r.pomo;
      L.push(`${r.date}  Work ${fmtDur(v)} · Break ${fmtDur(r.totals.rest)} · Away ${fmtDur(r.totals.away)} · 🍅 ${r.pomo}`);
    });
    L.push(`합계      Work ${fmtDur(tw)} · 🍅 ${tp}`);
    L.push("");
    L.push(`■ Letters (${wcBack === 0 ? "이번 주" : wcBack + "주 전"})`);
    let tc = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - (i + wcBack * 7));
      const key = window.Wordcount?.dayKey?.(d) || "";
      let total = 0;
      try {
        const s = await db.ref(`wordlog/${key}/${myNick}`).once("value");
        total = Number(s.val()?.total || 0);
      } catch (e) {}
      tc += total;
      L.push(`${key}  ${total.toLocaleString()}자`);
    }
    L.push(`합계      ${tc.toLocaleString()}자`);
    const blob = new Blob([L.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `더마감_${myNick}_기록_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };

  window.TimeLog = { STATUSES, STATUS_IDS, GAP_LIMIT_MS, OFFLINE_MIN_MS, SEG_CAP_MS,
                     loadSummary, fmtDur, pushSegment };
  if (typeof module !== "undefined" && module.exports) module.exports = window.TimeLog;
})();
