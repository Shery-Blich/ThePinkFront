import Phaser from 'phaser';

/**
 * Character — Base class for all game characters (player, NPCs, enemies).
 *
 * Extends Phaser.Physics.Arcade.Sprite with shared behavior:
 * - Scale relative to screen height (looks the same on any device)
 * - Origin at feet (0.5, 1) for natural depth sorting
 * - Bottom-half collision body for 2.5D depth effect
 * - Y-based depth sorting
 *
 * @abstract — Don't instantiate directly, use Player or NPC.
 */
export class Character extends Phaser.Physics.Arcade.Sprite {

  /**
   * @param {Phaser.Scene} scene — The scene to add this character to
   * @param {number} x — World X position
   * @param {number} y — World Y position (feet)
   * @param {string} texture — Texture key (e.g., 'player', 'npc')
   * @param {number} scale — Pixel art scale factor
   * @param {boolean} [isStatic=false] — If true, creates a static body (for NPCs/obstacles)
   */
  constructor(scene, x, y, texture, scale, isStatic = false) {
    super(scene, x, y, texture);

    // Add to scene's display + physics
    scene.add.existing(this);
    scene.physics.add.existing(this, isStatic);

    /** @type {number} The pixel art scale factor */
    this.spriteScale = scale;

    // --- Common setup ---
    this.setScale(scale);
    this.setOrigin(0.5, 1); // Feet at position

    // --- Bottom-half collision body ---
    // Texture is 12×20. Collision covers bottom 10px only,
    // so characters can walk "behind" the top half (depth illusion).
    this._setupCollisionBody();
  }

  /**
   * Compute the scale factor for characters based on screen height.
   * Characters will always be ~12% of screen height.
   *
   * @param {number} screenHeight — The current screen/canvas height
   * @returns {number} Integer scale factor (minimum 1)
   */
  static computeScale(screenHeight) {
    // Player texture is 20px tall → 20 * scale = 12% of screen
    return Math.max(1, Math.round((screenHeight * 0.12) / 20));
  }

  /**
   * Update depth based on Y position.
   * Call this every frame for correct overlap rendering.
   * Characters lower on screen render on top (closer to camera).
   */
  depthSort() {
    this.setDepth(this.y);
  }

  /**
   * Set up the physics collision body to cover only the bottom half
   * of the sprite. Override in subclasses for custom body shapes.
   *
   * @protected
   */
  _setupCollisionBody() {
    // 12×20 texture → body covers bottom 10px (feet area)
    this.body.setSize(10, 10);
    this.body.setOffset(1, 10);
  }
}
