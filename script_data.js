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

  // =====================================================
  // ✅ Todo state in UI memory
  // =====================================================
  function getTodoItemsFromUI() {
    return window._todoItems || [];
  }

  function _normalizeRoutineTodos(items) {
    const today = ymd(Date.now());
    return (Array.isArray(items) ? items : []).map(x =>
      (x && x.routine && x.done && x.doneDay !== today)
        ? ({ ...x, done: false, doneDay: "" })
        : x
    );
  }

  function setTodoItemsToUI(items) {
    window._todoItems = _normalizeRoutineTodos(items);
    renderTodoList();

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

  /** 날짜 배지에 쓸 글자·모양. 날짜가 없으면 null */
  function todoDueBadgeInfo(item) {
    /* 반복 항목에 날짜가 함께 남아 있는 옛 자료라면 날짜는 없는 셈 칩니다
       (저장할 때 실제로 털어냅니다 — _todosForSave 참고) */
    if (!item || item.routine || !isTodoDue(item.due)) return null;

    const [, mm, dd] = item.due.split("-");
    const short = `${Number(mm)}/${dd}`;
    const diff = _todoDueDiff(item.due);

    if (diff === 0) {
      return { text: "오늘", cls: "is-today", title: `오늘(${short})까지 하는 일이에요` };
    }
    if (diff < 0 && !item.done) {
      return { text: `D+${-diff}`, cls: "is-late", title: `${short}에 하기로 했는데 ${-diff}일 지났어요` };
    }
    return { text: short, cls: "", title: `${item.due} 에 하는 일이에요` };
  }

  window.isTodoDue = isTodoDue;
  window.todoDueBadgeInfo = todoDueBadgeInfo;

  // =====================================================
  // ✅ Todo render: “... 버튼 → 메뉴(수정/삭제)” + 한 줄 1개
  // =====================================================
  function _closeAllTodoMenus(except) {
    document.querySelectorAll(".todo-menu").forEach(m => {
      if (except && m === except) return;
      m.classList.remove("open");
    });
  }

  function _openTodoMenuSmart(li, menu, moreBtn) {
    if (!li || !menu || !moreBtn) return;

    menu.classList.add("open");
    menu.classList.remove("open-up");

    requestAnimationFrame(() => {
      const menuRect = menu.getBoundingClientRect();
      const btnRect = moreBtn.getBoundingClientRect();

      const spaceBelow = window.innerHeight - btnRect.bottom;
      const spaceAbove = btnRect.top;

      if (spaceBelow < menuRect.height + 12 && spaceAbove > menuRect.height + 12) {
        menu.classList.add("open-up");
      } else {
        menu.classList.remove("open-up");
      }
    });
  }

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
  /* [고침 2026-08-06] 여기에 `window.renderTodoList = () => renderTodoList()`
     를 두었다가 목록이 통째로 사라졌습니다.

     이 파일은 IIFE 로 감싸여 있지 않아서, 최상위 `function renderTodoList`
     가 곧 `window.renderTodoList` 입니다. 거기에 화살표 함수를 덮어쓰면
     화살표 안의 이름도 그 화살표를 가리켜 자기를 끝없이 부릅니다.
     이미 전역에 있으니 따로 내보낼 필요가 없었어요. */

  function renderTodoList() {
    const ul = document.getElementById("todo-list");
    if (!ul) return;

    const items = todosForProfileList();
    ul.innerHTML = "";

    items.forEach(item => {
      const dueInfo = todoDueBadgeInfo(item);
      const hasDue = !!dueInfo;
      const dueShort = hasDue
        ? `${Number(item.due.slice(5, 7))}/${item.due.slice(8, 10)}`
        : "";

      const li = document.createElement("li");
      li.className = "todo-item" + (item.done ? " done" : "") + (hasDue ? " has-due" : "");
      li.dataset.id = item.id;

      li.innerHTML = `
        <label class="todo-left">
          <input class="todo-check" type="checkbox" ${item.done ? "checked" : ""} />
          <span class="todo-text"></span>
        </label>

        <button class="todo-more" type="button" aria-label="todo menu">⋯</button>

        <div class="todo-menu" role="menu">
          <button type="button" class="edit" role="menuitem">✏️ 수정</button>
          <button type="button" class="due" role="menuitem">${hasDue ? `🗓️ 날짜 바꾸기 (${dueShort})` : "🗓️ 날짜 정하기"}</button>
          ${hasDue ? `<button type="button" class="due-clear" role="menuitem">🚫 날짜 지우기</button>` : ""}
          <button type="button" class="routine" role="menuitem">${item.routine ? "🔁 반복 해제" : "🔁 매일 반복"}</button>
          <button type="button" class="danger delete" role="menuitem">🗑 삭제</button>
        </div>
      `;

      li.querySelector(".todo-text").textContent = item.text || "";

      /* 날짜 배지 — 🔁 반복 배지와 나란히 텍스트 옆에 붙습니다 */
      if (dueInfo) {
        const dbadge = document.createElement("span");
        dbadge.className = "todo-due-badge " + dueInfo.cls;
        dbadge.textContent = dueInfo.text;
        dbadge.title = dueInfo.title;
        li.querySelector(".todo-left")?.appendChild(dbadge);
      }

      if (item.routine) {
        const badge = document.createElement("span");
        badge.className = "todo-routine-badge";
        badge.textContent = "🔁";
        badge.title = "매일 반복되는 투두예요 (자정에 체크가 풀려요)";
        li.querySelector(".todo-left")?.appendChild(badge);
      }

      li.querySelector(".todo-check").addEventListener("change", (e) => {
        toggleTodo(item.id, e.target.checked);
      });

      const moreBtn = li.querySelector(".todo-more");
      const menu = li.querySelector(".todo-menu");

      moreBtn.addEventListener("click", (e) => {
        e.stopPropagation();

        const willOpen = !menu.classList.contains("open");
        _closeAllTodoMenus(menu);

        if (!willOpen) {
          menu.classList.remove("open", "open-up");
          return;
        }

        _openTodoMenuSmart(li, menu, moreBtn);
      });

      li.querySelector(".todo-menu .edit").addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.remove("open");
        editTodo(item.id);
      });

      li.querySelector(".todo-menu .due").addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.remove("open");
        openTodoDuePicker(li, item);
      });

      li.querySelector(".todo-menu .due-clear")?.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.remove("open");
        setTodoDue(item.id, "");
      });

      li.querySelector(".todo-menu .routine").addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.remove("open");
        toggleRoutineTodo(item.id);
      });

      li.querySelector(".todo-menu .delete").addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.remove("open");
        deleteTodo(item.id);
      });

      // 바깥 클릭 시 닫기
      li.addEventListener("click", () => _closeAllTodoMenus());
      ul.appendChild(li);
    });
  }

  // 문서 어디든 클릭하면 메뉴 닫기
  document.addEventListener("click", () => _closeAllTodoMenus());

  // =====================================================
  // ✅ 날짜 고르는 줄 (항목 바로 아래에 잠깐 열리는 <input type="date">)
  // =====================================================
  /* prompt("2026-08-07 처럼 적어주세요") 는 휴대폰에서 특히 괴롭습니다.
     달력이 뜨는 <input type="date"> 를 항목 아래에 끼워 넣고, 고르는
     즉시 저장한 뒤 줄을 걷습니다. 취소도 됩니다. */
  function _closeTodoDuePicker() {
    document.querySelectorAll(".todo-duepick").forEach(n => n.remove());
  }

  function openTodoDuePicker(li, item) {
    _closeTodoDuePicker();
    if (!li || !li.parentNode) return;

    const row = document.createElement("li");
    row.className = "todo-duepick";
    row.innerHTML = `
      <span class="todo-duepick-label">🗓️ 언제 할까요?</span>
      <input type="date" class="todo-duepick-input" aria-label="투두 날짜">
      <button type="button" class="todo-duepick-btn today">오늘</button>
      ${isTodoDue(item.due) ? `<button type="button" class="todo-duepick-btn clear">지우기</button>` : ""}
      <button type="button" class="todo-duepick-btn cancel">취소</button>
    `;

    const inp = row.querySelector(".todo-duepick-input");
    inp.value = isTodoDue(item.due) ? item.due : ymd(Date.now());

    /* 고르는 즉시 저장 — 저장하면 목록을 다시 그리므로 줄은 저절로 사라집니다 */
    inp.addEventListener("change", () => {
      const v = String(inp.value || "");
      if (!v) return;                 // 입력칸을 비운 것은 취소로 봅니다
      setTodoDue(item.id, v);
    });

    row.querySelector(".todo-duepick-btn.today").addEventListener("click", () => {
      setTodoDue(item.id, ymd(Date.now()));
    });
    row.querySelector(".todo-duepick-btn.clear")?.addEventListener("click", () => {
      setTodoDue(item.id, "");
    });
    row.querySelector(".todo-duepick-btn.cancel").addEventListener("click", () => {
      _closeTodoDuePicker();
    });

    li.parentNode.insertBefore(row, li.nextSibling);

    /* 크롬·엣지는 showPicker() 로 달력을 바로 펼칠 수 있습니다.
       지원하지 않는 브라우저에서는 그냥 입력칸에 초점만 갑니다. */
    try { inp.focus(); inp.showPicker?.(); } catch (e) {}
  }

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

    _closeTodoDuePicker();
    setTodoItemsToUI(items);
    savePersonalData();
  }


  function bindTodoInputEnter() {
    const inp = document.getElementById("todo-input");
    if (!inp) return;

    inp.addEventListener("keydown", (e) => {
      /* ✅ [FIX] 맥·윈도우 한글 입력에서 마지막 글자가 따로 추가되던 문제

         한글은 조합이 끝날 때 Enter가 한 번 더 들어옵니다. 그 Enter를 그대로
         받으면 아직 확정되지 않은 글자 상태로 저장돼, 마지막 자모가 별개의
         할 일로 남았습니다. 채팅 입력창에는 이미 같은 방어가 있었는데
         투두 입력창에는 빠져 있었어요. */
      if (e.isComposing || e.keyCode === 229) return;

      if (e.key === "Enter") {
        e.preventDefault();
        addTodoFromUI();
      }
    });
  }

  function addTodoFromUI() {
    const inp = document.getElementById("todo-input");
    if (!inp) return;

    const text = (inp.value || "").trim();
    if (!text) return;

    const items = getTodoItemsFromUI();
    items.unshift({
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      text,
      done: false,
      createdAt: Date.now()
    });

    inp.value = "";
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

  function editTodo(id) {
    const items = getTodoItemsFromUI();
    const target = items.find(x => x.id === id);
    if (!target) return;

    const next = prompt("투두 수정", target.text || "");
    if (next === null) return;

    const text = String(next).trim();
    if (!text) return;

    const updated = items.map(x => x.id === id ? ({...x, text}) : x);
    setTodoItemsToUI(updated);
    savePersonalData();
  }

  function deleteTodo(id) {
    if (!confirm("이 투두를 삭제할까요?")) return;
    const items = getTodoItemsFromUI().filter(x => x.id !== id);
    setTodoItemsToUI(items);
    savePersonalData();
  }

  window.bindTodoInputEnter = bindTodoInputEnter;
  window.addTodoFromUI = addTodoFromUI;
  window.toggleRoutineTodo = toggleRoutineTodo;
  window.clearCompletedTodos = clearCompletedTodos;

  /* [2026-08-06] 🗂️ 나의 작업 창에서 날짜를 붙여 새 할 일을 넣는 창구.

     addTodoFromUI 는 화면의 입력칸(#todo-input)을 읽어가는 함수라
     다른 창에서는 쓸 수 없었습니다. 글자와 날짜를 직접 받는 문을
     따로 열어둡니다. due 가 비어 있으면 "날짜 없는 할 일"입니다. */
  function addTodoWithDue(text, due) {
    const t = String(text || "").trim();
    if (!t) return false;

    const item = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      text: t,
      done: false,
      createdAt: Date.now()
    };
    /* 날짜와 반복은 함께 쓰지 않으므로, 여기서는 날짜만 붙입니다 */
    if (isTodoDue(due)) item.due = due;

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

    backupLocal();
    saveDailyLog();

    if (typeof updateStatus === "function") updateStatus(true);
  }

  let saveTimeout;
  function savePersonalDataDebounced() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => savePersonalData(), 700);
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
          const st = (data.statusChoice && data.statusChoice !== "idle") ? data.statusChoice : "rest";
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
        const st = (payload.status && payload.status !== "idle") ? payload.status : "rest";
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
