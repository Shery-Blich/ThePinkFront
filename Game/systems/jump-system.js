import { isDesktopDevice } from './joystick-move.js';

/**
 * Handles jump input (with double-jump) for a scene's player.
 * On Desktop: Keyboard (Space / Up) and full-screen pointerdown are supported.
 * On Mobile: An HTML jump button styled identically to the points HUD (.hud-chip)
 * is displayed at the bottom-right for zero-latency, reliable touch input.
 */
export class JumpSystem {
  constructor(scene, player, options = {}) {
    this.scene = scene;
    this.player = player;
    this.jumpVelocity = options.jumpVelocity ?? -420;
    this._canDoubleJump = true;
    this._hasDoubleJumped = false;
    this._enabled = true;

    this.isDesktop = isDesktopDevice(scene);

    // Get or create HTML jump button
    this.jumpBtn = document.getElementById('html-jump-btn');
    if (!this.jumpBtn && typeof document !== 'undefined') {
      this.jumpBtn = document.createElement('button');
      this.jumpBtn.id = 'html-jump-btn';
      this.jumpBtn.className = 'hud-chip';
      this.jumpBtn.type = 'button';
      this.jumpBtn.innerHTML = `<span class="jump-arrow" style="font-size: 1.35em; line-height: 1;">⬆</span><span class="jump-text" style="font-size: 0.72em; line-height: 1; font-weight: 900;">קפיצה</span>`;
      document.body.appendChild(this.jumpBtn);
    }

    // Touch & click handlers for the HTML jump button
    this._onBtnPress = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (!this._enabled) return;
      if (this.scene.isGameOver || this.scene.isSceneOver) return;
      if (this.scene._dialogActive) return;
      this.jump();
    };

    if (this.jumpBtn) {
      this.jumpBtn.addEventListener('pointerdown', this._onBtnPress);
      this.jumpBtn.addEventListener('touchstart', this._onBtnPress, { passive: false });
      this.jumpBtn.addEventListener('click', this._onBtnPress);
    }

    // PC full-screen pointerdown jump support (PC behavior unchanged)
    this._onPointerDown = null;
    if (this.isDesktop) {
      this._onPointerDown = (pointer) => {
        if (!this._enabled) return;
        if (this.scene.isGameOver || this.scene.isSceneOver) return;
        if (this.scene._dialogActive) return;
        if (this._isPointerOnJoystick(pointer)) return;
        this.jump();
      };
      this.scene.input.on('pointerdown', this._onPointerDown);
    }

    // Desktop keyboard support (Space / Up)
    this._onKeyJump = () => {
      if (!this._enabled) return;
      if (this.scene.isGameOver || this.scene.isSceneOver) return;
      if (this.scene._dialogActive) return;
      this.jump();
    };
    if (this.scene.input.keyboard) {
      this.scene.input.keyboard.on('keydown-UP', this._onKeyJump);
      this.scene.input.keyboard.on('keydown-SPACE', this._onKeyJump);
    }

    // Handle responsive device changes
    this._onResize = () => {
      this.isDesktop = isDesktopDevice(this.scene);
      this._syncSizeToJoystick();
      if (this.isDesktop && this.jumpBtn) {
        this.jumpBtn.style.display = 'none';
      } else if (!this.isDesktop && this._enabled && this.jumpBtn && !this.scene._dialogActive) {
        this.jumpBtn.style.display = 'flex';
      }
    };
    this.scene.scale.on('resize', this._onResize);
  }

  enable() {
    this._enabled = true;
    if (!this.isDesktop && this.jumpBtn) {
      this._syncSizeToJoystick();
      this.jumpBtn.style.display = 'flex';
    }
  }

  /**
   * Sizes the HTML button to 72% of the joystick base drawn on the canvas and
   * lines its center up with the joystick's center height.
   * The joystick radius is in game units, so convert to CSS px via displayScale
   * (game units per CSS px in Scale.EXPAND mode).
   */
  _syncSizeToJoystick() {
    const joystick = this.scene.joystick;
    if (!this.jumpBtn || !joystick || !joystick.config) return;
    const displayScale = this.scene.scale.displayScale;
    const scaleX = (displayScale && displayScale.x) || 1;
    const scaleY = (displayScale && displayScale.y) || 1;
    const diameter = (joystick.config.maxRadius * 2 * 0.72) / scaleX;
    // Vertically center on the joystick: its center sits bottomOffset (game units) above the safe-area bottom.
    const centerFromBottom = joystick.config.bottomOffset / scaleY;
    this.jumpBtn.style.width = `${diameter}px`;
    this.jumpBtn.style.height = `${diameter}px`;
    this.jumpBtn.style.fontSize = `${diameter * 0.3}px`;
    this.jumpBtn.style.bottom = `calc(${centerFromBottom - diameter / 2}px + env(safe-area-inset-bottom))`;
  }

  disable() {
    this._enabled = false;
    if (this.jumpBtn) {
      this.jumpBtn.style.display = 'none';
    }
  }

  destroy() {
    this.disable();
    if (this.jumpBtn) {
      this.jumpBtn.removeEventListener('pointerdown', this._onBtnPress);
      this.jumpBtn.removeEventListener('touchstart', this._onBtnPress);
      this.jumpBtn.removeEventListener('click', this._onBtnPress);
      this.jumpBtn.classList.remove('tutorial-highlight');
    }
    if (this._onPointerDown) {
      this.scene.input.off('pointerdown', this._onPointerDown);
    }
    if (this._onKeyJump && this.scene.input.keyboard) {
      this.scene.input.keyboard.off('keydown-UP', this._onKeyJump);
      this.scene.input.keyboard.off('keydown-SPACE', this._onKeyJump);
    }
    if (this._onResize) {
      this.scene.scale.off('resize', this._onResize);
    }
  }

  update() {
    if (!this.player || !this.player.body) return;
    if (this._isOnGround(this.player.body) && this.player.body.velocity.y >= 0) {
      this._hasDoubleJumped = false;
      this._canDoubleJump = true;
    }
  }

  _isPointerOnJoystick(pointer) {
    const joystick = this.scene.joystick;
    if (!joystick || !joystick.config) return false;
    const baseX = joystick.baseX || 60;
    const baseY = joystick.baseY || (this.scene.scale.height - 60);
    const radius = joystick.config.maxRadius || 50;
    const dx = pointer.x - baseX;
    const dy = pointer.y - baseY;
    return Math.hypot(dx, dy) <= radius;
  }

  _isOnGround(body) {
    if (!body) return false;
    if (body.blocked && body.blocked.down) return true;
    if (body.touching && body.touching.down) return true;
    if (typeof body.onFloor === 'function' && body.onFloor()) return true;
    return false;
  }

  jump() {
    if (this.scene._dialogActive) return;
    if (!this.player || !this.player.body) return;
    this.scene.events.emit('player-jump');
    const body = this.player.body;

    const onGround = this._isOnGround(body);

    if (onGround) {
      this._applyJumpVelocity(body);
      this._canDoubleJump = true;
      this._hasDoubleJumped = false;
      return;
    }

    if (!this._hasDoubleJumped) {
      this._applyJumpVelocity(body);
      this._hasDoubleJumped = true;
      this._canDoubleJump = false;
    }
  }

  _applyJumpVelocity(body) {
    if (typeof body.setVelocityY === 'function') {
      body.setVelocityY(this.jumpVelocity);
    } else if (body.velocity) {
      body.velocity.y = this.jumpVelocity;
    }
    if (typeof this.player.playJump === 'function') {
      this.player.playJump();
    }
  }
}
