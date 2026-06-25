import { Character } from './Character.js';

/**
 * NPC — A non-player character with a static physics body.
 *
 * Extends Character with:
 * - Static body (doesn't move from physics forces)
 * - Bottom-half collision so the player can walk "behind" the top
 * - Designed to be created in batches via NPC.spawnGroup()
 *
 * @example
 *   // Spawn a group of NPCs along the road:
 *   const { group, npcs } = NPC.spawnGroup(this, positions, scale);
 *   this.physics.add.collider(player, group);
 */
export class NPC extends Character {

  /**
   * @param {Phaser.Scene} scene — The scene to add the NPC to
   * @param {number} x — World X position
   * @param {number} y — World Y position (feet)
   * @param {number} scale — Pixel art scale factor
   */
  constructor(scene, x, y, scale) {
    super(scene, x, y, 'npc', scale, true /* static body */);

    // Refresh static body to account for scale + origin changes
    this.body.updateFromGameObject();
    this._setupCollisionBody();
  }

  /**
   * Override collision body setup for static NPCs.
   * Uses the same bottom-half approach but refreshes the static body.
   *
   * @protected
   * @override
   */
  _setupCollisionBody() {
    // 12×20 texture → body covers bottom 10px (feet area)
    const s = this.spriteScale;
    this.body.setSize(10 * s, 10 * s);
    this.body.setOffset(1 * s, 10 * s);
    this.body.reset();
  }

  /**
   * Spawn a group of NPCs at the given positions.
   *
   * Returns the Phaser group (for colliders) and an array of NPC instances
   * (for individual access / depth sorting).
   *
   * @param {Phaser.Scene} scene — The scene to add NPCs to
   * @param {{ x: number, y: number }[]} positions — Array of spawn positions
   * @param {number} scale — Pixel art scale factor
   * @returns {{ group: Phaser.Physics.Arcade.StaticGroup, npcs: NPC[] }}
   */
  static spawnGroup(scene, positions, scale) {
    const group = scene.physics.add.staticGroup();
    const npcs = [];

    for (const pos of positions) {
      const npc = new NPC(scene, pos.x, pos.y, scale);
      group.add(npc);
      // Re-refresh after adding to group (group.add can reset body)
      npc.body.updateFromGameObject();
      npc._setupCollisionBody();
      npcs.push(npc);
    }

    return { group, npcs };
  }
}
