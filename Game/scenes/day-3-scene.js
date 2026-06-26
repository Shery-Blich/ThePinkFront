import Phaser from 'phaser';
import { Character } from '../entities/character.js';
import { Player } from '../entities/player.js';
import { NPC } from '../entities/npc.js';
import { DialogSystem } from '../systems/dialog-system.js';
import { DroneManager } from '../systems/drone-manager.js';
import { DAY_3_INTRO_DIALOG, DAY_3_VICTORY_DIALOG } from '../data/dialog-data.js';
import { startSceneMusic } from '../systems/bg-music.js';
import { runLevelTrivia } from '../systems/level-trivia.js';

// How many character-widths wide the world is
const WORLD_CHARS_WIDE = 120;

export class Day3Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Day3Scene' });

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

    /** @type {boolean} Has gameplay active starting phase completed */
    this.gameplayStarted = false;

    /** @type {DroneManager} */
    this.droneManager = null;

    /** @type {Phaser.GameObjects.Particles.ParticleEmitter} */
    this.explosionParticles = null;

    // --- Road Grid details ---
    /** @type {Array<Array<Object>>} 2D array of tiles */
    this.roadTiles = [];
    this.tileW = 0;
    this.tileH = 0;
    this.colsCount = 0;
    this.rowsCount = 0;
    
    // Track active crumbling tiles
    this.warningTiles = [];

    // Bus references
    this.bus = null;

    // Supermarket graphics placeholder
    this.supermarket = null;

  }

  create() {
    const { width, height } = this.scale;

    startSceneMusic(this, 'bg-sessions');

    // --- Reset states for scene restart ---
    this.warningTiles = [];
    this.roadTiles = [];
    this.isGameOver = false;
    this.isSceneOver = false;
    this.gameplayStarted = false;

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
    // Reuse original skyline style (modern skyscraper graphics)
    this._buildSkyline(worldWidth, this.roadTop);
    
    // Draw crumbling asphalt road (uses asphalt_intact/asphalt_cracked)
    this._buildCrumblingRoad(worldWidth, roadHeight);

    // --- Supermarket building placeholder ---
    this._buildSupermarket();

    // --- NPCs (None spawned for this scene) ---
    this.npcGroup = this.physics.add.staticGroup();
    this.npcList = [];

    // --- Player ---
    // Player starts invisible and disabled inside the supermarket door
    const startX = this.scale.width / 2;
    const startY = roadCenterY + charH * 0.3;
    this.player = new Player(this, startX, startY, this.s);
    this.player.setWorldBounds(0, this.roadTop, worldWidth, roadHeight);
    this.player.setVisible(false);
    this.player.disable();

    // --- Camera ---
    this.cameras.main.setBounds(0, 0, worldWidth, height);
    this.cameras.main.scrollX = 0;

    // --- HUD ---
    this._createHUD();
    this._updateHUD('שידור נכנס');

    // --- Particles ---
    this.explosionParticles = this.add.particles(0, 0, 'particle', {
      speed: { min: 40 * this.s, max: 130 * this.s },
      scale: { start: 3, end: 0 },
      lifespan: 500,
      tint: [0xff0000, 0xff5500, 0xffaa00, 0xffffff],
      emitting: false
    });
    this.explosionParticles.setDepth(2500);

    // --- Drone Spawning & Coordination ---
    this.droneManager = new DroneManager(this, this.player, {
      particles: this.explosionParticles,
      roadTop: this.roadTop,
      roadBottom: this.roadBottom,
      worldWidth: worldWidth,
      scale: this.s
    });

    this.droneManager.on('drone-exploded', (count) => {
      this._updateDroneHUD(count);
    });

    this.droneManager.on('player-hit', () => {
      this.triggerGameOver('DRONE_HIT');
    });

    this.droneManager.on('all-drones-dodged', () => {
      this.time.delayedCall(1000, () => {
        if (!this.isGameOver) {
          this.triggerSceneOver(roadCenterY, worldWidth);
        }
      });
    });

    // Cleanup on shutdown
    this.events.once('shutdown', () => {
      if (this.droneManager) this.droneManager.destroy();
    });

    // Start Phase 1: Intro Dialogue Immediately
    this._startIntroDialogue(roadCenterY, worldWidth, charH);
  }

  _buildSupermarket() {
    const s = this.s;
    const x = this.scale.width / 2;
    const w = 64 * s;
    const h = 80 * s;
    const doorW = 16 * s;
    const doorH = 28 * s;

    this.supermarket = this.add.graphics();
    // White block placeholder
    this.supermarket.fillStyle(0xffffff, 1);
    this.supermarket.fillRect(x - w / 2, this.roadTop - h, w, h);
    // Dark rectangle hole door
    this.supermarket.fillStyle(0x110e1a, 1);
    this.supermarket.fillRect(x - doorW / 2, this.roadTop - doorH, doorW, doorH);
    
    // Add text label "SUPER"
    this.superLabel = this.add.text(x, this.roadTop - h + 15 * s, 'סופר', {
      fontFamily: 'Impact, sans-serif',
      fontSize: `${12 * s}px`,
      color: '#ff2a5f',
      align: 'center'
    }).setOrigin(0.5);

    this.supermarket.setDepth(2.5);
    this.superLabel.setDepth(2.6);
  }

  _startIntroDialogue(roadCenterY, worldWidth, charH) {
    const introDialog = new DialogSystem(this, DAY_3_INTRO_DIALOG, () => {
      // Dialogue ends -> Player character leaves the supermarket door
      this._updateHUD('יוצאת מהסופרמרקט...');
      const s = this.s;

      // Spawn player at the supermarket door
      const doorX = this.scale.width / 2;
      const doorY = this.roadTop - 6 * s; // Inside door frame height

      this.player.setPosition(doorX, doorY);
      this.player.setVisible(true);
      this.player.setDepth(this.player.y);

      // Player walks down onto the road
      const targetPlayerY = roadCenterY + charH * 0.3;

      this.tweens.add({
        targets: this.player,
        y: targetPlayerY,
        duration: 1000,
        onComplete: () => {
          // Camera starts tracking player
          this.cameras.main.startFollow(this.player, true, 0.1, 0);

          // Wait exactly 1 second before starting game (drones & crumbling)
          this._updateHUD('תתכונני...');
          this.time.delayedCall(1000, () => {
            this.player.enable();
            this.isGameOver = false;
            this.isSceneOver = false;
            this.gameplayStarted = true;
            this.droneManager.start();
            this._updateHUD('גררי את הג׳ויסטיק כדי לזוז ←');
          });
        }
      });
    });
    introDialog.start();
  }

  update(time, delta) {
    if (this.player) {
      this.player.update();
    }



    // Process crumbling stones road update only after the game starts
    if (this.player && this.player.visible && this.gameplayStarted && !this.isGameOver && !this.isSceneOver) {
      this._updateCrumblingRoad(delta);
    }
  }

  // ---------------------------------------------------------------------------
  // Kiryat Shmona style Skyline (reused from Day 1)
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
  // Crumbling Asphalt Road
  // ---------------------------------------------------------------------------

  /** @private */
  _buildCrumblingRoad(worldWidth, roadHeight) {
    const s = this.s;
    this.tileW = 32 * s;
    this.tileH = 16 * s;
    this.colsCount = Math.ceil(worldWidth / this.tileW) + 1;
    this.rowsCount = Math.ceil(roadHeight / this.tileH);
    const { height } = this.scale;

    // Draw dark pit backing under the road so holes look dark/empty
    const pitBacking = this.add.graphics();
    pitBacking.fillStyle(0x110e1a, 1);
    pitBacking.fillRect(0, this.roadTop, worldWidth, roadHeight);
    pitBacking.setDepth(2);

    // Build the grid of asphalt tiles
    for (let col = 0; col < this.colsCount; col++) {
      this.roadTiles[col] = [];
      for (let row = 0; row < this.rowsCount; row++) {
        const tx = col * this.tileW;
        const ty = this.roadTop + row * this.tileH;

        const tileSprite = this.add.sprite(tx, ty, 'asphalt_intact');
        tileSprite.setOrigin(0, 0);
        tileSprite.setDisplaySize(this.tileW, this.tileH);
        tileSprite.setDepth(3);

        this.roadTiles[col][row] = {
          sprite: tileSprite,
          state: 'NORMAL', // 'NORMAL', 'WARNING', 'CRUMBLED'
          timeOnTile: 0,
          col,
          row,
          tx,
          ty,
          shakeTween: null
        };
      }
    }

    // Sidewalk below road (similar to Day 1)
    const swTileW = 16 * s;
    const swTilesNeeded = Math.ceil(worldWidth / swTileW) + 1;
    for (let i = 0; i < swTilesNeeded; i++) {
      const sw = this.add.image(i * swTileW, this.roadBottom, 'sidewalk');
      sw.setOrigin(0, 0);
      sw.setDisplaySize(swTileW, height - this.roadBottom);
      sw.setDepth(3);
    }
  }

  /**
   * Crumbling logic checked every update frame.
   * @private
   */
  _updateCrumblingRoad(delta) {
    const px = this.player.x;
    const py = this.player.y;

    const col = Math.floor(px / this.tileW);
    const row = Math.floor((py - this.roadTop) / this.tileH);

    // 1. Check if the player is currently standing on a tile within valid bounds
    if (col >= 0 && col < this.colsCount && row >= 0 && row < this.rowsCount) {
      const tile = this.roadTiles[col][row];

      // If the player walks onto an already crumbled tile -> fall and die!
      if (tile.state === 'CRUMBLED') {
        this.triggerGameOver('FELL_THROUGH');
        return;
      }

      // If player touches a normal tile -> trigger the warning self-destruct sequence instantly
      if (tile.state === 'NORMAL') {
        tile.state = 'WARNING';
        tile.sprite.setTexture('asphalt_cracked');
        tile.timeOnTile = 0;

        // Shaking animation starts immediately
        tile.shakeTween = this.tweens.add({
          targets: tile.sprite,
          x: { from: tile.tx - 2 * this.s, to: tile.tx + 2 * this.s },
          y: { from: tile.ty - 1 * this.s, to: tile.ty + 1 * this.s },
          duration: 50,
          yoyo: true,
          repeat: -1
        });

        // Add to warning tiles list so it continues to crumble even if the player leaves
        this.warningTiles.push(tile);
      }
    }

    // 2. Update warning timers for all active crumbling tiles (regardless of player presence)
    for (let i = this.warningTiles.length - 1; i >= 0; i--) {
      const tile = this.warningTiles[i];
      tile.timeOnTile += delta;

      // Once 2 seconds have passed since the player touched the asphalt tile
      if (tile.timeOnTile >= 2000) {
        tile.state = 'CRUMBLED';
        tile.sprite.setTexture('stone_broken'); // Reuse the dark hole texture from BootScene

        // Stop the rumbling/shaking tween
        if (tile.shakeTween) {
          tile.shakeTween.remove();
          tile.shakeTween = null;
        }
        tile.sprite.setPosition(tile.tx, tile.ty);

        // Dust/particle explosion at the center of the tile
        if (this.explosionParticles) {
          this.explosionParticles.explode(8, tile.tx + this.tileW / 2, tile.ty + this.tileH / 2);
        }
        this.cameras.main.shake(100, 0.003);

        // Remove from active warning list
        this.warningTiles.splice(i, 1);

        // If the player is still standing on this tile when it crumbles -> fall and die!
        const pCol = Math.floor(this.player.x / this.tileW);
        const pRow = Math.floor((this.player.y - this.roadTop) / this.tileH);
        if (pCol === tile.col && pRow === tile.row) {
          this.triggerGameOver('FELL_THROUGH');
          return;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  /** @private */
  _createHUD() {
    const fontSize = Math.max(12, Math.round(this.scale.height * 0.025));
    this._hudText = this.add.text(10, 10, 'שידור נכנס', {
      fontFamily: 'monospace',
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 4 },
    });
    this._hudText.setScrollFactor(0);
    this._hudText.setDepth(1000);

    this._droneHudText = this.add.text(10, 15 + fontSize * 1.5, 'רחפנים שחמקת מהם: 0/10', {
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
      this._droneHudText.setText(`רחפנים שחמקת מהם: ${count}/10`);
    }
  }

  // ---------------------------------------------------------------------------
  // Scene Game States
  // ---------------------------------------------------------------------------

  triggerGameOver(reason = 'DRONE_HIT') {
    if (this.isGameOver || this.isSceneOver) return;
    this.isGameOver = true;
    this.sound.play('sfx-gameover', { volume: 0.6 });

    if (this.player) this.player.disable();
    if (this.droneManager) this.droneManager.stop();

    // Clean up any remaining shake tweens
    for (let col = 0; col < this.colsCount; col++) {
      if (this.roadTiles[col]) {
        for (let row = 0; row < this.rowsCount; row++) {
          const tile = this.roadTiles[col][row];
          if (tile && tile.shakeTween) {
            tile.shakeTween.remove();
            tile.shakeTween = null;
          }
        }
      }
    }

    let gameOverMsg = 'GAME OVER';
    let deathTweenOptions = {
      targets: this.player,
      angle: 90,
      tint: 0x333333,
      y: this.player.y + 5 * this.s,
      duration: 600,
      ease: 'Bounce.easeOut'
    };

    if (reason === 'FELL_THROUGH') {
      gameOverMsg = 'נפלת לבור';
      deathTweenOptions = {
        targets: this.player,
        scale: 0.1,
        y: this.player.y + 20 * this.s,
        alpha: 0,
        angle: 180,
        duration: 800,
        ease: 'Cubic.easeIn'
      };
    }

    // Falling / grey out animation
    this.tweens.add(deathTweenOptions);

    // Screen darken overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, this.scale.width, this.scale.height);
    overlay.setScrollFactor(0);
    overlay.setDepth(10000);
    overlay.setAlpha(0);

    const title = this.add.text(this.scale.width / 2, this.scale.height / 2 - 40, gameOverMsg, {
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

    const subtitle = this.add.text(this.scale.width / 2, this.scale.height / 2 + 20, 'הקישו בכל מקום כדי לנסות שוב', {
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

  triggerSceneOver(roadCenterY, worldWidth) {
    if (this.isSceneOver || this.isGameOver) return;
    this.isSceneOver = true;
    this.sound.play('sfx-levelup', { volume: 0.6 });

    // 1. Player loses controls
    if (this.player) this.player.disable();
    if (this.droneManager) this.droneManager.stop();
    this.gameplayStarted = false; // Halt crumbling update checks

    this._updateHUD('אוטובוס החילוץ מגיע...');

    // 2. Spawn the Egged Bus offscreen and drive it to stop in front of the player
    const s = this.s;
    this.bus = this.add.image(-150 * s, roadCenterY, 'egged_bus'); // Starts closed
    this.bus.setScale(s);
    this.bus.setDepth(roadCenterY);

    // Stop camera tracking the player and track the arriving bus instead
    this.cameras.main.startFollow(this.bus, true, 0.1, 0);

    // We position the bus so its passenger door (x + 24 * s) aligns directly with the player's X coordinate
    const targetBusX = this.player.x - 24 * s;

    this.tweens.add({
      targets: this.bus,
      x: targetBusX,
      duration: 3000,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.cameras.main.stopFollow();

        // Open the bus doors!
        this.bus.setTexture('egged_bus_open');

        // Wait a short delay for doors to fully open, then walk the player in
        this.time.delayedCall(300, () => {
          this.player.setDepth(this.bus.depth + 10); // Render in front of bus door

          const doorX = this.bus.x + 24 * s;
          const doorY = this.bus.y + 6 * s; // Door floor level height

          // 3. Player walks up into the bus door (reverse of the exit animation)
          this.tweens.add({
            targets: this.player,
            x: doorX,
            y: doorY,
            duration: 1200,
            onComplete: () => {
              // Player entered the bus! Make invisible
              this.player.setVisible(false);

              // Wait 300ms, then close the doors
              this.time.delayedCall(300, () => {
                // Close the doors!
                this.bus.setTexture('egged_bus');

                // Wait 600ms (doors fully closed), then the bus departs
                this.time.delayedCall(600, () => {
                  // Camera tracks the departing bus
                  this.cameras.main.startFollow(this.bus, true, 0.1, 0);

                  this.tweens.add({
                    targets: this.bus,
                    x: worldWidth + 200 * s,
                    duration: 4000,
                    ease: 'Quad.easeIn',
                    onComplete: () => {
                      this.cameras.main.stopFollow();
                      if (this.bus) this.bus.destroy();

                      // 4. Run the victory dialogue
                      this.runVictoryDialogue();
                    }
                  });
                });
              });
            }
          });
        });
      }
    });
  }

  runVictoryDialogue() {
    this._updateHUD('המשימה הצליחה!');
    const dialog = new DialogSystem(this, DAY_3_VICTORY_DIALOG, () => {
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

    const title = this.add.text(this.scale.width / 2, this.scale.height / 2 - 30, 'צלחת את קריית שמונה - עכשיו לירושלים!', {
      fontFamily: 'Impact, sans-serif',
      fontSize: `${Math.round(this.scale.height * 0.06)}px`, // Scaled down to prevent clipping/wrapping
      color: '#00ffcc',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center'
    });
    title.setOrigin(0.5);
    title.setScrollFactor(0);
    title.setDepth(10001);
    title.setAlpha(0);

    const subtitle = this.add.text(this.scale.width / 2, this.scale.height / 2 + 25, 'הקישו בכל מקום כדי להמשיך', {
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
        this.input.once('pointerdown', async () => {
          await runLevelTrivia(this, 'Day3Scene');
          this.events.emit('complete');
        });
      }
    });
  }
}
