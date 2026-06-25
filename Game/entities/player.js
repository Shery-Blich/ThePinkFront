import { Character } from './character.js';
import { TapToMove } from '../systems/tap-to-move.js';

/**
 * Player — The player-controlled character.
 *
 * Extends Character with:
 * - Dynamic physics body (moves via TapToMove or other input)
 * - World bounds collision
 * - Can be reused across any scene
 * - Handles its own movement system, sizing, and rushing speed logic
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
      this._setupCollisionBody();
    }

    // --- Rushing Speed Logic Configuration ---
    const charW = 12 * s;
    /** @type {number} Base walking speed */
    this.baseSpeed = charW * 3.5;
    /** @type {number} Current speed (with optional rush boosts) */
    this.currentSpeed = this.baseSpeed;
    /** @type {number} Reasonable max speed (2x base speed) */
    this.maxSpeed = this.baseSpeed * 2.0;
    /** @type {number} Speed boost added on each consecutive fast tap */
    this.rushBoost = this.baseSpeed * 0.3;
    /** @type {number} Timestamp of the last tap in milliseconds */
    this.lastTapTime = 0;
    /** @type {number} Time window (ms) to detect fast clicks */
    this.tapTimeWindow = 500;
    /** @type {{x: number, y: number} | null} Location of the last tap */
    this.lastTapPosition = null;

    // --- Movement system ---
    /** @type {TapToMove} */
    this.movement = new TapToMove(scene, this, {
      speed: this.currentSpeed,
      showTapMarker: true,
      tapMarkerColor: 0xffcc00,
      tapMarkerRadius: Math.max(4, s * 3),
      tapMarkerDuration: 350,
    });

    // Forward movement events so external systems (like Day1Scene HUD) can listen directly on the player
    this.movement.on('move-start', (payload) => this.emit('move-start', payload));
    this.movement.on('move-end', (payload) => this.emit('move-end', payload));
    this.movement.on('move-blocked', (payload) => this.emit('move-blocked', payload));
    
    // Listen for tap inputs to calculate rushing speed adjustments
    this.movement.on('tap', (pos) => this._handleTap(pos));

    // Reset speed when player reaches target or stops moving
    this.movement.on('move-end', () => this.resetSpeed());
  }

  /**
   * Internal click/tap handler. If clicks are rapid and near the last click, speed up.
   * @param {{x: number, y: number}} pos — Tap position in world coordinates
   * @private
   */
  _handleTap(pos) {
    const now = this.scene.time.now;
    const timeDiff = now - this.lastTapTime;

    let isNearLastTap = true;
    if (this.lastTapPosition && pos) {
      const dist = Phaser.Math.Distance.Between(
        this.lastTapPosition.x,
        this.lastTapPosition.y,
        pos.x,
        pos.y
      );
      // Check if within 120 pixels of the last tap (adjusted for scale)
      const maxDistance = 120 * this.s;
      isNearLastTap = dist < maxDistance;
    }

    if (timeDiff < this.tapTimeWindow && isNearLastTap) {
      // Rushing! Apply boost up to max speed
      this.currentSpeed = Math.min(this.maxSpeed, this.currentSpeed + this.rushBoost);
    } else {
      // Normal tap or far away: reset to base speed
      this.currentSpeed = this.baseSpeed;
    }

    this.lastTapTime = now;
    if (pos) {
      this.lastTapPosition = { x: pos.x, y: pos.y };
    }

    // Apply the speed directly to the movement config
    if (this.movement) {
      this.movement.config.speed = this.currentSpeed;
    }
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
   * Update lifecycle (called each frame).
   */
  update() {
    if (this.movement) {
      this.movement.update();
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
    if (this.movement) {
      this.movement.destroy();
      this.movement = null;
    }
    super.destroy(fromScene);
  }
}
