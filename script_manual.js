/* =====================================================================
   script_manual.js — 이용 설명서 팝업
   ---------------------------------------------------------------------
   설정 모달과 같은 탭 구조지만, 클래스는 .man-tab / .man-panel 로 따로 씁니다.
   (script_ui.js의 openTab이 document 전체에서 .tab / .panel 을 찾기 때문에
    같은 클래스를 쓰면 설정 탭을 열 때 설명서 탭이 함께 초기화됩니다.)
   ===================================================================== */

const MANUAL_SECTIONS = [
  {
    id: "start",
    tab: "시작하기",
    html: `
      <p class="man-p">필명을 입력하고 <b>입장하기</b>를 누르면 끝이에요.
      프사는 필명에 맞는 색의 눈사람으로 자동 배정되고, 사진으로 바꿀 수 있어요.</p>

      <div class="man-warn">
        필명이 곧 내 계정이에요. 다른 분과 같은 필명을 쓰면 투두와 목표가 서로
        덮어써질 수 있으니, 나만 쓰는 필명을 정해두세요.
      </div>

      <p class="man-p">나갈 때는 오른쪽 위 <b>🚪 나가기</b>를 눌러주세요.
      그냥 창을 닫아도 되지만, 눌러주시면 다른 분들 화면에서 더 빨리 사라져요.</p>

      <div class="man-tip">
        화면은 세 칸이에요. <b>접속자</b>(왼쪽) · <b>뽀모도로</b>(오른쪽 위) · <b>채팅</b>(오른쪽 아래).<br>
        칸 사이의 회색 손잡이를 <b>끌면 크기가 바뀌고</b>, 더블클릭하면 기본값으로 돌아가요.<br>
        오른쪽 줄(뽀모·채팅)은 머리말의 <b>❯</b> 로 <b>통째로 접을 수 있어요.</b>
        접으면 접속자 칸이 넓어집니다.<br>
        ①<b>접속자</b> 칸은 고정이고, 오른쪽 줄의 <b>뽀모도로</b>와 <b>채팅</b> 순서만 ⚙️ 설정 → 💬 채팅에서 바꿉니다.
      </div>
    `
  },
  {
    id: "cards",
    tab: "집필 현황",
    html: `
      <p class="man-p">지금 접속한 작가님들이 카드로 보여요. 카드 한 장에 담기는 것은 이래요.</p>

      <p class="man-p">위에서 아래로 <b>배지 줄 · 프사 · 닉네임 · 목표 · 지표</b> 순서예요.</p>

      <table class="man-t"><tbody>
        <tr><td>맨 윗줄</td><td>상태표. <b>내 카드는 눌러서 바꿉니다</b></td></tr>
        <tr><td>프사</td><td>사진을 올렸으면 사진, 아니면 색이 다른 눈사람</td></tr>
        <tr><td>🎯 목표</td><td>오늘의 한 줄 목표. <b>한 줄만</b> 보이고, 길면 마우스를 올려서 전체 확인</td></tr>
        <tr><td>맨 아랫줄</td><td>오늘 할일 진척 바와 <b>3 / 5 완료</b> · 오른쪽 <b>🍅 4</b> 오늘 끝낸 집중 세션</td></tr>
        <tr><td><b>프사를 누르면</b></td><td>프로필 설정 — 사진 · 카드 색 · 무늬 · 닉네임 색</td></tr>
        <tr><td><b>상태표를 누르면</b></td><td>상태 고르기 — WORK · 🔥초집중🔥 · 휴식 · 자리비움</td></tr>
        <tr><td>안테나 표시</td><td>아래쪽 상자 <b>왼쪽 위의 작은 안테나</b>. <b>초록</b>이면 접속 중, 인터넷이 끊기면 <b>붉게 깜빡이며 막대가 줄어요</b></td></tr>
        <tr><td><b>아래칸을 누르면</b></td><td>오늘 목표와 나의 투두</td></tr>
        <tr><td><b>남의 카드 아래</b></td><td>그 분의 작업 기록이 열려요. 오늘 상태별 시간과 지난 7일 집필 시간</td></tr>
      </tbody></table>

      <div class="man-tip">
        자리비움인 분의 카드는 색이 빠져서 흐리게 보여요. 마우스를 올리면 다시 또렷해집니다.<br>

      </div>
    `
  },
  {
    id: "pomo",
    tab: "뽀모도로",
    html: `
      <p class="man-p">한 명이 시작하면 <b>모두의 화면에서 함께 돌아가요.</b>
      집중 시간과 휴식 시간을 정하고 <b>▶ 시작</b>을 누르면 됩니다.</p>

      <table class="man-t"><tbody>
        <tr><td>🍅 / ☕</td><td>집중 시간과 휴식 시간(분)</td></tr>
        <tr><td>▶ 파란 버튼</td><td>시작</td></tr>
        <tr><td>■ 빨간 버튼</td><td>정지 — 모두의 타이머가 멈춰요</td></tr>
        <tr><td>🔔 참여 중</td><td>눌러서 끄면 내 알림음이 꺼지고, <b>카드의 🍅 집중 횟수도 안 올라가요.</b> 타이머 자체는 계속 돌아갑니다</td></tr>
        <tr><td>🎵</td><td>알림음 종류와 볼륨</td></tr>
        <tr><td>설정에서도</td><td>⚙️ 설정 → 🍅 뽀모도로 에 같은 참여 스위치가 있어요. 뽀모 창을 접어뒀을 때 쓰면 편합니다</td></tr>
        <tr><td>입장 알림</td><td>⚙️ 설정 → ⏰ 타이머에서 <b>누군가 들어오면 알림 띄우기</b>를 켜면, 새 작가님이 들어올 때 알려줍니다. 다른 창을 보고 있을 때만 떠요</td></tr>
        <tr><td>브라우저 알림</td><td>▶ 시작을 처음 누를 때 <b>알림 허용</b>을 물어봐요. 허용하면 <b>다른 창을 보고 있어도</b> 세션이 끝난 걸 알려줍니다. 거부해도 소리는 그대로 나요</td></tr>
      </tbody></table>

      <p class="man-p">채팅창 위쪽에 큼직한 숫자로도 남은 시간이 떠요.
      마감이 가까워지면 살짝 깜빡입니다.</p>
    `
  },
  {
    id: "personal",
    tab: "나의 작업",
    html: `
      <p class="man-p"><b>📌 나의 투두</b> — 입력칸에 적고 <b>Enter</b> 또는 오른쪽 <b>＋</b> 로 추가해요.
      체크하면 취소선이 그어지고,
      오른쪽 <b>⋯</b> 에서 수정 · 삭제 · <b>🔁 매일 반복</b>을 고를 수 있어요.
      매일 반복으로 걸어두면 자정에 체크가 저절로 풀립니다.</p>

      <p class="man-p">이 둘은 <b>내 카드의 아래칸을 눌러서</b> 엽니다. (또는 ⚙️ 설정 → 🎯 목표 · 투두)</p>

      <p class="man-p"><b>🎯 오늘 목표 / 상태</b> — 여기 적은 목표와 상태는
      <b>다른 분들 카드에도 보여요.</b> 적는 즉시 저장되니 따로 누를 버튼은 없어요.</p>

      <div class="man-tip">
        상태는 <b>Work · Break</b> 둘이에요. <b>카드의 상태표를 누르면 서로 바뀝니다.</b><br>
        <b>상태별로 시간이 자동으로 기록됩니다.</b> 카드 아래쪽 상자를 누르면 볼 수 있어요.
        상태를 바꾼 시각을 기준으로 계산하니, <b>창을 내려두고 한글·스크리브너 같은 다른 앱에서
        글을 쓰셔도 시간은 그대로 쌓입니다.</b>
        컴퓨터가 잠들거나 꺼져서 <b>연결이 끊긴 구간만 집계에서 빠집니다.</b><br>
        한 구간은 <b>최대 6시간</b>까지만 셉니다. WORK 로 켜둔 채 잊어버려도
        하루가 통째로 집필 시간이 되지 않아요. 6시간이 넘어가면 상태를 한 번 다시 눌러주세요.
      </div>
    `
  },
  {
    id: "chat",
    tab: "채팅",
    html: `
      <table class="man-t"><tbody>
        <tr><td>@멘션</td><td>@ 를 치면 접속자 목록이 떠요. 멘션받으면 화면 위에 알림이 뜹니다</td></tr>
        <tr><td>답장</td><td>답장할 말풍선을 <b>세 번 연속 클릭</b>하세요</td></tr>
        <tr><td>반응</td><td>말풍선에 마우스를 올리면 나오는 <b>웃는 얼굴 버튼</b> → ❤️ 👍 😂 😮 🥹 🔥</td></tr>
        <tr><td>주소(URL)</td><td>http로 시작하는 주소는 <b>눌러서 새 창으로</b> 열려요</td></tr>
        <tr><td>❯</td><td>머리말 버튼. 오른쪽 줄을 통째로 접어요. 접어두면 안 읽은 개수가 숫자로 쌓입니다</td></tr>
        <tr><td>좁은 화면</td><td>창이 좁아지면 위쪽에 <b>탭 다섯 개</b>가 생겨요. 다른 창을 보는 동안 채팅이 오면 <b>💬 탭에 빨간 숫자</b>가 붙습니다. 오른쪽 끝 <b>🚪</b> 로 나갈 수 있어요</td></tr>
      </tbody></table>

      <p class="man-p">반응은 다시 누르면 취소돼요. 붙은 반응에 마우스를 올리면 누가 눌렀는지 보입니다.</p>

      <div class="man-h2">/ 명령어 — 화면 가득 효과가 터져요</div>
      <p class="man-p">입력창에 <b>/</b> 를 치면 목록이 뜨고, 화살표 ↑↓ 로 고른 뒤 Enter 로 보내요.
      보내면 모두의 화면에 이모지가 흩날립니다.</p>

      <div class="man-cmds">
        <span class="man-cmd">/운세</span><span class="man-cmd">/축하</span><span class="man-cmd">/마감</span>
        <span class="man-cmd">/달성</span><span class="man-cmd">/연재</span><span class="man-cmd">/휴식</span>
        <span class="man-cmd">/집필</span><span class="man-cmd">/만세</span><span class="man-cmd">/수고</span>
        <span class="man-cmd">/고추</span>
      </div>

      <p class="man-p">아래 둘은 <b>뒤에 하고 싶은 말</b>을 붙여서 씁니다.</p>
      <table class="man-t"><tbody>
        <tr><td>/외치기</td><td><code>/외치기 오늘은 꼭 끝낸다</code> — 화면 한가운데 크게 외쳐요</td></tr>
        <tr><td>/선언</td><td><code>/선언 15화 마감</code> — 오늘의 목표를 채팅에 선언해요</td></tr>
      </tbody></table>

      <div class="man-tip">
        <b>/운세</b> 는 하루에 한 번, 오늘의 운세를 뽑아줘요. 재미로 봐주세요 🔮
      </div>
    `
  },
  {
    id: "profile",
    tab: "내 프로필",
    html: `
      <p class="man-p">내 카드의 <b>✏️</b> 또는 <b>⚙️ 설정 → 👤 프로필</b> 에서 바꿀 수 있어요.</p>

      <table class="man-t"><tbody>
        <tr><td>프사 사진</td><td><b>사진 올리기</b>를 눌러 고르면 정사각형으로 잘라 저장해요. 안 올리면 색이 다른 눈사람</td></tr>
        <tr><td>카드 배경</td><td>내 카드의 배경색과 <b>무늬</b>를 골라요. 도트·그리드·십자·체크·줄무늬(／＼)와 ⭐☀️🌙💗🌸🐾☁️🌿 모양까지. 무늬 색도 따로 정합니다</td></tr>
        <tr><td>눈사람 배경색</td><td>사진을 안 올렸을 때 보이는 눈사람의 배경색</td></tr>
        <tr><td>채팅 닉네임 색</td><td>채팅 말풍선 위에 뜨는 <b>내 이름 색</b>. 다른 분들 화면에도 이 색으로 보여요</td></tr>
      </tbody></table>

      <div class="man-tip">
        사진은 <b>카드와 채팅 말풍선 양쪽에</b> 적용돼요. 지우면 눈사람으로 돌아갑니다.
      </div>
    `
  },
  {
    id: "etc",
    tab: "그 밖에",
    html: `
      <table class="man-t"><tbody>
        <tr><td>− 18px +</td><td><b>채팅 글자 크기</b>를 조절해요. 카드 크기는 안 바뀝니다</td></tr>
        <tr><td>🎨 테마</td><td>설정에서 배경과 말풍선 색을 골라요. 눈이 편한 어두운 테마도 있어요</td></tr>
        <tr><td>좌우 뒤집기</td><td>배치를 통째로 좌우로 뒤집어요</td></tr>

        <tr><td>칸 크기</td><td>칸 사이 손잡이를 끌어서. 더블클릭하면 기본값</td></tr>
        <tr><td><b>앱처럼 쓰기</b></td><td>크롬·엣지 주소창 오른쪽의 <b>설치 아이콘(⊕)</b>, 사파리는 <b>공유 → Dock에 추가</b>. 주소창 없는 <b>독립 창</b>으로 열려서 화면이 넓어지고, <b>알림이 제 시각에</b> 옵니다. 설치 안 해도 지금처럼 쓸 수 있어요</td></tr>
      </tbody></table>

      <div class="man-tip">
        테마 · 글자 크기 · 칸 크기 · <b>자리 배치</b> · 접어둔 영역은 <b>이 기기에만</b> 저장돼요.<br>
        프사와 투두는 필명을 따라다니니 다른 기기에서 들어와도 그대로예요.
      </div>
    `
  }
];

let _manualRendered = false;

function renderManual() {
  if (_manualRendered) return;

  const tabsHost = document.getElementById("manual-tabs");
  const panelsHost = document.getElementById("manual-panels");
  if (!tabsHost || !panelsHost) return;

  tabsHost.innerHTML = MANUAL_SECTIONS.map((s, i) => `
    <button type="button" class="man-tab${i === 0 ? " active" : ""}"
            role="tab" aria-selected="${i === 0}" aria-controls="man-panel-${s.id}"
            data-man-tab="${s.id}">${s.tab}</button>
  `).join("");

  panelsHost.innerHTML = MANUAL_SECTIONS.map((s, i) => `
    <div class="man-panel${i === 0 ? " active" : ""}" id="man-panel-${s.id}" role="tabpanel">
      ${s.html}
    </div>
  `).join("");

  tabsHost.querySelectorAll(".man-tab").forEach(btn => {
    btn.addEventListener("click", () => openManualTab(btn.dataset.manTab));
  });

  _manualRendered = true;
}

function openManualTab(id) {
  document.querySelectorAll(".man-tab").forEach(t => {
    const on = t.dataset.manTab === id;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.querySelectorAll(".man-panel").forEach(p => {
    p.classList.toggle("active", p.id === `man-panel-${id}`);
  });

  // 탭을 바꾸면 내용 맨 위부터 보이게
  const scroller = document.getElementById("manual-panels");
  if (scroller) scroller.scrollTop = 0;
}

function openManual() {
  renderManual();
  const modal = document.getElementById("manual-modal");
  if (!modal) return;
  modal.style.display = "flex";
  document.getElementById("manual-close-btn")?.focus();
}

function closeManual() {
  const modal = document.getElementById("manual-modal");
  if (modal) modal.style.display = "none";
}

window.openManual = openManual;
window.closeManual = closeManual;
window.openManualTab = openManualTab;

/* ESC로 닫기 — 설정 모달이 열려 있으면 그쪽이 우선이라 건드리지 않습니다 */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const modal = document.getElementById("manual-modal");
  if (modal && modal.style.display === "flex") closeManual();
});
