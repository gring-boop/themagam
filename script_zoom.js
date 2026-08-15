/* TheMagam © 링가링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — 🔍 화면 확대·축소 (script_zoom.js, 2026-08-15)

   [무엇인가]
   머리말의 [− 100% +]. 방 전체를 5% 씩 키우거나 줄입니다.
   가운데 숫자를 누르면 100% 로 돌아와요. 이 기기에만 기억합니다.

   [글자 크기 조절과 무엇이 다른가]
   옆의 [− 18px +] 는 **채팅 글자만** 굵어집니다. 카드도 알약도 그대로예요.
   사람이 늘어 카드가 화면에 안 들어올 때는 도움이 안 됩니다.
   확대·축소는 카드·채팅·알약이 통째로 커지고 작아집니다.
   둘은 하는 일이 달라서 나란히 둡니다 — 글자만 크게 하고 싶은 분도 있어요.

   [왜 CSS zoom 인가]
   transform: scale 은 그림만 늘리고 자리는 그대로라, 스크롤 끝과 클릭
   좌표가 어긋납니다. zoom 은 배치를 다시 계산해서 그런 일이 없어요.
   크롬·사파리·파이어폭스 모두 씁니다.

   [피 흘리고 배운 것 둘 — 지울 때 조심]
   ① zoom 은 **뿌리(html)** 에 겁니다. body 에 걸면 화면에 고정된 것들
      (바텀 알약 줄)이 배율만큼 위로 떠오릅니다. 고정 좌표는 화면을
      기준으로 재는데, 그 화면이 이미 줄어든 몸통 안이라 어긋나요.
   ② 그러고도 몸통 높이가 100dvh 라 짧아집니다 — 화면 단위(dvh)는
      확대를 모르거든요. 95% 면 몸통이 화면보다 5% 짧아져서, 역시
      바텀 줄이 바닥에서 뜹니다. 확대한 만큼 높이를 미리 키워 둡니다.

   [좌표를 재는 다른 파일들에게]
   마우스 좌표·getBoundingClientRect 는 **확대된 뒤**의 화면 값이고,
   style.left·offsetWidth 는 **확대 전**의 요소 값입니다. 섞어 쓰면
   판이 커서를 못 따라가고 오른쪽 끝에서 먼저 막혀요(실제로 그랬습니다).
   `window.uiZoom()` 으로 자를 맞추세요 — 100% 면 1 입니다.
   ===================================================================== */
(function () {
  "use strict";

  const MIN = 70, MAX = 130, STEP = 5;

  /* 🧘 혼자 방과 진짜 방은 값을 따로 기억합니다 — 같은 브라우저에서
     둘을 오갈 때 한쪽에서 줄인 게 다른 쪽까지 따라가면 당황스러워요 */
  const KEY = () => (window.SOLO ? "soloZoom" : "uiZoom");
  const 곳간 = () => window.AppStore;

  function 배율() {
    const v = Number(곳간()?.getItem(KEY()));
    return (v >= MIN && v <= MAX) ? v : 100;
  }

  function 배율적용(v) {
    const z = Math.max(MIN, Math.min(MAX, Math.round(v / STEP) * STEP));
    try { 곳간()?.setItem(KEY(), String(z)); } catch (e) {}

    /* 100% 일 때는 아예 손대지 않습니다 — zoom:1 만 걸려 있어도
       어떤 브라우저는 글꼴을 다시 그려서 미세하게 흐려 보여요 */
    document.documentElement.style.zoom = (z === 100) ? "" : (z / 100);
    document.body.style.zoom = "";
    const f = z / 100;
    document.body.style.height = (z === 100) ? "" : (window.innerHeight / f) + "px";

    const pill = document.getElementById("zoom-pill");
    if (pill) pill.textContent = z + "%";
    return z;
  }

  /** 좌표를 재는 파일들이 부르는 자 — 100% 면 1 */
  window.uiZoom = () => 배율() / 100;
  window.setUiZoom = 배율적용;
  window.getUiZoom = 배율;

  /* 창 크기가 바뀌면 몸통 높이를 다시 잽니다 (위 계산이 화면 높이를 씁니다) */
  let _t = null;
  window.addEventListener("resize", () => {
    clearTimeout(_t);
    _t = setTimeout(() => { try { 배율적용(배율()); } catch (e) {} }, 120);
  });

  /* ---------------------------------------------------------------
     머리말에 단추 달기
       "beside"  — 글자 크기 조절 **오른쪽에** 나란히 (진짜 더마감)
       "replace" — 글자 크기 조절 자리를 **물려받음** (🧘 혼자 방)
     --------------------------------------------------------------- */
  function 단추HTML() {
    return `
      <button class="font-btn" type="button" id="zoom-out"
              aria-label="화면 축소" title="화면을 5% 줄여요">−</button>
      <span id="zoom-pill" class="font-pill" role="button" tabindex="0"
            aria-live="polite" aria-label="현재 화면 배율"
            title="눌러서 100% 로">100%</span>
      <button class="font-btn" type="button" id="zoom-in"
              aria-label="화면 확대" title="화면을 5% 키워요">+</button>`;
  }

  function 손가락() {
    const out = document.getElementById("zoom-out");
    const inn = document.getElementById("zoom-in");
    const pill = document.getElementById("zoom-pill");
    if (!out || !inn || !pill) return false;
    out.onclick = () => 배율적용(배율() - STEP);
    inn.onclick = () => 배율적용(배율() + STEP);
    /* 눌러서 제자리로 — 한참 만졌다가 되돌리기가 은근히 번거로워요 */
    pill.onclick = () => 배율적용(100);
    pill.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); 배율적용(100); }
    };
    배율적용(배율());
    return true;
  }

  function 달기(mode) {
    const ctl = document.querySelector(".font-ctl");
    if (!ctl) return false;
    if (document.getElementById("zoom-pill")) return true;   // 이미 달렸어요

    if (mode === "replace") {
      ctl.innerHTML = 단추HTML();
    } else {
      const box = document.createElement("div");
      box.className = "font-ctl zoom-ctl";
      box.innerHTML = 단추HTML();
      ctl.insertAdjacentElement("afterend", box);
    }
    return 손가락();
  }
  window.mountZoomCtl = 달기;

  /* 진짜 방에서는 알아서 나란히 답니다.
     🧘 혼자 방은 script_solo.js 가 걷어내기 때에 "replace" 로 부릅니다 —
     거기서는 글자 크기 조절을 아예 걷어내니까요. */
  window.addEventListener("load", () => {
    setTimeout(() => { if (!window.SOLO) 달기("beside"); }, 300);
  });
})();
