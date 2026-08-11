/* TheMagam © 그링링 · 무단 복제·재배포 금지 */

  function num(v) {
    const n = parseInt(String(v || "0"), 10);
    return Number.isFinite(n) ? n : 0;
  }

  // =====================================================
  // ✅ Theme per nick (Firebase + local fallback)
  // =====================================================
  function _themeLocalKey() {
    return myNick ? `writerTheme_${myNick}` : "writerTheme";
  }

  async function loadThemeForNick() {
    // 1) Firebase 우선
    if (myNick) {
      try {
        const snap = await db.ref(`users/${myNick}/prefs/themeName`).once("value");
        const themeName = snap.val();
        if (themeName) {
          AppStore.setItem(_themeLocalKey(), String(themeName));
          window.applyTheme?.(String(themeName));
          return;
        }
      } catch (e) {}
    }

    // 2) localStorage fallback
    const local = AppStore.getItem(_themeLocalKey()) || AppStore.getItem("writerTheme");
    if (local) window.applyTheme?.(local);
  }

  async function saveThemeForNick(themeName) {
    const name = String(themeName || "").trim();
    if (!name) return;

    AppStore.setItem(_themeLocalKey(), name);

    if (myNick) {
      try {
        await db.ref(`users/${myNick}/prefs/themeName`).set(name);
      } catch (e) {}
    }
  }

  // 외부(테마 선택 UI)에서 바로 쓰게 export
  window.loadThemeForNick = loadThemeForNick;
  window.saveThemeForNick = saveThemeForNick;

  /* [뺌 2026-08-09] 화면에 안 보이던 할 일 칸(#todo-block) 을 걷어내면서,
     그 DOM 만 그리던 함수 여덟도 함께 없앴습니다.
       todoDueBadgeInfo · _closeAllTodoMenus · _openTodoMenuSmart ·
       renderTodoList · _closeTodoDuePicker · openTodoDuePicker ·
       bindTodoInputEnter · addTodoFromUI

     그 칸은 화면 배치 목록(PANELS)에 없어서 보관함으로 치워진 뒤 다시
     나오지 않았습니다. 카드 아래칸 팝업이 잠깐 꺼내 쓰던 것이 마지막
     쓰임이었는데, 그 팝업마저 없어지면서 완전히 죽어 있었어요.
     할 일을 그리는 일은 이제 script_mywork.js 한 곳이 맡습니다.

     자료를 다루는 함수(addTodoWithDue · toggleTodo · editTodo · deleteTodo ·
     clearCompletedTodos · todosForProfileList …)는 그대로 남습니다 —
     화면과 상관없이 값을 만지는 쪽이라 여전히 쓰입니다. */

  // =====================================================
  // ✅ Todo state in UI memory
  // =====================================================
  function getTodoItemsFromUI() {
    return window._todoItems || [];
  }

  /* ★ [2026-08-11] "날짜 없는 할 일" 칸이 [🔁 루틴 (매일 반복)] 으로
       바뀌었습니다. 그 칸에 들어가는 건 이제 전부 매일 반복이에요.

       그런데 예전에 그 칸에 넣어 둔 할 일들은 routine 표시가 없습니다.
       그대로 두면 루틴 칸에 앉아 있으면서 자정에 안 풀리고, 🔁 켜는
       단추도 없어졌으니 **되살릴 방법이 없는** 상태가 됩니다.

       그래서 여기서 한 번 훑어 붙입니다 — 날짜가 없으면 루틴으로.
       (날짜가 붙은 할 일은 손대지 않습니다)
       고쳐 놓은 값은 다음 저장 때 서버에도 함께 올라갑니다. */
  function _normalizeRoutineTodos(items) {
    const today = ymd(Date.now());
    return (Array.isArray(items) ? items : []).map(x => {
      if (!x) return x;

      /* ① 날짜 없는 옛 할 일 → 루틴으로 */
      let y = (!x.routine && !isTodoDue(x.due)) ? { ...x, routine: true } : x;

      /* ② 어제 체크해 둔 루틴 → 체크 풀기 */
      if (y.routine && y.done && y.doneDay !== today) y = { ...y, done: false, doneDay: "" };

      return y;
    });
  }

  function setTodoItemsToUI(items) {
    window._todoItems = _normalizeRoutineTodos(items);

    /* 할 일이 바뀌면 🗂️ 나의 작업 창의 달력·목록도 함께 바뀌어야 합니다.
       (날짜가 붙은 할 일을 거기서 날짜별로 보여주니까요)
       창이 닫혀 있으면 script_mywork.js 쪽이 알아서 아무것도 안 합니다. */
    try { window.renderMyWorkIfOpen?.(); } catch (e) {}
  }

  // =====================================================
  // ✅ 투두 날짜(due) — 있어도 되고 없어도 되는 선택 필드
  // =====================================================
  /* 항목에 `due: "YYYY-MM-DD"` 를 붙일 수 있습니다. 없는 항목은 예전과
     똑같이 동작합니다(필드 자체가 아예 없어요).

     [반복(🔁)과 날짜는 함께 쓰지 않습니다 — 한쪽을 켜면 다른 쪽이 꺼집니다]
     반복은 "매일 새로 뜨는 일", 날짜는 "그 하루에 하는 일"이라 성격이
     정반대입니다. 둘을 함께 두면 자정에 체크가 풀리면서 달력에 박힌
     그 하루가 영영 "지난 미완료"로 붉게 남습니다. 그래서 날짜를 고르면
     반복이 풀리고, 반복을 켜면 날짜가 지워집니다. */
  const DUE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function isTodoDue(v) {
    return typeof v === "string" && DUE_RE.test(v);
  }

  /** 오늘부터 며칠 뒤인가 (어제면 -1, 오늘이면 0) */
  function _todoDueDiff(due) {
    const a = new Date(due + "T00:00:00");
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return Math.round((a.getTime() - t.getTime()) / 86400000);
  }


  window.isTodoDue = isTodoDue;

  /* [2026-08-06] 프로필 팝업의 투두 목록은 **오늘 것과 날짜 없는 것**만
     보여줍니다.

     [왜] 날짜(due)를 붙일 수 있게 되면서, 다음 달에 할 일까지 이 짧은
     목록에 전부 쌓였습니다. 정작 오늘 할 일이 아래로 밀려 안 보였어요.
     그래서 여기는 "오늘의 창"으로 좁힙니다.

         due === 오늘   → 보임
         due 없음       → 보임 (🔁 반복도 여기 — 반복은 날짜를 못 가집니다)
         그 밖의 날짜   → 안 보임 (그날이 되면 저절로 뜹니다)

     다른 날짜의 할 일은 🗂️ 나의 작업 창의 달력에서 날짜별로 봅니다.
     지운 게 아니라 **가려둔 것뿐**이라, 저장·수정은 예전 그대로입니다. */
  function todosForProfileList() {
    const today = ymd(Date.now());
    return getTodoItemsFromUI().filter(x => {
      if (!x) return false;
      if (x.archived) return false;               // 치운 것은 여기선 감춥니다
      if (x.routine) return true;                 // 반복은 늘 보입니다
      if (!isTodoDue(x.due)) return true;         // 날짜 없는 것도 늘
      return x.due === today;                     // 날짜가 있으면 오늘 것만
    });
  }
  window.todosForProfileList = todosForProfileList;
  // =====================================================
  // ✅ 날짜 고르는 줄 (항목 바로 아래에 잠깐 열리는 <input type="date">)
  // =====================================================
  /* prompt("2026-08-07 처럼 적어주세요") 는 휴대폰에서 특히 괴롭습니다.
     달력이 뜨는 <input type="date"> 를 항목 아래에 끼워 넣고, 고르는
     즉시 저장한 뒤 줄을 걷습니다. 취소도 됩니다. */

  /** 날짜 붙이기 / 떼기 ("" 를 주면 뗍니다) */
  function setTodoDue(id, due) {
    const v = isTodoDue(due) ? due : "";

    const items = getTodoItemsFromUI().map(x => {
      if (x.id !== id) return x;

      const next = { ...x };
      if (v) {
        next.due = v;
        /* 날짜와 반복은 함께 쓰지 않습니다 (위 주석 참고) */
        if (next.routine) { next.routine = false; next.doneDay = ""; }
      } else {
        delete next.due;
      }
      return next;
    });

    /* ★ 2026-08-11 — 여기서 _closeTodoDuePicker() 를 부르고 있었습니다.
       그 함수는 8월 9일에 없앴는데(위 [뺌] 주석 참고) 부르는 쪽만
       남아 있었어요. 이 줄에서 곧바로 멈추니 아래 두 줄이 실행되지
       않았고, 그래서 [오늘 하기] 를 눌러도 아무 일이 없었습니다.
       날짜 팝업이 이미 없으므로 닫을 것도 없습니다 — 줄만 걷습니다. */
    setTodoItemsToUI(items);
    savePersonalData();
  }

  function toggleTodo(id, done) {
    const items = getTodoItemsFromUI().map(x => {
      if (x.id !== id) return x;
      const next = { ...x, done: !!done, doneDay: done ? ymd(Date.now()) : "" };
      /* [추가 2026-08-06] 치워둔 할 일의 체크를 풀면 다시 목록으로.
         "아직 안 한 일"이 감춰진 채로 남으면 잊어버리게 되니까요. */
      if (!done) delete next.archived;
      return next;
    });
    setTodoItemsToUI(items);
    savePersonalDataDebounced();

    /* 🏅 마감러·루틴킹 — 켤 때만 셉니다.
       ★ 껐다 켜기를 되풀이하면 숫자가 부풀 수 있는데, 그건 본인이
         자기 배지를 부풀리는 것뿐이라 남에게 피해가 없습니다.
         막으려고 "완료한 id 목록"을 따로 쌓으면 저장이 그만큼 무거워져서
         그냥 둡니다. */
    if (done) {
      window.achvBump?.("cTodo");
      const t = getTodoItemsFromUI().find(x => x.id === id);
      if (t && t.routine) window.achvBump?.("rout", ymd(Date.now()));
    }
  }

  function toggleRoutineTodo(id) {
    const items = getTodoItemsFromUI().map(x => {
      if (x.id !== id) return x;
      const next = { ...x, routine: !x.routine };
      /* 반복을 켜면 붙어 있던 날짜는 뗍니다 — 둘은 함께 쓰지 않아요 */
      if (next.routine) delete next.due;
      return next;
    });
    setTodoItemsToUI(items);
    savePersonalData();
  }

  function clearCompletedTodos() {
    const items = getTodoItemsFromUI();
    const doneCount = items.filter(x => x.done).length;
    if (!doneCount) { alert("완료된 투두가 없어요!"); return; }
    if (!confirm(
      `완료한 할 일 ${doneCount}개를 목록에서 치울까요?\n\n` +
      `· 이 목록에서만 사라지고, 🗂️ 나의 작업에는 "완료"로 남아요.\n` +
      `· 🔁 반복 할 일은 지워지지 않고 체크만 풀려요.`
    )) return;

    /* [바뀜 2026-08-06] 지우지 않고 **치웁니다**.

       예전에는 완료한 할 일을 목록에서 통째로 지웠습니다. 그런데 그러면
       "그날 무엇을 해냈는지"가 함께 사라졌어요. 이제 archived 표시만
       붙여서, 이 목록(프로필 팝업)에서는 감추되 🗂️ 나의 작업 달력에는
       완료한 채로 남깁니다.

       날짜가 없던 할 일은 끝낸 날(doneDay, 없으면 오늘)을 날짜로 붙여
       그날 칸에 얹습니다. 그래야 "날짜 없는 할 일" 칸이 끝낸 일로
       불어나지 않고, 달력에는 해낸 기록이 쌓입니다. */
    const today = ymd(Date.now());
    const next = items.map(x => {
      if (!x || !x.done) return x;
      /* 반복은 예전처럼 체크만 풀어줍니다 (매일 새로 뜨는 일이니까요) */
      if (x.routine) return { ...x, done: false, doneDay: "" };
      const due = isTodoDue(x.due) ? x.due : (isTodoDue(x.doneDay) ? x.doneDay : today);
      return { ...x, archived: true, due };
    });

    setTodoItemsToUI(next);
    savePersonalData();
  }

  /* 글자만 바꿉니다. 화면에서 부르는 쪽이 이미 새 글을 들고 있을 때 씁니다
     (제자리 편집). 빈 글이면 아무 일도 하지 않아요 — 실수로 다 지우고
     빠져나갔을 때 할 일이 이름 없이 남으면 안 되니까요. */
  function setTodoText(id, text) {
    const t = String(text || "").trim();
    if (!t) return false;
    const items = getTodoItemsFromUI();
    const target = items.find(x => x.id === id);
    if (!target || target.text === t) return false;
    setTodoItemsToUI(items.map(x => x.id === id ? ({ ...x, text: t }) : x));
    savePersonalData();
    return true;
  }

  /* [2026-08-10] prompt() 창을 걷어냈습니다.

     예전에는 ✏️ 를 누르면 브라우저 기본 입력창이 떴습니다. 한 글자만
     고치려 해도 창이 뜨고, 화면이 잠기고, 확인을 눌러야 했어요.
     이제 할 일 글자를 누르면 그 자리에서 고쳐집니다(script_mywork.js).

     이 함수는 남겨 둡니다 — 제자리 편집을 쓸 수 없는 자리(옛 화면·
     좁은 화면)에서 여전히 부를 수 있게. */
  function editTodo(id) {
    const target = getTodoItemsFromUI().find(x => x.id === id);
    if (!target) return;
    const next = prompt("할 일 고치기", target.text || "");
    if (next === null) return;
    setTodoText(id, next);
  }

  function deleteTodo(id) {
    if (!confirm("이 투두를 삭제할까요?")) return;
    const items = getTodoItemsFromUI().filter(x => x.id !== id);
    setTodoItemsToUI(items);
    savePersonalData();
  }

  window.toggleRoutineTodo = toggleRoutineTodo;
  window.clearCompletedTodos = clearCompletedTodos;

  /* [2026-08-06] 🗂️ 나의 작업 창에서 날짜를 붙여 새 할 일을 넣는 창구.

     글자와 날짜를 직접 받습니다. due 가 비어 있으면 "날짜 없는 할 일"이에요.
     (예전에는 화면의 입력칸을 읽어가는 함수뿐이라 다른 창에서 못 썼습니다) */
  function addTodoWithDue(text, due) {
    const t = String(text || "").trim();
    if (!t) return false;

    const item = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      text: t,
      done: false,
      createdAt: Date.now()
    };
    /* 날짜와 반복은 함께 쓰지 않습니다 — 둘 중 하나입니다.
       [2026-08-11] 날짜를 안 주면 곧 "루틴 칸에 넣는다"는 뜻이 되었으므로
       여기서 곧바로 매일 반복으로 만듭니다. (날짜 없는 보통 할 일은
       이제 만들 수 없어요 — 화면에 그런 칸이 없습니다) */
    if (isTodoDue(due)) item.due = due;
    else item.routine = true;

    const items = getTodoItemsFromUI();
    items.unshift(item);
    setTodoItemsToUI(items);
    savePersonalData();
    return true;
  }

  /* 🗂️ 나의 작업 창(script_mywork.js)이 쓰는 창구 모음.
     할 일의 주인은 여기(script_data.js)이므로, 저 창에서는 읽기와
     아래 함수 호출만 합니다 — 저장 로직은 한 곳에만 둡니다. */
  window.getTodoItems = getTodoItemsFromUI;
  window.toggleTodoDone = toggleTodo;
  window.setTodoDue = setTodoDue;
  window.addTodoWithDue = addTodoWithDue;
  window.editTodo = editTodo;
  window.setTodoText = setTodoText;
  window.deleteTodo = deleteTodo;

  // =====================================================
  // ✅ Personal data (Firebase)
  // =====================================================
  /* 저장 직전 청소.

     Firebase 는 값 하나라도 undefined 면 저장 요청 **전체**를 거절합니다.
     due 처럼 "있을 수도 없을 수도" 있는 필드가 생겼으니, 보내기 전에
     undefined·null 을 털어내고 due 는 형식이 맞을 때만 남깁니다.
     (모르는 필드는 건드리지 않고 그대로 옮깁니다 — 나중에 다른 곳에서
      필드를 하나 더 붙여도 여기서 사라지지 않게) */
  function _todosForSave() {
    return getTodoItemsFromUI().map((x, i) => {
      const src = (x && typeof x === "object") ? x : {};
      const out = {};

      Object.keys(src).forEach(k => {
        const v = src[k];
        if (v === undefined || v === null) return;
        if (k === "due") return;                 // due 는 아래에서 따로 검사
        out[k] = v;
      });

      if (isTodoDue(src.due) && !src.routine) out.due = src.due;

      if (!out.id) out.id = `${Date.now()}_${i}`;   // 아주 옛 자료 대비
      out.text = String(out.text == null ? "" : out.text);
      out.done = !!out.done;
      return out;
    });
  }

  /* =====================================================================
     📌 방 전체 할 일 진척 — 개수만 따로 (2026-08-10)
     ---------------------------------------------------------------------
     접속자 명단 아래에 "오늘 할 일 10개 중 4개 완료" 한 줄을 띄우려고,
     내 할 일 **개수**를 todostat/{날짜}/{닉네임} 에 올립니다.

     [왜 status 를 안 쓰고 새 자리를 만들었나]
     status 에도 같은 숫자(todoTotal·todoDone)가 이미 흐릅니다. 그걸
     더하면 규칙을 손댈 필요도 없고 훨씬 간단해요. 그런데 status 는
     **나가면 통째로 지워집니다.** 4개를 끝낸 사람이 퇴근하면 방 전체
     합계가 3개로 **줄어듭니다.** "다 같이 쌓는다"는 느낌을 정면으로
     깨뜨려요 — 글자수가 잘 쓰이는 이유가 바로 그 쌓이는 감각인데,
     여기서 숫자가 내려가면 안 하느니만 못합니다.
     그래서 글자수(wordlog)와 같은 방식으로 하루치를 남깁니다.

     [무엇을 올리나 — 개수뿐입니다]
     total 과 done 두 숫자만. 무엇을 적었는지는 올라가지 않습니다.
     할 일 **내용**은 예전 그대로 users 아래에 잠겨 있고, 본인만 봅니다.

     [세는 규칙]
     카드에 쓰는 것과 똑같이 "오늘 것 + 날짜 없는 것"만 셉니다.
     다음 달 할 일까지 세면 방 전체 숫자가 부풀어요.
     ===================================================================== */
  function _saveTodoStat() {
    if (!myNick || !window.db) return;
    try {
      const day = window.Wordcount?.dayKey?.();
      if (!day) return;                       // 날짜 계산이 아직이면 건너뜁니다
      const list = (typeof todosForProfileList === "function")
        ? todosForProfileList()
        : (Array.isArray(window._todoItems) ? window._todoItems : []);
      const total = list.length;
      const done  = list.filter(x => x && x.done).length;
      db.ref(`todostat/${day}/${myNick}`).set({ total, done, at: Date.now() });
    } catch (e) {}
  }
  window.saveTodoStat = _saveTodoStat;

  /* =====================================================================
     🔁 반복 할 일 — 자정에 실제로 한 번 훑기 (2026-08-10)
     ---------------------------------------------------------------------
     반복 할 일은 "끝낸 날(doneDay)이 오늘이 아니면 체크를 푼다" 는
     규칙으로 돌아갑니다(_normalizeRoutineTodos). 그런데 그 규칙은
     **목록을 다시 읽을 때만** 돌아요. 보통은 다음 날 접속하는 순간이라
     차이가 없지만, **창을 켜둔 채 자정을 넘기면** 어제 체크가 그대로
     남습니다. 가이드에는 "자정에 저절로 풀려요" 라고 적어 두었으니
     말과 실제가 어긋나는 셈이고요.

     방 전체 할 일 진척을 붙이면서 이게 더 걸리게 됐습니다 — 자정을
     넘겨 작업하는 분이 많은 방이라, 새 날 아침 합계가 어제 체크를 물고
     시작할 수 있거든요.

     그래서 1분마다 날짜만 확인하고, 바뀐 그 순간 한 번 훑습니다.
     (덮어놓고 1분마다 저장하지 않습니다. 날짜가 바뀔 때만이에요) */
  let _todoDay = null;

  function _routineMidnightSweep() {
    const day = window.Wordcount?.dayKey?.();
    if (!day) return;
    if (_todoDay === null) { _todoDay = day; return; }   // 처음 한 번은 기준만
    if (_todoDay === day) return;
    _todoDay = day;
    if (!myNick) return;

    const items = getTodoItemsFromUI();
    const hadStale = items.some(x => x && x.routine && x.done);

    /* setTodoItemsToUI 안에서 _normalizeRoutineTodos 가 돌며 체크가 풀립니다 */
    setTodoItemsToUI(items);

    /* 풀린 게 있으면 서버에도 남겨야 합니다 — 안 그러면 다음 접속에
       어제 체크가 되살아납니다. 없으면 개수만 새 날짜 칸으로 옮깁니다. */
    if (hadStale) savePersonalData();
    else _saveTodoStat();

    /* 방 전체 진척도 새 날짜를 보게 다시 붙입니다 —
       안 그러면 어제 숫자를 계속 보여줍니다. */
    try { window.listenRoomTodo?.(); } catch (e) {}
    console.log("[할 일] 날짜가 바뀌어 반복 항목을 훑었습니다 →", day);
  }

  setInterval(_routineMidnightSweep, 60 * 1000);
  /* 절전에서 깨어나거나 탭을 다시 보는 순간에도 한 번 —
     잠든 탭의 setInterval 은 크롬이 늦추거나 멈춥니다. */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") _routineMidnightSweep();
  });

  function savePersonalData() {
    if (!myNick) return;

    const data = {
      todoItems: _todosForSave(),
      todayGoalText: document.getElementById("db-today-goal-text")?.value || "",
      todayDone: document.getElementById("db-today-done")?.value || "",
      statusChoice: document.getElementById("db-status")?.value || "rest"
    };

    /* ✅ [FIX] set() → update()

       set()은 users/{닉} 노드를 통째로 갈아엎습니다. 그래서 목표를 한 글자
       입력하거나 집필 상태를 토글할 때마다 아래 형제 키가 전부 지워졌습니다.

         profile           프사 사진 · 작업 시간대 · 카드 강조색
         prefs / theme     닉 귀속 테마
         soundPrefs        알림음 설정
         pomoParticipation 뽀모 참가 여부
         pomoSessions      오늘 집중 횟수
         dailyLogs         날짜별 기록  ← 연속 출석 업적의 근거
         attend            접속 기록 · 연속 출석 카운터

       바로 다음 줄 saveDailyLog()가 "오늘" 로그만 다시 써주기 때문에
       어제까지의 기록은 복구되지 않았고, 연속 출석이 계속 1일로
       초기화되던 것도 같은 원인입니다.

       update()는 지정한 키만 건드리고 형제는 그대로 둡니다. */
    db.ref("users/" + myNick).update(data);

    /* [2026-08-10] 방 전체 할 일 진척에 쓸 **개수만** 따로 올려 둡니다.
       (자세한 사정은 아래 _saveTodoStat 주석) */
    _saveTodoStat();

    backupLocal();
    saveDailyLog();

    if (typeof updateStatus === "function") updateStatus(true);
  }

  let saveTimeout;
  function savePersonalDataDebounced() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => savePersonalData(), 700);
  }

  /* =====================================================================
     들어올 때 어떤 상태로 시작하는가 (2026-08-10)
     ---------------------------------------------------------------------
     저장된 값을 그대로 쓰지 않고 한 번 걸러 냅니다.

       away · idle · rest · (빈값) → focus (💻JOB💻)
       writing · focus            → 저장된 그대로

     [왜 JOB 인가]
     처음에는 ☕BREAK 로 시작하게 했습니다. "자리에는 있지만 작업 선언은
     아직" 이라는 뜻이라 정직해 보였거든요. 그런데 실제로는 들어오자마자
     바로 쓰기 시작하는 분이 많습니다. 그분들에게는 매번 WORK 를 한 번
     눌러야 하는 일이 생기고, 깜빡하면 **쓴 시간이 통째로 안 쌓입니다.**
     기록이 비는 쪽이 조금 넉넉히 잡히는 쪽보다 훨씬 아파요.

     JOB 은 작업 시간에 포함됩니다(카드의 ⏱ 은 Write + Job 합계).
     그래서 들어온 순간부터 시간이 흐르고, 집필을 시작하면 WORK 로
     바꾸면 됩니다. 정말 자리를 비울 거면 20분 뒤 자동감지가 내려주고요.

     [왜 away 를 그대로 두지 않는가]
     예전 나가기 코드가 away 를 찍어 두어서, 다시 들어와도 💤AWAY 에
     갇히는 일이 있었습니다. 자동감지는 **제가 내린 AWAY** 만 되돌리므로
     이건 손대지 않는 게 맞고요 — 그래서 여기서 걸러 냅니다.
     ===================================================================== */
  function _startStatus(saved) {
    const v = String(saved || "");
    if (v === "writing" || v === "focus") return v;
    return "focus";
  }

  async function loadPersonalData() {
    if (!myNick) return;

    // ✅ 로컬 복구 먼저
    restoreLocal();

    // ✅ 테마도 닉 귀속으로 즉시 적용(가능하면 Firebase 우선)
    try { await loadThemeForNick(); } catch (e) {}

    db.ref("users/" + myNick).once("value", async (snap) => {
      const data = snap.val();
      if (data) {
        setTodoItemsToUI(data.todoItems || []);

        if (document.getElementById("db-today-goal-text")) {
          document.getElementById("db-today-goal-text").value = data.todayGoalText || "";
        }
        if (document.getElementById("db-today-done")) {
          document.getElementById("db-today-done").value = data.todayDone || "";
        }
        if (document.getElementById("db-status")) {
          /* [고침 2026-08-10] 저장된 값이 away 여도 ☕BREAK 로 시작합니다.

             들어왔다는 건 자리에 있다는 뜻이니까요. 예전 나가기 코드가
             away 를 찍어 두어서, 다시 들어와도 💤AWAY 에 갇히는 일이
             있었습니다(그 코드는 고쳤지만, 이미 저장된 값은 남아 있어요).
             자리를 비울 거면 들어와서 직접 고르면 됩니다. */
          const st = _startStatus(data.statusChoice);
          document.getElementById("db-status").value = st;
        }
      } else {
        setTodoItemsToUI([]);
      }

      updatePersonalProgressUI();
      renderQuickStatusBtn();
      setTimeout(fetchWeeklyStats, 300);

      // ✅ NEW: 참가/사운드 설정 로드(닉 귀속)
      try { await window.loadPomodoroParticipationFromFirebase?.(); } catch(e){}
      try { await window.loadSoundPrefsFromFirebase?.(); } catch(e){}
    });
  }

  function updatePersonalProgressUI() {
    const done = num(document.getElementById("db-today-done")?.value);
    const txt = document.getElementById("today-progress-text");
    if (txt) txt.textContent = `오늘 누적: ${done}자`;
  }

  function backupLocal() {
    if (!myNick) return;
    const payload = {
      at: Date.now(),
      todoItems: _todosForSave(),
      todayGoalText: document.getElementById("db-today-goal-text")?.value || "",
      todayDone: document.getElementById("db-today-done")?.value || "",
      status: document.getElementById("db-status")?.value || "writing",
      themeName: AppStore.getItem(_themeLocalKey()) || ""
    };
    AppStore.setItem(`backup_${myNick}`, JSON.stringify(payload));
  }

  function restoreLocal() {
    if (!myNick) return;
    const raw = AppStore.getItem(`backup_${myNick}`);
    if (!raw) return;

    try {
      const payload = JSON.parse(raw);
      if (!payload) return;

      setTodoItemsToUI(payload.todoItems || []);
      if (document.getElementById("db-today-goal-text")) document.getElementById("db-today-goal-text").value = payload.todayGoalText || "";
      if (document.getElementById("db-today-done")) document.getElementById("db-today-done").value = payload.todayDone || "";
      if (document.getElementById("db-status")) {
        const st = _startStatus(payload.status);
        document.getElementById("db-status").value = st;
      }
      renderQuickStatusBtn();

      // ✅ 로컬 테마도 복구
      if (payload.themeName) {
        AppStore.setItem(_themeLocalKey(), payload.themeName);
        window.applyTheme?.(payload.themeName);
      }

      updatePersonalProgressUI();
    } catch (e) {}
  }

  function saveDailyLog() {
    if (!myNick) return;
    const done = num(document.getElementById("db-today-done")?.value);
    const day = ymd(Date.now());
    db.ref(`users/${myNick}/dailyLogs/${day}`).set(done);
  }

  function fetchWeeklyStats() {
    if (!myNick) return;
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(ymd(d.getTime()));
    }

    db.ref(`users/${myNick}/dailyLogs`).once("value", snap => {
      const data = snap.val() || {};
      let sum = 0;
      let max = 0;
      let maxDay = "";
      days.forEach(k => {
        const v = num(data[k]);
        sum += v;
        if (v > max) { max = v; maxDay = k; }
      });

      const txt = document.getElementById("today-progress-text");
      if (txt) {
        const extra = ` · 최근7일 합계 ${sum}자 · 최고 ${max}자(${maxDay ? maxDay.slice(5) : "-"})`;
        if (!txt.textContent.includes("최근7일")) txt.textContent += extra;
      }
    });
  }

  function saveNow() {
    savePersonalData();
    if (typeof updateStatus === "function") updateStatus(true);
  }

  // ✅ 원터치 집필/휴식 전환
  function toggleWritingStatus() {
    /* [2026-08-03] 상태 3단계 순환: Work → Break → Away → Work */
    const sel = document.getElementById("db-status");
    if (!sel) return;
    sel.value = sel.value === "writing" ? "rest"
              : sel.value === "rest"    ? "away"
              : "writing";
    renderQuickStatusBtn();
    saveNow();
  }

  function renderQuickStatusBtn() {
    const btn = document.getElementById("status-quick-btn");
    const sel = document.getElementById("db-status");
    if (!btn || !sel) return;
    if (sel.value === "writing") {
      btn.textContent = "☕ Break로";
      btn.classList.remove("primary");
    } else {
      btn.textContent = "✍️ Work 시작!";
      btn.classList.add("primary");
    }
  }

  window.toggleWritingStatus = toggleWritingStatus;
  window.renderQuickStatusBtn = renderQuickStatusBtn;
  window.savePersonalData = savePersonalData;
  window.savePersonalDataDebounced = savePersonalDataDebounced;
  window.saveNow = saveNow;
  window.loadPersonalData = loadPersonalData;
  window.updatePersonalProgressUI = updatePersonalProgressUI;
  window.saveDailyLog = saveDailyLog;
  window.backupLocal = backupLocal;
  window.restoreLocal = restoreLocal;
