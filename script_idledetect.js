/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 자리비움 자동 감지 (script_idledetect.js)

   크롬의 Idle Detection API(IdleDetector)로 "시스템 전체" 무입력을
   감지합니다. 탭 밖에서 다른 프로그램을 쓰고 있어도 키보드·마우스가
   움직이는 한 '활동 중'으로 봅니다.

   하는 일 두 가지.
     ① 무입력 20분 → 내 상태를 💤AWAY 로 자동 강등.
        (직접 WORK 를 골라뒀어도 예외 없음 — 자리에 없으면 없는 것)
     ② 입력이 다시 감지되면, **자동으로 AWAY 가 된 경우에만**
        강등 직전 상태로 복귀. 사람이 직접 AWAY 를 고른 경우엔
        절대 건드리지 않습니다.

   상태 전환은 새 길을 뚫지 않습니다. 상태 고르기 판(pick)과 똑같이
   숨은 <select id="db-status"> 를 조작하고 input 이벤트를 쏩니다.
   그러면 savePersonalData → updateStatus → (timelog 래퍼) switchTo 로
   이어지는 기존 저장·집계 흐름을 그대로 타서, 작업 시간도 함께
   멈추고 다시 흐릅니다.

   알려진 한계 — 브라우저가 탭을 통째로 재우면(메모리 절약 등) 이
   감지기도 함께 멈춥니다. 코드로는 어쩔 수 없어서 여기 적어만 둡니다.
   미지원 브라우저(사파리·파이어폭스)에서는 버튼이 흐려지고, 누르면
   안내만 나옵니다.
   ===================================================================== */
(function () {
  /* IdleDetector threshold 는 최소 60000ms 제약이 있습니다. 20분이면 넉넉. */
  const IDLE_THRESHOLD_MS = 20 * 60 * 1000;

  let _idleEnabled = false;      // 토글 상태 (저장값과 동기)
  let _idleDetector = null;      // 돌고 있는 IdleDetector
  let _idleAbort = null;         // 감지 중단용 AbortController
  let _prevStatus = null;        // 자동 강등 직전 상태 — 복귀할 곳
  let _autoAway = false;         // "마지막 AWAY 전환이 자동이었나" 꼬리표
  let _settingByCode = false;    // 지금 상태를 바꾸는 게 이 코드인가 (수동 감지용)

  function _supported() { return typeof IdleDetector !== "undefined"; }

  /* ---------------------------------------------------------------
     "이 AWAY 는 자동이었다" 꼬리표를 기기에 남깁니다

     [왜 필요한가]
     _autoAway 는 그냥 변수라, 새로고침하거나 창을 닫았다 열면 false 로
     돌아갑니다. 그런데 상태(away)는 서버에 남아 있어요. 그래서
     "자동으로 AWAY 가 된 채 나갔다가 다시 들어오면" 둘이 어긋납니다 —
     화면은 AWAY 인데 꼬리표는 없으니, 마우스를 아무리 움직여도
     복귀 함수가 첫 줄에서 그냥 돌아섭니다. 영영 안 풀려요.

     꼬리표를 닉네임별로 적어 두면 다시 들어와도 이어집니다.
     (기기별로 두는 게 맞습니다 — 집 컴퓨터에서 자동으로 자리비움이 된 것을
      회사 컴퓨터에서 풀어 줄 이유는 없으니까요) */
  function _tagKey() { return `idleAutoAway_${myNick || "게스트"}`; }

  function _saveTag() {
    try {
      if (_autoAway) AppStore.setItem(_tagKey(), _prevStatus || "writing");
      else AppStore.removeItem(_tagKey());
    } catch (e) {}
  }

  function _loadTag() {
    try {
      const v = AppStore.getItem(_tagKey());
      if (v) { _autoAway = true; _prevStatus = v; }
    } catch (e) {}
  }

  function _curStatus() {
    return document.getElementById("db-status")?.value || "rest";
  }

  /** 상태 고르기 판의 pick() 과 같은 길 — 기존 저장·집계 흐름을 그대로 탑니다 */
  function _setStatus(v) {
    const sel = document.getElementById("db-status");
    if (!sel) return;
    _settingByCode = true;
    try {
      sel.value = v;
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      window.renderQuickStatusBtn?.();
    } finally {
      /* input 리스너는 동기로 다 돌고 나서야 여기로 돌아옵니다 */
      _settingByCode = false;
    }
  }

  /* ---------------------------------------------------------------
     수동 전환 감지 — 사람이 상태를 직접 바꾸면 꼬리표를 뗍니다.
     상태 고르기 판이든 어디든, db-status 의 input 은 여기로 다 옵니다.
     --------------------------------------------------------------- */
  function _watchManualChange() {
    const sel = document.getElementById("db-status");
    if (!sel || sel.__idleWatched) return;
    sel.__idleWatched = true;
    sel.addEventListener("input", () => {
      if (_settingByCode) return;          // 우리가 바꾼 것 — 수동 아님
      /* 사람이 손으로 골랐습니다. 자동 복귀는 없던 일로. */
      _autoAway = false;
      _prevStatus = null;
      _saveTag();
    });
  }

  /* ---------------------------------------------------------------
     강등과 복귀
     --------------------------------------------------------------- */
  function _demoteToAway() {
    if (!myNick) return;
    const cur = _curStatus();
    if (cur === "away") return;            // 이미 자리비움 — 할 일 없음
    _prevStatus = cur;                     // 돌아올 곳을 기억
    _autoAway = true;
    _saveTag();
    _setStatus("away");
    console.log("[자동감지] 무입력 20분 →", cur, "→ away 자동 전환");
  }

  function _restoreIfAutoAway() {
    if (!myNick) return;
    if (!_autoAway) return;                // 사람이 직접 고른 AWAY — 건드리지 않음
    /* 상태 칸이 비어 있으면 아직 안 불러온 것입니다 — 판단을 미룹니다.
       (여기서 꼬리표를 지우면 되돌릴 근거가 사라집니다) */
    const raw = document.getElementById("db-status")?.value || "";
    if (!raw) return;
    if (_curStatus() !== "away") { _autoAway = false; _saveTag(); return; }
    const back = _prevStatus || "writing";
    _autoAway = false;
    _prevStatus = null;
    _saveTag();
    _setStatus(back);
    console.log("[자동감지] 입력 재감지 → away →", back, "자동 복귀");
  }

  /* ---------------------------------------------------------------
     감지기 시작·중단
     --------------------------------------------------------------- */
  async function _startDetector() {
    if (!_supported()) return false;
    _stopDetector();
    try {
      _idleAbort = new AbortController();
      _idleDetector = new IdleDetector();
      _idleDetector.addEventListener("change", () => {
        const st = _idleDetector?.userState;
        if (st === "idle") _demoteToAway();
        else if (st === "active") _restoreIfAutoAway();
      });
      await _idleDetector.start({
        threshold: IDLE_THRESHOLD_MS,
        signal: _idleAbort.signal
      });

      /* [고침 2026-08-09] 켠 직후 지금 상태를 한 번 봅니다.

         IdleDetector 는 **바뀔 때만** 알려줍니다. 접속한 사람은 방금
         버튼을 눌렀으니 당연히 활동 중인데, 그러면 change 이벤트가
         아예 오지 않아요. 지난번에 자동으로 AWAY 가 된 채 나갔다면
         화면은 AWAY 인 채로 굳어 버립니다.
         그래서 시작하자마자 한 번 직접 물어봅니다. */
      _loadTag();
      _firstCheckWhenReady();

      return true;
    } catch (e) {
      console.warn("[IdleDetector start failed]", e);
      window._idleLastErr = e;             // 알림에 이유를 보여주기 위해 보관
      _stopDetector();
      return false;
    }
  }

  /* [고침 2026-08-09 · 2차] 상태를 **다 불러온 뒤에** 판단합니다.

     이 검출기는 script_core.js 에서 loadPersonalData 보다 **먼저** 시작됩니다.
     그때는 상태 칸(#db-status)이 아직 비어 있어요. 그 상태로 판단하면
     "지금 AWAY 아니네" 로 읽고 꼬리표를 지워 버립니다. 그 직후 서버에서
     away 가 들어오는데, 되돌릴 근거는 이미 사라진 뒤죠.
     → 자동감지를 켜 두어도 접속할 때마다 AWAY 에 갇히던 이유입니다.

     그래서 상태 칸에 값이 들어올 때까지 기다렸다가 판단합니다.
     (최대 10초. 그 안에 안 들어오면 그냥 넘어갑니다 — 억지로 바꾸는 것보다
      가만히 두는 쪽이 안전해요) */
  function _firstCheckWhenReady(tries = 0) {
    if (!_idleDetector) return;                       // 그새 꺼졌으면 그만
    const loaded = !!document.getElementById("db-status")?.value;
    if (!loaded && tries < 40) {
      setTimeout(() => _firstCheckWhenReady(tries + 1), 250);
      return;
    }
    if (!loaded) return;
    if (_idleDetector.userState === "idle") _demoteToAway();
    else _restoreIfAutoAway();
  }

  function _stopDetector() {
    try { _idleAbort?.abort(); } catch (e) {}
    _idleAbort = null;
    _idleDetector = null;
  }

  /* ---------------------------------------------------------------
     설정 저장·로드 — pomoParticipation 과 같은 모양
     --------------------------------------------------------------- */
  async function _saveIdleDetectToFirebase(isOn) {
    if (!myNick) return;
    try {
      await db.ref(`users/${myNick}/idleDetect`).set({
        enabled: !!isOn,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn("[saveIdleDetect failed]", e);
    }
  }

  async function _loadIdleDetectFromFirebase() {
    if (!myNick) return false;
    try {
      const snap = await db.ref(`users/${myNick}/idleDetect`).once("value");
      const v = snap.val();
      return !!(v && v.enabled === true);
    } catch (e) {
      console.warn("[loadIdleDetect failed]", e);
      return false;
    }
  }

  /* ---------------------------------------------------------------
     버튼 그리기
     --------------------------------------------------------------- */
  function _renderButton() {
    const btn = document.getElementById("idle-detect-btn");
    if (!btn) return;
    if (!_supported()) {
      /* 미지원 브라우저 — 흐리게. 누르면 toggleIdleDetect 가 안내를 냅니다 */
      btn.classList.add("dim");
      btn.style.opacity = ".45";
      btn.title = "자리비움 자동 감지 — 크롬·엣지 전용";
    }
    const label = btn.querySelector(".icon-btn-label");
    if (label) label.textContent = _idleEnabled ? "자동감지 ON" : "자동감지 OFF";
  }

  /* ---------------------------------------------------------------
     토글 (버튼 onclick) — 켜기는 사용자 제스처가 필요합니다
     (IdleDetector.requestPermission 은 클릭 안에서만 허용됩니다)
     --------------------------------------------------------------- */
  async function toggleIdleDetect() {
    if (!_supported()) {
      alert("자리비움 자동 감지는 크롬·엣지에서만 쓸 수 있어요.");
      return;
    }
    if (!myNick) return;

    if (_idleEnabled) {
      /* 끄기 */
      _idleEnabled = false;
      _stopDetector();
      _autoAway = false;
      _prevStatus = null;
      _renderButton();
      await _saveIdleDetectToFirebase(false);
      return;
    }

    /* 켜기 — 권한부터 */
    let perm = "denied";
    try { perm = await IdleDetector.requestPermission(); } catch (e) {}
    if (perm !== "granted") {
      alert("자리비움 감지 권한이 거부됐어요. 주소창 자물쇠 → 사이트 설정에서 허용해 주세요.");
      return;
    }
    /* [고침 2026-08-05] 첫 시작이 간혹 거절되는 경우가 있어 1초 뒤 한 번 더.
       그래도 안 되면 실패 이유(에러 이름·문구)를 그대로 보여줍니다 —
       "잠시 후 다시"만으로는 원인을 알 수 없었습니다. */
    let ok = await _startDetector();
    if (!ok) {
      await new Promise(r => setTimeout(r, 1000));
      ok = await _startDetector();
    }
    if (!ok) {
      const err = window._idleLastErr;
      const why = err ? `\n\n(이유: ${err.name || ""} ${err.message || err})` : "";
      alert("자리비움 감지를 시작하지 못했어요." + why
        + "\n\n이 문구를 캡쳐해서 알려주시면 원인을 찾을 수 있어요.");
      return;
    }
    _idleEnabled = true;
    _watchManualChange();
    _renderButton();
    await _saveIdleDetectToFirebase(true);
  }
  window.toggleIdleDetect = toggleIdleDetect;

  /* ---------------------------------------------------------------
     입장 후 초기화 (core 가 호출) — 저장값이 켜짐이고 권한이 이미
     granted 인 경우에만 조용히 자동 시작. 권한이 없으면 OFF 표시.
     (권한 요청은 사용자 제스처가 필요해서 여기선 못 합니다)
     --------------------------------------------------------------- */
  window.afterJoinInitIdleDetect = async function () {
    _watchManualChange();
    if (!_supported()) { _renderButton(); return; }

    const saved = await _loadIdleDetectFromFirebase();
    if (saved) {
      let granted = false;
      try {
        const st = await navigator.permissions.query({ name: "idle-detection" });
        granted = (st.state === "granted");
      } catch (e) {}
      if (granted && await _startDetector()) _idleEnabled = true;
    }
    _renderButton();
  };
})();
