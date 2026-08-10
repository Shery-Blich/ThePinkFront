import Phaser from "phaser";
import { Player } from "../entities/player.js";
import {
  showVictoryHelper,
  showGameOverHelper,
} from "../systems/level-ui-helper.js";
import { LivesManager } from "../systems/lives-manager.js";
import { addGlobalScore } from "../systems/score-manager.js";

// Preloaded in boot-scene.js from assets/Characters/
const CHARACTER_KEYS = [
  "cashier-character",
  "npc-yuval",
  "npc-shiri",
  "judge-portrait",
  "nassi-1",
  "nassi-2",
];

export class Day5Scene extends Phaser.Scene {
  constructor() {
    super({ key: "Day5Scene" });

    this._scrollLayers = [];
    this._midPool = [];
    this._scrollSpeed = 160;

    this._cats = [];
    this._score = 0;
    this._lastColors = [];
    this._TARGET = 5;
    this._gameActive = false;
    this._sceneEnded = false;

    /** @type {Player} */
    this._player = null;
    this._basketGfx = null;
    this._basketW = 0;
    this._basketH = 0;
    this._roadY = 0;
    this._roadH = 0;
    this._scoreText = null;
    this._livesText = null;
    this._speedText = null;

    // Tap-combo speed boost
    this._baseSpeed = 0;
    this._tapCombo = 0;
    this._lastTapTime = 0;
    this._comboDecayTimer = null;
  }

  /**
   * Lazy-loads audio assets exclusive to Day 5 (cat-catching mini-game).
   * Only downloads assets the first time this scene is entered.
   */
  preload() {
    // ── Character portraits used in the Day 5 cat-catching scene ──
    const portraits = [
      ['cashier-character', 'assets/Characters/kupaee.webp'],
      ['npc-yuval',         'assets/Characters/Yuval.webp'],
      ['npc-shiri',         'assets/Characters/Shiri.webp'],
      ['judge-portrait',    'assets/Characters/Judge.webp'],
      ['nassi-1',           'assets/Characters/Nassi-1.webp'],
      ['nassi-2',           'assets/Characters/Nassi-2.webp'],
    ];
    portraits.forEach(([key, path]) => {
      if (!this.textures.exists(key)) this.load.image(key, path);
    });
    // ── Audio ──
    if (!this.cache.audio.exists('sfx-meow')) {
      this.load.audio('sfx-meow', 'assets/sounds/meow.mp3');
    }
    if (!this.cache.audio.exists('sfx-catbag')) {
      this.load.audio('sfx-catbag', 'assets/sounds/cat-in-a-bag.mp3');
    }
  }

  create() {
    this._score = 0;
    this._cats = [];
    this._gameActive = false;
    this._sceneEnded = false;
    this._scrollLayers = [];
    this._midPool = [];
    const { width, height } = this.scale;
    this._genTextures(width, height);
    this._buildBackground(width, height);
    this._buildPlayer(width, height);
    this._createHUD(width, height);
    this._showIntro(width, height);

    this.events.once("shutdown", () => {
      if (typeof window.hideHUD === "function") {
        window.hideHUD("html-stats-hud");
        window.hideHUD("html-lives-hud");
        window.hideHUD("html-speed-hud");
      }
    });
  }

  update(_time, delta) {
    if (this._sceneEnded) return;
    const dt = delta / 1000;

    for (const layer of this._scrollLayers) {
      layer.sprite.tilePositionX += this._scrollSpeed * dt * layer.rate;
    }
    for (const obj of this._midPool) {
      obj.x -= this._scrollSpeed * dt * 0.75;
      if (obj.x < -130) obj.x += this.scale.width + 380;
    }

    if (this._player) this._player.update();

    // Basket tracks player hand position every frame
    if (this._basketGfx && this._player) {
      const s = this._s(this.scale.height);
      this._basketGfx.x = this._player.x;
      this._basketGfx.y = this._player.y - Math.round(3 * s);
    }

    if (this._gameActive) this._updateCats(dt);
  }

  // ─── Texture generation ───────────────────────────────────────

  _genTextures(width, height) {
    if (!this.textures.exists("bus_hills")) this._genHillTile(width, height);
    if (!this.textures.exists("bus_ground")) this._genGroundTile();
    if (!this.textures.exists("bus_road_tile")) this._genRoadTile(height);
  }

  _genHillTile(width, height) {
    const h = Math.round(height * 0.3);
    const g = this.add.graphics();
    g.fillStyle(0xd4a853, 1);
    g.fillRect(0, 0, 256, h);
    const layers = [
      {
        c: 0xb8954a,
        shapes: [
          { x: 0, y: 0.3, w: 90, hh: 0.7 },
          { x: 60, y: 0.18, w: 110, hh: 0.82 },
          { x: 155, y: 0.24, w: 100, hh: 0.76 },
        ],
      },
      {
        c: 0xc4a058,
        shapes: [
          { x: 0, y: 0.45, w: 70, hh: 0.55 },
          { x: 50, y: 0.35, w: 80, hh: 0.65 },
          { x: 110, y: 0.4, w: 90, hh: 0.6 },
          { x: 185, y: 0.38, w: 71, hh: 0.62 },
        ],
      },
    ];
    for (const layer of layers) {
      g.fillStyle(layer.c, 1);
      for (const sh of layer.shapes)
        g.fillRect(
          Math.round(sh.x),
          Math.round(sh.y * h),
          Math.round(sh.w),
          Math.round(sh.hh * h),
        );
    }
    g.generateTexture("bus_hills", 256, h);
    g.destroy();
  }

  _genGroundTile() {
    const g = this.add.graphics();
    g.fillStyle(0xd4a853, 1);
    g.fillRect(0, 0, 64, 16);
    g.fillStyle(0xc09040, 0.5);
    g.fillRect(5, 4, 3, 2);
    g.fillRect(22, 9, 4, 2);
    g.fillRect(40, 5, 3, 3);
    g.fillRect(54, 11, 4, 2);
    g.generateTexture("bus_ground", 64, 16);
    g.destroy();
  }

  _genRoadTile(height) {
    const roadH = Math.round(height * 0.2);
    const g = this.add.graphics();
    g.fillStyle(0x3a3a3a, 1);
    g.fillRect(0, 0, 64, roadH);
    g.fillStyle(0x424242, 0.5);
    g.fillRect(8, 5, 4, 2);
    g.fillRect(35, 12, 5, 2);
    g.generateTexture("bus_road_tile", 64, roadH);
    g.destroy();
  }

  // ─── Background ───────────────────────────────────────────────

  _buildBackground(width, height) {
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x5ab8e8, 0x5ab8e8, 0xf9e5a0, 0xf9e5a0, 1);
    sky.fillRect(0, 0, width, Math.round(height * 0.62));
    sky.setDepth(0).setScrollFactor(0);

    const sun = this.add.graphics();
    sun.fillStyle(0xfff0aa, 0.35);
    sun.fillCircle(
      Math.round(width * 0.78),
      Math.round(height * 0.14),
      Math.round(height * 0.11),
    );
    sun.fillStyle(0xffe570, 1);
    sun.fillCircle(
      Math.round(width * 0.78),
      Math.round(height * 0.14),
      Math.round(height * 0.065),
    );
    sun.setDepth(1).setScrollFactor(0);

    const hillH = Math.round(height * 0.3);
    const hillY = Math.round(height * 0.36);
    const hillSprite = this.add.tileSprite(0, hillY, width, hillH, "bus_hills");
    hillSprite.setOrigin(0, 0).setDepth(2).setScrollFactor(0);
    this._scrollLayers.push({ sprite: hillSprite, rate: 0.09 });

    const groundY = Math.round(height * 0.6);
    const groundSprite = this.add.tileSprite(
      0,
      groundY,
      width,
      height - groundY,
      "bus_ground",
    );
    groundSprite.setOrigin(0, 0).setDepth(3).setScrollFactor(0);
    this._scrollLayers.push({ sprite: groundSprite, rate: 0.6 });

    const roadH = Math.round(height * 0.2);
    const roadY = Math.round(height * 0.63);
    this._roadY = roadY;
    this._roadH = roadH;

    const roadSprite = this.add.tileSprite(
      0,
      roadY,
      width,
      roadH,
      "bus_road_tile",
    );
    roadSprite.setOrigin(0, 0).setDepth(7).setScrollFactor(0);
    this._scrollLayers.push({ sprite: roadSprite, rate: 1.0 });

    const edges = this.add.graphics();
    edges.fillStyle(0xffffff, 0.85);
    edges.fillRect(0, roadY, width, Math.round(height * 0.005));
    edges.fillRect(
      0,
      roadY + roadH - Math.round(height * 0.005),
      width,
      Math.round(height * 0.005),
    );
    edges.setDepth(7).setScrollFactor(0);

    if (this.textures.exists("road_line")) {
      const dash = this.add.tileSprite(
        0,
        roadY + roadH / 2,
        width,
        Math.round(height * 0.008),
        "road_line",
      );
      dash.setOrigin(0, 0.5).setDepth(7).setScrollFactor(0).setAlpha(0.65);
      this._scrollLayers.push({ sprite: dash, rate: 3.0 });
    }

    this._buildMidPool(width, height, roadY, roadH);
  }

  _buildMidPool(width, height, roadY, roadH) {
    let seed = 73;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 10; i++) {
      const x = (width / 10) * i + rand() * 60;
      const side = i % 2;
      const y =
        side === 0
          ? roadY - Math.round(height * 0.03) - rand() * height * 0.04
          : roadY + roadH + Math.round(height * 0.01) + rand() * height * 0.03;
      const type = Math.floor(rand() * 3);
      const obj = this._drawRoadsideObj(x, y, height, type);
      obj.setDepth(side === 0 ? 6 : 9).setScrollFactor(0);
      this._midPool.push(obj);
    }
  }

  _drawRoadsideObj(x, y, height, type) {
    const g = this.add.graphics();
    const u = height * 0.025;
    g.x = x;
    g.y = y;
    if (type === 0) {
      g.fillStyle(0x6a8a30, 1);
      g.fillEllipse(0, 0, u * 2.6, u * 1.6);
      g.fillStyle(0x4a6a22, 1);
      g.fillEllipse(u * 0.7, -u * 0.4, u * 1.8, u * 1.2);
    } else if (type === 1) {
      g.fillStyle(0x9a8a70, 1);
      g.fillEllipse(0, 0, u * 2.8, u * 1.8);
    } else {
      g.fillStyle(0x3a6a20, 1);
      g.fillTriangle(-u * 0.7, u * 0.1, u * 0.7, u * 0.1, 0, -u * 2.5);
      g.fillStyle(0x2a4a18, 1);
      g.fillRect(-u * 0.18, u * 0.1, u * 0.36, u * 0.8);
    }
    return g;
  }

  // ─── Player + basket ─────────────────────────────────────────

  _buildPlayer(width, height) {
    const s = this._s(height);

    // Start in the middle of the road
    const startX = width / 2;
    const startY = this._roadY + Math.round(this._roadH * 0.45);

    this._player = new Player(this, startX, startY, s);
    // Constrain to road band, full width
    this._player.setWorldBounds(0, this._roadY, width, this._roadH);
    this._player.setDepth(10);
    // High base speed for this catch game
    this._player.movement.config.speed = this._player.baseSpeed * 6;
    this._baseSpeed = this._player.movement.config.speed;
    // Joystick stays disabled until intro finishes

    // Basket dimensions — opening at top (y = 0 local), body hangs down
    this._basketW = Math.round(42 * s);
    this._basketH = Math.round(22 * s);

    // Draw basket once in local coords: (0,0) = opening centre (hand level)
    this._basketGfx = this.add.graphics();
    this._basketGfx.x = startX;
    // Hand level: slightly above player centre
    this._basketGfx.y = startY - Math.round(3 * s);
    this._drawBasket(s);
    this._basketGfx.setDepth(11).setScrollFactor(0);
  }

  _drawBasket(s) {
    const g = this._basketGfx;
    const bw = this._basketW;
    const bh = this._basketH;

    g.clear();

    // Body — opening at local y=0, extends downward
    g.fillStyle(0x8b5a2b, 1);
    g.fillRect(-bw / 2, 0, bw, bh);

    // Weave — vertical strips
    g.fillStyle(0x6b3a1f, 0.45);
    for (
      let x = -bw / 2 + Math.round(3 * s);
      x < bw / 2 - 2;
      x += Math.round(6 * s)
    ) {
      g.fillRect(x, 2, Math.round(2 * s), bh - 4);
    }
    // Weave — horizontal strips
    for (let y = 2; y < bh - 2; y += Math.round(5 * s)) {
      g.fillRect(-bw / 2 + 2, y, bw - 4, Math.round(2 * s));
    }

    // Rim at opening
    g.fillStyle(0xaa7744, 1);
    g.fillRect(-bw / 2 - 2, -Math.round(3 * s), bw + 4, Math.round(5 * s));

    // Handle arc (curves up above the opening)
    g.lineStyle(Math.max(1, Math.round(2 * s)), 0x6b3a1f, 1);
    g.beginPath();
    g.arc(0, 0, bw * 0.42, Math.PI, 0, false);
    g.strokePath();
  }

  // ─── Intro ────────────────────────────────────────────────────

  _showIntro(width, height) {
    const t = this.add.text(width / 2, height / 2, "תפסו את הדמויות", {
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: `${Math.round(height * 0.075)}px`,
      fontWeight: "900",
      color: "#ffd700",
      stroke: "#000000",
      strokeThickness: Math.round(height * 0.012),
      align: "center",
    });
    t.setOrigin(0.5).setDepth(5000).setScrollFactor(0);

    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 1600,
      duration: 500,
      onComplete: () => {
        t.destroy();
        this._player.enable();
        this._gameActive = true;
        this._setupTapBoost();
        this._startSpawning(width, height);
      },
    });
  }

  // ─── Spawning ─────────────────────────────────────────────────

  _startSpawning(width, height) {
    const spawn = () => {
      if (this._sceneEnded || !this._gameActive) return;
      this._spawnCat(width, height);
      const delay = Math.max(450, 1600 - this._score * 90);
      this.time.delayedCall(delay, spawn);
    };
    this.time.delayedCall(300, spawn);
  }

  _spawnCat(width, height) {
    const s = this._s(height);
    const x = Phaser.Math.Between(
      Math.round(width * 0.05),
      Math.round(width * 0.95),
    );
    const key =
      CHARACTER_KEYS[Phaser.Math.Between(0, CHARACTER_KEYS.length - 1)];
    const size = Math.round(26 * s);
    const img = this.add.image(x, -Math.round(22 * s), key);
    img.setDisplaySize(size, size).setDepth(15).setScrollFactor(0);

    const baseVy = (90 + this._score * 10) * s;
    const vy = Phaser.Math.FloatBetween(baseVy * 0.8, baseVy * 1.2);
    const vx = Phaser.Math.FloatBetween(-28, 28) * s;

    this.tweens.add({
      targets: img,
      angle: Phaser.Math.Between(-25, 25),
      duration: Phaser.Math.Between(500, 1100),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this._cats.push({ img, vy, vx });
  }

  // ─── Cat update ───────────────────────────────────────────────

  _updateCats(dt) {
    const { width, height } = this.scale;
    const s = this._s(height);

    // Basket opening is at basketGfx world position (local y=0)
    const bx = this._basketGfx.x;
    const basketOpenY = this._basketGfx.y; // top of basket (opening)
    const basketBotY = this._basketGfx.y + this._basketH;

    for (let i = this._cats.length - 1; i >= 0; i--) {
      const cat = this._cats[i];

      cat.img.x += cat.vx * dt;
      cat.img.y += cat.vy * dt;

      if (cat.img.x < 6 || cat.img.x > width - 6) {
        cat.vx *= -1;
        cat.img.x = Phaser.Math.Clamp(cat.img.x, 6, width - 6);
      }

      const cx = cat.img.x;
      const cy = cat.img.y;

      // Catch: cat passes through basket opening
      if (cy >= basketOpenY - 5 && cy <= basketBotY + 6 * s) {
        if (cx >= bx - this._basketW / 2 && cx <= bx + this._basketW / 2) {
          this._catchCat(i);
          continue;
        }
      }

      if (cy > height + 20 * s) {
        this._missCat(i);
      }
    }
  }

  _catchCat(i) {
    const cat = this._cats[i];
    this.tweens.killTweensOf(cat.img);
    this.tweens.add({
      targets: cat.img,
      alpha: 0,
      scaleX: 1.9,
      scaleY: 1.9,
      duration: 180,
      onComplete: () => cat.img.destroy(),
    });
    const px = this._player ? this._player.x : cat.img.x;
    const py = this._player ? this._player.y : cat.img.y;

    this._cats.splice(i, 1);
    this._score++;
    this._updateHUD();
    this.sound.play("sfx-catbag", { volume: 0.6 });

    // 3 points per item collected
    addGlobalScore(this, 3, px, py);

    // Bonus 5 points for collecting all 5 items
    if (this._score >= this._TARGET) {
      addGlobalScore(this, 5, px, py);
    }

    const color = cat.img.texture.key;
    this._lastColors.push(color);
    if (this._lastColors.length > 3) this._lastColors.shift();
    if (
      this._lastColors.length === 3 &&
      this._lastColors.every((c) => c === color)
    ) {
      this._showReprimand();
      this._lastColors = [];
    }

    if (this._score >= this._TARGET) {
      this.time.delayedCall(400, () => this._endScene());
    }
  }

  _missCat(i) {
    if (LivesManager.getLives() <= 0) return;
    const cat = this._cats[i];
    this.tweens.killTweensOf(cat.img);
    cat.img.destroy();
    this._cats.splice(i, 1);
    
    const remaining = LivesManager.deductLife();
    this.sound.play("sfx-meow", { volume: 0.6 });

    if (this._player) {
      this._player.takeDamage();
    }

    const flash = this.add.graphics();
    flash.fillStyle(0xff2222, 0.28);
    flash.fillRect(0, 0, this.scale.width, this.scale.height);
    flash.setDepth(20000).setScrollFactor(0);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 280,
      onComplete: () => flash.destroy(),
    });

    if (remaining <= 0) this._triggerGameOver();
  }

  // ─── HUD ──────────────────────────────────────────────────────

  _createHUD() {
    LivesManager.showHUD();
    if (typeof window.showHUD === "function") {
      window.showHUD("html-stats-hud", `דמויות: 0 / ${this._TARGET}`);
      window.hideHUD("html-speed-hud");
    }
  }

  _updateHUD() {
    LivesManager.updateHUD();
    if (typeof window.updateHUDText === "function") {
      window.updateHUDText(
        "html-stats-hud",
        `דמויות: ${this._score} / ${this._TARGET}`,
      );
    }
  }

  // ─── Tap-combo speed boost ────────────────────────────────────

  _setupTapBoost() {
    const onTap = () => {
      if (!this._gameActive) return;
      const now = this.time.now;
      this._tapCombo =
        now - this._lastTapTime < 400 ? Math.min(this._tapCombo + 1, 5) : 1;
      this._lastTapTime = now;
      this._applyTapCombo();

      if (this._comboDecayTimer) this._comboDecayTimer.remove();
      this._comboDecayTimer = this.time.delayedCall(500, () => {
        this._tapCombo = 0;
        this._applyTapCombo();
      });
    };

    // Mobile: second finger taps while joystick is held by the first finger
    this.input.on("pointerdown", onTap);

    // Desktop: spacebar acts as the boost tap
    this.input.keyboard?.on("keydown-SPACE", onTap);
  }

  _applyTapCombo() {
    if (!this._player?.movement) return;

    // 1× base → 6× at full combo
    const mult = 1 + (this._tapCombo / 5) * 5;
    this._player.movement.config.speed = Math.round(this._baseSpeed * mult);

    if (this._tapCombo >= 4) this._player.setTint(0xff8800);
    else if (this._tapCombo >= 2) this._player.setTint(0xffdd44);
    else this._player.clearTint();

    if (typeof window.updateHUDText === "function") {
      if (this._tapCombo > 0) {
        const bars = ">>".repeat(this._tapCombo);
        window.showHUD("html-speed-hud", `${bars} x${Math.round(mult * 100)}%`);
      } else {
        window.hideHUD("html-speed-hud");
      }
    }
  }

  // ─── Game over ────────────────────────────────────────────────

  _triggerGameOver() {
    if (this._sceneEnded) return;
    this._gameActive = false;
    this.sound.play("sfx-gameover", { volume: 0.6 });
    if (this._player) this._player.disable();
    for (const cat of this._cats) {
      this.tweens.killTweensOf(cat.img);
      cat.img.destroy();
    }
    this._cats = [];

    showGameOverHelper(
      this,
      "הלכו הלבבות!",
      "פספסת יותר מדי דמויות... עם כמות כזו של פספוסים, אפילו קולות החיילים לא יצילו אותך מאחוז החסימה!",
    );
  }

  // ─── End scene ────────────────────────────────────────────────

  _endScene() {
    if (this._sceneEnded) return;
    this._sceneEnded = true;
    this._gameActive = false;
    if (this._player) this._player.disable();
    for (const cat of this._cats) {
      this.tweens.killTweensOf(cat.img);
      cat.img.destroy();
    }
    this._cats = [];
    this.cameras.main.fade(700, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      showVictoryHelper(
        this,
        "Day5Scene",
        "השלב הושלם!",
        "הצלחתם למצוא את כל הדמויות המסתתרות בירושלים!",
      );
    });
  }

  _showReprimand() {
    const { width, height } = this.scale;
    const txt = this.add.text(
      width / 2,
      height / 2,
      "אי אפשר שכולם יראו אותו הדבר \nהחוק דורש ייצוג הולם!",
      {
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: `${Math.round(height * 0.055)}px`,
        fontWeight: "900",
        color: "#ff2a5f",
        stroke: "#000000",
        strokeThickness: Math.round(height * 0.01),
        align: "center",
      },
    );
    txt.setOrigin(0.5).setDepth(5000).setScrollFactor(0);
    this.tweens.add({
      targets: txt,
      alpha: 0,
      delay: 2200,
      duration: 400,
      onComplete: () => txt.destroy(),
    });
  }

  _s(height) {
    return Math.max(1, height / 200);
  }
}
