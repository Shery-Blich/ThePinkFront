/**
 * Handles tap-to-jump input (with double-jump) for a scene's player.
 * Taps over the joystick base are ignored so the two controls don't fight
 * over the same touch. Grounded state is tracked every frame via update()
 * so double-jump resets as soon as the player lands.
 */
export class JumpSystem {
  constructor(scene, player, options = {}) {
    this.scene = scene;
    this.player = player;
    this.jumpVelocity = options.jumpVelocity ?? -420;
    this._canDoubleJump = false;
    this._hasDoubleJumped = false;

    this._onPointerDown = (pointer) => {
      if (this.scene.isGameOver || this.scene.isSceneOver) return;
      if (this.scene._dialogActive) return;
      if (this._isPointerOnJoystick(pointer)) return;
      this.jump();
    };

    this.scene.input.on('pointerdown', this._onPointerDown);

    // Desktop keyboard support — Space/Up jump, same guards as the tap handler above.
    this._onKeyJump = () => {
      if (this.scene.isGameOver || this.scene.isSceneOver) return;
      this.jump();
    };
    if (this.scene.input.keyboard) {
      this.scene.input.keyboard.on('keydown-UP', this._onKeyJump);
      this.scene.input.keyboard.on('keydown-SPACE', this._onKeyJump);
    }
  }

  destroy() {
    this.scene.input.off('pointerdown', this._onPointerDown);
    if (this.scene.input.keyboard) {
      this.scene.input.keyboard.off('keydown-UP', this._onKeyJump);
      this.scene.input.keyboard.off('keydown-SPACE', this._onKeyJump);
    }
  }

  update() {
    if (!this.player || !this.player.body) return;
    if (this._isOnGround(this.player.body)) {
      this._canDoubleJump = false;
      this._hasDoubleJumped = false;
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
    return !!(
      (body.blocked && body.blocked.down) ||
      (body.touching && body.touching.down) ||
      (typeof body.onFloor === 'function' && body.onFloor())
    );
  }

  jump() {
    if (this.scene._dialogActive) return;
    if (!this.player || !this.player.body) return;
    this.scene.events.emit('player-jump');
    const body = this.player.body;

    if (this._isOnGround(body)) {
      this._applyJumpVelocity(body);
      this._canDoubleJump = true;
      this._hasDoubleJumped = false;
      return;
    }

    if (this._canDoubleJump && !this._hasDoubleJumped) {
      this._applyJumpVelocity(body);
      this._hasDoubleJumped = true;
      this._canDoubleJump = false;
    }
  }

  _applyJumpVelocity(body) {
    if (typeof body.setVelocityY === 'function') {
      body.setVelocityY(this.jumpVelocity);
    } else {
      body.velocity && (body.velocity.y = this.jumpVelocity);
    }
    if (typeof this.player.playJump === 'function') this.player.playJump();
  }
}
