/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 무음 접속 유지 (script_alive.js)

   [무엇인가]
   들리지 않을 만큼 작은 소리를 계속 흘려서, 브라우저가 이 탭을
   재우지 못하게 붙잡아 둡니다. 다른 창을 오래 보다가 돌아와도
   접속이 끊겨 있지 않아요.

   [왜 되는가]
   브라우저는 배경 탭을 재워서 배터리를 아낍니다. 그런데 **소리가
   나는 탭은 재우지 않아요.** 뒤에서 음악을 틀어 두면 계속 나오는
   것과 같은 이유입니다. 그래서 "소리는 나되 사람에게는 안 들리는"
   자리를 찾으면 됩니다.

   [왜 볼륨 0 이 아닌가 — 중요]
   완전한 무음(gain 0)은 소용이 없습니다. 크로미움은 실제 음량을 재서
   −72.2 dBFS 아래면 "소리 안 나는 탭"으로 치고 그냥 재워 버려요.
   (media/audio/audio_power_monitor.h 의 kSilenceThresholdDbfs)
   그래서 그 선보다 조금 위, 사람 귀에는 닿지 않는 값을 씁니다.

   [값을 어떻게 골랐나 — 2026-08-13, 소리시험.html 로 직접 재봄]
     · 30 Hz — 사람 귀는 낮은 소리에 무딥니다. 30Hz 의 가청 문턱은
       60 dB SPL 쯤인데, 아래 음량으로는 그 한참 아래에 머뭅니다.
       100Hz 로 올리면 같은 세기여도 들리기 시작해요.
     · gain 0.00061 — 사인파라 실효값은 gain/√2 = −67.4 dBFS.
       크로미움 판정선보다 약 4.9 dB 위입니다.
   크롬 1시간 3분 · 사파리 36분 연속으로 확인했습니다.

   [기기별로 기억합니다 — 닉네임별이 아니라]
   폰에서는 이 소리가 음악 앱을 끊거나 볼륨을 눌러 버립니다.
   그래서 "노트북에서 켠 것이 폰까지 따라가는" 일이 없어야 해요.
   localStorage 에 두면 기기마다 따로 놀고, 새 기기는 저절로 꺼진
   상태에서 시작합니다.

   [브라우저를 가리지 않습니다]
   바로 옆의 자동감지(IdleDetector)는 크롬·엣지 전용이지만, 이건
   사파리·파이어폭스에서도 똑같이 동작합니다. 다만 사파리·파이어폭스가
   쓰는 판정선은 공개돼 있지 않아, 위 여유가 충분한지는 확실하지
   않습니다. 안 되는 멤버가 나오면 GAIN 을 0.0012 로 올리세요 —
   그래도 여전히 안 들립니다.

   [첫 클릭이 필요한 이유]
   브라우저는 사용자가 한 번 클릭하기 전에는 소리를 못 내게 막습니다.
   다행히 작업방은 입장 버튼을 누르고 들어오니, 그 클릭에 얹으면 돼요.
   그래도 실패하면(창 복원 등) 다음 클릭 한 번을 기다렸다 다시 켭니다.
   ===================================================================== */
(function () {

  /* 소리시험.html 로 고른 값 — 바꾸려면 여기 두 줄만 고치면 됩니다 */
  const ALIVE_FREQ = 30;          // Hz — 낮을수록 안 들림
  const ALIVE_GAIN = 0.00061;     // 실효 −67.4 dBFS (판정선 −72.2 보다 위)

  /* 기기별 저장 (localStorage). 닉네임을 안 붙입니다 —
     이 기기를 쓰는 사람이 바뀌어도 "이 기기에서 소리를 내도 되는가"는
     그대로거든요. */
  const ALIVE_KEY = "keepAliveAudio";

  let _on      = false;   // 지금 소리가 흐르고 있나
  let _ctx     = null;
  let _osc     = null;
  let _gain    = null;
  let _armed   = false;   // "다음 클릭에 다시 시도" 보험이 걸려 있나

  function _supported() {
    return typeof (window.AudioContext || window.webkitAudioContext) === "function";
  }

  /* ---------------------------------------------------------------
     저장·로드 — 기기별
     --------------------------------------------------------------- */
  function _savePref(v) {
    try { AppStore.setItem(ALIVE_KEY, v ? "1" : "0"); } catch (e) {}
  }
  function _loadPref() {
    try { return AppStore.getItem(ALIVE_KEY) === "1"; } catch (e) { return false; }
  }
  window.aliveIsOn = function () { return _on; };

  /* ---------------------------------------------------------------
     소리 켜기·끄기
     --------------------------------------------------------------- */
  async function _startTone() {
    if (!_supported()) return false;
    if (_on) return true;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!_ctx) _ctx = new C();

      /* 클릭 없이 만들면 suspended 로 태어납니다. 깨워 봅니다. */
      if (_ctx.state === "suspended") {
        try { await _ctx.resume(); } catch (e) {}
      }
      if (_ctx.state !== "running") return false;   // 아직 클릭 전 — 보험이 받습니다

      _gain = _ctx.createGain();
      _gain.gain.value = ALIVE_GAIN;
      _osc = _ctx.createOscillator();
      _osc.type = "sine";
      _osc.frequency.value = ALIVE_FREQ;
      _osc.connect(_gain);
      _gain.connect(_ctx.destination);
      _osc.start();

      _on = true;
      _watchInterrupt();
      _renderAll();
      return true;
    } catch (e) {
      console.warn("[무음 접속유지 시작 실패]", e);
      return false;
    }
  }

  function _stopTone() {
    try { _osc?.stop(); } catch (e) {}
    try { _osc?.disconnect(); } catch (e) {}
    try { _gain?.disconnect(); } catch (e) {}
    _osc = null; _gain = null;
    _on = false;
    _renderAll();
  }

  /* ---------------------------------------------------------------
     끊김 대비

     폰에 전화가 오거나 다른 앱이 소리를 가져가면 AudioContext 가
     interrupted / suspended 로 넘어갑니다. 그대로 두면 소리가 끊긴 채
     "켜져 있다"고 표시만 남아요 — 그러면 접속유지도 같이 죽습니다.
     상태가 바뀌면 다시 깨우고, 그것도 막히면 다음 클릭을 기다립니다.
     --------------------------------------------------------------- */
  function _watchInterrupt() {
    if (!_ctx || _ctx.__aliveWatched) return;
    _ctx.__aliveWatched = true;
    _ctx.addEventListener("statechange", () => {
      if (!_on) return;
      if (_ctx.state === "running") return;
      _ctx.resume().catch(() => _armFirstClick());
    });
  }

  /* ---------------------------------------------------------------
     보험 — 다음 클릭 한 번에 다시 시도

     입장 버튼 클릭에 얹지 못한 경우(창 복원 등)를 위한 대비입니다.
     한 번만 걸고 스스로 풉니다. 실패하면 다시 겁니다.
     --------------------------------------------------------------- */
  function _armFirstClick() {
    if (_armed) return;
    _armed = true;
    const go = async () => {
      _armed = false;
      document.removeEventListener("pointerdown", go, true);
      document.removeEventListener("keydown", go, true);
      if (!_loadPref()) return;              // 그새 껐으면 그만
      const ok = await _startTone();
      if (!ok) _armFirstClick();             // 아직도 안 되면 다음 클릭에 또
    };
    document.addEventListener("pointerdown", go, true);
    document.addEventListener("keydown", go, true);
  }

  /* ---------------------------------------------------------------
     화면 그리기 — 머리말 버튼과 설정 스위치를 늘 같은 값으로
     --------------------------------------------------------------- */
  function _renderAll() {
    const btn = document.getElementById("alive-btn");
    if (btn) {
      const label = btn.querySelector(".icon-btn-label");
      /* [2026-08-13] "무음 ON" 이라고 적었더니 **음소거 버튼으로 읽혔습니다.**
         하는 일은 접속 유지이고 무음은 그 수단일 뿐이라, 이름을 결과로 바꿉니다. */
      if (label) label.textContent = _on ? "접속유지 ON" : "접속유지 OFF";
      btn.setAttribute("aria-pressed", _on ? "true" : "false");
      if (!_supported()) { btn.style.opacity = ".45"; }
    }
    const sw = document.getElementById("set-alive");
    if (sw) sw.checked = _on;
  }
  window.renderAliveButton = _renderAll;

  /* ---------------------------------------------------------------
     토글 — 머리말 버튼과 설정 스위치가 함께 부릅니다.
     반드시 클릭 안에서 불려야 소리가 납니다.
     --------------------------------------------------------------- */
  async function toggleKeepAlive() {
    if (!_supported()) {
      alert("이 브라우저에서는 무음 접속 유지를 쓸 수 없어요.");
      _renderAll();          // 설정 스위치가 켜진 채로 남지 않게 되돌립니다
      return;
    }

    if (_on) {
      _stopTone();
      _savePref(false);
      return;
    }

    /* 폰에서 켤 때만 한 번 묻습니다 — 여기서 부작용이 제일 큽니다.
       (기기별 저장이라 폰은 원래 꺼진 채로 시작합니다) */
    if (window.isMobile) {
      const go = confirm(
        "폰에서는 이 기능이 음악 앱을 끊거나 볼륨을 눌러 버릴 수 있어요.\n"
        + "그래도 켤까요?"
      );
      if (!go) { _renderAll(); return; }
    }

    const ok = await _startTone();
    if (!ok) {
      alert("소리를 시작하지 못했어요. 화면을 한 번 클릭한 뒤 다시 눌러 주세요.");
      _armFirstClick();
      _renderAll();
      return;
    }
    _savePref(true);
  }
  window.toggleKeepAlive = toggleKeepAlive;

  /* 설정 창 스위치 — 체크박스는 클릭 안에서 change 가 오므로 그대로 씁니다 */
  window.onAliveSwitch = function () {
    toggleKeepAlive();
  };

  /* ---------------------------------------------------------------
     입장 후 초기화 (core 가 부릅니다)

     입장 버튼을 막 누른 참이라 대개 여기서 바로 켜집니다.
     혹시 막히면 다음 클릭을 기다립니다.
     --------------------------------------------------------------- */
  window.afterJoinInitAlive = async function () {
    if (!_supported()) { _renderAll(); return; }
    if (!_loadPref()) { _renderAll(); return; }
    const ok = await _startTone();
    if (!ok) _armFirstClick();
    _renderAll();
  };
})();
