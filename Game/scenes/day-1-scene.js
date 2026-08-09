import Phaser from "phaser";
import { Character } from "../entities/character.js";
import { Player } from "../entities/player.js";
import { NPC } from "../entities/npc.js";
import { MovementTutorial } from "../systems/movement-tutorial.js";
import { DroneManager } from "../systems/drone-manager.js";
import { startSceneMusic } from "../systems/bg-music.js";
import { showVictoryHelper, showGameOverHelper } from "../systems/level-ui-helper.js";
import { LivesManager } from "../systems/lives-manager.js";
import {
  trackSceneStarted,
  trackFirstMove,
  trackObstacleHit,
  trackGameFailed,
} from "../analytics.js";

import { addGlobalScore } from "../systems/score-manager.js";
import { playDialogOnce } from "../systems/dialog-system.js";
import { DAY_1_INTRO_DIALOG, DAY_1_VICTORY_DIALOG } from "../data/dialog-data.js";

/**
 * Day1Scene — Kiryat Shmona: Dodging Journalists
 *
 * Uses the reusable Player, NPC, and JoystickMove classes.
 * Everything positioned relative to screen height.
 */

// How many character-widths wide the world is
const WORLD_CHARS_WIDE = 300;

export class Day1Scene extends Phaser.Scene {
  constructor() {
    super({ key: "Day1Scene" });

    /** @type {Player} */
    this.player = null;

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

    /** @type {boolean} */
    this.isGameOver = false;

    /** @type {boolean} */
    this.isSceneOver = false;

    /** @type {DroneManager} */
    this.droneManager = null;

    /** @type {Phaser.GameObjects.Particles.ParticleEmitter} */
    this.explosionParticles = null;

    // Supermarket graphics placeholder
    this.supermarket = null;
    this.superLabel = null;
  }

  create() {
    const { width, height } = this.scale;

    trackSceneStarted("kiryat_shmona");
    startSceneMusic(this, "bg-sessions");

    // --- Scale from screen height ---
    this.s = Character.computeScale(height);

    const charH = 20 * this.s;
    const charW = 12 * this.s;

    // --- Road band ---
    this.roadTop = Math.round(height * 0.6);
    this.roadBottom = Math.round(height * 0.92);
    const roadHeight = this.roadBottom - this.roadTop;
    const roadCenterY = this.roadTop + roadHeight / 2;

    // --- World size ---
    const worldWidth = WORLD_CHARS_WIDE * charW;

    // --- Background ---
    this.cameras.main.setBackgroundColor(0x1a1a2e);
    if (this.textures.exists("day1-bg")) {
      const tex = this.textures.get("day1-bg").getSourceImage();
      const bgWidth = worldWidth + width;
      const bgTile = this.add.tileSprite(0, 0, bgWidth, height, "day1-bg");
      bgTile.setOrigin(0, 0);
      if (tex && tex.height) {
        const scale = height / tex.height;
        bgTile.setTileScale(scale, scale);
      }
      bgTile.setDepth(-10);
    }
    this._buildRoad(worldWidth, roadHeight, roadCenterY);

    // --- NPCs ---
    const npcCount = 22;
    const npcSpacing = worldWidth / (npcCount + 1);
    const npcPositions = [];
    for (let i = 0; i < npcCount; i++) {
      const laneOffset = (i % 4) * 0.2 + 0.15;
      npcPositions.push({
        x: npcSpacing * (i + 1),
        y: this.roadTop + roadHeight * laneOffset,
      });
    }

    const { group, npcs } = NPC.spawnGroup(this, npcPositions, this.s);
    this.npcGroup = group;
    this.npcList = npcs;
    this.npcList.forEach((npc, index) => {
      const textureKey = index % 2 === 0 ? "npc-yuval" : "npc-shiri";
      if (
        this.textures.exists(textureKey) &&
        typeof npc.setTexture === "function"
      ) {
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
      this,
    );

    // --- Camera ---
    this.cameras.main.setBounds(0, 0, worldWidth, height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0);

    // --- Particles ---
    this.explosionParticles = this.add.particles(0, 0, "particle", {
      speed: { min: 40 * this.s, max: 130 * this.s },
      scale: { start: 3, end: 0 },
      lifespan: 500,
      tint: [0xff0000, 0xff5500, 0xffaa00, 0xffffff],
      emitting: false,
    });
    this.explosionParticles.setDepth(2500);

    // --- Drone Spawning & Coordination (Controller/Model) ---
    this.droneManager = new DroneManager(this, this.player, {
      particles: this.explosionParticles,
      roadTop: this.roadTop,
      roadBottom: this.roadBottom,
      worldWidth: worldWidth,
      scale: this.s,
      maxDrones: 10,
    });

    // Listen to MVC controller notifications
    this.droneManager.on("drone-exploded", (count) => {
      this._updateDroneHUD(count);
      trackObstacleHit("drone", "kiryat_shmona", { drones_dodged: count });
    });

    this.droneManager.on("drone-dodged", () => {
      if (this.player) {
        addGlobalScore(this, 2, this.player.x, this.player.y);
      }
    });

    this.droneManager.on("player-hit", () => {
      if (this.isGameOver || this.isSceneOver) return;
      if (this.player && this.player.isInvulnerable) return;

      const remaining = LivesManager.deductLife();
      if (remaining > 0) {
        if (this.player) this.player.takeDamage();
      } else {
        this.triggerGameOver();
      }
    });

    this.droneManager.on("all-drones-dodged", () => {
      if (!this.isGameOver) {
        this.triggerSceneOver();
      }
    });

    // --- HUD ---
    this._createHUD();

    this.player.once("move-start", () => {
      trackFirstMove({ scene_id: "kiryat_shmona" });
      this.isGameOver = false;
      this.isSceneOver = false;
      this.droneManager.start();
    });

    // Show intro dialog, then enable player
    playDialogOnce("Day1Scene-intro", this, DAY_1_INTRO_DIALOG, () => {
      this.player.enable();
      MovementTutorial.showJoystickTutorial(this, this.player);
    });

    // Cleanup on shutdown
    this.events.once("shutdown", () => {
      if (this.droneManager) this.droneManager.destroy();
      if (typeof window.hideHUD === 'function') {
        window.hideHUD('html-stats-hud');
      }
    });
  }

  update(time, delta) {
    if (this.player) {
      this.player.update();
    }

    for (const npc of this.npcList) {
      npc.update(time, delta);
    }
  }

  // ---------------------------------------------------------------------------
  // Skyline
  // ---------------------------------------------------------------------------

  /** @private */
  _buildSkyline(worldWidth, groundY) {
    const bldKeys = ["bld_a", "bld_b", "bld_c", "bld_d", "bld_e"];
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
    const { height } = this.scale;

    // Asphalt road surface (depth 2)
    const roadGfx = this.add.graphics();
    roadGfx.fillStyle(0x2a2a35, 0.85);
    roadGfx.fillRect(0, this.roadTop, worldWidth, roadHeight);
    roadGfx.setDepth(2);

    // Upper curb line (depth 3)
    const upperCurb = this.add.graphics();
    upperCurb.fillStyle(0x777788, 1);
    upperCurb.fillRect(0, this.roadTop - 3 * s, worldWidth, 3 * s);
    upperCurb.setDepth(3);

    // Lower curb line (depth 3)
    const lowerCurb = this.add.graphics();
    lowerCurb.fillStyle(0x777788, 1);
    lowerCurb.fillRect(0, this.roadBottom - 2 * s, worldWidth, 2 * s);
    lowerCurb.setDepth(3);

    // Yellow center road line (depth 3)
    const dashW = 10 * s;
    const dashGap = 12 * s;
    const dashCount = Math.ceil(worldWidth / (dashW + dashGap));
    const lineGfx = this.add.graphics();
    lineGfx.fillStyle(0xeab308, 0.85);
    for (let i = 0; i < dashCount; i++) {
      lineGfx.fillRect(i * (dashW + dashGap), roadCenterY - 1.5 * s, dashW, 3 * s);
    }
    lineGfx.setDepth(3);

    // Bottom sidewalk platform (depth 3)
    const swGfx = this.add.graphics();
    swGfx.fillStyle(0x475569, 1);
    swGfx.fillRect(0, this.roadBottom, worldWidth, height - this.roadBottom);
    swGfx.lineStyle(2 * s, 0x334155, 1);
    swGfx.strokeRect(0, this.roadBottom, worldWidth, height - this.roadBottom);
    swGfx.setDepth(3);
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  /** @private */
  _createHUD() {
    LivesManager.showHUD();
    if (typeof window.showHUD === 'function') {
      window.showHUD('html-stats-hud', "רחפנים שחמקת מהם: 0/10");
    }
  }

  /** @private */
  _updateHUD(message) {
    // Instructions HUD is removed
  }

  _updateDroneHUD(count) {
    if (typeof window.updateHUDText === 'function') {
      window.updateHUDText('html-stats-hud', `רחפנים שחמקת מהם: ${count}/10`);
    }
  }

  // ---------------------------------------------------------------------------
  // Scene Game States (GameOver, SceneOver, Victory UI)
  // ---------------------------------------------------------------------------

  triggerGameOver() {
    if (this.isGameOver || this.isSceneOver) return;
    this.isGameOver = true;
    trackGameFailed({ scene_id: "kiryat_shmona" });
    this.sound.play("sfx-gameover", { volume: 0.6 });

    if (this.player) this.player.disable();
    if (this.droneManager) this.droneManager.stop();

    // Falling / grey out animation
    this.tweens.add({
      targets: this.player,
      angle: 90,
      tint: 0x333333,
      y: this.player.y + 5 * this.s,
      duration: 600,
      ease: "Bounce.easeOut",
    });

    showGameOverHelper(
      this,
      "נפסלת!",
      "רחפן פגע בך! עם רמת הניווט הזו, לא בטוח שתגיע לקלפי גם בעוד שלוש מערכות בחירות."
    );
  }

  _buildSupermarket(x) {
    const s = this.s;
    if (this.textures.exists('supermarket-outside')) {
      // Sidewalk ground baseline under supermarket
      const baseGfx = this.add.graphics();
      baseGfx.fillStyle(0x666666, 1);
      baseGfx.fillRect(x - 65 * s, this.roadTop - 2 * s, 130 * s, 10 * s);
      baseGfx.lineStyle(2 * s, 0x444444, 1);
      baseGfx.strokeRect(x - 65 * s, this.roadTop - 2 * s, 130 * s, 10 * s);
      baseGfx.setDepth(99);

      const img = this.add.image(x, this.roadTop + 8 * s, 'supermarket-outside');
      img.setOrigin(0.5, 1);
      const targetH = 90 * s;
      const tex = this.textures.get('supermarket-outside').getSourceImage();
      if (tex && tex.height) {
        const aspect = tex.width / tex.height;
        img.setDisplaySize(targetH * aspect, targetH);
      } else {
        img.setDisplaySize(90 * s, targetH);
      }
      img.setDepth(100);
      this.supermarket = img;
    } else {
      const w = 64 * s;
      const h = 80 * s;
      const doorW = 16 * s;
      const doorH = 28 * s;

      this.supermarket = this.add.graphics();
      this.supermarket.fillStyle(0xffffff, 1);
      this.supermarket.fillRect(x - w / 2, this.roadTop - h, w, h);
      this.supermarket.fillStyle(0x110e1a, 1);
      this.supermarket.fillRect(
        x - doorW / 2,
        this.roadTop - doorH,
        doorW,
        doorH,
      );

      this.supermarket.setDepth(2.5);
    }
  }

  triggerSceneOver() {
    if (this.isSceneOver || this.isGameOver) return;
    this.isSceneOver = true;
    this.sound.play("sfx-levelup", { volume: 0.6 });

    if (this.player) {
      this.player.disable();
      this.player.setFlipX(false); // Face right when walking to the store
      this.player.setCollideWorldBounds(false); // Remove world bounds restriction so player can enter door above roadTop
      if (this.player.body) {
        this.player.body.checkCollision.none = true;
      }
    }
    if (this.droneManager) this.droneManager.stop();

    const s = this.s;

    // 1. Spawn the supermarket outside of player view (right side)
    const worldWidth = WORLD_CHARS_WIDE * 12 * s; // WORLD_CHARS_WIDE * charW (12 * s)
    const cameraRightEdge = this.cameras.main.scrollX + this.cameras.main.width;
    // Spawn 80px (scaled) past the right edge of the screen, clamped to world bounds
    const superX = Math.min(cameraRightEdge + 80 * s, worldWidth - 50 * s);
    this._buildSupermarket(superX);

    // 2. Camera will follow player to the storefront
    this.cameras.main.startFollow(this.player, true, 0.05, 0);

    // 3. Player character will walk to the store's front
    const frontX = superX;
    const frontY = this.roadTop + 10 * s;

    this._updateHUD("הולכת לסופרמרקט...");

    const startScaleX = this.player.scaleX;
    const startScaleY = this.player.scaleY;

    this.tweens.add({
      targets: this.player,
      x: frontX,
      y: frontY,
      duration: 2000,
      ease: "Linear",
      onComplete: () => {
        // Stop following once player reaches the storefront
        this.cameras.main.stopFollow();

        // 4. Player character will enter the supermarket door, shrinking into perspective and fading out
        const doorY = this.roadTop - 16 * s;

        this.tweens.add({
          targets: this.player,
          y: doorY,
          scaleX: startScaleX * 0.6,
          scaleY: startScaleY * 0.6,
          alpha: 0,
          duration: 1000,
          ease: "Quad.easeIn",
          onComplete: () => {
            this.player.setVisible(false);
            this.player.setAlpha(1);

            // 5. Show victory screen with dialog
            this.showVictoryScreen();
          },
        });
      },
    });
  }

  showVictoryScreen() {
    playDialogOnce("Day1Scene-victory", this, DAY_1_VICTORY_DIALOG, () => {
      showVictoryHelper(
        this,
        "Day1Scene",
        "השלב הושלם!",
        "הצלחת לחמוק מרחפני האויב בקריית שמונה ולהגיע בשלום."
      );
    });
  }
}
