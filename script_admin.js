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
    loadSecretAllow();
    loadForest();
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
      const [asnap, nickSnap] = await Promise.all([
        db.ref("attendance").orderByKey()
          .startAt(`${ymKey}-01`).endAt(`${ymKey}-31`).once("value"),
        db.ref("nickOwner").once("value")
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
      let cntRow = `<tr><th class="name-h cnt-h">인원</th><th class="sum-h cnt-h"></th><th class="sum-h cnt-h"></th>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const dk = `${ymKey}-${String(d).padStart(2, "0")}`;
        const dow = new Date(base.getFullYear(), base.getMonth(), d).getDay();
        const c = cntByDay[dk] || 0;
        const cls = "cnt" + (dow === 0 || dow === 6 ? " we" : "") + (c === 0 ? " zero" : "");
        cntRow += `<th class="${cls}">${c === 0 ? "" : c}</th>`;
      }
      cntRow += "</tr>";

      let head = `<tr><th class="name-h">이름</th><th class="sum-h">출석</th><th class="sum-h">휴가</th>`;
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
        let attDays = 0, vacDays = 0, cells = "";
        for (let d = 1; d <= daysInMonth; d++) {
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
        /* 이름 옆 [✕] — 탈퇴 인원 삭제. 늘 있지만 아주 옅게, 마우스를 올리면 진해집니다. */
        return `<tr><td class="name-c"><span class="nmw">` +
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
       rooms/secret/allow/{uid}   비밀방 승인

     남기는 곳
       messages / messages2 / messages3 — 지난 발언은 지우지 않습니다.
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
      /* ★ 순서 주의 — nickOwner 를 지우기 전에 uid 를 먼저 확보해야
         비밀방 승인(rooms/secret/allow/{uid})을 찾아 지울 수 있어요. */
      const uid = (await db.ref("nickOwner/" + nick).once("value")).val();

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
      if (uid) { try { await db.ref("rooms/secret/allow/" + uid).remove(); } catch (e) {} }
      await db.ref("nickOwner/" + nick).remove();     // 맨 마지막 — 도장 반납

      await loadAttendance(_attOffset);
      msg("adm-att-msg", `🗑️ ${nick}님을 지웠어요.`);
      try { await loadSecretAllow(); } catch (e) {}
    } catch (e) {
      console.warn("[adm removeMember]", e);
      msg("adm-att-msg", "지우지 못했어요 — 보안규칙에 관리자 예외가 들어갔는지 확인해 주세요.", true);
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

  // ------------------------------------------------- ③-3.5 🔒 비밀방
  /* 데이터 구조
       rooms/secret/allow/{uid} = true   ← 승인 명단 (uid 는 auth uid)
       nickOwner/{닉}          = uid     ← 닉 ↔ uid 매핑 (메인 앱이 심습니다)
       messages3               = 방 대화

     화면에는 uid 대신 닉을 보여주려고 nickOwner 를 통째로 읽어 역매핑합니다.
     (도장이 지워진 uid 는 닉을 못 찾으니 uid 앞자리만 보여줍니다) */
  let _secretAllow = {};   // { uid: 닉 or null }

  async function loadSecretAllow() {
    const box = el("adm-secret-list");
    if (box) box.textContent = "불러오는 중…";
    try {
      const [allowSnap, nickSnap] = await Promise.all([
        db.ref("rooms/secret/allow").once("value"),
        db.ref("nickOwner").once("value")
      ]);
      const allow = allowSnap.val() || {};
      const nickByUid = {};
      Object.entries(nickSnap.val() || {}).forEach(([nick, uid]) => {
        if (uid) nickByUid[uid] = nick;
      });

      _secretAllow = {};
      Object.keys(allow).forEach(uid => {
        if (allow[uid] === true) _secretAllow[uid] = nickByUid[uid] || null;
      });

      const uids = Object.keys(_secretAllow);
      if (!box) return;
      if (!uids.length) { box.textContent = "아직 승인된 사람이 없어요."; return; }

      box.innerHTML = uids.map(uid => {
        const nick = _secretAllow[uid];
        const shown = nick ? escapeHtml(nick) : `(닉 미상 · ${escapeHtml(uid.slice(0, 8))}…)`;
        return `<div class="adm-secret-row">🔓 ${shown}
                  <button class="adm-btn ghost" data-secret-off="${escapeHtml(uid)}">해제</button>
                </div>`;
      }).join("");
    } catch (e) {
      console.warn("[adm secret]", e);
      if (box) box.textContent = "불러오지 못했어요 — 보안규칙(rooms)을 확인해 주세요.";
    }
  }

  async function addSecret() {
    const nick = (el("adm-secret-nick")?.value || "").trim();
    if (!nick) { msg("adm-secret-msg", "닉네임을 입력해 주세요.", true); return; }
    try {
      const uid = (await db.ref("nickOwner/" + nick).once("value")).val();
      if (!uid) {
        msg("adm-secret-msg", `'${nick}' 은(는) 등록되지 않은 닉네임이에요. 메인 방에서 먼저 입장해야 해요.`, true);
        return;
      }
      await db.ref("rooms/secret/allow/" + uid).set(true);
      el("adm-secret-nick").value = "";
      msg("adm-secret-msg", `✅ '${nick}' 님을 비밀방에 승인했어요. (다음 입장부터 보여요)`);
      await loadSecretAllow();
    } catch (e) {
      msg("adm-secret-msg", "승인하지 못했어요 — 보안규칙을 확인해 주세요.", true);
    }
  }

  async function removeSecret(uid) {
    const nick = _secretAllow[uid] || uid;
    if (!confirm(`'${nick}' 님의 비밀방 승인을 해제할까요?`)) return;
    try {
      await db.ref("rooms/secret/allow/" + uid).remove();
      msg("adm-secret-msg", `🔒 '${nick}' 님의 승인을 해제했어요.`);
      await loadSecretAllow();
    } catch (e) {
      msg("adm-secret-msg", "해제하지 못했어요.", true);
    }
  }

  async function clearSecret() {
    if (!confirm("정말 비밀방 대화를 모두 삭제할까요? (되돌릴 수 없어요!)")) return;
    try {
      await db.ref("messages3").remove();
      msg("adm-secret-msg", "🧹 비밀방 대화를 모두 삭제했어요.");
    } catch (e) {
      msg("adm-secret-msg", "삭제하지 못했어요 — 관리자 계정도 승인 명단에 있어야 지울 수 있어요.", true);
    }
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
    el("adm-secret-add")?.addEventListener("click", addSecret);
    el("adm-secret-reload")?.addEventListener("click", loadSecretAllow);
    el("adm-secret-clear")?.addEventListener("click", clearSecret);
    el("adm-secret-nick")?.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) addSecret(); });
    /* 명단은 다시 그려지므로 개별 버튼 대신 목록에 위임합니다 */
    el("adm-secret-list")?.addEventListener("click", e => {
      const btn = e.target.closest("[data-secret-off]");
      if (btn) removeSecret(btn.getAttribute("data-secret-off"));
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
