import Phaser from "phaser";
import { startSceneMusic } from "../systems/bg-music.js";
import { showVictoryHelper, showGameOverHelper } from "../systems/level-ui-helper.js";
import { LivesManager } from "../systems/lives-manager.js";
import { addGlobalScore } from "../systems/score-manager.js";

/**
 * Day4Scene — Catching Game: Catching people falling from the bus
 *
 * People fall from the bus in 7 sectors (Arabia, Ethiopia, Haredi, Russian, Yemenite, Gay-Man, Shlomi).
 * Player moves the bus left/right to catch them.
 * Catching 10 people completes the scene with a Jerusalem arrival cutscene.
 * Missing catches deduct lives; 0 lives triggers game over.
 * Bonus: +10 points for catching at least one person from all 7 sectors.
 * Bonus: +1 point per person caught.
 */

// Character pool with sector information - uses real character sprite assets (7 sectors)
const CHARACTER_POOL = [
  { name: 'Arabia-1', sector: 'Arabia', sprite: 'char-arabia' },
  { name: 'Arabia-2', sector: 'Arabia', sprite: 'char-arabia' },

  { name: 'Ethiopia-1', sector: 'Ethiopia', sprite: 'char-ethiopia' },
  { name: 'Ethiopia-2', sector: 'Ethiopia', sprite: 'char-ethiopia' },

  { name: 'Haredi-1', sector: 'Haredi', sprite: 'char-haredi' },
  { name: 'Haredi-2', sector: 'Haredi', sprite: 'char-haredi' },

  { name: 'Russian-1', sector: 'Russian', sprite: 'char-dati' },
  { name: 'Russian-2', sector: 'Russian', sprite: 'char-dati' },

  { name: 'Yemenite-1', sector: 'Yemenite', sprite: 'char-shiri' },
  { name: 'Yemenite-2', sector: 'Yemenite', sprite: 'char-shiri' },

  { name: 'Gay-Man-1', sector: 'Gay-Man', sprite: 'char-gay' },
  { name: 'Gay-Man-2', sector: 'Gay-Man', sprite: 'char-gay' },

  { name: 'Shlomi-1', sector: 'Shlomi', sprite: 'char-shlomi' },
  { name: 'Shlomi-2', sector: 'Shlomi', sprite: 'char-shlomi' },
];

const CATCH_TARGET = 10;

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
    this.fallingCharacters = [];
    this.bus = null;

    // Sector tracking for bonus
    this.sectorsCaught = new Set();
    this.bonusAwarded = false;

    // Track active spawns to stop them on game over
    this.spawnEvents = [];
  }

  create() {
    const { width, height } = this.scale;

    LivesManager.showHUD();
    startSceneMusic(this, "bg-day4");

    this.s = Math.max(1, height / 200);
    this.roadTop = Math.round(height * 0.60);
    this.roadBottom = Math.round(height * 0.92);
    const roadHeight = this.roadBottom - this.roadTop;
    this.roadCenterY = this.roadTop + roadHeight / 2;

    // --- Background - Jerusalem Journey ---
    this.cameras.main.setBackgroundColor(0x1a1a2e);
    if (this.textures.exists("day4-bg")) {
      this.add
        .image(width / 2, height / 2, "day4-bg")
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDisplaySize(width, height)
        .setDepth(-10);
    }

    // Road band
    this._buildRoadBand(width, roadHeight);

    // Physics world bounds
    this.physics.world.setBounds(0, 0, width, height);

    // Bus at bottom center (this is the catcher paddle)
    const busX = width / 2;
    const busY = this.roadBottom - 20 * this.s;
    this.bus = this.add.image(busX, busY, "egged_bus");
    this.bus.setScale(this.s).setDepth(150);

    // HUD
    this._createHUD();

    // Listen for keyboard input to move the bus
    this.input.keyboard.on("keydown-LEFT", () => {
      if (this.bus.x > 60 * this.s) {
        this.bus.x -= 20 * this.s;
      }
    });

    this.input.keyboard.on("keydown-RIGHT", () => {
      if (this.bus.x < width - 60 * this.s) {
        this.bus.x += 20 * this.s;
      }
    });

    // Also support A/D keys for non-EN keyboards
    this.input.keyboard.on("keydown-A", () => {
      if (this.bus.x > 60 * this.s) {
        this.bus.x -= 20 * this.s;
      }
    });

    this.input.keyboard.on("keydown-D", () => {
      if (this.bus.x < width - 60 * this.s) {
        this.bus.x += 20 * this.s;
      }
    });

    this.cameras.main.fadeIn(500);

    // Start spawning falling characters
    this._startSpawning();

    // Game timeout: 30 seconds
    this.time.delayedCall(30000, () => {
      if (!this.sceneEnded) {
        this._endGame(false);
      }
    });
  }

  update() {
    // Update falling characters
    for (let i = this.fallingCharacters.length - 1; i >= 0; i--) {
      const char = this.fallingCharacters[i];

      if (char.y > this.roadBottom + 100 * this.s) {
        // Character fell off screen - player missed catch
        char.destroy();
        this.fallingCharacters.splice(i, 1);

        // Deduct a life
        const remaining = LivesManager.deductLife();
        if (remaining <= 0) {
          this._endGame(false);
        }
      } else if (Phaser.Geom.Rectangle.Overlaps(this.bus.getBounds(), char.getBounds())) {
        // Collision with bus catcher
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
      .text(20, 20, this.caughtCount + "/" + CATCH_TARGET + " תפוסים", {
        fontFamily: "Arial, sans-serif",
        fontSize: `${16 * this.s}px`,
        color: "#ffffff",
      })
      .setScrollFactor(0)
      .setDepth(1000);
  }

  _updateHUD() {
    if (this.hudText) {
      this.hudText.setText(this.caughtCount + "/" + CATCH_TARGET + " תפוסים");
    }
  }

  _startSpawning() {
    // Spawn characters continuously, cycling through the pool
    // Stop after 10 are caught, not after all pool members spawn
    let spawnIndex = 0;

    const spawnLoop = () => {
      if (this.sceneEnded || this.caughtCount >= CATCH_TARGET) {
        return;
      }

      this._spawnCharacter(CHARACTER_POOL[spawnIndex % CHARACTER_POOL.length]);
      spawnIndex++;

      // Schedule next spawn
      const nextEvent = this.time.delayedCall(800, spawnLoop);
      this.spawnEvents.push(nextEvent);
    };

    // Start first spawn after 200ms delay
    const firstEvent = this.time.delayedCall(200, spawnLoop);
    this.spawnEvents.push(firstEvent);
  }

  _spawnCharacter(charDef) {
    if (this.sceneEnded) return;

    const { width, height } = this.scale;

    // Spawn at top of screen with slight randomization
    const spawnX = Math.random() * (width - 100 * this.s) + 50 * this.s;
    const spawnY = this.roadTop - 20 * this.s;

    // Create a falling character as a physics sprite using real character images
    let charSprite;
    if (this.textures.exists(charDef.sprite)) {
      charSprite = this.add.sprite(spawnX, spawnY, charDef.sprite);
      // Scale the sprite appropriately
      const charH = 20 * this.s;
      const texture = this.textures.get(charDef.sprite);
      if (texture && texture.source && texture.source[0]) {
        const aspect = texture.source[0].width / texture.source[0].height;
        charSprite.setDisplaySize(charH * aspect, charH);
      } else {
        charSprite.setDisplaySize(12 * this.s, 20 * this.s);
      }
    } else {
      // Fallback to colored rectangle if sprite doesn't exist
      charSprite = this.add.rectangle(spawnX, spawnY, 12 * this.s, 20 * this.s, 0xcccccc);
    }

    charSprite.setDepth(50);
    charSprite.setOrigin(0.5, 0.5);
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
        // Award bonus for catching all 7 sectors
        this.bonusAwarded = true;
        addGlobalScore(this, 10, this.bus.x, this.bus.y);
      }
    }

    // Award points for catching
    addGlobalScore(this, 1, this.bus.x, this.bus.y);
    this.caughtCount++;

    // Remove character
    charSprite.destroy();
    this.fallingCharacters.splice(index, 1);

    // Play catch sound
    this.sound.play("sfx-levelup", { volume: 0.3 });

    // Check if catch target is reached
    if (this.caughtCount >= CATCH_TARGET) {
      this._endGame(true);
    }
  }

  _endGame(victory) {
    if (this.sceneEnded) return;
    this.sceneEnded = true;

    // Stop all spawning
    for (const event of this.spawnEvents) {
      this.time.removeEvent(event);
    }
    this.spawnEvents = [];
    this.time.removeAllEvents();

    // Remove remaining falling characters
    for (const char of this.fallingCharacters) {
      char.destroy();
    }
    this.fallingCharacters = [];

    if (victory) {
      // Victory: 10 people caught - show Jerusalem arrival cutscene
      this._showJerusalemCutscene();
    } else {
      // Defeat: timeout or ran out of health
      const message = `תפסת ${this.caughtCount} מתוך ${CATCH_TARGET} אנשים`;
      showGameOverHelper(this, "Day4Scene", "שגעת!", message);
    }
  }

  _showJerusalemCutscene() {
    const { width, height } = this.scale;

    // Animate the bus moving toward Jerusalem (screen transition)
    this.tweens.add({
      targets: this.bus,
      x: width + 50 * this.s,
      duration: 1500,
      ease: "Power1.easeIn",
      onComplete: () => {
        // After bus exits screen, show victory
        const message = `טוב מאוד! תפסת ${this.caughtCount} אנשים בדרך לירושלים!`;
        showVictoryHelper(this, "Day4Scene", "הגענו לירושלים!", message);
      }
    });
  }
}
