/* =====================================================================
   script_auth.js — 필명 + 비밀번호로 입장하기 (로그인 B안)

   [왜 필요한가]
   지금까지는 필명만 치면 누구든 들어올 수 있었습니다. 남의 필명을
   그대로 쳐서 들어가면 그 사람의 프로필·투두·펫을 덮어쓸 수 있었어요.
   보안 규칙만으로는 이걸 막을 수 없습니다. "이 사람이 정말 그 사람인지"
   를 서버가 알 방법이 없기 때문입니다.

   [어떻게 막는가]
   파이어베이스 로그인을 붙입니다. 처음 그 필명으로 들어온 사람이
   비밀번호를 정하고, 그 순간 서버에 도장을 찍습니다.

       nickOwner/{필명} = 그 사람의 계정 번호(uid)

   이 도장은 **한 번 찍히면 아무도 바꿀 수 없습니다** (규칙으로 막음).
   그 뒤로는 그 필명의 데이터는 도장 주인만 쓸 수 있어요.

   [이메일 이야기]
   파이어베이스 로그인은 이메일을 요구합니다. 하지만 이메일을 받고
   싶지는 않았습니다 — 작가님들이 메일 주소를 남기고 싶지 않을 수도
   있고, 관리할 일도 늘어나니까요. 그래서 필명을 가짜 이메일로 바꿔서
   씁니다.

       콩  →  n<필명을 16진수로>@themagam.local

   16진수로 바꾸는 이유는 한글·이모지·공백이 이메일에 못 들어가기
   때문입니다. 이 주소로는 메일이 오가지 않고, 오직 파이어베이스가
   사람을 구분하는 열쇠로만 쓰입니다.

   [비밀번호를 잊으면]
   메일이 진짜가 아니라서 "비밀번호 재설정 메일"을 보낼 수 없습니다.
   관리자(방장)가 파이어베이스 콘솔 → Authentication 에서 직접
   바꿔주거나 계정을 지워야 합니다. 설치안내.md 에 적어두었습니다.
   ===================================================================== */
(function () {
  "use strict";

  const MAIL_DOMAIN = "themagam.local";
  const MIN_PW = 4;

  /* 필명 → 가짜 이메일.
     앞에 n 을 붙이는 건 숫자로 시작하는 주소를 싫어하는 곳이 있어서입니다. */
  function nickToEmail(nick) {
    let hex = "";
    const bytes = new TextEncoder().encode(nick);
    for (const b of bytes) hex += b.toString(16).padStart(2, "0");
    return "n" + hex + "@" + MAIL_DOMAIN;
  }

  function el(id) { return document.getElementById(id); }

  function setMsg(text, bad) {
    const box = el("join-msg");
    if (!box) return;
    box.textContent = text || "";
    box.classList.toggle("bad", !!bad);
    box.style.display = text ? "" : "none";
  }

  function busy(on) {
    const b = el("join-btn");
    if (!b) return;
    b.disabled = !!on;
    b.textContent = on ? "확인 중…" : "입장하기";
  }

  /* ---------------------------------------------------------------
     도장 찍기 — 이미 주인이 있으면 그대로 두고, 없으면 내가 찍습니다.

     트랜잭션을 쓰는 이유: 두 사람이 같은 순간에 같은 필명으로 들어오면
     둘 다 "비어 있네" 를 보고 둘 다 찍어버릴 수 있습니다. 트랜잭션은
     서버가 한 명씩 차례로 처리하게 만들어 이걸 막아줍니다.
     --------------------------------------------------------------- */
  async function claimNick(nick, uid) {
    const ref = firebase.database().ref("nickOwner/" + encodeURIComponent(nick));
    const res = await ref.transaction(cur => (cur === null ? uid : undefined));
    const owner = res.snapshot.val();
    return owner === uid;
  }

  /* ---------------------------------------------------------------
     입장 버튼이 실제로 하는 일
     --------------------------------------------------------------- */
  async function authenticate() {
    const nick = (el("nick-input")?.value || "").trim();
    const pw   = (el("pw-input")?.value || "");

    if (!nick) { setMsg("필명을 입력해주세요.", true); el("nick-input")?.focus(); return false; }
    if (pw.length < MIN_PW) {
      setMsg(`비밀번호는 ${MIN_PW}자 이상으로 정해주세요.`, true);
      el("pw-input")?.focus();
      return false;
    }

    const auth  = firebase.auth();
    const email = nickToEmail(nick);

    busy(true);
    setMsg("");
    try {
      let cred;
      try {
        /* 있는 계정이면 로그인 */
        cred = await auth.signInWithEmailAndPassword(email, pw);
      } catch (e) {
        if (e.code === "auth/user-not-found") {
          /* 처음 쓰는 필명이면 그 자리에서 계정을 만듭니다 */
          cred = await auth.createUserWithEmailAndPassword(email, pw);
        } else if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
          setMsg("이미 쓰이고 있는 필명이에요. 비밀번호가 다릅니다.", true);
          el("pw-input")?.select();
          return false;
        } else if (e.code === "auth/too-many-requests") {
          setMsg("시도가 너무 많았어요. 잠시 뒤에 다시 해주세요.", true);
          return false;
        } else if (e.code === "auth/operation-not-allowed") {
          setMsg("파이어베이스에서 이메일/비밀번호 로그인을 켜야 해요. (설치안내 참고)", true);
          return false;
        } else if (e.code === "auth/network-request-failed") {
          setMsg("인터넷 연결을 확인해주세요.", true);
          return false;
        } else {
          setMsg("로그인에 실패했어요. " + (e.code || e.message || ""), true);
          return false;
        }
      }

      const uid = cred.user.uid;
      const mine = await claimNick(nick, uid);
      if (!mine) {
        /* 계정은 만들어졌는데 필명 도장은 남의 것 — 아주 드문 경우입니다
           (같은 순간에 두 사람이 같은 필명을 처음 쓴 경우) */
        await auth.signOut();
        setMsg("방금 다른 분이 이 필명을 먼저 가져갔어요. 다른 필명으로 해주세요.", true);
        return false;
      }

      window.myUid = uid;
      setMsg("");
      return true;
    } finally {
      busy(false);
    }
  }

  /* ---------------------------------------------------------------
     기존 join() 앞에 끼워 넣기

     script_core.js 의 join() 은 그대로 두고, 그 앞에서 로그인을
     먼저 시킵니다. 실패하면 join() 을 아예 부르지 않습니다.
     (script_profile.js 도 join 을 감싸므로, 이 파일이 먼저 실행돼야
      순서가 로그인 → 입장 → 프로필 이 됩니다.)
     --------------------------------------------------------------- */
  const _join = window.join;
  if (typeof _join === "function" && !_join.__authPatched) {
    const wrapped = async function () {
      const okAuth = await authenticate();
      if (!okAuth) return;
      return _join.apply(this, arguments);
    };
    wrapped.__authPatched = true;
    window.join = wrapped;
  }

  /* 비밀번호 칸에서 Enter 를 눌러도 입장되게 */
  document.addEventListener("DOMContentLoaded", () => {
    el("pw-input")?.addEventListener("keydown", (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter") { e.preventDefault(); window.join?.(); }
    });
  });

  window.Auth = { nickToEmail, MIN_PW, MAIL_DOMAIN };
})();
