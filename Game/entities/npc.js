import { Character } from './character.js';
import Phaser from 'phaser';

/**
 * NPC — A non-player character.
 *
 * Extends Character with:
 * - Dynamic or static Arcade physics body
 * - Random wandering behavior (twitchy, organic direction switching)
 * - Bottom-half collision so player can walk behind/around
 * - Designed to be created individually or via NPC.spawnGroup()
 *
 * @example
 *   // Spawn a group of wandering NPCs along the road:
 *   const { group, npcs } = NPC.spawnGroup(this, positions, scale);
 *   this.physics.add.collider(player, group);
 */
export class NPC extends Character {

  /**
   * @param {Phaser.Scene} scene — The scene to add the NPC to
   * @param {number} x — World X position
   * @param {number} y — World Y position (feet)
   * @param {number} scale — Pixel art scale factor
   * @param {boolean} [isStatic=false] — If true, creates a static body
   * @param {boolean} [isWandering=true] — If true (and not static), NPC wanders randomly
   */
  constructor(scene, x, y, scale, isStatic = false, isWandering = true) {
    super(scene, x, y, 'npc', scale, isStatic);

    /** @type {boolean} */
    this.isStatic = isStatic;

    /** @type {boolean} */
    this.isWandering = !isStatic && isWandering;

    /** @type {'IDLE' | 'WALKING'} Current wander state */
    this.wanderState = 'IDLE';

    /** @type {number} Timer for state changes */
    this.stateTimer = 0;

    /** @type {number} Duration until next wander state change (ms) */
    this.nextStateDuration = 0;

    if (!isStatic && this.body) {
      this.body.setImmovable(true);
      this.body.setCollideWorldBounds(true);
    }

    this._setupCollisionBody();
  }

  /**
   * Update lifecycle (called each frame).
   *
   * @param {number} time
   * @param {number} delta
   */
  update(time, delta) {
    this.depthSort();

    if (this.isWandering && !this.isStatic) {
      this._updateWander(delta);
    }
  }

  /**
   * Random wandering AI logic.
   * Periodically picks random directions and speeds without ever stopping.
   *
   * @private
   * @param {number} delta — Time elapsed since last frame in ms
   */
  _updateWander(delta) {
    if (!this.body) return;

    this.stateTimer += delta;

    const currentSpeedSq = this.body.velocity.x * this.body.velocity.x + this.body.velocity.y * this.body.velocity.y;

    // Check if blocked by world bounds or obstacles while walking
    const isBlocked =
      this.body.blocked.left ||
      this.body.blocked.right ||
      this.body.blocked.up ||
      this.body.blocked.down;

    if (isBlocked && this.stateTimer > 200) {
      // Reverse velocity away from boundary/obstacle
      const vx = -this.body.velocity.x || (Phaser.Math.Between(-1, 1) || 1) * 40 * this.spriteScale;
      const vy = -this.body.velocity.y || (Phaser.Math.Between(-1, 1) || 1) * 40 * this.spriteScale;
      this.body.setVelocity(vx, vy);

      if (vx < -5) this.setFlipX(true);
      else if (vx > 5) this.setFlipX(false);

      this.stateTimer = 0;
      this.nextStateDuration = Phaser.Math.Between(1000, 2500);
      return;
    }

    // If standing still or timer expired, pick a new direction immediately (never stop!)
    if (currentSpeedSq < 100 || this.stateTimer >= this.nextStateDuration) {
      this.stateTimer = 0;
      this.wanderState = 'WALKING';

      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.Between(35, 75) * this.spriteScale;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      this.body.setVelocity(vx, vy);

      if (vx < -5) this.setFlipX(true);
      else if (vx > 5) this.setFlipX(false);

      this.nextStateDuration = Phaser.Math.Between(1500, 3500);
    }
  }

  /**
   * Set up bottom-half collision body.
   *
   * @protected
   * @override
   */
  _setupCollisionBody() {
    if (!this.body) return;

    const s = this.spriteScale;
    const texW = this.frame?.realWidth || this.frame?.width || this.width || 12;
    const texH = this.frame?.realHeight || this.frame?.height || this.height || 20;

    const targetHeight = 20 * s;
    const targetWidth = (texW / texH) * targetHeight;

    const scaleX = targetWidth / texW;
    const scaleY = targetHeight / texH;

    const localWidth = (10 * s) / (scaleX || 1);
    const localHeight = (10 * s) / (scaleY || 1);
    const localOffsetX = ((targetWidth - 10 * s) / 2) / (scaleX || 1);
    const localOffsetY = (10 * s) / (scaleY || 1);

    this.body.setSize(localWidth, localHeight);
    this.body.setOffset(localOffsetX, localOffsetY);

    if (this.isStatic) {
      this.body.reset(this.x, this.y);
    } else {
      this.body.setImmovable(true);
      this.body.setCollideWorldBounds(true);
    }
  }

  /**
   * Spawn a group of NPCs at the given positions.
   *
   * @param {Phaser.Scene} scene — The scene to add NPCs to
   * @param {{ x: number, y: number }[]} positions — Array of spawn positions
   * @param {number} scale — Pixel art scale factor
   * @param {object} [options] — Configuration options
   * @param {boolean} [options.isStatic=false] — Whether bodies are static
   * @param {boolean} [options.isWandering=true] — Whether NPCs wander randomly
   * @returns {{ group: Phaser.Physics.Arcade.Group | Phaser.Physics.Arcade.StaticGroup, npcs: NPC[] }}
   */
  static spawnGroup(scene, positions, scale, options = {}) {
    const isStatic = options.isStatic ?? false;
    const isWandering = options.isWandering ?? !isStatic;

    const group = isStatic ? scene.physics.add.staticGroup() : scene.physics.add.group();
    const npcs = [];

    for (const pos of positions) {
      const npc = new NPC(scene, pos.x, pos.y, scale, isStatic, isWandering);
      group.add(npc);

      if (!isStatic && npc.body) {
        npc.body.setImmovable(true);
        npc.body.setCollideWorldBounds(true);
      }

      npc._setupCollisionBody();
      npcs.push(npc);
    }

    return { group, npcs };
  }
}

