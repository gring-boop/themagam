/* TheMagam © 링가링 · 무단 복제·재배포 금지 */
/* =====================================================================
   TheMagam — ♪ BGM (script_music.js, 2026-08-13)

   [무엇인가]
   알약 줄의 [♪ BGM] 판. 위에는 작은 유튜브 플레이어, 아래에는
   추천 리스트. 누구나 유튜브 링크를 추천할 수 있고(music 노드),
   리스트에서 하나를 누르면 **내 화면에서만** 그 곡이 재생됩니다.
   출판사 품평의 음악판인 셈이에요.

   [같이 듣기가 아닙니다 — 일부러]
   재생·정지·볼륨 전부 각자 것입니다. 같은 지점을 같이 들으려면
   동기화가 크게 들어가는데, 작업 BGM 은 그럴 필요가 없어요.
   무음으로 작업하는 분에게 소리를 강제하지 않는 뜻도 있습니다.

   [접어도 계속 나옵니다 — 지킬 것 하나]
   판을 접으면 dock 이 hidden 으로 **가리기만** 합니다. iframe 은
   DOM 에 그대로 있어서 소리가 이어져요. 그래서 플레이어 iframe 은
   한 번 만들면 **절대 다시 만들거나 옮기지 않습니다** — innerHTML 로
   다시 그리거나 부모를 바꾸면 그 순간 음악이 끊깁니다. 리스트만
   따로 그리고(#music-list), 플레이어 칸(#music-player-slot)은
   손대지 않는 이유입니다.

   [저작권]
   유튜브 공식 embed 플레이어라 문제없습니다. 광고·집계 전부
   유튜브 몫이고, 우리는 링크만 놓아둡니다.

   [상한 35곡]
   넘치면 오래된 것부터 자동으로 지웁니다. 방 취향은 흐르니까,
   리스트도 흐르게 둡니다.

   [보안규칙 — 콘솔 적용 필요]
   music 노드 추가: 읽기 auth, 쓰기 auth (vid·title·nick·at 필수).
   삭제도 auth 전체에 열어 둡니다 — 상한 정리(남의 옛 곡 지우기)가
   되려면 어쩔 수 없어요. ✕ 단추는 내 것에만 보이게 해서 예의를
   지키고, 규칙은 문을 열어 두는 방식입니다(승인제 방이라 가능).
   ===================================================================== */
(function () {
  "use strict";

  const MUSIC_MAX = 35;      // 리스트 상한 — 넘치면 오래된 것부터
  let _cur = "";             // 지금 재생 중인 vid (이 기기에서만)
  let _list = {};            // 서버 리스트 스냅샷
  let _built = false;

  /* ---------------------------------------------------------------
     유튜브 주소 → 영상 id
     watch?v=x · youtu.be/x · shorts/x · live/x · embed/x 다 받습니다
     --------------------------------------------------------------- */
  function parseVid(url) {
    const s = String(url || "").trim();
    const m =
      s.match(/[?&]v=([A-Za-z0-9_-]{6,15})/) ||
      s.match(/youtu\.be\/([A-Za-z0-9_-]{6,15})/) ||
      s.match(/\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{6,15})/);
    return m ? m[1] : "";
  }
  function okVid(v) { return /^[A-Za-z0-9_-]{6,15}$/.test(String(v || "")); }

  /* 제목 받아오기 — noembed(CORS 허용)로. 실패하면 링크 그대로 씁니다 */
  async function fetchTitle(url) {
    try {
      const r = await fetch("https://noembed.com/embed?url=" + encodeURIComponent(url));
      const j = await r.json();
      return (j && j.title) ? String(j.title).slice(0, 120) : "";
    } catch (e) { return ""; }
  }

  /* ---------------------------------------------------------------
     판 짓기 — 한 번만. 플레이어 칸과 리스트 칸을 갈라 둡니다.
     --------------------------------------------------------------- */
  function buildOnce() {
    if (_built) return true;
    const body = document.getElementById("dock-body-music");
    if (!body) return false;
    body.innerHTML = `
      <div id="music-player-slot" class="music-player-slot">
        <div class="music-player-empty" id="music-player-empty">
          ♪<br>리스트에서 골라 주세요
        </div>
      </div>
      <div class="music-list-head">
        <span>🎵 추천 리스트</span><span class="music-list-hint">클릭하면 재생 · 나에게만 들려요</span>
      </div>
      <div id="music-list" class="music-list"></div>
      <div class="music-add">
        <input type="url" id="music-add-url" placeholder="유튜브 링크 붙여넣기"
               autocomplete="off" spellcheck="false">
        <button type="button" id="music-add-btn">추천</button>
      </div>`;
    document.getElementById("music-add-btn").addEventListener("click", addLink);
    document.getElementById("music-add-url").addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); addLink(); }
    });
    _built = true;
    return true;
  }

  /* ---------------------------------------------------------------
     재생 — iframe 은 여기서 처음 만들고, 다음부터는 src 만 바꿉니다
     --------------------------------------------------------------- */
  function play(vid, title) {
    if (!okVid(vid)) return;
    const slot = document.getElementById("music-player-slot");
    if (!slot) return;
    let f = document.getElementById("music-player-frame");
    if (!f) {
      document.getElementById("music-player-empty")?.remove();
      f = document.createElement("iframe");
      f.id = "music-player-frame";
      f.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
      f.setAttribute("allowfullscreen", "");
      f.setAttribute("title", "BGM 플레이어");
      slot.appendChild(f);
    }
    /* 방금 클릭했으므로(사용자 제스처) autoplay 가 허용됩니다.
       nocookie 도메인 — 방문 기록에 쿠키를 덜 남깁니다.
       enablejsapi=1 — 알약 더블클릭 일시정지가 postMessage 로 명령을
       보내려면 이 문이 열려 있어야 합니다. */
    f.src = "https://www.youtube-nocookie.com/embed/" + vid
          + "?autoplay=1&rel=0&enablejsapi=1";
    _cur = vid;
    _paused = false;
    void title;
    renderList();
  }

  /* ---------------------------------------------------------------
     알약 더블클릭 — 재생/일시정지 (script_dock.js 가 부릅니다)

     iframe 을 안 건드리고 유튜브에 쪽지(postMessage)만 보냅니다.
     끊길 염려가 없는 유일한 방법이에요.
     --------------------------------------------------------------- */
  let _paused = false;
  function musicHasPlayer() {
    return !!document.getElementById("music-player-frame");
  }
  function musicTogglePlay() {
    const f = document.getElementById("music-player-frame");
    if (!f || !f.contentWindow) return false;
    const cmd = _paused ? "playVideo" : "pauseVideo";
    try {
      f.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: cmd, args: [] }), "*");
      _paused = !_paused;
      renderList();
      return true;
    } catch (e) { return false; }
  }
  window.musicHasPlayer = musicHasPlayer;
  window.musicTogglePlay = musicTogglePlay;

  /* ---------------------------------------------------------------
     리스트 그리기 — 플레이어 칸은 절대 건드리지 않습니다
     --------------------------------------------------------------- */
  function renderList() {
    const box = document.getElementById("music-list");
    if (!box) return;
    const rows = Object.entries(_list)
      .map(([id, s]) => ({ id, ...s }))
      .filter(s => okVid(s.vid))
      .sort((a, b) => (a.at || 0) - (b.at || 0));   // 오래된 것 위

    if (!rows.length) {
      box.innerHTML = `<div class="music-empty">아직 추천이 없어요.
        아래에 유튜브 링크를 붙여넣어 첫 곡을 걸어 주세요!</div>`;
      return;
    }
    box.innerHTML = rows.map(s => `
      <div class="music-row${s.vid === _cur ? " is-playing" : ""}" data-vid="${s.vid}"
           data-title="${escapeHtml(s.title || "")}" role="button" tabindex="0">
        <span class="music-row-ico">${s.vid === _cur ? (_paused ? "⏸" : "🔊") : "♪"}</span>
        <span class="music-row-title">${escapeHtml(s.title || s.vid)}</span>
        <span class="music-row-nick">${escapeHtml(s.nick || "")}</span>
        ${s.nick === myNick
          ? `<button type="button" class="music-row-x" data-music-del="${s.id}"
                     aria-label="내 추천 지우기" title="내 추천 지우기">✕</button>`
          : ""}
      </div>`).join("");

    box.querySelectorAll(".music-row").forEach(r => {
      r.addEventListener("click", e => {
        if (e.target.closest("[data-music-del]")) return;
        play(r.dataset.vid, r.dataset.title);
      });
    });
    box.querySelectorAll("[data-music-del]").forEach(b => {
      b.addEventListener("click", () => {
        db.ref("music/" + b.dataset.musicDel).remove().catch(() => {});
      });
    });
  }

  /* ---------------------------------------------------------------
     추천 올리기 — 상한을 넘으면 오래된 것부터 지웁니다
     --------------------------------------------------------------- */
  async function addLink() {
    const inp = document.getElementById("music-add-url");
    const btn = document.getElementById("music-add-btn");
    if (!inp || !myNick) return;
    const url = inp.value.trim();
    const vid = parseVid(url);
    if (!vid) { alert("유튜브 링크가 아닌 것 같아요. 주소를 다시 봐 주세요."); return; }
    if (Object.values(_list).some(s => s.vid === vid)) {
      alert("이미 리스트에 있는 곡이에요!"); inp.value = ""; return;
    }

    /* ★ 글칸은 보내기 **전에** 비웁니다 — 품평에서 배운 것.
       listener 재렌더가 입력값을 "지키려다" 살려버리는 사고 방지 */
    inp.value = "";
    if (btn) btn.disabled = true;

    try {
      const title = (await fetchTitle(url)) || url;
      await db.ref("music").push({ vid, title, nick: myNick, at: Date.now() });

      /* 상한 정리 — 넘친 만큼 오래된 것부터 */
      const snap = await db.ref("music").once("value");
      const all = [];
      snap.forEach(c => { all.push({ id: c.key, at: (c.val() || {}).at || 0 }); });
      if (all.length > MUSIC_MAX) {
        all.sort((a, b) => a.at - b.at);
        const over = all.slice(0, all.length - MUSIC_MAX);
        for (const o of over) await db.ref("music/" + o.id).remove();
      }
    } catch (e) {
      console.warn("[music add failed]", e);
      alert("추천을 올리지 못했어요. 잠시 후 다시 해 주세요.");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* ---------------------------------------------------------------
     시동 — 입장 뒤 core 가 부릅니다 (리스너는 그때부터)
     --------------------------------------------------------------- */
  let _ref = null;
  function musicInit() {
    if (!buildOnce()) {           // dock 이 아직이면 잠깐 기다립니다
      setTimeout(musicInit, 300);
      return;
    }
    if (_ref) return;
    _ref = db.ref("music");
    _ref.on("value", snap => {
      _list = snap.val() || {};
      renderList();
    });
  }
  window.musicInit = musicInit;
})();
