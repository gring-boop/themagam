/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
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
        필명이 곧 내 계정이에요. 다른 분과 같은 필명을 쓰면 할 일과 목표가 서로
        덮어써질 수 있으니, 나만 쓰는 필명을 정해두세요.
      </div>

      <div class="man-h2">비밀번호</div>
      <p class="man-p"><b>필명 + 비밀번호(6자 이상)</b>로 들어와요. 처음 쓰는 필명이면
      그 비밀번호로 자리가 잡히고, 그 뒤로는 <b>같은 비밀번호로만</b> 그 필명을 쓸 수 있어요.
      다른 곳에서 쓰는 비밀번호는 쓰지 마세요. <b>잊어버리면 스스로 되돌릴 수 없어서 방장에게
      말해야 합니다.</b></p>

      <p class="man-p">나갈 때는 오른쪽 위 <b>🚪 나가기</b>를 눌러주세요.
      그냥 창을 닫아도 되지만, 눌러주시면 다른 분들 화면에서 더 빨리 사라져요.</p>

      <div class="man-h2">머리말 버튼 — 왼쪽부터</div>
      <table class="man-t"><tbody>
        <tr><td>🖱️ 자동감지</td><td>20분 안 만지면 자동으로 자리비움 (<b>자리비움</b> 탭 참고)</td></tr>
        <tr><td>🖥️ 화면 공유</td><td>내 창을 뭉갠 그림으로 (<b>대숲 · 화면공유</b> 탭 참고)</td></tr>
        <tr><td>🎋 대숲</td><td>완전 익명 게시판</td></tr>
        <tr><td>가이드 · 설정</td><td>지금 보는 이 창 · 테마와 배치</td></tr>
        <tr><td>− 18px +</td><td>채팅 글자 크기</td></tr>
        <tr><td>🚪 나가기</td><td>퇴장</td></tr>
      </tbody></table>

      <div class="man-tip">
        화면은 세 칸이에요. <b>채팅 · 접속자 · 뽀모(글자수 포함)</b>.<br>
        칸 사이의 회색 손잡이를 <b>끌면 크기가 바뀌고</b>, 더블클릭하면 기본값으로 돌아가요.<br>
        <b>채팅</b>은 채팅 머리말의 <b>❮</b> 로, <b>뽀모·글자수 줄</b>은 Pomodoro 제목 옆 <b>❯</b> 로 각각 접어요.
        접으면 얇은 손잡이가 남아 언제든 다시 폅니다.<br>
        <b>접속자</b> 칸은 가운데 고정이고, 양옆(채팅·뽀모)의 위치는 ⚙️ 설정 → 💬 채팅의 <b>좌우 뒤집기</b>로 맞바꿉니다.
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
        <tr><td><b>내 카드가 맨 앞</b></td><td>목록에서 <b>내 카드가 항상 첫 자리</b>예요. 사람이 늘어도 찾아 헤맬 일이 없어요</td></tr>
        <tr><td>맨 아랫줄</td><td>왼쪽 <b>⏱ 2h 30m</b> 오늘 작업 시간 · 오른쪽 <b>🍅 4</b> 오늘 끝낸 집중 세션.
            뽀모를 <b>돌리는 중이면 🍅 이 은은하게 깜빡이고</b>, 휴식 중에는 <b>☕</b> 로 바뀝니다</td></tr>
        <tr><td><b>프사를 누르면</b></td><td>프로필 설정 — 사진 · 카드 색 · 무늬 · 닉네임 색</td></tr>
        <tr><td><b>상태표를 누르면</b></td><td>고르기 판이 떠요 — <b>🔥WRITE🔥</b>(집필) · <b>💻JOB💻</b>(본업·다른 작업) · <b>☕BREAK☕</b>(휴식) · <b>💤AWAY💤</b>(자리비움)</td></tr>
        <tr><td>접속 표시</td><td>아래쪽 상자의 <b>작은 점</b>. <b>초록</b>이면 접속 중, 인터넷이 끊기면 <b>붉게 깜빡여요</b></td></tr>
        <tr><td><b>아래칸을 누르면</b></td><td><b>🗂️ 나의 작업</b> 창이 열려요 — 출석 달력 · 할 일 · 목표 · 작업 시간 · 글자수가 모두 여기 있어요</td></tr>
        <tr><td><b>남의 카드</b></td><td>누르면 <b>📮 쪽지</b>를 보낼 수 있어요. 남의 작업 시간 기록은 볼 수 없습니다</td></tr>
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
      <p class="man-p"><b>타이머는 각자 것이에요.</b> 내가 시작하고 멈추는 것은
      내 화면에서만 돌아가고, 남의 타이머에는 아무 영향이 없어요.
      집중 시간과 휴식 시간도 각자 마음대로 정하면 됩니다.</p>

      <table class="man-t"><tbody>
        <tr><td>🍅 / ☕</td><td>집중 시간과 휴식 시간(분) — <b>내 것만</b> 바뀝니다</td></tr>
        <tr><td>▶ / ⏸</td><td>같은 자리에서 <b>시작</b>과 <b>잠깐 멈춤</b>을 맡아요.
            멈추면 남은 시간이 그대로 붙잡히고, 다시 누르면 이어집니다.
            <b>창을 닫았다 열어도 멈춘 채로</b> 기다려요</td></tr>
        <tr><td>■</td><td>정지 — <b>내 타이머만</b> 멈춰요. 도는 중에만 나타납니다</td></tr>
        <tr><td>⚙️ 알림음</td><td>알림음 종류와 볼륨을 고릅니다</td></tr>
        <tr><td>♪</td><td><b>소리만</b> 켜고 꺼요. 브라우저 알림은 그대로 오고,
            타이머와 🍅 집중 횟수도 그대로입니다</td></tr>
        <tr><td>브라우저 알림</td><td>▶ 시작을 처음 누를 때 <b>알림 허용</b>을 물어봐요. 허용하면 <b>다른 창을 보고 있어도</b> 세션이 끝난 걸 알려줍니다. 거부해도 소리는 그대로 나요</td></tr>
      </tbody></table>

      <div class="man-tip">
        <b>새로고침해도 이어져요.</b> 실수로 창을 닫았다 다시 들어와도
        남은 시간이 그대로 이어집니다. 몇 시간 뒤에 돌아온 경우처럼
        이미 끝나 버린 타이머는 되살리지 않아요.
      </div>

      <p class="man-p">집중 시작 · 휴식 알림은 <b>글자수 창의 [오늘] 탭</b>에
      한 줄씩 흘러요. <b>내 화면에만</b> 보이는 줄이라 남의 알림은 섞이지 않습니다.
      대신 뽀모를 돌리는 동안에는 <b>내 카드에 🍅</b> 이 떠서, 다른 작가님들도
      "지금 달리는 중이구나" 정도는 알 수 있어요.</p>

      <p class="man-p">채팅창 위쪽에 큼직한 숫자로도 남은 시간이 떠요.
      마감이 가까워지면 살짝 깜빡입니다.</p>

      <div class="man-h2">📮 쪽지</div>
      <p class="man-p"><b>다른 작가님의 카드를 누르면</b> 짧은 쪽지를 보낼 수 있어요. 한 통에 <b>80자</b>까지.
      받은 쪽지는 <b>🗂️ 나의 작업 → 📮 쪽지</b> 에서 봅니다.</p>

      <table class="man-t"><tbody>
        <tr><td><b>누가 보나</b></td><td><b>받는 사람만요.</b> 방장도 볼 수 없어요.
            대신 <b>보낸 사람 이름은 반드시 붙습니다</b> — 익명으로 하고 싶으면 🎋 대숲을 쓰세요</td></tr>
        <tr><td><b>답장</b></td><td>받은 쪽지의 [답장] 을 누르면 <b>그 사람 앞으로 새 쪽지</b>가 열려요.
            대화창이 아니라 쪽지라서, 주고받은 것이 실처럼 엮이지는 않습니다</td></tr>
        <tr><td><b>안 읽은 쪽지</b></td><td>내 카드에 <b>📮 숫자</b>가 붙어요. 쪽지 탭을 열면 읽음으로 바뀝니다</td></tr>
        <tr><td><b>30일</b></td><td>대숲처럼, 오래된 쪽지는 저절로 사라져요</td></tr>
      </tbody></table>

      <div class="man-h2">📓 전체 기록</div>
      <p class="man-p">글자수 창의 <b>[오늘] [내 기록]</b> 옆 <b>[전체 기록]</b>을 누르면
      <b>방 전체의 달력</b>이 열려요. 하루 칸에 그날 <b>다 같이 쓴 글자수</b>와
      <b>🍅 모두가 끝낸 집중 횟수</b>가 얹힙니다. <b>‹ ›</b> 로 지난 달도 넘겨볼 수 있고,
      칸에 마우스를 올리면 <b>누가 얼마나 썼는지</b> 보여요.</p>
    `
  },
  {
    id: "personal",
    tab: "나의 작업",
    html: `
      <p class="man-p"><b>내 카드의 아래칸(닉네임이 있는 칸)을 누르면</b> 열려요.
      예전에는 머리말에도 버튼이 있었지만, 같은 창이 두 군데서 열려 헷갈려서 하나로 합쳤습니다.</p>

      <p class="man-p">왼쪽은 <b>출석 달력</b>, 오른쪽은 탭 넷이에요.</p>

      <table class="man-t"><tbody>
        <tr><td><b>달력</b></td><td>입장만 해도 붉은 <b>✓ 도장</b>이 찍혀요. 그날 할 일이 있으면 칸 오른쪽 위에 <b>작은 점</b>이 붙고, 다 끝냈으면 옅어집니다</td></tr>
        <tr><td><b>한 번 클릭</b></td><td>그 <b>날짜를 고릅니다</b> — 오른쪽 📌 할 일이 그날 것으로 바뀌어요</td></tr>
        <tr><td><b>두 번 클릭</b></td><td>그날을 <b>🏖️ 휴가</b>로 표시하거나 풉니다</td></tr>
        <tr><td><b>📌 할 일</b></td><td>고른 날짜의 할 일과, 그 아래 <b>📎 날짜 없는 할 일</b>.
            입력칸에 적고 <b>Enter</b> 또는 <b>＋</b> 로 추가하고, 오른쪽 <b>⋯</b> 에서 수정 · 삭제 · <b>🔁 매일 반복</b>을 고를 수 있어요</td></tr>
        <tr><td><b>🎯 목표</b></td><td>오늘 목표 한 줄과 <b>⏱️ 타이머 리셋</b> — <b>카드에 보이는 타이머만</b> 0으로 되돌리고
            그 순간부터 다시 셉니다. <b>⏱️ 작업 시간 탭의 기록은 그대로예요.</b>
            리셋하면 버튼 아래에 [되돌리기] 가 나타납니다
            목표는 <b>내 카드에 그대로 보여요</b>(공유됨)</td></tr>
        <tr><td><b>⏱️ 작업 시간</b></td><td>요일별 작업 시간 그래프 · 지난 주 넘겨보기 · 텍스트로 내보내기</td></tr>
        <tr><td><b>✍️ 글자수</b></td><td>요일별 글자수 그래프와 오늘 내 기록</td></tr>
        <tr><td><b>📮 쪽지</b></td><td>받은 쪽지와 보낸 쪽지. 안 읽은 게 있으면 <b>내 카드에 붉은 표시</b>가 붙어요</td></tr>
      </tbody></table>

      <p class="man-p">할 일은 <b>본인만 편집 및 열람할 수 있습니다.</b>
      <b>🔁 매일 반복</b>으로 걸어두면 자정에 체크가 저절로 풀려요.</p>

      <div class="man-tip">
        <b>🔁 매일 반복</b>은 날짜와 함께 쓸 수 없어요 — 반복을 켜면 날짜가 지워지고,
        날짜를 정하면 반복이 풀립니다.
      </div>

      <p class="man-p">목표와 상태는 <b>다른 분들 카드에도 보여요.</b> 적는 즉시 저장되니 따로 누를 버튼은 없어요.</p>

      <div class="man-tip">
        상태는 <b>Work · Break</b> 둘이에요. <b>카드의 상태표를 누르면 서로 바뀝니다.</b><br>
        <b>상태별로 시간이 자동으로 기록됩니다.</b> 위의 <b>⏱️ 작업 시간</b> 탭에서 볼 수 있어요.
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
        <tr><td>답장</td><td>말풍선에 마우스를 올리면 나오는 <b>↩ 버튼</b>을 누르세요.
            (말풍선을 <b>세 번 연속 클릭</b>해도 돼요)</td></tr>
        <tr><td>반응</td><td>답장 버튼 오른쪽의 <b>웃는 얼굴 버튼</b> → ❤️ 👍 😂 😮 🥹 🔥</td></tr>
        <tr><td>주소(URL)</td><td>http로 시작하는 주소는 <b>눌러서 새 창으로</b> 열려요</td></tr>
        <tr><td>채팅 접기</td><td>채팅 머리말의 <b>❮</b>. 접어두면 얇은 손잡이에 <b>안 읽은 개수</b>가 숫자로 쌓입니다</td></tr>
        <tr><td>좁은 화면</td><td>창이 좁아지면 위쪽에 <b>탭</b>가 생겨요. 다른 창을 보는 동안 채팅이 오면 <b>💬 탭에 빨간 숫자</b>가 붙습니다. 오른쪽 끝 <b>🚪</b> 로 나갈 수 있어요</td></tr>
      </tbody></table>

      <p class="man-p">반응은 다시 누르면 취소돼요. 붙은 반응에 마우스를 올리면 누가 눌렀는지 보입니다.</p>

      <div class="man-h2">/ 명령어 — 화면 가득 효과가 터져요</div>
      <p class="man-p">입력창에 <b>/</b> 를 치면 목록이 뜨고, 화살표 ↑↓ 로 고른 뒤 Enter 로 보내요.
      보내면 모두의 화면에 이모지가 흩날립니다.</p>

      <div class="man-cmds">
        <span class="man-cmd">/운세</span><span class="man-cmd">/축하</span><span class="man-cmd">/마감</span>
        <span class="man-cmd">/환영</span><span class="man-cmd">/응원</span>
        <span class="man-cmd">/퇴근</span>
        <span class="man-cmd">/만세</span><span class="man-cmd">/수고</span>
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

      <div class="man-h2">☕ 수다방 — 떠들고 싶은 사람만</div>
      <p class="man-p">채팅 머리말의 <b>☕ 수다방</b> 탭을 누르고 <b>참여하기</b> 를 누르면 들어가져요.
      집필에 집중하고 싶은 분은 안 들어가면 됩니다 — 안 들어가면 <b>알림도 안 와요.</b></p>

      <table class="man-t"><tbody>
        <tr><td>지난 대화</td><td><b>안 보여요.</b> 참여한 시점부터의 이야기만 흘러갑니다</td></tr>
        <tr><td>누가 있나</td><td>머리말 아래 줄에 <b>👥 지금 참여 중인 사람들</b> 이 이름으로 떠요.
            탭의 <b>(n명)</b> 도 같은 숫자예요</td></tr>
        <tr><td>나가기</td><td>머리말 오른쪽 <b>나가기</b>. 다시 참여하면 그때부터 또 보여요</td></tr>
        <tr><td><b>다음에 들어올 땐</b></td><td>작업방을 나갔다 다시 들어오면 <b>수다방은 풀립니다.</b>
            그때그때 들어갈지 고를 수 있게 일부러 그렇게 해뒀어요</td></tr>
        <tr><td>쓸 수 있는 것</td><td>일반 채팅과 <b>똑같아요</b> — / 명령어 · @멘션 · ↩ 답장 · 반응 전부 됩니다</td></tr>
      </tbody></table>

      <div class="man-tip">
        <b>안 읽은 개수</b>는 탭마다 따로 세요. 수다방을 보고 있는 동안
        일반 채팅에 말이 오면 <b>Chat 옆에 빨간 숫자</b>가 붙습니다. 반대도 마찬가지예요.
      </div>
    `
  },
  {
    id: "board",
    tab: "대숲 · 화면공유",
    html: `
      <div class="man-h2">🎋 대숲 — 완전 익명 게시판</div>
      <p class="man-p">머리말의 <b>🎋 대숲</b> 을 누르면 열려요.
      보드의 <b>빈 곳을 클릭</b>하면 그 자리에 쪽지가 붙습니다.
      색은 여덟 가지 중에 고르고, 한 장에 <b>200자</b>까지 적을 수 있어요.</p>

      <div class="man-warn">
        <b>정말로 익명이에요.</b> 서버에 저장되는 것은 글 · 색 · 자리 · 시각 · ♥ 개수뿐이고,
        <b>필명도 계정도 남지 않습니다.</b> 방장도 누가 썼는지 알 수 없어요.
      </div>

      <table class="man-t"><tbody>
        <tr><td>♥ 공감</td><td>쪽지마다 <b>기기당 한 번</b>이에요. 누가 눌렀는지는 아무도 몰라요</td></tr>
        <tr><td>✕ 지우기</td><td><b>내가 쓴 쪽지에만</b> 보여요. 다만 "내 것"이라는 표시가 이 기기에만 있어서,
            <b>다른 기기에서 열면 ✕ 가 안 보입니다.</b> 브라우저 저장 공간을 지운 뒤에도 마찬가지예요</td></tr>
        <tr><td>🍂 30일</td><td>붙인 지 30일이 지나면 저절로 사라져요. 따로 치울 필요 없어요</td></tr>
      </tbody></table>

      <div class="man-tip">
        익명이라 마음 편히 쓰되, <b>서로를 특정할 수 있는 이야기</b>는 피해주세요.
        작은 방이라 내용만으로도 누군지 짐작되는 일이 생깁니다.
      </div>

      <div class="man-h2">🖥️ 화면 공유 — 뭉갠 그림으로만</div>
      <p class="man-p">머리말의 <b>🖥️ 화면 공유</b> 를 누르고 <b>창을 하나 고르면</b> 시작돼요.
      다시 누르거나 내 카드의 <b>[off]</b> 를 누르면 꺼집니다.
      보여줄 창을 바꾸고 싶으면 내 카드 아래의 <b>"○○의 화면"</b> 글씨를 누르세요 —
      고르기 판이 다시 떠요. <b>끄지 않고 갈아 끼우는 것</b>이라 남들 화면에서 카드가 사라지지 않아요.
      (취소하면 보던 화면이 그대로 계속 나갑니다)</p>

      <div class="man-warn">
        <b>원본은 내 컴퓨터를 벗어나지 않아요.</b> 5초에 한 번, <b>내 컴퓨터에서 먼저</b>
        아주 작게 줄여 글자를 못 읽게 뭉갠 다음 그 작은 그림 한 장만 내보냅니다.
        원본 화면은 서버에도 다른 사람에게도 절대 나가지 않아요.
      </div>

      <table class="man-t"><tbody>
        <tr><td><b>누가 볼 수 있나</b></td><td><b>같이 공유 중인 사람끼리만</b> 서로 보여요.
            내가 공유를 끄면 남의 화면도 안 보입니다</td></tr>
        <tr><td><b>누가 켰는지 알기</b></td><td>누군가 공유를 켜면 머리말의 <b>🖥️ 화면 공유</b> 버튼이
            <b>옅은 붉은색</b>으로 물들어요. 내가 켜면 <b>진한 붉은색</b>이 되고요.
            마우스를 올리면 몇 명이 켰는지 보입니다</td></tr>
        <tr><td>어디에 보이나</td><td>공유하는 사람의 <b>프로필 카드 바로 옆</b>에 같은 크기의 카드가 하나 더 떠요</td></tr>
        <tr><td>모니터? 창?</td><td>고르기 창에서 <b>[창]</b> 을 고르면 그 창 하나만 나가요.
            <b>그 위에 겹친 알림이나 다른 창은 안 찍힙니다.</b> [전체 화면]을 고르면 화면에 뜨는 게 다 나가요</td></tr>
        <tr><td>갱신</td><td>5초에 한 장이라 뚝뚝 끊겨 보여요. 영상이 아니라 사진이 갈리는 거예요</td></tr>
        <tr><td>끊김</td><td>20초 넘게 새 그림이 안 오면 카드가 <b>흐려지고</b>, 30초가 넘으면 목록에서 빠져요</td></tr>
      </tbody></table>

      <div class="man-tip">
        <b>크롬 · 엣지 PC에서만</b> 돼요. 휴대폰과 사파리는 화면 캡쳐 자체가 안 돼서 버튼이 흐리게 보입니다.<br>
        창을 그냥 닫아도 내 그림은 서버에서 자동으로 지워져요.
      </div>
    `
  },
  {
    id: "idle",
    tab: "자리비움",
    html: `
      <p class="man-p">머리말 맨 왼쪽의 <b>🖱️ 자동감지</b> 버튼이에요.
      켜두면 <b>키보드·마우스를 20분 동안 안 만졌을 때</b> 내 상태가
      저절로 <b>💤 AWAY</b> 로 바뀝니다. 다시 만지면 원래 상태로 돌아와요.</p>

      <div class="man-tip">
        <b>왜 필요한가요?</b> WORK 로 켜둔 채 자리를 뜨면 그 시간이 전부 집필 시간으로 쌓여요.
        켜두면 잊어버려도 알아서 정리됩니다. <b>안 켜도 지금처럼 쓸 수 있어요</b> — 각자 고르면 돼요.
      </div>

      <table class="man-t"><tbody>
        <tr><td>켜고 끄기</td><td>버튼을 누르면 <b>자동감지 ON / OFF</b> 가 바뀌어요.
            처음 켤 때 브라우저가 <b>권한을 물어봅니다</b> — 허용해야 작동해요</td></tr>
        <tr><td>무엇을 보나</td><td><b>컴퓨터 전체</b>의 키보드·마우스예요.
            더마감 창을 내려두고 <b>한글·스크리브너에서 글을 써도 "쓰는 중"으로 봅니다.</b>
            화면 잠금이 걸려도 자리비움이 돼요</td></tr>
        <tr><td>돌아올 때</td><td>키보드나 마우스를 만지면 <b>아까 그 상태로</b> 알아서 돌아와요</td></tr>
        <tr><td>직접 고른 AWAY</td><td><b>내가 손으로 고른 자리비움은 안 건드려요.</b>
            자동으로 바뀐 것만 자동으로 돌아옵니다</td></tr>
      </tbody></table>

      <div class="man-warn">
        <b>크롬 · 엣지에서만</b> 돼요 (사파리·파이어폭스는 이 기능이 없어요).
        그리고 <b>더마감 주소로 접속했을 때만</b> 작동해요 — 파일을 직접 열어보면 권한이 막힙니다.
      </div>

      <p class="man-p">그래도 <b>잠깐 자리를 뜬다</b>거나 <b>컴퓨터는 쓰지만 글은 안 쓴다</b> 싶으면,
      카드의 상태표를 눌러 직접 바꾸는 게 제일 정확해요. 자동감지는 <b>깜빡했을 때를 위한 보험</b>입니다.</p>
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
        <tr><td>🎨 테마</td><td>설정에서 배경과 말풍선 색을 골라요. 어두운 테마와 원고지·잉크 같은 결도 있어요</td></tr>
        <tr><td>⚙️ 설정</td><td>탭 넷이에요 — <b>💬 채팅 · 👤 프로필 · 🎨 테마 · 🔒 개인정보</b></td></tr>
        <tr><td>좌우 뒤집기</td><td>배치를 통째로 좌우로 뒤집어요</td></tr>

        <tr><td>칸 크기</td><td>칸 사이 손잡이를 끌어서. 더블클릭하면 기본값</td></tr>
        <tr><td><b>우클릭</b></td><td>화면 대부분에서 <b>우클릭 메뉴가 안 떠요</b> — 무심코 남의 화면이나 쪽지를 저장하는 걸 줄이려고요.
            <b>글을 쓰는 칸(채팅·할 일·대숲)에서는 그대로 됩니다</b> — 붙여넣기와 맞춤법 검사는 평소처럼 쓰세요.
            남의 말을 인용할 때도 <b>글자를 끌어서 고른 뒤</b> 우클릭하면 복사돼요</td></tr>
        <tr><td><b>앱처럼 쓰기</b></td><td>크롬·엣지 주소창 오른쪽의 <b>설치 아이콘(⊕)</b>, 사파리는 <b>공유 → Dock에 추가</b>. 주소창 없는 <b>독립 창</b>으로 열려서 화면이 넓어지고, <b>알림이 제 시각에</b> 옵니다. 설치 안 해도 지금처럼 쓸 수 있어요</td></tr>
      </tbody></table>

      <div class="man-tip">
        테마 · 글자 크기 · 칸 크기 · <b>자리 배치</b> · 접어둔 영역은 <b>이 기기에만</b> 저장돼요.<br>
        프사와 할 일은 필명을 따라다니니 다른 기기에서 들어와도 그대로예요.
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
  /* 열자마자 닫기 단추에 초점을 둡니다 — 키보드만 쓰는 분이 바로 닫을 수 있게 */
  modal.querySelector(".modal-x")?.focus();
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
