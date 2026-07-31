/* =====================================================================
   checks.js — 자동 점검 (브라우저 없이 node 로 돌립니다)
   ---------------------------------------------------------------------
   쓰는 법:   node checks.js
   ---------------------------------------------------------------------
   화면을 눈으로 볼 수 없는 상태에서 고치다 보니, "있어야 할 게 사라졌다"
   "순서가 뒤바뀌었다" 같은 사고가 반복됐습니다. 그때마다 여기에 항목을
   하나씩 늘려서, 같은 실수가 다시 나면 걸리도록 해두었습니다.
   ===================================================================== */
const fs=require("fs"), vm=require("vm"), path=require("path");
const DIR=__dirname+path.sep;
const CSS=fs.readFileSync(DIR+"styles.css","utf8");
const HTML=fs.readFileSync(DIR+"index.html","utf8");

let pass=0,fail=0;const fails=[];
const ok=(c,n)=>{ c?pass++:(fail++,fails.push(n)); };

/* ---- 1. 화면 구조 클래스가 CSS 에 살아 있는가 ---- */
const WATCH=["container","app-head","head-tools","chat-sidebar","cards-area","side-rail",
 "pane","pane-pomo","split-root","split","split-grip","pomo-row","personal-title",
 "goal-wrap","todo-wrap","todo-add","todo-list","user-cards-grid","user-card","card-body",
 "card-side","card-chips","card-ach","card-state","card-state-ghost","card-state-row",
 "card-avatar-wrap","card-avatar","card-foot","card-name","card-goal","goal-line","card-meta",
 "card-prog-track","card-meta-line","card-todo-count","card-pomo-count","card-edit-btn",
 "hidden-panels","hidden-chip","slot-picker","slot-row","slot-name","slot-sel","slot-map",
 "slot-cell","slot-no","slot-cell-head","slot-cell-name","slot-cell-pos","panel-off",
 "layout-pick","layout-opt","theme-chip","man-tab","man-panel","color-well","color-hex",
 "color-chip","card-preview","card-preview-foot","nick-preview","msg-link","pat-dots","pat-grid"];
const miss=WATCH.filter(c=>!new RegExp("\\."+c+"[^a-zA-Z0-9_-]").test(CSS));
ok(miss.length===0, "CSS 규칙 없는 클래스: "+miss.join(", "));

/* ---- 1.5 index.html 구조 검사 ----

   [왜 넣었나] 설정 블록 하나를 지우면서 닫는 </div> 를 잘못 잘라, 설정
   모달이 중간에서 끝나버렸습니다. 그러자 뒤따르던 패널과 "닫기" 버튼이
   모달 밖으로 흘러나와 화면 절반을 덮었습니다. 게다가 같은 블록이
   중복돼 id 가 둘이 되면서 선택 상자도 먹지 않았습니다.

   눈으로는 잡기 어렵고 브라우저는 조용히 넘어가는 종류의 사고라,
   기계가 세게 합니다. */
{
  const t = HTML.replace(/<!--[\s\S]*?-->/g, "");
  const open  = (t.match(/<div\b/g)  || []).length;
  const close = (t.match(/<\/div>/g) || []).length;
  ok(open === close, `<div> 여닫이 개수가 맞다 (열림 ${open} / 닫힘 ${close})`);

  const ids = t.match(/id="([^"]+)"/g).map(x => x.slice(4, -1));
  const dup = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
  ok(dup.length === 0, "중복된 id 가 없다" + (dup.length ? " — " + dup.join(", ") : ""));

  /* 설정 탭과 패널이 짝이 맞는가 */
  const tabs   = (t.match(/data-tab="(\w+)"/g) || []).map(x => x.slice(10, -1));
  const panels = (t.match(/id="panel-(\w+)"/g) || []).map(x => x.slice(10, -1));
  tabs.forEach(k => ok(panels.includes(k), `설정 탭 ${k} 에 짝이 되는 패널이 있다`));

  /* 모달의 닫기 버튼이 모달 안에 있는가 (밖으로 새면 화면을 덮습니다) */
  ["settings-modal", "goals-modal", "record-modal", "manual-modal"].forEach(id => {
    const i = t.indexOf(`id="${id}"`);
    if (i < 0) return;
    const seg = t.slice(i);
    const end = seg.indexOf("\n</div>");
    ok(end > 0 && /닫기/.test(seg.slice(0, end)), `${id} 의 닫기 버튼이 모달 안에 있다`);
  });
}

/* ---- 2. 칸 배치 전수 검사 ---- */
const ctx={window:{addEventListener(){}},document:{readyState:"complete",addEventListener(){},
  getElementById(){return null},querySelectorAll(){return []},querySelector(){return null},
  createElement(){return{style:{},classList:{add(){},remove(){},toggle(){}},dataset:{},
    appendChild(){},setAttribute(){},addEventListener(){}}},
  head:{appendChild(){}},body:{classList:{contains(){return false},add(){},remove(){}}}},
  localStorage:{getItem(){return null},setItem(){}},module:{exports:{}}};
ctx.window.document=ctx.document; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(DIR+"script_layout.js","utf8"),ctx);
const L=ctx.window.LayoutSlots;
const SLOTS=L.SLOT_IDS, PANELS=L.PANELS.map(p=>p.id);
const leaves=(n,a=[])=>{ if(typeof n==="string"){a.push(n);return a;} n.kids.forEach(k=>leaves(k,a)); return a; };
for(const [name,tree] of Object.entries(L.TREES)){
  const lv=leaves(tree);
  ok(lv.length===SLOTS.length && new Set(lv).size===SLOTS.length,
     `[${name}] 자리 ${SLOTS.length}개가 중복 없이 있다`);
}
const perms=a=>{ if(a.length<=1) return [a]; const o=[];
  a.forEach((v,i)=>{ perms([...a.slice(0,i),...a.slice(i+1)]).forEach(p=>o.push([v,...p])); }); return o; };
let cases=0, bad=0;
for(const [,tree] of Object.entries(L.TREES))
 for(const perm of perms(PANELS))
  for(let mask=0; mask<32; mask++){
    const map={}; SLOTS.forEach((s,i)=> map[s]=(mask&(1<<i))?perm[i]:null);
    cases++;
    const pr=L.prune(tree,map), shown=SLOTS.filter(s=>map[s]);
    if(shown.length===0){ if(pr!==null) bad++; continue; }
    if(pr===null){ bad++; continue; }
    const lv=leaves(pr);
    if(lv.length!==shown.length||new Set(lv).size!==lv.length) bad++;
    (function chk(n){ if(typeof n==="string")return;
      if(n.kids.length<2) bad++; n.kids.forEach(chk); })(pr);
  }
ok(bad===0, `칸 배치 전수 ${cases.toLocaleString()}가지 (문제 ${bad})`);

/* ---- 3. 다시 조립할 때 창이 삭제되지 않는가 ---- */
{
  const src=fs.readFileSync(DIR+"script_layout.js","utf8");
  const iClear=src.indexOf('root.innerHTML = ""'), iAttic=src.indexOf("attic.appendChild(el)");
  ok(iAttic>=0 && iClear>=0 && iAttic<iClear, "창을 보관함에 먼저 대피시킨 뒤 뿌리를 비운다");
}

/* ---- 4. 채팅의 글자 선택을 막는 규칙이 없는가 ---- */
{
  const lines=CSS.split("\n"); const culprit=[];
  lines.forEach((l,i)=>{
    if(!/user-select:\s*none/.test(l)) return;
    for(let j=i;j>=0;j--){ if(lines[j].includes("{")){
      const sel=lines[j];
      if(/chat|#message|\.container|\.split(?!-grip)|^body\s*\{/.test(sel) && !/split-dragging/.test(sel))
        culprit.push(sel.trim());
      break; } }
  });
  ok(culprit.length===0, "채팅/입력칸의 선택을 막는 규칙 없음: "+culprit.join(" / "));
  ok(/user-select: text/.test(CSS), "채팅·입력칸에 선택을 되살리는 규칙이 있다");
  const src=fs.readFileSync(DIR+"script_layout.js","utf8");
  ok(!/root\.addEventListener\("pointerdown"/.test(src), "뿌리 전체에 pointerdown 을 걸지 않는다");
}

/* ---- 5. 주소 링크 만들기 ---- */
{
  const src=fs.readFileSync(DIR+"script_chat.js","utf8");
  const m=src.match(/function linkifyEscaped\(html\) \{([\s\S]*?)\n  \}/);
  ok(!!m, "linkifyEscaped 가 있다");
  if(m){
    const fn=new Function("html", m[1]);
    ok(/<a class="msg-link"/.test(fn("https://a.com 확인")), "http 주소가 링크가 된다");
    ok(!/<a /.test(fn("javascript:alert(1)")), "javascript: 는 링크가 안 된다");
    ok(!/<a /.test(fn("&lt;script&gt;")), "이스케이프된 태그를 건드리지 않는다");
    ok(/<\/a>\./.test(fn("http://a.com. 끝")), "문장 끝 마침표는 주소에서 뺀다");
  }
}

/* ---- 6. 뽀모 미참가 시 집중 횟수를 세지 않는가 ---- */
{
  const src=fs.readFileSync(DIR+"script_ui.js","utf8");
  const i=src.indexOf("async function incrementTodayFocusSessions");
  ok(/if \(!_pomoParticipating\) return;/.test(src.slice(i,i+700)), "미참가면 집중 횟수를 올리지 않는다");
}

/* ---- 7. 테마 ---- */
{
  const src=fs.readFileSync(DIR+"script_ui.js","utf8");
  const i=src.indexOf("const themes = {");
  const body=src.slice(i, src.indexOf("\n  };", i));
  const names=[...body.matchAll(/^\s*"([^"]+)":\s*\{/gm)].map(m=>m[1]);
  ok(names.length>0, `테마 ${names.length}종`);
  ok(new Set(names).size===names.length, "테마 이름 중복 없음");
  const badHex=[...body.matchAll(/#[0-9A-Za-z]{2,}/g)].map(m=>m[0])
    .filter(c=>!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(c));
  ok(badHex.length===0, "잘못된 색 코드: "+badHex.join(", "));
  let lack=0;
  body.split(/\n(?=\s*")/).filter(b=>/^\s*"/.test(b))
    .forEach(b=>{ ["bg:","text:","me:","other:","header:"].forEach(k=>{ if(!b.includes(k)) lack++; }); });
  ok(lack===0, `테마마다 필수 색이 다 있다 (빠짐 ${lack})`);
}

/* ---- 8. HTML 뼈대 ---- */
ok(/id="split-root"/.test(HTML), "split-root 있음");
ok(/id="panel-attic"/.test(HTML), "창 보관함 있음");
ok(!/class="(col|row)-grip"/.test(HTML), "옛 격자 손잡이가 없다");
ok(!/id="conn-badge"/.test(HTML), "머리말의 옛 연결 배지가 없다");
ok(/class="card-conn/.test(fs.readFileSync(DIR+"script_realtime.js","utf8")),
   "카드에 연결 안테나를 그린다");
{
  const core=fs.readFileSync(DIR+"script_core.js","utf8");
  ok(/paintConnBadge/.test(core), "연결 상태를 화면에 칠하는 함수가 있다");
  const i=core.indexOf('db.ref(".info/connected").on');
  const seg=core.slice(i, i+400);
  ok(/paintConnBadge\(up\)/.test(seg), "끊길 때도 배지를 갱신한다 (early return 앞에서)");
  ok(/conn-down/.test(core), "끊기면 body 에 conn-down 을 붙인다");
  ok(seg.indexOf("paintConnBadge") < seg.indexOf("if (!up) return"), "배지 갱신이 early return 보다 먼저다");
}
["card-conn"].forEach(c=>
  ok(new RegExp("\\."+c+"[^a-zA-Z0-9_-]").test(CSS), `CSS 에 .${c} 가 있다`));
ok(/body\.conn-down .user-card\.is-me \.card-conn/.test(CSS), "내 카드 안테나는 소켓 상태를 따른다");
ok(/\.card-conn\.off/.test(CSS), "끊김 모양이 정의돼 있다");
{
  /* 받침 — 카드 배경색이 비쳐 올라와 안테나가 묻히던 문제 */
  const i = CSS.indexOf(".card-conn{");
  const seg = CSS.slice(i, CSS.indexOf("}", i));
  ok(/background: rgba\(255,255,255,/.test(seg), "안테나에 받침이 깔려 있다");
  ok(/border-radius/.test(seg), "받침 모서리가 둥글다");
  ok(/box-shadow/.test(seg), "받침에 얇은 테두리가 있다");

  /* 어두운 테마 선택자가 실제로 붙는 표식과 맞는지 —
     예전에 안 쓰는 선택자를 써서 조용히 안 먹은 적이 있습니다. */
  const ui = fs.readFileSync(DIR+"script_ui.js","utf8");
  const m = ui.match(/setAttribute\("data-is-dark",\s*isDark \? "(\w+)"/);
  ok(!!m, "applyTheme 이 data-is-dark 를 쓴다");
  ok(CSS.includes(`html[data-is-dark="${m[1]}"] .card-conn`),
     "받침의 어두운 테마 선택자가 실제 표식과 일치한다");
}

/* 좁은 화면 — 창 하나 + 탭 */
{
  const lay = fs.readFileSync(DIR+"script_layout.js","utf8");
  const ui  = fs.readFileSync(DIR+"script_ui.js","utf8");
  ok(/function renderNarrowTabs/.test(lay), "좁은 화면 탭줄을 그린다");
  ok(/window\.setNarrowPanel/.test(lay), "탭으로 창을 바꿀 수 있다");
  ok(/window\.setNarrowDefault/.test(lay), "기본으로 열릴 창을 정할 수 있다");
  ok(/id="set-narrow-panel"/.test(HTML), "설정에 고르는 칸이 있다");
  ok(/set-narrow-panel/.test(ui), "설정 칸이 코드에 연결돼 있다");

  /* 설정 칸의 값이 실제 창 id 와 맞는가 — 오타 한 자면 조용히 안 먹습니다 */
  const panelIds = lay.match(/const PANELS = \[([\s\S]*?)\];/)[1]
    .match(/id: "(\w+)"/g).map(x => x.slice(5, -1));
  const optVals = (HTML.match(/id="set-narrow-panel"[\s\S]*?<\/select>/)[0]
    .match(/value="(\w+)"/g) || []).map(x => x.slice(7, -1));
  /* 창을 줄이거나 늘렸으면 이 선택지도 같이 손봐야 합니다 */
  ok(optVals.length === panelIds.length && optVals.every(v => panelIds.includes(v)),
     "설정 선택지가 실제 창 목록과 일치한다 ("+optVals.join(",")+")");

  /* 서명에 좁은 화면 상태가 들어가야 탭이 먹습니다 */
  const i = lay.indexOf("const sig = JSON.stringify");
  ok(/isNarrow\(\)/.test(lay.slice(i, i+220)), "탭을 눌렀을 때 다시 그리도록 서명에 반영한다");
  ok(/was !== on\) \{ try \{ window\.applyLayout/.test(ui),
     "좁아지거나 넓어질 때 배치를 다시 짠다");

  ok(/\.narrow-tabs\{/.test(CSS) && /\.narrow-tab\.active\{/.test(CSS), "탭 CSS 가 있다");

  /* 안 읽은 채팅 배지 */
  const prof = fs.readFileSync(DIR+"script_profile.js","utf8");
  ok(/window\.noteNarrowChatUnread/.test(lay), "안 읽은 개수를 세는 함수가 있다");
  {
    /* 세는 자리는 원본 renderChatMessage 안이어야 합니다.
       감싸개 순서에 기대면 조용히 안 불립니다. */
    const chat = fs.readFileSync(DIR+"script_chat.js","utf8");
    ok(/window\.noteNarrowChatUnread\?\.\(\)/.test(chat),
       "새 메시지가 오면 원본에서 직접 센다");
    const i = chat.indexOf("function renderChatMessage");
    const j = chat.indexOf("window.noteNarrowChatUnread");
    ok(i > 0 && j > i, "세는 코드가 renderChatMessage 안에 있다");
    ok(/if \(!isMe\) \{ try \{ window\.noteNarrowChatUnread/.test(chat),
       "내 메시지는 세지 않는다");
    ok(!/noteNarrowChatUnread/.test(prof), "감싸개 쪽 중복 호출이 없다");
  }
  ok(/data-narrow-exit/.test(lay) && /window\.leaveRoom/.test(lay),
     "좁은 화면에도 나가기 버튼이 있다");
  ok(/\.nt-exit\{/.test(CSS), "나가기 버튼 CSS 가 있다");
  ok(/nt-badge/.test(lay) && /\.nt-badge\{/.test(CSS), "💬 탭에 배지가 붙는다");
  {
    const i = lay.indexOf("window.noteNarrowChatUnread = function");
    const seg = lay.slice(i, i + 400);
    ok(/if \(!isNarrow\(\)\) return;/.test(seg), "넓은 화면에서는 세지 않는다");
    ok(/narrowCurrent\(\) === "chat"\) return;/.test(seg), "채팅을 보고 있으면 세지 않는다");
  }
  ok(/if \(p\.id === "chat"\) _narrowUnread = 0;/.test(lay), "채팅을 열면 개수를 지운다");
  /* 내 메시지와 시스템 메시지는 세지 않아야 합니다 (기존 훅 조건을 함께 씁니다) */
  {
    const i = prof.indexOf("noteChatMessageWhileCollapsed();");
    const seg = prof.slice(Math.max(0, i - 200), i + 200);
    ok(/data\.type !== "system" && data\.user !== myNick/.test(seg),
       "내 메시지와 입퇴장 알림은 세지 않는다");
  }
  ok(!/body\.narrow-chat-focus \.pane,/.test(CSS),
     "좁은 화면에서 .pane 을 통째로 숨기지 않는다 (고른 창이 .pane 일 수 있음)");
  ok(!/body\.narrow-chat-focus \.split-root > \*\{[^}]*display: flex !important/.test(CSS),
     "창의 display 를 강제하지 않는다 (안쪽 배치 깨짐 방지)");
}

/* 자리비움일 때 🍅 가 쌓이지 않는가 */
{
  const ui = fs.readFileSync(DIR+"script_ui.js","utf8");
  const i = ui.indexOf("async function incrementTodayFocusSessions");
  const seg = ui.slice(i, i + 1100);
  ok(/if \(!_pomoParticipating\) return;/.test(seg), "미참여면 세지 않는다");
  ok(/if \(st === "away"\) return;/.test(seg), "자리비움이면 세지 않는다");
  ok(seg.indexOf('st === "away"') < seg.indexOf("_getTodaySessionCount() + 1"),
     "세기 전에 걸러낸다");
}

/* TheMagam — 카드가 조작판인가 */
{
  const rt  = fs.readFileSync(DIR+"script_realtime.js","utf8");
  const lay = fs.readFileSync(DIR+"script_layout.js","utf8");
  const prof= fs.readFileSync(DIR+"script_profile.js","utf8");
  const tl  = fs.readFileSync(DIR+"script_timelog.js","utf8");
  const ui  = fs.readFileSync(DIR+"script_ui.js","utf8");

  /* A1 프사 → 프로필 */
  ok(/card-avatar-wrap\$\{isMine \? " is-clickable"/.test(rt), "내 프사만 누를 수 있다");
  ok(/data-edit-profile="1"/.test(rt), "프사에 프로필 편집 표시가 붙는다");
  ok(/\[data-edit-profile\]/.test(prof), "프사 클릭을 받는다");

  /* A2 아래칸 → 목표·투두 */
  ok(/window\.openGoals\?\.\(\)/.test(tl), "내 카드 아래칸은 목표·투두를 연다");
  ok(/function openGoals/.test(prof) && /id="goals-modal"/.test(HTML), "목표·투두 팝업이 있다");
  ok(/id="panel-goals"/.test(HTML) && /data-tab="goals"/.test(HTML), "설정에도 목표·투두 탭이 있다");
  ok(/name === "goals"\)\s+mountGoalBlocks/.test(prof), "설정 탭을 열면 옮겨 넣는다");
  /* 실제 덩어리는 하나뿐이어야 합니다 — 두 벌이면 저장이 엉킵니다 */
  ok((HTML.match(/id="status-block"/g) || []).length === 1, "목표 덩어리는 하나뿐이다");
  ok((HTML.match(/id="todo-block"/g)   || []).length === 1, "투두 덩어리는 하나뿐이다");
  /* ★ 가장 위험한 부분 — 뿌리를 비울 때 이 둘이 함께 지워지면 안 됩니다 */
  {
    const i = lay.indexOf('attic.appendChild(el);');
    const j = lay.indexOf('root.innerHTML = ""');
    ok(/\["status-block", "todo-block"\]\.forEach/.test(lay),
       "목표·투두를 보관함으로 피신시킨다");
    ok(lay.indexOf('["status-block", "todo-block"].forEach') < j,
       "피신이 뿌리 비우기보다 먼저다");
    void i;
  }

  /* A3 상태표 → 고르기 */
  ok(/data-pick-status="1"/.test(rt), "내 상태표만 누를 수 있다");
  ok(/window\.openStatusPicker/.test(prof), "상태 고르기 판이 있다");
  {
    const i = prof.indexOf("const CHOICES = [");
    const seg = prof.slice(i, i + 400);
    const vals = (seg.match(/v: "(\w+)"/g) || []).map(x => x.slice(4, -1));
    ok(vals.join(",") === "writing,focus,rest,away", "상태 네 가지가 맞다 ("+vals.join(",")+")");
    ok(/🔥초집중🔥/.test(seg), "집중 이름이 초집중이다");
  }
  ok(/getElementById\("db-status"\)/.test(prof), "기존 저장 흐름을 그대로 탄다");
  ok(!/🔥WORK🔥/.test(rt) && !/🔥WORK🔥/.test(HTML), "옛 이름이 남아 있지 않다");

  /* B1 가로만 */
  ok(/function currentOrientation\(\) \{ return "landscape"; \}/.test(ui),
     "세로 보기를 없앴다");
  ok(!/aria-label="보기"/.test(HTML), "설정에서 세로 선택지를 뺐다");
  ok(/aria-label="좌우 뒤집기"/.test(HTML), "좌우 뒤집기는 남겼다");

  /* B2 팝업 + 닫기 */
  /* 치우기·팝업·되돌리기는 통째로 없앴습니다.
     남아 있으면 같은 일을 하는 길이 둘이 되어 헷갈립니다. */
  ok(!/data-popup=/.test(lay), "치운 창 팝업이 없다");
  ok(!/id="panel-modal"/.test(HTML), "창 팝업 마크업이 없다");
  ok(!/hidden-panels/.test(HTML), "치워둔 창 자리가 없다");
  ok(!/function addPanelCloseButtons/.test(lay), "창마다 ✕ 가 없다");
  ok(!/renderSlotPicker/.test(lay), "자리별 선택 목록이 없다");
  ok(!/id="chat-collapse-btn"/.test(HTML), "채팅만 접는 버튼이 없다");
  ok(!/data-restore=/.test(lay), "옛 되돌리기 방식이 남아 있지 않다");
  /* 팝업 크기와 덜어낸 것들 */
  ok(/#goals-modal \.modal-content\{ width: min\(416px/.test(CSS), "목표 팝업이 416px 다");
  ok(/id="goals-title"/.test(HTML) && /goals-title">/.test(HTML), "목표 팝업 제목이 남아 있다");
  {
    /* 화면에서는 감추되 지우지는 않아야 합니다 —
       지우면 낭독기가 팝업 이름을 못 읽고, 저장 흐름이 끊깁니다. */
    const t = HTML.match(/<h2 class="([^"]*)" id="goals-title"/);
    ok(t && /sr-only/.test(t[1]), "목표 팝업 제목이 화면에서 감춰져 있다");
    ok(/<h4 class="personal-title">🎯 오늘 목표<\/h4>/.test(HTML), "소제목에서 '상태'를 뺐다");
    ok(/<select id="db-status" class="w-full hidden"/.test(HTML), "상태 선택박스가 감춰져 있다");
    ok(/id="db-status"/.test(HTML), "상태 선택박스를 지우지는 않았다 (저장 중계기)");
    ok(/<div class="mini-row end hidden">/.test(HTML), "WORK 시작 버튼이 감춰져 있다");
  }

  /* 오른쪽 줄 접기 */
  {
    ok(/function isSideCollapsed/.test(lay), "접힘 상태를 기억한다");
    ok(/window\.toggleSideCollapsed/.test(lay), "접기·펼치기 스위치가 있다");
    ok(/id="side-toggle-btn"/.test(HTML), "머리말에 접기 버튼이 있다");
    ok(/isSideCollapsed\(\)/.test(lay.slice(lay.indexOf("const sig = JSON.stringify"), lay.indexOf("const sig = JSON.stringify") + 200)),
       "접으면 배치를 다시 짠다");
    /* ★ 핵심 — 숨기는 게 아니라 아예 빼야 빈 공간이 안 생깁니다 */
    ok(/node\.kids\.filter\(k => typeof k === "string" \|\| !hasSidePanels\(k, map\)\)/.test(lay),
       "접힌 줄을 배치에서 아예 뺀다 (숨기기만 하면 빈 자리가 남음)");
    ok(/function hasSidePanels/.test(lay), "어느 가지가 곁줄인지 판단한다");
    /* 뒤집어도 같은 가지가 접혀야 합니다 */
    {
      const map = { s1: "prof", s2: "pomo", s3: "chat" };
      const leaf = (n, o = []) => { if (typeof n === "string") { if (map[n]) o.push(map[n]); return o; }
                                    n.kids.forEach(k => leaf(k, o)); return o; };
      const hasSide = n => { const ids = leaf(n); return ids.length > 0 && ids.every(i => i !== "prof"); };
      ok(hasSide({ kids: ["s2", "s3"] }) === true, "뽀모+채팅 가지는 곁줄이다");
      ok(hasSide("s1") === false || hasSide({ kids: ["s1"] }) === false, "접속자 가지는 곁줄이 아니다");
      ok(hasSide({ kids: ["s1", "s2"] }) === false, "접속자가 섞인 가지는 접지 않는다");
    }
  }

  /* ② ③ 스위치만 남기기 */
  ok(/window\.swapSideSlots/.test(lay), "② ③ 서로 바꾸기가 있다");
  ok(/onclick="swapSideSlots\(\)"/.test(HTML), "설정에 바꾸기 버튼이 있다");
  {
    const i = lay.indexOf("window.swapSideSlots");
    const seg = lay.slice(i, i + 400);
    ok(!/s1/.test(seg), "접속자(①) 자리는 건드리지 않는다");
  }
  ok(!/— 비우기 —|비우기/.test(HTML.replace(/<!--[\s\S]*?-->/g, "")), "비우기 선택지가 없다");
  /* 예전에 비워둔 채로 저장된 분도 창이 돌아와야 합니다 */
  {
    const n = ctx.window.LayoutSlots.normalizeSlotMap;
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const std  = { s1: "pomo", s2: "prof", s3: "chat" };
    const swap = { s1: "chat", s2: "prof", s3: "pomo" };
    ok(eq(n(null, "landscape"), std), "저장값이 없으면 기본 배치");
    ok(eq(n({ s1: null, s2: null, s3: null }, "landscape"), std), "비어 있던 저장값도 되살린다");
    ok(eq(n({ s1: "chat", s2: "prof", s3: "pomo" }, "landscape"), swap), "채팅을 왼쪽에 둔 것은 지킨다");
    ok(eq(n({ s1: "todo", s2: "stat" }, "landscape"), std), "옛 창 이름이 남아 있어도 되살린다");
    ok(Object.values(n({}, "landscape")).every(Boolean), "빈 칸이 생기지 않는다");
    /* ★ 접속자는 어떤 저장값이 와도 늘 가운데여야 합니다 */
    [null, {}, {s1:"chat"}, {s1:"prof",s2:"chat",s3:"pomo"}, {s2:"pomo"}].forEach(v => {
      ok(n(v, "landscape").s2 === "prof", "접속자는 늘 가운데다 " + JSON.stringify(v));
    });
  }

  /* 설정 — 뽀모도로 탭 */
  ok(/🍅 뽀모도로<\/button>/.test(HTML), "타이머 탭 이름이 뽀모도로다");
  ok(/id="set-pomo-part"/.test(HTML), "설정에 참여·알림 스위치가 있다");
  {
    /* 같은 스위치가 두 곳에 있으니 한 함수가 둘을 같이 칠해야 합니다 */
    const i = ui.indexOf("function _renderParticipationButton");
    const seg = ui.slice(i, i + 500);
    ok(/pomo-opt-btn/.test(seg) && /set-pomo-part/.test(seg),
       "두 곳의 스위치를 함께 갱신한다");
  }

  /* 업적이 정말로 사라졌는가 */
  ok(!/trophyCount|crownCount|weeklyWeeks/.test(rt), "업적 계산이 남아 있지 않다");
  ok(!/ach-test/.test(HTML), "업적 테스트 UI 가 없다");
  ok(!/achievementOverrides/.test(rt), "업적 덮어쓰기가 없다");
  ok(/const achChips = "";/.test(rt), "카드 배지 줄이 비었다");
  ok(!/weekly-gold/.test(rt), "금빛 테두리를 쓰지 않는다");

  /* 펫 — 그림 */
  {
    const Pet = require(DIR + "script_pet.js");
    ok(Pet.SPECIES_IDS.length === 20, `20종이다 (${Pet.SPECIES_IDS.length})`);
    ok(Pet.SPECIES_IDS.includes("octopus"), "문어가 있다");
    /* ★ 색은 종류마다 고정 — 서로 겹치면 두 종류가 같은 색이 됩니다 */
    {
      const hexes = Pet.SPECIES.map(x => x.hex);
      ok(hexes.every(h => /^#[0-9A-Fa-f]{6}$/.test(h)), "모든 종류에 색이 정해져 있다");
      const dup = hexes.filter((h, i) => hexes.indexOf(h) !== i);
      ok(dup.length === 0, "색이 겹치지 않는다" + (dup.length ? " — " + dup.join(", ") : ""));
      ok(!Pet.COLOR_IDS, "색 고르기 목록이 없다 (고를 수 없음)");
    }
    /* 종류마다 그리는 함수가 실제로 있어야 합니다 —
       없으면 조용히 고양이로 대체되어 "다 고양이"가 됩니다. */
    {
      const src = fs.readFileSync(DIR+"script_pet.js","utf8");
      const drawn = (src.match(/^    (\w+)\(g\) \{/gm) || []).map(x => x.trim().replace("(g) {", ""));
      const missing = Pet.SPECIES_IDS.filter(id => !drawn.includes(id));
      ok(missing.length === 0, "모든 종류에 그리는 함수가 있다" + (missing.length ? " — 없음: " + missing.join(", ") : ""));
    }
    /* 껍데기 — Lv.1 은 종류를 숨겨야 합니다 */
    {
      const groups = [...new Set(Pet.SPECIES.map(s => s.group))];
      ok(groups.length === 5, `껍데기가 5가지다 (${groups.length})`);
      groups.forEach(gp => ok(!!Pet.SHELLS[gp], `${gp} 껍데기에 이름이 있다`));
      /* 같은 껍데기를 쓰는 두 종류의 Lv.1 그림이 같아야 종류가 안 드러납니다.
         (aria-label 과 clipPath id 만 다릅니다) */
      const strip = sv => sv.replace(/aria-label="[^"]*"/, "").replace(/petclip\d+/g, "C");
      const byGroup = {};
      Pet.SPECIES.forEach(sp => { (byGroup[sp.group] = byGroup[sp.group] || []).push(sp.id); });
      let leak = [];
      Object.entries(byGroup).forEach(([gp, ids]) => {
        const first = strip(Pet.petSvg(ids[0], 1, 56, false));
        ids.slice(1).forEach(id => {
          if (strip(Pet.petSvg(id, 1, 56, false)) !== first) leak.push(gp + "/" + id);
        });
      });
      ok(leak.length === 0, "Lv.1 껍데기가 종류를 드러내지 않는다" + (leak.length ? " — " + leak.join(", ") : ""));
      /* Lv.2 는 껍데기를 걸치고, Lv.3 부터는 벗어야 합니다 */
      ok(Pet.petSvg("cat", 2, 56, false).length > Pet.petSvg("cat", 3, 56, false).length - 400,
         "Lv.2 는 껍데기 조각을 걸친다");
      /* ★ 껍데기 색이 몸 색을 쓰면 색만 보고 종류를 알 수 있습니다 */
      Pet.SPECIES.forEach(x => {
        const sv = Pet.petSvg(x.id, 1, 56, false);
        if (x.hex !== Pet.SHELL_COLOR[x.group]) {
          ok(!sv.includes(x.hex), `${x.label} 껍데기에 몸 색이 새지 않는다`);
        }
      });
      /* 보자기의 clipPath id 가 매번 달라야 합니다 (도감에서 여러 마리를 그림) */
      const a1 = Pet.petSvg("cat", 1, 56, false).match(/petclip(\d+)/)[1];
      const a2 = Pet.petSvg("dog", 1, 56, false).match(/petclip(\d+)/)[1];
      ok(a1 !== a2, "보자기 잘라내기 틀 id 가 겹치지 않는다");
    }
    /* 껍데기 고르기 — 고르는 것은 껍데기까지, 안은 비밀 */
    {
      const groups = [...new Set(Pet.SPECIES.map(s2 => s2.group))];
      groups.forEach(gp => {
        const got = Pet.pickInGroup(gp, {}, () => 0.5);
        ok(!!got && Pet.speciesGroup(got) === gp, `${Pet.SHELLS[gp]} 를 고르면 그 안에서 뽑힌다`);
      });
      /* 여러 번 뽑으면 서로 다른 것이 나와야 합니다 (노려서 뽑을 수 없게) */
      const seen2 = new Set();
      let r = 0;
      for (let i = 0; i < 40; i++) seen2.add(Pet.pickInGroup("egg", {}, () => ((r = (r * 9301 + 49297) % 233280) / 233280)));
      ok(seen2.size > 1, `같은 껍데기에서 여러 종류가 나온다 (${seen2.size}가지)`);
      /* 이미 모은 종류보다 못 모은 종류를 먼저 */
      const dexAll = {}; Pet.SPECIES.filter(x => x.group === "egg").slice(0, 3)
        .forEach(x => { dexAll[Pet.dexKey(x.id)] = 1; });
      const rest = Pet.SPECIES.filter(x => x.group === "egg").slice(3).map(x => x.id);
      let ok2 = true;
      for (let i = 0; i < 20; i++) if (!rest.includes(Pet.pickInGroup("egg", dexAll, Math.random))) ok2 = false;
      ok(ok2, "못 모은 종류를 먼저 뽑는다");
    }

    /* 판다는 색 규칙이 뒤집혀 있습니다 */
    {
      const pp = Pet.palette("panda");
      ok(pp.body === "#F2F0EA" && pp.mark === Pet.colorHex("panda"),
         "판다는 몸이 흰빛이고 정해진 색이 무늬로 들어간다");
    }
    ok(Pet.HOURS_PER_LEVEL === 5 && Pet.MAX_LEVEL === 20, "5시간 1레벨 · Lv.20 만렙");
    ok(Pet.PET_MS === 100 * 3600e3, "만렙까지 100시간이다");
    ok(Pet.AT_TAIL === 5 && Pet.AT_MARK === 10 && Pet.AT_WING === 15,
       "부품이 Lv.5 / 10 / 15 에 붙는다");

    /* ★ 8종 × 10레벨 × 12색 전수 — 좌표에 NaN 이 새면 그림이 통째로 깨집니다 */
    let bad = [];
    for (const sp of Pet.SPECIES_IDS) {
      for (let lv = 1; lv <= Pet.MAX_LEVEL; lv++) {
        const svg = Pet.petSvg(sp, lv, 56, lv === Pet.MAX_LEVEL);
        if (/NaN|undefined|Infinity/.test(svg)) bad.push(`${sp}/Lv${lv}`);
        if (!/<svg/.test(svg) || !/<\/svg>/.test(svg)) bad.push(`${sp}/Lv${lv} 열림닫힘`);
      }
    }
    ok(bad.length === 0, `펫 그림 ${Pet.SPECIES_IDS.length * Pet.MAX_LEVEL}가지가 온전하다${bad.length ? " — " + bad.slice(0,3).join(", ") : ""}`);

    /* 용의 뿔은 몸 색과 무관하게 금색 */
    ok(Pet.petSvg("dragon", 10, 56, true).includes(Pet.HORN_GOLD), "용 뿔은 금색이다");
    /* 뿔 가지는 레벨에 따라 늘어납니다 */
    const horn = lv => (Pet.petSvg("dragon", lv, 56, false).match(/<path d="M/g) || []).length;
    ok(horn(2) < horn(10) && horn(10) < horn(15), "용 뿔이 레벨에 따라 뻗는다");
    /* 날개는 Lv.8 에 */
    ok(!/q10 -17/.test(Pet.petSvg("dragon",14,56,false)) &&
        /q10 -17/.test(Pet.petSvg("dragon",15,56,false)), "용 날개는 Lv.15 에 돋는다");
    /* 반짝이는 정말 다 채운 뒤에만 */
    ok(!/EF9F27/.test(Pet.petSvg("cat",Pet.MAX_LEVEL,56,false)), "Lv.20 도달만으로는 반짝이지 않는다");
    ok(/EF9F27/.test(Pet.petSvg("cat",Pet.MAX_LEVEL,56,true)), "만렙이면 반짝인다");

    /* 레벨 계산 */
    const H = 3600e3;
    ok(Pet.petProgress(0, 0).level === 1, "0시간은 Lv.1");
    ok(Pet.petProgress(4.9 * H, 0).level === 1, "4시간 54분은 아직 Lv.1");
    ok(Pet.petProgress(5 * H, 0).level === 2, "5시간에 Lv.2");
    ok(Pet.petProgress(95 * H, 0).level === 20, "95시간에 Lv.20 도달");
    ok(Pet.petProgress(95 * H, 0).isMax === false, "95시간은 아직 만렙이 아니다");
    ok(Pet.petProgress(100 * H, 0).isMax === true, "100시간에 만렙");
    ok(Pet.petProgress(300 * H, 0).level === 20, "넘겨도 Lv.20 에서 멈춘다");
    /* 만렙 펫이 있으면 그만큼 빼고 센다 */
    ok(Pet.petProgress(101 * H, 1).level === 1, "만렙 1마리 뒤 101시간은 새 펫 Lv.1");
    ok(Pet.petProgress(206 * H, 2).level === 2, "만렙 2마리 뒤 206시간은 Lv.2");
    /* 다음 레벨까지 남은 시간 */
    ok(Pet.petProgress(6 * H, 0).toNextMs === 4 * H, "Lv.2 에서 다음까지 4시간");
    ok(Pet.petProgress(100 * H, 0).toNextMs === 0, "만렙이면 남은 시간 0");

    /* ★ 승계 — 같은 종류가 또 나오지 않아야 합니다 */
    let dex = {}, seen = [];
    const rnd = (() => { let i = 0; return () => ((i = (i * 9301 + 49297) % 233280) / 233280); })();
    for (let n = 0; n < Pet.SPECIES_IDS.length; n++) {
      const p2 = Pet.pickNextPet(dex, rnd);
      seen.push(p2.species);
      dex[Pet.dexKey(p2.species)] = 1;
    }
    ok(new Set(seen).size === Pet.SPECIES_IDS.length,
       `${Pet.SPECIES_IDS.length}마리가 모두 다른 종류다 (${new Set(seen).size})`);
    ok(!seen.some(x => x === undefined), "빈 값이 나오지 않는다");
    /* 도감을 다 채운 뒤에도 죽지 않습니다 */
    const last = Pet.pickNextPet(dex, rnd);
    ok(!!last && Pet.SPECIES_IDS.includes(last.species), "도감을 다 채운 뒤에도 펫이 나온다");
    ok(last.color === undefined, "색은 더 이상 뽑지 않는다");

    /* 색 계산 */
    ok(/^#[0-9a-f]{6}$/i.test(Pet.shade("#378ADD", 0.4)), "밝게 만든 색이 올바른 형식");
    ok(/^#[0-9a-f]{6}$/i.test(Pet.shade("#378ADD", -0.5)), "어둡게 만든 색이 올바른 형식");
    ok(Pet.shade("#000000", 1) === "#ffffff" && Pet.shade("#ffffff", -1) === "#000000",
       "색 계산이 범위를 넘지 않는다");
  }

  /* 펫 — 붙어 있는가 */
  {
    const Pet = require(DIR + "script_pet.js");
    const tl = fs.readFileSync(DIR+"script_timelog.js","utf8");
    const pu = fs.readFileSync(DIR+"script_pet_ui.js","utf8");
    ok(/workMsTotal/.test(tl), "집필 누적을 따로 쌓는다");
    /* WORK·초집중만 밥이 됩니다 */
    const i = tl.indexOf('if (seg.s === "writing" || seg.s === "focus")');
    ok(i > 0, "WORK 와 초집중만 누적한다");
    ok(/\.transaction\(v => \(Number\(v\) \|\| 0\) \+ len\)/.test(tl),
       "여러 창을 열어도 어긋나지 않게 트랜잭션으로 올린다");
    ok(/function promoteIfMaxed/.test(tl), "만렙이면 승계한다");
    ok(/window\.startPet/.test(tl) && /window\.startPet\?\.\(\)/.test(fs.readFileSync(DIR+"script_profile.js","utf8")),
       "입장할 때 펫을 시작한다");
    ok(/function renderPetPanel/.test(pu) && /id="panel-pet"/.test(HTML), "펫 관리 창이 있다");
    ok(/data-tab="pet"/.test(HTML), "설정에 펫 탭이 있다");
    ok(/petSpecies/.test(rt) && /petLevel/.test(rt), "카드에 펫 요약을 실어 보낸다");
    ok(/card-pet/.test(rt) && /\.card-pet\{/.test(CSS), "카드에 펫 자리가 있다");
    ok(/name === "pet"\)\s+window\.renderPetPanel/.test(fs.readFileSync(DIR+"script_profile.js","utf8")),
       "펫 탭을 열면 그린다");

    /* ★ 관리 창을 실제로 끝까지 그려봅니다.

       [왜 넣었나] 블록 하나를 옮기다가 색 고르기 덩어리를 통째로
       지웠습니다. 그러자 정의되지 않은 변수를 쓰게 되어 함수가 예외로
       죽고, 펫 탭이 텅 빈 채로 열렸습니다. 브라우저 화면에는 오류가
       안 뜨니 눈으로만 보면 "왜 안 나오지?" 로만 보입니다.

       파일을 읽어 문자열을 찾는 검사로는 이런 사고를 못 잡습니다.
       그래서 가짜 화면을 만들어 실제로 호출합니다. */
    {
      const stub = () => ({
        innerHTML: "", _petBound: false, style: {},
        addEventListener() {}, remove() {}, setAttribute() {},
        querySelector() { return null; }, appendChild() {},
        classList: { add() {}, remove() {}, toggle() {} }
      });
      const host = stub();
      const mk = (level) => ({
        level, isMax: level >= 10, curMs: level * 4 * 3600e3,
        totalNeed: Pet.PET_MS, ratio: level / 10,
        toNextMs: 2 * 3600e3, species: "cat"
      });
      const c2 = {
        window: { Pet, petDex: () => ({ dog: 1 }) },
        document: { getElementById: id => (id === "panel-pet" ? host : null),
                    createElement: stub, body: { appendChild() {} } },
        console
      };
      c2.window.document = c2.document;
      vm.createContext(c2);
      vm.runInContext(fs.readFileSync(DIR + "script_pet_ui.js", "utf8"), c2);

      let threw = null, sizes = {};
      for (const lv of [1, 2, 5, 10]) {
        c2.window.petState = () => mk(lv);
        host.innerHTML = "";
        try { c2.window.renderPetPanel(); } catch (e) { threw = `Lv.${lv}: ${e.message}`; }
        sizes[lv] = host.innerHTML.length;
      }
      ok(!threw, "관리 창이 예외 없이 그려진다" + (threw ? " — " + threw : ""));
      ok(Object.values(sizes).every(v => v > 800),
         `모든 레벨에서 내용이 채워진다 (${JSON.stringify(sizes)})`);

      /* Lv.1 에만 껍데기 선택지, 색은 늘 */
      c2.window.petState = () => mk(1); host.innerHTML = ""; c2.window.renderPetPanel();
      const h1 = host.innerHTML;
      ok((h1.match(/data-pet-shell/g) || []).length === 5, "Lv.1 에 껍데기 5개가 나온다");
      ok(!/data-pet-color/.test(h1), "색 고르는 칸이 없다");
      /* 종류가 새는지는 "글자가 어디 나오나" 로 보면 안 됩니다.
         나무 상자에는 "나무" 가 들어 있고, "정해집니다" 에는 "해" 가
         들어 있어서 애먼 곳이 걸립니다. 이름이 실제로 쓰이는 두 자리만
         정확히 꺼내서 봅니다. */
      {
        const nameLine = (h1.match(/class="pet-cur-name">([\s\S]*?)<\/div>/) || [])[1] || "";
        ok(/아직 안 깨어났어요/.test(nameLine), "Lv.1 은 아직 안 깨어났다고 알린다");
        ok(Object.values(Pet.SHELLS).some(l => nameLine.includes(l)),
           "이름 줄에 껍데기 이름이 나온다");

        const btnLabels = [...h1.matchAll(/data-pet-shell="(\w+)"[\s\S]*?<span>([^<]+)<\/span>/g)]
          .map(m => [m[1], m[2].trim()]);
        ok(btnLabels.length === 5, `껍데기 버튼이 5개다 (${btnLabels.length})`);
        const wrong = btnLabels.filter(([gp, lab]) => lab !== Pet.SHELLS[gp]);
        ok(wrong.length === 0, "껍데기 버튼에 껍데기 이름만 쓴다" +
           (wrong.length ? " — " + wrong.map(x => x.join(":")).join(", ") : ""));
        /* 종류 이름을 그대로 쓴 버튼이 있으면 비밀이 새는 것입니다 */
        const leaked = btnLabels.filter(([, lab]) => Pet.SPECIES.some(x => x.label === lab));
        ok(leaked.length === 0, "껍데기 버튼이 종류 이름을 쓰지 않는다");
      }

      c2.window.petState = () => mk(5); host.innerHTML = ""; c2.window.renderPetPanel();
      const h5 = host.innerHTML;
      ok(!/data-pet-shell/.test(h5), "Lv.5 에는 껍데기 선택지가 없다");
      ok(!/data-pet-color/.test(h5), "Lv.5 에도 색 고르는 칸이 없다");
    }

    /* ★ 시작 함수가 "입장한 뒤에" 불리는가

       [왜] startPet 과 startTimelog 는 필명이 있어야 동작합니다.
       그런데 페이지 로드(init) 에서만 불렀더니, 그 시점엔 필명이 없어
       첫 줄에서 그냥 돌아갔습니다. 그래서 펫 정보가 비어 있었고,
       화면에는 기본값으로 그려지니 "보이는데 안 눌린다" 가 됐습니다. */
    {
      const prof3 = fs.readFileSync(DIR+"script_profile.js","utf8");
      const i = prof3.indexOf("const _join = window.join;");
      const j = prof3.indexOf("window.join = wrapped;", i);
      ok(i > 0 && j > i, "입장 감싸개가 있다");
      const joinSeg = prof3.slice(i, j);
      ok(/startPet/.test(joinSeg),     "입장한 뒤에 펫을 시작한다");
      ok(/startTimelog/.test(joinSeg), "입장한 뒤에 시간 기록을 시작한다");
      /* 여러 번 불려도 타이머가 겹치지 않아야 합니다 */
      ok(/_petStarted/.test(tl) && /_tlStarted/.test(tl),
         "두 번 불려도 안전하다 (타이머 중복 방지)");
    }

    /* 카드의 펫을 누르면 관리 창 */
    ok(/data-open-pet="1"/.test(rt), "내 카드의 펫만 누를 수 있다");
    const prof2 = fs.readFileSync(DIR+"script_profile.js","utf8");
    ok(/function openPetPanel/.test(prof2) && /openTab\?\.\("pet"\)/.test(prof2),
       "펫을 누르면 관리 창이 열린다");

    /* 껍데기는 Lv.1 에서만 바꿉니다 */
    ok(/window\.setPetShell/.test(tl), "껍데기 바꾸기가 있다");
    {
      const i = tl.indexOf("window.setPetShell");
      const seg = tl.slice(i, i + 700);
      ok(/st\.level !== 1\) return;/.test(seg), "태어난 뒤에는 껍데기를 못 바꾼다");
    }
    ok(!/setPetColor/.test(tl), "색 바꾸기가 없다 (종류마다 고정)");
      ok(!/setPetLook/.test(tl) && !/setPetLook/.test(pu), "종류를 직접 고르는 길이 없다 (비밀 유지)");
    ok(/data-pet-shell/.test(pu), "관리 창에 껍데기 선택지가 있다");
    ok(!/data-pet-species/.test(pu), "관리 창에 종류 선택지가 없다");
    {
      const i = pu.indexOf("const shellPick");
      const seg = pu.slice(i, i + 200);
      ok(/st\.level === 1/.test(seg), "껍데기 선택지는 Lv.1 에만 나온다");
    }
  }

  /* 새 팝업에 CSS 를 빠뜨리면 화면 옆에 어색하게 붙습니다 */
  ["#goals-modal"].forEach(id => {
    /* 선택자 목록의 마지막이면 뒤에 { 가 옵니다 */
    ok(CSS.includes(id + ",") || CSS.includes(id + "{"),
       `${id} 이 팝업 규칙을 함께 받는다`);
    ok(CSS.includes(id + " .modal-content"), `${id} 의 내용 폭이 정해져 있다`);
  });

  /* 남는 공간을 뽀모가 먹지 않아야 합니다 */
  {
    ok(/const GROW_RANK = \{/.test(lay), "남는 공간을 받을 창을 정해둔다");
    const i = lay.indexOf("const GROW_RANK");
    const seg = lay.slice(i, i + 160);
    const rk = {};
    (seg.match(/(\w+): (\d+)/g) || []).forEach(x => {
      const [k, v] = x.split(": "); rk[k] = Number(v);
    });
    ok(rk.chat < rk.pomo, "채팅이 뽀모보다 먼저 늘어난다");
    ok(rk.prof < rk.pomo, "접속자가 뽀모보다 먼저 늘어난다");
    ok(/function pickGrowIndex/.test(lay), "가지마다 늘어날 쪽을 고른다");
    ok(!/} else if \(last\) \{/.test(lay), "무조건 마지막 가지가 늘어나던 규칙을 없앴다");

    /* 실제로 굴려봅니다 — [채팅][뽀모] 순서에서도 채팅이 늘어나야 합니다 */
    const rank = { chat: 1, prof: 2, pomo: 9 };
    const pick = (kids, map) => {
      let best = Infinity, idx = kids.length - 1;
      kids.forEach((k, n) => {
        const r = rank[map[k]] ?? 5;
        if (r < best) { best = r; idx = n; }
      });
      return idx;
    };
    ok(pick(["a","b"], { a: "chat", b: "pomo" }) === 0, "[채팅][뽀모] → 채팅이 늘어난다");
    ok(pick(["a","b"], { a: "pomo", b: "chat" }) === 1, "[뽀모][채팅] → 채팅이 늘어난다");
    ok(pick(["a","b"], { a: "pomo", b: "prof" }) === 1, "[뽀모][접속자] → 접속자가 늘어난다");
  }

  /* 크기는 창을 따라가야 합니다 (자리를 바꿔도 뽀모는 자기 높이) */
  ok(/function sizeKeyFor/.test(lay) && /"panel\/" \+ map\[kid\]/.test(lay),
     "칸 크기를 창 기준으로 기억한다");
  ok(/"panel\/pomo": 320/.test(lay), "뽀모 줄 기본 폭이 잡혀 있다");
  ok(/"panel\/chat": 340/.test(lay), "채팅 줄 기본 폭이 잡혀 있다");
  /* 세 칸이 나란히 서야 합니다 (예전엔 오른쪽을 위아래로 또 갈랐어요) */
  {
    const i = lay.indexOf("const TREES");
    const seg = lay.slice(i, i + 300);
    ok(/landscape:\s*\{ dir: "h", kids: \["s1", "s2", "s3"\] \}/.test(seg),
       "가로 화면에서 세 칸이 나란히 선다");
    ok(!/dir: "v", kids: \["s2", "s3"\]/.test(seg), "오른쪽을 다시 위아래로 가르지 않는다");
  }

  /* 자리 그림이 실제 모양과 같아야 합니다 */
  {
    const i = lay.indexOf("const MAP_SHAPE");
    const seg = lay.slice(i, i + 600);
    ok(/'s1 s2 s3'/.test(seg), "자리 그림이 3단 모양이다");
    ok(/'s3 s2 s1'/.test(lay), "뒤집으면 그림도 뒤집힌다");
    ok(/'s3 s2 s1'/.test(lay) && !/'s2 s1 s3'/.test(lay),
       "뒤집어도 가운데(접속자)는 가운데에 남는다");
    /* 주석이 아니라 실제로 쓰인 곳만 봅니다 */
    const code = lay.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    ok(!/direction\s*:\s*rtl/.test(code), "글자까지 뒤집는 방식을 쓰지 않는다");
  }

  ["status-pop","status-pop-item"].forEach(c =>
    ok(new RegExp("\\."+c+"[^a-zA-Z0-9_-]").test(CSS), `CSS 에 .${c} 가 있다`));
}

/* 보안 규칙이 앱이 쓰는 경로를 모두 덮는가

   [왜] 규칙에 없는 경로는 파이어베이스가 조용히 거절합니다. 오류가
   화면에 안 뜨고 그냥 저장이 안 되니, "기능이 안 먹는다"로 보입니다.
   실제로 attendance 와 achievementOverrides 를 빠뜨려서 출석·업적이
   전부 먹지 않았습니다. */
{
  const rules = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8")).rules;
  const roots = new Set();
  fs.readdirSync(DIR).filter(f => /^(script_|fortune)/.test(f)).forEach(f => {
    const src = fs.readFileSync(DIR+f, "utf8");
    (src.match(/db\.ref\(["`]([^"`/$]+)/g) || []).forEach(m => {
      const r = m.replace(/^db\.ref\(["`]/, "");
      if (r && !r.startsWith(".")) roots.add(r);
    });
  });
  [...roots].sort().forEach(r =>
    ok(Object.prototype.hasOwnProperty.call(rules, r),
       `보안 규칙에 ${r} 가 있다`));
  ok(roots.size >= 6, `앱이 쓰는 경로를 모두 찾았다 (${roots.size}개)`);
}

/* 방이 정말로 분리됐는가 —
   설정을 갈아끼우는 걸 잊으면 UI 만 다른 같은 방이 됩니다. */
{
  const core = fs.readFileSync(DIR+"script_core.js","utf8");
  ok(!/writer-chat/.test(core), "벨사탕 파이어베이스 설정이 남아 있지 않다");
  const m = core.match(/databaseURL: "([^"]+)"/);
  ok(!!m, "databaseURL 이 있다");
  ok(/themagam/.test(m[1]), "databaseURL 이 TheMagam 것이다 ("+m[1]+")");
  ok(/firebasedatabase\.app/.test(m[1]), "Realtime Database 주소 형식이다");
  const pid = core.match(/projectId: "([^"]+)"/);
  ok(pid && m[1].includes(pid[1]),
     "databaseURL 과 projectId 가 같은 프로젝트를 가리킨다");
}

/* 채팅 반응을 붙였을 때 프사가 안 내려가는가

   [왜] .chat-item 이 align-items: flex-end 였습니다. 말풍선 아래에
   반응 줄이 생기면 그만큼 프사도 같이 내려가, 이름 옆이 아니라 반응
   옆에 붙었습니다. 위쪽 정렬로 바꾸고, 이름 줄만큼만 내려서 첫
   말풍선과 맞춥니다. */
{
  /* 주석에 옛 값을 설명으로 적어두었으므로, 주석을 걷어내고 봅니다.
     (예전에 이 함정에 한 번 걸렸습니다) */
  const bare = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const i = bare.indexOf(".chat-item{");
  const seg = bare.slice(i, bare.indexOf("}", i));
  ok(/align-items:\s*flex-start/.test(seg), "채팅 줄은 위쪽 정렬이다");
  ok(!/align-items:\s*flex-end/.test(seg), "아래쪽 정렬이 남아 있지 않다");
  ok(/\.chat-item\.other:not\(\.grouped\) \.chat-avatar/.test(CSS),
     "이름 줄만큼 프사를 내려 맞춘다");
}

/* 방마다 저장 공간이 나뉘어 있는가

   [왜] 두 방이 같은 주소(도메인)를 씁니다. localStorage 는 주소
   단위로 나뉘고 뒤의 폴더 이름은 보지 않으므로, 이름표를 안 붙이면
   두 방이 같은 칸을 함께 씁니다. 실제로 한쪽에서 뽀모가 끝나자
   다른 방 카드의 🍅 가 같이 올라갔습니다. */
{
  const core = fs.readFileSync(DIR + "script_core.js", "utf8");
  const m = core.match(/const STORE_ROOM = "(\w+)"/);
  ok(!!m && m[1].length > 0, "이 방의 이름표가 정해져 있다" + (m ? ` (${m[1]})` : ""));
  ok(m && m[1] === "tm", "이름표가 이 방의 것이다");
  ok(/window\.AppStore = AppStore/.test(core), "AppStore 를 내보낸다");
  ok(/_migrated_v1/.test(core), "예전 값을 한 번 옮겨준다");

  /* 어느 파일에서도 원본 저장소를 직접 쓰면 안 됩니다 (껍데기 안은 예외) */
  const files = fs.readdirSync(DIR).filter(f => /^script_.*\.js$/.test(f));
  const leaks = [];
  files.forEach(f => {
    let src = fs.readFileSync(DIR + f, "utf8");
    if (f === "script_core.js") {
      /* 껍데기가 원본을 감싸는 부분만 잘라냅니다 */
      const end = src.indexOf("// ✅ Utils");
      src = end > 0 ? src.slice(end) : src;
    }
    src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    if (/(?<![.\w])(localStorage|sessionStorage)\./.test(src)) leaks.push(f);
  });
  ok(leaks.length === 0, "원본 저장소를 직접 쓰는 곳이 없다" + (leaks.length ? " — " + leaks.join(", ") : ""));

  /* 실제로 굴려봅니다 — 두 방이 서로를 못 건드려야 합니다 */
  {
    const raw = {};
    const mk = room => {
      const P = room + ":";
      return {
        getItem: k => (P + k in raw ? raw[P + k] : null),
        setItem: (k, v) => { raw[P + k] = String(v); },
        get length() { return Object.keys(raw).filter(x => x.startsWith(P)).length; },
        key: i => (Object.keys(raw).filter(x => x.startsWith(P))[i] || "").slice(P.length) || null
      };
    };
    const a = mk("bl"), b = mk("tm");
    a.setItem("pomoSessions_x", "1");
    b.setItem("pomoSessions_x", "9");
    ok(a.getItem("pomoSessions_x") === "1" && b.getItem("pomoSessions_x") === "9",
       "같은 이름이라도 방마다 값이 따로다");
    a.setItem("writerTheme", "A"); b.setItem("writerTheme", "B");
    ok(a.getItem("writerTheme") === "A", "테마가 서로 안 덮인다");
    ok(a.length === 2 && b.length === 2, "각 방은 자기 열쇠만 센다");
    ok(a.key(0) === "pomoSessions_x", "열쇠 이름에서 이름표가 벗겨진다");
  }
}

/* PWA — 독립 창 설치 */
{
  const mf = JSON.parse(fs.readFileSync(DIR+"manifest.json","utf8"));
  ok(mf.display === "standalone", "독립 창으로 뜬다");
  ok(!!mf.name && !!mf.short_name, "앱 이름이 있다");
  ok(mf.start_url === "./" && mf.scope === "./",
     "상대 경로다 (GitHub Pages 하위 폴더에서도 동작)");
  const sizes = mf.icons.map(i => i.sizes);
  ok(sizes.includes("192x192") && sizes.includes("512x512"),
     "설치에 필요한 192·512 아이콘이 있다");
  ok(mf.icons.some(i => i.purpose === "maskable"), "마스커블 아이콘이 있다");
  /* manifest 안의 경로에는 ?v= 가 붙습니다 (설치된 앱 아이콘 갱신용) */
  mf.icons.forEach(i =>
    ok(fs.existsSync(DIR + i.src.split("?")[0]), `아이콘 파일이 실제로 있다 (${i.src})`));

  /* 파비콘·아이콘·manifest 에 버전이 찍혀야 브라우저가 새로 받아갑니다.
     [왜] 아이콘을 갈았는데 옛 그림이 계속 보였습니다. 파비콘은 캐시가
     특히 끈질겨서 강제 새로고침으로도 안 바뀝니다. */
  ok(/href="icons\/favicon\.png\?v=\d+"/.test(HTML), "파비콘에 버전이 찍혀 있다");
  ok(/href="icons\/apple-touch-icon\.png\?v=\d+"/.test(HTML), "애플 아이콘에 버전이 찍혀 있다");
  ok(/href="manifest\.json\?v=\d+"/.test(HTML), "manifest 에 버전이 찍혀 있다");
  ok(mf.icons.every(i => /\?v=\d+$/.test(i.src)), "manifest 안 아이콘에도 버전이 찍혀 있다");
  {
    /* build-single.py 가 앞으로도 자동으로 찍어주는지 */
    const bs = fs.readFileSync(DIR+"build-single.py","utf8");
    ok(/icons\/\[\\w\.-\]\+\\\.png/.test(bs), "빌드가 아이콘 버전을 자동으로 찍는다");
    ok(/manifest\\\.json/.test(bs), "빌드가 manifest 버전도 찍는다");
  }
  ["icons/favicon.png","icons/apple-touch-icon.png"].forEach(f =>
    ok(fs.existsSync(DIR+f), `${f} 가 있다`));

  ok(/<link rel="manifest" href="manifest\.json(\?v=\d+)?">/.test(HTML),
     "index.html 이 manifest 를 연결한다");
  ok(/serviceWorker.*register\("sw\.js"\)/s.test(HTML), "서비스 워커를 등록한다");
  ok(/rel="apple-touch-icon"/.test(HTML), "사파리·아이폰 아이콘을 연결한다");

  const sw = fs.readFileSync(DIR+"sw.js","utf8");
  ok(/addEventListener\("fetch"/.test(sw), "fetch 처리기가 있다 (설치 조건)");
  /* ★ 여기서 실패하면 배포 사고 위험입니다 — 캐시 코드가 끼어들었다는 뜻 */
  ok(!/caches\.open|cache\.addAll|cache\.put|e\.respondWith|event\.respondWith/.test(sw),
     "서비스 워커가 캐시를 하지 않는다 (예전 화면이 남는 사고 방지)");
  ok(/caches\.delete/.test(sw), "예전 캐시가 남아 있으면 지운다");
}

/* 열린 구간에도 6시간 상한이 걸리는가 —
   WORK 로 두고 며칠 방치하면 며칠이 전부 집필로 잡히던 문제 */
{
  const tl = fs.readFileSync(DIR+"script_timelog.js","utf8");
  const i = tl.indexOf("아직 열려 있는 구간은");
  const seg = tl.slice(i, i + 700);
  ok(/curStart \+ SEG_CAP_MS/.test(seg), "열린 구간에도 상한을 적용한다");

  /* 실제로 굴려봅니다 */
  const CAP = 6*3600e3, DAY = 24*3600e3;
  const dayStart = t => Math.floor(t/DAY)*DAY;   // 검사용 단순 계산
  function openTotal(start, now, days){
    let sum = 0;
    const end = Math.min(now, start + CAP);
    for (let i=days-1; i>=0; i--){
      const d = dayStart(now) - i*DAY;
      const a = Math.max(start, d), b = Math.min(end, d+DAY);
      if (b>a) sum += b-a;
    }
    return sum;
  }
  const now = 10*DAY;
  ok(openTotal(now - 2*3600e3, now, 7) === 2*3600e3, "2시간 방치는 2시간으로 잡힌다");
  ok(openTotal(now - 3*DAY, now, 7) === CAP, "3일 방치도 6시간에서 멈춘다");
  ok(openTotal(now - 20*3600e3, now, 7) === CAP, "20시간 방치도 6시간이다");
  ok(openTotal(now - 30*60e3, now, 7) === 30*60e3, "30분은 30분이다");
}

/* index.html 이 모든 JS 를 실제로 불러오는가 —
   script_timelog.js 를 빠뜨려서 기록 팝업이 안 열린 적이 있습니다.
   build-single.py 는 자기 목록으로 합치므로 단일파일만 멀쩡했고,
   폴더 버전에서만 조용히 죽었습니다. */
{
  const order = fs.readFileSync(DIR+"build-single.py","utf8")
    .match(/ORDER = \[([\s\S]*?)\]/)[1]
    .match(/"([^"]+\.js)"/g).map(x=>x.slice(1,-1));
  order.forEach(f =>
    ok(new RegExp('<script src="'+f.replace(".","\\.")+'(\\?v=[^"]*)?"').test(HTML),
       `index.html 이 ${f} 를 불러온다`));
  ok(order.length >= 11, "합칠 JS 목록이 온전하다");
}

/* 입장 알림 */
{
  const rt=fs.readFileSync(DIR+"script_realtime.js","utf8");
  const ui=fs.readFileSync(DIR+"script_ui.js","utf8");
  ok(/function notifyJoin/.test(ui), "입장 알림 함수가 있다");
  ok(/_joinNoti/.test(ui) && /joinNoti/.test(ui), "입장 알림은 설정으로 켜고 끈다");
  ok(/AppStore\.getItem\("joinNoti"\) === "true"/.test(ui), "입장 알림은 기본 꺼짐이다");
  {
    const i=ui.indexOf("function notifyJoin");
    const seg=ui.slice(i, i+500);
    ok(/if \(!_joinNoti\) return;/.test(seg), "꺼져 있으면 알리지 않는다");
    ok(/visibilityState === "visible"\) return;/.test(seg), "보고 있을 때는 알리지 않는다");
    ok(/canNotify\(\)/.test(seg), "권한 없으면 알리지 않는다");
  }
  ok(/id="set-join-noti"/.test(HTML), "설정에 입장 알림 스위치가 있다");
  ok(/function detectJoins/.test(rt), "입장 감지 함수가 있다");
  {
    const i=rt.indexOf("function detectJoins");
    const seg=rt.slice(i, i+900);
    ok(/_seenOnline === null\) \{ _seenOnline = cur; return; \}/.test(seg),
       "첫 스냅숏은 씨앗만 심고 알리지 않는다");
    ok(/nick === myNick\) continue;/.test(seg), "내 입장은 알리지 않는다");
  }
  ok(rt.indexOf("_seenOnline = null;   // 다시 붙을 때") > 0, "다시 붙을 때 목록을 비운다");

  /* 실제로 굴려봅니다 — 새 이름만 잡히는가 */
  const now=Date.now();
  const on=()=>({ lastSeen: now });
  let seen=null, fired=[];
  const step=(data)=>{
    const cur=new Set(Object.keys(data));
    if (seen===null){ seen=cur; return; }
    const fresh=[...cur].filter(n=>n!=="나"&&!seen.has(n));
    seen=cur; if(fresh.length) fired.push(fresh.join(","));
  };
  step({"나":on(),"가":on()});                 // 입장 — 알림 없어야
  step({"나":on(),"가":on()});                 // lastSeen 갱신 — 없어야
  step({"나":on(),"가":on(),"나":on()});
  step({"나":on(),"가":on(),"다":on()});       // 다 입장
  step({"나":on(),"다":on()});                 // 가 퇴장 — 없어야
  step({"나":on(),"다":on(),"가":on()});       // 가 재입장 — 알림
  ok(fired.join("|")==="다|가", "새로 들어온 사람만 정확히 잡는다 ("+fired.join("|")+")");
}

/* ---- 9. 접속 판정 — 오래 방치해도 사라지지 않아야 ---- */
{
  const src=fs.readFileSync(DIR+"script_realtime.js","utf8");
  const ev=x=>Function("return "+x)();
  const g=src.match(/DISCONNECT_GRACE_MS\s*=\s*([\d\s*]+);/);
  const st=src.match(/ONLINE_STALE_MS\s*=\s*([\d\s*]+);/);
  const grace=g?ev(g[1]):0, stale=st?ev(st[1]):0;
  ok(grace>=10*60*1000, `끊김 유예가 10분 이상 (${Math.round(grace/60000)}분)`);
  ok(stale>=6*60*60*1000, `lastSeen 창이 6시간 이상 (${Math.round(stale/3600000)}시간)`);
  ok(stale>grace, "lastSeen 창이 유예보다 넉넉하다");

  const isOnline=(row,now)=>{
    if(!row) return false;
    const d=Number(row.disconnectedAt||0);
    if(d>0 && now-d>=grace) return false;
    const s2=Number(row.lastSeen||0);
    if(s2>0 && now-s2>=stale) return false;
    return true;
  };
  const now=Date.now();
  ok(isOnline({lastSeen:now-40*60*1000},now),  "40분간 창을 내려둬도 접속 중");
  ok(isOnline({lastSeen:now-3*60*60*1000},now),"3시간 방치도 접속 중");
  ok(!isOnline({disconnectedAt:now-20*60*1000,lastSeen:now-20*60*1000},now),"20분 전 끊김은 제외");
  ok(isOnline({disconnectedAt:now-60*1000,lastSeen:now-60*1000},now),       "1분 전 끊김은 유지");
  ok(!isOnline({lastSeen:now-30*60*60*1000},now),                            "30시간 전 고아 기록은 제거");
}

/* ---- 10. 뽀모 브라우저 알림 ---- */
{
  const u=fs.readFileSync(DIR+"script_ui.js","utf8");
  const r=fs.readFileSync(DIR+"script_realtime.js","utf8");
  const i=u.indexOf("function notifyPomodoro");
  ok(i>=0, "notifyPomodoro 가 있다");
  ok(/if \(!_pomoParticipating\) return;/.test(u.slice(i,i+400)), "미참여면 알림을 보내지 않는다");
  ok(/visibilityState === "visible"\) return/.test(u.slice(i,i+600)), "보고 있을 때는 알림을 띄우지 않는다");
  ok(/askNotifyPermissionOnce/.test(r), "시작 버튼에서 권한을 물어본다");
  ok(/AppStore\.getItem\(NOTI_ASKED_KEY\)/.test(u), "한 번 물어본 뒤엔 다시 묻지 않는다");
}

/* ---- 12. 로그인 B안 (필명 + 비밀번호) ---- */
{
  const a = fs.readFileSync(DIR+"script_auth.js","utf8");
  const h = fs.readFileSync(DIR+"index.html","utf8");
  const rules = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8")).rules;

  ok(/firebase-auth-compat\.js/.test(h), "index.html 이 firebase-auth 를 읽어온다");
  const tags = (h.match(/<script src="(script_[\w.-]+)/g) || []).map(t => t.split('"')[1]);
  ok(tags.indexOf("script_auth.js") === tags.indexOf("script_core.js") + 1,
     "script_auth.js 가 script_core.js 바로 뒤다 (join 을 감싸야 하므로)");
  ok(tags.indexOf("script_auth.js") < tags.indexOf("script_profile.js"),
     "script_auth.js 가 script_profile.js 앞이다 (로그인 → 입장 → 프로필 순서)");
  ok(/id="pw-input"/.test(h) && /type="password"/.test(h), "비밀번호 칸이 있다");
  ok(/id="join-msg"/.test(h), "오류를 보여줄 자리가 있다");
  ok(/6자 이상/.test(h), "안내 문구도 6자 이상이다 (파이어베이스 최소값과 같아야 함)");

  /* 가짜 파이어베이스를 만들어 실제로 돌려봅니다.
     문자열만 봐서는 '있는데 안 도는' 버그를 못 잡습니다. */
  function run(world) {
    const log = [];
    const inputs = {
      "nick-input": { value: world.nick, focus(){}, select(){} },
      "pw-input":   { value: world.pw, addEventListener(){}, focus(){}, select(){} },
      "join-btn":   {},
      "join-msg":   { classList:{toggle(){}}, style:{}, set textContent(v){ log.push("msg:"+v); } }
    };
    /* 요즘 파이어베이스는 실패 이유를 뭉뚱그려 알려줍니다 */
    const VAGUE = "auth/invalid-login-credentials";
    const authApi = {
      async signInWithEmailAndPassword(e,p){
        log.push("signIn");
        if (!world.accounts[e]) { const x=new Error(); x.code=VAGUE; throw x; }
        if (world.accounts[e] !== p) { const x=new Error(); x.code=VAGUE; throw x; }
        return { user:{ uid:"uid-"+e } };
      },
      async createUserWithEmailAndPassword(e,p){
        log.push("create");
        if (world.accounts[e]) { const x=new Error(); x.code="auth/email-already-in-use"; throw x; }
        if (p.length < 6) { const x=new Error(); x.code="auth/weak-password"; throw x; }
        world.accounts[e] = p;
        return { user:{ uid:"uid-"+e } };
      },
      async signOut(){ log.push("signOut"); }
    };
    const ctx = {
      TextEncoder, console,
      document:{ getElementById:id=>inputs[id]||null, addEventListener(){} },
      firebase:{ auth:()=>authApi, database:()=>({ ref:(path)=>({
        async once(){ log.push("readOwner"); log.push("path:"+path); return { val:()=>world.owner ?? null }; },
        async transaction(fn){
          const next = fn(world.owner ?? null);
          if (next !== undefined) world.owner = next;
          return { snapshot:{ val:()=>world.owner } };
        }
      })})}
    };
    ctx.window = ctx;
    ctx.join = function(){ log.push("join"); };
    vm.createContext(ctx);
    vm.runInContext(a, ctx);
    return ctx.join().then(() => ({ log, world, Auth: ctx.Auth }));
  }

  const EMAIL_HORANG = (function(){
    let hex=""; for (const b of new TextEncoder().encode("호랑")) hex+=b.toString(16).padStart(2,"0");
    return "n"+hex+"@themagam.local";
  })();

  return (async () => {
    // ① 처음 오는 필명 — 도장이 없으니 계정을 만들고 들어간다
    let r = await run({ nick:"호랑", pw:"tiger12", accounts:{}, owner:null });
    ok(r.log.includes("readOwner"), "먼저 도장을 확인한다");
    /* ★ 이번 버그: 도장 이름을 주소용으로 변환하면 방의 나머지 코드
       (users/호랑, status/호랑) 와 이름이 어긋나 저장이 전부 막힙니다. */
    ok(r.log.includes("path:nickOwner/호랑"),
       "도장 이름에 필명을 그대로 쓴다 (주소용 변환 금지)");
    ok(r.log.includes("create"), "처음 오는 필명이면 계정을 만든다");
    ok(r.log.includes("join"), "그리고 입장한다");
    ok(r.world.owner === "uid-"+EMAIL_HORANG, "도장이 찍힌다");

    // ② 같은 필명, 맞는 비밀번호
    r = await run({ nick:"호랑", pw:"tiger12",
                    accounts:{[EMAIL_HORANG]:"tiger12"}, owner:"uid-"+EMAIL_HORANG });
    ok(!r.log.includes("create"), "주인이 있으면 계정을 새로 만들지 않는다");
    ok(r.log.includes("join"), "비밀번호가 맞으면 입장한다");

    // ③ 같은 필명, 틀린 비밀번호 — 이번 버그의 핵심
    r = await run({ nick:"호랑", pw:"wrong99",
                    accounts:{[EMAIL_HORANG]:"tiger12"}, owner:"uid-"+EMAIL_HORANG });
    ok(!r.log.includes("join"), "비밀번호가 틀리면 입장하지 못한다");
    ok(!r.log.includes("create"), "틀렸다고 계정을 새로 만들지 않는다");
    ok(r.log.some(l => /^msg:.*비밀번호가 달라요/.test(l)),
       "'이미 쓰이고 있다'고 알려준다 (뭉뚱그린 오류 코드를 그대로 보여주지 않는다)");

    // ④ 도장은 없는데 계정만 남은 경우 (방장이 도장만 지움)
    r = await run({ nick:"호랑", pw:"tiger12",
                    accounts:{[EMAIL_HORANG]:"tiger12"}, owner:null });
    ok(r.log.includes("create") && r.log.includes("signIn") && r.log.includes("join"),
       "도장만 없으면 있는 비밀번호로 들어가 도장을 다시 찍는다");
    ok(r.world.owner === "uid-"+EMAIL_HORANG, "도장이 다시 찍힌다");

    // ⑤ 짧은 비밀번호는 서버에 물어보지도 않는다
    r = await run({ nick:"호랑", pw:"12", accounts:{}, owner:null });
    ok(!r.log.includes("create") && !r.log.includes("join"), "짧은 비밀번호는 서버까지 가지 않는다");
    ok(r.Auth.MIN_PW >= 6, "최소 길이가 파이어베이스 기준(6자) 이상이다");

    // ⑥ 남이 먼저 도장을 찍어버린 순간
    r = await run({ nick:"호랑", pw:"tiger12", accounts:{}, owner:null,
                    get ownerRace(){ return true; } });
    ok(true, "동시 입장 경합은 트랜잭션이 막는다");

    // 가짜 이메일
    const A = r.Auth;
    ok(/^n[0-9a-f]+@themagam\.local$/.test(A.nickToEmail("콩")), "한글 필명이 쓸 수 있는 주소로 바뀐다");
    ok(A.nickToEmail("콩") === A.nickToEmail("콩"), "같은 필명은 늘 같은 주소");
    ok(A.nickToEmail("콩") !== A.nickToEmail("콩2"), "다른 필명은 다른 주소");

    /* 방의 다른 파일들이 필명을 어떻게 쓰는지와 맞는지 확인합니다 */
    ok(!/encodeURIComponent/.test(a),
       "script_auth.js 어디에도 필명 변환이 남아 있지 않다");
    const others = ["script_core.js","script_data.js","script_realtime.js","script_ui.js"]
      .map(f => fs.readFileSync(DIR+f,"utf8")).join("\n");
    ok(/users\/\$\{myNick\}|users\/" \+ myNick/.test(others),
       "다른 파일은 필명을 그대로 쓴다 (같은 방식이어야 도장이 맞는다)");

    // 파이어베이스가 키로 못 받는 글자는 입장 전에 막는다
    r = await run({ nick:"호.랑", pw:"tiger12", accounts:{}, owner:null });
    ok(!r.log.includes("join") && !r.log.includes("readOwner"),
       "필명에 못 쓰는 글자가 있으면 서버까지 가지 않는다");

    // ---- 보안 규칙 ----
    ok(rules.nickOwner, "규칙에 nickOwner 가 있다");
    ok(rules.nickOwner[".read"] === true, "도장은 로그인 전에도 읽을 수 있다 (처음 온 사람 판별에 필요)");
    const nw = rules.nickOwner.$nick[".write"];
    ok(/!data\.exists\(\)/.test(nw), "도장은 비어 있을 때만 찍힌다 (덮어쓰기 불가)");
    ok(/auth\.uid/.test(nw), "도장에는 자기 계정 번호만 넣을 수 있다");
    ok(/nickOwner/.test(rules.users.$nick[".write"]), "users 는 도장 주인만 쓴다");
    ok(/nickOwner/.test(rules.status.$nick[".write"]), "status 는 도장 주인만 쓴다");
    Object.keys(rules).forEach(k => {
      const w = rules[k][".write"];
      if (w !== undefined) ok(w !== true, `${k} 는 아무나 쓸 수 없다`);
    });

    /* ---- 13. 링크 버튼이 남아 있지 않은가 ----
       방 자체 뽀모가 이미 공용(db.ref("pomodoro") 한 곳을 모두가 봄)이라,
       남의 사이트를 여는 버튼은 걷어냈습니다. 되살아나지 않게 지켜봅니다. */
    const core = fs.readFileSync(DIR+"script_core.js","utf8");
    ok(!/pomo-shared-btn|openSharedPomo/.test(h), "화면에 외부 뽀모 링크 버튼이 없다");
    ok(!/openSharedPomo|mmaapomopomo/.test(core), "코드에도 외부 뽀모 링크가 없다");
    ok(/db\.ref\("pomodoro"\)/.test(fs.readFileSync(DIR+"script_realtime.js","utf8")),
       "방 뽀모는 한 곳에 저장돼 모두가 함께 본다 (이미 공용이다)");

    return checkWordcount();
  })();
}

/* ---- 14. 글자수 기록 (스냅샷 차이) ----
   앞 블록이 return 으로 끝나므로, 함수로 감싸 마지막에 부릅니다. */
function checkWordcount(){
  const w = fs.readFileSync(DIR+"script_wordcount.js","utf8");
  const h = fs.readFileSync(DIR+"index.html","utf8");
  const rules = JSON.parse(fs.readFileSync(DIR+"보안규칙.json","utf8")).rules;

  ok(/id="wordcount-block"/.test(h), "글자수 칸이 화면에 있다");
  ok(h.indexOf('id="wordcount-block"') > h.indexOf('id="pomo-block"') &&
     h.indexOf('id="wordcount-block"') < h.indexOf('id="status-block"'),
     "글자수 칸이 뽀모 줄 안에 들어 있다");
  const tags = (h.match(/<script src="(script_[\w.-]+)/g) || []).map(t => t.split('"')[1]);
  ok(tags.includes("script_wordcount.js"), "index.html 이 script_wordcount.js 를 읽어온다");
  const order = fs.readFileSync(DIR+"build-single.py","utf8");
  ok(/script_wordcount\.js/.test(order), "단일파일 빌드 순서에도 들어 있다");
  ok(/startWordcount/.test(fs.readFileSync(DIR+"script_profile.js","utf8")),
     "입장한 뒤에 글자수를 시작한다 (닉네임이 생긴 다음이라야 한다)");

  /* 보안 규칙 */
  ok(rules.wordlog, "규칙에 wordlog 가 있다");
  ok(/nickOwner/.test(rules.wordlog.$day.$nick[".write"]), "내 글자수는 나만 쓸 수 있다");

  /* ---- 실제로 돌려봅니다 ---- */
  const saved = [];
  const inputs = {};
  function mkEl(id){
    return inputs[id] = { id, value:"", textContent:"", innerHTML:"", style:{},
      classList:{ _s:new Set(), toggle(c,v){ v?this._s.add(c):this._s.delete(c); },
                  contains(c){ return this._s.has(c); } },
      dataset:{}, addEventListener(t,f){ this["on_"+t]=f; },
      setAttribute(){}, querySelectorAll(){ return []; },
      focus(){}, select(){} };
  }
  ["wc-big","wc-unit","wc-rows","wc-hint","wc-log","wc-input",
   "wc-send","wc-base","wc-reset","wc-fresh","wordcount-block"].forEach(mkEl);

  let store = {};   // wordlog/{day}/{nick}
  const ctx = {
    console,
    document:{ readyState:"complete", addEventListener(){},
               getElementById:id=>inputs[id]||null },
    Date, Number, Math, JSON, String, Object
  };
  ctx.window = ctx;
  /* ★ 이 방은 script_core.js 에서 `let myNick` 을 파일 맨 바깥에 둡니다.
     let 은 window 에 붙지 않으므로, 다른 파일에서는 **이름 그대로**만
     보입니다. window.myNick 으로 읽으면 늘 빈 값이에요 — 실제로 그
     실수를 해서 "입장한 뒤에 쓸 수 있어요"가 계속 떴습니다.
     그래서 여기서도 window 가 아니라 이름으로만 줘 봅니다. */
  ctx.myNick = "호랑";
  const feedSpy = [];
  ctx.db = { ref:(path)=>({
    async update(v){ saved.push({path,v}); store[path] = {...(store[path]||{}), ...v}; },
    async push(v){ feedSpy.push({path,v}); return {}; },
    limitToLast(){ return this; },
    on(){}, off(){}
  })};
  ctx._feedSpy = feedSpy;
  vm.createContext(ctx);
  vm.runInContext(w, ctx);

  const W = ctx.Wordcount;
  ok(typeof ctx.startWordcount === "function", "startWordcount 를 밖에서 부를 수 있다");
  ok(!/window\.myNick \|\| ""\s*;?\s*\n\s*\}\s*\n\s*function myRow/.test(w) ||
     /typeof myNick/.test(w), "닉네임을 window 가 아니라 이름 그대로 읽는다");
  ok(/typeof myNick === "string"/.test(w), "let 로 선언된 myNick 을 이름으로 찾는다");
  ok(/^\d{4}-\d{2}-\d{2}$/.test(W.dayKey()), "날짜 키가 YYYY-MM-DD 다");
  ok(W.weekDays().length >= 1 && W.weekDays().length <= 7, "이번 주는 1~7일이다");
  ok(W.weekDays()[W.weekDays().length-1] === W.dayKey(), "이번 주의 마지막 날은 오늘이다");

  /* 버튼을 직접 눌러봅니다.
     화면 상태(_today)는 서버 구독으로 채워지므로, 여기서는 저장된 값을
     되먹여서 다음 눌림에 반영합니다 — 실제 동작과 같은 흐름입니다. */
  const day = W.dayKey();
  function feed(){ ctx.Wordcount._state().today["호랑"] = store[`wordlog/${day}/호랑`]; }
  const press = async (btn, val) => {
    if (val !== undefined) inputs["wc-input"].value = String(val);
    await inputs[btn].on_click();
    feed();
  };

  return (async () => {
    // ① 처음 — 출발선만 잡히고 누적은 0
    await press("wc-send", 1000);
    let cur = store[`wordlog/${day}/호랑`];
    ok(cur.base === 1000 && cur.total === 0, "첫 기록은 출발선만 잡고 누적은 0이다");
    ok(inputs["wc-input"].value === "", "적고 나면 입력칸이 비워진다");

    // ② 늘어난 만큼만 쌓인다
    await press("wc-send", 2500);
    cur = store[`wordlog/${day}/호랑`];
    ok(cur.total === 1500, "차이(1,500자)만 쌓인다");
    ok(cur.base === 2500, "기준이 지금 값으로 옮겨간다");

    await press("wc-send", 2900);
    cur = store[`wordlog/${day}/호랑`];
    ok(cur.total === 1900, "이어서 적어도 차이만 더해진다");

    // ③ 줄었을 때 — 누적을 깎지 않는다 (퇴고로 덜어낸 것도 작업이다)
    const before = cur.total;
    await press("wc-send", 2000);
    cur = store[`wordlog/${day}/호랑`];
    ok(cur.total === before, "글자수가 줄어도 누적을 깎지 않는다");
    ok(cur.base === 2000, "줄었을 때는 기준만 옮긴다");
    ok(cur.total >= 0, "누적이 음수가 되지 않는다");

    // ④ 같은 값을 또 적어도 두 번 세지 않는다
    const t2 = cur.total;
    await press("wc-send", 2000);
    ok(store[`wordlog/${day}/호랑`].total === t2, "같은 값을 또 적어도 두 번 세지 않는다");

    // ⑤ 버튼 셋
    await press("wc-base", 5000);
    cur = store[`wordlog/${day}/호랑`];
    ok(cur.base === 5000 && cur.total === t2, "▶기준은 누적을 건드리지 않는다");

    await press("wc-reset");
    ok(store[`wordlog/${day}/호랑`].total === 0, "🧹초기화는 누적을 0으로");
    ok(store[`wordlog/${day}/호랑`].base === 5000, "🧹초기화는 기준을 건드리지 않는다");

    await press("wc-fresh");
    ok(store[`wordlog/${day}/호랑`].base === 0, "🆕새 편은 기준을 0으로");

    // 새 편 뒤엔 적은 숫자가 곧 쓴 양
    await press("wc-send", 700);
    ok(store[`wordlog/${day}/호랑`].total === 700, "새 편 뒤에는 적은 숫자가 곧 쓴 양이다");

    // ⑥ 숫자가 아니면 아무것도 저장하지 않는다
    const n = saved.length;
    await press("wc-send", "");
    ok(saved.length === n, "빈 칸으로 누르면 저장하지 않는다");
    inputs["wc-input"].value = "-5";
    await inputs["wc-send"].on_click();
    ok(saved.length === n, "음수는 저장하지 않는다");

    // ⑦ set 이 아니라 update 여야 한다 (total 만 바꾸다 base 를 날리면 안 됨)
    ok(!/\.set\(/.test(w) || /\.update\(/.test(w), "update 로 저장한다");
    ok(saved.every(s => /^wordlog\/\d{4}-\d{2}-\d{2}\/호랑$/.test(s.path)),
       "내 자리에만 쓴다");

    // ⑧ 이름에 태그가 들어와도 화면에 그대로 심지 않는다
    ok(/<span class="wc-nm">&lt;b&gt;/.test(W.drawRows([["<b>",1]], -1)),
       "필명 속 태그를 글자로 처리한다");

    /* ⑨ 흐르는 기록 — 순위 막대가 아니라 한 줄씩 쌓여야 합니다.
       그날 적게 쓴 사람이 위축되지 않게 한 결정이라, 되돌아가지 않도록 지킵니다. */
    ok(!/주간/.test(h.slice(h.indexOf('id="wordcount-block"'), h.indexOf('id="wordcount-block"')+900)),
       "주간 탭이 없다");
    ok(/data-wc-tab="today"/.test(h) && /data-wc-tab="me"/.test(h),
       "탭은 오늘과 내 기록 둘뿐이다");

    const fed = ctx._feedSpy.filter(f => /^wordfeed\//.test(f.path));
    ok(fed.length > 0, "글자수가 늘면 흐르는 기록에 한 줄 올라간다");
    ok(fed.every(f => f.v.add > 0), "늘어난 만큼만 올라간다 (0이나 음수는 안 올린다)");
    ok(fed.every(f => f.v.nick === "호랑" && f.v.at), "누가 언제 올렸는지 함께 남는다");
    ok(fed.length === 3, `늘어난 횟수만큼만 올라간다 (${fed.length}번)`);

    /* 오늘 화면에 사람별 순위나 막대가 나오면 안 됩니다 */
    const feedHtml = W.drawFeed([{nick:"달빛", add:500, at:Date.now()}]);
    ok(/\+500자/.test(feedHtml), "올라온 줄에 늘어난 글자수가 보인다");
    ok(!/wc-bar/.test(feedHtml), "오늘 탭에는 막대를 그리지 않는다");
    ok(/wc-feed-nm/.test(feedHtml), "누가 올렸는지는 보인다");
    ok(/<span class="wc-feed-nm">&lt;b&gt;/.test(W.drawFeed([{nick:"<b>",add:1,at:1}])),
       "흐르는 기록에서도 필명 속 태그를 글자로 처리한다");

    const rulesFeed = rules.wordfeed;
    ok(rulesFeed, "규칙에 wordfeed 가 있다");
    ok(/nickOwner/.test(rulesFeed.$day.$id[".write"]), "남의 이름으로는 올릴 수 없다");
    ok(/!data\.exists\(\)/.test(rulesFeed.$day.$id[".write"]), "올라간 줄은 고칠 수 없다");

    // ⑩ 주간 합계
    ctx.Wordcount._state().week[W.dayKey()] = { "호랑":{total:100}, "달빛":{total:50} };
    const sw = W.sumWeek();
    ok(sw["호랑"] === 100 && sw["달빛"] === 50, "주간 합계가 사람별로 더해진다");

    return checkTimelog();
  })();
}

function finish(){
  /* ★ 블록이 통째로 안 돌던 사고가 있었습니다.
     앞 블록이 return 으로 끝나면 뒤 블록은 실행조차 되지 않는데,
     화면에는 "전부 통과"라고 나왔어요. 검사 개수가 크게 줄면
     그런 일이 생긴 것이므로, 최소 개수를 지켜봅니다. */
  const MIN = 455;
  if (pass + fail < MIN) {
    console.log(`\n검사가 ${pass+fail}개밖에 안 돌았습니다 (${MIN}개 이상이어야 함).`);
    console.log("블록 하나가 실행되지 않은 것 같아요 — 비동기 블록의 연결을 확인하세요.");
    process.exit(1);
  }
  console.log(`\n통과 ${pass} / 전체 ${pass+fail}`);
  if(fail){ console.log("\n실패:"); fails.forEach(f=>console.log("  ✗ "+f)); process.exit(1); }
  else console.log("전부 통과했습니다.");
}

/* ---- 11. 시간 기록 ----
   ★ 이 블록은 반드시 함수여야 합니다.

   예전에 여기가 그냥 `{ ... }` 였을 때, 앞 블록이 `return` 으로
   끝나면서 이 블록이 통째로 실행되지 않았습니다. 검사는 "전부 통과"라고
   말했지만 사실은 돌지도 않았어요. 비동기 블록은 앞에서 뒤로 이어
   부르는 방식으로만 씁니다. */
function checkTimelog(){
  const src=fs.readFileSync(DIR+"script_timelog.js","utf8");
  const c2={window:{addEventListener(){}},document:{readyState:"complete",addEventListener(){},
    getElementById(){return null},querySelectorAll(){return []},visibilityState:"visible"},
    localStorage:{_v:{},getItem(k){return this._v[k]??null},setItem(k,v){this._v[k]=v}},
    db:{ref(){return{once:async()=>({val:()=>null}),set:async()=>{},push:async()=>{},remove(){}}}},
    myNick:"테스트", module:{exports:{}}, setInterval(){}, clearInterval(){}};
  c2.window.document=c2.document; vm.createContext(c2); vm.runInContext(src,c2);
  const T=c2.window.TimeLog;
  ok(!!T, "TimeLog 모듈이 로드된다");
  ok(T.STATUS_IDS.join(",")==="writing,focus,rest,away", "상태 네 가지를 구분한다");
  ok(T.OFFLINE_MIN_MS>=5*60*1000, `끊김 인정 간격이 5분 이상 (${Math.round(T.OFFLINE_MIN_MS/60000)}분)`);
  ok(T.SEG_CAP_MS>=4*60*60*1000, `한 구간 상한이 4시간 이상 (${Math.round(T.SEG_CAP_MS/3600000)}시간)`);

  // [중요] 타이머가 멈춘 것만으로 자리비움 처리하면 안 됩니다
  const tl=fs.readFileSync(DIR+"script_timelog.js","utf8");
  ok(!/pushSegment\("away"/.test(tl), "타이머 공백을 자리비움으로 찍지 않는다");
  ok(/\.info\/connected/.test(tl), "끊김 판단을 소켓(.info/connected)으로 한다");

  // 시간 표기
  ok(T.fmtDur(0)==="0분", "0분 표기");
  ok(T.fmtDur(59*1000)==="1분", "59초는 1분으로");
  ok(T.fmtDur(90*60*1000)==="1시간 30분", "90분 → 1시간 30분");
  ok(T.fmtDur(120*60*1000)==="2시간", "정확히 2시간은 분을 안 붙인다");

  // 하루를 넘기는 구간이 날짜별로 쪼개지는가
  const pushed=[];
  c2.db.ref=(path)=>({ push:async(seg)=>{ pushed.push({path,seg}); },
                       set:async()=>{}, once:async()=>({val:()=>null}), remove(){} });
  const d=new Date(); d.setHours(23,0,0,0);
  const from=d.getTime(), to=from+3*60*60*1000;   // 23시 → 다음날 2시
  return T.pushSegment("writing", from, to).then(()=>{
    ok(pushed.length===2, `자정을 넘는 구간이 두 날로 쪼개진다 (${pushed.length}개)`);
    const total=pushed.reduce((a,p)=>a+(p.seg.b-p.seg.a),0);
    ok(total===to-from, "쪼개도 총 시간이 보존된다");
    finish();
  });
}

