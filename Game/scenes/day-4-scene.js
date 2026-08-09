import Phaser from "phaser";
import { startSceneMusic } from "../systems/bg-music.js";
import { showVictoryHelper, showGameOverHelper } from "../systems/level-ui-helper.js";
import { LivesManager } from "../systems/lives-manager.js";
import { addGlobalScore } from "../systems/score-manager.js";
import { playDialogOnce } from "../systems/dialog-system.js";

/**
 * Day4Scene — Catching Game: Catching people falling out of the sky on the desert road to Jerusalem
 *
 * People fall from the sky representing 7 sectors:
 * (Arabia, Ethiopia, Haredi, Dati, Yemenite, Gay-Man, Shlomi).
 * Controls:
 * - Default: Bus hugs the left side of the screen at cruising speed.
 * - Gas Pump (Right Button / D / Right Arrow): Accelerates bus toward the right side of screen.
 * - Brake (Left Button / A / Left Arrow): Rapidly pulls bus back to the far left edge.
 */

const SECTOR_DEFS = [
  { name: 'ערבי', sector: 'Arabia', sprite: 'char-arabia' },
  { name: 'אתיופי', sector: 'Ethiopia', sprite: 'char-ethiopia' },
  { name: 'חרדי', sector: 'Haredi', sprite: 'char-haredi' },
  { name: 'דתי', sector: 'Dati', sprite: 'char-dati' },
  { name: 'תימני', sector: 'Yemenite', sprite: 'char-shiri' },
  { name: 'גיי', sector: 'Gay-Man', sprite: 'char-gay' },
  { name: 'שלומי', sector: 'Shlomi', sprite: 'char-shlomi' },
];

const CATCH_TARGET = 10;
const TOTAL_SECTORS = 7;

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
    this.jerusalemEntrance = null;
    this.roadDashes = null;

    // Pedal control state
    this.isGasPressed = false;
    this.isBrakePressed = false;
    this.gasBtn = null;
    this.brakeBtn = null;
    this.gasPedalSprite = null;
    this.brakePedalSprite = null;

    // Sector tracking for bonus
    this.sectorsCaught = new Set();
    this.bonusAwarded = false;

    // Active spawn timers
    this.spawnEvents = [];

    // Tutorial state
    this.tutorialStep = "none";
    this.tutorialArrow = null;
    this.tutorialContainer = null;
    this.tutorialText = null;
    this.gasHoldTimer = 0;
    this.brakeHoldTimer = 0;
  }

  init() {
    this.sceneEnded = false;
    this.caughtCount = 0;
    this.fallingCharacters = [];
    this.bus = null;
    this.jerusalemEntrance = null;
    this.roadDashes = null;

    this.isGasPressed = false;
    this.isBrakePressed = false;
    this.gasBtn = null;
    this.brakeBtn = null;
    this.gasPedalSprite = null;
    this.brakePedalSprite = null;

    this.sectorsCaught = new Set();
    this.bonusAwarded = false;

    this.spawnEvents = [];

    this.tutorialStep = "none";
    this.tutorialArrow = null;
    this.tutorialContainer = null;
    this.tutorialText = null;
    this.gasHoldTimer = 0;
    this.brakeHoldTimer = 0;
  }

  create() {
    this.init();

    const { width, height } = this.scale;

    LivesManager.showHUD();
    startSceneMusic(this, "bg-day4");

    this.s = Math.max(1, height / 200);
    this.roadTop = Math.round(height * 0.55);
    this.roadBottom = Math.round(height * 0.90);
    const roadHeight = this.roadBottom - this.roadTop;
    this.roadCenterY = this.roadTop + roadHeight / 2;

    // --- Desert Background ---
    this._buildDesertBackground(width, height);

    // Desert Highway Road Band
    this._buildDesertRoadBand(width, roadHeight);

    // Physics world bounds
    this.physics.world.setBounds(0, 0, width, height);

    // Catcher Bus on the road (starts hugging the left side)
    const busX = 90 * this.s;
    const busY = this.roadBottom - 18 * this.s;
    const busTextureKey = this.textures.exists("egged_bus_no_doors") ? "egged_bus_no_doors" : "egged_bus";
    this.bus = this.add.image(busX, busY, busTextureKey);
    this.bus.setScale(this.s).setDepth(150);

    // Enable physics on bus
    this.physics.add.existing(this.bus);
    if (this.bus.body) {
      this.bus.body.setCollideWorldBounds(true);
    }

    // Pedal UI Buttons (Gas Pump right, Brake left)
    this._createPedalButtons(width, height);

    // HUD
    this._createHUD();

    // Input handlers — Keyboard (Right Arrow / D = Gas Pump, Left Arrow / A = Brake)
    this._onKeyDownRight = () => this._pressGasPedal();
    this._onKeyUpRight = () => this._releaseGasPedal();
    this._onKeyDownLeft = () => this._pressBrakePedal();
    this._onKeyUpLeft = () => this._releaseBrakePedal();

    this.input.keyboard.on("keydown-RIGHT", this._onKeyDownRight);
    this.input.keyboard.on("keyup-RIGHT", this._onKeyUpRight);
    this.input.keyboard.on("keydown-D", this._onKeyDownRight);
    this.input.keyboard.on("keyup-D", this._onKeyUpRight);

    this.input.keyboard.on("keydown-LEFT", this._onKeyDownLeft);
    this.input.keyboard.on("keyup-LEFT", this._onKeyUpLeft);
    this.input.keyboard.on("keydown-A", this._onKeyDownLeft);
    this.input.keyboard.on("keyup-A", this._onKeyUpLeft);

    // Screen Touch zones fallback (touch right half = Gas, touch left half = Brake)
    this._onPointerDown = (pointer) => {
      if (pointer.y < height - 70 * this.s) {
        if (pointer.x > width / 2) {
          this._pressGasPedal();
        } else {
          this._pressBrakePedal();
        }
      }
    };
    this._onPointerUp = () => {
      this._releaseGasPedal();
      this._releaseBrakePedal();
    };

    this.input.on("pointerdown", this._onPointerDown);
    this.input.on("pointerup", this._onPointerUp);

    this.cameras.main.fadeIn(500);

    // Shutdown / Destroy listeners to cleanup scene state properly
    this.events.once("shutdown", () => this._cleanupScene());
    this.events.once("destroy", () => this._cleanupScene());

    // Opening dialogue, then start pedal tutorial
    const introDialog = [
      {
        speaker: "נהג האוטובוס",
        text: "תכניסו כמה שיותר אנשים לאוטובוס, כדי שכל מי שיש לו זכות הצבעה יוכל להגיע לקלפי.",
      },
    ];
    playDialogOnce("Day4Scene-intro", this, introDialog, () => {
      this._startTutorial();
    });
  }

  _cleanupScene() {
    if (typeof window.hideHUD === 'function') {
      window.hideHUD('html-stats-hud');
    }

    if (this.input && this.input.keyboard) {
      if (this._onKeyDownRight) {
        this.input.keyboard.off("keydown-RIGHT", this._onKeyDownRight);
        this.input.keyboard.off("keyup-RIGHT", this._onKeyUpRight);
        this.input.keyboard.off("keydown-D", this._onKeyDownRight);
        this.input.keyboard.off("keyup-D", this._onKeyUpRight);
      }
      if (this._onKeyDownLeft) {
        this.input.keyboard.off("keydown-LEFT", this._onKeyDownLeft);
        this.input.keyboard.off("keyup-LEFT", this._onKeyUpLeft);
        this.input.keyboard.off("keydown-A", this._onKeyDownLeft);
        this.input.keyboard.off("keyup-A", this._onKeyUpLeft);
      }
    }
    if (this.input) {
      if (this._onPointerDown) this.input.off("pointerdown", this._onPointerDown);
      if (this._onPointerUp) this.input.off("pointerup", this._onPointerUp);
    }

    for (const event of this.spawnEvents) {
      if (event) this.time.removeEvent(event);
    }
    this.spawnEvents = [];
    this.time.removeAllEvents();

    if (this.fallingCharacters) {
      for (const char of this.fallingCharacters) {
        if (char && char.destroy) char.destroy();
      }
      this.fallingCharacters = [];
    }

    if (this.tutorialArrowBounce) {
      this.tutorialArrowBounce.stop();
      this.tutorialArrowBounce = null;
    }
    if (this.tutorialArrow) {
      this.tutorialArrow.destroy();
      this.tutorialArrow = null;
    }
    if (this.tutorialCard) {
      this.tutorialCard.remove();
      this.tutorialCard = null;
    }

    this.tweens.killAll();
  }

  update(time, delta) {
    if (this.sceneEnded) return;

    const dt = (delta || 16.6) / 1000;

    // --- Interactive Tutorial Progress ---
    if (this.tutorialStep === "gas") {
      if (this.isGasPressed) {
        this.gasHoldTimer += dt;
        if (this.gasHoldTimer >= 0.4) {
          this._advanceTutorialToBrake();
        }
      }
    } else if (this.tutorialStep === "brake") {
      if (this.isBrakePressed) {
        this.brakeHoldTimer += dt;
        if (this.brakeHoldTimer >= 0.4) {
          this._completeTutorial();
        }
      }
    }

    // Default cruising position when idle (hugging the left side of screen)
    const cruiseX = 90 * this.s;
    let scrollSpeed = 320 * this.s;

    if (this.bus && this.bus.body) {
      if (this.isGasPressed) {
        // Gas Pump pressed — speed up towards the right side of the screen
        this.bus.body.setVelocityX(260 * this.s);
        scrollSpeed = 540 * this.s; // Road zooms past!
      } else if (this.isBrakePressed) {
        // Brake pressed — rapidly pull back to the far left of the screen
        this.bus.body.setVelocityX(-280 * this.s);
        scrollSpeed = 150 * this.s; // Road slows down!
      } else {
        // Default state (no button pressed) — smoothly coast toward slowest speed (hugging left side)
        const diffX = cruiseX - this.bus.x;
        const coastVx = Phaser.Math.Clamp(diffX * 2.5, -140 * this.s, 140 * this.s);
        this.bus.body.setVelocityX(coastVx);
        scrollSpeed = 300 * this.s;
      }
    }

    if (this.roadDashes) {
      this.roadDashes.tilePositionX += scrollSpeed * dt;
    }

    // Driving engine & suspension vibration
    if (this.bus && !this.sceneEnded) {
      const busBaseY = this.roadBottom - 18 * this.s;
      this.bus.y = busBaseY + Math.sin(time * 0.015) * (1.2 * this.s);
    }

    // Update falling characters
    for (let i = this.fallingCharacters.length - 1; i >= 0; i--) {
      const char = this.fallingCharacters[i];

      if (char.y > this.roadBottom + 40 * this.s) {
        // Character fell off screen — player missed catch
        const missX = char.x;
        char.destroy();
        this.fallingCharacters.splice(i, 1);

        // Sound feedback on miss / failure (Kahoot Gong from ColorUp)
        if (this.sound.get('sfx-fail-gong')) {
          this.sound.play('sfx-fail-gong', { volume: 0.7 });
        } else if (this.sound.get('sfx-wrong')) {
          this.sound.play('sfx-wrong', { volume: 0.6 });
        } else {
          this.sound.play('sfx-explosion', { volume: 0.5 });
        }

        // Red camera flash & subtle camera shake
        this.cameras.main.flash(200, 239, 68, 68, 0.35);
        this.cameras.main.shake(120, 0.004);

        // Floating red "-1 💔" pop text at bottom screen
        const missPopText = this.add.text(missX, this.roadBottom - 10 * this.s, "-1 💔", {
          fontFamily: "Arial, sans-serif",
          fontSize: `${Math.max(14, Math.round(16 * this.s))}px`,
          fontWeight: "bold",
          color: "#ef4444",
          stroke: "#000000",
          strokeThickness: 3,
        }).setOrigin(0.5, 1).setDepth(2000);

        this.tweens.add({
          targets: missPopText,
          y: missPopText.y - 30 * this.s,
          alpha: 0,
          duration: 900,
          onComplete: () => missPopText.destroy()
        });

        // Deduct a life
        const remaining = LivesManager.deductLife();
        if (remaining <= 0) {
          this._endGame(false);
        }
      } else if (this.bus && Phaser.Geom.Rectangle.Overlaps(this.bus.getBounds(), char.getBounds())) {
        // Caught in bus!
        this._catchCharacter(char, i);
      }
    }

    this._updateHUD();
  }

  _moveBus(deltaX) {
    if (!this.bus || this.sceneEnded) return;
    const { width } = this.scale;
    this.bus.x = Phaser.Math.Clamp(this.bus.x + deltaX, 50 * this.s, width - 50 * this.s);
  }

  _buildDesertBackground(width, height) {
    // 1. Warm Desert Sky Gradient
    const skyGfx = this.add.graphics();
    skyGfx.fillGradientStyle(0xed8936, 0xed8936, 0xfbd38d, 0xfbd38d, 1);
    skyGfx.fillRect(0, 0, width, this.roadTop);
    skyGfx.setDepth(-10).setScrollFactor(0);

    // Desert Sun
    const sunGfx = this.add.graphics();
    sunGfx.fillStyle(0xfffaed, 0.4);
    sunGfx.fillCircle(width * 0.8, height * 0.18, 45 * this.s);
    sunGfx.fillStyle(0xfff500, 1);
    sunGfx.fillCircle(width * 0.8, height * 0.18, 25 * this.s);
    sunGfx.setDepth(-9).setScrollFactor(0);

    // 2. Distant Desert Sand Dunes / Mountains
    const dunesGfx = this.add.graphics();

    // Dune shape 1 (Background dunes)
    const points1 = [
      { x: 0, y: this.roadTop },
      { x: 0, y: this.roadTop - 40 * this.s },
      { x: width * 0.25, y: this.roadTop - 65 * this.s },
      { x: width * 0.5, y: this.roadTop - 30 * this.s },
      { x: width * 0.75, y: this.roadTop - 75 * this.s },
      { x: width, y: this.roadTop - 35 * this.s },
      { x: width, y: this.roadTop },
    ];
    dunesGfx.fillStyle(0xdd6b20, 0.9);
    dunesGfx.fillPoints(points1, true);

    // Dune shape 2 (Foreground warm sand dunes)
    const points2 = [
      { x: 0, y: this.roadTop },
      { x: 0, y: this.roadTop - 20 * this.s },
      { x: width * 0.35, y: this.roadTop - 45 * this.s },
      { x: width * 0.7, y: this.roadTop - 15 * this.s },
      { x: width * 0.85, y: this.roadTop - 35 * this.s },
      { x: width, y: this.roadTop - 25 * this.s },
      { x: width, y: this.roadTop },
    ];
    dunesGfx.fillStyle(0xe53e3e, 0.7);
    dunesGfx.fillPoints(points2, true);

    dunesGfx.setDepth(-8).setScrollFactor(0);
  }

  _buildDesertRoadBand(width, roadHeight) {
    // Asphalt highway
    const roadGfx = this.add.graphics();
    roadGfx.fillStyle(0x2d3748, 1);
    roadGfx.fillRect(0, this.roadTop, width, roadHeight);
    roadGfx.setScrollFactor(0).setDepth(5);

    // Highway yellow dashes tileSprite for animated driving scroll
    if (!this.textures.exists('road_dash_line_d4')) {
      const g = this.add.graphics();
      g.fillStyle(0xecc94b, 0.95);
      g.fillRect(0, 0, Math.round(22 * this.s), 4);
      g.generateTexture('road_dash_line_d4', Math.round(38 * this.s), 4);
      g.destroy();
    }

    this.roadDashes = this.add.tileSprite(width / 2, this.roadCenterY, width, 4, 'road_dash_line_d4');
    this.roadDashes.setDepth(5).setScrollFactor(0);

    // Sandy road shoulder / sidewalk
    const shoulderGfx = this.add.graphics();
    shoulderGfx.fillStyle(0xd69e2e, 1);
    shoulderGfx.fillRect(0, this.roadBottom, width, this.scale.height - this.roadBottom);
    shoulderGfx.setScrollFactor(0).setDepth(6);
  }

  _createPedalButtons(width, height) {
    const s = this.s;
    const btnY = height - 32 * s;

    // --- Right Button: Gas Pedal Pixel Art ---
    const gasX = width - 42 * s;
    const gasTexKey = this.textures.exists("pedal_gas") ? "pedal_gas" : null;
    if (gasTexKey) {
      this.gasPedalSprite = this.add.image(gasX, btnY, gasTexKey)
        .setScale(s * 1.3)
        .setDepth(2000)
        .setScrollFactor(0);

      const gasHit = this.add.zone(gasX, btnY, 44 * s, 54 * s)
        .setInteractive({ useHandCursor: true });

      gasHit.on("pointerdown", () => this._pressGasPedal());
      gasHit.on("pointerup", () => this._releaseGasPedal());
      gasHit.on("pointerout", () => this._releaseGasPedal());
    }

    // --- Left Button: Brake Pedal Pixel Art ---
    const brakeX = 42 * s;
    const brakeTexKey = this.textures.exists("pedal_brake") ? "pedal_brake" : null;
    if (brakeTexKey) {
      this.brakePedalSprite = this.add.image(brakeX, btnY, brakeTexKey)
        .setScale(s * 1.3)
        .setDepth(2000)
        .setScrollFactor(0);

      const brakeHit = this.add.zone(brakeX, btnY, 54 * s, 44 * s)
        .setInteractive({ useHandCursor: true });

      brakeHit.on("pointerdown", () => this._pressBrakePedal());
      brakeHit.on("pointerup", () => this._releaseBrakePedal());
      brakeHit.on("pointerout", () => this._releaseBrakePedal());
    }
  }

  _pressGasPedal() {
    if (this.isGasPressed) return;
    this.isGasPressed = true;
    if (this.gasPedalSprite) {
      if (this.textures.exists("pedal_gas_pressed")) {
        this.gasPedalSprite.setTexture("pedal_gas_pressed");
      }
      this.tweens.killTweensOf(this.gasPedalSprite);
      this.tweens.add({
        targets: this.gasPedalSprite,
        y: (this.scale.height - 32 * this.s) + 3 * this.s,
        scaleY: this.s * 1.15,
        angle: 5,
        duration: 70,
        ease: "Power1.easeOut"
      });
    }
  }

  _releaseGasPedal() {
    this.isGasPressed = false;
    if (this.gasPedalSprite) {
      if (this.textures.exists("pedal_gas")) {
        this.gasPedalSprite.setTexture("pedal_gas");
      }
      this.tweens.killTweensOf(this.gasPedalSprite);
      this.tweens.add({
        targets: this.gasPedalSprite,
        y: this.scale.height - 32 * this.s,
        scaleY: this.s * 1.3,
        angle: 0,
        duration: 160,
        ease: "Back.easeOut"
      });
    }
  }

  _pressBrakePedal() {
    if (this.isBrakePressed) return;
    this.isBrakePressed = true;
    if (this.brakePedalSprite) {
      if (this.textures.exists("pedal_brake_pressed")) {
        this.brakePedalSprite.setTexture("pedal_brake_pressed");
      }
      this.tweens.killTweensOf(this.brakePedalSprite);
      this.tweens.add({
        targets: this.brakePedalSprite,
        y: (this.scale.height - 32 * this.s) + 3 * this.s,
        scaleY: this.s * 1.15,
        angle: -5,
        duration: 70,
        ease: "Power1.easeOut"
      });
    }
  }

  _releaseBrakePedal() {
    this.isBrakePressed = false;
    if (this.brakePedalSprite) {
      if (this.textures.exists("pedal_brake")) {
        this.brakePedalSprite.setTexture("pedal_brake");
      }
      this.tweens.killTweensOf(this.brakePedalSprite);
      this.tweens.add({
        targets: this.brakePedalSprite,
        y: this.scale.height - 32 * this.s,
        scaleY: this.s * 1.3,
        angle: 0,
        duration: 160,
        ease: "Back.easeOut"
      });
    }
  }

  _createHUD() {
    LivesManager.showHUD();
    if (typeof window.showHUD === "function") {
      window.showHUD("html-stats-hud", `אנשים שתפסת: 0/${CATCH_TARGET}`);
    }
  }

  _updateHUD() {
    LivesManager.updateHUD();
    if (typeof window.updateHUDText === "function") {
      window.updateHUDText("html-stats-hud", `אנשים שתפסת: ${this.caughtCount}/${CATCH_TARGET}`);
    }
  }

  // --- Interactive Tutorial Methods (Unified Visual Language) ---
  _startTutorial() {
    if (this.sceneEnded) return;

    const { width, height } = this.scale;
    const s = this.s;

    // 1. Create HTML tutorial card (matches Stage 1 & 2 glassmorphic design system)
    this.tutorialCard = document.createElement('div');
    this.tutorialCard.className = 'tutorial-card';
    this.tutorialCard.style.left = '50%';
    this.tutorialCard.style.transform = 'translate(-50%, 20px)';
    this.tutorialCard.style.bottom = `${Math.round(height * 0.42)}px`;
    this.tutorialCard.innerHTML = `
      <div class="highlight-text">לחצו על דוושת הגז (ימינה) כדי להתקדם!</div>
      <div class="sub-text">לחצו והחזיקו כדי להאיץ קדימה בכביש</div>
    `;
    document.body.appendChild(this.tutorialCard);

    requestAnimationFrame(() => {
      if (this.tutorialCard) {
        this.tutorialCard.style.transform = 'translate(-50%, 0)';
        this.tutorialCard.classList.add('show');
      }
    });

    // 2. Create Phaser neon pink arrow pointer pointing down at Gas pedal
    const arrow = this.add.graphics();
    arrow.setScrollFactor(0);
    arrow.setDepth(10000);

    const drawArrow = (size = 16 * s) => {
      arrow.clear();
      arrow.lineStyle(4 * s, 0xff007f, 1);
      arrow.fillStyle(0xff007f, 0.9);

      // Arrow tail line
      arrow.beginPath();
      arrow.moveTo(0, -size * 2);
      arrow.lineTo(0, -size * 0.5);
      arrow.strokePath();

      // Triangle head pointing down at (0,0)
      arrow.beginPath();
      arrow.moveTo(0, 0);
      arrow.lineTo(-size * 0.6, -size * 0.7);
      arrow.lineTo(size * 0.6, -size * 0.7);
      arrow.closePath();
      arrow.fillPath();
    };
    drawArrow();

    const gasX = width - 42 * s;
    const btnY = height - 32 * s;
    const targetY = btnY - 32 * s;
    arrow.setPosition(gasX, targetY);

    this.tutorialArrowBounce = this.tweens.add({
      targets: arrow,
      y: targetY - 12 * s,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.tutorialArrow = arrow;
    this.tutorialStep = "gas";
    this.gasHoldTimer = 0;
  }

  _advanceTutorialToBrake() {
    const { height } = this.scale;
    const s = this.s;

    this.tutorialStep = "brake";
    this.brakeHoldTimer = 0;

    if (this.tutorialCard) {
      this.tutorialCard.innerHTML = `
        <div class="highlight-text">לחצו על הבלם (שמאלה) כדי להאיט ולחזור אחורה!</div>
        <div class="sub-text">לחצו כדי להאיט ולחזור אחורה בקלות</div>
      `;
    }

    if (this.tutorialArrow) {
      const brakeX = 42 * s;
      const btnY = height - 32 * s;
      const targetY = btnY - 32 * s;

      if (this.tutorialArrowBounce) {
        this.tutorialArrowBounce.stop();
        this.tutorialArrowBounce = null;
      }
      this.tutorialArrow.setPosition(brakeX, targetY);

      this.tutorialArrowBounce = this.tweens.add({
        targets: this.tutorialArrow,
        y: targetY - 12 * s,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  _completeTutorial() {
    this.tutorialStep = "done";

    if (this.tutorialArrowBounce) {
      this.tutorialArrowBounce.stop();
      this.tutorialArrowBounce = null;
    }

    if (this.tutorialArrow) {
      this.tweens.add({
        targets: this.tutorialArrow,
        alpha: 0,
        scale: 0.5,
        duration: 300,
        onComplete: () => {
          if (this.tutorialArrow) {
            this.tutorialArrow.destroy();
            this.tutorialArrow = null;
          }
        }
      });
    }

    if (this.tutorialCard) {
      const card = this.tutorialCard;
      this.tutorialCard = null;
      card.style.transform = 'translate(-50%, 20px)';
      card.classList.remove('show');
      setTimeout(() => {
        card.remove();
      }, 400);
    }

    this._startSpawning();
  }

  _startSpawning() {
    let spawnIndex = 0;

    const spawnLoop = () => {
      if (this.sceneEnded || this.caughtCount >= CATCH_TARGET) {
        return;
      }

      const sectorDef = SECTOR_DEFS[spawnIndex % SECTOR_DEFS.length];
      this._spawnCharacter(sectorDef);
      spawnIndex++;

      // Fixed spawn delay (~1450ms) so 10 characters span ~15 seconds of gameplay
      const delay = 1450;
      const nextEvent = this.time.delayedCall(delay, spawnLoop);
      this.spawnEvents.push(nextEvent);
    };

    const firstEvent = this.time.delayedCall(300, spawnLoop);
    this.spawnEvents.push(firstEvent);
  }

  _spawnCharacter(charDef) {
    if (this.sceneEnded) return;

    const { width, height } = this.scale;

    const spawnX = Math.random() * (width - 100 * this.s) + 50 * this.s;
    const spawnY = -20 * this.s;

    let charSprite;
    if (this.textures.exists(charDef.sprite)) {
      charSprite = this.add.sprite(spawnX, spawnY, charDef.sprite);
      const charH = 24 * this.s;
      const texture = this.textures.get(charDef.sprite);
      if (texture && texture.source && texture.source[0]) {
        const aspect = texture.source[0].width / texture.source[0].height;
        charSprite.setDisplaySize(charH * aspect, charH);
      } else {
        charSprite.setDisplaySize(14 * this.s, 24 * this.s);
      }
    } else {
      charSprite = this.add.rectangle(spawnX, spawnY, 14 * this.s, 24 * this.s, 0xffffff);
    }

    charSprite.setDepth(50);
    charSprite.setOrigin(0.5, 0.5);
    charSprite.sector = charDef.sector;

    this.physics.add.existing(charSprite);
    if (charSprite.body) {
      // Scaled fall velocity for player reaction time
      const baseVelY = (110 + Math.random() * 40) * (height / 360);
      charSprite.body.setVelocityY(baseVelY);
      charSprite.body.setVelocityX((Math.random() - 0.5) * 40 * this.s);
      charSprite.body.setCollideWorldBounds(false);
    }

    this.tweens.add({
      targets: charSprite,
      angle: Phaser.Math.Between(-15, 15),
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.fallingCharacters.push(charSprite);
  }

  _catchCharacter(charSprite, index) {
    const sector = charSprite.sector;

    addGlobalScore(this, 1, this.bus.x, this.bus.y);
    this.caughtCount++;

    if (!this.sectorsCaught.has(sector)) {
      this.sectorsCaught.add(sector);

      if (this.sectorsCaught.size === TOTAL_SECTORS && !this.bonusAwarded) {
        this.bonusAwarded = true;
        addGlobalScore(this, 10, this.bus.x, this.bus.y - 30 * this.s);

        const bonusText = this.add.text(this.bus.x, this.bus.y - 50 * this.s, "+10 על ייצוג הולם", {
          fontFamily: "Arial, sans-serif",
          fontSize: `${Math.max(14, Math.round(16 * this.s))}px`,
          fontWeight: "bold",
          color: "#facc15",
          stroke: "#000000",
          strokeThickness: 3,
        }).setOrigin(0.5, 1).setDepth(2000);

        this.tweens.add({
          targets: bonusText,
          y: bonusText.y - 30 * this.s,
          alpha: 0,
          duration: 1800,
          onComplete: () => bonusText.destroy()
        });
      }
    }

    if (this.sound.get('sfx-catch-mix')) {
      this.sound.play('sfx-catch-mix', { volume: 0.7 });
    } else if (this.sound.get('sfx-correct')) {
      this.sound.play('sfx-correct', { volume: 0.6 });
    } else {
      this.sound.play('collect', { volume: 0.6 });
    }

    this.tweens.killTweensOf(charSprite);
    this.tweens.add({
      targets: charSprite,
      scaleX: 0.2,
      scaleY: 0.2,
      alpha: 0,
      duration: 150,
      onComplete: () => charSprite.destroy()
    });

    this.fallingCharacters.splice(index, 1);

    if (this.caughtCount >= CATCH_TARGET) {
      this._endGame(true);
    }
  }

  _endGame(victory) {
    if (this.sceneEnded) return;
    this.sceneEnded = true;

    // Reset pedal states and fade out pedal UI
    this.isGasPressed = false;
    this.isBrakePressed = false;
    const pedalsToFade = [];
    if (this.gasPedalSprite) pedalsToFade.push(this.gasPedalSprite);
    if (this.brakePedalSprite) pedalsToFade.push(this.brakePedalSprite);
    if (pedalsToFade.length > 0) {
      this.tweens.add({ targets: pedalsToFade, alpha: 0, duration: 400 });
    }

    // Halt physics velocity and disable physics body so world bounds collision never bounces bus back!
    if (this.bus && this.bus.body) {
      this.bus.body.setVelocity(0, 0);
      this.bus.body.enable = false;
    }

    // Stop all spawning
    for (const event of this.spawnEvents) {
      if (event) this.time.removeEvent(event);
    }
    this.spawnEvents = [];
    this.time.removeAllEvents();

    for (const char of this.fallingCharacters) {
      if (char && char.destroy) char.destroy();
    }
    this.fallingCharacters = [];

    if (this.tutorialArrow) {
      this.tutorialArrow.destroy();
      this.tutorialArrow = null;
    }
    if (this.tutorialContainer) {
      this.tutorialContainer.destroy();
      this.tutorialContainer = null;
    }

    if (victory) {
      this._showJerusalemEntranceCutscene();
    } else {
      const message = `תפסת ${this.caughtCount} מתוך ${CATCH_TARGET} אנשים`;
      showGameOverHelper(this, "שגעת!", message);
    }
  }

  /**
   * Jerusalem Entrance Cutscene:
   * 1. Bus centers smoothly on screen.
   * 2. Jerusalem Entrance landmark building scrolls into view on the right.
   * 3. Bus drives forward through the gate and off-screen right to Jerusalem!
   */
  _showJerusalemEntranceCutscene() {
    const { width } = this.scale;
    const s = this.s;

    // Step 1. Center the bus smoothly on screen first
    this.tweens.add({
      targets: this.bus,
      x: width / 2,
      duration: 700,
      ease: 'Power1.easeInOut',
      onComplete: () => {
        // Step 2. Build Jerusalem City Entrance Landmark Graphic off-screen right
        const gateContainer = this.add.container(width + 200 * s, this.roadTop - 70 * s).setDepth(100);

        const gateGfx = this.add.graphics();
        const w = 140 * s;
        const h = 130 * s;

        // Jerusalem stone wall structure
        gateGfx.fillStyle(0xe6d5b8, 1);
        gateGfx.fillRect(0, 0, w, h);
        gateGfx.lineStyle(2 * s, 0xcfb99c, 1);
        gateGfx.strokeRect(0, 0, w, h);

        // Archway entrance
        gateGfx.fillStyle(0x1a1a2e, 1);
        gateGfx.fillRect(25 * s, 45 * s, 90 * s, 85 * s);

        // Welcome Signboard
        gateGfx.fillStyle(0x0284c7, 1);
        gateGfx.fillRect(10 * s, 10 * s, 120 * s, 26 * s);

        const signText = this.add.text(70 * s, 23 * s, 'ברוכים הבאים לירושלים 🇮🇱', {
          fontFamily: 'Arial, sans-serif',
          fontSize: `${Math.max(10, Math.round(11 * s))}px`,
          fontWeight: 'bold',
          color: '#ffffff',
        }).setOrigin(0.5, 0.5);

        gateContainer.add([gateGfx, signText]);

        // Scroll Jerusalem Entrance landmark into view
        this.tweens.add({
          targets: gateContainer,
          x: width - 130 * s,
          duration: 1000,
          ease: 'Quad.easeOut',
          onComplete: () => {
            // Step 3. Bus drives forward from center through the archway off-screen right to Jerusalem!
            this.tweens.add({
              targets: this.bus,
              x: width + 120 * s,
              duration: 1600,
              ease: 'Power1.easeIn',
              onComplete: () => {
                // Bus arrives at Jerusalem — show victory screen and transition!
                const message = `כל הכבוד! תפסת ${this.caughtCount} אנשים, יש ייצוג הולם לכולם והגעתם בשלום לירושלים!`;
                showVictoryHelper(this, "Day4Scene", "הגענו לירושלים!", message);
              }
            });
          }
        });
      }
    });
  }
}

