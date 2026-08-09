/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_worktag.js — 오늘 무슨 작업을 하고 있는가 (카드 왼쪽 위 스티커)
   ---------------------------------------------------------------------
   [무엇인가]
   상태표(WORK · 휴식 · 초집중 · 자리비움)는 "지금 자리에 있는가" 를
   말합니다. 그런데 같은 WORK 라도 초고를 밀어붙이는 날과 교정지를
   들여다보는 날은 전혀 다른 일이죠. 그 결을 한 눈에 보여주는 스티커입니다.

     구상 · 원고 · 교정 · 수정 · 개정 · 인풋 · 기타

   [왜 자정에 되돌리는가]
   '그날 업무' 라서요. 어제 교정이었다고 오늘 아침에도 교정이라고 붙어
   있으면, 보는 사람은 사실이라고 믿습니다. 잘못된 정보가 남아 있는 것보다
   기본값(원고)으로 돌아가 있는 편이 정직합니다. 그래서 날짜를 함께 실어
   보내고, 날이 바뀌면 그냥 기본값으로 읽습니다 — 지우는 처리가 따로
   필요 없고, 자정에 접속해 있지 않아도 저절로 맞습니다.

   [어디에 저장하나]
   status/{닉} 에 tag 와 tagDay 두 칸. users 아래가 아니라 status 인 이유는,
   남의 카드에도 보여야 하는데 users 는 본인만 읽도록 잠가 두었기 때문입니다.
   status 는 원래 모두가 구독 중이라 통신이 늘지도 않습니다.
   ===================================================================== */
(function () {
  "use strict";

  /* 이모지를 앞에 두는 건 멀리서도 색으로 구분되라고요.
     v 는 저장되는 값 — 나중에 이름을 바꿔도 옛 기록이 깨지지 않게
     짧은 영문으로 둡니다. */
  const TAGS = [
    { v: "idea",   emoji: "💭", label: "구상" },
    { v: "draft",  emoji: "✍️", label: "원고" },
    { v: "proof",  emoji: "🔍", label: "교정" },
    { v: "revise", emoji: "✂️", label: "수정" },
    { v: "rework", emoji: "🔧", label: "개정" },
    { v: "input",  emoji: "📚", label: "인풋" },
    { v: "etc",    emoji: "✨", label: "기타" }
  ];
  /* [고침 2026-08-09] 기본은 **아무것도 없음** 입니다.
     처음엔 '원고'를 기본으로 두었는데, 그러면 아무도 손대지 않은 카드에도
     ✍️ 원고가 붙습니다. 본인이 그렇게 말한 적이 없는데 방 전체가 사실로
     읽게 되죠. 붙인 사람의 카드에만 붙어 있는 편이 정직합니다. */
  const NONE = "";                      // 아무것도 안 붙인 상태
  const SAVE_KEY = "workTag";           // 내 기기에 남겨 두는 오늘의 선택

  window.WORKTAGS = TAGS;

  /* ★ 반드시 **내 시계 기준** 날짜여야 합니다.
     toISOString() 은 UTC 라, 한국에서 쓰면 자정이 아니라 **오전 9시**에
     날짜가 바뀝니다 — 아침에 멀쩡히 붙여 둔 스티커가 9시에 원고로
     돌아가 버려요. 방 전체가 이미 쓰고 있는 Wordcount.dayKey 를 그대로
     빌려 씁니다(같은 날짜 계산을 두 벌 두지 않으려고요). */
  function todayKey() {
    if (typeof window.Wordcount?.dayKey === "function") return window.Wordcount.dayKey();
    const d = new Date();
    return d.getFullYear() + "-"
      + String(d.getMonth() + 1).padStart(2, "0") + "-"
      + String(d.getDate()).padStart(2, "0");
  }

  /* 모르는 값이 오면 "없음" 으로 읽습니다 (없는 걸 지어내지 않기) */
  function find(v) {
    return TAGS.find(t => t.v === v) || null;
  }

  /* ── 내 선택 ──────────────────────────────────────────────
     새로고침해도 남아 있게 기기에도 적어 둡니다. 날짜가 다르면
     읽는 순간 "없음" 으로 돌아갑니다(자정 초기화). */
  function myTag() {
    try {
      const raw = window.AppStore?.getItem(SAVE_KEY);
      if (!raw) return NONE;
      const o = JSON.parse(raw);
      if (!o || o.day !== todayKey()) return NONE;
      return find(o.v)?.v || NONE;
    } catch (e) { return NONE; }
  }
  window.myWorkTag = myTag;

  function setMyTag(v) {
    const t = find(v);
    try {
      window.AppStore?.setItem(SAVE_KEY,
        JSON.stringify({ v: t ? t.v : NONE, day: todayKey() }));
    } catch (e) {}
    /* 남들 카드에도 곧바로 반영되도록 상태를 한 번 밀어 올립니다 */
    window.updateStatus?.(true);
    window.renderUserCards?.();
  }

  /* ── 카드에 그릴 조각 ────────────────────────────────────
     row 는 status/{닉} 에 실려 온 값입니다. 날짜가 오늘이 아니면
     무엇이 적혀 있든 "없음" 으로 읽습니다. */
  window.workTagOf = function (row) {
    const same = row && row.tagDay === todayKey();
    return same ? find(row.tag) : null;
  };

  /* 카드 왼쪽 위 구석 자리.

     [왜 자리를 늘 만들어 두는가]
     내 카드에서는 아무것도 안 붙어 있어도 **더블클릭할 자리**가 있어야
     합니다. 그래서 비어 있어도 빈 칸을 둡니다(눈에는 안 보여요).
     남의 카드는 붙어 있을 때만 만듭니다 — 누를 일이 없으니까요. */
  window.workTagChipHtml = function (row, isMine) {
    const t = window.workTagOf(row);
    if (!t && !isMine) return "";
    const esc = window.escapeHtml || (s => s);
    const inner = t
      ? `<span class="card-tag" data-tag-val="${t.v}"
         ><span class="card-tag-emoji" aria-hidden="true">${t.emoji}</span>${esc(t.label)}</span>`
      : "";
    if (!isMine) return `<span class="card-tag-slot" title="오늘 ${esc(t.label)}">${inner}</span>`;
    return `<span class="card-tag-slot is-mine${t ? "" : " is-empty"}"
                  data-pick-worktag="1" role="button" tabindex="0"
                  title="더블클릭 — 오늘 무슨 작업인지 붙이기">${inner}</span>`;
  };

  /* ── 고르기 판 ───────────────────────────────────────────
     상태 고르기(openStatusPicker)와 같은 생김새·같은 조작감으로
     맞췄습니다. 카드 위의 작은 것을 눌렀을 때 판이 어디에 뜨는지
     사람이 매번 새로 배우지 않도록요. */
  let _pop = null;

  function close() {
    if (!_pop) return;
    _pop.remove();
    _pop = null;
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", close);
    window.removeEventListener("scroll", close, true);
  }
  function onDocClick(e) { if (_pop && !_pop.contains(e.target)) close(); }
  function onKey(e) { if (e.key === "Escape") close(); }

  window.openWorkTagPicker = function (anchor) {
    close();
    if (!anchor) return;

    const cur = myTag();
    const pop = document.createElement("div");
    pop.className = "status-pop worktag-pop";
    pop.setAttribute("role", "menu");
    /* 맨 위의 [떼기] — 붙인 걸 다시 없앨 길이 있어야 합니다.
       기본이 "없음" 이니, 돌아갈 자리도 있어야 짝이 맞아요. */
    pop.innerHTML =
      `<button type="button" class="status-pop-item worktag-item worktag-none${cur ? "" : " on"}"
               role="menuitem" data-worktag-val=""
       ><span aria-hidden="true">✕</span> 떼기</button>`
      + TAGS.map(t => `
      <button type="button" class="status-pop-item worktag-item tag-${t.v}${t.v === cur ? " on" : ""}"
              role="menuitem" data-worktag-val="${t.v}"
      ><span aria-hidden="true">${t.emoji}</span> ${t.label}</button>`).join("");

    document.body.appendChild(pop);

    /* 스티커 바로 아래. 화면 밖으로 나가면 안쪽으로 밀어 넣습니다. */
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = r.left;
    let top  = r.bottom + 6;
    if (left + w > innerWidth - 8)  left = innerWidth - w - 8;
    if (top  + h > innerHeight - 8) top  = r.top - h - 6;
    pop.style.left = Math.max(8, left) + "px";
    pop.style.top  = Math.max(8, top)  + "px";

    pop.addEventListener("click", (e) => {
      const b = e.target.closest("[data-worktag-val]");
      if (!b) return;
      setMyTag(b.dataset.worktagVal);
      close();
    });

    _pop = pop;
    setTimeout(() => {
      document.addEventListener("click", onDocClick, true);
      document.addEventListener("keydown", onKey, true);
      window.addEventListener("resize", close);
      window.addEventListener("scroll", close, true);
    }, 0);
  };
})();
