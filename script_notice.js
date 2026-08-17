/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_notice.js — 📢 공지판 (2026-08-11)
   ---------------------------------------------------------------------
   [무엇인가]
   기능이 생기거나 버그를 고쳤을 때 남기는 알림판입니다. 채팅 머리말의
   [📢 공지] 를 누르면 지난 공지가 최신순으로 쭉 나옵니다.

   [왜 만들었나]
   지금까지는 오픈카톡에 올렸는데, 다른 대화에 밀려 올라가면 다시
   찾기가 어려웠습니다. 공지는 "흘러가면 안 되는 글"이라 따로 쌓이는
   자리가 필요합니다.

   [사진은 파일 저장소를 쓰지 않습니다]
   Firebase Storage 는 요금제를 올려야 합니다. 그래서 프사와 같은 방법을
   씁니다 — 그림을 줄여서 **글자(data URL)** 로 바꿔 DB에 넣습니다.
   가로 900px · JPEG 로 줄이면 보통 60~150KB 라, 무료 한도(1GB) 안에서
   수천 장까지 들어갑니다.

   ★ 그런데 그 글자를 공지 목록과 **같은 칸에 두면 안 됩니다.**
     목록을 열 때마다 사진까지 전부 딸려오거든요. 공지가 쌓일수록
     느려지고 데이터도 그만큼 나갑니다. 그래서 둘로 나눕니다:

       notice/list/{id}  제목·내용·딱지·시각·사진 장수   ← 목록에서 한 번
       notice/img/{id}   사진 글자들                      ← 그 공지를 펼칠 때만

     펼친 사진은 이 기기 메모리에 담아 두고 두 번은 안 받아옵니다.

   [누가 쓸 수 있나]
   방장 계정 하나뿐입니다. 그리고 이건 화면에서 단추를 숨기는 수준이
   아니라 **보안규칙(서버)이 직접 막습니다** — 남이 개발자도구로
   무엇을 하든 써지지 않습니다. 화면 쪽 확인은 "괜히 안 되는 단추를
   보여주지 않기" 위한 것뿐이에요.

   [안 읽음 표시]
   가장 최근 공지의 시각을 이 기기의 AppStore 에 적어 둡니다. 그보다
   새 공지가 있으면 단추에 붉은 점이 붙습니다. 서버에는 누가 읽었는지
   남기지 않아요 — 방마다 18명분 읽음 기록을 쌓을 만한 일이 아닙니다.
   ===================================================================== */
(function () {
  "use strict";

  /* 보안규칙에 적힌 것과 같은 계정 번호입니다.
     ★ 여기 값을 바꿔도 권한은 안 바뀝니다 — 진짜 자물쇠는 보안규칙이고
       이건 단추를 보여줄지 말지만 정합니다. 둘을 함께 고쳐야 해요. */
  const ADMIN_UID = "ABM1ZJndrqaV3gpYUs03SV9qglr1";

  const SEEN_KEY  = "noticeSeenAt";
  const MAX_TITLE = 60;
  const MAX_BODY  = 2000;
  const MAX_IMGS  = 3;

  /* 사진 — 가로 상한과 글자 상한.
     900px 는 캡처의 글씨가 읽히는 최소선입니다(카톡 공지 캡처 기준).
     220KB 는 base64 로 부풀린 뒤의 글자 길이예요. */
  const IMG_MAX_W     = 900;
  const IMG_MAX_BYTES = 220 * 1024;
  const IMG_INPUT_MAX = 12 * 1024 * 1024;

  const TAGS = [
    { id: "feat", label: "새 기능" },
    { id: "fix",  label: "고침" },
    { id: "info", label: "안내" }
  ];

  let _list    = [];     // [{id, title, body, tag, at, imgs}]
  let _open    = null;   // 펼쳐 둔 공지 id
  let _imgCache = {};    // { id: [dataUrl, ...] } — 받아온 사진
  let _writing = false;  // 작성 칸이 열려 있나
  let _editId  = null;   // 고치는 중인 공지 id (null 이면 새 글)
  let _draft   = { title: "", body: "", tag: "feat", imgs: [] };
  let _bound   = false;

  const el   = id => document.getElementById(id);
  const esc  = s => (window.escapeHtml ? window.escapeHtml(String(s ?? "")) : String(s ?? ""));
  /* [2026-08-17] 공지 쓰기는 운영진도 합니다.
     보안규칙(notice/list/$id)이 이미 열려 있는데 여기서 방장만 보게 두면,
     권한은 있고 단추는 없는 이상한 상태가 됩니다 — 콘솔로는 되는데
     화면으로는 안 되는 셈이라 최소권한 원칙에도 어긋나요.
     ★ canAdmin() 은 script_realtime.js 것이고, 입장할 때 한 번 읽어 둔
       staff 깃발을 봅니다. 없으면(그 파일이 안 실린 화면) uid 로만 봅니다. */
  const isAdmin = () => {
    try {
      if (typeof window.canAdmin === "function") return window.canAdmin();
      return firebase.auth().currentUser?.uid === ADMIN_UID;
    } catch (e) { return false; }
  };

  const tagLabel = id => (TAGS.find(t => t.id === id) || TAGS[2]).label;

  /* ── 날짜 — "8월 11일" 처럼 짧게. 올해가 아니면 연도까지 ── */
  function dateLabel(ms) {
    const d = new Date(Number(ms) || 0);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const y = d.getFullYear() === now.getFullYear() ? "" : `${d.getFullYear()}년 `;
    return `${y}${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  /* =====================================================================
     사진 줄이기 — 프사(script_profile.js)와 같은 방식이되 가로가 깁니다
     ---------------------------------------------------------------------
     프사는 128px 정사각으로 자릅니다. 공지 사진은 캡처가 대부분이라
     자르면 글씨가 잘려요. 그래서 **비율을 지키며 가로만** 줄입니다.
     ===================================================================== */
  function fileToWideDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("파일이 없어요."));
      if (!/^image\//.test(file.type)) return reject(new Error("이미지 파일만 올릴 수 있어요."));
      if (file.size > IMG_INPUT_MAX) return reject(new Error("파일이 너무 커요. 12MB 이하로 부탁해요."));

      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        try {
          /* 원본이 이미 작으면 키우지 않습니다 — 키워봐야 흐려질 뿐이에요 */
          const w = Math.min(img.width, IMG_MAX_W);
          const h = Math.max(1, Math.round(img.height * (w / img.width)));

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          /* 캡처는 흰 바탕이 많은데 PNG 투명도가 섞이면 JPEG 에서
             검게 됩니다. 흰색을 먼저 깔아 둡니다. */
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, w, h);
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, w, h);

          let out = "";
          for (const q of [0.85, 0.75, 0.65, 0.55, 0.45]) {
            out = canvas.toDataURL("image/jpeg", q);
            if (out.length <= IMG_MAX_BYTES) break;
          }
          if (out.length > IMG_MAX_BYTES) {
            return reject(new Error("이미지를 충분히 줄이지 못했어요. 조금 잘라서 올려주세요."));
          }
          resolve(out);
        } catch (e) {
          reject(e);
        } finally {
          URL.revokeObjectURL(url);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("이미지를 읽지 못했어요."));
      };
      img.src = url;
    });
  }

  /** 저장된 사진 값 검증 — data:image/... 만 통과 (외부 주소·javascript: 차단) */
  function sanitizeImg(v) {
    const s = String(v || "");
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) return "";
    if (s.length > IMG_MAX_BYTES + 1024) return "";
    return s;
  }

  /* =====================================================================
     읽음 표시
     ===================================================================== */
  function seenAt() {
    return Number(window.AppStore?.getItem(SEEN_KEY) || 0);
  }
  function markSeen() {
    const newest = _list.length ? Number(_list[0].at || 0) : 0;
    if (newest) window.AppStore?.setItem(SEEN_KEY, String(newest));
    paintDot();
  }
  function unreadCount() {
    const s = seenAt();
    return _list.filter(n => Number(n.at || 0) > s).length;
  }
  function paintDot() {
    const dot = el("notice-dot");
    if (!dot) return;
    dot.classList.toggle("hidden", unreadCount() === 0);
  }

  /* =====================================================================
     서버에서 목록 받기 — 글만. 사진은 여기서 안 받아옵니다.
     ===================================================================== */
  function listenNoticeBoard() {
    if (!window.db) return;
    window.db.ref("notice/list").on("value", snap => {
      const raw = snap.val() || {};
      _list = Object.keys(raw)
        .map(id => ({
          id,
          title: String(raw[id]?.title || ""),
          body:  String(raw[id]?.body  || ""),
          tag:   String(raw[id]?.tag   || "info"),
          at:    Number(raw[id]?.at    || 0),
          editedAt: Number(raw[id]?.editedAt || 0),
          imgs:  Math.max(0, Math.min(MAX_IMGS, Number(raw[id]?.imgs || 0)))
        }))
        .sort((a, b) => b.at - a.at);        // 최신이 위로
      paintDot();
      if (el("notice-modal")?.style.display === "flex") render();
    }, err => console.warn("[공지] 목록을 못 받아왔어요", err));
  }

  /** 그 공지의 사진을 받아옵니다 (한 번 받으면 기억해 둡니다) */
  async function loadImgs(id) {
    if (_imgCache[id]) return _imgCache[id];
    const snap = await window.db.ref("notice/img/" + id).once("value");
    const v = snap.val();
    const arr = (Array.isArray(v) ? v : Object.values(v || {}))
      .map(sanitizeImg).filter(Boolean);
    _imgCache[id] = arr;
    return arr;
  }

  /* =====================================================================
     그리기
     ===================================================================== */
  function noticeHtml(n) {
    const isOpen = _open === n.id;
    const imgs   = _imgCache[n.id] || [];
    const fresh  = Number(n.at || 0) > seenAt();

    /* 접었을 때는 두 줄까지만 — CSS 가 자릅니다 */
    const bodyHtml = esc(n.body).replace(/\n/g, "<br>");

    const shots = !isOpen || !n.imgs ? "" : imgs.length
      ? `<div class="nt-shots">${imgs.map((src, i) => `
           <button type="button" class="nt-shot" data-nt="zoom" data-id="${esc(n.id)}" data-i="${i}"
                   aria-label="사진 ${i + 1} 크게 보기">
             <img src="${esc(src)}" alt="" loading="lazy">
           </button>`).join("")}</div>`
      : `<p class="nt-loading">사진을 불러오는 중…</p>`;

    return `
      <article class="nt-item${isOpen ? " is-open" : ""}${fresh ? " is-new" : ""}" data-id="${esc(n.id)}">
        <button type="button" class="nt-head" data-nt="toggle" data-id="${esc(n.id)}"
                aria-expanded="${isOpen ? "true" : "false"}">
          <span class="nt-tag nt-tag-${esc(n.tag)}">${esc(tagLabel(n.tag))}</span>
          <span class="nt-title">${esc(n.title)}</span>
          ${n.imgs ? `<span class="nt-clip" title="사진 ${n.imgs}장">🖼 ${n.imgs}</span>` : ""}
          <span class="nt-date">${esc(dateLabel(n.at))}${n.editedAt ? " (수정됨)" : ""}</span>
        </button>
        <div class="nt-body">${bodyHtml}</div>
        ${shots}
        ${isAdmin() ? `
          <div class="nt-admin">
            <button type="button" class="nt-del" data-nt="edit" data-id="${esc(n.id)}">✏️ 고치기</button>
            <button type="button" class="nt-del" data-nt="del" data-id="${esc(n.id)}">🗑 지우기</button>
          </div>` : ""}
      </article>`;
  }

  function writerHtml() {
    if (!isAdmin()) return "";
    if (!_writing) {
      return `<div class="nt-foot">
        <button type="button" class="ghost-btn compact" data-nt="new">＋ 새 공지</button>
      </div>`;
    }
    return `
      <div class="nt-write">
        <div class="nt-write-title">${_editId ? "✏️ 공지 고치기" : "＋ 새 공지"}</div>
        <div class="nt-tagpick" role="group" aria-label="분류">
          ${TAGS.map(t => `
            <button type="button" class="nt-tag nt-tag-${t.id}${_draft.tag === t.id ? " on" : ""}"
                    data-nt="tag" data-tag="${t.id}" aria-pressed="${_draft.tag === t.id}">${t.label}</button>`).join("")}
        </div>

        <label class="sr-only" for="nt-title">제목</label>
        <input type="text" id="nt-title" class="nt-in" maxlength="${MAX_TITLE}"
               placeholder="제목 (예: 채팅 스티커가 생겼어요)" value="${esc(_draft.title)}">

        <label class="sr-only" for="nt-body">내용</label>
        <textarea id="nt-body" class="nt-ta" rows="5" maxlength="${MAX_BODY}"
                  placeholder="내용을 적어주세요">${esc(_draft.body)}</textarea>

        <div class="nt-pics">
          ${_draft.imgs.map((src, i) => `
            <div class="nt-pic">
              <img src="${esc(src)}" alt="">
              <button type="button" class="nt-pic-x" data-nt="unpic" data-i="${i}" aria-label="사진 빼기">✕</button>
            </div>`).join("")}
          ${_draft.imgs.length < MAX_IMGS ? `
            <button type="button" class="nt-pic-add" data-nt="pic">＋ 사진<br><small>${_draft.imgs.length}/${MAX_IMGS}</small></button>` : ""}
        </div>

        <div class="nt-write-foot">
          <span class="nt-msg" id="nt-msg" role="status"></span>
          <button type="button" class="ghost-btn compact" data-nt="cancel">취소</button>
          <button type="button" class="ghost-btn primary compact" data-nt="save">${_editId ? "저장" : "올리기"}</button>
        </div>
      </div>`;
  }

  function render() {
    const board = el("notice-board");
    if (!board) return;

    board.innerHTML = _list.length
      ? _list.map(noticeHtml).join("")
      : `<p class="nt-empty">아직 공지가 없어요.</p>`;

    const foot = el("notice-foot");
    if (foot) foot.innerHTML = writerHtml();

    /* 작성 중이던 글자는 화면을 다시 그려도 살아 있어야 합니다 */
    if (_writing) {
      const ti = el("nt-title"), bo = el("nt-body");
      if (ti) ti.value = _draft.title;
      if (bo) bo.value = _draft.body;
    }
  }

  /* =====================================================================
     누르기 — 판 하나에 한 번만 걸어 둡니다 (줄마다 걸면 다시 그릴 때
     헐거워집니다)
     ===================================================================== */
  function bind() {
    if (_bound) return;
    _bound = true;

    const modal = el("notice-modal");
    if (!modal) return;

    /* ★ [고침 2026-08-11] 리스너를 바깥 덮개가 아니라 **안쪽 상자**에 답니다.

       [무엇이 잘못됐었나]
       팝업 껍데기(#notice-modal)에는 "바깥을 누르면 닫기"가 걸려 있고,
       안쪽 상자(.modal-content)에는 onclick="event.stopPropagation()" 이
       붙어 있습니다. 그래서 안에서 누른 click 은 껍데기까지 **올라오지
       못합니다.** 껍데기에 달아둔 리스너는 한 번도 안 불렸고, [＋ 새 공지]
       를 눌러도 아무 일이 없었어요.

       ※ stopPropagation 은 위로 올라가는 것만 막습니다. 같은 칸에 달린
         다른 리스너는 그대로 불려요 — 그래서 이 상자에 달면 됩니다.

       ※ 이 사고는 🗂️ 나의 작업 창에서 2026-08-06 에 이미 한 번 났고
         거기 주석으로도 남겨 두었는데, 새 창을 만들며 그대로 되풀이했습니다.
         그래서 이번엔 검사(checks.js)로 못 박아 둡니다. */
    /* ★ [고침 2026-08-12] 그 안쪽 상자가 **이사를 갔습니다.**
       알약 줄 배치(script_dock.js)가 .modal-content 를 통째로 알약 판
       (#dock-body-notice)으로 옮겨 갑니다. 그런데 여기서는 여전히
       "겉창 안에서" 찾고 있었으니 못 찾고, 대비책으로 **빈 껍데기**에
       리스너를 달았어요. 상자는 판 안에 있는데 손가락은 빈 껍데기를
       지키고 있었으니 [＋ 새 공지] 가 또 침묵했습니다 — 같은 자리에서
       세 번째 사고입니다 (0806 나의작업 → 0811 공지 → 오늘).
       이제 상자가 어디로 이사 갔든 **상자 자신**을 찾아서 답니다. */
    const box = document.querySelector("#dock-body-notice .modal-content")
             || modal.querySelector(".modal-content") || modal;

    box.addEventListener("click", async ev => {
      const btn = ev.target.closest("[data-nt]");
      if (!btn) return;
      const act = btn.dataset.nt;
      const id  = btn.dataset.id;

      if (act === "toggle") {
        _open = (_open === id) ? null : id;
        render();
        /* 펼쳤고 사진이 있는데 아직 못 받아왔으면 지금 받아옵니다 */
        const n = _list.find(x => x.id === _open);
        if (n && n.imgs && !_imgCache[n.id]) {
          try { await loadImgs(n.id); } catch (e) { _imgCache[n.id] = []; }
          if (_open === n.id) render();
        }
        return;
      }

      if (act === "zoom") {
        const src = (_imgCache[id] || [])[Number(btn.dataset.i) || 0];
        if (src) openZoom(src);
        return;
      }

      if (act === "new") {
        _writing = true; _editId = null;
        _draft = { title: "", body: "", tag: "feat", imgs: [] };
        render(); return;
      }

      if (act === "edit") {
        const n = _list.find(x => x.id === id);
        if (!n) return;
        _writing = true;
        _editId  = id;
        /* 사진도 함께 불러와야 "고치기"를 눌렀다가 저장하는 것만으로
           사진이 날아가지 않습니다. 아직 안 받아왔으면 지금 받아옵니다. */
        _draft = { title: n.title, body: n.body, tag: n.tag, imgs: (_imgCache[id] || []).slice() };
        render();
        if (n.imgs && !_imgCache[id]) {
          say("사진을 불러오는 중…");
          try { _draft.imgs = (await loadImgs(id)).slice(); say(""); }
          catch (e) { say("사진을 못 불러왔어요. 그대로 저장하면 사진이 지워집니다."); }
          render();
        }
        return;
      }

      if (act === "cancel") { keepDraft(); _writing = false; _editId = null; render(); return; }
      if (act === "tag")    { keepDraft(); _draft.tag = btn.dataset.tag; render(); return; }
      if (act === "unpic")  { keepDraft(); _draft.imgs.splice(Number(btn.dataset.i) || 0, 1); render(); return; }
      if (act === "pic")    { keepDraft(); pickPhoto(); return; }
      if (act === "save")   { keepDraft(); await saveNotice(); return; }
      if (act === "del")    { await delNotice(id); return; }
    });
  }

  /** 화면을 다시 그리기 전에 입력칸의 글자를 챙겨 둡니다 */
  function keepDraft() {
    const ti = el("nt-title"), bo = el("nt-body");
    if (ti) _draft.title = ti.value;
    if (bo) _draft.body  = bo.value;
  }

  function say(msg) {
    const m = el("nt-msg");
    if (m) m.textContent = msg || "";
  }

  /* ── 사진 고르기 ── */
  function pickPhoto() {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      say("사진을 줄이는 중…");
      try {
        const url = await fileToWideDataUrl(f);
        _draft.imgs.push(url);
        say("");
      } catch (e) {
        say(e.message || "사진을 넣지 못했어요.");
      }
      render();
    };
    inp.click();
  }

  /* ── 올리기 ── */
  async function saveNotice() {
    const title = _draft.title.trim();
    const body  = _draft.body.trim();
    if (!title) { say("제목을 적어주세요."); return; }
    if (!body)  { say("내용을 적어주세요."); return; }

    const editing = !!_editId;
    say(editing ? "저장하는 중…" : "올리는 중…");
    try {
      const ref = editing
        ? window.db.ref("notice/list/" + _editId)
        : window.db.ref("notice/list").push();
      const id = editing ? _editId : ref.key;

      /* ★ 사진을 먼저 넣고 목록을 나중에 넣습니다.
         반대로 하면, 목록만 올라간 찰나에 누가 열었을 때
         "사진 2장" 이라고 써 놓고 못 불러오는 상태가 됩니다. */
      if (_draft.imgs.length) {
        await window.db.ref("notice/img/" + id).set(_draft.imgs);
      } else if (editing) {
        /* 고치면서 사진을 다 뺐다면 서버에서도 지웁니다 —
           안 그러면 "사진 0장" 인데 그림이 남아 용량만 먹습니다. */
        await window.db.ref("notice/img/" + id).remove();
      }

      /* ★ 고칠 때 at(올린 시각)은 **그대로 둡니다.**
         at 을 새로 찍으면 목록에서 맨 위로 튀어 오르고, 모두에게
         "안 읽은 새 공지" 로 다시 붉은 점이 붙습니다. 오타 하나
         고쳤는데 방 전체에 새 공지가 뜨면 안 되니까요.
         대신 고친 시각은 editedAt 에 따로 남겨 "(수정됨)" 을 붙입니다. */
      const keepAt = editing
        ? (_list.find(x => x.id === id)?.at || Date.now())
        : Date.now();

      await ref.set({
        title: title.slice(0, MAX_TITLE),
        body:  body.slice(0, MAX_BODY),
        tag:   TAGS.some(t => t.id === _draft.tag) ? _draft.tag : "info",
        at:    keepAt,
        imgs:  _draft.imgs.length,
        ...(editing ? { editedAt: Date.now() } : {})
      });

      _imgCache[id] = _draft.imgs.slice();
      _writing = false;
      _editId  = null;
      _draft = { title: "", body: "", tag: "feat", imgs: [] };
      _open = id;
      say("");
      markSeen();
      render();
    } catch (e) {
      /* ★ [2026-08-11] 예전에는 여기서 "올리지 못했어요" 한 줄만 보여줬습니다.
         그런데 실패 이유는 크게 셋이고 손볼 곳이 전부 다릅니다 —
           · 권한 없음(PERMISSION_DENIED)  → 보안규칙 또는 로그인 계정
           · 값이 규칙에 안 맞음            → 글자 수·사진 크기
           · 연결 끊김                      → 네트워크
         같은 문장으로 뭉뚱그리면 어디를 봐야 할지 알 수 없어요.
         그래서 파이어베이스가 준 말을 그대로 함께 보여줍니다. */
      console.warn("[공지] 올리기 실패", e);
      const code = String(e && (e.code || e.message) || "");
      say(/permission|PERMISSION/i.test(code)
        ? "권한이 없어요. 콘솔에서 noticeBoardDiag() 를 실행해 보세요."
        : "올리지 못했어요 — " + (code || "알 수 없는 오류"));
    }
  }

  /* =====================================================================
     noticeBoardDiag() — 안 써질 때 콘솔(F12)에 붙여 넣고 실행합니다.
     ---------------------------------------------------------------------
     "권한이 없다"는 말은 원인이 셋이라 그것만으로는 못 고칩니다:
       ① 로그인한 계정이 방장 계정이 아님
       ② 보안규칙이 아직 안 올라감 (또는 다른 프로젝트에 올림)
       ③ 값이 규칙의 조건에 안 맞음 (글자 수·사진 크기)
     셋을 하나씩 갈라 봅니다. 화면에 아무것도 안 남기고 확인만 해요.
     ===================================================================== */
  async function noticeBoardDiag() {
    const uid = (() => { try { return firebase.auth().currentUser?.uid || null; } catch (e) { return null; } })();
    console.log("① 지금 로그인한 계정 :", uid || "(로그인 안 됨)");
    console.log("   보안규칙이 허락한 계정:", ADMIN_UID);
    console.log(uid === ADMIN_UID ? "   → 같습니다 ✅" : "   → ★ 다릅니다. 방장 닉네임으로 다시 들어와 주세요 ❌");
    if (uid !== ADMIN_UID) return;

    /* 글도 사진도 없는 최소한의 값으로 한 번 써 봅니다.
       성공하면 곧바로 지우므로 공지판에는 아무것도 안 남습니다. */
    const ref = window.db.ref("notice/list").push();
    try {
      await ref.set({ title: "진단", body: "진단", at: Date.now(), imgs: 0 });
      await ref.remove();
      console.log("② 최소한의 공지 쓰기 : 성공 ✅ — 보안규칙은 잘 올라가 있어요.");
      console.log("   → 그렇다면 원인은 값입니다. 제목 60자·내용 2000자를 넘지 않았는지,");
      console.log("     사진이 220KB 아래로 줄었는지 확인해 주세요.");
    } catch (e) {
      console.log("② 최소한의 공지 쓰기 : 실패 ❌ —", e.code || e.message);
      console.log("   → 보안규칙이 아직 안 올라갔거나, 다른 프로젝트에 올라갔습니다.");
      console.log("     콘솔 > Realtime Database > 규칙 에서 notice 항목이 보이는지 확인해 주세요.");
    }
  }

  async function delNotice(id) {
    if (!confirm("이 공지를 지울까요? 되돌릴 수 없어요.")) return;
    try {
      await window.db.ref("notice/img/" + id).remove();
      await window.db.ref("notice/list/" + id).remove();
      delete _imgCache[id];
      if (_open === id) _open = null;
      render();
    } catch (e) {
      alert("지우지 못했어요.");
    }
  }

  /* ── 사진 크게 보기 ── */
  function openZoom(src) {
    const z = el("notice-zoom");
    if (!z) return;
    const img = z.querySelector("img");
    if (img) img.src = src;
    z.style.display = "flex";
  }
  function closeZoom() {
    const z = el("notice-zoom");
    if (z) z.style.display = "none";
  }

  /* =====================================================================
     열고 닫기
     ===================================================================== */
  function openNoticeBoard() {
    const modal = el("notice-modal");
    if (!modal) return;
    bind();
    _writing = false;
    _editId  = null;
    modal.style.display = "flex";
    render();
    /* 읽음은 **연 뒤에** 표시합니다 — 먼저 표시하면 "새 공지" 딱지가
       열자마자 사라져서 무엇이 새것인지 못 봅니다. */
    setTimeout(markSeen, 1200);
  }

  function closeNoticeBoard() {
    const modal = el("notice-modal");
    if (modal) modal.style.display = "none";
    closeZoom();
    _writing = false;
    _editId  = null;
  }

  document.addEventListener("keydown", ev => {
    if (ev.key !== "Escape") return;
    if (el("notice-zoom")?.style.display === "flex") { closeZoom(); return; }
    if (el("notice-modal")?.style.display === "flex") closeNoticeBoard();
  });

  window.openNoticeBoard   = openNoticeBoard;
  window.closeNoticeBoard  = closeNoticeBoard;
  window.closeNoticeBoardZoom = closeZoom;
  window.listenNoticeBoard = listenNoticeBoard;
  window.noticeBoardDiag   = noticeBoardDiag;
  /* 검사와 콘솔 확인용 */
  window._noticeAdminUid = ADMIN_UID;
})();
