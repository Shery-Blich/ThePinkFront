import Phaser from 'phaser';
import { Character } from '../entities/character.js';
import { Player } from '../entities/player.js';
import { NPC } from '../entities/npc.js';
import { TapToMove } from '../systems/tap-to-move.js';

/**
 * Day1Scene — Kiryat Shmona: Dodging Journalists
 *
 * Uses the reusable Player, NPC, and TapToMove classes.
 * Everything positioned relative to screen height.
 */

// How many character-widths wide the world is
const WORLD_CHARS_WIDE = 120;

export class Day1Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Day1Scene' });

    /** @type {Player} */
    this.player = null;

    /** @type {TapToMove} */
    this.movement = null;

    /** @type {Phaser.Physics.Arcade.StaticGroup} */
    this.npcGroup = null;

    /** @type {NPC[]} */
    this.npcList = [];

    /** @type {number} sprite scale factor */
    this.s = 1;

    /** @type {number} */
    this.roadTop = 0;

    /** @type {number} */
    this.roadBottom = 0;
  }

  create() {
    const { width, height } = this.scale;

    // --- Scale from screen height ---
    this.s = Character.computeScale(height);

    const charH = 20 * this.s;
    const charW = 12 * this.s;

    // --- Road band ---
    this.roadTop = Math.round(height * 0.60);
    this.roadBottom = Math.round(height * 0.92);
    const roadHeight = this.roadBottom - this.roadTop;
    const roadCenterY = this.roadTop + roadHeight / 2;

    // --- World size ---
    const worldWidth = WORLD_CHARS_WIDE * charW;

    // --- Background ---
    this.cameras.main.setBackgroundColor(0x1a1a2e);
    this._buildSkyline(worldWidth, this.roadTop);
    this._buildRoad(worldWidth, roadHeight, roadCenterY);

    // --- NPCs ---
    const npcSpacing = worldWidth / 12;
    const npcPositions = [];
    for (let i = 0; i < 10; i++) {
      npcPositions.push({
        x: npcSpacing * (i + 1),
        y: (i % 2 === 0)
          ? this.roadTop + roadHeight * 0.35
          : this.roadTop + roadHeight * 0.70,
      });
    }

    const { group, npcs } = NPC.spawnGroup(this, npcPositions, this.s);
    this.npcGroup = group;
    this.npcList = npcs;

    // --- Player ---
    const startX = charW * 3;
    const startY = roadCenterY + charH * 0.3;
    this.player = new Player(this, startX, startY, this.s);
    this.player.setWorldBounds(0, this.roadTop, worldWidth, roadHeight);

    // --- NPC collision (player stops on contact) ---
    this.physics.add.collider(
      this.player,
      this.npcGroup,
      () => {
        if (this.movement) this.movement.onCollision();
      },
      null,
      this
    );

    // --- Camera ---
    this.cameras.main.setBounds(0, 0, worldWidth, height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0);

    // --- Movement ---
    this.movement = new TapToMove(this, this.player, {
      speed: charW * 3.5,
      showTapMarker: true,
      tapMarkerColor: 0xffcc00,
      tapMarkerRadius: Math.max(4, this.s * 3),
      tapMarkerDuration: 350,
    });
    this.movement.enable();

    // --- HUD ---
    this._createHUD();

    this.movement.on('move-start', () => this._updateHUD('Walking...'));
    this.movement.on('move-end', () => this._updateHUD('Tap to move →'));
    this.movement.on('move-blocked', () => this._updateHUD('Blocked!'));
  }

  update(time, delta) {
    if (this.movement) {
      this.movement.update();
    }

    // Depth sort all characters
    if (this.player) {
      this.player.depthSort();
    }
    for (const npc of this.npcList) {
      npc.depthSort();
    }
  }

  // ---------------------------------------------------------------------------
  // Skyline
  // ---------------------------------------------------------------------------

  /** @private */
  _buildSkyline(worldWidth, groundY) {
    const bldKeys = ['bld_a', 'bld_b', 'bld_c', 'bld_d', 'bld_e'];
    const s = this.s;

    let seed = 42;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    // Back layer
    let x = -10 * s;
    while (x < worldWidth + 100 * s) {
      const key = bldKeys[Math.floor(rand() * bldKeys.length)];
      const frame = this.textures.get(key).getSourceImage();
      const bScale = s * 0.85;

      const b = this.add.image(x, groundY, key);
      b.setOrigin(0, 1);
      b.setScale(bScale);
      b.setTint(0x444460);
      b.setAlpha(0.5);
      b.setDepth(1);

      x += frame.width * bScale - 2 * s;
    }

    // Front layer
    x = 5 * s;
    while (x < worldWidth + 100 * s) {
      const key = bldKeys[Math.floor(rand() * bldKeys.length)];
      const frame = this.textures.get(key).getSourceImage();

      const b = this.add.image(x, groundY, key);
      b.setOrigin(0, 1);
      b.setScale(s);
      b.setDepth(2);

      x += frame.width * s - 1 * s;
    }
  }

  // ---------------------------------------------------------------------------
  // Road
  // ---------------------------------------------------------------------------

  /** @private */
  _buildRoad(worldWidth, roadHeight, roadCenterY) {
    const s = this.s;
    const tileW = 16 * s;
    const tilesNeeded = Math.ceil(worldWidth / tileW) + 1;
    const { height } = this.scale;

    // Asphalt
    for (let i = 0; i < tilesNeeded; i++) {
      const tile = this.add.image(i * tileW, this.roadTop, 'road');
      tile.setOrigin(0, 0);
      tile.setDisplaySize(tileW, roadHeight);
      tile.setDepth(3);
    }

    // Upper curb
    for (let i = 0; i < tilesNeeded; i++) {
      const curb = this.add.image(i * tileW, this.roadTop, 'curb');
      curb.setOrigin(0, 0);
      curb.setScale(s);
      curb.setDepth(4);
    }

    // Lower curb
    for (let i = 0; i < tilesNeeded; i++) {
      const curb = this.add.image(i * tileW, this.roadBottom - 2 * s, 'curb');
      curb.setOrigin(0, 0);
      curb.setScale(s);
      curb.setDepth(4);
    }

    // Dashed center line
    const dashW = 6 * s;
    const dashGap = 10 * s;
    const dashCount = Math.ceil(worldWidth / (dashW + dashGap));
    for (let i = 0; i < dashCount; i++) {
      const dash = this.add.image(i * (dashW + dashGap), roadCenterY, 'road_line');
      dash.setOrigin(0, 0.5);
      dash.setScale(s);
      dash.setAlpha(0.7);
      dash.setDepth(4);
    }

    // Sidewalk below road
    for (let i = 0; i < tilesNeeded; i++) {
      const sw = this.add.image(i * tileW, this.roadBottom, 'sidewalk');
      sw.setOrigin(0, 0);
      sw.setDisplaySize(tileW, height - this.roadBottom);
      sw.setDepth(3);
    }
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  /** @private */
  _createHUD() {
    const fontSize = Math.max(12, Math.round(this.scale.height * 0.025));
    this._hudText = this.add.text(10, 10, 'Tap to move →', {
      fontFamily: 'monospace',
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 4 },
    });
    this._hudText.setScrollFactor(0);
    this._hudText.setDepth(1000);
  }

  /** @private */
  _updateHUD(message) {
    if (this._hudText) {
      this._hudText.setText(message);
    }
  }
}
