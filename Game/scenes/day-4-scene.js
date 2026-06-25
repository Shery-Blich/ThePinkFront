import Phaser from "phaser";
import { startSceneMusic } from "../systems/bg-music.js";

/**
 * Day4Scene — Cutscene: bus ride from Kiryat Shmona to Jerusalem.
 *
 * Picks up exactly where Day3 ends:
 *   - Egged bus enters from the left (same sprite as Day3)
 *   - Parallax desert/Judean-hills landscape scrolls past
 *   - Jerusalem road-sign flies through (~3s)
 *   - Jerusalem panorama slides in from the right (~5.5s)
 *   - Bus brakes to a stop, doors open
 *   - Player (Shlomi) walks DOWN out of the door — mirror of how they boarded
 *   - "הגעתם לירושלים!" arrival screen → emits 'complete'
 *
 * Music: procedural Web Audio, Hijaaz modal scale on D.
 */
export class Day4Scene extends Phaser.Scene {
  constructor() {
    super({ key: "Day4Scene" });
    this._scrollLayers = [];
    this._midPool = [];
    this._scrollSpeed = 0;
    this._bus = null;
    this._playerImg = null;
    this._busBaseY = 0;
    this._roadY = 0;
    this._roadH = 0;
    this._roadCenterY = 0;
    this._musicNodes = [];
    this._audioCtx = null;
    this._sceneEnded = false;
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.fadeIn(700);
    this._genBackgroundTextures(width, height);
    this._buildScene(width, height);
    startSceneMusic(this, 'bg-day4');
    this._scheduleTimeline(width, height);
    this.events.once("shutdown", () => this._stopMusic());
  }

  update(time, delta) {
    if (this._sceneEnded) return;
    const dt = delta / 1000;
    const dx = this._scrollSpeed * dt;

    for (const layer of this._scrollLayers) {
      layer.sprite.tilePositionX += dx * layer.rate;
    }

    for (const obj of this._midPool) {
      obj.x -= dx * 0.75;
      if (obj.x < -130) obj.x += this.scale.width + 380;
    }

    // Bus bobs while driving
    if (this._bus && this._scrollSpeed > 10) {
      this._bus.y = this._busBaseY + Math.sin(time * 0.006) * 2.2;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Background texture generation
  // ─────────────────────────────────────────────────────────────

  _genBackgroundTextures(width, height) {
    if (!this.textures.exists("bus_hills")) this._genHillTile(width, height);
    if (!this.textures.exists("bus_ground")) this._genGroundTile();
    if (!this.textures.exists("bus_road_tile")) this._genRoadTile(height);
  }

  _genHillTile(width, height) {
    const w = 256;
    const h = Math.round(height * 0.30);
    const g = this.add.graphics();
    g.fillStyle(0xd4a853, 1);
    g.fillRect(0, 0, w, h);
    const layers = [
      {
        c: 0xb8954a,
        shapes: [
          { x: 0,   y: 0.30, w: 90,  h: 0.70 },
          { x: 60,  y: 0.18, w: 110, h: 0.82 },
          { x: 155, y: 0.24, w: 100, h: 0.76 },
        ],
      },
      {
        c: 0xc4a058,
        shapes: [
          { x: 0,   y: 0.45, w: 70, h: 0.55 },
          { x: 50,  y: 0.35, w: 80, h: 0.65 },
          { x: 110, y: 0.40, w: 90, h: 0.60 },
          { x: 185, y: 0.38, w: 71, h: 0.62 },
        ],
      },
    ];
    for (const layer of layers) {
      g.fillStyle(layer.c, 1);
      for (const sh of layer.shapes) {
        g.fillRect(Math.round(sh.x), Math.round(sh.y * h), Math.round(sh.w), Math.round(sh.h * h));
      }
    }
    g.generateTexture("bus_hills", w, h);
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
    const roadH = Math.round(height * 0.20);
    const g = this.add.graphics();
    g.fillStyle(0x3a3a3a, 1);
    g.fillRect(0, 0, 64, roadH);
    g.fillStyle(0x424242, 0.5);
    g.fillRect(8, 5, 4, 2);
    g.fillRect(35, 12, 5, 2);
    g.generateTexture("bus_road_tile", 64, roadH);
    g.destroy();
  }

  // ─────────────────────────────────────────────────────────────
  // Scene construction
  // ─────────────────────────────────────────────────────────────

  _buildScene(width, height) {
    const s = this._scale(height);

    // Sky gradient
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x5ab8e8, 0x5ab8e8, 0xf9e5a0, 0xf9e5a0, 1);
    sky.fillRect(0, 0, width, Math.round(height * 0.62));
    sky.setDepth(0).setScrollFactor(0);

    // Sun
    const sun = this.add.graphics();
    sun.fillStyle(0xffe570, 1);
    sun.fillCircle(Math.round(width * 0.78), Math.round(height * 0.14), Math.round(height * 0.065));
    sun.fillStyle(0xfff0aa, 0.35);
    sun.fillCircle(Math.round(width * 0.78), Math.round(height * 0.14), Math.round(height * 0.11));
    sun.setDepth(1).setScrollFactor(0);

    // Far hills
    const hillH = Math.round(height * 0.30);
    const hillY = Math.round(height * 0.36);
    const hillSprite = this.add.tileSprite(0, hillY, width, hillH, "bus_hills");
    hillSprite.setOrigin(0, 0).setDepth(2).setScrollFactor(0);
    this._scrollLayers.push({ sprite: hillSprite, rate: 0.09 });

    // Ground
    const groundY = Math.round(height * 0.60);
    const groundSprite = this.add.tileSprite(0, groundY, width, height - groundY, "bus_ground");
    groundSprite.setOrigin(0, 0).setDepth(3).setScrollFactor(0);
    this._scrollLayers.push({ sprite: groundSprite, rate: 0.6 });

    // Road
    const roadH = Math.round(height * 0.20);
    const roadY = Math.round(height * 0.63);
    this._roadY = roadY;
    this._roadH = roadH;
    this._roadCenterY = roadY + roadH / 2;

    // Road depth 7 — above the Jerusalem panorama container (depth 6) so the road
    // stays visible all the way to the right edge when Jerusalem slides in.
    const roadSprite = this.add.tileSprite(0, roadY, width, roadH, "bus_road_tile");
    roadSprite.setOrigin(0, 0).setDepth(7).setScrollFactor(0);
    this._scrollLayers.push({ sprite: roadSprite, rate: 1.0 });

    // Road edge lines
    const edges = this.add.graphics();
    edges.fillStyle(0xffffff, 0.85);
    edges.fillRect(0, roadY, width, Math.round(height * 0.005));
    edges.fillRect(0, roadY + roadH - Math.round(height * 0.005), width, Math.round(height * 0.005));
    edges.setDepth(7).setScrollFactor(0);

    // Road centre dashes (reuse BootScene road_line)
    if (this.textures.exists("road_line")) {
      const dashSprite = this.add.tileSprite(0, roadY + roadH / 2, width, Math.round(height * 0.008), "road_line");
      dashSprite.setOrigin(0, 0.5).setDepth(7).setScrollFactor(0).setAlpha(0.65);
      this._scrollLayers.push({ sprite: dashSprite, rate: 3.0 });
    }

    // Mid-pool roadside objects
    this._buildMidPool(width, height, roadY, roadH);

    // Egged bus — starts just off the left edge, enters during timeline
    this._busBaseY = this._roadCenterY;
    this._bus = this.add.image(-80 * s, this._busBaseY, "egged_bus");
    this._bus.setScale(s).setDepth(8).setScrollFactor(0);
  }

  _buildMidPool(width, height, roadY, roadH) {
    let seed = 91;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    for (let i = 0; i < 10; i++) {
      const x = (width / 10) * i + rand() * 60;
      const side = i % 2;
      const y = side === 0
        ? roadY - Math.round(height * 0.03) - rand() * height * 0.04
        : roadY + roadH + Math.round(height * 0.01) + rand() * height * 0.03;
      const type = Math.floor(rand() * 3);
      const obj = this._drawRoadsideObject(x, y, height, type);
      obj.setDepth(side === 0 ? 6 : 9).setScrollFactor(0);
      this._midPool.push(obj);
    }
  }

  _drawRoadsideObject(x, y, height, type) {
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
      g.fillStyle(0xb0a080, 0.6);
      g.fillEllipse(-u * 0.3, -u * 0.3, u * 1.5, u * 1.0);
    } else {
      g.fillStyle(0x3a6a20, 1);
      g.fillTriangle(-u * 0.7, u * 0.1, u * 0.7, u * 0.1, 0, -u * 2.5);
      g.fillStyle(0x4a7a28, 1);
      g.fillTriangle(-u * 0.5, -u * 0.8, u * 0.5, -u * 0.8, 0, -u * 3.2);
      g.fillStyle(0x2a4a18, 1);
      g.fillRect(-u * 0.18, u * 0.1, u * 0.36, u * 0.8);
    }
    return g;
  }

  // ─────────────────────────────────────────────────────────────
  // Signpost
  // ─────────────────────────────────────────────────────────────

  _spawnSignpost(height) {
    const { width } = this.scale;
    const s = this._scale(height);
    const container = this.add.container(width + 80, this._roadY - Math.round(8 * s));
    container.setDepth(7).setScrollFactor(0);

    const g = this.add.graphics();
    const poleH = Math.round(62 * s);
    const poleW = Math.round(4 * s);

    g.fillStyle(0x666666, 1);
    g.fillRect(-poleW / 2, -poleH, poleW, poleH);
    g.fillStyle(0x888888, 1);
    g.fillRect(-poleW / 2, -poleH, poleW * 0.4, poleH);

    const sw = Math.round(130 * s);
    const sh = Math.round(52 * s);
    const sx = -sw / 2;
    const sy = -poleH;

    g.fillStyle(0x0a5c0a, 1);
    g.fillRect(sx, sy, sw, sh);
    g.lineStyle(Math.max(1, Math.round(2 * s)), 0xffffff, 1);
    g.strokeRect(sx, sy, sw, sh);
    g.lineStyle(1, 0xffffff, 0.4);
    g.strokeRect(sx + 3, sy + 3, sw - 6, sh - 6);

    const arrowBaseX = sx + sw - Math.round(22 * s);
    const arrowMidY = sy + sh / 2;
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(
      arrowBaseX, arrowMidY - Math.round(7 * s),
      arrowBaseX + Math.round(16 * s), arrowMidY,
      arrowBaseX, arrowMidY + Math.round(7 * s)
    );

    container.add(g);

    const mkText = (str, yOff, size, color = "#ffffff") =>
      this.add.text(Math.round(-sw / 2 + 8 * s), sy + Math.round(yOff * s), str, {
        fontFamily: "system-ui, -apple-system, Arial, sans-serif",
        fontSize: `${Math.round(size * s)}px`,
        color,
        align: "left",
      });

    container.add([
      mkText("ירושלים", 6,  14),
      mkText("القدس",  23, 11, "#f5f0cc"),
      mkText("Jerusalem", 37, 9, "#cccccc"),
      this.add.text(sx + Math.round(6 * s), sy + sh + Math.round(3 * s), '48 ק"מ', {
        fontFamily: "system-ui, sans-serif",
        fontSize: `${Math.round(8 * s)}px`,
        color: "#eeeeaa",
      }),
    ]);

    this.tweens.add({ targets: container, x: -250, duration: 2500, ease: "Linear" });
  }

  // ─────────────────────────────────────────────────────────────
  // Jerusalem panorama
  // ─────────────────────────────────────────────────────────────

  _showJerusalem(height) {
    const { width } = this.scale;
    const s = this._scale(height);
    const container = this.add.container(width + 60, 0);
    container.setDepth(6).setScrollFactor(0);

    const g = this.add.graphics();
    const panW = Math.round(width * 0.58);
    const skyStartY = Math.round(height * 0.10);
    const groundY = Math.round(height * 0.60);
    const panH = groundY - skyStartY;
    const wallTopY = groundY - Math.round(35 * s);

    g.fillGradientStyle(0xf5c842, 0xf5c842, 0xef9a2a, 0xef9a2a, 0.75);
    g.fillRect(0, skyStartY, panW, panH);

    const blds = [
      { xr: 0.02, yr: 0.42, wr: 0.09, hr: 0.38, c: 0xf0e0c0 },
      { xr: 0.09, yr: 0.30, wr: 0.11, hr: 0.50, c: 0xecd8b0 },
      { xr: 0.18, yr: 0.38, wr: 0.10, hr: 0.42, c: 0xf4e8d4 },
      { xr: 0.27, yr: 0.25, wr: 0.13, hr: 0.55, c: 0xe8dcc8 },
      { xr: 0.48, yr: 0.40, wr: 0.09, hr: 0.40, c: 0xf2e6d2 },
      { xr: 0.64, yr: 0.32, wr: 0.11, hr: 0.48, c: 0xe4d8c4 },
      { xr: 0.72, yr: 0.36, wr: 0.09, hr: 0.44, c: 0xf0e4d0 },
      { xr: 0.82, yr: 0.28, wr: 0.12, hr: 0.52, c: 0xecdcc8 },
    ];
    for (const b of blds) {
      const bx = Math.round(b.xr * panW);
      const by = Math.round(skyStartY + b.yr * panH);
      const bw = Math.round(b.wr * panW);
      const bh = Math.round(b.hr * panH);
      g.fillStyle(b.c, 1);
      g.fillRect(bx, by, bw, bh);
      g.fillStyle(0x8888aa, 0.55);
      for (let wy = by + 5; wy < wallTopY - 4; wy += Math.round(9 * s)) {
        for (let wx = bx + 4; wx < bx + bw - 3; wx += Math.round(8 * s)) {
          g.fillRect(wx, wy, Math.round(3 * s), Math.round(4 * s));
        }
      }
    }

    // Old City Walls
    g.fillStyle(0xe8d5a3, 1);
    g.fillRect(0, wallTopY, panW, Math.round(22 * s));
    g.fillStyle(0xd4c090, 1);
    const mW = Math.round(7 * s);
    const mH = Math.round(9 * s);
    for (let mx = 0; mx < panW; mx += mW * 2) {
      g.fillRect(mx, wallTopY - mH, mW, mH);
    }
    g.fillStyle(0x000000, 0.12);
    g.fillRect(0, wallTopY + Math.round(22 * s), panW, Math.round(3 * s));

    // Dome of the Rock
    const domeX = Math.round(panW * 0.37);
    const domeBase = wallTopY - Math.round(68 * s);
    const domeW = Math.round(36 * s);
    const drumH = Math.round(20 * s);
    const domeR = Math.round(20 * s);
    g.fillStyle(0xd8c898, 1);
    g.fillRect(domeX - Math.round(domeW * 0.7), domeBase + drumH, Math.round(domeW * 1.4), Math.round(8 * s));
    g.fillStyle(0xe0d0a0, 1);
    g.fillRect(domeX - domeW / 2, domeBase, domeW, drumH);
    g.lineStyle(1, 0xc4aa80, 1);
    g.strokeRect(domeX - domeW / 2, domeBase, domeW, drumH);
    g.fillStyle(0x3a7abf, 0.7);
    for (let tx = domeX - domeW / 2 + Math.round(3 * s); tx < domeX + domeW / 2 - 3; tx += Math.round(8 * s)) {
      g.fillRect(tx, domeBase + Math.round(3 * s), Math.round(5 * s), Math.round(7 * s));
    }
    g.fillStyle(0xd4a820, 1);
    g.fillCircle(domeX, domeBase, domeR);
    g.fillStyle(0xf0cc38, 0.65);
    g.fillCircle(domeX - Math.round(5 * s), domeBase - Math.round(6 * s), Math.round(9 * s));
    g.fillStyle(0xaa8010, 1);
    g.fillRect(domeX - Math.round(s), domeBase - domeR - Math.round(9 * s), Math.round(2 * s), Math.round(9 * s));
    g.fillCircle(domeX, domeBase - domeR - Math.round(9 * s), Math.round(3 * s));

    // Church tower
    const tX = Math.round(panW * 0.20);
    const tTop = skyStartY + Math.round(panH * 0.12);
    const tW = Math.round(11 * s);
    g.fillStyle(0xd8c8a8, 1);
    g.fillRect(tX - tW / 2, tTop, tW, wallTopY - tTop);
    g.fillStyle(0x888880, 1);
    g.fillRect(tX - 1, tTop - Math.round(11 * s), 2, Math.round(11 * s));
    g.fillRect(tX - Math.round(4 * s), tTop - Math.round(8 * s), Math.round(8 * s), 2);

    // Minaret
    const minX = Math.round(panW * 0.61);
    const minTop = skyStartY + Math.round(panH * 0.08);
    const minW = Math.round(7 * s);
    g.fillStyle(0xd0c8b0, 1);
    g.fillRect(minX - minW / 2, minTop, minW, wallTopY - minTop);
    g.fillStyle(0xb0a888, 1);
    g.fillCircle(minX, minTop, Math.round(4.5 * s));

    // Olive trees
    for (let ot = 0; ot < 6; ot++) {
      const tx = Math.round((0.04 + ot * 0.16) * panW);
      const ty = wallTopY - Math.round(12 * s);
      g.fillStyle(0x5a4a30, 1);
      g.fillRect(tx - 1, ty, 2, Math.round(12 * s));
      g.fillStyle(0x4a6a30, 1);
      g.fillEllipse(tx, ty - Math.round(5 * s), Math.round(18 * s), Math.round(14 * s));
      g.fillStyle(0x3a5a22, 0.7);
      g.fillEllipse(tx + Math.round(4 * s), ty - Math.round(7 * s), Math.round(12 * s), Math.round(10 * s));
    }

    g.fillStyle(0xd4a853, 1);
    g.fillRect(0, groundY, panW, height - groundY);

    container.add(g);
    this.tweens.add({ targets: container, x: width - panW, duration: 1800, ease: "Cubic.easeOut" });
  }

  // ─────────────────────────────────────────────────────────────
  // Timeline
  // ─────────────────────────────────────────────────────────────

  _scheduleTimeline(width, height) {
    const s = this._scale(height);

    // Phase 1: Bus drives in from left
    this.tweens.add({
      targets: this._bus,
      x: Math.round(width * 0.38),
      duration: 1400,
      ease: "Quad.easeOut",
      onComplete: () => {
        // Bus settled → start scrolling
        this.tweens.add({
          targets: this,
          _scrollSpeed: 320,
          duration: 500,
          ease: "Quad.easeIn",
        });
      },
    });

    // Signpost at t=3s
    this.time.delayedCall(3000, () => {
      if (!this._sceneEnded) this._spawnSignpost(height);
    });

    // Jerusalem + brakes at t=5.5s
    this.time.delayedCall(5500, () => {
      if (!this._sceneEnded) {
        this._showJerusalem(height);
        this.tweens.add({
          targets: this,
          _scrollSpeed: 0,
          duration: 2000,
          ease: "Cubic.easeOut",
        });
      }
    });

    // Bus stopped → doors open + player exits at t=8.5s
    this.time.delayedCall(8500, () => {
      if (!this._sceneEnded) this._playerExitsBus(width, height, s);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Player exits the bus (reverse of Day3 boarding)
  // ─────────────────────────────────────────────────────────────

  _playerExitsBus(width, height, s) {
    const busX = this._bus.x;
    // Door is 24*s to the right of bus centre (matches Day3's doorX = bus.x + 24*s)
    const doorX = busX + 24 * s;
    // Door floor is 6*s below bus centre (matches Day3's doorY = bus.y + 6*s)
    const doorY = this._busBaseY + 6 * s;
    // Road level where the player will stand after stepping off
    const exitY = this._roadCenterY + 4 * s;

    // Open doors
    this._bus.setTexture("egged_bus_open");

    // Spawn player sprite at the door opening (inside the bus)
    this._playerImg = this.add.image(doorX, doorY, "player");
    const playerH = 20 * s;
    const aspect = this._playerImg.width > 0
      ? this._playerImg.width / this._playerImg.height
      : 0.6;
    this._playerImg.setDisplaySize(playerH * aspect, playerH);
    this._playerImg.setOrigin(0.5, 1); // origin at feet
    this._playerImg.setDepth(this._bus.depth + 1);
    this._playerImg.setScrollFactor(0);

    // Short pause for doors to open, then walk down
    this.time.delayedCall(350, () => {
      // Walk DOWN off the bus step onto the road (exact reverse of Day3's upward boarding tween)
      this.tweens.add({
        targets: this._playerImg,
        y: exitY,
        duration: 1000,
        ease: "Linear",
        onComplete: () => {
          // Close the doors then move on
          this._bus.setTexture("egged_bus");
          this.time.delayedCall(600, () => this._endScene());
        },
      });
    });
  }

  _endScene() {
    if (this._sceneEnded) return;
    this._sceneEnded = true;
    this._stopMusic();
    this.events.emit("complete");
  }

  // ─────────────────────────────────────────────────────────────
  // Music (Web Audio — Hijaaz modal scale on D)
  // ─────────────────────────────────────────────────────────────

  _startMusic() {
    try {
      const ctx = this.sound.context;
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      this._audioCtx = ctx;
      this._scheduleMusic(ctx);
    } catch (_) {}
  }

  _scheduleMusic(ctx) {
    const hz = {
      D3: 146.83, Eb3: 155.56, Fs3: 184.99, G3: 196.00,
      A3: 220.00, Bb3: 233.08, C4: 261.63, D4: 293.66,
      Eb4: 311.13, Fs4: 369.99, G4: 392.00, A4: 440.00,
    };

    const melody = [
      [hz.D4, 0.35], [hz.Eb4, 0.20], [hz.Fs4, 0.40], [hz.G4, 0.20],
      [hz.A4, 0.40], [hz.G4, 0.20], [hz.Fs4, 0.40], [hz.Eb4, 0.20],
      [hz.D4, 0.80],
      [hz.D4, 0.30], [hz.C4, 0.20], [hz.Bb3, 0.40], [hz.A3, 0.40],
      [hz.G3, 0.35], [hz.A3, 0.20], [hz.Bb3, 0.40], [hz.A3, 0.20],
      [hz.G3, 0.80],
      [hz.Fs3, 0.30], [hz.G3, 0.20], [hz.A3, 0.30], [hz.Bb3, 0.40],
      [hz.A3, 0.35], [hz.G3, 0.20], [hz.Fs3, 0.40], [hz.Eb3, 0.20],
      [hz.D3, 1.20],
    ];

    const playNote = (freq, startT, dur, vol = 0.17) => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filt = ctx.createBiquadFilter();
        osc.type = "triangle";
        osc.frequency.value = freq;
        filt.type = "lowpass";
        filt.frequency.value = Math.min(freq * 4, 4000);
        filt.Q.value = 1.2;
        gain.gain.setValueAtTime(0, startT);
        gain.gain.linearRampToValueAtTime(vol, startT + 0.025);
        gain.gain.setValueAtTime(vol * 0.65, startT + dur * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.0001, startT + dur + 0.06);
        osc.connect(filt);
        filt.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startT);
        osc.stop(startT + dur + 0.12);
        this._musicNodes.push(osc, gain, filt);
      } catch (_) {}
    };

    const melodyDur = melody.reduce((sum, [, d]) => sum + d, 0);
    const now = ctx.currentTime + 0.4;
    for (let rep = 0; rep < 4; rep++) {
      let t = now + rep * melodyDur;
      for (const [freq, dur] of melody) {
        playNote(freq, t, dur * 0.92);
        t += dur;
      }
    }

    try {
      const drone = ctx.createOscillator();
      const droneGain = ctx.createGain();
      const droneFilt = ctx.createBiquadFilter();
      drone.type = "sine";
      drone.frequency.value = hz.D3 / 2;
      droneFilt.type = "lowpass";
      droneFilt.frequency.value = 220;
      droneGain.gain.setValueAtTime(0.07, now);
      drone.connect(droneFilt);
      droneFilt.connect(droneGain);
      droneGain.connect(ctx.destination);
      drone.start(now);
      this._musicNodes.push(drone, droneGain, droneFilt);
    } catch (_) {}
  }

  _stopMusic() {
    try {
      const ctx = this._audioCtx;
      if (!ctx) return;
      const now = ctx.currentTime;
      for (const node of this._musicNodes) {
        try {
          if (node.gain) {
            node.gain.setValueAtTime(node.gain.value || 0.01, now);
            node.gain.linearRampToValueAtTime(0.0001, now + 0.4);
          }
          if (typeof node.stop === "function") node.stop(now + 0.5);
        } catch (_) {}
      }
    } catch (_) {}
    this._musicNodes = [];
  }

  // ─────────────────────────────────────────────────────────────

  _scale(height) {
    return Math.max(1, height / 200);
  }
}
