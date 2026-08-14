/* TheMagam © 그링링 · 무단 복제·재배포 금지 */
/* =====================================================================
   script_sticker.js — 채팅 스티커 (2026-08-10)
   ---------------------------------------------------------------------
   [무엇인가]
   말풍선 대신 크게 뜨는 손그림 열다섯 개. 채팅과 수다방 양쪽에서 씁니다.

   [왜 그림 파일이 아니라 코드로 그리나]
   PNG 를 쓰려면 파일 저장소(Firebase Storage)가 필요하고, 그건 요금제를
   올려야 합니다. 그림을 글자로 바꿔 메시지에 실어 보내는 방법도 있지만
   한 장에 수십 KB 라 채팅이 무거워져요.

   SVG 는 선과 도형을 코드로 적는 방식이라 열다섯 개를 다 합쳐도 몇 KB 고,
   확대해도 안 깨지며, 저장소가 필요 없습니다. 더마감은 이미 프사 눈사람을
   이 방식으로 그리고 있어요.

   [서버에는 무엇이 남나]
   `[[스티커:pat]]` 같은 **짧은 글자 하나**뿐입니다. 그림은 각자 화면에서
   그려집니다. 그래서 통신량이 늘지 않고, 나중에 그림을 고쳐도 지난
   채팅까지 함께 바뀝니다.

   [크레파스 느낌은 두 가지를 겹쳤습니다]
     ① 손글씨 글꼴 — 감자꽃(Gamja Flower). index.html 에서 불러옵니다.
     ② 흔들림 필터 — feTurbulence 로 선을 미세하게 울퉁불퉁하게.
        그림 테두리와 글씨에 함께 걸려서 종이에 그린 것처럼 보입니다.

   ★ 글꼴은 인터넷에서 받아옵니다. 느리거나 막히면 잠깐 기본 글꼴로
     보였다가 바뀝니다 — 글자가 사라지진 않아요.
   ===================================================================== */
(function () {
  "use strict";

  /* 저장되는 값(id)은 짧은 영문입니다. 나중에 이름이나 그림을 바꿔도
     지난 채팅이 깨지지 않게요. cmd 는 슬래시로 부르는 이름입니다. */
  const STICKERS = [
    {
      /* 인사가 맨 앞 — 판을 열면 제일 먼저 눈에 들어오는 자리입니다.
         들어오자마자 쓰는 스티커라 손이 가장 자주 갈 거예요. */
      id: "hi", cmd: "방가", label: "방가방가",
      svg: `<circle cx="30" cy="32" r="14" fill="#8FB8E0"/>
            <circle cx="25" cy="30" r="1.8" fill="#3A2A22"/>
            <circle cx="35" cy="30" r="1.8" fill="#3A2A22"/>
            <path d="M25 36q5 5 10 0" stroke="#3A2A22" stroke-width="1.9" fill="none" stroke-linecap="round"/>
            <circle cx="20" cy="36" r="2.4" fill="#F0A0B8" opacity=".75"/>
            <circle cx="40" cy="36" r="2.4" fill="#F0A0B8" opacity=".75"/>
            <path d="M45 30q6-2 8-8" stroke="#3A2A22" stroke-width="2.4" fill="none" stroke-linecap="round"/>
            <ellipse cx="55" cy="19" rx="6" ry="5" fill="#F3DCC4" stroke="#3A2A22"
                     stroke-width="1.7" transform="rotate(18 55 19)"/>
            <path d="M60 9l3-3M64 15h4M59 22l3 3" stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#2F6191"
    },
    {
      /* 인사 둘을 나란히 — 처음 만났을 때(방가)와 다시 만났을 때(리하이).
         두 얼굴이 마주보는 그림으로, 혼자 손 흔드는 방가와 구분됩니다.
         (재출근이 이미 ↻ 를 쓰고 있어서 화살표는 피했어요) */
      id: "rehi", cmd: "리하이", label: "리하이",
      svg: `<circle cx="24" cy="34" r="11" fill="#AFA9EC"/>
            <circle cx="21" cy="33" r="1.6" fill="#3A2A22"/>
            <circle cx="28" cy="33" r="1.6" fill="#3A2A22"/>
            <path d="M21 38q3.5 3 7 0" stroke="#3A2A22" stroke-width="1.7" fill="none" stroke-linecap="round"/>
            <circle cx="48" cy="34" r="11" fill="#CFC9F4"/>
            <circle cx="44" cy="33" r="1.6" fill="#3A2A22"/>
            <circle cx="51" cy="33" r="1.6" fill="#3A2A22"/>
            <path d="M44 38q3.5 3 7 0" stroke="#3A2A22" stroke-width="1.7" fill="none" stroke-linecap="round"/>
            <path d="M36 22c-2-3-6-2-6 1 0 2.6 3.6 4.6 6 6.4 2.4-1.8 6-3.8 6-6.4 0-3-4-4-6-1z"
                  fill="#F0A0B8" stroke="#3A2A22" stroke-width="1.3" stroke-linejoin="round"/>
            <path d="M14 20l2 3M58 20l-2 3" stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#4A3F9E"
    },
    {
      /* 인사 셋을 나란히 — 방가(처음) · 리하이(다시) · 어서와요(맞이).
         앞의 둘은 들어온 사람이 하는 말이고, 이건 **맞는 쪽**이 하는
         말이라 얼굴 하나가 아니라 두 팔을 벌린 온몸으로 그렸습니다. */
      id: "welcome", cmd: "어서와", label: "어서와요",
      cmdRe: /^\/(어서와|어서와요|환영)$/,
      svg: `<circle cx="36" cy="26" r="10" fill="#6FBF9B"/>
            <circle cx="32" cy="25" r="1.6" fill="#3A2A22"/>
            <circle cx="40" cy="25" r="1.6" fill="#3A2A22"/>
            <path d="M32 30q4 3.5 8 0" stroke="#3A2A22" stroke-width="1.7" fill="none" stroke-linecap="round"/>
            <path d="M28 38q-9 3-12 12M44 38q9 3 12 12" stroke="#3A2A22" stroke-width="2.6" fill="none" stroke-linecap="round"/>
            <path d="M36 36v16" stroke="#3A2A22" stroke-width="2.4" stroke-linecap="round"/>
            <path d="M13 34c-1.4-2-4.2-1.4-4.2.7 0 1.8 2.5 3.1 4.2 4.4 1.7-1.3 4.2-2.6 4.2-4.4 0-2.1-2.8-2.7-4.2-.7z"
                  fill="#F0A0B8" stroke="#3A2A22" stroke-width="1.1"/>
            <path d="M59 34c-1.4-2-4.2-1.4-4.2.7 0 1.8 2.5 3.1 4.2 4.4 1.7-1.3 4.2-2.6 4.2-4.4 0-2.1-2.8-2.7-4.2-.7z"
                  fill="#F0A0B8" stroke="#3A2A22" stroke-width="1.1"/>`,
      textColor: "#2E7D57"
    },
    {
      /* ★ 방가방가가 이미 "얼굴 + 흔드는 손" 입니다. 잘가요까지 얼굴을
         넣으면 판에서 둘이 헷갈려요. 그래서 **손만** 크게 그리고,
         흔들리는 결을 양옆에 넣어 움직임으로 구분했습니다. */
      id: "bye", cmd: "잘가", label: "잘가요",
      cmdRe: /^\/(잘가|잘가요|바이)$/,
      svg: `<path d="M32 46V28c0-3 4-3 4 0v10M36 38V24c0-3 4-3 4 0v14M40 38V26c0-3 4-3 4 0v12M44 40V30c0-3 4-3 4 0v12c0 8-4 14-10 14-7 0-12-5-12-12v-6c0-3 4-3 4 0z"
                  fill="#F3DCC4" stroke="#3A2A22" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M18 22q-4-3-4-7M20 30q-6 0-9-3M56 22q4-3 4-7M54 30q6 0 9-3"
                  stroke="#8FB8E0" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
      textColor: "#2F6191"
    },
    {
      /* ── 밥 셋 ─────────────────────────────────────────────
         날마다 오갈 말이라 인사 바로 뒤, 판의 첫 줄 언저리에 둡니다.
         밥그릇 하나를 셋이 나눠 쓰되 한눈에 갈리게 했어요 —
           밥탐 : 곁눈질하는 얼굴 + 하트 (셋 중 유일하게 얼굴이 있음)
           맛점 : 해 + 노란 그릇
           맛저 : 초승달·별 + 파란 그릇 (색이 차가워 맛점과 안 헷갈림) */
      id: "yum", cmd: "밥탐", label: "밥탐",
      cmdRe: /^\/(밥탐|배고파|배고픔)$/,
      svg: `<path d="M27 34q12-11 24 0z" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M22 34h34c0 10-7.6 16-17 16s-17-6-17-16z" fill="#F0997B" stroke="#3A2A22"
                  stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M22 34h34" stroke="#3A2A22" stroke-width="1.6"/>
            <circle cx="12" cy="24" r="8" fill="#F0C674"/>
            <circle cx="9.5" cy="23" r="1.9" fill="#3A2A22"/>
            <circle cx="15" cy="23" r="1.9" fill="#3A2A22"/>
            <path d="M10 28q2.5 2.5 5 0" stroke="#3A2A22" stroke-width="1.6" fill="none" stroke-linecap="round"/>
            <path d="M14 31q1 3 0 4" stroke="#8FB8E0" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <path d="M60 20c-1.6-2.4-5-1.6-5 .8 0 2.1 3 3.7 5 5.2 2-1.5 5-3.1 5-5.2 0-2.4-3.4-3.2-5-.8z"
                  fill="#F0A0B8" stroke="#3A2A22" stroke-width="1.2" stroke-linejoin="round"/>`,
      textColor: "#993C1D"
    },
    {
      id: "lunch", cmd: "맛점", label: "맛점",
      cmdRe: /^\/(맛점|점심)$/,
      svg: `<circle cx="55" cy="14" r="6" fill="#F3D9A0" stroke="#3A2A22" stroke-width="1.5"/>
            <path d="M55 4v3M64 14h-3M62 7l-2 2M62 21l-2-2" stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M27 36q12-11 24 0z" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M22 36h34c0 10-7.6 16-17 16s-17-6-17-16z" fill="#F0C674" stroke="#3A2A22"
                  stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M22 36h34" stroke="#3A2A22" stroke-width="1.6"/>
            <path d="M30 26q3-4 0-8M45 26q3-4 0-8" stroke="#C9BCA8" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      textColor: "#C2762B"
    },
    {
      id: "dinner", cmd: "맛저", label: "맛저",
      cmdRe: /^\/(맛저|저녁)$/,
      svg: `<path d="M58 8a8 8 0 1 0 5 14 9.5 9.5 0 0 1-5-14z" fill="#EDE9F5" stroke="#3A2A22"
                  stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M13 12l1.6 3.4L18 17l-3.4 1.6L13 22l-1.6-3.4L8 17l3.4-1.6z" fill="#AFA9EC"/>
            <path d="M45 8l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#AFA9EC"/>
            <path d="M27 36q12-11 24 0z" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M22 36h34c0 10-7.6 16-17 16s-17-6-17-16z" fill="#8FB8E0" stroke="#3A2A22"
                  stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M22 36h34" stroke="#3A2A22" stroke-width="1.6"/>
            <path d="M30 26q3-4 0-8M45 26q3-4 0-8" stroke="#C9BCA8" stroke-width="2" fill="none" stroke-linecap="round"/>`,
      textColor: "#2F6191"
    },
    {
      id: "pat", cmd: "토닥", label: "토닥토닥",
      svg: `<circle cx="27" cy="34" r="14" fill="#F0C674"/>
            <circle cx="22" cy="33" r="1.7" fill="#3A2A22"/>
            <circle cx="32" cy="33" r="1.7" fill="#3A2A22"/>
            <path d="M23 39q4 3 8 0" stroke="#3A2A22" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <ellipse cx="41" cy="19" rx="7" ry="5" fill="#F3DCC4" stroke="#3A2A22" stroke-width="1.8"/>
            <path d="M43 24q3 3 2 7" stroke="#3A2A22" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            <path d="M35 11v3M41 10v4M47 13v3" stroke="#B3372B" stroke-width="2" stroke-linecap="round" opacity=".65"/>`,
      textColor: "#B3372B"
    },
    {
      id: "fight", cmd: "파이팅", label: "파이팅",
      svg: `<circle cx="36" cy="32" r="14" fill="#6FBF9B"/>
            <circle cx="31" cy="30" r="1.7" fill="#3A2A22"/>
            <circle cx="41" cy="30" r="1.7" fill="#3A2A22"/>
            <path d="M31 37q5 4 10 0" stroke="#3A2A22" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <path d="M22 24 18 14M50 24l4-10" stroke="#3A2A22" stroke-width="2.6" stroke-linecap="round"/>
            <circle cx="17" cy="11" r="3" fill="#B3372B"/>
            <circle cx="55" cy="11" r="3" fill="#B3372B"/>`,
      textColor: "#2E7D57"
    },
    /* [2026-08-11] 응원 두 장. 🙌 파이팅 옆에 나란히 둡니다 —
       고르는 판에서 비슷한 결끼리 모여 있어야 눈이 덜 헤맵니다. */
    {
      id: "cheerup", cmd: "힘내", label: "힘내요",
      svg: `<circle cx="28" cy="33" r="13" fill="#F2B07A"/>
            <path d="M21.5 32l2.5-3 2.5 3M30.5 32l2.5-3 2.5 3" stroke="#3A2A22" stroke-width="1.9"
                  fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M24 39q4 4 8 0" stroke="#3A2A22" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <path d="M40 41q9 2 10-7" stroke="#3A2A22" stroke-width="2.8" fill="none" stroke-linecap="round"/>
            <path d="M43 36q5-1 6-6" stroke="#3A2A22" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/>
            <circle cx="51" cy="27" r="5.5" fill="#F2B07A" stroke="#3A2A22" stroke-width="1.8"/>
            <path d="M58 13l1.4 3.2 3.2 1.4-3.2 1.4-1.4 3.2-1.4-3.2-3.2-1.4 3.2-1.4z" fill="#B3372B" opacity=".75"/>`,
      textColor: "#993C1D"
    },
    {
      id: "cando", cmd: "할뚜", label: "할뚜이따",
      svg: `<circle cx="36" cy="32" r="14" fill="#F6C8D6"/>
            <path d="M28 31l3-3 3 3M38 31l3-3 3 3" stroke="#3A2A22" stroke-width="1.9"
                  fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <ellipse cx="36" cy="39" rx="3.4" ry="2.9" fill="#B3372B"/>
            <circle cx="25" cy="36" r="2.6" fill="#F0A0B8" opacity=".85"/>
            <circle cx="47" cy="36" r="2.6" fill="#F0A0B8" opacity=".85"/>
            <circle cx="17" cy="41" r="4.6" fill="#F6C8D6" stroke="#3A2A22" stroke-width="1.7"/>
            <circle cx="55" cy="41" r="4.6" fill="#F6C8D6" stroke="#3A2A22" stroke-width="1.7"/>
            <path d="M13 29l-3-3M59 29l3-3M36 15v-4" stroke="#F0C674" stroke-width="2.4" stroke-linecap="round"/>`,
      textColor: "#C2557A"
    },
    {
      id: "away", cmd: "자리비움", label: "자리 비움",
      svg: `<rect x="18" y="24" width="36" height="22" rx="6" fill="#EDE3D2" stroke="#3A2A22" stroke-width="1.8"/>
            <path d="M26 32h20M26 38h13" stroke="#8A7B68" stroke-width="2" stroke-linecap="round"/>
            <text x="50" y="17" font-family="'Gamja Flower',cursive" font-size="17" fill="#8FB8E0">zZ</text>`,
      textColor: "#6B7C8C"
    },
    {
      id: "off", cmd: "퇴근", label: "퇴근",
      svg: `<path d="M16 32 36 17l20 15" stroke="#3A2A22" stroke-width="2.4" fill="none" stroke-linejoin="round"/>
            <rect x="22" y="31" width="28" height="17" rx="4" fill="#F0C674" stroke="#3A2A22" stroke-width="1.8"/>
            <rect x="32" y="38" width="8" height="10" rx="2" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.5"/>
            <circle cx="57" cy="14" r="5" fill="#F3D9A0"/>
            <path d="M57 6v3M64 14h-3M62 9l-2 2" stroke="#F0C674" stroke-width="2" stroke-linecap="round"/>`,
      textColor: "#C2762B"
    },
    {
      id: "on", cmd: "출근", label: "출근",
      svg: `<circle cx="36" cy="30" r="13" fill="#FFFDF6" stroke="#3A2A22" stroke-width="1.8"/>
            <path d="M36 22v8l5 4" stroke="#B3372B" stroke-width="2.4" stroke-linecap="round" fill="none"/>
            <path d="M24 48h24M30 48l3-5M42 48l-3-5" stroke="#3A2A22" stroke-width="2" stroke-linecap="round"/>`,
      textColor: "#B3372B"
    },
    {
      id: "reon", cmd: "재출근", label: "재출근",
      svg: `<path d="M50 32a14 14 0 1 1-5-10.7" stroke="#6FBF9B" stroke-width="3.4" fill="none" stroke-linecap="round"/>
            <path d="M46 12v10H36" stroke="#6FBF9B" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="31" cy="30" r="1.8" fill="#3A2A22"/>
            <circle cx="41" cy="30" r="1.8" fill="#3A2A22"/>
            <path d="M31 37q5 4 10 0" stroke="#3A2A22" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
      textColor: "#2E7D57"
    },
    {
      /* 따봉 — 방에서 제일 자주 오갈 말이라 크고 단순하게.
         손등(코랄)과 소매(연한 코랄)를 나눠서 작게 줄여도 형태가 삽니다. */
      id: "good", cmd: "좋아", label: "좋아요",
      svg: `<path d="M31 47V31l7-11c2-3 6.4-2 6 2l-1 7h9c2.6 0 4.4 2.4 3.6 4.8l-3.4 10.4
                     c-.7 2-2.6 3.4-4.7 3.4H31z"
                  fill="#F0997B" stroke="#3A2A22" stroke-width="1.8" stroke-linejoin="round"/>
            <rect x="18" y="31" width="12" height="17" rx="3.5"
                  fill="#F6C4AC" stroke="#3A2A22" stroke-width="1.7"/>
            <path d="M52 13l3-3M58 19h5M56 26l3 2" stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#993C1D"
    },
    {
      /* ★ 따봉은 이미 좋아요가 쓰고 있습니다. 최고예요까지 손을 쓰면
         둘이 겹쳐서, 별에 얼굴을 붙였습니다. */
      id: "best", cmd: "최고", label: "최고예요",
      cmdRe: /^\/(최고|최고예요|짱)$/,
      svg: `<path d="M36 14l6.6 13.4L57 29.6 46.5 40l2.5 14.5L36 47.7 22.5 54.5 25 40 14.5 29.6l14.9-2.2z"
                  fill="#F0C674" stroke="#3A2A22" stroke-width="1.8" stroke-linejoin="round"/>
            <circle cx="31" cy="33" r="1.7" fill="#3A2A22"/>
            <circle cx="41" cy="33" r="1.7" fill="#3A2A22"/>
            <path d="M31 39q5 4 10 0" stroke="#3A2A22" stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <path d="M9 12l3 3M63 12l-3 3M36 4v4" stroke="#F0997B" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#C2762B"
    },
    {
      /* 고마워요 — 두 손으로 하트를 받쳐 든 모양.

         ★ 처음에는 두 손을 위아래로 붙여 모은 모양(🙏)이었는데,
           작게 줄이면 손 둘이 한 덩어리로 뭉쳐 보여서 무슨 그림인지
           안 읽혔습니다. 손을 **양옆으로 벌리고** 사이에 하트를 띄우니
           비로소 "건네는" 모양이 됐어요. */
      id: "thanks", cmd: "고마워", label: "고마워요",
      cmdRe: /^\/(고마워|고마워요|감사|땡큐)$/,
      svg: `<path d="M36 30c-3.5-4.6-10.5-3.4-10.5 2.9 0 5.2 7 9.2 10.5 12.6 3.5-3.4 10.5-7.4 10.5-12.6 0-6.3-7-7.5-10.5-2.9z"
                  fill="#F0A0B8" stroke="#3A2A22" stroke-width="1.7" stroke-linejoin="round"/>
            <ellipse cx="24" cy="50" rx="11" ry="6.5" fill="#F3DCC4" stroke="#3A2A22"
                     stroke-width="1.7" transform="rotate(-20 24 50)"/>
            <ellipse cx="48" cy="50" rx="11" ry="6.5" fill="#F3DCC4" stroke="#3A2A22"
                     stroke-width="1.7" transform="rotate(20 48 50)"/>
            <path d="M14 22l2 3M58 22l-2 3M36 14v4" stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#993C1D"
    },
    {
      /* 끄덕끄덕 — 얼굴이 아래로 살짝 기울고, 위아래 움직임을 곡선 둘로.
         "듣고 있어요" 에 가까운 말이라 색은 차분한 연두로. */
      id: "nod", cmd: "끄덕", label: "끄덕끄덕",
      cmdRe: /^\/(끄덕|ㅇㅇ)$/,
      svg: `<g transform="rotate(9 36 32)">
              <circle cx="36" cy="32" r="14" fill="#C0DD97"/>
              <path d="M30 29q0 0 0 0" stroke="#3A2A22" stroke-width="3.4" stroke-linecap="round"/>
              <circle cx="31" cy="30" r="1.8" fill="#3A2A22"/>
              <circle cx="41" cy="30" r="1.8" fill="#3A2A22"/>
              <path d="M31 37q5 3.5 10 0" stroke="#3A2A22" stroke-width="1.8"
                    fill="none" stroke-linecap="round"/>
            </g>
            <path d="M17 20q3-4 6 0M17 44q3 4 6 0" stroke="#7FA84E" stroke-width="2.2"
                  fill="none" stroke-linecap="round"/>
            <path d="M55 20q-3-4-6 0M55 44q-3 4-6 0" stroke="#7FA84E" stroke-width="2.2"
                  fill="none" stroke-linecap="round"/>`,
      textColor: "#3B6D11"
    },
    {
      /* 오케이 — 동그라미 안에 체크.

         [다시 그린 이유]
         처음에는 손 모양(엄지·검지로 만든 원 + 뻗은 손가락 셋)을 선으로만
         그렸는데, "손인지 안 보인다"는 얘기가 나왔습니다. 손가락 셋이
         가는 선 세 개로만 남아서, 뜻 없는 획처럼 보였어요.

         손을 제대로 그리는 안도 있었지만 판에서는 58px 까지 줄어듭니다.
         그 크기에서 손가락 셋은 서로 붙어 뭉개져요. 체크는 획이 둘뿐이라
         작아져도 형태가 그대로 남습니다. */
      id: "ok", cmd: "오케이", label: "오케이",
      cmdRe: /^\/(ㅇㅋ|오케이|오키)$/,
      svg: `<circle cx="36" cy="30" r="17" fill="#9BD9C4" stroke="#3A2A22" stroke-width="1.8"/>
            <path d="M27 30l6.5 7L46 23" fill="none" stroke="#1F6B5C"
                  stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M11 16l3 3M58 13l3-3M62 24h4"
                  stroke="#F0C674" stroke-width="2.4" stroke-linecap="round"/>`,
      textColor: "#1F6B5C"
    },
    {
      /* 웃음·울음은 짝으로 둡니다. 얼굴 크기와 눈 위치를 맞춰서
         나란히 놓았을 때 한 세트로 보이게 했어요. */
      id: "haha", cmd: "ㅋㅋ", label: "ㅋㅋㅋ",
      /* /ㅋ 부터 /ㅋㅋㅋㅋㅋ 까지 다 받습니다 — 웃을 때 몇 번 치는지는
         그때그때 다르니까요. (아래 cmdRe) */
      cmdRe: /^\/ㅋ{1,12}$/,
      svg: `<circle cx="36" cy="30" r="15" fill="#F7D154"/>
            <path d="M27 26q3.5-4.5 7 0M38 26q3.5-4.5 7 0"
                  stroke="#3A2A22" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            <path d="M26 34q10 13 20 0z" fill="#B3372B" stroke="#3A2A22"
                  stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M13 21l-4-3M14 29h-5M59 21l4-3M58 29h5"
                  stroke="#F0C674" stroke-width="2.2" stroke-linecap="round"/>`,
      textColor: "#B07D12"
    },
    {
      /* ㅎㅎ 는 ㅋㅋ 보다 한 톤 낮은 웃음입니다 — 입을 벌리지 않고
         눈웃음에 볼만 발그레하게. 색도 노랑 대신 살구빛으로 낮췄어요. */
      id: "hehe", cmd: "ㅎㅎ", label: "ㅎㅎㅎ",
      cmdRe: /^\/ㅎ{1,12}$/,
      svg: `<circle cx="36" cy="30" r="15" fill="#F5C4B3"/>
            <path d="M27 28q3.5-4.5 7 0M38 28q3.5-4.5 7 0"
                  stroke="#3A2A22" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            <path d="M30 37q6 5 12 0" stroke="#3A2A22" stroke-width="1.9"
                  fill="none" stroke-linecap="round"/>
            <circle cx="24" cy="35" r="3" fill="#E88A78" opacity=".7"/>
            <circle cx="48" cy="35" r="3" fill="#E88A78" opacity=".7"/>`,
      textColor: "#A34A32"
    },
    {
      id: "cry", cmd: "ㅠㅠ", label: "ㅠㅠㅠ",
      /* ㅠ 와 ㅜ 를 섞어 쳐도 받습니다 */
      cmdRe: /^\/[ㅠㅜ]{1,12}$/,
      svg: `<circle cx="36" cy="30" r="15" fill="#A8C8E8"/>
            <path d="M27 27q3.5 4.5 7 0M38 27q3.5 4.5 7 0"
                  stroke="#3A2A22" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            <path d="M31 39q5-4 10 0" stroke="#3A2A22" stroke-width="1.9"
                  fill="none" stroke-linecap="round"/>
            <path d="M30 32q-2.5 5-2.5 7.5a2.5 2.5 0 0 0 5 0Q32.5 37 30 32z" fill="#5B9BD5"/>
            <path d="M42 32q-2.5 5-2.5 7.5a2.5 2.5 0 0 0 5 0Q44.5 37 42 32z" fill="#5B9BD5"/>`,
      textColor: "#2F6191"
    },
    {
      /* 죽겠어요 — 마감 앞둔 방에서 가장 자주 오갈 말입니다.
         눈이 ×× 로 풀린 얼굴에서 영혼이 빠져나가는 모양이에요.
         스무 개 중 유일하게 보라 계열이라 판에서 바로 눈에 띕니다. */
      id: "dead", cmd: "죽겠다", label: "죽겠어요",
      cmdRe: /^\/(죽겠다|죽겠어|힘들어)$/,
      svg: `<ellipse cx="34" cy="40" rx="16" ry="12" fill="#C9C2D8"/>
            <path d="M25 35l6 6M31 35l-6 6M39 35l6 6M45 35l-6 6"
                  stroke="#3A2A22" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M30 47q4-3 8 0" stroke="#3A2A22" stroke-width="1.9" fill="none" stroke-linecap="round"/>
            <path d="M50 34q5-2 4-7t3-8" stroke="#A79FC4" stroke-width="2" fill="none"
                  stroke-linecap="round" stroke-dasharray="3 3"/>
            <circle cx="58" cy="16" r="4.5" fill="#EDE9F5" stroke="#A79FC4" stroke-width="1.4"/>`,
      textColor: "#5A5175"
    },
    {
      id: "cheer", cmd: "축하", label: "축하",
      svg: `<path d="M36 44 20 24h32z" fill="#F0A0B8" stroke="#3A2A22" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M20 24h32l-6-8H26z" fill="#F6C8D6" stroke="#3A2A22" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M12 14l3 4M60 14l-3 4M36 8v4" stroke="#F0C674" stroke-width="2.4" stroke-linecap="round"/>`,
      textColor: "#C2557A"
    }
  ];

  const MARK_RE = /^\[\[스티커:([a-z]+)\]\]$/;
  const byId = (id) => STICKERS.find(s => s.id === id) || null;

  window.STICKERS = STICKERS;
  window.isStickerMsg = (msg) => MARK_RE.test(String(msg || "").trim());

  /* 흔들림 필터는 화면에 딱 하나만 둡니다 (스티커마다 만들면 무거워요) */
  function ensureFilter() {
    if (document.getElementById("sticker-filter-host")) return;
    const host = document.createElement("div");
    host.id = "sticker-filter-host";
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    host.innerHTML = `<svg><filter id="crayon-rough">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6"
                           xChannelSelector="R" yChannelSelector="G"/>
      </filter></svg>`;
    document.body.appendChild(host);
  }

  /** 채팅 말풍선 자리에 들어갈 그림. 못 알아보는 값이면 빈 문자열. */
  window.stickerHtml = function (msg, size) {
    const m = String(msg || "").trim().match(MARK_RE);
    const s = m && byId(m[1]);
    if (!s) return "";
    ensureFilter();
    const px = size || 104;
    return `<svg class="msg-sticker" width="${px}" height="${px}" viewBox="0 0 72 82"
                 role="img" aria-label="${s.label}" filter="url(#crayon-rough)">
      ${s.svg}
      <text x="36" y="72" text-anchor="middle" font-size="22"
            font-family="'Gamja Flower', cursive" fill="${s.textColor}"
            stroke="${s.textColor}" stroke-width="0.5" paint-order="stroke"
      >${s.label}</text>
    </svg>`;
  };

  /* =====================================================================
     고르기 판
     ---------------------------------------------------------------------
     보내는 길은 새로 뚫지 않습니다. 입력칸에 `[[스티커:id]]` 를 적고
     원래 send() 를 부릅니다 — 그러면 수다방으로 갈지 채팅으로 갈지,
     답장인지 아닌지까지 기존 흐름이 알아서 판단해요.
     ===================================================================== */
  let _pop = null;

  function close() {
    if (!_pop) return;
    _pop.remove();
    _pop = null;
    document.removeEventListener("click", onDoc, true);
    document.removeEventListener("keydown", onKey, true);
  }
  function onDoc(e) {
    if (_pop && !_pop.contains(e.target) && !e.target.closest("#sticker-btn")) close();
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  function pick(id) {
    const el = document.getElementById("message");
    if (!el) return;
    el.value = `[[스티커:${id}]]`;
    close();
    window.send?.();
    el.focus();
    countForAchv(id);
  }

  /* 🏅 업적에 알리기 — 인사왕·토닥이·스티커 수집가가 이 숫자를 봅니다.
     ★ 업적 파일이 없어도 스티커는 그대로 돌아야 하므로 ?. 로 부릅니다. */
  function countForAchv(id) {
    try {
      window.achvBump?.("stk", id);                 // 종류 모으기
      /* [2026-08-11] 어느 스티커가 어느 업적에 드는지 한곳에 모았습니다.
         전에는 if 가 흩어져 있어서, 스티커를 늘릴 때 업적 쪽을 같이
         고쳐야 한다는 걸 놓치기 쉬웠어요.
         ★ 겹쳐도 됩니다 — 🙌 힘내요는 토닥이에도, 응원왕에도 듭니다.
           위로이면서 응원이니까요. */
      const ACHV_STK = {
        cGreet: ["hi", "rehi", "welcome", "bye"],   // 👋 인사왕
        cPat:   ["pat", "cheerup"],                  // 🫶 토닥이
        cCheer: ["fight", "cheerup", "cando"]        // 📣 응원왕
      };
      Object.keys(ACHV_STK).forEach(k => {
        if (ACHV_STK[k].includes(id)) window.achvBump?.(k);
      });
    } catch (e) {}
  }

  window.toggleStickerPicker = function () {
    if (_pop) { close(); return; }
    const btn = document.getElementById("sticker-btn");
    if (!btn) return;
    ensureFilter();

    const pop = document.createElement("div");
    pop.className = "sticker-pop";
    pop.setAttribute("role", "menu");
    pop.setAttribute("aria-label", "스티커 고르기");
    pop.innerHTML = STICKERS.map(s => `
      <button type="button" class="sticker-opt" data-sticker="${s.id}"
              title="${s.label} (/${s.cmd})" aria-label="${s.label}"
      >${window.stickerHtml(`[[스티커:${s.id}]]`, 58)}</button>`).join("");
    document.body.appendChild(pop);

    const r = btn.getBoundingClientRect();
    /* 🧘 혼자 방의 확대·축소 — 재는 자를 하나로 맞춥니다 (진짜 방은 늘 1) */
    const _z = (window.uiZoom?.() || 1);
    const VW = innerWidth / _z, VH = innerHeight / _z;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = Math.min(r.left / _z, VW - w - 8);
    let top = r.top / _z - h - 8;
    if (top < 8) top = r.bottom / _z + 8;     // 위가 좁으면 아래로
    pop.style.left = Math.max(8, left) + "px";
    pop.style.top = top + "px";

    pop.addEventListener("click", (e) => {
      const b = e.target.closest("[data-sticker]");
      if (b) pick(b.dataset.sticker);
    });

    _pop = pop;
    setTimeout(() => {
      document.addEventListener("click", onDoc, true);
      document.addEventListener("keydown", onKey, true);
    }, 0);
  };

  /* =====================================================================
     /토닥 처럼 쳐서 보내기
     ---------------------------------------------------------------------
     send() 를 고치지 않고 **감싸서** 처리합니다. 보내기 직전에 입력칸의
     `/토닥` 을 `[[스티커:pat]]` 로 바꿔 두면, 그 뒤는 원래 흐름 그대로예요.
     (수다방으로 보낼지 채팅으로 보낼지도 원래 코드가 판단합니다)
     ===================================================================== */
  function installSendHook() {
    const orig = window.send;
    if (typeof orig !== "function" || orig.__stickerHooked) return false;
    const wrapped = function () {
      try {
        const el = document.getElementById("message");
        const m = String(el?.value || "").trim();
        /* cmdRe 가 있으면 그것도 봅니다 — /ㅋ 부터 /ㅋㅋㅋㅋ 까지 받으려고요.
           웃을 때 ㅋ 을 몇 번 치는지는 사람마다 그때그때 다릅니다. */
        const hit = STICKERS.find(s => m === "/" + s.cmd || (s.cmdRe && s.cmdRe.test(m)));
        if (hit) el.value = `[[스티커:${hit.id}]]`;
        /* 판을 안 열고 슬래시로 친 것도 같은 값으로 셉니다 */
        if (hit) countForAchv(hit.id);
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    wrapped.__stickerHooked = true;
    window.send = wrapped;
    return true;
  }

  /* script_chat.js 가 먼저 window.send 를 올려야 감쌀 수 있습니다.
     로드 순서가 어긋나도 되도록 잠깐 기다렸다 다시 시도합니다. */
  (function tryHook(n) {
    if (installSendHook()) return;
    if (n < 40) setTimeout(() => tryHook(n + 1), 100);
  })(0);
})();
