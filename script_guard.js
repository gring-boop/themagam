/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_guard.js — 우클릭 메뉴 막기 (입력칸은 열어 둡니다)
   ---------------------------------------------------------------------
   ★ 먼저 솔직하게: 이건 복제를 막지 못합니다.

   페이지의 글과 코드는 이미 각자 브라우저에 통째로 내려간 뒤입니다.
   F12, Ctrl+U, 주소창의 view-source: — 어느 쪽으로도 그대로 열려요.
   우클릭 막기는 그중 가장 손쉬운 문 하나를 잠그는 것뿐이고, 마음먹은
   사람에게는 몇 초짜리 장애물입니다. "지켜진다"고 믿으면 안 됩니다.

   그래서 목적을 좁혔습니다 — **무심코 [이미지 저장]·[복사]를 누르는
   일을 줄이는 것.** 딱 그만큼만 합니다.

   [무엇을 열어 두는가]
   작가들이 실제로 우클릭을 쓰는 자리는 그대로 둡니다. 여기까지 막으면
   붙여넣기·맞춤법 검사가 안 돼서, 지키는 것보다 잃는 게 훨씬 큽니다.
     · 글을 치는 칸 — input · textarea · contenteditable
     · 남의 말을 인용하려고 고른 글자 (선택 영역 안에서 누른 경우)
     · 링크 — 새 탭으로 열기를 막을 이유가 없습니다

   [안내 문구]
   띄우지 않습니다. 조용히 아무 일도 일어나지 않아요. 문구를 띄우면
   "막았다"고 광고하는 셈이라, 오히려 F12 를 눌러 보게 만듭니다.
   ===================================================================== */
(function () {
  /* 우클릭을 그대로 열어 둘 자리 */
  const ALLOW_SELECTOR = [
    "input",
    "textarea",
    "select",
    "[contenteditable]",
    "[contenteditable='true']",
    "a[href]"
  ].join(",");

  function isTypingSpot(el) {
    return !!(el && el.closest && el.closest(ALLOW_SELECTOR));
  }

  /* 글자를 끌어서 고른 뒤 그 위에서 우클릭한 경우 —
     인용하려고 복사하는 흐름이라 막지 않습니다. */
  function hasSelectionAt(el) {
    const sel = window.getSelection && window.getSelection();
    if (!sel || sel.isCollapsed || !String(sel).trim()) return false;
    try {
      return sel.containsNode(el, true) || (sel.anchorNode && el.contains(sel.anchorNode));
    } catch (e) {
      return true;   // 판단이 안 되면 열어 둡니다 (막는 쪽이 손해라서요)
    }
  }

  document.addEventListener("contextmenu", (e) => {
    const t = e.target;
    if (isTypingSpot(t)) return;      // 입력칸 — 붙여넣기·맞춤법 그대로
    if (hasSelectionAt(t)) return;    // 고른 글자 위 — 인용 복사 그대로
    e.preventDefault();               // 그 밖에는 조용히 아무 일 없음
  });
})();
