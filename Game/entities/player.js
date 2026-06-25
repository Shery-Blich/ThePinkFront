import { Character } from './character.js';
import { JoystickMove } from '../systems/joystick-move.js';

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

    // Forward movement events so external systems (like Day1Scene HUD) can listen directly on the player
    this.movement.on('move-start', (payload) => this.emit('move-start', payload));
    this.movement.on('move-end', (payload) => this.emit('move-end', payload));
    this.movement.on('move-blocked', (payload) => this.emit('move-blocked', payload));
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
