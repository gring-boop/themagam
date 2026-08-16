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

  /* =====================================================================
     🧭 머리말과 알약 줄은 줄이지 않습니다 (2026-08-15)
     ---------------------------------------------------------------------
     [무엇이 불편했나] 확대·축소는 화면을 통째로 바꿉니다. 카드를 더 많이
     보려고 줄였더니 **시계와 알약 글씨까지 작아져서** 안 보였어요.
     정작 줄이고 싶었던 건 카드와 판이고, 손잡이는 그대로여야 합니다.

     [어떻게] zoom 은 겹치면 곱해집니다. 뿌리에 0.95 를 걸고 머리말에
     1/0.95 를 걸면 그 안쪽만 정확히 제 크기로 돌아와요. 좌표 계산은
     전부 그대로 둡니다 — uiZoom() 이 여전히 화면 전체의 배율이고,
     카드·판·팝업이 다 그 안에 있으니까요.
     ★ 되돌릴 곳은 **머리말(.app-head)과 알약 줄(.dock-bar)** 둘뿐입니다.
       떠오르는 판(#dock-panels)은 줄어드는 쪽이 맞아요 — 화면을 넓게
       쓰려고 줄이는 건데 판이 그대로면 뜻이 없습니다.
     ===================================================================== */
  /* [2026-08-15] 🧘 혼자 방에서 며칠 써 보고 진짜 더마감에도 켰습니다.
     이제 두 방 모두 머리말·알약 줄은 제 크기를 지킵니다.
     ★ 되돌려야 할 일이 생기면 이 함수만 false 로 바꾸면 돼요 —
       그러면 예전처럼 화면이 통째로 줄었다 커집니다. */
  const 손잡이는그대로 = () => true;

  function 배율적용(v) {
    const z = Math.max(MIN, Math.min(MAX, Math.round(v / STEP) * STEP));
    try { 곳간()?.setItem(KEY(), String(z)); } catch (e) {}

    /* 100% 일 때는 아예 손대지 않습니다 — zoom:1 만 걸려 있어도
       어떤 브라우저는 글꼴을 다시 그려서 미세하게 흐려 보여요 */
    document.documentElement.style.zoom = (z === 100) ? "" : (z / 100);
    document.body.style.zoom = "";
    const f = z / 100;
    document.body.style.height = (z === 100) ? "" : (window.innerHeight / f) + "px";

    /* 되돌려 키울 값 — CSS 가 이 값을 읽어 머리말·알약 줄에만 겁니다 */
    const 되돌림 = (z === 100 || !손잡이는그대로()) ? "" : String(1 / f);
    document.documentElement.style.setProperty("--unzoom", 되돌림);
    document.documentElement.toggleAttribute("data-unzoom", !!되돌림);

    격자맞춤(f);

    const pill = document.getElementById("zoom-pill");
    if (pill) pill.textContent = z + "%";
    return z;
  }

  /* =====================================================================
     📐 원고지 격자를 화면 점에 딱 맞춥니다 (2026-08-15)
     ---------------------------------------------------------------------
     [무엇이 이상했나] 격자는 24px 마다 1px 선을 긋습니다. 그런데 화면
     한 점(device pixel)과 CSS 1px 이 늘 같지는 않아요 —
       · 맥의 "조정된 해상도" 는 배율이 1.6·1.8 처럼 어중간하고
       · 확대·축소를 하면 거기에 또 곱해집니다
     그러면 24px 이 화면 점으로는 43.2 점 같은 소수가 됩니다. 브라우저는
     점 단위로만 그릴 수 있으니 43·43·44·43·44… 로 반올림하며 그리고,
     그 오차가 쌓여 **일정한 간격으로 넓은 칸**이 생깁니다
     ("일정하게 간격이 넓어지는 칸이 있길래" — 콩). 물결무늬(모아레)와
     같은 원리라, 눈에 아주 잘 띕니다.

     [고침] 24 에 가장 가까우면서 **화면 점 개수가 정수**가 되는 칸 너비를
     골라 씁니다. 배율 1.8 이면 24 → 43.2 대신 43/1.8 = 23.889px.
     화면에서는 43 점이 정확히 반복되니 모든 칸이 똑같아집니다.
     선 굵기도 같은 방식으로 정수 점에 맞춥니다.
     ★ 눈에 보이는 차이는 없습니다 — 한 칸이 최대 반 점 달라질 뿐이에요.
       달라지는 건 "고르다" 하나입니다.
     ===================================================================== */
  function 격자맞춤(f) {
    const 화면배 = (window.devicePixelRatio || 1) * (f || 1);
    const r = document.documentElement.style;
    if (!isFinite(화면배) || 화면배 <= 0) {
      r.removeProperty("--grid-p"); r.removeProperty("--grid-gap");
      return;
    }
    /* 칸 24px · 선 1px 에 가장 가까우면서 화면 점 개수가 정수인 값 */
    const 칸점 = Math.max(1, Math.round(24 * 화면배));
    const 선점 = Math.max(1, Math.round(1 * 화면배));
    const 칸 = 칸점 / 화면배;
    const 선 = 선점 / 화면배;
    r.setProperty("--grid-p", 칸.toFixed(4) + "px");
    r.setProperty("--grid-gap", (칸 - 선).toFixed(4) + "px");
  }

  /* 창을 다른 화면(외장 모니터)으로 옮기면 화면 배율이 달라집니다 —
     그때도 다시 맞춰야 해요. resize 는 그 순간에도 옵니다. */
  window.addEventListener("load", () => { try { 격자맞춤(배율() / 100); } catch (e) {} });

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
     머리말 제 자리(#zoom-ctl)에 단추 달기
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

  /* ★★ [고침 2026-08-16] 예전에는 머리말의 글자 크기 조절(.font-ctl)을
     찾아 그 **옆에** 끼워 넣었습니다. 그런데 글자 크기 조절이 설정 창
     안으로 옮겨 가면서, 그걸 따라가면 확대·축소도 설정 창에 들어가
     버립니다. 이제 머리말에 제 자리(#zoom-ctl)를 두고 거기만 채웁니다.
     ★ 자리를 못 찾으면 아무것도 하지 않습니다 — 엉뚱한 데 붙는 것보다
       안 보이는 편이 낫고, 그러면 index.html 을 보러 가게 되니까요. */
  function 달기() {
    const ctl = document.getElementById("zoom-ctl");
    if (!ctl) return false;
    if (document.getElementById("zoom-pill")) return true;   // 이미 달렸어요
    ctl.innerHTML = 단추HTML();
    return 손가락();
  }
  window.mountZoomCtl = 달기;

  /* 두 방 모두 머리말 제 자리에 답니다 */
  window.addEventListener("load", () => { setTimeout(달기, 300); });
})();
