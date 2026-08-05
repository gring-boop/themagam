/* =====================================================================
   script_admin.js — admin.html 전용 스크립트

   메인 앱 스크립트는 하나도 불러오지 않습니다. 필요한 것만 여기에
   작게 다시 담았어요:
     · Firebase 설정 (script_core.js 와 동일 — ★ 코어와 동기 유지)
     · 닉네임→가짜 이메일 변환 (script_auth.js 와 동일한 방식)
     · 관리자 PIN (script_realtime.js 의 ADMIN_PIN 과 동일하게 유지)

   접속 흐름: ① 닉네임+비밀번호 로그인 → ② PIN(1009) → 대시보드.
   PIN 은 진짜 잠금장치가 아닙니다 — 파괴적 동작의 실수 방지용이고,
   진짜 방어는 파이어베이스 보안 규칙이 합니다.
   ===================================================================== */
(function () {
  "use strict";

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

  /* ★ script_realtime.js 의 ADMIN_PIN 과 동기 유지 */
  const ADMIN_PIN = "1009";

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
    loadAttendance(0);
    loadNotice();
    loadHistoryConfig();
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

      /* 표 만들기 */
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
        return `<tr><td class="name-c">${escapeHtml(n)}</td>` +
               `<td class="sum-c">${attDays}</td><td class="sum-c">${vacDays}</td>${cells}</tr>`;
      }).join("");

      body.classList.remove("adm-msg");
      body.innerHTML = `<div class="adm-att-scroll"><table class="adm-att-table">${head}${rows}</table></div>`;
    } catch (e) {
      console.warn("[adm attendance]", e);
      body.innerHTML = "불러오지 못했어요.";
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

  // ------------------------------------------------- 배선
  document.addEventListener("DOMContentLoaded", () => {
    el("adm-login-btn")?.addEventListener("click", doLogin);
    el("adm-pw")?.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) doLogin(); });
    el("adm-pin-btn")?.addEventListener("click", doPin);
    el("adm-pin")?.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) doPin(); });
    el("adm-att-prev")?.addEventListener("click", () => loadAttendance(_attOffset + 1));
    el("adm-att-next")?.addEventListener("click", () => loadAttendance(Math.max(0, _attOffset - 1)));
    el("adm-notice-save")?.addEventListener("click", saveNotice);
    el("adm-notice-clear")?.addEventListener("click", clearNotice);
    el("adm-hist-apply")?.addEventListener("click", applyHistory);
    el("adm-chat-clear")?.addEventListener("click", clearChat);
    el("adm-chatty-clear")?.addEventListener("click", clearChatty);
    el("adm-wc-clear")?.addEventListener("click", clearWordcount);
  });
})();
