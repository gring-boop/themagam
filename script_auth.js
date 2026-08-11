/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_auth.js — 닉네임 + 비밀번호로 입장하기 (로그인 B안)

   [왜 필요한가]
   지금까지는 닉네임만 치면 누구든 들어올 수 있었습니다. 남의 닉네임을
   그대로 쳐서 들어가면 그 사람의 프로필·투두·펫을 덮어쓸 수 있었어요.
   보안 규칙만으로는 이걸 막을 수 없습니다. "이 사람이 정말 그 사람인지"
   를 서버가 알 방법이 없기 때문입니다.

   [어떻게 막는가]
   파이어베이스 로그인을 붙입니다. 처음 그 닉네임으로 들어온 사람이
   비밀번호를 정하고, 그 순간 서버에 도장을 찍습니다.

       nickOwner/{닉네임} = 그 사람의 계정 번호(uid)

   이 도장은 **한 번 찍히면 아무도 바꿀 수 없습니다** (규칙으로 막음).
   그 뒤로는 그 닉네임의 데이터는 도장 주인만 쓸 수 있어요.

   [이메일 이야기]
   파이어베이스 로그인은 이메일을 요구합니다. 하지만 이메일을 받고
   싶지는 않았습니다 — 작가님들이 메일 주소를 남기고 싶지 않을 수도
   있고, 관리할 일도 늘어나니까요. 그래서 닉네임을 가짜 이메일로 바꿔서
   씁니다.

       콩  →  n<닉네임을 16진수로>@themagam.local

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
  /* 파이어베이스가 6자 미만을 아예 거부합니다. 4자로 안내하면
     "정했는데 안 된다"는 일이 생기므로 처음부터 6자로 받습니다. */
  const MIN_PW = 6;

  /* 닉네임 → 가짜 이메일.
     앞에 n 을 붙이는 건 숫자로 시작하는 주소를 싫어하는 곳이 있어서입니다. */
  function nickToEmail(nick) {
    let hex = "";
    const bytes = new TextEncoder().encode(nick);
    for (const b of bytes) hex += b.toString(16).padStart(2, "0");
    return "n" + hex + "@" + MAIL_DOMAIN;
  }

  function el(id) { return document.getElementById(id); }

  /* 도장을 놓을 자리 이름.

     ★ 반드시 **닉네임 그대로** 써야 합니다.

     방의 나머지 코드는 전부 `users/호랑🐯`, `status/호랑🐯` 처럼
     닉네임을 있는 그대로 씁니다. 보안 규칙은 그 이름으로 도장을 찾아요.
     여기서만 주소용으로 변환(`%ED%98%B8...`)하면 이름이 어긋나서
     도장을 못 찾고, **로그인은 됐는데 아무것도 저장이 안 되는**
     상태가 됩니다. 실제로 그런 일이 있었습니다.

     파이어베이스가 키에 못 쓰는 글자만 미리 걸러냅니다. 이 글자들은
     어차피 방의 다른 곳에서도 터지므로 입장 자체를 막는 게 맞습니다. */
  const BAD_KEY_CHARS = /[.$#\[\]\/]/;

  function ownerRef(nick) {
    return firebase.database().ref("nickOwner/" + nick);
  }

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

  /* 이 닉네임에 이미 주인이 있는지 먼저 봅니다.

     [왜 굳이 먼저 보는가]
     예전 파이어베이스는 로그인 실패 이유를 "그런 계정 없음"과
     "비밀번호 틀림"으로 나눠서 알려줬습니다. 그래서 "계정 없음"이
     오면 그 자리에서 새로 만들면 됐어요.

     그런데 요즘은 둘을 뭉쳐서 `invalid-login-credentials` 하나로만
     답합니다. 남의 닉네임을 넣어보며 "이 사람 가입했나?"를 캐내는 것을
     막으려는 조치예요. 좋은 변화지만, 덕분에 "처음 온 사람"을 구분할
     수 없게 됐습니다.

     그래서 파이어베이스 대신 **우리 도장**을 봅니다. 도장은 누구나
     읽을 수 있게 열어둔 값이라 로그인 전에도 확인할 수 있어요.
     도장이 없으면 처음 온 닉네임, 있으면 이미 주인이 있는 닉네임입니다. */
  async function ownerOf(nick) {
    const snap = await ownerRef(nick).once("value");
    return snap.val();
  }

  /* ---------------------------------------------------------------
     도장 찍기 — 이미 주인이 있으면 그대로 두고, 없으면 내가 찍습니다.

     트랜잭션을 쓰는 이유: 두 사람이 같은 순간에 같은 닉네임으로 들어오면
     둘 다 "비어 있네" 를 보고 둘 다 찍어버릴 수 있습니다. 트랜잭션은
     서버가 한 명씩 차례로 처리하게 만들어 이걸 막아줍니다.
     --------------------------------------------------------------- */
  async function claimNick(nick, uid) {
    const res = await ownerRef(nick).transaction(cur => (cur === null ? uid : undefined));
    const owner = res.snapshot.val();
    return owner === uid;
  }

  /* 어느 쪽에서 나든 뜻이 같은 오류들.
     처리했으면 true 를 돌려줍니다. */
  function handleCommon(e) {
    const c = e && e.code;
    if (c === "auth/too-many-requests") {
      setMsg("시도가 너무 많았어요. 잠시 뒤에 다시 해주세요.", true); return true;
    }
    if (c === "auth/operation-not-allowed") {
      setMsg("파이어베이스에서 이메일/비밀번호 로그인을 켜야 해요. (설치안내 ②-B)", true); return true;
    }
    if (c === "auth/network-request-failed") {
      setMsg("인터넷 연결을 확인해주세요.", true); return true;
    }
    if (c === "auth/weak-password") {
      setMsg("비밀번호가 너무 짧아요. 6자 이상으로 해주세요.", true); return true;
    }
    return false;
  }

  /* ---------------------------------------------------------------
     입장 버튼이 실제로 하는 일
     --------------------------------------------------------------- */
  async function authenticate() {
    const nick = (el("nick-input")?.value || "").trim();
    const pw   = (el("pw-input")?.value || "");

    if (!nick) { setMsg("닉네임을 입력해주세요.", true); el("nick-input")?.focus(); return false; }
    if (BAD_KEY_CHARS.test(nick)) {
      setMsg("닉네임에 . $ # [ ] / 는 쓸 수 없어요. 빼고 다시 해주세요.", true);
      el("nick-input")?.focus();
      return false;
    }
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
      /* ★ 로그인을 **탭 단위**로 둡니다.

         [무엇이 잘못됐었나]
         파이어베이스 로그인은 기본이 "브라우저 단위"(LOCAL)입니다.
         창을 두 개 열어 서로 다른 닉네임으로 들어가면, 나중에 들어간
         쪽이 앞의 로그인을 **덮어버립니다.**

         그러면 앞 창은 겉보기엔 멀쩡한데 서버가 그 창의 저장을 전부
         거절합니다. 오류도 안 뜨고 조용히요. 실제로 이런 일이 있었어요.

             호랑으로 입장 → 다른 창에서 그링링으로 입장
             → 호랑 창에서 기록해도 채팅에 안 올라감
             → 새 편을 눌러도 기준이 안 바뀜 (거절돼서 되돌아감)
             → 번갈아 쓰면 한쪽이 멈춘 것처럼 보임

         SESSION 으로 두면 탭마다 따로 로그인됩니다. 창을 닫으면
         풀리지만, 어차피 들어올 때마다 비밀번호를 받으니 상관없어요.
         테스트하기도 이쪽이 훨씬 편합니다. */
      try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
      } catch (e) { /* 못 바꿔도 로그인은 진행합니다 */ }

      const owner = await ownerOf(nick);

      /* =====================================================================
         🔐 승인·내보내기 확인 (2026-08-11)
         ---------------------------------------------------------------------
         ★ 여기서 막는 건 **안내를 위한 것**입니다. 진짜 자물쇠는 보안규칙이라
           이 줄을 지워도 뚫리지 않아요. 다만 안내가 없으면 "비밀번호가
           틀렸나?" 하고 헤매게 되니, 먼저 읽고 알려 줍니다.

         config 는 누구나 읽을 수 있게 열려 있고(쓰기만 방장), 그래서
         입장 전에도 확인할 수 있습니다. */
      try {
        const banned = (await firebase.database().ref("config/ban/" + nick).once("value")).val();
        if (banned) {
          setMsg("이 닉네임은 방장이 내보낸 상태예요. 방장에게 말해 주세요.", true);
          return false;
        }
        if (owner === null) {
          const ok = (await firebase.database().ref("config/allow/" + nick).once("value")).val();
          if (ok !== true) {
            setMsg("방장이 승인한 닉네임만 들어올 수 있어요. 방장에게 닉네임을 알려 주세요.", true);
            return false;
          }
        }
      } catch (e) { /* 못 읽으면 그냥 진행 — 어차피 서버가 막습니다 */ }

      let cred;

      if (owner === null) {
        /* 처음 쓰는 닉네임 — 계정을 만듭니다 */
        try {
          cred = await auth.createUserWithEmailAndPassword(email, pw);
        } catch (e) {
          if (e.code === "auth/email-already-in-use") {
            /* 계정은 있는데 도장이 없는 경우입니다. 방장이 도장만 지웠거나,
               예전에 만들다 만 계정이에요. 있는 비밀번호로 들어가 봅니다. */
            try {
              cred = await auth.signInWithEmailAndPassword(email, pw);
            } catch (e2) {
              setMsg("예전에 쓰던 닉네임이에요. 그때 비밀번호를 넣어주세요. 기억이 안 나면 방장에게 말해주세요.", true);
              el("pw-input")?.select();
              return false;
            }
          } else if (!handleCommon(e)) {
            setMsg("계정을 만들지 못했어요. " + (e.code || e.message || ""), true);
            return false;
          } else {
            return false;
          }
        }
      } else {
        /* 이미 주인이 있는 닉네임 — 로그인만 시도합니다 */
        try {
          cred = await auth.signInWithEmailAndPassword(email, pw);
        } catch (e) {
          if (!handleCommon(e)) {
            /* 요즘 파이어베이스는 실패 이유를 알려주지 않습니다.
               도장이 있는 건 확인했으니, 비밀번호가 틀린 것입니다. */
            setMsg("비밀번호가 달라요. 이 닉네임은 이미 쓰이고 있습니다.", true);
            el("pw-input")?.select();
          }
          return false;
        }
      }

      const uid = cred.user.uid;
      let mine = false;
      try {
        mine = await claimNick(nick, uid);
      } catch (e) {
        /* 규칙이 막은 경우 — 승인 명단에 없는 새 닉네임입니다 */
        await auth.signOut();
        setMsg("방장이 승인한 닉네임만 들어올 수 있어요. 방장에게 닉네임을 알려 주세요.", true);
        return false;
      }
      if (!mine) {
        /* 계정은 만들어졌는데 닉네임 도장은 남의 것 — 아주 드문 경우입니다
           (같은 순간에 두 사람이 같은 닉네임을 처음 쓴 경우) */
        await auth.signOut();
        setMsg("방금 다른 분이 이 닉네임을 먼저 가져갔어요. 다른 닉네임으로 해주세요.", true);
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
