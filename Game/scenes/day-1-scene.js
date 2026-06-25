import Phaser from 'phaser';
import { Character } from '../entities/character.js';
import { Player } from '../entities/player.js';
import { NPC } from '../entities/npc.js';
import { DialogSystem } from '../systems/dialog-system.js';
import { DroneManager } from '../systems/drone-manager.js';
import { DAY_1_INTRO_DIALOG, DAY_1_VICTORY_DIALOG } from '../data/dialog-data.js';

/**
 * Day1Scene — Kiryat Shmona: Dodging Journalists
 *
 * Uses the reusable Player, NPC, and JoystickMove classes.
 * Everything positioned relative to screen height.
 */

// How many character-widths wide the world is
const WORLD_CHARS_WIDE = 120;

export class Day1Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Day1Scene' });

    /** @type {Player} */
    this.player = null;

    /** @type {Phaser.Physics.Arcade.StaticGroup} */
    this.npcGroup = null;

    /** @type {NPC[]} */
    this.npcList = [];

    /** @type {number} sprite scale factor */
    this.s = 1;
    this._autoScrollSpeed = 80; // px/sec
    this._bgTile = null;

    /** @type {number} */
    this.roadTop = 0;

    /** @type {number} */
    this.roadBottom = 0;

    /** @type {boolean} */
    this.isGameOver = false;

    /** @type {boolean} */
    this.isSceneOver = false;

    /** @type {DroneManager} */
    this.droneManager = null;

    /** @type {Phaser.GameObjects.Particles.ParticleEmitter} */
    this.explosionParticles = null;

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

    // Parallax tiled background (will repeat automatically)
    if (this.textures.exists('bg')) {
      this.add.image(0, 0, 'bg')
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(0)
        .setDisplaySize(width, height);
    }
    // --- Background ---
    this.cameras.main.setBackgroundColor(0x1a1a2e);
    // this._buildSkyline(worldWidth, this.roadTop);
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

    this.npcList.forEach((npc, index) => {
      const textureKey = index % 2 === 0 ? 'yuval' : 'shiri';
      if (this.textures.exists(textureKey) && typeof npc.setTexture === 'function') {
        npc.setTexture(textureKey);
      }
    });

    // --- Player ---
    const startX = this.scale.width / 2;
    const startY = roadCenterY + charH * 0.3;
    this.player = new Player(this, startX, startY, this.s);
    this.player.setWorldBounds(0, this.roadTop, worldWidth, roadHeight);

    // --- NPC collision (player stops on contact) ---
    this.physics.add.collider(
      this.player,
      this.npcGroup,
      () => {
        if (this.player) this.player.onCollision();
      },
      null,
      this
    );

    // --- Camera ---
    this.cameras.main.setBounds(0, 0, worldWidth, height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0);

    // Disable movement initially for intro dialogue
    if (this.player) this.player.disable();

    // --- HUD ---
    this._createHUD();

    this.player.on('move-start', () => this._updateHUD('Walking...'));
    this.player.on('move-end', () => this._updateHUD('Drag joystick to move →'));
    this.player.on('move-blocked', () => this._updateHUD('Blocked!'));

    // --- Particles ---
    this.explosionParticles = this.add.particles(0, 0, 'particle', {
      speed: { min: 40 * this.s, max: 130 * this.s },
      scale: { start: 3, end: 0 },
      lifespan: 500,
      tint: [0xff0000, 0xff5500, 0xffaa00, 0xffffff],
      emitting: false
    });
    this.explosionParticles.setDepth(2500);

    // --- Drone Spawning & Coordination (Controller/Model) ---
    this.droneManager = new DroneManager(this, this.player, {
      particles: this.explosionParticles,
      roadTop: this.roadTop,
      roadBottom: this.roadBottom,
      worldWidth: worldWidth,
      scale: this.s
    });

    // Listen to MVC controller notifications
    this.droneManager.on('drone-exploded', (count) => {
      this._updateDroneHUD(count);
    });

    this.droneManager.on('player-hit', () => {
      this.triggerGameOver();
    });

    this.droneManager.on('all-drones-dodged', () => {
      this.time.delayedCall(1000, () => {
        if (!this.isGameOver) {
          this.triggerSceneOver();
        }
      });
    });

    this.player.once('move-start', () => {
      this.isGameOver = false;
      this.isSceneOver = false;
      this.droneManager.start();
    });

    // --- Play Intro Cutscene Dialogue ---
    this._updateHUD('Incoming transmission...');
    const introDialog = new DialogSystem(this, DAY_1_INTRO_DIALOG, () => {
      this.player.enable();
      this._updateHUD('Drag joystick to move →');
    });
    introDialog.start();

    // Cleanup on shutdown
    this.events.once('shutdown', () => {
      if (this.droneManager) this.droneManager.destroy();
    });
  }

  update(time, delta) {
    if (this.player) {
      this.player.update();
    }

    // Parallax background scroll: slower than camera for depth
    const cam = this.cameras && this.cameras.main;
    if (this._bgTile && cam) {
      this._bgTile.tilePositionX = cam.scrollX * 0.35;
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
    this._hudText = this.add.text(10, 10, 'Drag joystick to move →', {
      fontFamily: 'monospace',
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 4 },
    });
    this._hudText.setScrollFactor(0);
    this._hudText.setDepth(1000);

    this._droneHudText = this.add.text(10, 15 + fontSize * 1.5, 'Drones Dodged: 0/10', {
      fontFamily: 'monospace',
      fontSize: `${fontSize}px`,
      color: '#ff2a5f',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 4 },
    });
    this._droneHudText.setScrollFactor(0);
    this._droneHudText.setDepth(1000);
  }

  /** @private */
  _updateHUD(message) {
    if (this._hudText) {
      this._hudText.setText(message);
    }
  }

  _updateDroneHUD(count) {
    if (this._droneHudText) {
      this._droneHudText.setText(`Drones Dodged: ${count}/10`);
    }
  }

  // ---------------------------------------------------------------------------
  // Scene Game States (GameOver, SceneOver, Victory UI)
  // ---------------------------------------------------------------------------

  triggerGameOver() {
    if (this.isGameOver || this.isSceneOver) return;
    this.isGameOver = true;

    if (this.player) this.player.disable();
    if (this.droneManager) this.droneManager.stop();

    // Falling / grey out animation
    this.tweens.add({
      targets: this.player,
      angle: 90,
      tint: 0x333333,
      y: this.player.y + 5 * this.s,
      duration: 600,
      ease: 'Bounce.easeOut'
    });

    // Screen darken overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, this.scale.width, this.scale.height);
    overlay.setScrollFactor(0);
    overlay.setDepth(10000);
    overlay.setAlpha(0);

    const title = this.add.text(this.scale.width / 2, this.scale.height / 2 - 40, 'GAME OVER', {
      fontFamily: 'Impact, sans-serif',
      fontSize: `${Math.round(this.scale.height * 0.12)}px`,
      color: '#ff2a5f',
      stroke: '#000000',
      strokeThickness: 6,
      align: 'center'
    });
    title.setOrigin(0.5);
    title.setScrollFactor(0);
    title.setDepth(10001);
    title.setAlpha(0);

    const subtitle = this.add.text(this.scale.width / 2, this.scale.height / 2 + 20, 'TAP ANYWHERE TO TRY AGAIN', {
      fontFamily: 'monospace',
      fontSize: `${Math.round(this.scale.height * 0.045)}px`,
      color: '#ffffff',
      align: 'center'
    });
    subtitle.setOrigin(0.5);
    subtitle.setScrollFactor(0);
    subtitle.setDepth(10001);
    subtitle.setAlpha(0);

    this.tweens.add({
      targets: [overlay, title, subtitle],
      alpha: 1,
      duration: 800,
      onComplete: () => {
        this.input.once('pointerdown', () => {
          this.scene.restart();
        });
      }
    });
  }

  triggerSceneOver() {
    if (this.isSceneOver || this.isGameOver) return;
    this.isSceneOver = true;

    if (this.player) this.player.disable();
    if (this.droneManager) this.droneManager.stop();

    // Trigger dialogue overlay using externalized dialogue text (Model)
    const dialog = new DialogSystem(this, DAY_1_VICTORY_DIALOG, () => {
      this.showVictoryScreen();
    });
    dialog.start();
  }

  showVictoryScreen() {
    const overlay = this.add.graphics();
    overlay.fillStyle(0x0f0c1b, 0.85);
    overlay.fillRect(0, 0, this.scale.width, this.scale.height);
    overlay.setScrollFactor(0);
    overlay.setDepth(10000);
    overlay.setAlpha(0);

    const title = this.add.text(this.scale.width / 2, this.scale.height / 2 - 30, 'SCENE CLEAR', {
      fontFamily: 'Impact, sans-serif',
      fontSize: `${Math.round(this.scale.height * 0.1)}px`,
      color: '#00ffcc',
      stroke: '#000000',
      strokeThickness: 6,
      align: 'center'
    });
    title.setOrigin(0.5);
    title.setScrollFactor(0);
    title.setDepth(10001);
    title.setAlpha(0);

    const subtitle = this.add.text(this.scale.width / 2, this.scale.height / 2 + 25, 'TAP ANYWHERE TO CONTINUE', {
      fontFamily: 'monospace',
      fontSize: `${Math.round(this.scale.height * 0.04)}px`,
      color: '#ffffff',
      align: 'center'
    });
    subtitle.setOrigin(0.5);
    subtitle.setScrollFactor(0);
    subtitle.setDepth(10001);
    subtitle.setAlpha(0);

    this.tweens.add({
      targets: [overlay, title, subtitle],
      alpha: 1,
      duration: 800,
      onComplete: () => {
        this.input.once('pointerdown', () => {
          this.events.emit('complete');
        });
      }
    });
  }
}
