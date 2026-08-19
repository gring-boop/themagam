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

  /* [나눔 2026-08-13 밤] 리스트가 둘이 됐습니다.
       ♪ 나의 리스트 — 10곡, 나만 봅니다 (users/{닉}/musicMine — 닉 기준이라
                        크롬·사파리 어디서든 따라와요). 꽉 차면 거절 —
                        아끼는 곡을 자동으로 지우면 서운하니까요.
       🎵 추천 리스트 — 30곡, 모두 공용 (music). 넘치면 오래된 것부터. */
  const MUSIC_MAX = 30;      // 추천(공용) 상한
  const MINE_MAX  = 10;      // 나의 리스트 상한
  let _cur = "";             // 지금 재생 중인 vid (이 기기에서만)
  let _list = {};            // 추천(공용) 스냅샷
  let _mine = {};            // 나의 리스트 스냅샷
  let _built = false;

  /* 재생 방식 (2026-08-14, 멤버 요청) — 이 기기에 기억합니다.
       _loop1 : 🔂 이 곡을 계속 반복 (볼륨 줄 왼쪽 단추)
       _chain : "" | "mine" | "all" — ⏭ 그 리스트를 차례로, 끝나면 처음으로
     둘이 겹치면 한 곡 반복이 이깁니다 (더 좁은 뜻이니까). */
  const LOOP_KEY = "musicLoop1", CHAIN_KEY = "musicChain";
  let _loop1 = false;
  let _chain = "";

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
      <!-- 자체 볼륨 — 유튜브의 노브는 플레이어가 작으면 커서를 대기도
           전에 접힙니다. 일시정지처럼 쪽지(postMessage)로 명령을 보내는
           우리 슬라이더는 크기와 무관하게 됩니다. 값은 이 기기에 기억.
           [2026-08-14] 왼쪽에 🔂 한 곡 반복 — 볼륨은 7할 폭으로 양보 -->
      <!-- [2026-08-18 콩] 🔊·🔂 이모지 → VOL·LOOP 글자로. 이모지는 기기마다
           생김이 달라 이 줄만 장난감 같았어요. 노브는 테마 포인트색(--accent)
           둥근 점 — 테마를 바꾸면 노브 색도 따라갑니다. -->
      <div class="music-vol-row">
        <span class="music-vol-ico" aria-hidden="true">VOL</span>
        <input type="range" id="music-vol" min="0" max="100" step="1"
               value="80" aria-label="볼륨">
        <span class="music-vol-val" id="music-vol-val">80</span>
        <button type="button" id="music-loop1" class="music-mode-btn"
                aria-pressed="false" title="이 곡을 계속 반복">LOOP</button>
      </div>
      <div id="music-list" class="music-list"></div>
      <div class="music-add">
        <input type="url" id="music-add-url" placeholder="유튜브 링크 붙여넣기"
               autocomplete="off" spellcheck="false">
        <button type="button" id="music-add-mine" title="♪ 나의 리스트에 (나만 봐요)">담기</button>
        <button type="button" id="music-add-btn" title="🎵 추천 리스트에 (모두에게)">추천</button>
      </div>`;
    document.getElementById("music-add-btn").addEventListener("click", () => addLink(false));
    document.getElementById("music-add-mine").addEventListener("click", () => addLink(true));
    document.getElementById("music-add-url").addEventListener("keydown", e => {
      /* 🧘 혼자 방에는 [추천](모두에게)이 없으니 엔터는 [담기]로 */
      if (e.key === "Enter") { e.preventDefault(); addLink(!!window.SOLO); }
    });

    /* 볼륨 — 저장값 복원 + 움직일 때마다 적용·저장 */
    const vol = document.getElementById("music-vol");
    try {
      const saved = parseInt(AppStore.getItem("musicVol"), 10);
      if (saved >= 0 && saved <= 100) vol.value = saved;
    } catch (e) {}
    /* --vol — 먹선의 채워진 길이 (CSS 가 읽습니다) */
    const paintVol = () => {
      document.getElementById("music-vol-val").textContent = vol.value;
      vol.style.setProperty("--vol", vol.value + "%");
    };
    paintVol();
    vol.addEventListener("input", () => {
      paintVol();
      _sendCmd("setVolume", [Number(vol.value)]);
      try { AppStore.setItem("musicVol", vol.value); } catch (e) {}
    });

    /* 🔂 한 곡 반복 — 이 기기에 기억 */
    try { _loop1 = AppStore.getItem(LOOP_KEY) === "1"; } catch (e) {}
    try { _chain = AppStore.getItem(CHAIN_KEY) || ""; } catch (e) {}
    const lb = document.getElementById("music-loop1");
    if (lb) {
      lb.setAttribute("aria-pressed", _loop1 ? "true" : "false");
      lb.onclick = () => {
        _loop1 = !_loop1;
        if (_loop1) { _chain = ""; try { AppStore.setItem(CHAIN_KEY, ""); } catch (e) {} }
        try { AppStore.setItem(LOOP_KEY, _loop1 ? "1" : "0"); } catch (e) {}
        lb.setAttribute("aria-pressed", _loop1 ? "true" : "false");
        renderList();
      };
    }

    _built = true;
    return true;
  }

  /** 유튜브에 쪽지 보내기 — 일시정지·볼륨이 같이 씁니다 */
  function _sendCmd(func, args) {
    const f = document.getElementById("music-player-frame");
    if (!f || !f.contentWindow) return false;
    try {
      f.contentWindow.postMessage(
        JSON.stringify({ event: "command", func, args: args || [] }), "*");
      return true;
    } catch (e) { return false; }
  }

  /** 곡을 새로 실을 때 저장된 볼륨을 입힙니다 — 플레이어가 준비될
      때까지 잠깐 걸려서 두어 번 나눠 보냅니다 */
  function _applyVolumeSoon() {
    const vol = document.getElementById("music-vol");
    if (!vol) return;
    const v = Number(vol.value);
    [400, 1200, 2500].forEach(ms =>
      setTimeout(() => _sendCmd("setVolume", [v]), ms));
  }

  /* ---------------------------------------------------------------
     재생 — iframe 은 여기서 처음 만들고, 다음부터는 src 만 바꿉니다
     opts.cue    : 걸어만 두기 (자동재생 안 함 — 입장 이어듣기용)
     opts.start  : 이 지점(초)부터
     --------------------------------------------------------------- */
  function play(vid, title, opts) {
    if (!okVid(vid)) return;
    const o = opts || {};
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
    /* 리스트를 클릭한 직후라면(사용자 제스처) autoplay 가 허용됩니다.
       nocookie 도메인 — 방문 기록에 쿠키를 덜 남깁니다.
       enablejsapi=1 — 일시정지·볼륨·이어듣기가 전부 이 문으로 드나듭니다. */
    f.src = "https://www.youtube-nocookie.com/embed/" + vid
          + "?autoplay=" + (o.cue ? 0 : 1) + "&rel=0&enablejsapi=1"
          + (o.start > 3 ? "&start=" + Math.floor(o.start) : "");
    _cur = vid;
    _paused = !!o.cue;
    void title;
    renderList();
    _syncPill();
    _applyVolumeSoon();
    _startListening();
    /* 곡부터 즉시 저장 — 소식(listening)이 안 와도 최소한 "그 곡 처음부터"는
       다음 입장에 걸립니다 (걸어만 두는 cue 때는 저장된 지점을 안 밟습니다) */
    if (!o.cue) _saveLast(vid, o.start || 0);
  }

  /* ---------------------------------------------------------------
     이어듣기 (2026-08-13 밤)

     유튜브에 "소식 좀 계속 보내줘"(listening) 하고 부탁하면 재생
     위치(currentTime)가 계속 날아옵니다. 그걸 이 기기에 적어 뒀다가,
     다음 입장 때 그 곡을 **그 지점에 걸어만** 둡니다 — 자동재생은
     안 해요. 입장하자마자 소리가 터지면 놀라니까, ▶ 는 본인이.
     --------------------------------------------------------------- */
  const LAST_KEY = "musicLast";
  let _lastSaveAt = 0;

  /* [고침 2026-08-14] 저장이 유튜브 소식(listening)에만 기대고 있어서,
     악수가 어긋나면 곡 자체도 안 남았습니다("적용이 안 돼요" 제보).
     이제 ① 재생을 시작하는 순간 곡부터 즉시 적고(지점 0초),
          ② 소식이 오면 지점을 덧쓰고,
          ③ 악수는 한 번이 아니라 5초마다 계속 청합니다 — 놓쳐도 다음에. */
  function _saveLast(vid, t) {
    try { AppStore.setItem(LAST_KEY, JSON.stringify({ vid, t: Math.floor(t) })); }
    catch (e) {}
  }

  let _listenTimer = null;
  function _startListening() {
    if (_listenTimer) return;
    const ask = () => {
      const f = document.getElementById("music-player-frame");
      if (!f) return;
      try {
        f.contentWindow?.postMessage(
          JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
      } catch (e) {}
    };
    ask();
    _listenTimer = setInterval(ask, 5000);
  }

  window.addEventListener("message", (e) => {
    if (typeof e.data !== "string" || !/youtube/.test(e.origin || "")) return;
    let d = null;
    try { d = JSON.parse(e.data); } catch (err) { return; }

    /* 곡이 끝났다 (playerState 0) — 반복이나 이어듣기 차례 */
    const st = d && d.info && d.info.playerState;
    if (st === 0) { onSongEnd(); return; }

    const t = d && d.info && d.info.currentTime;
    if (typeof t !== "number" || !_cur) return;
    const now = Date.now();
    if (now - _lastSaveAt < 3000) return;      // 3초에 한 번이면 충분합니다
    _lastSaveAt = now;
    _saveLast(_cur, t);
  });

  /* ---------------------------------------------------------------
     곡이 끝났을 때 (2026-08-14)

     🔂 한 곡 반복이면 그 자리에서 처음으로. ⏭ 이어듣기면 그 리스트의
     다음 곡으로, 마지막이면 처음으로 돌아갑니다(무한 순환 — 콩 결정).
     ★ 자동으로 시작하는 재생은 브라우저가 막을 수 있습니다. 다만 이미
       소리를 내던 중이라 대개 통과해요. 막히면 알약 불이 안 켜지므로
       거기서 눈치챌 수 있고, 리스트에서 직접 누르면 이어집니다.
     --------------------------------------------------------------- */
  function chainRows() {
    const pick = (o) => Object.entries(o).map(([id, s]) => ({ id, ...s }))
      .filter(s => okVid(s.vid)).sort((a, b) => (a.at || 0) - (b.at || 0));
    if (_chain === "mine") return pick(_mine);
    if (_chain === "all") return pick(_list);
    return [];
  }

  function onSongEnd() {
    if (_loop1 && _cur) {                 // 🔂 이 곡을 다시 처음부터
      _sendCmd("seekTo", [0, true]);
      _sendCmd("playVideo");
      return;
    }
    if (!_chain) return;
    const rows = chainRows();
    if (!rows.length) return;
    const i = rows.findIndex(s => s.vid === _cur);
    const next = rows[(i + 1) % rows.length];   // 마지막 다음은 처음 (무한 순환)
    if (next) play(next.vid, next.title);
  }

  /** 입장 때 — 직전 곡을 멈췄던 지점에 걸어 둡니다 */
  function cueLast() {
    let saved = null;
    try { saved = JSON.parse(AppStore.getItem(LAST_KEY) || "null"); } catch (e) {}
    if (!saved || !okVid(saved.vid)) return;
    play(saved.vid, "", { cue: true, start: Number(saved.t) || 0 });
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
    if (!musicHasPlayer()) return false;
    const cmd = _paused ? "playVideo" : "pauseVideo";
    if (!_sendCmd(cmd)) return false;
    _paused = !_paused;
    renderList();
    _syncPill();
    return true;
  }
  window.musicHasPlayer = musicHasPlayer;
  window.musicTogglePlay = musicTogglePlay;

  /* [철거 2026-08-14] musicDefaultH("영상까지만 열기")는 하루 만에 뺐습니다 —
     처음 여는 사람이 까만 상자만 보고 뭘 눌러야 할지 몰랐어요(실제 제보).
     이제 기본은 리스트·입력칸까지 다 보이고, 줄이는 건 각자 위 가장자리로
     (150px 까지 — script_dock.js setH). 줄인 키는 기기에 남습니다. */

  /* ---------------------------------------------------------------
     알약 불 켜기 — 재생 중이면 [♪ BGM] 알약이 색을 입습니다
     (화면 공유의 "공유 중" 같은 표시. 일시정지하면 꺼져요)
     --------------------------------------------------------------- */
  function _syncPill() {
    document.getElementById("dock-pill-music")
      ?.classList.toggle("music-on", !!_cur && !_paused);
  }

  /* ---------------------------------------------------------------
     리스트 그리기 — 플레이어 칸은 절대 건드리지 않습니다
     --------------------------------------------------------------- */
  function _rowHtml(s, extra) {
    return `
      <div class="music-row${s.vid === _cur ? " is-playing" : ""}" data-vid="${s.vid}"
           data-title="${escapeHtml(s.title || "")}" role="button" tabindex="0">
        <span class="music-row-ico">${s.vid === _cur ? (_paused ? "⏸" : "🔊") : "♪"}</span>
        <span class="music-row-title">${escapeHtml(s.title || s.vid)}</span>
        ${extra}
      </div>`;
  }

  /* 리스트의 손잡이 달기 — 혼자 방은 추천 구역 없이 먼저 끝내므로
     두 곳에서 같이 씁니다 (2026-08-15) */
  function _bindRows(box) {
    box.querySelectorAll(".music-row").forEach(r => {
      r.addEventListener("click", e => {
        if (e.target.closest(".music-row-x")) return;
        play(r.dataset.vid, r.dataset.title);
      });
    });
    box.querySelectorAll("[data-music-del]").forEach(b => {
      b.addEventListener("click", () => {
        db.ref("music/" + b.dataset.musicDel).remove().catch(() => {});
      });
    });
    box.querySelectorAll("[data-mine-del]").forEach(b => {
      b.addEventListener("click", () => {
        db.ref(`users/${myNick}/musicMine/` + b.dataset.mineDel).remove().catch(() => {});
      });
    });
    /* ⏭ 이어듣기 — 리스트 머리의 단추. 같은 것을 다시 누르면 끕니다 */
    box.querySelectorAll("[data-chain]").forEach(b => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const v = b.dataset.chain;
        _chain = (_chain === v) ? "" : v;
        if (_chain) { _loop1 = false; try { AppStore.setItem(LOOP_KEY, "0"); } catch (er) {} }
        try { AppStore.setItem(CHAIN_KEY, _chain); } catch (er) {}
        document.getElementById("music-loop1")
          ?.setAttribute("aria-pressed", _loop1 ? "true" : "false");
        renderList();
      });
    });
    /* 추천 → 내 리스트로 담기 */
    box.querySelectorAll("[data-mine-add]").forEach(b => {
      b.addEventListener("click", () => {
        if (Object.keys(_mine).length >= MINE_MAX) return;
        db.ref(`users/${myNick}/musicMine`).push({
          vid: b.dataset.mineAdd,
          title: b.dataset.addTitle || "",
          at: Date.now()
        }).catch(() => {});
      });
    });
  }

  function renderList() {
    const box = document.getElementById("music-list");
    if (!box) return;
    const mine = Object.entries(_mine)
      .map(([id, s]) => ({ id, ...s }))
      .filter(s => okVid(s.vid))
      .sort((a, b) => (a.at || 0) - (b.at || 0));
    const rows = Object.entries(_list)
      .map(([id, s]) => ({ id, ...s }))
      .filter(s => okVid(s.vid))
      .sort((a, b) => (a.at || 0) - (b.at || 0));   // 오래된 것 위
    const mineVids = new Set(mine.map(s => s.vid));

    /* ♪ 나의 리스트 — 위. 머리 오른쪽에 ⏭ 이어듣기 (그 리스트를 무한 순환) */
    let h = `<div class="music-sec-head"><span>♪ 나의 리스트
               <button type="button" class="music-mode-btn mini" data-chain="mine"
                 aria-pressed="${_chain === "mine"}"
                 title="나의 리스트를 차례로 이어 듣기 (끝나면 처음으로)">⏭</button></span>
               <span>${mine.length} / ${MINE_MAX} · 나만 봐요</span></div>`;
    h += mine.length
      ? mine.map(s => _rowHtml(s, `
          <button type="button" class="music-row-x" data-mine-del="${s.id}"
                  aria-label="내 리스트에서 빼기" title="내 리스트에서 빼기">✕</button>`)).join("")
      : `<div class="music-empty mini">링크를 [담기] 하거나, 아래 추천의 ＋ 를 눌러 채워요.</div>`;

    /* 🎵 추천 리스트 — 아래.
       🧘 혼자 방에는 없습니다 (나눌 상대가 없으니 나의 리스트만 씁니다) */
    if (window.SOLO) { box.innerHTML = h; _bindRows(box); return; }
    h += `<div class="music-sec-head"><span>🎵 추천 리스트
            <button type="button" class="music-mode-btn mini" data-chain="all"
              aria-pressed="${_chain === "all"}"
              title="추천 리스트를 차례로 이어 듣기 (끝나면 처음으로)">⏭</button></span>
            <span>클릭하면 재생 · 나에게만 들려요</span></div>`;
    h += rows.length
      ? rows.map(s => _rowHtml(s, `
          <span class="music-row-nick">${escapeHtml(s.nick || "")}</span>
          ${!mineVids.has(s.vid) && mine.length < MINE_MAX
            ? `<button type="button" class="music-row-x" data-mine-add="${s.vid}"
                       data-add-title="${escapeHtml(s.title || "")}"
                       aria-label="내 리스트에 담기" title="내 리스트에 담기">＋</button>` : ""}
          ${s.nick === myNick
            ? `<button type="button" class="music-row-x" data-music-del="${s.id}"
                       aria-label="내 추천 지우기" title="내 추천 지우기">✕</button>` : ""}`)).join("")
      : `<div class="music-empty">아직 추천이 없어요.
          아래에 유튜브 링크를 붙여넣어 첫 곡을 걸어 주세요!</div>`;

    box.innerHTML = h;
    _bindRows(box);
  }

  /* ---------------------------------------------------------------
     추천 올리기 — 상한을 넘으면 오래된 것부터 지웁니다
     --------------------------------------------------------------- */
  async function addLink(toMine) {
    const inp = document.getElementById("music-add-url");
    const btn = document.getElementById(toMine ? "music-add-mine" : "music-add-btn");
    if (!inp || !myNick) return;
    const url = inp.value.trim();
    const vid = parseVid(url);
    if (!vid) { alert("유튜브 링크가 아닌 것 같아요. 주소를 다시 봐 주세요."); return; }
    if (toMine) {
      if (Object.keys(_mine).length >= MINE_MAX) {
        alert(`나의 리스트는 ${MINE_MAX}곡까지예요. 하나를 빼고 담아 주세요.`); return;
      }
      if (Object.values(_mine).some(s => s.vid === vid)) {
        alert("이미 나의 리스트에 있는 곡이에요!"); inp.value = ""; return;
      }
    } else if (Object.values(_list).some(s => s.vid === vid)) {
      alert("이미 추천 리스트에 있는 곡이에요!"); inp.value = ""; return;
    }

    /* ★ 글칸은 보내기 **전에** 비웁니다 — 품평에서 배운 것.
       listener 재렌더가 입력값을 "지키려다" 살려버리는 사고 방지 */
    inp.value = "";
    if (btn) btn.disabled = true;

    try {
      const title = (await fetchTitle(url)) || url;
      if (toMine) {
        await db.ref(`users/${myNick}/musicMine`).push({ vid, title, at: Date.now() });
      } else {
        await db.ref("music").push({ vid, title, nick: myNick, at: Date.now() });
        /* 방 전체가 보는 추천 리스트에 올렸을 때만 붉은 점.
           나의 리스트(musicMine)는 남이 볼 수 없으니 알릴 것도 없어요. */
        window.dockMarkNew?.("music");

        /* 상한 정리 — 넘친 만큼 오래된 것부터 (추천만. 나의 리스트는
           꽉 차면 거절합니다 — 아끼는 곡을 자동으로 지우면 서운해요) */
        const snap = await db.ref("music").once("value");
        const all = [];
        snap.forEach(c => { all.push({ id: c.key, at: (c.val() || {}).at || 0 }); });
        if (all.length > MUSIC_MAX) {
          all.sort((a, b) => a.at - b.at);
          const over = all.slice(0, all.length - MUSIC_MAX);
          for (const o of over) await db.ref("music/" + o.id).remove();
        }
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
    /* ♪ 나의 리스트 — 닉 기준이라 어느 기기에서든 따라옵니다 */
    db.ref(`users/${myNick}/musicMine`).on("value", snap => {
      _mine = snap.val() || {};
      renderList();
    });
    cueLast();     // 직전 곡을 멈췄던 지점에 걸어 둡니다 (▶ 만 누르면 이어짐)
  }
  window.musicInit = musicInit;
})();
