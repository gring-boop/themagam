/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_admin.js — admin.html 전용 스크립트

   메인 앱 스크립트는 하나도 불러오지 않습니다. 필요한 것만 여기에
   작게 다시 담았어요:
     · Firebase 설정 (script_core.js 와 동일 — ★ 코어와 동기 유지)
     · 닉네임→가짜 이메일 변환 (script_auth.js 와 동일한 방식)
     · 관리자 필명·PIN (script_realtime.js 의 것과 동일하게 유지)

   접속 흐름: ① 관리자 필명+비밀번호 로그인 → ② PIN → 대시보드.
   관리자 필명이 아니면 ①에서 막혀 PIN 화면까지 가지 못합니다.
   PIN 은 진짜 잠금장치가 아닙니다 — 파괴적 동작의 실수 방지용이고,
   진짜 방어는 파이어베이스 보안 규칙이 합니다.
   ===================================================================== */
(function () {
  "use strict";

  /* =====================================================================
     🛡️ 관리자 상수 — ★ 여기만 고치면 관리자가 바뀝니다.

     ※ 메인 앱(script_realtime.js) 맨 위에 같은 값이 있습니다.
       두 파일은 반드시 함께 고쳐야 해요 — 동기 필요!
     ===================================================================== */
  const ADMIN_NICK = "그링링🍄";     // ← 관리자 필명
  const ADMIN_PIN  = "09129823";     // ← 관리자 PIN

  /* ★ script_core.js 의 firebaseConfig 와 동기 유지 — 코어가 바뀌면 여기도 */
  const firebaseConfig = {
    apiKey: "AIzaSyD1YV5KlgkwBSEpDupiwMcWtryrlfCFyGc",
    authDomain: "themagam-158f7.firebaseapp.com",
    databaseURL: "https://themagam-158f7-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "themagam-158f7",
    storageBucket: "themagam-158f7.firebasestorage.app",
    messagingSenderId: "429789102223",
    appId: "1:429789102223:web:22263ce9440c144baa70fa"
  };
  try {
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(firebaseConfig);
  } catch (e) { console.warn("[admin firebase init]", e); }

  const db = firebase.database();
  const auth = firebase.auth();

  let myNick = "";

  // ------------------------------------------------- 작은 도우미들
  function el(id) { return document.getElementById(id); }
  function msg(id, text, bad) {
    const box = el(id);
    if (!box) return;
    box.textContent = text || "";
    box.classList.toggle("bad", !!bad);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
  function dayKey(d) {
    d = d || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  /* 닉네임 → 가짜 이메일 — script_auth.js 의 nickToEmail 과 동일한 방식 */
  function nickToEmail(nick) {
    let hex = "";
    const bytes = new TextEncoder().encode(nick);
    for (const b of bytes) hex += b.toString(16).padStart(2, "0");
    return "n" + hex + "@themagam.local";
  }

  // ------------------------------------------------- ① 로그인
  async function doLogin() {
    const nick = (el("adm-nick")?.value || "").trim();
    const pw = el("adm-pw")?.value || "";
    if (!nick) { msg("adm-login-msg", "닉네임을 입력해주세요.", true); return; }
    if (pw.length < 6) { msg("adm-login-msg", "비밀번호는 6자 이상이에요.", true); return; }

    /* 관리자 필명이 아니면 여기서 끝 — PIN 화면까지 가지 못합니다.
       문구를 일부러 뭉뚱그립니다. "그 닉이 아니에요" 처럼 말해버리면
       관리자 필명을 찾는 힌트를 주는 셈이라서요. */
    if (nick !== ADMIN_NICK) {
      msg("adm-login-msg", "로그인 정보가 올바르지 않아요.", true);
      return;
    }

    const btn = el("adm-login-btn");
    btn.disabled = true;
    msg("adm-login-msg", "확인 중…");
    try {
      /* 메인과 같은 탭 단위 로그인 */
      try { await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION); } catch (e) {}

      /* 도장(nickOwner)이 없는 필명은 관리자 페이지에서 새로 만들지 않습니다 */
      const owner = (await db.ref("nickOwner/" + nick).once("value")).val();
      if (owner === null) {
        msg("adm-login-msg", "등록되지 않은 닉네임이에요. 메인 방에서 먼저 입장해 주세요.", true);
        return;
      }
      try {
        await auth.signInWithEmailAndPassword(nickToEmail(nick), pw);
      } catch (e) {
        msg("adm-login-msg", "비밀번호가 달라요.", true);
        return;
      }
      myNick = nick;
      msg("adm-login-msg", "");
      el("adm-login").style.display = "none";
      el("adm-pin-card").style.display = "";
      /* 이 탭에서 이미 PIN 을 통과했다면 바로 대시보드 */
      if (sessionStorage.getItem("adminPinOk") === "true") openDash();
      else el("adm-pin")?.focus();
    } finally {
      btn.disabled = false;
    }
  }

  // ------------------------------------------------- ② PIN
  function doPin() {
    const p = el("adm-pin")?.value || "";
    if (p === ADMIN_PIN) {
      try { sessionStorage.setItem("adminPinOk", "true"); } catch (e) {}
      openDash();
    } else {
      msg("adm-pin-msg", "PIN이 달라요.", true);
    }
  }

  function openDash() {
    el("adm-pin-card").style.display = "none";
    el("adm-dash").style.display = "block";
    showMyUid();
    loadAttendance(0);
    loadNotice();
    loadPinnedMessage();
    loadHistoryConfig();
    loadForest();
    loadAllowList();
    loadBanList();
  }

  // ------------------------------------------------- ③-0 내 계정 uid
  /* 보안규칙에 관리자 uid 를 직접 박아 넣을 때 씁니다.
     (닉네임은 바뀔 수 있지만 uid 는 계정이 살아 있는 한 그대로예요) */
  function showMyUid() {
    const box = el("adm-uid");
    if (!box) return;
    box.textContent = auth.currentUser?.uid || "(로그인 정보를 읽지 못했어요)";
  }

  async function copyMyUid() {
    const uid = auth.currentUser?.uid || "";
    if (!uid) { msg("adm-uid-msg", "uid 를 읽지 못했어요.", true); return; }
    try {
      await navigator.clipboard.writeText(uid);
      msg("adm-uid-msg", "✅ 복사했어요. 보안규칙에 붙여 넣으세요.");
    } catch (e) {
      /* https 가 아니거나 권한이 막히면 클립보드가 안 됩니다 — 직접 긁어가도록 */
      msg("adm-uid-msg", "복사하지 못했어요. 위 uid 를 직접 긁어서 복사해 주세요.", true);
    }
  }

  // ------------------------------------------------- ③-1 출석·휴가 현황 (출근부 표)
  /* 데이터 구조 — script_realtime.js / script_timelog.js 와 동일:
       attendance/{YYYY-MM-DD}/{닉} = { firstAt, at, leftAt? }  ← 첫 입장 = firstAt(없으면 at)
       users/{닉}/vacations/{YYYY-MM-DD} = true
       users/{닉}/timeSegs/{YYYY-MM-DD}/{pushId} = { s, a, b }  ← 접속 구간(ms) */
  let _attOffset = 0;

  /* =====================================================================
     "이 사람이 언제부터 있었나" — 처음 나타난 날 (2026-08-11)
     ---------------------------------------------------------------------
     새로 들어온 분의 줄은 앞쪽이 통째로 비어 있습니다. 그런데 빈 칸은
     "안 왔다" 와 "아직 없었다" 를 구분해 주지 못해요. 곰미님이 오늘
     들어왔는데 열흘을 결석한 것처럼 보이는 셈입니다.

     그래서 attendance 를 **한 번** 통째로 훑어 사람마다 처음 나타난
     날을 구해 둡니다. 그 앞은 칸을 하나로 합쳐 "입장 전" 이라고 적어요.

     ★ 왜 한 번만 읽나 — 이 값은 달을 넘겨도 안 바뀝니다. 달을 옮길
       때마다 다시 읽으면 화살표를 누를 때마다 방 전체 출석을 내려받게
       돼요. 관리 화면을 여는 동안 한 번만 읽고 기억해 둡니다.
     ★ 휴가만 찍힌 날도 "있었던" 날로 셉니다. 출석은 안 했어도 그날
       이미 멤버였다는 뜻이니까요.
     ===================================================================== */
  let _firstSeen = null;      // { 닉: "YYYY-MM-DD" }

  /* =====================================================================
     📏 한 달 18일 출석 규칙 — 늦게 들어온 사람은 비율로 (2026-08-11)
     ---------------------------------------------------------------------
     [무엇이 문제였나]
     18일은 **한 달을 통째로 있은 사람**의 기준입니다. 11일에 들어온
     분에게 같은 18일을 요구하면, 남은 21일 중 18일 — 거의 매일 나와야
     해요. 규칙이 아니라 벌이 됩니다.

     [셈법]
       ① 이 달에 멤버였던 날    = 그 달 날수 − 들어오기 전 날수
       ② 휴가 낸 날은 통째로 뺍니다 ("쉬어도 되는 날" 이라는 뜻이니까요)
       ③ 기준 = 반올림( (①−②) ÷ 그 달 날수 × 18 )

     11일 입장 · 휴가 없음 · 31일 달이면 → 21 ÷ 31 × 18 ≈ 12.2 → **12일**
     30일 달에 같은 조건이면 → 20 ÷ 30 × 18 = 12 → **12일**
     달 길이가 달라도 같은 값이 나옵니다.

     [세 가지 상태]
     이번 달은 아직 안 끝났으니 "못 지켰다" 고 할 수 없습니다. 그래서
     **남은 날로 채울 수 있는가**까지 봅니다.
       ✅ 달성  — 이미 기준을 넘음
       🟡 가능  — 아직이지만 남은 날로 채울 수 있음
       🔴 불가  — 남은 날을 다 나와도 못 채움 (지난 달이면 '미달')
     ===================================================================== */
  const RULE_DAYS = 18;       // 한 달 기준 출석일 (달을 통째로 있은 사람)

  /** 한 사람의 이 달 규칙 셈 */
  function ruleOf({ daysInMonth, beforeN, vacInMonth, attended, daysLeft }) {
    const member = daysInMonth - beforeN;              // 멤버였던 날
    const eff = Math.max(0, member - vacInMonth);      // 휴가를 뺀 날
    const need = Math.round((eff / daysInMonth) * RULE_DAYS);
    if (attended >= need) return { need, state: "ok" };
    if (attended + daysLeft >= need) return { need, state: "maybe" };
    return { need, state: "bad" };
  }

  async function loadFirstSeen() {
    if (_firstSeen) return _firstSeen;
    const out = {};
    try {
      const snap = await db.ref("attendance").once("value");
      const all = snap.val() || {};
      Object.keys(all).forEach(day => {
        Object.keys(all[day] || {}).forEach(n => {
          const r = all[day][n];
          if (!r || !(r.firstAt || r.at)) return;
          if (!out[n] || day < out[n]) out[n] = day;
        });
      });
    } catch (e) {
      console.warn("[adm firstSeen]", e);
      return null;            // 못 읽으면 표시를 아예 안 합니다 (틀리게 칠하느니)
    }
    _firstSeen = out;
    return out;
  }

  function hhmm(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  async function loadAttendance(monthOffset) {
    _attOffset = monthOffset;
    const body = el("adm-att-body");
    body.innerHTML = "불러오는 중…";

    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() - monthOffset);
    const ymKey = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const todayKey = dayKey(new Date());
    el("adm-att-month").textContent = ymKey.replace("-", "년 ") + "월";
    el("adm-att-next").disabled = monthOffset === 0;

    try {
      /* 노드 단위 묶음 읽기 — 달 전체 attendance 1번, 멤버별 vacations·timeSegs(그 달) 각 1번 */
      const [asnap, nickSnap, firstSeen] = await Promise.all([
        db.ref("attendance").orderByKey()
          .startAt(`${ymKey}-01`).endAt(`${ymKey}-31`).once("value"),
        db.ref("nickOwner").once("value"),
        loadFirstSeen()
      ]);
      const attMonth = asnap.val() || {};
      const nicks = Object.keys(nickSnap.val() || {}).sort((a, b) => a.localeCompare(b, "ko"));
      if (!nicks.length) { body.innerHTML = "아직 기록이 없어요."; return; }

      const vacByNick = {};   // { 닉: {날짜:true} }
      const minsByNick = {};  // { 닉: {날짜: 합계분} }
      await Promise.all(nicks.map(async n => {
        try {
          vacByNick[n] = (await db.ref(`users/${n}/vacations`).once("value")).val() || {};
        } catch (e) { vacByNick[n] = {}; }
        try {
          const segs = (await db.ref(`users/${n}/timeSegs`).orderByKey()
            .startAt(`${ymKey}-01`).endAt(`${ymKey}-31`).once("value")).val() || {};
          const per = {};
          Object.keys(segs).forEach(d => {
            let ms = 0;
            Object.values(segs[d] || {}).forEach(sg => {
              if (sg && sg.b > sg.a) ms += sg.b - sg.a;
            });
            per[d] = ms / 60000;
          });
          minsByNick[n] = per;
        } catch (e) { minsByNick[n] = {}; }
      }));

      /* 날짜별 출석 인원 수 — 그날 attendance 기록(firstAt/at)이 있는 사람만 셉니다.
         휴가만 표시된 사람은 출근한 게 아니니 세지 않아요.
         명단(nickOwner)에 없는 옛 기록은 표에도 줄이 없으므로 함께 뺍니다. */
      const nickSet = new Set(nicks);
      const cntByDay = {};
      for (let d = 1; d <= daysInMonth; d++) {
        const dk = `${ymKey}-${String(d).padStart(2, "0")}`;
        const rec = attMonth[dk] || {};
        let c = 0;
        Object.keys(rec).forEach(n => {
          if (!nickSet.has(n)) return;
          const r = rec[n];
          if (r && (r.firstAt || r.at)) c++;
        });
        cntByDay[dk] = c;
      }

      /* 표 만들기 — ① 인원 수 줄 ② 날짜 머리글 줄 ③ 멤버 줄들 */
      /* 이번 달이면 오늘 **다음** 날부터가 아직 남은 날입니다.
         지난 달을 보고 있으면 남은 날은 없어요(0). */
      const todayD = new Date().getDate();
      const isThisMonth = (monthOffset === 0);

      let cntRow = `<tr><th class="rule-h cnt-h"></th><th class="name-h cnt-h">인원</th><th class="sum-h cnt-h"></th><th class="sum-h cnt-h"></th>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const dk = `${ymKey}-${String(d).padStart(2, "0")}`;
        const dow = new Date(base.getFullYear(), base.getMonth(), d).getDay();
        const c = cntByDay[dk] || 0;
        const cls = "cnt" + (dow === 0 || dow === 6 ? " we" : "") + (c === 0 ? " zero" : "");
        cntRow += `<th class="${cls}">${c === 0 ? "" : c}</th>`;
      }
      cntRow += "</tr>";

      let head = `<tr><th class="rule-h" title="한 달 ${RULE_DAYS}일 규칙 — 늦게 들어온 분은 있었던 날수에 비례해 기준을 낮춥니다">규칙</th>` +
                 `<th class="name-h">이름</th><th class="sum-h">출석</th><th class="sum-h">휴가</th>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const dk = `${ymKey}-${String(d).padStart(2, "0")}`;
        const dow = new Date(base.getFullYear(), base.getMonth(), d).getDay();
        const cls = "d" + (dow === 0 || dow === 6 ? " we" : "") + (dk === todayKey ? " today" : "");
        head += `<th class="${cls}">${d}</th>`;
      }
      head += "</tr>";

      const rows = nicks.map(n => {
        const vacs = vacByNick[n] || {};
        const mins = minsByNick[n] || {};

        /* 이 사람이 처음 나타난 날 — 출석과 휴가 중 이른 쪽.
           (vacations 는 위에서 달을 안 가리고 통째로 읽어 옵니다) */
        let born = firstSeen ? firstSeen[n] : null;
        Object.keys(vacs).forEach(d => {
          if (vacs[d] === true && (!born || d < born)) born = d;
        });

        /* 이 달에서 "아직 없었던" 날이 며칠까지인가.
           ★ 한 번도 나타난 적이 없으면(born 이 없으면) 이 달 전체가
             입장 전입니다 — 명단에는 있는데 아직 한 번도 안 온 분이에요.
           ★ firstSeen 을 못 읽었으면 아예 표시하지 않습니다. */
        let beforeN = 0;
        if (firstSeen) {
          for (let d = 1; d <= daysInMonth; d++) {
            const dk = `${ymKey}-${String(d).padStart(2, "0")}`;
            if (born && dk >= born) break;
            beforeN++;
          }
        }

        let attDays = 0, vacDays = 0, cells = "";
        if (beforeN > 0) {
          /* 칸을 하나로 합칩니다 — 흩어진 빈 칸보다 "여기까지는 없었다" 가
             한눈에 읽힙니다. 좁으면 글자는 생략해요. */
          cells += `<td class="cell before" colspan="${beforeN}">` +
                   (beforeN >= 3 ? "입장 전" : "") + "</td>";
        }
        for (let d = beforeN + 1; d <= daysInMonth; d++) {
          const dk = `${ymKey}-${String(d).padStart(2, "0")}`;
          const rec = attMonth[dk]?.[n];
          const inAt = rec ? (rec.firstAt || rec.at) : null;
          const isVac = vacs[dk] === true;
          if (inAt) attDays++;
          if (isVac) vacDays++;
          let cls = "cell", txt = "";
          if (isVac) { cls += " vac"; txt = "🏖️"; }
          else if (inAt) {
            txt = hhmm(inAt);
            if ((mins[dk] || 0) < 60) cls += " short"; // 출석했는데 1일 접속 1시간 미만
          }
          if (dk === todayKey) cls += " today";
          cells += `<td class="${cls}">${txt}</td>`;
        }
        /* ── 규칙 칸 ──
           ★ 남은 날에서 **앞으로 낼 휴가**는 뺍니다. 휴가는 기준에서도
             빠졌으니, 나올 수 있는 날로 세면 두 번 봐주는 셈이 돼요. */
        let daysLeft = 0;
        if (isThisMonth) {
          for (let d = todayD + 1; d <= daysInMonth; d++) {
            const dk = `${ymKey}-${String(d).padStart(2, "0")}`;
            if (vacs[dk] !== true) daysLeft++;
          }
        }
        const r = ruleOf({ daysInMonth, beforeN, vacInMonth: vacDays, attended: attDays, daysLeft });
        const 표 = { ok: "✅", maybe: "🟡", bad: "🔴" };
        const 말 = { ok: "달성", maybe: "남은 날로 채울 수 있어요",
                     bad: isThisMonth ? "남은 날을 다 나와도 모자라요" : "미달" };
        const ruleCell =
          `<td class="rule-c ${r.state}" title="기준 ${r.need}일 · ${말[r.state]}">` +
          `${표[r.state]} ${attDays}/${r.need}</td>`;

        /* 이름 옆 [✕] — 탈퇴 인원 삭제. 늘 있지만 아주 옅게, 마우스를 올리면 진해집니다. */
        return `<tr>${ruleCell}<td class="name-c"><span class="nmw">` +
                 `<span class="nm">${escapeHtml(n)}</span>` +
                 `<button type="button" class="del-x" data-del-nick="${escapeHtml(n)}" title="명단에서 지우기">✕</button>` +
               `</span></td>` +
               `<td class="sum-c">${attDays}</td><td class="sum-c">${vacDays}</td>${cells}</tr>`;
      }).join("");

      body.classList.remove("adm-msg");
      body.innerHTML = `<div class="adm-att-scroll"><table class="adm-att-table">${cntRow}${head}${rows}</table></div>`;
    } catch (e) {
      console.warn("[adm attendance]", e);
      body.innerHTML = "불러오지 못했어요.";
    }
  }

  /* ---------------------------------------------- ③-1b 탈퇴 인원 삭제
     출근부 이름 칸의 [✕] 로 부릅니다. 두 번 확인(확인창 + 닉네임 직접 입력)을
     거쳐야 지워집니다. 되돌릴 수 없어요.

     지우는 곳
       users/{닉}                 프로필·투두·목표·timeSegs·timeCur·vacations·
                                  chattyParticipation·idleDetect … 전부
       status/{닉}                접속 상태
       nickOwner/{닉}             닉 도장 — 이걸 지워야 그 닉을 다시 쓸 수 있어요
       attendance/{모든 날짜}/{닉} 출근 기록
       wordlog/{모든 날짜}/{닉}    글자수 기록

     남기는 곳
       messages / messages2 — 지난 발언은 지우지 않습니다.
         한 사람의 말만 빼면 대화 맥락이 끊겨 읽을 수 없게 되니까요.
       wordfeed — push 키라 닉 필드로 하나하나 걸러야 하는데, 그날치만 남고
         금방 사라지는 구조라 굳이 손대지 않습니다.
     ------------------------------------------------------------------- */
  async function removeMember(nick) {
    if (!nick) return;
    if (!confirm(
      `${nick}님을 명단에서 지울까요? 출석·휴가·작업시간·글자수 기록이 모두 삭제되고 되돌릴 수 없어요.\n` +
      `채팅에 남은 지난 말은 그대로 남아요.`
    )) return;

    /* 두 번째 확인 — 오타·실수로 엉뚱한 사람을 지우지 않도록 닉을 직접 적게 합니다 */
    const typed = prompt(`정말 지우려면 아래 닉네임을 똑같이 입력해 주세요.\n\n${nick}`);
    if (typed === null) return;                       // 취소
    if (typed.trim() !== nick) {
      msg("adm-att-msg", "입력한 닉네임이 달라서 지우지 않았어요.", true);
      return;
    }

    msg("adm-att-msg", "지우는 중…");
    try {
      /* nickOwner 를 지우기 전에 uid 를 먼저 읽어 둡니다 —
         지운 뒤에는 이 닉이 누구였는지 알 방법이 없어져요. */
      const uid = (await db.ref("nickOwner/" + nick).once("value")).val();
      void uid;

      /* attendance·wordlog 은 날짜별로 흩어져 있어 통째로 읽어 해당 닉만 골라
         multi-path update 로 한 번에 지웁니다. (날짜마다 remove 하면 요청이 너무 많아요) */
      const [attSnap, wlSnap] = await Promise.all([
        db.ref("attendance").once("value"),
        db.ref("wordlog").once("value")
      ]);

      const attUpd = {};
      Object.entries(attSnap.val() || {}).forEach(([day, byNick]) => {
        if (byNick && Object.prototype.hasOwnProperty.call(byNick, nick)) attUpd[`${day}/${nick}`] = null;
      });
      if (Object.keys(attUpd).length) await db.ref("attendance").update(attUpd);

      const wlUpd = {};
      Object.entries(wlSnap.val() || {}).forEach(([day, byNick]) => {
        if (byNick && Object.prototype.hasOwnProperty.call(byNick, nick)) wlUpd[`${day}/${nick}`] = null;
      });
      if (Object.keys(wlUpd).length) await db.ref("wordlog").update(wlUpd);

      await db.ref("users/" + nick).remove();
      await db.ref("status/" + nick).remove();
      await db.ref("nickOwner/" + nick).remove();     // 맨 마지막 — 도장 반납

      await loadAttendance(_attOffset);
      msg("adm-att-msg", `🗑️ ${nick}님을 지웠어요.`);
    } catch (e) {
      console.warn("[adm removeMember]", e);
      msg("adm-att-msg", "지우지 못했어요 — 보안규칙에 관리자 예외가 들어갔는지 확인해 주세요.", true);
    }
  }

  /* =====================================================================
     🔐 입장 승인 · 🚫 내보내기 (2026-08-11)
     ---------------------------------------------------------------------
     [왜 만들었나]
     모르는 필명이 작업방에 들어와 수다방까지 들어왔는데 아무 대꾸가
     없었습니다. 멤버들이 무서워했어요.

     예전에는 **주소만 알면 아무 필명이나 새로 만들어** 들어올 수
     있었습니다. 멤버를 늘리기 쉬우라고 그렇게 뒀던 건데, 방이 알려질수록
     그게 구멍이 됩니다.

     [두 칸으로 나눴습니다]
       config/allow/{필명} = true   승인 명단 — 여기 있어야 **새로** 만들 수 있음
       config/ban/{필명}   = true   내보낸 사람 — 있으면 아무것도 못 함

     config 는 이미 **방장만 쓸 수 있게** 잠겨 있어서, 이 두 칸도 자동으로
     방장 전용입니다.

     ★ 막는 일은 화면이 아니라 **보안규칙(서버)** 이 합니다. 개발자도구로
       무엇을 하든 안 뚫려요. 여기 화면은 그 명단을 손보는 곳일 뿐입니다.

     [내보내기가 지우기와 다른 점]
     지우기(✕)는 기록까지 없애고 되돌릴 수 없습니다. 내보내기는 **문만
     잠급니다** — 기록은 그대로 두고, 마음이 바뀌면 풀 수 있어요.
     낯선 사람에게 쓸 때는 이쪽이 맞습니다.
     ===================================================================== */
  async function loadAllowList() {
    const box = el("adm-allow-list");
    if (!box) return;
    try {
      const v = (await db.ref("config/allow").once("value")).val() || {};
      const nicks = Object.keys(v).filter(n => v[n] === true).sort();
      box.innerHTML = nicks.length
        ? nicks.map(n => `
            <div class="adm-row">
              <span class="n">${escapeHtml(n)}</span>
              <button class="adm-btn ghost" data-allow-del="${escapeHtml(n)}">승인 취소</button>
            </div>`).join("")
        : "아직 승인한 필명이 없어요. 아래 [지금 쓰는 필명 전부 승인] 을 먼저 눌러 주세요.";
    } catch (e) {
      box.textContent = "불러오지 못했어요.";
    }
  }

  async function addAllow(nickRaw) {
    const nick = String(nickRaw || "").trim();
    if (!nick) { msg("adm-allow-msg", "필명을 적어 주세요.", true); return; }
    if (/[.#$/\[\]]/.test(nick)) {
      msg("adm-allow-msg", "필명에 . $ # [ ] / 는 쓸 수 없어요.", true); return;
    }
    try {
      await db.ref("config/allow/" + nick).set(true);
      const inp = el("adm-allow-nick"); if (inp) inp.value = "";
      await loadAllowList();
      msg("adm-allow-msg", `✅ ${nick} — 이제 들어올 수 있어요.`);
    } catch (e) {
      msg("adm-allow-msg", "저장하지 못했어요. " + (e.code || e.message || ""), true);
    }
  }

  async function delAllow(nick) {
    if (!nick) return;
    if (!confirm(`${nick} 님의 승인을 취소할까요?\n\n이미 쓰고 있는 분이면 **지금 쓰는 데는 지장이 없습니다** — ` +
                 `필명을 처음 만들 때만 보는 명단이라서요.\n완전히 막으려면 [내보내기] 를 쓰세요.`)) return;
    try {
      await db.ref("config/allow/" + nick).remove();
      await loadAllowList();
      msg("adm-allow-msg", `${nick} — 승인을 취소했어요.`);
    } catch (e) {
      msg("adm-allow-msg", "지우지 못했어요.", true);
    }
  }

  /* 지금 쓰이고 있는 필명을 통째로 승인 명단에 넣습니다.
     ★ 보안규칙을 올리기 **전에** 눌러야 합니다. 순서가 바뀌면 명단에
       없는 분이 새 기기에서 들어올 때 막힐 수 있어요. */
  async function seedAllow() {
    if (!confirm("지금 쓰이고 있는 필명을 전부 승인 명단에 넣을까요?\n(이미 있는 것은 그대로 둡니다)")) return;
    msg("adm-allow-msg", "넣는 중…");
    try {
      const owners = (await db.ref("nickOwner").once("value")).val() || {};
      const upd = {};
      Object.keys(owners).forEach(n => { upd[n] = true; });
      if (!Object.keys(upd).length) { msg("adm-allow-msg", "쓰이고 있는 필명이 없어요.", true); return; }
      await db.ref("config/allow").update(upd);
      await loadAllowList();
      msg("adm-allow-msg", `✅ ${Object.keys(upd).length}개 필명을 승인했어요.`);
    } catch (e) {
      msg("adm-allow-msg", "넣지 못했어요. " + (e.code || e.message || ""), true);
    }
  }

  async function loadBanList() {
    const box = el("adm-ban-list");
    if (!box) return;
    try {
      const v = (await db.ref("config/ban").once("value")).val() || {};
      const nicks = Object.keys(v).sort();
      box.innerHTML = nicks.length
        ? nicks.map(n => `
            <div class="adm-row">
              <span class="n">${escapeHtml(n)}</span>
              <button class="adm-btn ghost" data-ban-del="${escapeHtml(n)}">다시 들이기</button>
            </div>`).join("")
        : "내보낸 사람이 없어요.";
    } catch (e) {
      box.textContent = "불러오지 못했어요.";
    }
  }

  async function addBan(nickRaw) {
    const nick = String(nickRaw || "").trim();
    if (!nick) { msg("adm-ban-msg", "필명을 적어 주세요.", true); return; }
    if (!confirm(`${nick} 님을 내보낼까요?\n\n· 접속자 명단에서 곧바로 사라집니다\n` +
                 `· 채팅·수다방에 글을 쓸 수 없습니다\n· 다시 들어와도 아무것도 못 합니다\n\n` +
                 `기록은 지우지 않아요. 되돌릴 수 있습니다.`)) return;
    msg("adm-ban-msg", "내보내는 중…");
    try {
      /* ① 문을 먼저 잠급니다 — 잠그기 전에 지우면 그 사이에 다시 씁니다 */
      await db.ref("config/ban/" + nick).set(true);
      /* ② 승인 명단에서도 빼서, 필명을 새로 만드는 길도 막습니다 */
      await db.ref("config/allow/" + nick).remove();
      /* ③ 지금 떠 있는 접속 표시를 지웁니다 (방장은 남의 status 도 지울 수 있어요) */
      await db.ref("status/" + nick).remove();
      /* ④ 공유 중이던 화면도 함께 내립니다 */
      await db.ref("screens/" + nick).remove();

      const inp = el("adm-ban-nick"); if (inp) inp.value = "";
      await Promise.all([loadBanList(), loadAllowList()]);
      msg("adm-ban-msg", `🚫 ${nick} 님을 내보냈어요. 접속자 명단에서 사라집니다.`);
    } catch (e) {
      msg("adm-ban-msg", "내보내지 못했어요. " + (e.code || e.message || ""), true);
    }
  }

  async function delBan(nick) {
    if (!nick) return;
    if (!confirm(`${nick} 님을 다시 들일까요?`)) return;
    try {
      await db.ref("config/ban/" + nick).remove();
      await db.ref("config/allow/" + nick).set(true);
      await Promise.all([loadBanList(), loadAllowList()]);
      msg("adm-ban-msg", `${nick} 님을 다시 들였어요.`);
    } catch (e) {
      msg("adm-ban-msg", "풀지 못했어요.", true);
    }
  }

  // ------------------------------------------------- ③-2 공지
  async function loadNotice() {
    try {
      const v = (await db.ref("config/notice").once("value")).val();
      el("adm-notice").value = v?.text || "";
    } catch (e) {}
  }
  async function saveNotice() {
    const text = (el("adm-notice")?.value || "").trim();
    try {
      if (text) await db.ref("config/notice").set({ text, by: myNick, at: Date.now() });
      else await db.ref("config/notice").remove();
      msg("adm-notice-msg", text ? "✅ 공지를 저장했어요." : "✅ 공지를 내렸어요.");
    } catch (e) {
      msg("adm-notice-msg", "저장하지 못했어요. 연결을 확인해 주세요.", true);
    }
  }
  async function clearNotice() {
    if (!confirm("공지를 내릴까요?")) return;
    el("adm-notice").value = "";
    await saveNotice();
  }

  // ------------------------------------------------- ③-2.5 채팅 핀 메시지
  /* script_chat.js 의 setPinnedMessage / removePinnedMessage 와 같은 노드 */
  async function loadPinnedMessage() {
    try {
      const v = (await db.ref("chatMeta/pinned").once("value")).val();
      const input = el("adm-pin-msg-input");
      if (input) input.value = v?.text || "";
    } catch (e) {}
  }
  async function savePinnedMessage() {
    const text = (el("adm-pin-msg-input")?.value || "").trim();
    try {
      if (text) await db.ref("chatMeta/pinned").set({ text, by: myNick, at: Date.now() });
      else await db.ref("chatMeta/pinned").remove();
      msg("adm-pin-msg-msg", text ? "📌 핀을 고정했어요." : "✅ 핀을 내렸어요.");
    } catch (e) {
      msg("adm-pin-msg-msg", "저장하지 못했어요. 연결을 확인해 주세요.", true);
    }
  }
  async function clearPinnedMessage() {
    if (!confirm("핀 메시지를 내릴까요?")) return;
    const input = el("adm-pin-msg-input");
    if (input) input.value = "";
    await savePinnedMessage();
  }

  // ------------------------------------------------- ③-3 채팅
  async function loadHistoryConfig() {
    try {
      const conf = (await db.ref("chatMeta/showHistory").once("value")).val() || {};
      const mode = conf.mode || (conf.enabled === false ? "off" : "on");
      const r = document.querySelector(`input[name="adm-hist"][value="${mode}"]`);
      if (r) r.checked = true;
      el("adm-hist-count").value = Math.max(10, Math.min(300, parseInt(conf.count ?? 100, 10) || 100));
    } catch (e) {}
  }
  /* script_realtime.js 의 applyHistoryConfig 와 같은 데이터 형태 */
  async function applyHistory() {
    const sel = document.querySelector('input[name="adm-hist"]:checked');
    const mode = sel ? sel.value : "on";
    const n = parseInt(el("adm-hist-count")?.value, 10);
    if (!Number.isFinite(n) || n < 10 || n > 300) {
      msg("adm-chat-msg", "표시 개수는 10~300 사이 숫자로 입력해 주세요.", true);
      return;
    }
    if (!confirm(`히스토리 설정을 적용할까요?\n모드: ${mode} · 표시 개수: ${n}개`)) return;
    try {
      await db.ref("chatMeta/showHistory").set({ mode, count: n, updatedBy: myNick || "admin", at: Date.now() });
      msg("adm-chat-msg", "✅ 히스토리 설정을 적용했어요.");
    } catch (e) {
      msg("adm-chat-msg", "적용하지 못했어요.", true);
    }
  }
  /* script_realtime.js 의 clearAllChat 과 같은 순서 */
  async function clearChat() {
    if (!confirm("정말 채팅을 모두 삭제할까요? (되돌릴 수 없어요!)")) return;
    try {
      const now = Date.now();
      await db.ref("chatMeta/clearedAt").set(now);
      await db.ref("messages").remove();
      await db.ref("messages").push({ type: "system", msg: "🧹 관리자가 채팅을 전체 삭제했습니다.", time: now });
      msg("adm-chat-msg", "🧹 채팅을 모두 삭제했어요.");
    } catch (e) {
      msg("adm-chat-msg", "삭제하지 못했어요.", true);
    }
  }
  async function clearChatty() {
    if (!confirm("정말 Chatty(수다방)를 모두 삭제할까요? (되돌릴 수 없어요!)")) return;
    try {
      await db.ref("messages2").remove();
      msg("adm-chat-msg", "☕ Chatty를 모두 삭제했어요.");
    } catch (e) {
      msg("adm-chat-msg", "삭제하지 못했어요.", true);
    }
  }

  // ------------------------------------------------- ③-3.6 🕘 출입 기록
  /* 하루치 입·퇴장을 일어난 순서대로 펼쳐 봅니다.

     [두 곳에서 끌어옵니다 — 정확도가 다릅니다]
       ① attendlog/{날짜}/{pushId} = { n:닉, t:시각, k:"in"|"out" }
          2026-08-07 부터 쌓이는 정밀 기록. 하루에 여러 번 들락거려도
          전부 남고, 창을 그냥 닫아도 서버가 대신 퇴장을 적어 줍니다.
       ② attendance/{날짜}/{닉} = { firstAt, at, leftAt? }
          예전부터 있던 하루 한 줄짜리 기록. 첫 입장과, [나가기] 를
          눌렀을 때의 퇴장만 있습니다.

     ①이 있는 날은 ①만 씁니다. 없는 날(=기능을 넣기 전 날짜)에만 ②로
     대신 그리고, 그 줄은 옅게(is-rough) 칠해 "이건 대략치"라고 알립니다.
     둘을 섞으면 같은 입장이 두 번 나와서 오히려 헷갈립니다. */
  let _logOffset = 0;   // 0 = 오늘, 1 = 어제 …

  function logDayKey(offset) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return dayKey(d);
  }

  function stayText(ms) {
    const m = Math.round(ms / 60000);
    if (m < 1) return "";
    if (m < 60) return `${m}분`;
    const h = Math.floor(m / 60);
    return `${h}시간${m % 60 ? " " + (m % 60) + "분" : ""}`;
  }

  /* 사건 목록 → 화면. 머문 시간은 같은 사람의 in 과 그 뒤 첫 out 을 짝지어 냅니다. */
  function logRowsHtml(events, rough) {
    if (!events.length) {
      return `<div class="adm-msg">이 날은 기록이 없어요.</div>`;
    }
    events.sort((a, b) => a.t - b.t);

    /* 짝짓기 — 같은 닉의 in 을 담아 뒀다가 out 이 오면 꺼내 씁니다 */
    const open = {};
    events.forEach(e => {
      if (e.k === "in") { (open[e.n] = open[e.n] || []).push(e); return; }
      const q = open[e.n];
      if (q && q.length) {
        const start = q.shift();
        e.stay = e.t - start.t;
      }
    });

    const rows = events.map(e => {
      const isIn = e.k === "in";
      return `<div class="adm-log-row${rough ? " is-rough" : ""}">
        <span class="adm-log-t">${hhmm(e.t)}</span>
        <span class="adm-log-k ${isIn ? "in" : "out"}">${isIn ? "→" : "←"}</span>
        <span class="adm-log-n">${escapeHtml(e.n)}</span>
        <span class="adm-log-stay">${isIn ? "" : (e.stay ? stayText(e.stay) + " 머묾" : "")}</span>
      </div>`;
    }).join("");

    const people = new Set(events.map(e => e.n));
    const ins = events.filter(e => e.k === "in").length;
    const outs = events.length - ins;
    return `<div class="adm-log-sum">${people.size}명 · 입장 ${ins}회 · 퇴장 ${outs}회</div>` + rows;
  }

  async function loadAttendLog(offset) {
    _logOffset = Math.max(0, offset);
    const day = logDayKey(_logOffset);
    const body = el("adm-log-body");
    const note = el("adm-log-note");
    const label = el("adm-log-day");
    if (label) label.textContent = day + (_logOffset === 0 ? " (오늘)" : "");
    const nextBtn = el("adm-log-next");
    if (nextBtn) nextBtn.disabled = (_logOffset === 0);
    if (body) body.innerHTML = `<div class="adm-msg">불러오는 중…</div>`;

    try {
      const snap = await db.ref(`attendlog/${day}`).once("value");
      const raw = snap.val() || {};
      const events = Object.values(raw)
        .filter(v => v && v.n && v.t && (v.k === "in" || v.k === "out"))
        .map(v => ({ n: String(v.n), t: Number(v.t), k: v.k }));

      if (events.length) {
        if (body) body.innerHTML = logRowsHtml(events, false);
        if (note) note.textContent =
          "정밀 기록이에요 — 하루에 여러 번 드나든 것도 모두 남고, 창을 그냥 닫아도 퇴장이 찍힙니다.";
        return;
      }

      /* 정밀 기록이 없는 날 — 옛 출석 기록으로 대략만 그립니다 */
      const aSnap = await db.ref(`attendance/${day}`).once("value");
      const att = aSnap.val() || {};
      const rough = [];
      Object.entries(att).forEach(([nick, v]) => {
        const inAt = Number(v?.firstAt || v?.at || 0);
        if (inAt) rough.push({ n: nick, t: inAt, k: "in" });
        const outAt = Number(v?.leftAt || 0);
        if (outAt) rough.push({ n: nick, t: outAt, k: "out" });
      });

      if (body) body.innerHTML = logRowsHtml(rough, true);
      if (note) note.textContent = rough.length
        ? "옛 기록이라 대략치예요 — 하루의 첫 입장과, [나가기] 를 누른 퇴장만 있습니다."
        : "";
    } catch (e) {
      console.warn("[adm attendlog]", e);
      if (body) body.innerHTML =
        `<div class="adm-msg">불러오지 못했어요. Firebase 콘솔에 새 보안규칙(attendlog)을 게시했는지 확인해 주세요.</div>`;
      if (note) note.textContent = "";
    }
  }

  function openAttendLog() {
    el("adm-log-modal")?.removeAttribute("hidden");
    loadAttendLog(0);
  }
  function closeAttendLog() {
    el("adm-log-modal")?.setAttribute("hidden", "");
  }

  // ------------------------------------------------- ③-3.8 👥 접속자 명단 미리보기
  /* 지금 접속자 카드를 **새 배치**로 그려 봅니다.

     [무엇이 달라지나]
       지금  : 프사가 위, 상태표가 그 옆, 이름·목표·시간이 아래 한 덩어리
       새 것 : 왼쪽에 프사 + 상태표, 오른쪽에 닉네임 박스(이름·목표·시간)

     [작업방에는 영향이 없습니다]
     styles.css 와 새 배치용 CSS 를 모두 **그림자 뿌리 안**에 넣습니다.
     스타일이 그 안에만 머물러서, 관리자 화면도 작업방도 그대로예요.
     마음에 안 들면 이 함수와 카드를 지우면 끝입니다. */
  const CARD_PREVIEW_CSS = `
    :host { all: initial; }
    .wrap{
      display: grid;
      /* [넓힘 2026-08-09] 오른쪽 닉네임 박스가 **지금 작업방의 닉네임
         박스와 같은 폭**(약 216px)이 되도록 카드를 늘렸습니다.
         96(프사) + 10(사이) + 216(닉네임 박스) + 16(카드 안쪽 여백) ≈ 338 */
      grid-template-columns: repeat(auto-fill, minmax(338px, 1fr));
      gap: 14px;
      padding: 4px 2px 2px;
      font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
    }
    /* ── 새 배치 ── 왼쪽 프사+상태, 오른쪽 닉네임 박스 */
    .user-card.side-lay{ display: flex; flex-direction: column; }
    .user-card.side-lay .card-body{
      display: grid;
      grid-template-columns: 96px minmax(216px, 1fr);
      gap: 10px;
      align-items: start;
    }
    .user-card.side-lay .card-avatar-wrap{ width: 100%; max-width: none; }
    .user-card.side-lay .card-state-row{ justify-content: center; margin-top: 6px; }
    .user-card.side-lay .card-state-ghost{ display: none; }
    /* 오른쪽 — 닉네임 박스가 아래로 내려가지 않고 프사 옆에 섭니다 */
    .user-card.side-lay .card-foot{
      margin: 0;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-height: 100%;
    }
    .user-card.side-lay .card-name{ justify-content: flex-start; }
    .user-card.side-lay .card-goal .goal-line{ text-align: left; }
    .user-card.side-lay .card-meta{ margin-top: auto; }
    .empty{ padding: 20px 4px; color: #6B5F52; font-size: 13.5px; }
  `;

  const ST_LABEL = { idle:"☕BREAK☕", writing:"🔥WRITE🔥", focus:"💻JOB💻",
                     rest:"☕BREAK☕", away:"💤AWAY💤" };
  const ST_CLASS = { writing:"writing", focus:"focus", rest:"rest", away:"away" };

  /* 필명으로 눈사람 배경색을 만듭니다 (작업방 script_profile.js 와 같은 방식) */
  function snowBg(nick) {
    let h = 0;
    for (const ch of String(nick)) h = (h * 31 + ch.codePointAt(0)) % 360;
    return `hsl(${h} 52% 72%)`;
  }

  function fmtWork(ms) {
    const m = Math.round(Math.max(0, Number(ms) || 0) / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  }

  function previewCardHtml(nick, row, prof) {
    const st  = String(row.status || "rest");
    const cls = ST_CLASS[st] || "rest";
    const label = row.statusLabel || ST_LABEL[st] || "휴식";

    const photo = String(prof.photo || "");
    const avatar = photo
      ? `<div class="card-avatar has-photo"><img src="${escapeHtml(photo)}" alt="" loading="lazy"></div>`
      : `<div class="card-avatar has-snow"><svg class="snowman" viewBox="0 0 100 100">
           <rect width="100" height="100" fill="${snowBg(nick)}"/>
           <circle cx="50" cy="31" r="13.5" fill="#fff" opacity=".85"/>
           <circle cx="50" cy="56" r="24" fill="#fff" opacity=".85"/></svg></div>`;

    const bg  = /^#[0-9a-f]{6}$/i.test(prof.cardBg || "") ? prof.cardBg : "";
    const pat = String(prof.cardPattern || "none");
    const patCol = /^#[0-9a-f]{6}$/i.test(prof.patColor || "") ? prof.patColor : "#D8DEE8";
    const style = (bg || pat !== "none")
      ? ` style="${bg ? `--cbg:${bg};` : ""}--cpat:${patCol};"` : "";
    const ink = ["cardNickColor","cardGoalColor","cardWhColor"]
      .map((k, i) => (/^#[0-9a-f]{6}$/i.test(prof[k] || "")
        ? `${["--ink-nick","--ink-goal","--ink-wh"][i]}:${prof[k]};` : "")).join("");

    const pCount = Math.max(0, Number(row.pomoCount || 0));
    const goal = row.todayGoalText ? escapeHtml(row.todayGoalText) : "오늘의 한줄 목표 없음";

    return `
      <div class="user-card side-lay ${cls}${pat !== "none" ? ` pat-${pat}` : ""}${bg ? " has-cardbg" : ""}"${style}>
        <div class="card-body">
          <div class="card-avatar-wrap">
            ${avatar}
            <div class="card-state-row">
              <span class="card-state ${cls}">${escapeHtml(label)}</span>
            </div>
          </div>
          <div class="card-foot"${ink ? ` style="${ink}"` : ""}>
            <span class="card-conn" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
            <div class="card-name">${escapeHtml(nick)}</div>
            <div class="card-goal"><div class="goal-line">🎯 ${goal}</div></div>
            <div class="card-meta card-wh">
              <span class="card-wh-t"><small>⏱</small><b>${fmtWork(row.workMs)}</b></span>
              ${pCount > 0 ? `<span class="card-pomo-count">🍅 ${pCount}</span>` : ""}
            </div>
          </div>
        </div>
      </div>`;
  }

  let _cardsShadow = null;

  async function openMemberPreview() {
    el("adm-cards-modal")?.removeAttribute("hidden");
    const host = el("adm-cards-host");
    if (!host) return;

    if (!_cardsShadow) {
      _cardsShadow = host.attachShadow({ mode: "open" });
      _cardsShadow.innerHTML =
        `<link rel="stylesheet" href="styles.css">
         <style>${CARD_PREVIEW_CSS}</style>
         <div class="wrap"></div>`;
    }
    const wrap = _cardsShadow.querySelector(".wrap");
    wrap.innerHTML = `<div class="empty">불러오는 중…</div>`;
    msg("adm-cards-msg", "");

    try {
      const stSnap = await db.ref("status").once("value");
      const all = stSnap.val() || {};
      const now = Date.now();

      /* 접속 중인 사람만 — 15분 넘게 소식이 없으면 뺍니다 */
      const nicks = Object.keys(all).filter(n => {
        const r = all[n] || {};
        const seen = Number(r.lastSeen || 0);
        return !seen || (now - seen) < 15 * 60 * 1000;
      });

      if (!nicks.length) { wrap.innerHTML = `<div class="empty">지금 접속한 사람이 없어요.</div>`; return; }

      /* 프로필은 사람별로 — users 를 통째로 읽지 않습니다 */
      const profs = {};
      await Promise.all(nicks.map(async n => {
        try { profs[n] = (await db.ref(`users/${n}/profile`).once("value")).val() || {}; }
        catch (e) { profs[n] = {}; }
      }));

      wrap.innerHTML = nicks.map(n => previewCardHtml(n, all[n] || {}, profs[n])).join("");
      msg("adm-cards-msg", `${nicks.length}명을 새 배치로 그렸어요.`);
    } catch (e) {
      console.warn("[adm cards]", e);
      wrap.innerHTML = `<div class="empty">불러오지 못했어요.</div>`;
    }
  }

  function closeMemberPreview() {
    el("adm-cards-modal")?.setAttribute("hidden", "");
  }

  // ------------------------------------------------- ③-4 글자수
  /* script_realtime.js 의 clearAllWordcount 와 같은 노드를 지웁니다 */
  async function clearWordcount() {
    if (!confirm("오늘의 글자수 기록을 초기화할까요?\n모두의 오늘 기록·말풍선이 지워집니다. (되돌릴 수 없어요!)")) return;
    const day = dayKey(new Date());
    try {
      await db.ref(`wordfeed/${day}`).remove();
      await db.ref(`wordlog/${day}`).remove();
      msg("adm-wc-msg", "🧹 오늘 글자수 기록을 초기화했어요.");
    } catch (e) {
      msg("adm-wc-msg", "초기화하지 못했어요 — 보안규칙을 확인해 주세요.", true);
    }
  }

  // ------------------------------------------------- ③-5 🎋 대숲 (익명 게시판)
  /* 데이터 구조 — script_forest.js 와 동일:
       forest/{자동키} = { text, color, x, y, rot, at, hearts }

     ★ 글쓴이 정보가 **아예 없습니다.** 관리자도 누가 썼는지 알 수
       없어요. 그것이 이 기능의 목적이라 여기서도 굳이 캐지 않습니다.
       내용 앞부분과 붙인 시각만 보고 지웁니다. */
  const FOREST_KEEP_MS = 30 * 24 * 60 * 60 * 1000;   // 30일

  function forestWhen(at) {
    const t = Number(at) || 0;
    if (!t) return "?";
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  async function loadForest() {
    const box = el("adm-forest-list");
    const cnt = el("adm-forest-count");
    if (box) box.textContent = "불러오는 중…";
    try {
      const raw = (await db.ref("forest").once("value")).val() || {};
      const rows = Object.keys(raw)
        .map(id => ({ id, ...(raw[id] || {}) }))
        .sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));

      if (cnt) cnt.textContent = `쪽지 ${rows.length}장`;
      if (!box) return;
      if (!rows.length) { box.textContent = "아직 붙은 쪽지가 없어요."; return; }

      box.innerHTML = rows.map(r => {
        const head = String(r.text == null ? "" : r.text).replace(/\s+/g, " ").slice(0, 40);
        return `<div class="adm-forest-row">
                  <span class="t" title="${escapeHtml(String(r.text || ""))}">${escapeHtml(head)}</span>
                  <span class="w">${escapeHtml(forestWhen(r.at))} · ♥${Number(r.hearts) || 0}</span>
                  <button class="adm-btn ghost" data-forest-del="${escapeHtml(r.id)}">삭제</button>
                </div>`;
      }).join("");
    } catch (e) {
      console.warn("[adm forest]", e);
      if (cnt) cnt.textContent = "—";
      if (box) box.textContent = "불러오지 못했어요 — 보안규칙(forest)을 확인해 주세요.";
    }
  }

  async function removeForestNote(id) {
    if (!confirm("이 쪽지를 지울까요? (되돌릴 수 없어요!)")) return;
    try {
      await db.ref("forest/" + id).remove();
      msg("adm-forest-msg", "🗑 쪽지 하나를 지웠어요.");
      await loadForest();
    } catch (e) {
      msg("adm-forest-msg", "지우지 못했어요 — 보안규칙을 확인해 주세요.", true);
    }
  }

  /* 30일이 지난 쪽지 정리 — 메인 앱도 팝업을 열 때마다 같은 일을 하지만,
     아무도 대숲을 열지 않으면 청소가 안 됩니다. 그래서 여기에도 둡니다. */
  async function sweepForest() {
    try {
      const raw = (await db.ref("forest").once("value")).val() || {};
      const cut = Date.now() - FOREST_KEEP_MS;
      const dead = Object.keys(raw).filter(id => {
        const at = Number((raw[id] || {}).at) || 0;
        return at && at < cut;
      });
      if (!dead.length) { msg("adm-forest-msg", "시든 쪽지가 없어요. (30일 지난 것 0장)"); return; }
      for (const id of dead) await db.ref("forest/" + id).remove();
      msg("adm-forest-msg", `🍂 30일 지난 쪽지 ${dead.length}장을 정리했어요.`);
      await loadForest();
    } catch (e) {
      msg("adm-forest-msg", "정리하지 못했어요 — 보안규칙을 확인해 주세요.", true);
    }
  }

  /* 전체 비우기 — 되돌릴 수 없어서 confirm 을 두 번 받습니다 */
  async function clearForest() {
    if (!confirm("정말 대숲의 쪽지를 모두 지울까요? (되돌릴 수 없어요!)")) return;
    if (!confirm("한 번 더 확인할게요.\n대숲이 완전히 비워집니다. 계속할까요?")) return;
    try {
      await db.ref("forest").remove();
      msg("adm-forest-msg", "🧹 대숲을 모두 비웠어요.");
      await loadForest();
    } catch (e) {
      msg("adm-forest-msg", "비우지 못했어요 — 보안규칙의 관리자 조건을 확인해 주세요.", true);
    }
  }

  // ------------------------------------------------- 배선
  document.addEventListener("DOMContentLoaded", () => {
    el("adm-login-btn")?.addEventListener("click", doLogin);
    el("adm-pw")?.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) doLogin(); });
    el("adm-pin-btn")?.addEventListener("click", doPin);
    el("adm-pin")?.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) doPin(); });
    el("adm-att-prev")?.addEventListener("click", () => loadAttendance(_attOffset + 1));
    el("adm-att-next")?.addEventListener("click", () => loadAttendance(Math.max(0, _attOffset - 1)));
    /* 출근부는 매번 다시 그려지므로 개별 [✕] 대신 표가 담긴 상자에 위임합니다 */
    el("adm-att-body")?.addEventListener("click", e => {
      const btn = e.target.closest("[data-del-nick]");
      if (btn) removeMember(btn.getAttribute("data-del-nick"));
    });
    el("adm-notice-save")?.addEventListener("click", saveNotice);
    el("adm-notice-clear")?.addEventListener("click", clearNotice);
    el("adm-pin-msg-save")?.addEventListener("click", savePinnedMessage);
    el("adm-pin-msg-clear")?.addEventListener("click", clearPinnedMessage);
    el("adm-uid-copy")?.addEventListener("click", copyMyUid);
    el("adm-hist-apply")?.addEventListener("click", applyHistory);
    el("adm-chat-clear")?.addEventListener("click", clearChat);
    el("adm-chatty-clear")?.addEventListener("click", clearChatty);
    el("adm-wc-clear")?.addEventListener("click", clearWordcount);
    el("adm-log-open")?.addEventListener("click", openAttendLog);
    el("adm-cards-open")?.addEventListener("click", openMemberPreview);
    el("adm-cards-close")?.addEventListener("click", closeMemberPreview);
    el("adm-cards-modal")?.addEventListener("click", e => {
      if (e.target === el("adm-cards-modal")) closeMemberPreview();
    });
    el("adm-log-close")?.addEventListener("click", closeAttendLog);
    el("adm-log-prev")?.addEventListener("click", () => loadAttendLog(_logOffset + 1));
    el("adm-log-next")?.addEventListener("click", () => loadAttendLog(_logOffset - 1));
    /* 바깥을 누르거나 ESC 로도 닫힙니다 */
    el("adm-log-modal")?.addEventListener("click", e => {
      if (e.target === el("adm-log-modal")) closeAttendLog();
    });
    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      if (!el("adm-log-modal")?.hasAttribute("hidden")) closeAttendLog();
      if (!el("adm-cards-modal")?.hasAttribute("hidden")) closeMemberPreview();
    });
    /* 🔐 입장 승인 · 🚫 내보내기 */
    el("adm-allow-add")?.addEventListener("click", () => addAllow(el("adm-allow-nick")?.value));
    el("adm-allow-nick")?.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.isComposing) addAllow(el("adm-allow-nick")?.value);
    });
    el("adm-allow-seed")?.addEventListener("click", seedAllow);
    el("adm-allow-list")?.addEventListener("click", e => {
      const b = e.target.closest("[data-allow-del]");
      if (b) delAllow(b.getAttribute("data-allow-del"));
    });
    el("adm-ban-add")?.addEventListener("click", () => addBan(el("adm-ban-nick")?.value));
    el("adm-ban-nick")?.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.isComposing) addBan(el("adm-ban-nick")?.value);
    });
    el("adm-ban-list")?.addEventListener("click", e => {
      const b = e.target.closest("[data-ban-del]");
      if (b) delBan(b.getAttribute("data-ban-del"));
    });

    el("adm-forest-reload")?.addEventListener("click", loadForest);
    el("adm-forest-sweep")?.addEventListener("click", sweepForest);
    el("adm-forest-clear")?.addEventListener("click", clearForest);
    /* 목록은 다시 그려지므로 개별 [삭제] 대신 목록에 위임합니다 */
    el("adm-forest-list")?.addEventListener("click", e => {
      const btn = e.target.closest("[data-forest-del]");
      if (btn) removeForestNote(btn.getAttribute("data-forest-del"));
    });
  });
})();
