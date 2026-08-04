import Phaser from 'phaser';
import { Character } from '../entities/character.js';
import { Player } from '../entities/player.js';
import { startSceneMusic } from '../systems/bg-music.js';
import { showVictoryHelper, showGameOverHelper } from '../systems/level-ui-helper.js';
import { LivesManager } from '../systems/lives-manager.js';
import { addGlobalScore } from '../systems/score-manager.js';

/**
 * FinalScene — Jerusalem Floor Crumbling Stage
 *
 * Features:
 * - Player stands on a grid of floor tiles in Jerusalem
 * - Floor tiles crumble and fall away every 2 seconds
 * - Player must reach the school (goal) within 20 seconds
 * - Neon pixel-style retro visual design
 * - Physics-based movement and falling
 */
export class FinalScene extends Phaser.Scene {
  constructor() {
    super({ key: 'FinalScene' });

    /** @type {Player} */
    this.player = null;

    /** @type {number} sprite scale factor */
    this.s = 1;

    /** @type {number} Countdown timer in seconds */
    this.timeRemaining = 20;

    /** @type {Phaser.GameObjects.Text} */
    this.timerText = null;

    /** @type {Phaser.Physics.Arcade.Group} */
    this.floorTiles = null;

    /** @type {boolean} */
    this.isSceneOver = false;

    /** @type {number} Accumulator for timer updates (milliseconds) */
    this.timerAccumulator = 0;

    /** @type {number} Accumulator for crumble timer (milliseconds) */
    this.crumbleAccumulator = 0;

    /** @type {Phaser.GameObjects.Container} */
    this.schoolGoal = null;

    /** @type {number} Position of school goal on X axis */
    this.schoolX = 0;

    /** @type {number} Road/floor Y position */
    this.roadY = 0;

    /** @type {number} Floor tile size */
    this.tileSize = 0;

    /** @type {Array} Grid information for tracking which tiles exist */
    this.floorGrid = [];
  }

  create() {
    const { width, height } = this.scale;
    this.s = Character.computeScale(height);

    startSceneMusic(this, 'bg-end');

    // --- Reset states ---
    this.isSceneOver = false;
    this.timeRemaining = 20;
    this.timerAccumulator = 0;
    this.crumbleAccumulator = 0;

    // --- Background Styling ---
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Draw stylized retro gridlines in background
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x221a3a, 0.4);
    const gridSize = 24 * this.s;
    for (let lx = 0; lx < width; lx += gridSize) {
      grid.lineBetween(lx, 0, lx, height);
    }
    for (let ly = 0; ly < height; ly += gridSize) {
      grid.lineBetween(0, ly, width, ly);
    }

    // --- Jerusalem background ---
    this._buildJerusalemBackground(width, height);

    // --- Floor setup ---
    this.tileSize = 32 * this.s;
    this.roadY = Math.round(height * 0.70);
    const worldWidth = width * 2.5; // Extended world for camera follow

    this._buildFloor(worldWidth);

    // --- Player setup ---
    const startX = width * 0.1;
    const startY = this.roadY - 5 * this.s; // Standing on the floor
    this.player = new Player(this, startX, startY, this.s);

    // Set up physics for gravity (player falls when floor is gone)
    this.physics.world.gravity.y = 600 * this.s;

    // Collision between player and floor tiles
    this.physics.add.collider(
      this.player,
      this.floorTiles,
      () => {
        if (this.player) this.player.onCollision();
      },
      null,
      this
    );

    // --- School goal setup ---
    this.schoolX = width * 0.85;
    this._createSchoolGoal(this.schoolX, this.roadY);

    // --- HUD ---
    this._createHUD(width, height);

    // --- Camera ---
    this.cameras.main.setBounds(0, 0, worldWidth, height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0);

    // Start gameplay
    this.player.enable();

    this.events.once('shutdown', () => {
      if (this.floorTiles) {
        this.floorTiles.clear(true, true);
      }
    });
  }

  /**
   * Builds the Jerusalem background visual.
   * @private
   */
  _buildJerusalemBackground(width, height) {
    // Use a simple color gradient or placeholder image
    if (this.textures.exists('day4-bg')) {
      const bgImage = this.add.image(width / 2, height * 0.35, 'day4-bg');
      bgImage.setOrigin(0.5, 0.5);
      bgImage.setDisplaySize(width * 1.2, height * 0.5);
      bgImage.setDepth(1);
      bgImage.setAlpha(0.6);
    } else {
      // Fallback: draw a simple Jerusalem-themed background
      const sky = this.add.graphics();
      sky.fillStyle(0x2a2a3e, 1);
      sky.fillRect(0, 0, width, height * 0.35);
      sky.setDepth(0);

      // Draw distant Jerusalem buildings silhouette effect
      const silhouette = this.add.graphics();
      silhouette.fillStyle(0x1a1a2e, 0.8);
      const buildingHeight = height * 0.2;
      const buildingWidth = 80 * this.s;
      for (let i = 0; i < 8; i++) {
        silhouette.fillRect(
          i * buildingWidth,
          height * 0.35 - buildingHeight,
          buildingWidth,
          buildingHeight
        );
      }
      silhouette.setDepth(1);
    }
  }

  /**
   * Builds the crumbling floor grid.
   * @private
   */
  _buildFloor(worldWidth) {
    this.floorTiles = this.physics.add.staticGroup();
    this.floorGrid = [];

    // Create a simple texture for floor tiles if it doesn't exist
    if (!this.textures.exists('floorTile')) {
      const graphics = this.make.graphics({ x: 0, y: 0, add: false });
      graphics.fillStyle(0x8b7355, 1);
      graphics.fillRect(0, 0, 32, 32);
      graphics.lineStyle(2, 0x6b5745, 1);
      graphics.strokeRect(0, 0, 32, 32);
      graphics.generateTexture('floorTile', 32, 32);
      graphics.destroy();
    }

    // Calculate grid dimensions
    const tilesWide = Math.ceil(worldWidth / this.tileSize) + 2;
    const tilesHigh = 3; // Three rows of floor for visual depth

    // Create initial floor grid
    for (let row = 0; row < tilesHigh; row++) {
      this.floorGrid[row] = [];
      for (let col = 0; col < tilesWide; col++) {
        const tx = col * this.tileSize;
        const ty = this.roadY + (row * this.tileSize);

        // Create floor tile sprite using the generated texture
        const tile = this.floorTiles.create(tx, ty, 'floorTile');
        tile.setOrigin(0, 0);
        tile.setDisplaySize(this.tileSize, this.tileSize);
        tile.body.setSize(this.tileSize, this.tileSize);
        tile.body.setOffset(0, 0);

        // Store metadata
        tile.gridRow = row;
        tile.gridCol = col;
        tile.isActive = true;
        this.floorGrid[row][col] = tile;
      }
    }
  }

  /**
   * Creates the school goal visual.
   * @private
   */
  _createSchoolGoal(x, y) {
    this.schoolGoal = this.add.container(x, y - 40 * this.s).setDepth(3);

    // Draw school building structure
    const schoolGraphics = this.add.graphics();

    // Main building
    const buildingW = 60 * this.s;
    const buildingH = 80 * this.s;
    schoolGraphics.fillStyle(0xff4444, 1); // Red neon
    schoolGraphics.fillRect(-buildingW / 2, -buildingH, buildingW, buildingH);
    schoolGraphics.lineStyle(3 * this.s, 0xff00ff, 1); // Neon pink outline
    schoolGraphics.strokeRect(-buildingW / 2, -buildingH, buildingW, buildingH);

    // Windows
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 4; j++) {
        schoolGraphics.fillStyle(0xffff00, 1); // Neon yellow windows
        schoolGraphics.fillRect(
          -buildingW / 2 + 8 * this.s + i * 16 * this.s,
          -buildingH + 8 * this.s + j * 18 * this.s,
          8 * this.s,
          8 * this.s
        );
      }
    }

    // Roof triangle
    schoolGraphics.fillStyle(0xff00ff, 1);
    schoolGraphics.fillTriangle(
      -buildingW / 2, -buildingH,
      buildingW / 2, -buildingH,
      0, -buildingH - 20 * this.s
    );

    this.schoolGoal.add(schoolGraphics);

    // Label
    const schoolLabel = this.add.text(x, y + 20 * this.s, 'בית ספר', {
      fontFamily: 'monospace',
      fontSize: `${14 * this.s}px`,
      fontWeight: '900',
      color: '#ffff00',
      align: 'center'
    });
    schoolLabel.setOrigin(0.5);
    schoolLabel.setStroke('#000000', 2 * this.s);
    schoolLabel.setDepth(3);

    // Pulsing glow effect for goal
    this.tweens.add({
      targets: this.schoolGoal,
      scale: { from: 1.0, to: 1.15 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  /**
   * Creates HUD elements (timer, lives).
   * @private
   */
  _createHUD(width, height) {
    LivesManager.showHUD();

    // Timer display
    this.timerText = this.add.text(width * 0.95, 30 * this.s, '20s', {
      fontFamily: 'monospace',
      fontSize: `${32 * this.s}px`,
      fontWeight: '900',
      color: '#00ff00',
      align: 'right'
    });
    this.timerText.setOrigin(1, 0);
    this.timerText.setStroke('#000000', 4 * this.s);
    this.timerText.setScrollFactor(0);
    this.timerText.setDepth(1000);

    // Instructions text
    const instructions = this.add.text(width / 2, height * 0.05, 'הגיעו לבית הספר בעוד 20 שניות!', {
      fontFamily: 'monospace',
      fontSize: `${14 * this.s}px`,
      fontWeight: 'bold',
      color: '#00ffff',
      align: 'center'
    });
    instructions.setOrigin(0.5, 0);
    instructions.setStroke('#000000', 2 * this.s);
    instructions.setScrollFactor(0);
    instructions.setDepth(1000);
  }


  /**
   * Crumbles random floor tiles.
   * @private
   */
  crumbleRandomFloor() {
    if (!this.floorGrid || this.floorGrid.length === 0) return;

    // Randomly remove 2-4 floor tiles
    const tilesToCrumble = Phaser.Math.Between(2, 4);

    for (let i = 0; i < tilesToCrumble; i++) {
      const randomRow = Phaser.Math.Between(0, this.floorGrid.length - 1);
      const randomCol = Phaser.Math.Between(0, this.floorGrid[randomRow].length - 1);

      const tile = this.floorGrid[randomRow][randomCol];
      if (tile && tile.isActive) {
        this.destroyFloorTile(tile);
      }
    }
  }

  /**
   * Destroys a floor tile with crumble effect.
   * @private
   */
  destroyFloorTile(tile) {
    if (!tile || !tile.isActive) return;

    tile.isActive = false;

    // Crumble animation
    this.tweens.add({
      targets: tile,
      y: tile.y + 100 * this.s,
      alpha: 0,
      angle: 45,
      duration: 500,
      onComplete: () => {
        tile.destroy();
      }
    });

    // Dust particle effect
    const dustGraphics = this.add.graphics();
    dustGraphics.fillStyle(0x8b7355, 0.7);
    for (let i = 0; i < 5; i++) {
      dustGraphics.fillCircle(
        tile.x + Phaser.Math.Between(0, this.tileSize),
        tile.y + Phaser.Math.Between(0, this.tileSize),
        Phaser.Math.Between(2, 5)
      );
    }
    this.tweens.add({
      targets: dustGraphics,
      alpha: 0,
      duration: 600,
      onComplete: () => dustGraphics.destroy()
    });
  }

  /**
   * Ends the game (win or lose).
   * @private
   */
  endGame(isVictory) {
    if (this.isSceneOver) return;
    this.isSceneOver = true;

    // Freeze player
    this.player.disable();
    this.player.body.setVelocity(0, 0);

    // Calculate and add score
    if (isVictory) {
      const score = 15; // Base victory score
      addGlobalScore(this, score, this.player.x, this.player.y);

      this.time.delayedCall(500, () => {
        showVictoryHelper(
          this,
          'FinalScene',
          'הגעתם לבית הספר!',
          'עברתם בהצלחה דרך הרעידה!'
        );
      });
    } else {
      this.time.delayedCall(500, () => {
        showGameOverHelper(
          this,
          'נפלתם!',
          'נסו שוב להגיע לבית הספר במהירות'
        );
      });
    }
  }

  update(time, delta) {
    if (this.player) {
      this.player.update();
    }

    if (this.isSceneOver || !this.player || !this.player.active) return;

    // Accumulate time for timer update (once per second)
    this.timerAccumulator += delta;
    if (this.timerAccumulator >= 1000) {
      this.timeRemaining -= 1;
      this.timerAccumulator = 0;

      if (this.timerText) {
        this.timerText.setText(`${Math.max(0, this.timeRemaining)}s`);

        // Color warning when time is low
        if (this.timeRemaining <= 5) {
          this.timerText.setColor('#ff0000');
        }
      }

      // Crumble floor every 2 seconds
      this.crumbleAccumulator += 1000;
      if (this.crumbleAccumulator >= 2000 && this.timeRemaining > 0) {
        this.crumbleAccumulator = 0;
        this.crumbleRandomFloor();
      }

      // Time's up!
      if (this.timeRemaining <= 0) {
        this.endGame(false);
      }
    }

    // Check if player reached school
    if (this.player && this.schoolGoal) {
      const distToSchool = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.schoolX, this.roadY
      );
      if (distToSchool < 40 * this.s) {
        this.endGame(true);
      }
    }

    // Check if player fell off the world
    if (this.player && this.player.y > this.roadY + 300 * this.s) {
      this.endGame(false);
    }
  }
}
