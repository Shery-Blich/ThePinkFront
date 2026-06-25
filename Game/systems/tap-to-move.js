/**
 * TapToMove — Tap-to-move movement system for Phaser.js
 *
 * Handles player movement via screen taps, with smooth walking,
 * collision detection, directional animation, and visual tap feedback.
 *
 * Designed for mobile-first top-down games. All event listeners and
 * resources are tracked and cleaned up to prevent memory leaks.
 *
 * @example
 *   const movement = new TapToMove(this, playerSprite, { speed: 150 });
 *   movement.enable();
 *   // Later:
 *   movement.destroy();
 */

const DEFAULT_CONFIG = {
  speed: 120,               // Movement speed in px/sec
  arrivalThreshold: 4,      // Distance in px to snap to target
  showTapMarker: true,      // Show visual feedback on tap
  tapMarkerDuration: 400,   // Marker fade-out time in ms
  tapMarkerRadius: 8,       // Tap marker circle radius in px
  tapMarkerColor: 0xffffff, // Tap marker fill color
  tapMarkerAlpha: 0.6,      // Tap marker initial alpha
};

/**
 * Events emitted by TapToMove (via Phaser.Events.EventEmitter):
 *
 * 'tap'           — Fired on every tap. Payload: { x, y }
 * 'move-start'    — Fired when player begins walking. Payload: { x, y }
 * 'move-end'      — Fired when player arrives at target. Payload: { x, y }
 * 'move-blocked'  — Fired when player hits a wall/obstacle. Payload: { x, y }
 */
export class TapToMove extends Phaser.Events.EventEmitter {

  /**
   * @param {Phaser.Scene} scene — The scene this system belongs to
   * @param {Phaser.Physics.Arcade.Sprite} player — The player sprite (must have an Arcade Physics body)
   * @param {Object} [config] — Optional overrides for DEFAULT_CONFIG
   */
  constructor(scene, player, config = {}) {
    super();

    /** @type {Phaser.Scene} */
    this.scene = scene;

    /** @type {Phaser.Physics.Arcade.Sprite} */
    this.player = player;

    /** @type {Object} Merged config */
    this.config = { ...DEFAULT_CONFIG, ...config };

    /** @type {boolean} Whether movement input is currently accepted */
    this._enabled = false;

    /** @type {boolean} Whether the player is currently walking */
    this.isMoving = false;

    /** @type {{ x: number, y: number } | null} Current movement target in world coords */
    this.targetPosition = null;

    /** @type {number | null} Previous frame's distance to target — for overshoot detection */
    this._prevDist = null;

    /** @type {boolean} Whether this system has been destroyed */
    this._destroyed = false;

    // --- Tap marker (reused to avoid allocating new graphics each tap) ---
    /** @type {Phaser.GameObjects.Graphics | null} */
    this._tapMarker = null;

    /** @type {Phaser.Tweens.Tween | null} */
    this._tapMarkerTween = null;

    // --- Bound listeners (stored so we can remove them exactly) ---
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onShutdown = this.destroy.bind(this);

    // Auto-cleanup when the scene shuts down to prevent leaks
    this.scene.events.once('shutdown', this._onShutdown);
    this.scene.events.once('destroy', this._onShutdown);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Start listening for taps. Safe to call multiple times.
   */
  enable() {
    if (this._destroyed) return;
    if (this._enabled) return;

    this._enabled = true;
    this.scene.input.on('pointerdown', this._onPointerDown);
  }

  /**
   * Stop listening for taps and halt the player immediately.
   * Safe to call multiple times.
   */
  disable() {
    if (this._destroyed) return;
    if (!this._enabled) return;

    this._enabled = false;
    this.scene.input.off('pointerdown', this._onPointerDown);
    this.stop();
  }

  /**
   * Programmatically move the player to a world position.
   * Works even if input is disabled (for cutscenes, etc.).
   *
   * @param {number} x — World X coordinate
   * @param {number} y — World Y coordinate
   */
  moveTo(x, y) {
    if (this._destroyed) return;

    this.targetPosition = { x, y };
    this.isMoving = true;
    this._prevDist = null; // Reset overshoot tracker

    this.scene.physics.moveToObject(
      this.player,
      this.targetPosition,
      this.config.speed
    );

    this._updateAnimation(x, y);
    this.emit('move-start', { x, y });
  }

  /**
   * Immediately stop the player in place.
   */
  stop() {
    if (this._destroyed) return;
    if (!this.isMoving) return;

    this.player.body.stop();
    this.isMoving = false;

    const arrivedAt = this.targetPosition
      ? { ...this.targetPosition }
      : { x: this.player.x, y: this.player.y };

    this.targetPosition = null;
    this._setIdleFrame();
    this.emit('move-end', arrivedAt);
  }

  /**
   * Called every frame by the scene's update() loop.
   * Checks arrival via three methods to prevent overshoot:
   *   1. Distance within threshold
   *   2. Distance is now increasing (player passed the target)
   *   3. Remaining distance is less than one frame's movement
   */
  update() {
    if (this._destroyed || !this.isMoving || !this.targetPosition) return;

    // Check if the player is blocked in their moving direction
    const body = this.player.body;
    if (body) {
      const isBlockedX = (body.velocity.x > 0 && body.blocked.right) || (body.velocity.x < 0 && body.blocked.left);
      const isBlockedY = (body.velocity.y > 0 && body.blocked.down) || (body.velocity.y < 0 && body.blocked.up);
      if (isBlockedX || isBlockedY) {
        this.onCollision();
        return;
      }
    }

    const dist = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.targetPosition.x,
      this.targetPosition.y
    );

    // How far the player moves per frame at current velocity
    const speed = Math.sqrt(
      body.velocity.x * body.velocity.x +
      body.velocity.y * body.velocity.y
    );
    // Assume ~60fps; use a generous multiplier to catch edge cases
    const frameMovement = speed / 30;

    // Overshoot detection: distance started increasing → player passed the target
    const overshot = this._prevDist !== null && dist > this._prevDist + 0.5;

    if (dist <= this.config.arrivalThreshold || dist <= frameMovement || overshot) {
      // Snap to target to avoid sub-pixel drift
      this.player.x = this.targetPosition.x;
      this.player.y = this.targetPosition.y;
      this._prevDist = null;
      this.stop();
      return;
    }

    this._prevDist = dist;
  }

  /**
   * Called when the player collides with a wall or obstacle.
   * Hook this up via: physics.add.collider(player, walls, movement.onCollision, null, movement)
   */
  onCollision() {
    if (this._destroyed || !this.isMoving) return;

    const blocked = this.targetPosition
      ? { ...this.targetPosition }
      : { x: this.player.x, y: this.player.y };

    this.player.body.stop();
    this.isMoving = false;
    this.targetPosition = null;
    this._setIdleFrame();

    this.emit('move-blocked', blocked);
  }

  /**
   * Fully clean up this system. Removes all listeners, destroys graphics,
   * and nulls references. Safe to call multiple times.
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    // Disable input
    this._enabled = false;
    this.scene.input.off('pointerdown', this._onPointerDown);

    // Remove scene lifecycle listeners
    this.scene.events.off('shutdown', this._onShutdown);
    this.scene.events.off('destroy', this._onShutdown);

    // Clean up tap marker
    this._destroyTapMarker();

    // Stop player if still moving
    if (this.isMoving && this.player?.body) {
      this.player.body.stop();
    }

    // Remove all EventEmitter listeners registered on this instance
    this.removeAllListeners();

    // Null out references to allow GC
    this.isMoving = false;
    this.targetPosition = null;
    this._prevDist = null;
    this.scene = null;
    this.player = null;
    this.config = null;
    this._onPointerDown = null;
    this._onShutdown = null;
  }

  // ---------------------------------------------------------------------------
  // Private — Input
  // ---------------------------------------------------------------------------

  /**
   * @param {Phaser.Input.Pointer} pointer
   * @private
   */
  _handlePointerDown(pointer) {
    if (this._destroyed || !this._enabled) return;

    // Convert screen coords to world coords (respects camera scroll/zoom)
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    let targetX = worldPoint.x;
    let targetY = worldPoint.y;

    // Clamp target to world bounds if the player collides with world bounds
    const body = this.player.body;
    const world = this.scene.physics?.world;
    if (body && world && body.collideWorldBounds) {
      const bounds = world.bounds;
      const halfWidth = this.player.displayWidth / 2;
      const offsetX = body.offset.x;
      const offsetY = body.offset.y;

      const minX = bounds.x + halfWidth - offsetX;
      const maxX = bounds.right - body.width + halfWidth - offsetX;
      const minY = bounds.y + this.player.displayHeight - offsetY;
      const maxY = bounds.bottom - body.height + this.player.displayHeight - offsetY;

      targetX = Phaser.Math.Clamp(targetX, minX, maxX);
      targetY = Phaser.Math.Clamp(targetY, minY, maxY);
    }

    const pos = { x: targetX, y: targetY };

    // Always emit 'tap' so other systems (NPC interaction, etc.) can intercept
    this.emit('tap', pos);

    // Show visual feedback
    if (this.config.showTapMarker) {
      this._showTapMarker(pos.x, pos.y);
    }

    // Begin movement
    this.moveTo(pos.x, pos.y);
  }

  // ---------------------------------------------------------------------------
  // Private — Animation
  // ---------------------------------------------------------------------------

  /**
   * Determine walk direction and play the matching animation.
   * Falls back gracefully if animations aren't defined yet.
   *
   * @param {number} targetX
   * @param {number} targetY
   * @private
   */
  _updateAnimation(targetX, targetY) {
    const dx = targetX - this.player.x;
    const dy = targetY - this.player.y;

    // Determine primary direction
    let direction;
    if (Math.abs(dx) > Math.abs(dy)) {
      direction = dx > 0 ? 'right' : 'left';
    } else {
      direction = dy > 0 ? 'down' : 'up';
    }

    const animKey = `walk-${direction}`;

    // Only play if the animation exists (prevents warnings when using placeholders)
    if (this.player.anims?.exists?.(animKey)) {
      this.player.anims.play(animKey, true);
    } else {
      // Flip sprite as a simple fallback for left/right
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

  // ---------------------------------------------------------------------------
  // Private — Tap Marker
  // ---------------------------------------------------------------------------

  /**
   * Show a fading circle at the tap point. Reuses a single Graphics object
   * to avoid allocating new ones every tap.
   *
   * @param {number} x — World X
   * @param {number} y — World Y
   * @private
   */
  _showTapMarker(x, y) {
    // Kill any running fade-out tween
    if (this._tapMarkerTween) {
      this._tapMarkerTween.destroy();
      this._tapMarkerTween = null;
    }

    // Create the marker graphics once, reuse thereafter
    if (!this._tapMarker) {
      this._tapMarker = this.scene.add.graphics();
      // Ensure it renders above the tilemap but below UI
      this._tapMarker.setDepth(10);
    }

    // Redraw at new position
    this._tapMarker.clear();
    this._tapMarker.fillStyle(this.config.tapMarkerColor, this.config.tapMarkerAlpha);
    this._tapMarker.fillCircle(x, y, this.config.tapMarkerRadius);
    this._tapMarker.setAlpha(1);
    this._tapMarker.setVisible(true);

    // Fade out
    this._tapMarkerTween = this.scene.tweens.add({
      targets: this._tapMarker,
      alpha: 0,
      duration: this.config.tapMarkerDuration,
      ease: 'Power2',
      onComplete: () => {
        if (this._tapMarker) {
          this._tapMarker.setVisible(false);
        }
        this._tapMarkerTween = null;
      },
    });
  }

  /**
   * Destroy the tap marker graphics and tween.
   * @private
   */
  _destroyTapMarker() {
    if (this._tapMarkerTween) {
      this._tapMarkerTween.destroy();
      this._tapMarkerTween = null;
    }
    if (this._tapMarker) {
      this._tapMarker.destroy();
      this._tapMarker = null;
    }
  }
}
