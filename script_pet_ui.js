/* =====================================================================
   script_pet_ui.js — 펫 관리 창 (설정 → 🐾 펫)

   보여주는 것
     · 지금 키우는 펫 · 레벨 · 다음 레벨까지 남은 시간
     · Lv.1 이면 껍데기 고르기 (안에 든 것은 비밀)
     · 만렙 도감 (20칸)

   색은 종류마다 고정이라 고르는 칸이 없습니다.

   그림은 script_pet.js 가, 값 읽기·쓰기는 script_timelog.js 가 합니다.
   이 파일은 화면만 만듭니다.
   ===================================================================== */
(function () {
  "use strict";

  function P() { return window.Pet; }

  /* ---------------------------------------------------------------
     만렙 알림 — 도감에 들어갔고 다음 펫이 시작됐다는 것만 알립니다
     --------------------------------------------------------------- */
  let _toastTimer = null;
  window.showPetLevelUp = function (doneKey, next) {
    if (!P()) return;
    document.getElementById("pet-toast")?.remove();

    const sp = String(doneKey);
    const el = document.createElement("div");
    el.id = "pet-toast";
    el.className = "pet-toast";
    el.setAttribute("role", "status");
    el.innerHTML = `
      ${P().petSvg(sp, P().MAX_LEVEL, 34, true)}
      <span><b>${P().speciesLabel(sp)}</b> 만렙! 도감에 들어갔어요.
      다음은 <b>${P().speciesLabel(next.species)}</b> 예요 🥚</span>`;
    document.body.appendChild(el);

    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.remove(), 6000);
  };

  /* ---------------------------------------------------------------
     관리 창
     --------------------------------------------------------------- */
  function renderPetPanel() {
    const host = document.getElementById("panel-pet");
    if (!host || !P()) return;

    const st = window.petState?.();
    if (!st) {
      host.innerHTML = `<div class="set-block"><p class="hint">입장 후에 볼 수 있어요.</p></div>`;
      return;
    }

    const dex = window.petDex?.() || {};
    const doneCount = Object.keys(dex).length;
    const total = P().SPECIES_IDS.length;

    /* 지금 펫 */
    const cur = `
      <div class="set-block">
        <div class="set-title">지금 키우는 펫</div>
        <div class="pet-cur">
          ${P().petSvg(st.species, st.level, 68, st.isMax)}
          <div class="pet-cur-info">
            <div class="pet-cur-name">
              ${st.level === 1
                ? `${P().shellLabel(st.species)} · 아직 안 깨어났어요`
                : `${P().speciesLabel(st.species)} · Lv.${st.level}${st.isMax ? " 만렙" : ""}`}
            </div>
            <div class="pet-cur-sub">
              ${P().fmtHM(st.curMs)} / ${P().fmtHM(st.totalNeed)}
            </div>
            <div class="pet-bar"><i style="width:${Math.round(st.ratio * 100)}%"></i></div>
            <div class="pet-cur-sub">
              ${st.isMax
                ? "다 자랐어요! 잠시 뒤 도감에 들어가고 새 펫이 시작돼요."
                : st.level === 1
                  ? `${P().fmtHM(st.toNextMs)} 뒤에 깨어나요`
                  : `다음 레벨까지 ${P().fmtHM(st.toNextMs)}`}
            </div>
          </div>
        </div>
        <p class="hint">
          <b>WORK</b> 와 <b>🔥초집중</b> 시간만 쌓여요. 휴식과 자리비움은 세지 않습니다.<br>
          ${P().HOURS_PER_LEVEL}시간에 1레벨, ${P().HOURS_PER_LEVEL * P().MAX_LEVEL}시간에 만렙이에요.
        </p>
      </div>`;

    /* 껍데기 고르기 — 아직 안 태어난 Lv.1 에서만 나옵니다.

       그룹을 대표하는 종류 하나로 그림을 그립니다. Lv.1 껍데기는
       그룹만 보고 그리므로 어느 종류를 넘겨도 같은 그림이 나옵니다. */
    const shellPick = st.level === 1 ? `
      <div class="set-block">
        <div class="set-title">껍데기 고르기</div>
        <div class="pet-pick">
          ${Object.keys(P().SHELLS).map(gp => {
            const rep = P().SPECIES.find(x => x.group === gp);
            const on = P().speciesGroup(st.species) === gp;
            return `
              <button type="button" class="pet-sp wide${on ? " on" : ""}"
                      data-pet-shell="${gp}" title="${P().SHELLS[gp]}">
                ${P().petSvg(rep.id, 1, 40, false)}
                <span>${P().SHELLS[gp]}</span>
              </button>`;
          }).join("")}
        </div>
        <p class="hint">
          <b>안에 무엇이 들었는지는 비밀이에요.</b> 껍데기만 고를 수 있고,
          담긴 것은 태어날 때 정해집니다. 바꿔도 <b>쌓인 시간은 그대로</b>예요.<br>
          <b>깨어난 뒤에는 바꿀 수 없어요.</b> 색은 종류마다 정해져 있습니다.
        </p>
      </div>` : "";

    /* 도감 — 모은 것만 앞에, 남은 칸은 물음표로 */
    const keys = Object.keys(dex).sort((a, b) => Number(dex[b]) - Number(dex[a]));
    const cells = keys.map(k => {
      const s2 = k;
      return `<div class="pet-cell" title="${P().speciesLabel(s2)}">
                ${P().petSvg(s2, P().MAX_LEVEL, 40, true)}
              </div>`;
    });
    /* 빈 칸을 96개까지 다 그리면 화면이 너무 길어집니다.
       앞으로 채울 칸이 있다는 것만 보이면 충분해서 5칸만 둡니다. */
    const blanks = Math.max(0, Math.min(5, total - doneCount));
    for (let i = 0; i < blanks; i++) cells.push(`<div class="pet-cell empty">?</div>`);

    const dexHtml = `
      <div class="set-block">
        <div class="set-title">만렙 도감 · ${doneCount} / ${total}</div>
        ${doneCount === 0
          ? `<p class="hint">아직 만렙 펫이 없어요. 첫 만렙은 ${P().HOURS_PER_LEVEL * P().MAX_LEVEL}시간이에요.</p>`
          : ""}
        <div class="pet-dex">${cells.join("")}</div>
        <p class="hint">
          만렙을 찍으면 도감에 들어가고 <b>다음 펫이 저절로 시작</b>돼요.
          그때도 <b>Lv.1 동안은 껍데기를 골라 바꿀 수 있어요.</b><br>
          아직 못 모은 종류 중에서 뽑으니, <b>${P().SPECIES_IDS.length}마리가 전부 다른 종류</b>예요.<br>
          Lv.1 에는 <b>${Object.values(P().SHELLS).join(" · ")}</b> 중 하나로 시작해요.
          담긴 것에 따라 껍데기가 다릅니다.
        </p>
      </div>`;

    host.innerHTML = cur + shellPick + dexHtml;

    /* 한 번만 걸어둡니다 (host 는 다시 그려도 그대로 남습니다) */
    if (!host._petBound) {
      host._petBound = true;
      host.addEventListener("click", (e) => {
        const sh = e.target.closest("[data-pet-shell]");
        if (sh) { window.setPetShell?.(sh.dataset.petShell); return; }

        /* 색은 종류마다 고정입니다 — 고르는 칸이 없습니다. */
      });
    }
  }
  window.renderPetPanel = renderPetPanel;
})();
