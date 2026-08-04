import Phaser from "phaser";
import { startSceneMusic } from "../systems/bg-music.js";
import { showVictoryHelper } from "../systems/level-ui-helper.js";
import { LivesManager } from "../systems/lives-manager.js";
import { addGlobalScore } from "../systems/score-manager.js";

/**
 * Day4Scene — Catching Game: Catching people falling from the bus
 *
 * People fall from the bus in sectors (Arabia, Ethiopia, Haredi, Russian, Yemenite, Ashkenazi, Sephardi).
 * Player catches them to earn points.
 * Bonus: +10 points for catching at least one person from all 7 sectors.
 * Bonus: +1 point per person caught.
 * Scene completes when the last person is caught or time runs out.
 */

// Character pool with sector information
const CHARACTER_POOL = [
  // Each sector needs multiple characters for variety
  { name: 'Arabia-1', sector: 'Arabia', color: 0x8B4513 },
  { name: 'Arabia-2', sector: 'Arabia', color: 0xA0522D },
  { name: 'Ethiopia-1', sector: 'Ethiopia', color: 0x3D2817 },
  { name: 'Ethiopia-2', sector: 'Ethiopia', color: 0x2F1B0C },
  { name: 'Haredi-1', sector: 'Haredi', color: 0x000000 },
  { name: 'Haredi-2', sector: 'Haredi', color: 0x1a1a1a },
  { name: 'Russian-1', sector: 'Russian', color: 0xDEB887 },
  { name: 'Russian-2', sector: 'Russian', color: 0xD2B48C },
  { name: 'Yemenite-1', sector: 'Yemenite', color: 0x654321 },
  { name: 'Yemenite-2', sector: 'Yemenite', color: 0x8B6914 },
  { name: 'Ashkenazi-1', sector: 'Ashkenazi', color: 0xC0C0C0 },
  { name: 'Ashkenazi-2', sector: 'Ashkenazi', color: 0xE0E0E0 },
  { name: 'Sephardi-1', sector: 'Sephardi', color: 0x704214 },
  { name: 'Sephardi-2', sector: 'Sephardi', color: 0x8B5A2B },
];

export class Day4Scene extends Phaser.Scene {
  constructor() {
    super({ key: "Day4Scene" });

    this.s = 1;
    this.roadTop = 0;
    this.roadCenterY = 0;
    this.roadBottom = 0;
    this.sceneEnded = false;

    // Game state
    this.caughtCount = 0;
    this.totalCharacters = 0;
    this.fallingCharacters = [];
    this.player = null;
    this.playerImg = null;
    this.bus = null;

    // Sector tracking for bonus
    this.sectorsCaught = new Set();
    this.allSectorsCaught = false;
    this.bonusAwarded = false;
  }

  create() {
    const { width, height } = this.scale;

    console.log('Day4Scene: create() called');

    LivesManager.showHUD();
    startSceneMusic(this, "bg-middle");

    this.s = Math.max(1, height / 200);
    this.roadTop = Math.round(height * 0.60);
    this.roadBottom = Math.round(height * 0.92);
    const roadHeight = this.roadBottom - this.roadTop;
    this.roadCenterY = this.roadTop + roadHeight / 2;

    // --- Background ---
    this.cameras.main.setBackgroundColor(0x1a1a2e);
    if (this.textures.exists("day3-bg")) {
      this.add
        .image(width / 2, height / 2, "day3-bg")
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDisplaySize(width, height)
        .setDepth(-10);
    }

    // Road band
    this._buildRoadBand(width, roadHeight);

    // Physics world bounds
    this.physics.world.setBounds(0, 0, width, height);
    this.physics.world.setCollideWorldBounds(false);

    // Bus at top center (where people fall from)
    const busX = width / 2;
    const busY = this.roadTop + 30 * this.s;
    this.bus = this.add.image(busX, busY, "egged_bus");
    this.bus.setScale(this.s).setDepth(100);
    console.log(`Day4Scene: Bus created at (${busX}, ${busY})`);

    // Player at bottom center - make it a visible catching paddle
    const playerX = width / 2;
    const playerY = height - 20 * this.s;
    this.playerImg = this.add.rectangle(playerX, playerY, 60 * this.s, 16 * this.s, 0xff2a5f);
    this.playerImg.setDepth(150);
    this.physics.add.existing(this.playerImg);
    if (this.playerImg.body) {
      this.playerImg.body.setImmovable(true);
    }
    console.log(`Day4Scene: Player created at (${playerX}, ${playerY})`);

    // HUD
    this._createHUD();

    // Listen for keyboard input to move the player
    this.input.keyboard.on("keydown-LEFT", () => {
      if (this.playerImg.x > 0) {
        this.playerImg.x -= 20 * this.s;
      }
    });

    this.input.keyboard.on("keydown-RIGHT", () => {
      if (this.playerImg.x < width) {
        this.playerImg.x += 20 * this.s;
      }
    });

    // Also support A/D keys for non-EN keyboards
    this.input.keyboard.on("keydown-A", () => {
      if (this.playerImg.x > 0) {
        this.playerImg.x -= 20 * this.s;
      }
    });

    this.input.keyboard.on("keydown-D", () => {
      if (this.playerImg.x < width) {
        this.playerImg.x += 20 * this.s;
      }
    });

    this.cameras.main.fadeIn(500);

    // Start spawning falling characters
    this._startSpawning();

    // Game timeout: 30 seconds
    this.time.delayedCall(30000, () => {
      if (!this.sceneEnded) {
        this._endGame();
      }
    });
  }

  update() {
    // Update falling characters
    for (let i = this.fallingCharacters.length - 1; i >= 0; i--) {
      const char = this.fallingCharacters[i];

      if (char.y > this.roadBottom + 100 * this.s) {
        // Character fell off screen
        char.destroy();
        this.fallingCharacters.splice(i, 1);
      } else if (Phaser.Geom.Rectangle.Overlaps(this.playerImg.getBounds(), char.getBounds())) {
        // Collision with player
        this._catchCharacter(char, i);
      }
    }

    // Update HUD
    this._updateHUD();
  }

  _buildRoadBand(width, roadHeight) {
    const roadGfx = this.add.graphics();
    roadGfx.fillStyle(0x333333, 1);
    roadGfx.fillRect(0, this.roadTop, width, roadHeight);
    roadGfx.setScrollFactor(0).setDepth(5);

    // Road lines
    const lineGfx = this.add.graphics();
    lineGfx.fillStyle(0xffff00, 0.7);
    lineGfx.fillRect(0, this.roadCenterY - 2, width, 4);
    lineGfx.setScrollFactor(0).setDepth(5);
  }

  _createHUD() {
    this.hudText = this.add
      .text(20, 20, this.caughtCount + "/" + this.totalCharacters + " תפוסים", {
        fontFamily: "Arial, sans-serif",
        fontSize: `${16 * this.s}px`,
        color: "#ffffff",
      })
      .setScrollFactor(0)
      .setDepth(1000);
  }

  _updateHUD() {
    if (this.hudText) {
      this.hudText.setText(this.caughtCount + "/" + this.totalCharacters + " תפוסים");
    }
  }

  _startSpawning() {
    // Determine total characters to spawn (14 characters = 2 per sector)
    this.totalCharacters = CHARACTER_POOL.length;

    console.log(`Day4Scene: Starting to spawn ${this.totalCharacters} characters`);

    // Spawn characters at intervals (use proper closure to capture index value)
    for (let i = 0; i < this.totalCharacters; i++) {
      // Use IIFE to capture the current value of i
      ((idx) => {
        this.time.delayedCall(idx * 800 + 200, () => {
          this._spawnCharacter(idx);
        });
      })(i);
    }
  }

  _spawnCharacter(index) {
    if (this.sceneEnded) return;

    if (index < 0 || index >= CHARACTER_POOL.length) {
      console.warn(`Day4Scene: Invalid character index ${index}`);
      return;
    }

    const charDef = CHARACTER_POOL[index];
    const { width } = this.scale;

    // Spawn at bus location with slight randomization
    const busX = width / 2;
    const spawnX = busX + (Math.random() * 80 * this.s - 40 * this.s);
    const spawnY = this.roadTop + 20 * this.s;

    // Create a falling character as a physics rectangle
    const charSprite = this.add.rectangle(
      spawnX,
      spawnY,
      12 * this.s,
      20 * this.s,
      charDef.color
    );
    charSprite.setDepth(50);
    charSprite.sector = charDef.sector;

    this.physics.add.existing(charSprite);
    if (charSprite.body) {
      charSprite.body.setVelocityY(150 + Math.random() * 100); // Falling speed
      charSprite.body.setVelocityX((Math.random() - 0.5) * 80); // Slight horizontal drift
      charSprite.body.setDrag(0.05);
      charSprite.body.setBounce(0);
      charSprite.body.setCollideWorldBounds(false); // Allow falling off screen
    }

    this.fallingCharacters.push(charSprite);
  }

  _catchCharacter(charSprite, index) {
    const sector = charSprite.sector;

    // Add to caught sectors
    if (!this.sectorsCaught.has(sector)) {
      this.sectorsCaught.add(sector);
      if (this.sectorsCaught.size === 7 && !this.bonusAwarded) {
        // Award bonus for catching all sectors
        this.bonusAwarded = true;
        addGlobalScore(this, 10, this.playerImg.x, this.playerImg.y);
      }
    }

    // Award points for catching
    addGlobalScore(this, 1, this.playerImg.x, this.playerImg.y);
    this.caughtCount++;

    // Remove character
    charSprite.destroy();
    this.fallingCharacters.splice(index, 1);

    // Play catch sound
    this.sound.play("sfx-levelup", { volume: 0.3 });

    // Check if all characters are caught
    if (this.caughtCount >= this.totalCharacters) {
      this._endGame();
    }
  }

  _endGame() {
    if (this.sceneEnded) return;
    this.sceneEnded = true;

    // Stop spawning
    this.time.removeAllEvents();

    // Remove remaining falling characters
    for (const char of this.fallingCharacters) {
      char.destroy();
    }
    this.fallingCharacters = [];

    // Victory message
    const message =
      this.caughtCount >= this.totalCharacters
        ? "כל אנשי האוטובוס נתפסו בבטחה!"
        : `תפסת ${this.caughtCount} מתוך ${this.totalCharacters} אנשים`;

    showVictoryHelper(this, "Day4Scene", "טוב מאוד!", message);

    // Emit complete event for orchestrator
    this.time.delayedCall(2000, () => {
      this.events.emit("complete");
    });
  }
}
