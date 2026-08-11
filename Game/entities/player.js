import { Character } from './character.js';
import { JoystickMove } from '../systems/joystick-move.js';
import {
  updateCharacterAnimation,
  stopCharacterAnimation,
  resetCharacterVisual,
  playJumpAnimation,
  playJumpLandAnimation,
} from '../systems/character-animator.js';

/**
 * Player — The player-controlled character.
 *
 * Extends Character with:
 * - Dynamic physics body (moves via JoystickMove or other input)
 * - World bounds collision
 * - Can be reused across any scene
 * - Handles its own movement system, sizing, and scaling logic
 *
 * @example
 *   const player = new Player(this, 100, 300);
 *   player.setWorldBounds(0, roadTop, worldWidth, roadHeight);
 */
export class Player extends Character {

  /**
   * @param {Phaser.Scene} scene — The scene to add the player to
   * @param {number} x — Starting X position (world coords)
   * @param {number} y — Starting Y position (feet, world coords)
   * @param {number} [scale] — Optional pixel art scale factor (auto-computed if omitted)
   */
  constructor(scene, x, y, scale = null) {
    const s = scale ?? Character.computeScale(scene.scale.height);
    super(scene, x, y, 'player', s, false /* dynamic body */);

    /** @type {number} The scale factor */
    this.s = s;

    // Apply proportional aspect-ratio scaling (using original height 20 as baseline)
    if (this.width && this.height) {
      const aspectRatio = this.width / this.height;
      const targetHeight = 20 * s;
      const targetWidth = targetHeight * aspectRatio;
      this.setDisplaySize(targetWidth, targetHeight);
      this._baseScaleX = this.scaleX;
      this._baseScaleY = this.scaleY;
      this._setupCollisionBody();
    }

    // --- Movement configuration ---
    const charW = 12 * s;
    /** @type {number} Base walking speed */
    this.baseSpeed = charW * 4.5; // Slightly faster base speed for joystick responsiveness
    /** @type {number} Current speed */
    this.currentSpeed = this.baseSpeed;

    // --- Movement system ---
    /** @type {JoystickMove} */
    this.movement = new JoystickMove(scene, this, {
      speed: this.baseSpeed,
    });

    /** @type {boolean} Invulnerability status after taking damage */
    this.isInvulnerable = false;

    // Forward movement events so external systems (like Day1Scene HUD) can listen directly on the player
    this.movement.on('move-start', (payload) => this.emit('move-start', payload));
    this.movement.on('move-end', (payload) => this.emit('move-end', payload));
    this.movement.on('move-blocked', (payload) => this.emit('move-blocked', payload));
  }

  /**
   * Triggers visual/audio damage effect on the player:
   * - Sets temporary invulnerability
   * - Red tint flash + camera shake
   * - Floating "-1 ♥" text
   * - Sprite flicker/blink
   * @param {number} [invulnerabilityMs=1500]
   * @returns {boolean} Whether damage effect was applied
   */
  takeDamage(invulnerabilityMs = 1500) {
    if (this.isInvulnerable) return false;

    this.isInvulnerable = true;

    // Red tint flash
    this.setTint(0xff0000);

    // Camera shake
    if (this.scene && this.scene.cameras && this.scene.cameras.main) {
      this.scene.cameras.main.shake(200, 0.01);
    }

    // Play damage sound if available
    if (this.scene && this.scene.sound && this.scene.cache && this.scene.cache.audio && this.scene.cache.audio.exists('sfx-gameover')) {
      this.scene.sound.play('sfx-gameover', { volume: 0.3 });
    }

    // Floating damage indicator text
    const s = this.s || 1;
    const damageText = this.scene.add.text(this.x, this.y - 25 * s, '-1 ♥', {
      fontFamily: 'Rubik, sans-serif',
      fontSize: `${Math.max(14, Math.round(16 * s))}px`,
      fontWeight: '900',
      color: '#dc2626',
      stroke: '#ffffff',
      strokeThickness: 2 * s,
    }).setOrigin(0.5, 1).setDepth(3000);

    this.scene.tweens.add({
      targets: damageText,
      y: damageText.y - 30 * s,
      alpha: 0,
      duration: 1000,
      onComplete: () => damageText.destroy(),
    });

    // Sprite blink animation
    const blinkRepeat = Math.max(2, Math.floor(invulnerabilityMs / 200));
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: blinkRepeat,
      onComplete: () => {
        this.setAlpha(1);
        this.clearTint();
        this.isInvulnerable = false;
      },
    });

    return true;
  }

  /**
   * Triggers cartoon slide effect on banana peel:
   * - Locks player input
   * - Propels player in slide direction
   * - Plays cartoon spin/wobble animation and floating "אופס! 🍌" text
   * - Re-enables input after duration
   *
   * @param {number} [durationMs=300] - Duration of slide in ms
   */
  slide(durationMs = 300) {
    if (this.isSliding) return;
    this.isSliding = true;
    resetCharacterVisual(this);

    // Temporarily disable input
    this.disable();

    const s = this.s || 1;
    // Determine slide direction (current velocity or default forward)
    let vx = (this.body && this.body.velocity.x) || 160 * s;
    let vy = (this.body && this.body.velocity.y) || 0;
    const currentVel = Math.hypot(vx, vy);
    const speed = currentVel > 10 ? currentVel : 160 * s;
    const slideSpeed = 220 * s;

    if (this.body) {
      this.body.setVelocity((vx / speed) * slideSpeed, (vy / speed) * slideSpeed);
    }

    // Floating cartoon text
    const slipText = this.scene.add.text(this.x, this.y - 25 * s, 'אופס! 🍌', {
      fontFamily: 'Rubik, sans-serif',
      fontSize: `${Math.max(14, Math.round(16 * s))}px`,
      fontWeight: '900',
      color: '#facc15',
      stroke: '#000000',
      strokeThickness: 3 * s,
    }).setOrigin(0.5, 1).setDepth(3500);

    this.scene.tweens.add({
      targets: slipText,
      y: slipText.y - 30 * s,
      alpha: 0,
      duration: 1000,
      onComplete: () => slipText.destroy()
    });

    // Cartoon wobble/spin tween
    this.scene.tweens.add({
      targets: this,
      angle: 360,
      duration: durationMs,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.angle = 0;
        this.isSliding = false;
        if (this.body) {
          this.body.setVelocity(0, 0);
        }
        this.enable();
      }
    });
  }

  /**
   * Triggers knockback effect on pothole hit:
   * - Red tint flash + camera shake + invulnerability
   * - Propels player forward with spin animation and position shift
   * - Similar to slide() but with red damage effects
   *
   * @param {number} [durationMs=300] - Duration of knockback spin in ms
   * @param {number} [knockbackDistance=40] - How far to push player forward in units
   */
  knockback(durationMs = 300, knockbackDistance = 40) {
    if (this.isInvulnerable) return;
    if (this.isSliding) return;

    this.isSliding = true;
    this.isInvulnerable = true;
    resetCharacterVisual(this);

    // Disable input during knockback
    this.disable();

    const s = this.s || 1;

    // Red tint flash
    this.setTint(0xff0000);

    // Camera shake
    if (this.scene && this.scene.cameras && this.scene.cameras.main) {
      this.scene.cameras.main.shake(200, 0.01);
    }

    // Play damage sound if available
    if (this.scene && this.scene.sound && this.scene.cache && this.scene.cache.audio && this.scene.cache.audio.exists('sfx-gameover')) {
      this.scene.sound.play('sfx-gameover', { volume: 0.3 });
    }

    // Floating damage indicator text
    const damageText = this.scene.add.text(this.x, this.y - 25 * s, '-1 ♥', {
      fontFamily: 'Rubik, sans-serif',
      fontSize: `${Math.max(14, Math.round(16 * s))}px`,
      fontWeight: '900',
      color: '#dc2626',
      stroke: '#ffffff',
      strokeThickness: 2 * s,
    }).setOrigin(0.5, 1).setDepth(3000);

    this.scene.tweens.add({
      targets: damageText,
      y: damageText.y - 30 * s,
      alpha: 0,
      duration: 1000,
      onComplete: () => damageText.destroy(),
    });

    // Spin animation with forward position shift during knockback
    this.scene.tweens.add({
      targets: this,
      x: this.x + knockbackDistance * s,
      angle: 360,
      duration: durationMs,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.angle = 0;
        this.isSliding = false;
        if (this.body) {
          this.body.setVelocity(0, 0);
        }
        this.clearTint();
        this.isInvulnerable = false;
        this.enable();
      }
    });
  }

  /**
   * Reset speed back to base.
   */
  resetSpeed() {
    this.currentSpeed = this.baseSpeed;
    if (this.movement) {
      this.movement.config.speed = this.baseSpeed;
    }
  }

  /**
   * Enable movement controls.
   */
  enable() {
    if (this.movement) {
      this.movement.enable();
    }
  }

  /**
   * Disable movement controls.
   */
  disable() {
    if (this.movement) {
      this.movement.disable();
    }
  }

  /**
   * Stop the run/idle tween animator and hold it off (angle/scale reset to
   * base). Use before a scripted cutscene tween takes over the same
   * properties (game-over falls, shrink-into-doorway fades, etc.) — the
   * looping animator tween would otherwise keep fighting it every frame.
   */
  suppressAnimation() {
    this._animationSuppressed = true;
    resetCharacterVisual(this);
  }

  /**
   * Resume the run/idle tween animator after suppressAnimation().
   */
  resumeAnimation() {
    this._animationSuppressed = false;
  }

  /**
   * Reset internal jump tracking flags.
   */
  _resetJumpFlags() {
    this._isJumping = false;
    this._jumpLanding = false;
    this._jumpLeftGround = false;
  }

  /**
   * Trigger the jump launch animation. Call once per jump/double-jump when
   * the physics velocity is set (e.g. from a scene's jump input handler).
   */
  playJump() {
    this._resetJumpFlags();
    this._isJumping = true;
    playJumpAnimation(this);
  }

  /**
   * Update lifecycle (called each frame).
   */
  update() {
    if (this.movement) {
      this.movement.update();
    }

    if (this._isJumping) {
      const grounded = !!(this.body && (this.body.blocked.down || this.body.touching.down));
      const movingUp = !!(this.body && this.body.velocity.y < -20);

      if (movingUp || !grounded) {
        this._jumpLeftGround = true;
      }

      if (grounded && !movingUp) {
        if (!this._jumpLanding) {
          this._jumpLanding = true;
          playJumpLandAnimation(this, () => {
            this._resetJumpFlags();
          });
        } else if (this._animState !== 'jump-land' && (!this._animTweens || this._animTweens.length === 0)) {
          // Safety recovery: landing animation ended or was stopped without callback
          resetCharacterVisual(this);
        }
      }
    } else if (!this.isSliding && !this._animationSuppressed && this.body) {
      const speed = Math.hypot(this.body.velocity.x, this.body.velocity.y);
      updateCharacterAnimation(this, speed, 'breathe');
    }

    this.depthSort();
  }

  /**
   * Notify movement system of a collision.
   */
  onCollision() {
    if (this.movement) {
      this.movement.onCollision();
    }
  }

  /**
   * Constrain the player to a rectangular area (e.g., the road strip).
   *
   * @param {number} x — Bounds left
   * @param {number} y — Bounds top
   * @param {number} width — Bounds width
   * @param {number} height — Bounds height
   */
  setWorldBounds(x, y, width, height) {
    this.scene.physics.world.setBounds(x, y, width, height);
    this.setCollideWorldBounds(true);
  }

  /**
   * Override collision body setup for the player.
   * Dynamically calculates body sizes to fit the bottom half of the texture,
   * matching the original footprint scale and centering it width-wise.
   *
   * @protected
   * @override
   */
  _setupCollisionBody() {
    if (!this.texture || this.width === 0 || this.height === 0 || !this.body) {
      return;
    }

    const s = this.spriteScale;
    const aspectRatio = this.width / this.height;
    const targetHeight = 20 * s;
    const targetWidth = targetHeight * aspectRatio;

    const scaleX = targetWidth / this.width;
    const scaleY = targetHeight / this.height;

    // Calculate local body dimensions and offsets:
    const localWidth = (10 * s) / scaleX;
    const localHeight = (10 * s) / scaleY;
    
    // Center the collision body horizontally relative to the scaled sprite width:
    const localOffsetX = ((targetWidth - 10 * s) / 2) / scaleX;
    const localOffsetY = (10 * s) / scaleY;

    this.body.setSize(localWidth, localHeight);
    this.body.setOffset(localOffsetX, localOffsetY);
  }

  /**
   * Clean up movement resources on destruction.
   */
  destroy(fromScene) {
    stopCharacterAnimation(this);
    if (this.movement) {
      this.movement.destroy();
      this.movement = null;
    }
    super.destroy(fromScene);
  }
}
