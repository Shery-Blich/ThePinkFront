import { Character } from './Character.js';

/**
 * Player — The player-controlled character.
 *
 * Extends Character with:
 * - Dynamic physics body (moves via TapToMove or other input)
 * - World bounds collision
 * - Can be reused across any scene
 *
 * @example
 *   const scale = Character.computeScale(this.scale.height);
 *   const player = new Player(this, 100, 300, scale);
 *   player.setWorldBounds(0, roadTop, worldWidth, roadHeight);
 */
export class Player extends Character {

  /**
   * @param {Phaser.Scene} scene — The scene to add the player to
   * @param {number} x — Starting X position (world coords)
   * @param {number} y — Starting Y position (feet, world coords)
   * @param {number} scale — Pixel art scale factor (use Character.computeScale)
   */
  constructor(scene, x, y, scale) {
    super(scene, x, y, 'player', scale, false /* dynamic body */);
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
}
