import Phaser from 'phaser';
import VirtualJoyStick from 'phaser3-rex-plugins/plugins/virtualjoystick.js';

/**
 * JoystickMove — Virtual joystick movement system for Phaser.js using phaser3-rex-plugins.
 *
 * Fixed in the bottom-left of the screen. Controls character velocity
 * and direction proportionally to drag distance.
 */
export class JoystickMove extends Phaser.Events.EventEmitter {
  /**
   * @param {Phaser.Scene} scene — The scene this system belongs to
   * @param {Phaser.Physics.Arcade.Sprite} player — The player sprite (must have an Arcade Physics body)
   * @param {Object} [config] — Optional configuration overrides
   */
  constructor(scene, player, config = {}) {
    super();

    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {Phaser.Physics.Arcade.Sprite} */
    this.player = player;

    // Auto-detect scale factor if not provided
    const scaleFactor = config.scaleFactor ?? (player.spriteScale ?? 1);

    /** @type {Object} Merged configuration */
    this.config = {
      speed: 120,               // Max movement speed in px/sec
      maxRadius: 30 * scaleFactor, // Joystick boundary drag radius in px
      knobRadius: 12 * scaleFactor, // Joystick knob radius in px
      leftOffset: 45 * scaleFactor, // Fixed X offset from left edge of screen
      bottomOffset: 45 * scaleFactor, // Fixed Y offset from bottom edge of screen
      baseColor: 0x000000,      // Neutral dark base
      baseAlpha: 0.2,
      baseStrokeColor: 0xffffff, // Neutral white stroke
      baseStrokeAlpha: 0.4,
      knobColor: 0xffffff,      // Neutral white knob/thumb
      knobAlpha: 0.5,
      knobStrokeColor: 0xffffff, // Neutral white outline
      knobStrokeAlpha: 0.7,
      horizontalOnly: false,
      ...config
    };

    /** @type {number} Current scale factor */
    this.scaleFactor = scaleFactor;

    /** @type {number} Center X of the stationary joystick */
    this.baseX = this.config.leftOffset;
    /** @type {number} Center Y of the stationary joystick */
    this.baseY = this.scene.scale.height - this.config.bottomOffset;

    /** @type {boolean} Whether movement input is currently accepted */
    this._enabled = false;

    /** @type {boolean} Whether the player is currently moving */
    this.isMoving = false;

    // Create Base and Thumb Graphics Game Objects (centered at 0,0 locally)
    const { base, thumb } = this._createJoystickGraphics();

    /** @type {VirtualJoyStick} Rex Virtual Joystick instance */
    this.joystick = new VirtualJoyStick(scene, {
      x: this.baseX,
      y: this.baseY,
      radius: this.config.maxRadius,
      base: base,
      thumb: thumb,
      fixed: true,
    });

    // Hide initially
    this.joystick.visible = false;

    // --- Bound listeners (stored so we can remove them exactly) ---
    this._onShutdown = this.destroy.bind(this);

    // Auto-cleanup when the scene shuts down to prevent leaks
    this.scene.events.once('shutdown', this._onShutdown);
    this.scene.events.once('destroy', this._onShutdown);

    // Handle screen resize
    this.scene.scale.on('resize', this._onResize, this);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Start listening for touch/click events. Safe to call multiple times.
   */
  enable() {
    if (this._enabled) return;
    this._enabled = true;
    this.joystick.visible = true;
  }

  /**
   * Stop listening for events, clear the joystick, and halt the player immediately.
   */
  disable() {
    if (!this._enabled) return;
    this._enabled = false;
    this.joystick.visible = false;
    this.stop();
  }

  /**
   * Immediately stop the player, reset the joystick knob, and reset state.
   */
  stop() {
    if (this.player && this.player.body) {
      this.player.body.setVelocity(0, 0);
    }

    if (this.isMoving) {
      this.isMoving = false;
      this._setIdleFrame();
      this.emit('move-end', { x: this.player.x, y: this.player.y });
    }
  }

  /**
   * Called every frame by the scene's update() loop.
   * Checks drag state of the virtual joystick and updates player velocity.
   */
  update() {
    if (!this._enabled || !this.joystick) return;

    // Check if the joystick is currently being dragged
    const isDragging = this.joystick.pointer !== undefined && this.joystick.pointer !== null;

    if (isDragging) {
      if (!this.isMoving) {
        this.isMoving = true;
        this.emit('move-start', { x: this.player.x, y: this.player.y });
      }

      // Calculate movement strength (0 to 1) based on drag distance
      const strength = Math.min(this.joystick.force / this.joystick.radius, 1);
      const angle = this.joystick.rotation; // Angle in radians

      // Determine target velocity based on angle and strength
      const vx = Math.cos(angle) * this.config.speed * strength;
      const vy = this.config.horizontalOnly
        ? this.player.body.velocity.y
        : Math.sin(angle) * this.config.speed * strength;

      if (this.player && this.player.body) {
        this.player.body.setVelocity(vx, vy);
        this._updateAnimation(vx, vy);
      }
    } else {
      if (this.isMoving) {
        this.stop();
      }
    }

    // Boundary/blocked checking
    if (this.isMoving && this.player && this.player.body) {
      const body = this.player.body;
      const isBlockedX = (body.velocity.x > 0 && body.blocked.right) || (body.velocity.x < 0 && body.blocked.left);
      const isBlockedY = (body.velocity.y > 0 && body.blocked.down) || (body.velocity.y < 0 && body.blocked.up);
      if (isBlockedX || isBlockedY) {
        this.onCollision();
      }
    }
  }

  /**
   * Called when the player collides with a wall or obstacle.
   */
  onCollision() {
    if (!this.isMoving) return;
    this.emit('move-blocked', { x: this.player.x, y: this.player.y });
  }

  /**
   * Fully clean up this system.
   */
  destroy() {
    this.disable();
    if (this.scene) {
      this.scene.events.off('shutdown', this._onShutdown);
      this.scene.events.off('destroy', this._onShutdown);
      this.scene.scale.off('resize', this._onResize, this);
    }

    if (this.joystick) {
      try {
        // Prevent Rex VirtualJoystick plugin from crashing if the game objects (base/thumb) 
        // have already been auto-destroyed during scene shutdown.
        if (this.joystick.base && !this.joystick.base.scene) {
          this.joystick.base.destroy = () => {};
        }
        if (this.joystick.thumb && !this.joystick.thumb.scene) {
          this.joystick.thumb.destroy = () => {};
        }
        this.joystick.destroy();
      } catch (e) {
        console.warn("VirtualJoystick cleanup warning:", e);
      }
      this.joystick = null;
    }

    this.removeAllListeners();
    this.scene = null;
    this.player = null;
  }

  // ---------------------------------------------------------------------------
  // Private — Listeners
  // ---------------------------------------------------------------------------

  /**
   * Handles screen resize to maintain relative bottom-left position.
   *
   * @param {Phaser.Structs.Size} gameSize
   * @private
   */
  _onResize(gameSize) {
    this.baseY = gameSize.height - this.config.bottomOffset;
    if (this.joystick) {
      this.joystick.setPosition(this.baseX, this.baseY);
    }
  }

  // ---------------------------------------------------------------------------
  // Private — Drawing
  // ---------------------------------------------------------------------------

  /**
   * Creates the base and thumb graphics for the virtual joystick.
   *
   * @returns {{base: Phaser.GameObjects.Graphics, thumb: Phaser.GameObjects.Graphics}}
   * @private
   */
  _createJoystickGraphics() {
    // 1. Create Base Graphics (centered at 0, 0 locally)
    const base = this.scene.add.graphics();
    base.setScrollFactor(0);
    base.setDepth(2000);
    
    base.fillStyle(this.config.baseColor, this.config.baseAlpha);
    base.lineStyle(3, this.config.baseStrokeColor, this.config.baseStrokeAlpha);
    base.fillCircle(0, 0, this.config.maxRadius);
    base.strokeCircle(0, 0, this.config.maxRadius);

    // Inner ring (extra detail)
    base.lineStyle(1.5, this.config.baseStrokeColor, this.config.baseStrokeAlpha * 0.4);
    base.strokeCircle(0, 0, this.config.maxRadius * 0.5);

    // Center point
    base.fillStyle(this.config.baseStrokeColor, this.config.baseStrokeAlpha * 0.5);
    base.fillCircle(0, 0, 4);

    // 2. Create Thumb/Knob Graphics (centered at 0, 0 locally)
    const thumb = this.scene.add.graphics();
    thumb.setScrollFactor(0);
    thumb.setDepth(2001);

    thumb.fillStyle(this.config.knobColor, this.config.knobAlpha);
    thumb.lineStyle(2, this.config.knobStrokeColor, this.config.knobStrokeAlpha);
    thumb.fillCircle(0, 0, this.config.knobRadius);
    thumb.strokeCircle(0, 0, this.config.knobRadius);

    return { base, thumb };
  }

  // ---------------------------------------------------------------------------
  // Private — Animation
  // ---------------------------------------------------------------------------

  /**
   * Determine walk direction and play the matching animation.
   *
   * @param {number} vx
   * @param {number} vy
   * @private
   */
  _updateAnimation(vx, vy) {
    if (!this.player) return;

    if (Math.abs(vx) < 1 && Math.abs(vy) < 1) {
      this._setIdleFrame();
      return;
    }

    let direction;
    if (this.config.horizontalOnly || Math.abs(vx) > Math.abs(vy)) {
      direction = vx > 0 ? 'right' : 'left';
    } else {
      direction = vy > 0 ? 'down' : 'up';
    }

    const animKey = `walk-${direction}`;

    if (this.player.anims?.exists?.(animKey)) {
      this.player.anims.play(animKey, true);
    } else {
      if (direction === 'left') {
        this.player.setFlipX(true);
      } else if (direction === 'right') {
        this.player.setFlipX(false);
      }
    }
  }

  /**
   * Set the player to an idle frame when stopping.
   * @private
   */
  _setIdleFrame() {
    if (this.player?.anims?.isPlaying) {
      this.player.anims.stop();
    }
  }
}
