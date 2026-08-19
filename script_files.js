/* TheMagam © 링가링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_files.js — 📁 자료실 (2026-08-18)

   [무엇인가]
   멤버들이 한글·엑셀·텍스트 같은 자료를 올리고 서로 내려받는 자리.
   대숲·살려주세요와 달리 **익명이 아닙니다** — 자료는 출처가 분명한
   편이 낫고, "내가 올린 것" 을 다른 기기에서도 지울 수 있어야 해서요.

   =====================================================================
   ★★ 목록과 내용을 **따로** 담습니다 — 이 파일에서 제일 중요한 결정
   ---------------------------------------------------------------------
       files/{id}     = { name, size, by, at }   목록
       fileBlob/{id}  = "data:...;base64,..."    내용

   한 덩어리로 두면 **자료실 창을 열기만 해도 48MB가 통째로** 내려옵니다.
   목록만 받으면 몇 KB 예요. 내용은 [받기] 를 누른 그 하나만 옵니다.
   화면 공유가 "공유 중인 사람끼리만" 보는 것과 같은 결이에요.
   ★ 보안규칙도 fileBlob 의 읽기를 **낱개($id)로만** 열어 뒀습니다.
     통째 읽기를 열면 위 설계가 무의미해집니다.

   =====================================================================
   ★ 무거운 파일을 막는 겹이 셋
   ---------------------------------------------------------------------
     ① 고르는 순간 — File.size 를 재서 **읽지도 않고** 돌려보냅니다.
        서버로 한 바이트도 안 나가요 (통신량 낭비 0). 이게 제일 중요.
     ② 보안규칙 — base64 길이 상한. 화면을 우회해도 서버가 거부합니다.
     ③ 종류 — 받을 확장자 목록에 없는 것은 애초에 안 받습니다.
        실행 파일(.exe .bat …)이 목록에 없는 이유이기도 해요.

   =====================================================================
   ★ 나중에 Firebase Storage 로 옮길 때 (요금제 결정 후)
   ---------------------------------------------------------------------
   목록(files)은 **그대로 쓰고** 내용만 옮기면 됩니다.
     · files/{id} 에 url 한 칸이 생기고,
     · 받기가 "url 이 있으면 url, 없으면 fileBlob" 을 보게 하면 끝.
   섞여 있어도 돌아가므로 한꺼번에 옮길 필요도 없어요. 새로 올리는
   것부터 Storage 로 보내면, 옛 파일은 90일 뒤 저절로 사라져 이사가
   저절로 끝납니다. 크기 상한(MAX_BYTES)도 그때 한 곳만 고치면 돼요.
   ===================================================================== */
(function () {
  "use strict";

  const DAY_MS     = 24 * 60 * 60 * 1000;
  const KEEP_MS    = 90 * DAY_MS;          // 90일 (콩 확정) — 대숲 30일보다 길게
  const MAX_BYTES  = 2 * 1024 * 1024;      // ★ 한 개당 2MB (보안규칙과 짝)
  const MAX_B64    = 2800000;              // ★ 보안규칙의 길이 상한과 같은 값
  /* 받는 종류 — 실행 파일은 일부러 없습니다 */
  const OK_EXT = ["hwp", "hwpx", "doc", "docx", "xls", "xlsx", "csv", "txt", "pdf", "zip"];
  const ICON_OF = {
    hwp: "hwp", hwpx: "hwp", doc: "doc", docx: "doc",
    xls: "xls", xlsx: "xls", csv: "xls", txt: "txt", pdf: "pdf", zip: "zip"
  };

  let _rows = [];
  let _ref = null;
  let _bound = false;
  let _busy = false;

  const el = (id) => document.getElementById(id);
  const esc = (s) => (window.escapeHtml ? window.escapeHtml(String(s ?? "")) : String(s ?? ""));

  /* ★★ 내 닉네임 읽기 — 이 방에서 여러 번 데인 자리입니다.
     script_core.js 의 `let myNick` 은 파일 맨 바깥에 있어도 **window 에
     안 붙습니다** (let 의 규칙). `window.myNick` 만 보면 늘 비어 있어서
     "먼저 입장한 뒤에 올릴 수 있어요" 가 뜹니다 — 멀쩡히 입장한 사람에게도요.
     (2026-08-18 실제로 그랬습니다. 대숲·나의 작업이 쓰는 방식 그대로 고침)
     이름 그대로 읽되, 혼자 방처럼 window 에 넣어 주는 화면도 있어 둘 다 봅니다. */
  function me() {
    try { if (typeof myNick === "string" && myNick) return myNick; } catch (e) {}
    return window.myNick || "";
  }

  function 크기글(n) {
    n = Number(n) || 0;
    return n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + "MB" : Math.round(n / 1024) + "KB";
  }
  function 언제(at) {
    const 날 = Math.floor((Date.now() - at) / DAY_MS);
    if (날 <= 0) return "오늘";
    return `${날}일 전`;
  }
  function 확장자(name) { return String(name).split(".").pop().toLowerCase(); }

  function normalize(id, v) {
    if (!v || typeof v !== "object") return null;
    const name = String(v.name || "").slice(0, 120);
    if (!name.trim()) return null;
    return {
      id, name,
      size: Math.max(0, Number(v.size) || 0),
      by: String(v.by || ""),
      at: Number(v.at) || 0,
      /* Storage 로 옮긴 뒤에 채워질 칸 — 지금은 늘 비어 있습니다 */
      url: typeof v.url === "string" ? v.url : ""
    };
  }

  /* =====================================================================
     그리기
     ===================================================================== */
  function render() {
    const box = el("files-board");
    if (!box) return;

    const list = _rows.slice().sort((a, b) => b.at - a.at);
    const 총량 = list.reduce((a, r) => a + r.size, 0);
    /* 막대는 "저장 공간 1GB 중" 이 아니라 **눈대중**입니다 — 200MB 를
       가득으로 보고 그립니다. 그쯤부터는 한번 정리할 때가 된 거예요. */
    const 참 = Math.min(100, Math.round(총량 / (200 * 1024 * 1024) * 100));

    const 줄 = list.map(r => {
      const ext = 확장자(r.name);
      const 남은 = Math.max(0, 90 - Math.floor((Date.now() - r.at) / DAY_MS));
      const 곧 = 남은 <= 14;
      const 내것 = r.by === me();
      /* 지우기는 올린 사람 + 방장·운영진 (규칙도 같은 조건) */
      const 지울수 = 내것 || !!window.canAdmin?.();
      return `
        <div class="fl-row">
          <span class="fl-ic ${ICON_OF[ext] || "txt"}">${esc(ext.toUpperCase().slice(0, 4))}</span>
          <span class="fl-m">
            <span class="fl-n">${esc(r.name)}</span>
            <span class="fl-s">${크기글(r.size)} · ${esc(r.by)} · ${언제(r.at)}${
              곧 ? ` <b class="fl-old">· ${남은}일 뒤 사라져요</b>` : ""}</span>
          </span>
          <button type="button" class="fl-dl" data-file-get="${esc(r.id)}">받기</button>
          ${지울수 ? `<button type="button" class="fl-x" data-file-del="${esc(r.id)}"
                              title="지우기" aria-label="지우기">✕</button>` : ""}
        </div>`;
    }).join("");

    box.innerHTML = `
      <div class="fl-usage">
        <span>${list.length}개 · ${크기글(총량)}</span>
        <span class="fl-bar"><i style="width:${참}%"></i></span>
        <span>90일 뒤 사라져요</span>
      </div>
      <div class="fl-list">${list.length ? 줄
        : `<p class="fl-empty">아직 올라온 자료가 없어요.<br>아래에서 파일을 골라 올려 보세요.</p>`}</div>
      <div class="fl-up">
        <label class="fl-drop" for="files-pick">
          <b>파일을 골라 올리기</b>
          <small>한글 · 워드 · 엑셀 · CSV · 텍스트 · PDF · ZIP · 한 개당 2MB까지</small>
        </label>
        <input type="file" id="files-pick" hidden
               accept=".hwp,.hwpx,.doc,.docx,.xls,.xlsx,.csv,.txt,.pdf,.zip">
        <p class="fl-msg" id="files-msg"></p>
      </div>`;
  }

  function 알림(t, cls) {
    const m = el("files-msg");
    if (m) { m.textContent = t || ""; m.className = "fl-msg " + (cls || ""); }
  }

  /* =====================================================================
     서버 — 목록만 구독합니다 (내용은 받을 때 낱개로)
     ===================================================================== */
  function listen() {
    if (_ref || !window.db) return;
    _ref = window.db.ref("files");
    _ref.on("value", snap => {
      const raw = snap.val() || {};
      const out = [];
      Object.keys(raw).forEach(id => {
        const r = normalize(id, raw[id]);
        if (r) out.push(r);
      });
      _rows = out;
      render();
      sweep();
    });
  }

  /** 90일 지난 것은 조용히 걷어냅니다 (목록과 내용 둘 다) */
  async function sweep() {
    if (!window.db || window.FOREST_NO_WITHER) return;
    const cut = Date.now() - KEEP_MS;
    const dead = _rows.filter(r => r.at && r.at < cut);
    for (const r of dead) {
      try { await window.db.ref("files/" + r.id).remove(); } catch (e) {}
      try { await window.db.ref("fileBlob/" + r.id).remove(); } catch (e) {}
    }
  }

  /* =====================================================================
     ① 고르는 순간 막기 — 서버로 나가기 전에
     ===================================================================== */
  function 골랐을때(file) {
    if (!file) return;
    if (!me()) { 알림("먼저 입장한 뒤에 올릴 수 있어요.", "bad"); return; }

    const ext = 확장자(file.name);
    if (OK_EXT.indexOf(ext) < 0) {
      알림(`❌ .${ext} 는 올릴 수 없는 종류예요. 한글·워드·엑셀·CSV·텍스트·PDF·ZIP 만 받아요.`, "bad");
      return;
    }
    if (file.size > MAX_BYTES) {
      /* ★ 여기서 끝냅니다 — 파일을 **읽지도 않습니다**. 서버로 한 바이트도
         안 나가니 통신량 낭비가 없어요. 얼마나 큰지 같이 알려 줍니다. */
      알림(`❌ ${file.name} 은 ${크기글(file.size)} 예요 — 한 개당 2MB까지 올릴 수 있어요. (서버로는 아무것도 안 보냈어요)`, "bad");
      return;
    }
    올리기(file);
  }

  async function 올리기(file) {
    if (_busy) return;
    _busy = true;
    알림(`${file.name} 올리는 중…`);
    try {
      const b64 = await new Promise((ok, no) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result || ""));
        fr.onerror = () => no(new Error("read"));
        fr.readAsDataURL(file);
      });
      /* base64 는 원본보다 33% 큽니다. ②번 겹(보안규칙)과 같은 값으로
         여기서도 한 번 봅니다 — 서버가 거절하기 전에 사람 말로 알리려고요. */
      if (b64.length > MAX_B64) {
        알림(`❌ ${file.name} 은 담기에 너무 커요 (2MB까지).`, "bad");
        return;
      }
      /* 목록을 먼저 만들고 내용을 붙입니다 — 규칙이 "목록에 있는 id 만
         내용을 쓸 수 있다" 로 잠겨 있어서 순서가 중요해요. */
      const ref = window.db.ref("files").push();
      await ref.set({ name: file.name.slice(0, 120), size: file.size, by: me(), at: Date.now() });
      try {
        await window.db.ref("fileBlob/" + ref.key).set(b64);
      } catch (e) {
        /* 내용을 못 올렸으면 목록도 도로 지웁니다 — 받을 수 없는 줄이
           목록에 남아 있으면 더 헷갈려요 */
        try { await ref.remove(); } catch (e2) {}
        throw e;
      }
      window.dockMarkNew?.("files");
      알림(`✅ ${file.name} (${크기글(file.size)}) 올렸어요.`, "ok");
    } catch (e) {
      알림("올리지 못했어요. 연결을 확인해 주세요.", "bad");
    } finally {
      _busy = false;
      const inp = el("files-pick");
      if (inp) inp.value = "";       // 같은 파일을 다시 고를 수 있게
    }
  }

  /* 받기 — 그 하나만 내려받습니다 */
  async function 받기(id) {
    const r = _rows.find(x => x.id === id);
    if (!r || !window.db) return;
    알림(`${r.name} 받는 중…`);
    try {
      /* Storage 로 옮긴 뒤에는 url 이 채워집니다 — 그때는 그리로 갑니다 */
      let src = r.url;
      if (!src) src = (await window.db.ref("fileBlob/" + id).once("value")).val() || "";
      if (!src) { 알림("파일 내용을 찾지 못했어요.", "bad"); return; }
      const a = document.createElement("a");
      a.href = src; a.download = r.name;
      document.body.appendChild(a); a.click(); a.remove();
      알림("");
    } catch (e) {
      알림("받지 못했어요. 연결을 확인해 주세요.", "bad");
    }
  }

  async function 지우기(id) {
    const r = _rows.find(x => x.id === id);
    if (!r) return;
    if (!confirm(`${r.name} 을(를) 지울까요? 되돌릴 수 없어요.`)) return;
    try {
      await window.db.ref("fileBlob/" + id).remove();
      await window.db.ref("files/" + id).remove();
      알림("지웠어요.");
    } catch (e) {
      알림("지우지 못했어요. (올린 사람과 방장·운영진만 지울 수 있어요)", "bad");
    }
  }

  /* =====================================================================
     손가락 — 판 안쪽 상자에 답니다 (대숲에서 데인 자리)
     ===================================================================== */
  function bind() {
    const host = el("dock-body-files");
    if (!host || _bound) return;
    _bound = true;

    host.addEventListener("click", (e) => {
      const g = e.target.closest("[data-file-get]");
      if (g) { 받기(g.dataset.fileGet); return; }
      const d = e.target.closest("[data-file-del]");
      if (d) { 지우기(d.dataset.fileDel); return; }
    });
    host.addEventListener("change", (e) => {
      if (e.target?.id === "files-pick") 골랐을때(e.target.files?.[0]);
    });
  }

  /** 알약 판이 열릴 때 부릅니다 */
  function openFiles() {
    const host = el("dock-body-files");
    if (host && !el("files-board")) {
      host.innerHTML = `<div class="files-board" id="files-board"></div>`;
    }
    bind();
    listen();
    render();
  }
  window.openFiles = openFiles;
})();
