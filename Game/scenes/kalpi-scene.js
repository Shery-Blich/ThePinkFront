import Phaser from 'phaser';
import { Character } from '../entities/character.js';
import { Player } from '../entities/player.js';
import { startSceneMusic } from '../systems/bg-music.js';
import { showVictoryHelper, showGameOverHelper } from '../systems/level-ui-helper.js';
import { LivesManager } from '../systems/lives-manager.js';
import { addGlobalScore } from '../systems/score-manager.js';
import { playDialogOnce } from '../systems/dialog-system.js';
import { KALPI_INTRO_DIALOG, KALPI_VICTORY_DIALOG } from '../data/dialog-data.js';

// Level world length matching Supermarket scene (Day2Scene)
const WORLD_CHARS_WIDE = 120;

/**
 * KalpiScene — Voting booth stage in Jerusalem after catching the President.
 *
 * Features:
 * - Jerusalem Kotel background & Jerusalem stone plaza floor (copied from President scene)
 * - Crumbling floor effect: stepping on stone tiles or predicted straight-line path tiles
 *   starts a 2-second crumbling sequence (cracked texture, shake) until tiles break into pits.
 * - Predictive block destruction: every 2 seconds, crumbles tiles ~2 seconds ahead in player's path
 *   to encourage dynamic movement instead of straight-line running.
 * - Kalpi (ballot box) target at the far right. Reaching it completes the level with victory.
 */
export class KalpiScene extends Phaser.Scene {
  constructor() {
    super({ key: 'KalpiScene' });

    /** @type {Player} */
    this.player = null;

    /** @type {Phaser.Physics.Arcade.Sprite} */
    this.kalpi = null;

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
    /** @type {boolean} */
    this.gameplayStarted = false;

    /** @type {Array<Array<Object>>} 2D grid of stone road tiles */
    this.roadTiles = [];
    /** @type {Array<Object>} Active crumbling warning tiles */
    this.warningTiles = [];

    /** @type {number} Counter for pothole avoidance bonus points (max 5) */
    this.potholeAvoidancePointsAwarded = 0;

    /** @type {Array<Object>} Last 2 predictive tiles created (for efficient avoidance point checking) */
    this.lastPredictiveTiles = [];

    this.colsCount = 0;
    this.rowsCount = 0;
    this.tileW = 0;
    this.tileH = 0;

    /** @type {Phaser.Time.TimerEvent} */
    this.predictiveTimerEvent = null;

    /** @type {Phaser.GameObjects.Particles.ParticleEmitter} */
    this.explosionParticles = null;

  }

  /**
   * Defensive lazy-load for bg-end; KotelScene will normally have fetched
   * this already, so this is a no-op on repeat visits to the end-game sequence.
   */
  preload() {
    // ── Kalpi scene images ──
    const imgAssets = [
      ['kalpi',          'assets/Ellements/kalpi.webp'],
      ['day5-bg',        'assets/Ellements/kalpi.webp'],
      ['kalpi-bg',       'assets/backgrounds/KalpiSceneBackground.webp'],
      // Fallbacks used by kalpi-scene if kalpi-bg is missing
      ['kotel-panoramic-bg', 'assets/backgrounds/Kotel-panoramic.webp'],
      ['kotel-bg',           'assets/backgrounds/Kotel-panoramic.webp'],
    ];
    imgAssets.forEach(([key, path]) => {
      if (!this.textures.exists(key)) this.load.image(key, path);
    });
    // ── Audio ──
    if (!this.cache.audio.exists('bg-end')) {
      this.load.audio('bg-end', 'assets/sounds/gaming-for-end.mp3');
    }
  }

  create() {
    const { width, height } = this.scale;

    startSceneMusic(this, 'bg-end');

    // Reset states
    this.isGameOver = false;
    this.isSceneOver = false;
    this.gameplayStarted = false;
    this.roadTiles = [];
    this.warningTiles = [];
    this.potholeAvoidancePointsAwarded = 0;
    this.lastPredictiveTiles = [];

    this.s = Character.computeScale(height);

    const charW = 12 * this.s;
    const worldWidth = WORLD_CHARS_WIDE * charW;

    this.roadTop = Math.round(height * 0.60);
    this.roadBottom = Math.round(height * 0.92);
    const roadHeight = this.roadBottom - this.roadTop;
    const roadCenterY = this.roadTop + roadHeight / 2;

    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // 1. Kotel background
    this._buildBackground(worldWidth, this.roadTop);

    // 2. Jerusalem plaza road with crumbling stone tiles
    this._buildJerusalemPlaza(worldWidth, roadHeight);

    // 3. Particle emitter for crumbling stone dust
    this._createParticleEmitter();

    // 4. Player start
    const startX = 100 * this.s;
    const startY = roadCenterY;
    this.player = new Player(this, startX, startY, this.s);
    this.player.setWorldBounds(0, this.roadTop, worldWidth, roadHeight);
    this.player.disable();

    // 5. Kalpi (ballot box) at far right end
    const kalpiX = worldWidth - 70 * this.s;
    const kalpiY = roadCenterY;
    const kalpiTex = this.textures.exists('kalpi') ? 'kalpi' : 'day5-bg';

    this.kalpi = this.physics.add.sprite(kalpiX, kalpiY, kalpiTex);
    this.kalpi.setOrigin(0.5, 1);
    
    const kHeight = 36 * this.s;
    const kAspect = (this.kalpi.width || 32) / (this.kalpi.height || 32);
    this.kalpi.setDisplaySize(kAspect * kHeight, kHeight);
    this.kalpi.setDepth(this.kalpi.y);
    this.kalpi.body.setImmovable(true);

    // Overlap handler to trigger victory
    this.physics.add.overlap(this.player, this.kalpi, this.reachKalpi, null, this);

    // 6. Camera setup
    this.cameras.main.setBounds(0, 0, worldWidth, height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0);

    // 7. HUD setup
    this._createHUD();

    // 8. Opening dialogue popup before gameplay starts
    this.gameplayStarted = false;

    playDialogOnce("KalpiScene-intro", this, KALPI_INTRO_DIALOG, () => {
      this.gameplayStarted = true;
      if (this.player) {
        this.player.enable();
      }

      // Start 2-second predictive block destruction timer
      this.predictiveTimerEvent = this.time.addEvent({
        delay: 2000,
        callback: this._destroyPredictedBlocks,
        callbackScope: this,
        loop: true,
      });
    });

    this.events.once('shutdown', () => {
      if (this.predictiveTimerEvent) {
        this.predictiveTimerEvent.remove(false);
        this.predictiveTimerEvent = null;
      }
      this.warningTiles.forEach((tile) => {
        if (tile.shakeTween) tile.shakeTween.stop();
      });
    });
  }

  update(time, delta) {
    if (this.player) {
      this.player.update();
    }

    if (this.kalpi && this.kalpi.active) {
      this.kalpi.setDepth(this.kalpi.y);
    }

    if (this.player && this.player.visible && this.gameplayStarted && !this.isGameOver && !this.isSceneOver) {
      this._updateCrumblingRoad(delta);

      // Check if player has passed predictive potholes to award avoidance points
      for (let i = 0; i < this.lastPredictiveTiles.length; i++) {
        const tile = this.lastPredictiveTiles[i];
        if (tile.state === 'CRUMBLED' && !tile.avoidancePointsAwarded && this.player.x > tile.tx + this.tileW && this.potholeAvoidancePointsAwarded < 5) {
          tile.avoidancePointsAwarded = true;
          this.potholeAvoidancePointsAwarded++;
          addGlobalScore(this, 1, tile.tx, tile.ty);
        }
      }
    }
  }

  /** @private */
  _buildBackground(worldWidth, groundY) {
    const bgKey = this.textures.exists('kalpi-bg')
      ? 'kalpi-bg'
      : (this.textures.exists('kotel-panoramic-bg') ? 'kotel-panoramic-bg' : 'kotel-bg');
    if (!this.textures.exists(bgKey)) return;

    const bgTile = this.add.tileSprite(0, 0, worldWidth, groundY, bgKey);
    bgTile.setOrigin(0, 0);
    const texture = this.textures.get(bgKey).getSourceImage();
    if (texture && texture.height) {
      const scale = groundY / texture.height;
      bgTile.setTileScale(scale, scale);
    }
    bgTile.setDepth(1);
  }

  /** @private */
  _buildJerusalemPlaza(worldWidth, roadHeight) {
    const s = this.s;
    this.tileW = 32 * s;
    this.tileH = 16 * s;
    this.colsCount = Math.ceil(worldWidth / this.tileW) + 1;
    this.rowsCount = Math.ceil(roadHeight / this.tileH);

    // Dark pit backing graphic under road
    const pitBacking = this.add.graphics();
    pitBacking.fillStyle(0x110e1a, 1);
    pitBacking.fillRect(0, this.roadTop, worldWidth, roadHeight);
    pitBacking.setDepth(2);

    for (let col = 0; col < this.colsCount; col++) {
      this.roadTiles[col] = [];
      for (let row = 0; row < this.rowsCount; row++) {
        const tx = col * this.tileW;
        const ty = this.roadTop + row * this.tileH;

        const tileSprite = this.add.sprite(tx, ty, 'stone_intact');
        tileSprite.setOrigin(0, 0);
        tileSprite.setDisplaySize(this.tileW, this.tileH);
        tileSprite.setDepth(3);

        this.roadTiles[col][row] = {
          sprite: tileSprite,
          state: 'NORMAL',
          timeOnTile: 0,
          col,
          row,
          tx,
          ty,
          shakeTween: null,
          avoidancePointsAwarded: false,
          isPredictive: false,
        };
      }
    }

    // Sidewalk below road
    const swTileW = 16 * s;
    const swNeeded = Math.ceil(worldWidth / swTileW) + 1;
    for (let i = 0; i < swNeeded; i++) {
      const sw = this.add.image(i * swTileW, this.roadBottom, 'sidewalk');
      sw.setOrigin(0, 0);
      sw.setDisplaySize(swTileW, this.scale.height - this.roadBottom);
      sw.setDepth(3);
    }
  }

  /** @private */
  _createParticleEmitter() {
    if (this.textures.exists('particle')) {
      this.explosionParticles = this.add.particles(0, 0, 'particle', {
        speed: { min: 30, max: 80 },
        scale: { start: this.s * 0.6, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 400,
        blendMode: 'NORMAL',
        tint: 0xd4b88a,
        emitting: false,
      });
      this.explosionParticles.setDepth(10);
    }
  }

  /**
   * Destroys predicted blocks ahead of the player every 2 seconds.
   * Calculates estimated player trajectory 3 seconds ahead and triggers warning cracks.
   * @private
   */
  _destroyPredictedBlocks() {
    if (!this.gameplayStarted || this.isSceneOver || this.isGameOver || !this.player) return;

    const s = this.s;
    const pVx = (this.player.body && Math.abs(this.player.body.velocity.x) > 20)
      ? this.player.body.velocity.x
      : (120 * s);
    const pVy = this.player.body ? this.player.body.velocity.y : 0;

    const predX = this.player.x + pVx * 3.0;
    const predY = Phaser.Math.Clamp(
      this.player.y + pVy * 3.0,
      this.roadTop + 4 * s,
      this.roadBottom - 4 * s
    );

    const predCol = Math.floor(predX / this.tileW);
    const predRow = Math.floor((predY - this.roadTop) / this.tileH);

    // Target a small predictive cluster ahead: length max 1 column wide, height 1 or 2 rows (1x1 or 1x2 cluster)
    const blockLength = 1; // 1 column wide
    const blockHeight = Phaser.Math.Between(1, 2); // 1 or 2 rows high (1x1 or 1x2 cluster)

    const startRow = Phaser.Math.Clamp(predRow, 0, Math.max(0, this.rowsCount - blockHeight));

    for (let dc = 0; dc < blockLength; dc++) {
      for (let dr = 0; dr < blockHeight; dr++) {
        const col = predCol + dc;
        const row = startRow + dr;

        if (col >= 0 && col < this.colsCount && row >= 0 && row < this.rowsCount) {
          const tile = this.roadTiles[col][row];
          if (tile.state === 'NORMAL') {
            this._startTileWarning(tile);
            tile.isPredictive = true;
            // Track last 2 predictive tiles for efficient avoidance checking
            this.lastPredictiveTiles.push(tile);
            if (this.lastPredictiveTiles.length > 2) {
              this.lastPredictiveTiles.shift();
            }
          }
        }
      }
    }
  }

  /** @private */
  _startTileWarning(tile) {
    if (tile.state !== 'NORMAL') return;
    tile.state = 'WARNING';
    tile.sprite.setTexture('stone_cracked');
    tile.timeOnTile = 0;

    tile.shakeTween = this.tweens.add({
      targets: tile.sprite,
      x: { from: tile.tx - 2 * this.s, to: tile.tx + 2 * this.s },
      y: { from: tile.ty - 1 * this.s, to: tile.ty + 1 * this.s },
      duration: 50,
      yoyo: true,
      repeat: -1,
    });

    this.warningTiles.push(tile);
  }

  /** @private */
  _updateCrumblingRoad(delta) {
    const px = this.player.x;
    const py = this.player.y;

    const col = Math.floor(px / this.tileW);
    const row = Math.floor((py - this.roadTop) / this.tileH);

    // 1. Check tile currently under player
    if (col >= 0 && col < this.colsCount && row >= 0 && row < this.rowsCount) {
      const tile = this.roadTiles[col][row];

      if (tile.state === 'CRUMBLED') {
        if (!this.player.isInvulnerable) {
          const remaining = LivesManager.deductLife();
          if (remaining > 0) {
            this.player.knockback();
          } else {
            this.triggerGameOver('FELL_THROUGH');
            return;
          }
        }
      }

      if (tile.state === 'NORMAL') {
        this._startTileWarning(tile);
      }
    }

    // 2. Update warning timers for active crumbling tiles
    for (let i = this.warningTiles.length - 1; i >= 0; i--) {
      const tile = this.warningTiles[i];
      tile.timeOnTile += delta;

      if (tile.timeOnTile >= 2000) {
        tile.state = 'CRUMBLED';
        tile.sprite.setTexture('stone_broken');

        if (tile.shakeTween) {
          tile.shakeTween.stop();
          tile.shakeTween = null;
        }
        tile.sprite.setPosition(tile.tx, tile.ty);

        if (this.explosionParticles) {
          this.explosionParticles.explode(8, tile.tx + this.tileW / 2, tile.ty + this.tileH / 2);
        }
        this.cameras.main.shake(100, 0.003);

        this.warningTiles.splice(i, 1);

        // Damage check if player stands on tile when it crumbles
        const pCol = Math.floor(this.player.x / this.tileW);
        const pRow = Math.floor((this.player.y - this.roadTop) / this.tileH);
        if (pCol === tile.col && pRow === tile.row) {
          if (!this.player.isInvulnerable) {
            const remaining = LivesManager.deductLife();
            if (remaining > 0) {
              this.player.knockback();
            } else {
              this.triggerGameOver('FELL_THROUGH');
              return;
            }
          }
        }
      }
    }
  }

  /**
   * Triggers victory when player touches Kalpi.
   */
  reachKalpi() {
    if (!this.gameplayStarted || this.isSceneOver) return;
    this.isSceneOver = true;
    this.gameplayStarted = false;

    if (this.predictiveTimerEvent) {
      this.predictiveTimerEvent.remove(false);
      this.predictiveTimerEvent = null;
    }

    this.player.disable();
    this.player.body.setVelocity(0, 0);

    this.cameras.main.shake(150, 0.005);
    this.cameras.main.flash(300, 255, 255, 255);

    addGlobalScore(this, 5, this.kalpi.x, this.kalpi.y);

    playDialogOnce("KalpiScene-victory", this, KALPI_VICTORY_DIALOG, () => {
      this.showVictoryScreen();
    });
  }

  /**
   * Game Over handler.
   */
  triggerGameOver(reason) {
    if (this.isGameOver || this.isSceneOver) return;
    this.isGameOver = true;
    this.gameplayStarted = false;

    if (this.predictiveTimerEvent) {
      this.predictiveTimerEvent.remove(false);
      this.predictiveTimerEvent = null;
    }

    this.player.disable();

    showGameOverHelper(
      this,
      "נפלת לתהום!",
      "אבני ירושלים התפוררו תחת רגליך. נסה שוב!"
    );
  }

  /** @private */
  _createHUD() {
    LivesManager.showHUD();
  }

  showVictoryScreen() {
    showVictoryHelper(
      this,
      'KalpiScene',
      "הגעת לקלפי!",
      "ממשת את זכות הבחירה שלך בסיומו של המסע הנהדר!"
    );
  }
}
