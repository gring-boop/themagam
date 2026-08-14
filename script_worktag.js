/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_worktag.js — 오늘 무슨 작업을 하고 있는가 (카드 왼쪽 위 스티커)
   ---------------------------------------------------------------------
   [무엇인가]
   상태표(WORK · 휴식 · 초집중 · 자리비움)는 "지금 자리에 있는가" 를
   말합니다. 그런데 같은 WORK 라도 초고를 밀어붙이는 날과 교정지를
   들여다보는 날은 전혀 다른 일이죠. 그 결을 한 눈에 보여주는 스티커입니다.

     구상 · 원고 · 퇴고 · 교정 · 수정 · 개정 · 인풋 · 기타

   [자정에 떨어지지 않습니다 — 2026-08-09 에 뒤집었습니다]
   처음에는 '그날 업무' 라고 보고 자정마다 떼어 냈습니다. 어제 교정이
   오늘도 붙어 있으면 거짓이 된다고 봤거든요.

   그런데 작업은 하루로 끊기지 않습니다. 퇴고는 보름씩 이어지고, 인풋
   기간은 몇 주씩 갑니다. 그런 사람에게는 매일 아침 다시 붙이는 일이
   생기고, 깜빡하면 오히려 아무 표시도 없는 채로 하루가 지나갑니다.
   손이 더 가는 쪽이 정확하지도 않았어요.

   그래서 **바꿀 때까지 그대로 둡니다.** 떼고 싶으면 [✕ 떼기] 로.

   [어디에 저장하나]
   status/{닉} 의 tag 한 칸. users 아래가 아니라 status 인 이유는,
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
    { v: "polish", emoji: "📝", label: "퇴고" },
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
  const SAVE_KEY = "workTag";           // 내 기기에 남겨 두는 선택

  window.WORKTAGS = TAGS;

  /* [2026-08-09] 날짜 계산(todayKey)은 지웠습니다 —
     자정 초기화를 그만두면서 쓸 곳이 없어졌어요. */

  /* 모르는 값이 오면 "없음" 으로 읽습니다 (없는 걸 지어내지 않기) */
  function find(v) {
    return TAGS.find(t => t.v === v) || null;
  }

  /* ── 내 선택 ──────────────────────────────────────────────
     기기에 적어 두고, **바꿀 때까지** 그대로 씁니다.
     (예전에는 날짜가 다르면 버렸습니다 — 위 머리말 참고) */
  function myTag() {
    try {
      const raw = window.AppStore?.getItem(SAVE_KEY);
      if (!raw) return NONE;
      /* 옛 저장값은 {v, day} 였습니다. day 는 이제 안 봅니다.
         그냥 문자열로 적어 둔 것도 읽어 줍니다. */
      const o = raw.trim().startsWith("{") ? JSON.parse(raw) : { v: raw };
      return find(o && o.v)?.v || NONE;
    } catch (e) { return NONE; }
  }
  window.myWorkTag = myTag;

  function setMyTag(v) {
    const t = find(v);
    try {
      window.AppStore?.setItem(SAVE_KEY, JSON.stringify({ v: t ? t.v : NONE }));
    } catch (e) {}
    /* 남들 카드에도 곧바로 반영되도록 상태를 한 번 밀어 올립니다 */
    window.updateStatus?.(true);
    window.renderUserCards?.();

    /* 🏅 팔방미인 · 퇴고 장인 · 수정궁 여왕.

       ★ 세는 일은 script_achv.js 한 곳에 맡깁니다. 여기서 직접 세면
         "누른 순간" 만 세어지는데, 이 방의 작업 스티커는 자정에 안 풀려요.
         퇴고를 한 번 붙이고 그대로 둔 사람이 하루로만 세어지던 이유입니다.
         업적 쪽은 **들어올 때마다** 그날 붙여둔 것을 하루로 셉니다. */
    try { window.achvNoteTagDay?.(); } catch (e) {}
  }

  /* ── 카드에 그릴 조각 ────────────────────────────────────
     row 는 status/{닉} 에 실려 온 값입니다. status 는 나가면 통째로
     지워지므로, 여기 값이 있다는 건 지금 접속 중이라는 뜻입니다. */
  window.workTagOf = function (row) {
    return row ? find(row.tag) : null;
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
    if (!isMine) return `<span class="card-tag-slot" title="${esc(t.label)} 중">${inner}</span>`;
    return `<span class="card-tag-slot is-mine${t ? "" : " is-empty"}"
                  data-pick-worktag="1" role="button" tabindex="0"
                  title="더블클릭 — 무슨 작업인지 붙이기">${inner}</span>`;
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
    /* 🧘 혼자 방의 확대·축소 — 재는 자를 하나로 맞춥니다 (진짜 방은 늘 1) */
    const _z = (window.uiZoom?.() || 1);
    const VW = innerWidth / _z, VH = innerHeight / _z;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = r.left / _z;
    let top  = r.bottom / _z + 6;
    if (left + w > VW - 8) left = VW - w - 8;
    if (top  + h > VH - 8) top  = r.top / _z - h - 6;
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
