/* TheMagam © 그링링 · 무단 복제·재배포 금지 */

  // =====================================================
  // ✅ Chat render state
  // =====================================================
  let lastRendered = { user: null, ts: 0, ymd: null, msg: "" };
  let autoScrollEnabled = true;
  let unreadCount = 0;

  function scrollChatToBottom(force = false) {
    const box = document.getElementById("chat-box");
    if (!box) return;
    if (force || autoScrollEnabled) box.scrollTop = box.scrollHeight;
  }

  function bindChatScrollGuard() {
    const box = document.getElementById("chat-box");
    if (!box) return;
    box.addEventListener("scroll", () => {
      /* [고침 2026-08-05] 80 → 200px.

         지난 대화를 거슬러 올라가 읽는("연어") 중에 새 메시지가 오면
         화면이 맨 아래로 끌려 내려가 읽던 자리를 잃었습니다. 80px 은
         말풍선 한 개 높이도 안 돼서, 조금만 올려도 다시 붙잡히곤 했어요.
         이제 맨 아래 200px 안을 보고 있을 때만 따라 내려갑니다. */
      const near = (box.scrollHeight - box.scrollTop - box.clientHeight) <= 200;
      autoScrollEnabled = near;
      if (near) {
        unreadCount = 0;
        document.getElementById("new-msg-float")?.classList.add("hidden");
      }
    });
    const floatBtn = document.getElementById("new-msg-float");
    if (floatBtn) floatBtn.onclick = () => scrollChatToBottom(true);
  }

  // =====================================================
  // ✅ DND (방해 금지) 모드 — 현재 세션만, 재접속 시 리셋
  // =====================================================
  let _dndEnabled = false;

  function isDndEnabled() { return _dndEnabled; }

  function toggleDnd(force) {
    _dndEnabled = (typeof force === "boolean") ? force : !_dndEnabled;
    _renderDndButton();
    _renderDndBadge();
  }

  function _renderDndButton() {
    const btn = document.getElementById("dnd-toggle-btn");
    if (!btn) return;
    btn.textContent = _dndEnabled ? "🔕 방해 금지 ON" : "🔔 방해 금지 OFF";
    _dndEnabled ? btn.classList.add("danger") : btn.classList.remove("danger");
  }

  function _renderDndBadge() {
    const info = document.getElementById("my-info");
    if (!info) return;
    let badge = document.getElementById("dnd-badge");
    if (_dndEnabled) {
      if (!badge) {
        badge = document.createElement("span");
        badge.id = "dnd-badge";
        badge.style.cssText = "display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;background:rgba(255,59,48,.12);border:1px solid rgba(255,59,48,.22);font-size:11px;font-weight:950;color:#ff3b30;margin-left:6px;flex-shrink:0;";
        badge.textContent = "🔕 DND";
        info.appendChild(badge);
      }
    } else {
      badge?.remove();
    }
  }

  function _injectDndToggle() {
    const panel = document.getElementById("panel-chat");
    if (!panel || document.getElementById("dnd-block")) return;
    const block = document.createElement("div");
    block.className = "set-block";
    block.id = "dnd-block";
    block.innerHTML = `
      <div class="set-title">🔕 방해 금지 모드</div>
      <button id="dnd-toggle-btn" class="ghost-btn" type="button" style="width:100%;">🔔 방해 금지 OFF</button>
      <div class="hint">ON 상태에서는 멘션 알림음·이펙트 토스트가 모두 차단돼요.<br>재접속하면 자동으로 OFF로 돌아와요.</div>
    `;
    panel.insertBefore(block, panel.firstChild);
    document.getElementById("dnd-toggle-btn")?.addEventListener("click", () => toggleDnd());
    _renderDndButton();
  }

  // =====================================================
  // ✅ 멘션 알림음 — 세션마다 리셋 (기본 켜짐)
  // =====================================================
  let _mentionSoundEnabled = true; // 세션 변수, localStorage 저장 안 함

  function _injectMentionSoundToggle() {
    const panel = document.getElementById("panel-chat");
    if (!panel || document.getElementById("mention-sound-block")) return;
    const block = document.createElement("div");
    block.className = "set-block";
    block.id = "mention-sound-block";
    block.innerHTML = `
      <div class="set-title">멘션 알림음</div>
      <label style="display:flex;align-items:center;gap:10px;font-weight:950;cursor:pointer;">
        <input id="set-mention-sound" type="checkbox" checked>
        누군가 나를 @멘션하면 알림음 재생
      </label>
      <div class="hint">이 설정은 현재 세션에서만 유지돼요. 재접속하면 켜짐으로 돌아와요.</div>
    `;
    panel.insertBefore(block, panel.firstChild);
    document.getElementById("set-mention-sound")?.addEventListener("change", function() {
      _mentionSoundEnabled = this.checked;
    });
  }

  const _origOpenSettings = window.openSettings;
  window.openSettings = function(...args) {
    const ret = _origOpenSettings?.(...args);
    setTimeout(() => { _injectMentionSoundToggle(); _injectDndToggle(); }, 60);
    return ret;
  };

  const _origOpenTab = window.openTab;
  window.openTab = function(name, ...args) {
    const ret = _origOpenTab?.(name, ...args);
    if (name === "chat") setTimeout(() => { _injectMentionSoundToggle(); _injectDndToggle(); }, 60);
    return ret;
  };

  // =====================================================
  // ✅ 슬래시 명령어 정의
  // =====================================================
  /* =====================================================================
     슬래시 명령 — 둘만 남았습니다 (2026-08-10)

     예전에는 열한 개가 있었습니다. /축하 /마감 /환영 /응원 /퇴근 /만세
     /수고 /고추 /선언. 화면에 이모지를 흩뿌리고 시스템 메시지를 한 줄
     남기는, 말하자면 "감정 표현" 도구였어요.

     그 자리를 🖍️ 스티커가 대신하게 되면서 걷어냈습니다. 같은 말을 두
     가지 방법으로 할 수 있으면 매번 어느 쪽을 쓸지 고르게 되고, 결국
     둘 다 어중간하게 쓰입니다. 스티커가 눈에 더 잘 띄고 고르기도 쉬워요.

     남긴 둘은 스티커로 대신할 수 없는 것들입니다 —
       /운세    하루에 한 번 뽑는 값. 그림 하나로는 못 담습니다.
       /외치기  사람이 쓴 문장이 화면 가운데 크게 뜹니다.

     ★ 지난 기록은 지우지 않았습니다.
       · 예전 /선언 메시지는 type:"declaration" 으로 저장되어 있고,
         그리는 코드(아래 renderChatMessage)는 그대로 남겨 두었습니다.
       · 예전 이펙트 메시지(type:"fx")는 원래도 지난 대화에 안 나옵니다.
       명령만 없앴지, 있었던 일을 없던 일로 만들지는 않았어요.
     ===================================================================== */
  const SLASH_COMMANDS = {

      "/운세": {
      label: "🔮 오늘의 운세 보기",
      systemMsg: (nick) => nick, // 실제 메시지는 _buildFortuneMsg에서 생성
      emojis: ["🔮","✨","🌟","💫","🍀","⭐","🌙","🌈","💎","🎴"],
      colors: ["#9B59B6","#3498DB","#E91E63","#FF9800","#4CAF50"],
      count: 40,
      isFortune: true
    },

    /* [2026-08-06] 먼저 자리를 뜨는 사람이 남은 사람에게 건네는 인사.
       "/수고"와 달리 남을 향한 말이라 닉네임을 넣지 않습니다. */
    "/외치기": {
      label: "📣 화면에 크게 외치기",
      systemMsg: (nick, text) => `📣 ${nick} 작가님: "${text}"`,
      emojis: ["📣","✨","💥","⚡","🔥","💫","🌟","🎯"],
      colors: ["#FF4500","#FFD700","#FF69B4","#00CED1","#9B59B6"],
      count: 30,
      hasText: true
    },
  };

  function _detectSlashCommand(text) {
    const trimmed = text.trim();
    for (const cmd of Object.keys(SLASH_COMMANDS)) {
      if (trimmed === cmd) return { cmd, def: SLASH_COMMANDS[cmd], extraText: "" };
      if (trimmed.startsWith(cmd + " ")) {
        return { cmd, def: SLASH_COMMANDS[cmd], extraText: trimmed.slice(cmd.length + 1).trim() };
      }
    }
    return null;
  }

  // =====================================================
  // ✅ 운세 생성 — 닉+날짜 기준 고정 (0시 갱신)
  // =====================================================
  function _buildFortuneMsg(nick) {
    const fd = window.FORTUNE_DATA;
    if (!fd) return `${nick} 작가님의 오늘의 운세를 불러올 수 없어요. 😢`;

    // 닉 + 오늘 날짜를 seed로 사용 → 하루 고정
    const today = new Date();
    const dateStr = `${today.getFullYear()}${today.getMonth()}${today.getDate()}`;
    const seed = nick + dateStr;

    // 간단한 해시 함수
    function hashStr(s, offset) {
      let h = offset || 0;
      for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
      return Math.abs(h);
    }

    const fortune   = fd.fortunes[hashStr(seed, 1)   % fd.fortunes.length];
    const item      = fd.luckyItems[hashStr(seed, 2)  % fd.luckyItems.length];
    const color     = fd.luckyColors[hashStr(seed, 3) % fd.luckyColors.length];
    const number    = fd.luckyNumbers[hashStr(seed, 4) % fd.luckyNumbers.length];

    return `🔮 ${nick} 작가님의 오늘의 운세는 "${fortune}" 럭키 아이템은 ${item}, 행운의 색깔은 ${color}, 행운의 숫자는 ${number}입니다! ✨`;
  }

  // =====================================================
  // ✅ 단독 이모지 판별
  // =====================================================
  function _isSingleEmoji(text) {
    if (!text || text.trim() !== text) return false;
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      try {
        const seg      = new Intl.Segmenter("ko", { granularity: "grapheme" });
        const segments = [...seg.segment(text)];
        if (segments.length !== 1) return false;
        const s = segments[0].segment;
        return /\p{Emoji}/u.test(s) && !/^[0-9#*]$/.test(s);
      } catch(e) {}
    }
    const emojiRegex = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})(\u200D(\p{Emoji_Presentation}|\p{Extended_Pictographic})|\uFE0F|\u20E3)*$/u;
    return emojiRegex.test(text);
  }

  // =====================================================
  // ✅ 파티클 이펙트 엔진
  // =====================================================
  let _effectCanvas    = null;
  let _effectCtx       = null;
  let _effectParticles = [];
  let _effectRafId     = null;

  function _ensureEffectCanvas() {
    if (_effectCanvas) return _effectCanvas;
    const canvas = document.createElement("canvas");
    canvas.id = "effect-canvas";
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:8000;";
    document.body.appendChild(canvas);
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    window.addEventListener("resize", () => {
      if (_effectCanvas) { _effectCanvas.width = window.innerWidth; _effectCanvas.height = window.innerHeight; }
    });
    _effectCanvas = canvas;
    _effectCtx    = canvas.getContext("2d");
    return canvas;
  }

  function _spawnParticles(emojis, colors, count) {
    _ensureEffectCanvas();
    const W  = _effectCanvas.width;
    const H  = _effectCanvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const diag     = Math.sqrt((W / 2) ** 2 + (H / 2) ** 2);
    const minSpeed = diag * 0.032;
    const maxSpeed = diag * 0.058;

    for (let i = 0; i < count; i++) {
      const useEmoji = Math.random() > 0.30;
      const angle    = Math.random() * Math.PI * 2;
      const speed    = minSpeed + Math.random() * (maxSpeed - minSpeed);
      _effectParticles.push({
        x:    cx,
        y:    cy,
        vx:   Math.cos(angle) * speed,
        vy:   Math.sin(angle) * speed,
        rot:  Math.random() * 360,
        vrot: (Math.random() - 0.5) * 12,
        size: useEmoji
          ? 16 + Math.random() * Math.random() * 48
          : 5  + Math.random() * 12,
        alpha: 1,
        decay: 0.012 + Math.random() * 0.022,
        isEmoji: useEmoji,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: ["circle", "rect", "triangle"][Math.floor(Math.random() * 3)]
      });
    }
  }

  function _drawParticle(ctx, p) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rot * Math.PI) / 180);
    if (p.isEmoji) {
      ctx.font = `${p.size}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.emoji, 0, 0);
    } else {
      ctx.fillStyle = p.color;
      if (p.shape === "circle") {
        ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill();
      } else if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath(); ctx.moveTo(0, -p.size / 2);
        ctx.lineTo(p.size / 2, p.size / 2); ctx.lineTo(-p.size / 2, p.size / 2);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }

  function _runEffectLoop() {
    if (!_effectCtx || !_effectCanvas) return;
    _effectCtx.clearRect(0, 0, _effectCanvas.width, _effectCanvas.height);
    _effectParticles = _effectParticles.filter(p => p.alpha > 0.02);
    for (const p of _effectParticles) {
      p.x   += p.vx;
      p.y   += p.vy;
      p.rot += p.vrot;
      p.vx  *= 0.96;
      p.vy  *= 0.96;
      p.vy  += 0.35;
      p.alpha -= p.decay;
      _drawParticle(_effectCtx, p);
    }
    if (_effectParticles.length > 0) {
      _effectRafId = requestAnimationFrame(_runEffectLoop);
    } else {
      cancelAnimationFrame(_effectRafId);
      _effectRafId = null;
      _effectCtx.clearRect(0, 0, _effectCanvas.width, _effectCanvas.height);
    }
  }

  function runEffect(emojis, colors, count) {
    // ✅ [FIX] 백그라운드 탭에서는 이펙트를 재생하지 않음
    // (rAF가 얼려서 복귀 시 뒤늦게 재생되는 잔상 방지)
    if (document.visibilityState === "hidden") return;
    _effectParticles = [];
    if (_effectRafId) { cancelAnimationFrame(_effectRafId); _effectRafId = null; }
    _spawnParticles(emojis, colors, count);
    _effectRafId = requestAnimationFrame(_runEffectLoop);
  }

  // =====================================================
  // ✅ 외치기 오버레이
  // =====================================================
  let _shoutTimer = null;
  let _shoutExpiresAt = 0; // ✅ [FIX] 절대 만료 시각(백그라운드 탭 setTimeout 지연/스로틀 대응용)

  function _hideShoutOverlay() {
    const overlay = document.getElementById("shout-overlay");
    if (overlay) {
      overlay.style.opacity = "0";
      const inner = document.getElementById("shout-inner");
      if (inner) inner.style.transform = "scale(.92)";
    }
    _shoutExpiresAt = 0;
    if (_shoutTimer) { clearTimeout(_shoutTimer); _shoutTimer = null; }
  }

  function showShoutOverlay(nick, text, durationMs = 3000) {
    // ✅ [FIX] 백그라운드 탭에서는 표시하지 않음 — 타이머가 얼려서
    // 복귀 후에도 오버레이가 남아 있는 버그 방지 (내용은 채팅 카드로 남음)
    if (document.visibilityState === "hidden") return;
    let overlay = document.getElementById("shout-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "shout-overlay";
      overlay.style.cssText = "position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:8500;pointer-events:none;opacity:0;transition:opacity 0.25s ease;";
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div id="shout-inner" style="text-align:center;padding:32px 48px;border-radius:28px;background:rgba(0,0,0,.58);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.18);max-width:80vw;transform:scale(.92);transition:transform 0.3s cubic-bezier(.2,.8,.2,1);">
        <div style="font-size:13px;font-weight:900;color:rgba(255,255,255,.7);margin-bottom:12px;letter-spacing:.5px;">📣 ${escapeHtml(nick)} 작가님</div>
        <div style="font-size:clamp(22px,4vw,44px);font-weight:950;color:#ffffff;line-height:1.25;letter-spacing:-0.5px;word-break:keep-all;">${escapeHtml(text)}</div>
      </div>
    `;
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      const inner = document.getElementById("shout-inner");
      if (inner) inner.style.transform = "scale(1)";
    });

    if (_shoutTimer) clearTimeout(_shoutTimer);
    // ✅ [FIX] 절대 시각 기준으로 만료를 계산 → 탭이 백그라운드였다가 나중에
    // "발견"하며 돌아왔을 때도 이 시각을 기준으로 즉시/정확히 사라지게 함
    _shoutExpiresAt = Date.now() + durationMs;
    _shoutTimer = setTimeout(_hideShoutOverlay, durationMs);
  }

  // ✅ [FIX] 늦게 발견 버그: 브라우저는 탭이 백그라운드(비활성)일 때 setTimeout을
  // 지연시키거나 거의 멈춰버릴 수 있어서, 예정된 시각에 오버레이가 안 사라지고
  // 화면에 계속 남아있는 것처럼 보일 수 있었음.
  // → 탭이 다시 보이게 되는 순간(visibilitychange) 만료 시각을 재확인해서
  //   이미 지났으면 즉시 숨기고, 아직 남았으면 남은 시간만큼만 다시 예약한다.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;

    // ✅ [FIX] 복귀 시 잔여 토스트도 함께 정리
    const toast = document.getElementById("command-toast");
    if (toast) { toast.style.opacity = "0"; }

    if (!_shoutExpiresAt) return;

    const remain = _shoutExpiresAt - Date.now();
    if (remain <= 0) {
      _hideShoutOverlay();
    } else {
      if (_shoutTimer) clearTimeout(_shoutTimer);
      _shoutTimer = setTimeout(_hideShoutOverlay, remain);
    }
  });

  // =====================================================
  // ✅ 핀 메시지
  // =====================================================
  let _pinRef = null;

  function listenPinnedMessage() {
    if (_pinRef) return;
    _pinRef = db.ref("chatMeta/pinned");
    _pinRef.on("value", snap => _renderPinBanner(snap.val()));
  }

  function _renderPinBanner(data) {
    const slot = document.getElementById("pin-banner-slot");

    // ✅ 이전 방식(동적 삽입)으로 생성된 배너가 남아있으면 전부 제거 (유령 배너 방지)
    document.querySelectorAll("#pin-banner, .pin-banner").forEach(el => {
      if (!slot || el.parentElement !== slot) el.remove();
    });

    if (!slot) return;

    if (!data || !data.text) {
      slot.innerHTML = "";
      return;
    }

    const isAdmin = AppSession.getItem("adminPinOk") === "true";
    slot.innerHTML = `
      <div id="pin-banner" class="pin-banner">
        <span class="pin-icon">📌</span>
        <span class="pin-text">${escapeHtml(data.text)}</span>
        <span class="pin-by">— ${escapeHtml(data.by || "")}</span>
        ${isAdmin ? `<button class="pin-remove-btn" onclick="removePinnedMessage()" title="핀 제거">✕</button>` : ""}
      </div>
    `;
  }

  async function setPinnedMessage(text, by) {
    if (!text || !by) return;
    await db.ref("chatMeta/pinned").set({ text, by, at: Date.now() });
  }

  async function removePinnedMessage() {
    if (AppSession.getItem("adminPinOk") !== "true") {
      if (!window.requireAdminPin?.()) return;
    }
    await db.ref("chatMeta/pinned").remove();
  }

  window.setPinnedMessage    = setPinnedMessage;
  window.removePinnedMessage = removePinnedMessage;
  window.listenPinnedMessage = listenPinnedMessage;

  // =====================================================
  // ✅ 명령어 토스트
  // =====================================================
  let _cmdToastTimer = null;

  function showCommandToast(text) {
    // ✅ [FIX] 백그라운드 탭에서는 표시하지 않음 (복귀 시 잔상 방지)
    if (document.visibilityState === "hidden") return;
    let toast = document.getElementById("command-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "command-toast";
      toast.style.cssText = `
        position:fixed;bottom:90px;left:50%;
        transform:translateX(-50%) translateY(30px);
        z-index:7500;display:flex;align-items:center;gap:10px;
        padding:14px 22px;border-radius:999px;
        border:1px solid rgba(10,132,255,.22);
        background:var(--panel,rgba(255,255,255,.96));
        box-shadow:0 8px 32px rgba(0,0,0,.14);
        font-weight:950;font-size:14px;color:var(--text,#141618);
        pointer-events:none;opacity:0;
        transition:transform 0.3s cubic-bezier(.2,.8,.2,1),opacity 0.3s ease;
        max-width:calc(100vw - 40px);white-space:normal;text-align:center;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
    if (_cmdToastTimer) clearTimeout(_cmdToastTimer);
    _cmdToastTimer = setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(20px)";
    }, 4000);
  }

  // =====================================================
  // ✅ 멘션 파싱 (줄바꿈 + @멘션)
  // =====================================================
  /* [추가] 주소를 눌러서 바로 열 수 있게 링크로 바꿉니다.

     원래는 메시지를 전부 글자로만 그렸습니다. 그래서 http://... 를 적어도
     그냥 텍스트라 눌러도 아무 일이 없었어요. (선택해서 복사해 붙여넣어야 했습니다)

     보안상 두 가지를 지킵니다.
       · 먼저 escapeHtml 로 다 막은 뒤에 링크만 다시 만듭니다 → 태그 주입 불가
       · http / https 로 시작하는 것만 링크로 봅니다 → javascript: 같은 건 제외
       · rel="noopener" 로 새 창이 원래 창을 건드리지 못하게 막습니다 */
  /* [2026-08-14] 이미지 주소는 글자 대신 **그림으로** 펼칩니다.
     서버에는 여전히 글자(주소)만 저장돼요 — 그림은 각자의 브라우저가
     그 주소에서 직접 받아옵니다. 용량 부담 0, 규칙 변경 0.
     못 불러오는 주소(지워진 짤 등)는 조용히 글자 링크로 돌아갑니다. */
  /* [넓힘 2026-08-14] .jpg 뒤에 ?만 아니라 & 나 # 가 이어지는 주소도
     (네이버 프록시 ...jpg&type=sc960 같은) 그림으로 알아봅니다 */
  const IMG_URL_RE = /\.(jpe?g|png|gif|webp|avif)([?&#][^\s<>"']*)?$/i;

  function linkifyEscaped(html) {
    return html.replace(
      /(https?:\/\/[^\s<>"']+)/g,
      (url) => {
        // 문장 끝의 마침표·괄호는 주소에서 빼줍니다
        const m = url.match(/[.,!?)\]]+$/);
        const tail = m ? m[0] : "";
        const clean = tail ? url.slice(0, -tail.length) : url;
        if (IMG_URL_RE.test(clean)) {
          /* 누르면 원본을 새 탭에. onerror — 이미지가 죽어 있으면
             주소 글자로 되돌립니다 (textContent 라 주입 걱정 없음) */
          return `<a class="msg-img-link" href="${clean}" target="_blank" rel="noopener noreferrer"
            ><img class="msg-img" src="${clean}" alt="공유한 그림" loading="lazy"
                  referrerpolicy="no-referrer"
                  onerror="this.parentNode.textContent=this.src"></a>${tail}`;
        }
        return `<a class="msg-link" href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${tail}`;
      }
    );
  }

  function parseMentions(text) {
    const escaped = escapeHtml(text);
    const withBr  = escaped.replace(/\n/g, "<br>");
    const linked  = linkifyEscaped(withBr);
    return linked.replace(/@([^\s@<>]+)/g, (_, nick) =>
      `<span class="mention-tag">@${nick}</span>`
    );
  }
  window.linkifyEscaped = linkifyEscaped;

  function msgContainsMyMention(text) {
    if (!myNick || !text) return false;
    const pattern = new RegExp(
      `@${myNick.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\s,!?.]|$)`, "i"
    );
    return pattern.test(text);
  }

  // =====================================================
  // ✅ 멘션 토스트
  // =====================================================
  let _toastTimer = null;

  function showMentionToast(fromUser, fromEmoji) {
    const toast = document.getElementById("mention-toast");
    const txt   = document.getElementById("mention-toast-text");
    if (!toast || !txt) return;
    txt.textContent = `${fromEmoji || "✍️"} ${fromUser || "누군가"}님이 나를 멘션했어요!`;
    toast.classList.add("show");
    toast.onclick = () => { toast.classList.remove("show"); scrollChatToBottom(true); };
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => toast.classList.remove("show"), 4000);
    // DND이거나 멘션 알림음 꺼진 경우 소리 없음
    if (!_dndEnabled && _mentionSoundEnabled) {
      window.playPomodoroSound?.("work_start");
    }
  }

  // =====================================================
  // ✅ 날짜 구분선
  // =====================================================
  function _maybeRenderDateDivider(box, ts) {
    const msgYmd = ymd(ts);
    if (lastRendered.ymd === msgYmd) return;
    const d = new Date(Number.isFinite(Number(ts)) ? Number(ts) : Date.now());
    const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    box.insertAdjacentHTML("beforeend", `
      <div class="date-divider">
        <span class="date-divider-line"></span>
        <span class="date-divider-label">${label}</span>
        <span class="date-divider-line"></span>
      </div>
    `);
    lastRendered.ymd = msgYmd;
  }

  // =====================================================
  // ✅ renderChatMessage
  // =====================================================
  function renderChatMessage(box, data, key) {
    if (!box || !data) return;

    // system (줄바꿈 지원)
    if (data.type === "system") {
      _maybeRenderDateDivider(box, data.time || Date.now());
      const safeMsg = escapeHtml(data.msg).replace(/\n/g, "<br>");
      box.insertAdjacentHTML("beforeend",
        `<div class="system" style="text-align:left;line-height:1.7;max-width:92%;">${safeMsg}</div>`);
      lastRendered = { ...lastRendered, user: null, ts: Number(data.time || Date.now()), msg: String(data.msg || "") };
      return;
    }

    if (data.type === "fx") {
      const def = SLASH_COMMANDS[data.cmd];
      if (def) {
        runEffect(def.emojis, def.colors, def.count);

        const sysText = data.sysMsg || def.systemMsg(data.user || "", data.extraText || "");

        if (data.cmd === "/외치기" && data.extraText) {
          showShoutOverlay(data.user || "", data.extraText);

          // ✅ 외치기 내용을 채팅에 카드로 남김
          _maybeRenderDateDivider(box, data.time || Date.now());
          box.insertAdjacentHTML("beforeend", `
            <div class="declaration-msg" style="border-color:rgba(255,69,58,.20);background:rgba(255,69,58,.06);">
              <span class="declaration-icon">📣</span>
              <div class="declaration-body">
                <div class="declaration-nick">${escapeHtml(data.user || "")}</div>
                <div class="declaration-text">${escapeHtml(data.extraText)}</div>
              </div>
            </div>
          `);
        } else {
          // ✅ [NEW] 그 외 일반 명령어(예: /고추, /축하 등)도 토스트만 뜨고 사라지는 게 아니라
          // 채팅방에 시스템 메시지 형태로 계속 기록이 남도록 함
          _maybeRenderDateDivider(box, data.time || Date.now());
          const safeSys = escapeHtml(sysText).replace(/\n/g, "<br>");
          box.insertAdjacentHTML("beforeend",
            `<div class="system" style="text-align:left;line-height:1.7;max-width:92%;">${safeSys}</div>`);
        }

        if (!_dndEnabled) {
          showCommandToast(sysText);
        }
      }
      lastRendered = { ...lastRendered, user: null, ts: Number(data.time || Date.now()), msg: "" };
      return;
    }

    // 운세 메시지
    if (data.type === "fortune") {
      _maybeRenderDateDivider(box, data.time || Date.now());
      box.insertAdjacentHTML("beforeend", `
        <div class="declaration-msg" style="border-color:rgba(155,89,182,.22);background:rgba(155,89,182,.06);">
          <span class="declaration-icon">🔮</span>
          <div class="declaration-body">
            <div class="declaration-nick">${escapeHtml(data.user || "")}</div>
            <div class="declaration-text">${escapeHtml(data.msg || "")}</div>
          </div>
        </div>
      `);
      lastRendered = { ...lastRendered, user: null, ts: Number(data.time || Date.now()), msg: "" };
      return;
    }

    // 선언 메시지
    if (data.type === "declaration") {
      _maybeRenderDateDivider(box, data.time || Date.now());
      box.insertAdjacentHTML("beforeend", `
        <div class="declaration-msg">
          <span class="declaration-icon">🎯</span>
          <div class="declaration-body">
            <div class="declaration-nick">${escapeHtml(data.user || "")}</div>
            <div class="declaration-text">${escapeHtml(data.text || "")}</div>
          </div>
        </div>
      `);
      lastRendered = { ...lastRendered, user: null, ts: Number(data.time || Date.now()), msg: "" };
      return;
    }

    const isMe    = data.user === myNick;
    const time    = Number(data.time || Date.now());
    const grouped = (lastRendered.user === data.user)
                 && (time - (lastRendered.ts || 0) < 120000)
                 && (lastRendered.ymd === ymd(time));
    const rawMsg  = String(data.msg || "");

    _maybeRenderDateDivider(box, time);

    /* [2026-08-10] 스티커 — 말풍선 없이 그림만 크게.
       서버에는 `[[스티커:pat]]` 같은 짧은 글자만 저장되고, 그림은
       각자 화면에서 그려집니다(script_sticker.js).
       그 파일이 없거나 모르는 값이면 빈 문자열이 와서, 아래 이모지·
       일반 글자 흐름으로 자연스럽게 넘어갑니다. */
    const stickerHtml = window.stickerHtml?.(rawMsg) || "";

    // 단독 이모지 → 크게
    const isBigEmoji = !stickerHtml && _isSingleEmoji(rawMsg);
    const msgHtml    = stickerHtml ? stickerHtml
                     : isBigEmoji ? escapeHtml(rawMsg)
                     : parseMentions(rawMsg);
    const mentionedMe = !isMe && msgContainsMyMention(rawMsg);

    let bubbleClass = "msg-bubble";
    let bubbleStyle = "";
    if (stickerHtml) {
      /* 이모지와 같은 결 — 배경도 테두리도 없이 그림만 놓습니다 */
      bubbleClass = "msg-bubble msg-bubble-sticker";
      bubbleStyle = `padding:2px 4px;background:transparent!important;
                     box-shadow:none!important;border:none!important;`;
    } else if (isBigEmoji) {
      bubbleClass = "msg-bubble msg-bubble-emoji";
      bubbleStyle = `font-size:40px;line-height:1.1;padding:2px 6px;
                     background:transparent!important;box-shadow:none!important;border:none!important;`;
    } else if (mentionedMe) {
      bubbleClass = "msg-bubble mention-me";
    }

    // ✅ 답장(카카오톡 스타일) 인용 블록
    const replyHtml = data.replyTo ? `
      <div class="reply-quote" data-target-key="${escapeHtml(String(data.replyTo.key || ""))}" title="원문으로 이동">
        <div class="reply-quote-label">↪ ${escapeHtml(data.replyTo.user || "")} 님에게 답글</div>
        <div class="reply-quote-text">${escapeHtml(data.replyTo.msg || "")}</div>
      </div>
    ` : "";

    const html = `
      <div class="chat-item ${isMe ? "me" : "other"} ${grouped ? "grouped" : ""}"
           data-key="${escapeHtml(String(key || ""))}"
           data-user="${escapeHtml(String(data.user || ""))}"
           data-raw-msg="${escapeHtml(rawMsg)}">
        ${isMe ? "" : (window.chatAvatarHtml
            ? window.chatAvatarHtml(data.user, data.emoji)
            : `<div class="profile-emoji">${escapeHtml(data.emoji || "✍️")}</div>`)}
        <div class="msg-content">
          ${isMe || grouped ? "" : `<div class="user-name" data-name-of="${escapeHtml(String(data.user || ""))}"${window.nickColorStyle?.(data.user) || ""}>${escapeHtml(data.user)}${data.badge ? `<span class="name-badges">${escapeHtml(String(data.badge))}</span>` : ""}</div>`}
          ${replyHtml}
          <!-- [고침 2026-08-10] ↩ 답장 · 😊 반응을 .bubble-tools 로 묶었습니다.

               예전에는 두 단추가 말풍선과 **같은 줄에 나란히** 있었습니다.
               평소에는 투명(opacity:0)이라 눈에 안 보이는데, 자리는 그대로
               차지합니다. 단추 26+26 에 간격까지 60px 이 넘어요. 채팅 칸이
               347px 이던 화면에서 재보니 말풍선 158px 에 그 밖이 98px —
               **가로의 28% 를 보이지도 않는 단추가 붙들고 있었습니다.**
               그래서 세 단어만에 줄이 바뀌었어요.

               묶어서 흐름 밖으로 빼면(CSS 에서 position:absolute) 그 자리가
               통째로 말풍선 몫이 됩니다. -->
          <div class="bubble-row ${isMe ? "me" : ""}">
            <div class="${bubbleClass}" style="${bubbleStyle}">${msgHtml}</div>
            <div class="msg-time">${formatHHMM(time)}</div>
            <div class="bubble-tools">
              <button type="button" class="reply-add-btn" data-reply-add="1"
                      aria-label="답장 쓰기" title="답장 쓰기">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M9 14 4 9l5-5"/>
                  <path d="M4 9h10a6 6 0 0 1 6 6v3"/>
                </svg>
              </button>
              ${window.reactionAddButtonHtml ? window.reactionAddButtonHtml() : ""}
            </div>
          </div>
          <div class="reaction-row" data-reactions-for="${escapeHtml(String(key || ""))}"></div>
        </div>
      </div>`;

    box.insertAdjacentHTML("beforeend", html);
    lastRendered = { user: data.user, ts: time, ymd: ymd(time), msg: rawMsg };

    if (mentionedMe) showMentionToast(data.user, data.emoji);

    /* 좁은 화면에서 다른 창을 보고 있을 때 💬 탭에 개수를 올립니다.

       예전에는 script_profile.js 가 renderChatMessage 를 감싸서 셌는데,
       이 함수를 감싸는 곳이 네 군데(ui·reactions·profile)나 되어서
       순서가 조금만 틀어져도 조용히 안 불렸습니다.
       세는 일은 원본에서 직접 하는 편이 확실합니다. */
    /* [2026-08-04] Chatty 메시지는 세지 않음 — script_chatty.js 가 렌더를
       빌려 쓰는 동안 깃발을 올립니다 (💬 배지는 메인 Chat 전용) */
    if (!isMe && !window._chattySuppressCount) { try { window.noteNarrowChatUnread?.(); } catch (e) {} }
  }

  // =====================================================
  // ✅ 답장(reply) 기능
  //   - 타인의 메시지 말풍선을 3번 연속 클릭 → 답장 모드 시작
  //   - 답장 중인 메시지는 입력창 위에 발췌 미리보기로 표시
  //   - 답장 메시지의 인용 발췌를 클릭하면 원문으로 스크롤 + 하이라이트
  // =====================================================
  let _replyTarget = null; // { key, user, msg }
  const _replyClickTracker = new WeakMap(); // bubble el -> { count, timer }

  function _cancelReply() {
    _replyTarget = null;
    _renderReplyPreview();
  }

  /* [2026-08-05] 메시지 키로 말풍선 찾기 — 메인/Chatty 두 상자 모두에서.
     push 키는 방마다 고유하므로 먼저 찾히는 쪽이 정답입니다. */
  function _findChatItemByKey(key) {
    if (!key) return null;
    for (const id of ["chat-box", "chat-box2"]) {
      const el = document.getElementById(id)
        ?.querySelector(`.chat-item[data-key="${CSS.escape(key)}"]`);
      if (el) return el;
    }
    return null;
  }

  function _startReply(key) {
    if (!key) return;
    const item = _findChatItemByKey(key);
    if (!item) return; // ✅ 본인 메시지도 답장 가능(자기 메시지를 가리키고 싶을 때 대비)

    const user = item.dataset.user || "";
    const rawMsg = item.dataset.rawMsg || "";
    if (!user) return;

    _replyTarget = { key, user, msg: rawMsg };
    _renderReplyPreview();
    document.getElementById("message")?.focus();
  }

  function _renderReplyPreview() {
    const bar = document.getElementById("reply-preview-bar");
    if (!bar) return;

    if (!_replyTarget) {
      bar.classList.add("hidden");
      return;
    }

    const excerpt = _replyTarget.msg.length > 60
      ? _replyTarget.msg.slice(0, 60) + "…"
      : _replyTarget.msg;

    const labelEl = document.getElementById("reply-preview-label");
    const excerptEl = document.getElementById("reply-preview-excerpt");
    if (labelEl) labelEl.textContent = `${_replyTarget.user} 님에게 답글`;
    if (excerptEl) excerptEl.textContent = excerpt;

    bar.classList.remove("hidden");
  }

  function _scrollToOriginalMessage(targetKey) {
    if (!targetKey) return;
    const targetEl = _findChatItemByKey(targetKey);
    if (!targetEl) {
      showCommandToast("원본 메시지를 찾을 수 없어요 (화면에서 지워졌을 수 있어요) 😢");
      return;
    }
    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    targetEl.classList.remove("flash-highlight");
    // 리플로우를 강제해 애니메이션을 재시작
    void targetEl.offsetWidth;
    targetEl.classList.add("flash-highlight");
    setTimeout(() => targetEl.classList.remove("flash-highlight"), 1300);
  }

  function bindReplyInteractions() {
    /* [2026-08-05] Chatty(chat-box2)에서도 같은 3연속 클릭 답장을 지원
*/
    ["chat-box", "chat-box2"].forEach(id => {
      const box = document.getElementById(id);
      if (!box || box.dataset.replyBound === "true") return;
      box.dataset.replyBound = "true";
      box.addEventListener("click", _onReplyBoxClick);
    });

    document.getElementById("reply-preview-close")?.addEventListener("click", _cancelReply);
  }

  function _onReplyBoxClick(e) {
      // 1) 인용 발췌 클릭 → 원문으로 스크롤
      const quote = e.target.closest(".reply-quote");
      if (quote) {
        _scrollToOriginalMessage(quote.dataset.targetKey);
        return;
      }

      // 2) [추가 2026-08-05] ↩ 답장 버튼 — 카톡처럼 반응 버튼 왼편에.
      //    3연속 클릭도 그대로 두되, 한 번에 가는 길을 하나 더 냅니다.
      const replyBtn = e.target.closest("[data-reply-add]");
      if (replyBtn) {
        const it = replyBtn.closest(".chat-item");
        if (it) _startReply(it.dataset.key);
        return;
      }

      // 3) 메시지 말풍선 3연속 클릭 → 답장 모드 (본인 메시지도 가능)
      const bubble = e.target.closest(".msg-bubble");
      if (!bubble) return;
      const item = bubble.closest(".chat-item");
      if (!item) return;

      const rec = _replyClickTracker.get(bubble) || { count: 0, timer: null };
      rec.count += 1;
      clearTimeout(rec.timer);
      rec.timer = setTimeout(() => _replyClickTracker.delete(bubble), 500);
      _replyClickTracker.set(bubble, rec);

      if (rec.count >= 3) {
        _replyClickTracker.delete(bubble);
        _startReply(item.dataset.key);
      }
  }

  window.bindReplyInteractions = bindReplyInteractions;
  window.cancelReply = _cancelReply;

  // =====================================================
  // ✅ @멘션 자동완성 드롭다운
  // =====================================================
  let _mentionActive = false;
  let _mentionQuery  = "";
  let _mentionSelIdx = 0;
  let _mentionStart  = -1;

  function _getOnlineUsers() {
    const cache = window._statusCache;
    if (!cache || typeof cache !== "object") return [];
    const now = Date.now();
    return Object.entries(cache)
      .filter(([nick, row]) => row && typeof row === "object" &&
              nick !== myNick && (now - (row.lastSeen || 0)) < 90000)
      .map(([nick, row]) => ({ nick, emoji: row.emoji || "✍️" }));
  }

  function _openMentionDropdown(users, query) {
    const dd = document.getElementById("mention-dropdown");
    if (!dd) return;
    const filtered = users.filter(u =>
      !query || u.nick.toLowerCase().includes(query.toLowerCase())
    );
    if (!filtered.length) { _closeMentionDropdown(); return; }
    _mentionSelIdx = 0;
    dd.innerHTML = filtered.map((u, i) => `
      <div class="mention-item ${i === 0 ? "active" : ""}"
           data-nick="${escapeHtml(u.nick)}" data-emoji="${escapeHtml(u.emoji)}" role="option">
        <span class="m-emoji">${u.emoji}</span>
        <span class="m-nick">@${escapeHtml(u.nick)}</span>
      </div>`).join("");
    dd.querySelectorAll(".mention-item").forEach(el =>
      el.addEventListener("mousedown", e => { e.preventDefault(); _insertMention(el.dataset.nick); })
    );
    dd.classList.add("open");
    _mentionActive = true;
  }

  function _closeMentionDropdown() {
    document.getElementById("mention-dropdown")?.classList.remove("open");
    _mentionActive = false; _mentionQuery = ""; _mentionStart = -1; _mentionSelIdx = 0;
  }

  function _moveMentionSel(dir) {
    const dd    = document.getElementById("mention-dropdown");
    const items = dd?.querySelectorAll(".mention-item");
    if (!items?.length) return;
    items[_mentionSelIdx]?.classList.remove("active");
    _mentionSelIdx = (_mentionSelIdx + dir + items.length) % items.length;
    items[_mentionSelIdx]?.classList.add("active");
    items[_mentionSelIdx]?.scrollIntoView({ block: "nearest" });
  }

  function _insertMention(nick) {
    const el = document.getElementById("message");
    if (!el || _mentionStart < 0) return;
    const before = el.value.slice(0, _mentionStart);
    const after  = el.value.slice(_mentionStart + 1 + _mentionQuery.length);
    el.value = `${before}@${nick} ${after}`;
    const pos = before.length + nick.length + 2;
    el.setSelectionRange(pos, pos);
    _closeMentionDropdown();
    el.focus();
  }

  // =====================================================
  // ✅ 슬래시 드롭다운
  // =====================================================
  let _slashActive = false;
  let _slashQuery  = "";
  let _slashSelIdx = 0;

  const _allSlashSuggestions = () =>
    Object.entries(SLASH_COMMANDS).map(([cmd, def]) => ({
      cmd, emoji: def.emojis[0], label: def.label
    }));

  function _openSlashDropdown(query) {
    const dd = document.getElementById("mention-dropdown");
    if (!dd) return;
    const filtered = _allSlashSuggestions().filter(({ cmd }) =>
      !query || cmd.includes(query)
    );
    if (!filtered.length) { _closeSlashDropdown(); return; }
    _slashSelIdx = 0;
    dd.innerHTML = filtered.map(({ cmd, emoji, label }, i) => `
      <div class="mention-item ${i === 0 ? "active" : ""}"
           data-cmd="${escapeHtml(cmd)}" role="option">
        <span class="m-emoji">${emoji}</span>
        <span class="m-nick">${escapeHtml(cmd)}
          <span style="opacity:.6;font-weight:700;font-size:12px;">${escapeHtml(label)}</span>
        </span>
      </div>`).join("");
    dd.querySelectorAll(".mention-item").forEach(el =>
      el.addEventListener("mousedown", e => { e.preventDefault(); _insertSlash(el.dataset.cmd); })
    );
    dd.classList.add("open");
    _slashActive = true;
  }

  function _closeSlashDropdown() {
    if (!_slashActive) return;
    document.getElementById("mention-dropdown")?.classList.remove("open");
    _slashActive = false; _slashQuery = ""; _slashSelIdx = 0;
  }

  function _moveSlashSel(dir) {
    const dd    = document.getElementById("mention-dropdown");
    const items = dd?.querySelectorAll(".mention-item");
    if (!items?.length) return;
    items[_slashSelIdx]?.classList.remove("active");
    _slashSelIdx = (_slashSelIdx + dir + items.length) % items.length;
    items[_slashSelIdx]?.classList.add("active");
    items[_slashSelIdx]?.scrollIntoView({ block: "nearest" });
  }

  function _insertSlash(cmd) {
    const el = document.getElementById("message");
    if (!el) return;
    const def = SLASH_COMMANDS[cmd];
    // hasText인 명령어는 커서를 명령어 뒤로 (텍스트 입력 유도)
    el.value = def?.hasText ? cmd + " " : cmd;
    el.setSelectionRange(el.value.length, el.value.length);
    _closeSlashDropdown();
    el.focus();
  }

  // =====================================================
  // ✅ send
  // =====================================================
  async function checkAndTrimChat() {
    // [FIX] 기존: 키 순서로 삭제 → push 키("-O...")가 sys_* 보다 앞이라
    // 실제 대화만 먼저 지워지고 시스템 메시지는 무한히 쌓이는 버그가 있었음.
    // 변경: (1) 오래된 시스템/이펙트 메시지부터 삭제 (2) 그래도 넘치면 시간순으로 삭제
    //
    /* [고침 2026-08-07] 입장·퇴장 알림을 "먼저 지우는 것"에서 뺐습니다.

       이 규칙은 뽀모도로 알림이 채팅에 쏟아지던 시절에 만든 것입니다.
       그때는 시스템 메시지가 곧 소음이라 제일 먼저 치우는 게 맞았어요.
       그런데 뽀모 알림이 글자수 창으로 옮겨간 뒤로 채팅에 남는 시스템
       메시지는 사실상 입장·퇴장뿐입니다. 그 결과 대화가 250개를 넘길
       때마다 **지난 입장·퇴장 기록이 통째로 먼저 사라졌어요** —
       히스토리에 함께 보여주기로 해 놓고 정작 데이터를 지우고 있었던 셈입니다.

       이제 먼저 치우는 것은 이펙트(fx)와 옛 뽀모 알림뿐이고,
       입장·퇴장은 보통 대화와 똑같이 오래된 순으로만 밀려납니다. */
    try {
      const chatRef  = db.ref("messages");
      const snapshot = await chatRef.once("value");
      const total = snapshot.numChildren();
      if (total <= 250) return;

      const items = [];
      snapshot.forEach(child => {
        const v = child.val() || {};
        /* 먼저 치워도 되는 것 — 화면 효과와, 옛 방식으로 남은 뽀모 알림.
           입장·퇴장(joinOf·leaveOf)은 여기에 넣지 않습니다. */
        const throwaway = (v.type === "fx")
          || (v.type === "system" && !v.joinOf && !v.leaveOf);
        items.push({ key: child.key, time: Number(v.time || 0), throwaway });
      });
      items.sort((a, b) => a.time - b.time); // 오래된 순

      const updates = {};
      let toDelete = total - 250;

      // 1순위: 이펙트와 옛 뽀모 알림 (읽을 값이 없는 것들)
      for (const it of items) {
        if (toDelete <= 0) break;
        if (it.throwaway) { updates[it.key] = null; toDelete--; }
      }
      // 2순위: 그래도 넘치면 가장 오래된 것부터 (입장·퇴장도 여기서 같이)
      for (const it of items) {
        if (toDelete <= 0) break;
        if (!(it.key in updates)) { updates[it.key] = null; toDelete--; }
      }

      if (Object.keys(updates).length) await chatRef.update(updates);
    } catch(e) {
      console.warn("[checkAndTrimChat failed]", e);
    }
  }

  /* [2026-08-05] Chatty 탭에서도 명령어·답장을 그대로 쓰기 위해
     전송 대상 ref를 활성 탭에 따라 갈라주는 헬퍼.
     window.isChattyActive 는 script_chatty.js 가 나중에 export 하므로
     호출 시점에 window 에서 찾습니다 (없으면 늘 메인). */
  function _chattyActive() { return window.isChattyActive?.() === true; }
  /* [뺌 2026-08-07] 세 번째 방(비밀방 · messages3)은 없앴습니다.
     쓰는 사람이 없는 채로 코드만 남아 있었고, 이름이 부딪혀 파일 하나를
     통째로 죽이는 사고까지 냈어요. 되살릴 일이 생기면 git 기록에 있습니다. */
  function _activeMsgRef() {
    return db.ref(_chattyActive() ? "messages2" : "messages");
  }
  function _scrollActiveChat() {
    if (_chattyActive()) window.scrollChattyToBottom?.();
    else scrollChatToBottom(true);
  }
  /* 수다방 전송 실패 안내 — 가장 흔한 원인은 보안규칙 미게시라
     어느 노드를 게시해야 하는지 콕 집어줍니다 */
  function _chattySendFail(e) {
    const node = _chattyActive() ? "messages2" : null;
    if (!node) return;
    const c = String(e && (e.code || e.message) || "");
    showCommandToast(/permission/i.test(c)
      ? `전송이 거부됐어요 — Firebase 콘솔에 새 보안규칙(${node})을 게시했는지 확인해 주세요`
      : "전송하지 못했어요. 연결을 확인해 주세요");
  }

  /* 🏅 수다왕 — 실제로 보낸 줄만 셉니다. 빈 줄이나 막힌 전송은 아래
     흐름에서 걸러지므로, 세는 자리는 **보내기가 끝난 뒤**여야 합니다. */
  async function send() {
    // ✅ [2026-08-04] Chatty 탭이 활성이면 script_chatty.js 가 먼저 문지기 역할.
    //    true 를 돌려주면(미참여·빈 입력 등) 여기서 멈추고,
    //    false 면 chatty 모드로 이어서 처리합니다 (_activeMsgRef 가 messages2 로 갈라줌).
    if (window.chattySend?.()) return;

    const el = document.getElementById("message");
    if (!el || !myNick) return;
    const m = el.value.trim();
    if (!m) return;

    _closeMentionDropdown();
    _closeSlashDropdown();

    const slashResult = _detectSlashCommand(m);

    if (slashResult?.def) {
      // 슬래시 명령어는 답장 대상으로 삼지 않음(전송 시 답장 모드 취소)
      _cancelReply();

      const { cmd, def, extraText } = slashResult;

      // hasText 명령어인데 텍스트가 없으면 안내
      if (def.hasText && !extraText) {
        showCommandToast(`${cmd} 뒤에 내용을 입력해줘요! 예: ${cmd} 오늘 15화 끝낸다!`);
        return;
      }

      const sysMsg = def.systemMsg(myNick, extraText);

      // /선언: declaration 타입으로 저장
      // /운세
      if (def.isFortune) {
        const fortuneMsg = _buildFortuneMsg(myNick);
        runEffect(def.emojis, def.colors, def.count);
        try {
          await _activeMsgRef().push({
            type: "fortune",
            user: myNick,
            emoji: myEmoji,
            msg: fortuneMsg,
            time: Date.now()
          });
        } catch(e) { console.error("운세 전송 실패", e); _chattySendFail(e); }
        el.value = ""; el.style.height = "42px";
        return;
      }

      // /외치기
      if (cmd === "/외치기") {
        showShoutOverlay(myNick, extraText);
        runEffect(def.emojis, def.colors, def.count);
        if (!_dndEnabled) showCommandToast(sysMsg);
        try {
          await _activeMsgRef().push({
            type: "fx", cmd, sysMsg, extraText,
            user: myNick, emoji: myEmoji, time: Date.now()
          });
        } catch(e) { console.error("외치기 전송 실패", e); _chattySendFail(e); }
        el.value = ""; el.style.height = "42px";
        // ✅ 카드가 채팅에 추가됐으므로 스크롤 (활성 탭 기준)
        _scrollActiveChat();
        return;
      }

      // 일반 이펙트 명령어
      runEffect(def.emojis, def.colors, def.count);
      if (!_dndEnabled) showCommandToast(sysMsg);
      try {
        await _activeMsgRef().push({
          type: "fx", cmd, sysMsg,
          user: myNick, emoji: myEmoji, time: Date.now()
        });
      } catch(e) { console.error("fx 전송 실패", e); _chattySendFail(e); }
      el.value = ""; el.style.height = "42px";
      return;
    }

    // 일반 메시지
    try {
      const payload = { user: myNick, emoji: myEmoji, msg: m, time: Date.now() };

      // ✅ 업적 배지 (연속 출석 🔥 / 지난주 풀출석 👑 — 중복 가능)
      if (window._myBadgeStr) payload.badge = window._myBadgeStr;

      // ✅ 답장 중이었다면 원문 정보(짧은 발췌)를 함께 저장
      if (_replyTarget) {
        const excerpt = _replyTarget.msg.length > 60
          ? _replyTarget.msg.slice(0, 60) + "…"
          : _replyTarget.msg;
        payload.replyTo = { key: _replyTarget.key, user: _replyTarget.user, msg: excerpt };
      }

      await _activeMsgRef().push(payload);
      /* 🏅 수다왕 — **보내기가 끝난 뒤**에 셉니다. 위에서 빈 줄이나
         막힌 전송은 이미 걸러졌으므로, 여기 도달했으면 진짜 한 줄입니다. */
      window.achvBump?.("cChat");
      el.value = ""; el.style.height = "42px";
      _cancelReply();
      _scrollActiveChat();
      if (!_chattyActive()) checkAndTrimChat();   // 트림은 메인 전용
    } catch(e) {
      console.error("전송 실패", e);
      _chattySendFail(e);
    }
  }

  // =====================================================
  // ✅ bindSendHandlers
  // =====================================================
  function bindSendHandlers() {
    const el = document.getElementById("message");
    if (!el) { setTimeout(bindSendHandlers, 200); return; }

    // 기존 리스너 리셋
    const newEl = el.cloneNode(true);
    el.parentNode.replaceChild(newEl, el);

    // IME 조합 상태 — ★ 아래 input 처리가 이 값을 보므로 **먼저** 둡니다
    let composing = false;

    /* =====================================================================
       ✍️ 글칸이 자라기 · 드롭다운 — 한글 조합 중에는 손대지 않습니다
       ---------------------------------------------------------------------
       [무엇이 잘못됐었나 — 2026-08-15 제보]
       "회차별로" 를 쳤는데 "회별로" 가 됐습니다. 첫 글자나 두 번째 글자가
       버벅이다 빠지는 식이었어요.

       범인은 **글자 하나마다 높이를 다시 재던 것**입니다.
         this.style.height = "auto";              ← 칸을 한 줄로 접었다가
         this.style.height = ...scrollHeight...;  ← 다시 폅니다
       접는 순간 브라우저는 **그 자리에서 배치를 다시 계산**합니다. 한글은
       자모를 모으는 동안(ㅊ+ㅏ→차) 글칸이 "조합 중" 상태로 있는데, 그
       한복판에서 칸이 접혔다 펴지면 조합이 통째로 취소될 수 있어요.
       그러면 모으던 글자가 **없던 일이 됩니다** — 한 글자가 사라지죠.
       빈 칸에서 첫 글자를 칠 때가 가장 크게 접혔다 펴져서, 첫·두 번째
       글자에서 유독 잦았습니다.

       [고침] 조합 중에는 아무것도 건드리지 않고, 글자가 **완성된 뒤**에
       한 번만 합니다. 한글은 글자마다 곧바로 완성되니 칸은 여전히 제때
       자라요. 드롭다운(@·/)도 같이 미룹니다 — 어차피 @ 와 / 는 조합되는
       글자가 아니라서 늦어지는 일이 없습니다.
       ===================================================================== */
    function 글칸손질(ta) {
      /* 높이는 **달라질 때만** 씁니다. 같은 값을 다시 넣어도 배치를
         다시 재게 되는데, 그 한 번이 조합을 깨뜨릴 자리를 만듭니다. */
      const 지금 = ta.style.height;
      ta.style.height = "auto";
      const 새높이 = Math.min(ta.scrollHeight, 110) + "px";
      ta.style.height = 새높이;
      if (지금 === 새높이) return 새높이;
      return 새높이;
    }

    /* 드롭다운(@ · /)만 다시 봅니다 — 배치를 건드리지 않아 조합 중에도 안전 */
    function 드롭다운손질(ta) {
      const val    = ta.value;
      const caret  = ta.selectionStart;
      const before = val.slice(0, caret);

      // 슬래시 드롭다운
      if (val.startsWith("/") && !val.includes(" ") && !val.includes("\n")) {
        _slashQuery = val.slice(1);
        _openSlashDropdown(_slashQuery);
        return;
      } else {
        _closeSlashDropdown();
      }

      // 멘션 드롭다운
      const mm = before.match(/@([^\s@]*)$/);
      if (mm) {
        _mentionStart = before.lastIndexOf("@");
        _mentionQuery = mm[1];
        _openMentionDropdown(_getOnlineUsers(), _mentionQuery);
      } else {
        _closeMentionDropdown();
      }
    }

    function 입력처리(ta) {
      글칸손질(ta);
      드롭다운손질(ta);
    }

    newEl.addEventListener("input", function (e) {
      /* ★ 조합 중이면 그냥 돌아갑니다 — 아래 compositionend 가 이어받아요.
         e.isComposing 과 우리 깃발을 **둘 다** 봅니다. 사파리는 조합
         마지막 input 에서 isComposing 이 false 로 오는 때가 있어서,
         한쪽만 믿으면 그 한 번이 새어 나갑니다. */
      if (e.isComposing || composing) return;
      입력처리(this);
    });

    newEl.addEventListener("compositionstart", () => composing = true);
    newEl.addEventListener("compositionend", function () {
      composing = false;
      const ta = this;

      /* ★★ [고침 2026-08-15] 드롭다운은 **미루면 안 됩니다.**
           "/방가" 를 치고 곧바로 엔터를 누르면, 미뤄 둔 갱신이 아직
           안 돌아서 목록이 "/" 만 쳤을 때 그대로였습니다. 그래서 맨 위에
           있던 /운세 가 들어갔어요 (실제 제보). 엔터는 조합이 끝난
           **그 순간** 날아오므로, 목록은 여기서 바로 맞춰 둡니다.
           배치를 안 건드리는 일이라 조합을 깨뜨리지도 않아요. */
      드롭다운손질(ta);

      /* 배치(높이)만 다음 그림 차례로 미룹니다 — 조합 뒤처리 중에
         칸을 접었다 펴면 그게 바로 글자가 씹히던 원인이었습니다. */
      requestAnimationFrame(() => { if (!composing) 글칸손질(ta); });
    });

    // keydown: 드롭다운 키 조작 + Enter 전송 + Shift+Enter 줄바꿈
    newEl.addEventListener("keydown", function (e) {
      // 슬래시 드롭다운 키 조작
      if (_slashActive) {
        if (e.key === "ArrowDown") { e.preventDefault(); _moveSlashSel(1);  return; }
        if (e.key === "ArrowUp")   { e.preventDefault(); _moveSlashSel(-1); return; }
        if (e.key === "Escape")    { e.preventDefault(); _closeSlashDropdown(); return; }
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !composing) {
          /* ★ 고르기 직전에 **지금 글칸**을 다시 봅니다.
             조합이 끝나는 차례와 엔터가 오는 차례는 브라우저·입력기마다
             달라서, 어느 한쪽을 믿으면 언젠가 어긋납니다. 여기서 한 번
             더 맞추면 차례가 어떻든 고른 대로 들어가요. */
          드롭다운손질(this);

          /* ★ 다 쳤으면 그냥 보냅니다.
             "/방가" 처럼 명령어를 **끝까지** 친 뒤의 엔터는 "고르겠다"가
             아니라 "보내겠다" 입니다. 예전에는 여기서 목록의 것을 글칸에
             넣기만 해서 엔터를 한 번 더 눌러야 했어요.
             (hasText 명령어는 뒤에 글이 더 붙으므로 그대로 둡니다) */
          const 친것 = this.value.trim();
          if (SLASH_COMMANDS[친것] && !SLASH_COMMANDS[친것].hasText) {
            _closeSlashDropdown();
            e.preventDefault();
            send();
            return;
          }

          e.preventDefault();
          if (!_slashActive) { send(); return; }   // 맞는 게 없으면 그냥 보냅니다
          const sel = document.getElementById("mention-dropdown")
            ?.querySelectorAll(".mention-item")?.[_slashSelIdx];
          if (sel) { _insertSlash(sel.dataset.cmd); return; }
        }
      }

      // 멘션 드롭다운 키 조작
      if (_mentionActive) {
        if (e.key === "ArrowDown") { e.preventDefault(); _moveMentionSel(1);  return; }
        if (e.key === "ArrowUp")   { e.preventDefault(); _moveMentionSel(-1); return; }
        if (e.key === "Escape")    { e.preventDefault(); _closeMentionDropdown(); return; }
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !composing) {
          e.preventDefault();
          const sel = document.getElementById("mention-dropdown")
            ?.querySelectorAll(".mention-item")?.[_mentionSelIdx];
          if (sel) { _insertMention(sel.dataset.nick); return; }
        }
      }

      // Shift+Enter → 줄바꿈 (기본 동작 허용)
      if (e.key === "Enter" && e.shiftKey) return;

      // Enter → 전송 (IME 조합 중 제외)
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !composing) {
        e.preventDefault();
        send();
      }
    });

    // beforeinput fallback (iOS/모바일 Safari)
    newEl.addEventListener("beforeinput", function (e) {
      if (e.inputType === "insertParagraph") {
        if (e.isComposing || composing) return;
        if (_slashActive || _mentionActive) return;
        e.preventDefault();
        send();
      }
    });

    // blur 시 드롭다운 닫기
    newEl.addEventListener("blur", () => {
      setTimeout(() => { _closeMentionDropdown(); _closeSlashDropdown(); }, 150);
    });

    // 핀 메시지 리스너 시작
    listenPinnedMessage();

    // ✅ 답장(3연속 클릭) 인터랙션 바인딩
    bindReplyInteractions();

    console.log("✅ 채팅 입력 이벤트 바인딩 완료 (멘션+슬래시+줄바꿈+DND+외치기+선언+답장)");
  }

  // =====================================================
  // exports
  // =====================================================
  window.send                = send;
  window.scrollChatToBottom  = scrollChatToBottom;
  window.bindChatScrollGuard = bindChatScrollGuard;
  window.bindSendHandlers    = bindSendHandlers;
  window.renderChatMessage   = renderChatMessage;
  window.runEffect           = runEffect;
  window.isDndEnabled        = isDndEnabled;
  window.toggleDnd           = toggleDnd;
  window.showCommandToast    = showCommandToast;   // 👻 유령 모드가 씁니다
  window.showShoutOverlay    = showShoutOverlay;

