import Phaser from 'phaser';

/**
 * Day4Scene — Cutscene: bus ride from Kiryat Shmona to Jerusalem.
 *
 * Parallax landscape scrolls right-to-left; bus bobs on road.
 * Signpost (ירושלים / القدس) scrolls through at ~7s.
 * Jerusalem panorama slides in from right at ~13s.
 * Procedural music via Web Audio (Hijaaz modal scale).
 */
export class Day4Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Day4Scene' });
    this._scrollLayers = [];
    this._midPool = [];
    this._scrollSpeed = 105;
    this._busContainer = null;
    this._busBaseY = 0;
    this._roadY = 0;
    this._roadH = 0;
    this._musicNodes = [];
    this._audioCtx = null;
    this._sceneEnded = false;
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.fadeIn(900);
    this._genTextures(width, height);
    this._buildScene(width, height);
    this._startMusic();
    this._scheduleTimeline(width, height);
    this.events.once('shutdown', () => this._stopMusic());
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

    if (this._busContainer) {
      this._busContainer.y = this._busBaseY + Math.sin(time * 0.006) * 2.2;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Texture generation
  // ─────────────────────────────────────────────────────────────

  _genTextures(width, height) {
    if (!this.textures.exists('bus_hills')) this._genHillTile(width, height);
    if (!this.textures.exists('bus_ground')) this._genGroundTile();
    if (!this.textures.exists('bus_road_tile')) this._genRoadTile(height);
  }

  _genHillTile(width, height) {
    const w = 256;
    const h = Math.round(height * 0.30);
    const g = this.add.graphics();
    // Base sand
    g.fillStyle(0xd4a853, 1);
    g.fillRect(0, 0, w, h);
    // Layered Judean hill silhouettes
    const layers = [
      { c: 0xb8954a, shapes: [{ x: 0, y: 0.30, w: 90, h: 0.70 }, { x: 60, y: 0.18, w: 110, h: 0.82 }, { x: 155, y: 0.24, w: 100, h: 0.76 }] },
      { c: 0xc4a058, shapes: [{ x: 0, y: 0.45, w: 70, h: 0.55 }, { x: 50, y: 0.35, w: 80, h: 0.65 }, { x: 110, y: 0.40, w: 90, h: 0.60 }, { x: 185, y: 0.38, w: 71, h: 0.62 }] },
    ];
    for (const layer of layers) {
      g.fillStyle(layer.c, 1);
      for (const sh of layer.shapes) {
        g.fillRect(Math.round(sh.x), Math.round(sh.y * h), Math.round(sh.w), Math.round(sh.h * h));
      }
    }
    g.generateTexture('bus_hills', w, h);
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
    g.generateTexture('bus_ground', 64, 16);
    g.destroy();
  }

  _genRoadTile(height) {
    const roadH = Math.round(height * 0.20);
    const g = this.add.graphics();
    g.fillStyle(0x3a3a3a, 1);
    g.fillRect(0, 0, 64, roadH);
    // Pavement texture
    g.fillStyle(0x424242, 0.5);
    g.fillRect(8, 5, 4, 2);
    g.fillRect(35, 12, 5, 2);
    g.generateTexture('bus_road_tile', 64, roadH);
    g.destroy();
  }

  // ─────────────────────────────────────────────────────────────
  // Scene construction
  // ─────────────────────────────────────────────────────────────

  _buildScene(width, height) {
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

    // Far hills tileSprite
    const hillH = Math.round(height * 0.30);
    const hillY = Math.round(height * 0.36);
    const hillSprite = this.add.tileSprite(0, hillY, width, hillH, 'bus_hills');
    hillSprite.setOrigin(0, 0).setDepth(2).setScrollFactor(0);
    this._scrollLayers.push({ sprite: hillSprite, rate: 0.09 });

    // Ground tileSprite
    const groundY = Math.round(height * 0.60);
    const groundSprite = this.add.tileSprite(0, groundY, width, height - groundY, 'bus_ground');
    groundSprite.setOrigin(0, 0).setDepth(3).setScrollFactor(0);
    this._scrollLayers.push({ sprite: groundSprite, rate: 0.6 });

    // Road
    const roadH = Math.round(height * 0.20);
    const roadY = Math.round(height * 0.63);
    this._roadY = roadY;
    this._roadH = roadH;

    const roadSprite = this.add.tileSprite(0, roadY, width, roadH, 'bus_road_tile');
    roadSprite.setOrigin(0, 0).setDepth(4).setScrollFactor(0);
    this._scrollLayers.push({ sprite: roadSprite, rate: 1.0 });

    // Road edge stripes
    const edges = this.add.graphics();
    edges.fillStyle(0xffffff, 0.85);
    edges.fillRect(0, roadY, width, Math.round(height * 0.005));
    edges.fillRect(0, roadY + roadH - Math.round(height * 0.005), width, Math.round(height * 0.005));
    edges.setDepth(5).setScrollFactor(0);

    // Road center dashes — reuse existing road_line from BootScene
    if (this.textures.exists('road_line')) {
      const dashSprite = this.add.tileSprite(0, roadY + roadH / 2, width, Math.round(height * 0.008), 'road_line');
      dashSprite.setOrigin(0, 0.5).setDepth(5).setScrollFactor(0).setAlpha(0.65);
      this._scrollLayers.push({ sprite: dashSprite, rate: 3.0 });
    }

    // Mid-pool roadside objects
    this._buildMidPool(width, height, roadY, roadH);

    // Bus
    const s = this._scale(height);
    const busX = Math.round(width * 0.27);
    const busBaseY = roadY + Math.round(roadH * 0.48);
    this._busBaseY = busBaseY;
    this._busContainer = this._buildBus(busX, busBaseY, s);
  }

  _buildMidPool(width, height, roadY, roadH) {
    let seed = 91;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    for (let i = 0; i < 10; i++) {
      const x = (width / 10) * i + rand() * 60;
      const side = i % 2; // 0 = above road, 1 = below road
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
    const u = height * 0.025; // unit size
    g.x = x;
    g.y = y;

    if (type === 0) {
      // Desert shrub
      g.fillStyle(0x6a8a30, 1);
      g.fillEllipse(0, 0, u * 2.6, u * 1.6);
      g.fillStyle(0x4a6a22, 1);
      g.fillEllipse(u * 0.7, -u * 0.4, u * 1.8, u * 1.2);
    } else if (type === 1) {
      // Rock
      g.fillStyle(0x9a8a70, 1);
      g.fillEllipse(0, 0, u * 2.8, u * 1.8);
      g.fillStyle(0xb0a080, 0.6);
      g.fillEllipse(-u * 0.3, -u * 0.3, u * 1.5, u * 1.0);
    } else {
      // Cypress-like tree (Israeli roadsides)
      g.fillStyle(0x3a6a20, 1);
      g.fillTriangle(-u * 0.7, u * 0.1, u * 0.7, u * 0.1, 0, -u * 2.5);
      g.fillStyle(0x4a7a28, 1);
      g.fillTriangle(-u * 0.5, -u * 0.8, u * 0.5, -u * 0.8, 0, -u * 3.2);
      g.fillStyle(0x2a4a18, 1);
      g.fillRect(-u * 0.18, u * 0.1, u * 0.36, u * 0.8);
    }
    return g;
  }

  _buildBus(x, y, s) {
    const container = this.add.container(x, y);
    container.setDepth(8).setScrollFactor(0);

    const g = this.add.graphics();
    const bw = Math.round(88 * s);
    const bh = Math.round(40 * s);
    const bx = -Math.round(bw / 2);
    const by = -bh;
    const wr = Math.round(7 * s);

    // Shadow
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(0, Math.round(2 * s), bw * 0.9, Math.round(6 * s));

    // Body (Egged-green)
    g.fillStyle(0x2e7d32, 1);
    g.fillRect(bx, by, bw, bh);

    // White body stripe
    g.fillStyle(0xffffff, 1);
    g.fillRect(bx, by + Math.round(bh * 0.38), bw, Math.round(bh * 0.14));

    // Body outline
    g.lineStyle(Math.round(s), 0x1b5e20, 1);
    g.strokeRect(bx, by, bw, bh);

    // Windows (sky-blue tint)
    g.fillStyle(0x90caf9, 1);
    const numWin = 4;
    const winW = Math.round(13 * s);
    const winH = Math.round(11 * s);
    const winGap = Math.round(4 * s);
    const winY = by + Math.round(5 * s);
    let wx = bx + Math.round(8 * s);
    for (let i = 0; i < numWin; i++) {
      g.fillStyle(0x90caf9, 1);
      g.fillRect(wx, winY, winW, winH);
      // Reflection
      g.fillStyle(0xffffff, 0.4);
      g.fillRect(wx + 2, winY + 2, 3, 3);
      g.lineStyle(1, 0x1b5e20, 0.5);
      g.strokeRect(wx, winY, winW, winH);
      wx += winW + winGap;
    }

    // Front windshield (rightmost, bus faces right)
    g.fillStyle(0xb0d8f0, 1);
    g.fillRect(bx + bw - Math.round(17 * s), by + Math.round(4 * s), Math.round(14 * s), Math.round(16 * s));
    g.lineStyle(1, 0x1b5e20, 0.5);
    g.strokeRect(bx + bw - Math.round(17 * s), by + Math.round(4 * s), Math.round(14 * s), Math.round(16 * s));

    // Destination board
    g.fillStyle(0x111111, 1);
    g.fillRect(bx + bw - Math.round(16 * s), by + Math.round(23 * s), Math.round(12 * s), Math.round(7 * s));

    // Front bumper
    g.fillStyle(0x555555, 1);
    g.fillRect(bx + bw - Math.round(4 * s), by + bh - Math.round(8 * s), Math.round(4 * s), Math.round(8 * s));

    // Rear door
    g.fillStyle(0x27692b, 1);
    const doorW = Math.round(13 * s);
    const doorH = Math.round(18 * s);
    g.fillRect(bx + Math.round(5 * s), by + bh - doorH, doorW, doorH);
    g.lineStyle(1, 0x1b5e20, 0.7);
    g.strokeRect(bx + Math.round(5 * s), by + bh - doorH, doorW, doorH);
    g.lineStyle(1, 0x1b5e20, 0.5);
    g.lineBetween(bx + Math.round(11 * s), by + bh - doorH, bx + Math.round(11 * s), by + bh);

    // Undercarriage
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(bx + Math.round(5 * s), by + bh, bw - Math.round(10 * s), Math.round(4 * s));

    // Wheels
    const w1x = bx + Math.round(18 * s);
    const w2x = bx + bw - Math.round(18 * s);
    const wheelY = Math.round(3 * s);
    for (const wx2 of [w1x, w2x]) {
      g.fillStyle(0x1a1a1a, 1);
      g.fillCircle(wx2, wheelY, wr);
      g.fillStyle(0x444444, 1);
      g.fillCircle(wx2, wheelY, Math.round(wr * 0.55));
      g.fillStyle(0x888888, 1);
      g.fillCircle(wx2, wheelY, Math.round(wr * 0.22));
    }

    container.add(g);

    // Destination sign text
    const destText = this.add.text(
      bx + bw - Math.round(10 * s),
      by + Math.round(24 * s),
      'י-ם',
      {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${Math.round(5 * s)}px`,
        color: '#ffffff',
        align: 'center',
      }
    );
    destText.setOrigin(0.5, 0);
    container.add(destText);

    return container;
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

    // Pole
    g.fillStyle(0x666666, 1);
    g.fillRect(-poleW / 2, -poleH, poleW, poleH);
    g.fillStyle(0x888888, 1);
    g.fillRect(-poleW / 2, -poleH, poleW * 0.4, poleH);

    // Sign board (Israeli green direction sign)
    const sw = Math.round(130 * s);
    const sh = Math.round(52 * s);
    const sx = -sw / 2;
    const sy = -poleH;

    g.fillStyle(0x0a5c0a, 1);
    g.fillRect(sx, sy, sw, sh);
    g.lineStyle(Math.max(1, Math.round(2 * s)), 0xffffff, 1);
    g.strokeRect(sx, sy, sw, sh);

    // Inner border (Israeli sign style)
    g.lineStyle(1, 0xffffff, 0.4);
    g.strokeRect(sx + 3, sy + 3, sw - 6, sh - 6);

    // Right-pointing arrow
    const arrowBaseX = sx + sw - Math.round(22 * s);
    const arrowMidY = sy + sh / 2;
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(
      arrowBaseX, arrowMidY - Math.round(7 * s),
      arrowBaseX + Math.round(16 * s), arrowMidY,
      arrowBaseX, arrowMidY + Math.round(7 * s)
    );

    container.add(g);

    const textOpts = (size, color = '#ffffff') => ({
      fontFamily: 'system-ui, -apple-system, Arial, sans-serif',
      fontSize: `${Math.round(size * s)}px`,
      color,
      align: 'center',
    });

    // Hebrew
    const hebrewText = this.add.text(Math.round(-sw / 2 + 8 * s), sy + Math.round(6 * s), 'ירושלים', textOpts(14));
    hebrewText.setOrigin(0, 0);

    // Arabic
    const arabicText = this.add.text(Math.round(-sw / 2 + 8 * s), sy + Math.round(23 * s), 'القدس', {
      ...textOpts(11, '#f5f0cc'),
    });
    arabicText.setOrigin(0, 0);

    // English
    const englishText = this.add.text(Math.round(-sw / 2 + 8 * s), sy + Math.round(37 * s), 'Jerusalem', {
      ...textOpts(9, '#cccccc'),
    });
    englishText.setOrigin(0, 0);

    // Distance badge
    const distText = this.add.text(sx + Math.round(6 * s), sy + sh + Math.round(3 * s), '48 ק"מ', {
      ...textOpts(8, '#eeeeaa'),
    });

    container.add([hebrewText, arabicText, englishText, distText]);

    // Scroll left across screen
    this.tweens.add({
      targets: container,
      x: -250,
      duration: 7000,
      ease: 'Linear',
    });
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

    // Warm Jerusalem sky
    g.fillGradientStyle(0xf5c842, 0xf5c842, 0xef9a2a, 0xef9a2a, 0.75);
    g.fillRect(0, skyStartY, panW, panH);

    // Background buildings (Jerusalem stone)
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

    const wallTopY = groundY - Math.round(35 * s);

    for (const b of blds) {
      const bxPx = Math.round(b.xr * panW);
      const byPx = Math.round(skyStartY + b.yr * panH);
      const bwPx = Math.round(b.wr * panW);
      const bhPx = Math.round(b.hr * panH);
      g.fillStyle(b.c, 1);
      g.fillRect(bxPx, byPx, bwPx, bhPx);
      // Windows
      g.fillStyle(0x8888aa, 0.55);
      for (let wy = byPx + 5; wy < wallTopY - 4; wy += Math.round(9 * s)) {
        for (let wxi = bxPx + 4; wxi < bxPx + bwPx - 3; wxi += Math.round(8 * s)) {
          g.fillRect(wxi, wy, Math.round(3 * s), Math.round(4 * s));
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
    // Wall shadow
    g.fillStyle(0x000000, 0.12);
    g.fillRect(0, wallTopY + Math.round(22 * s), panW, Math.round(3 * s));

    // ── Dome of the Rock (center-left) ──
    const domeX = Math.round(panW * 0.37);
    const domeBase = wallTopY - Math.round(68 * s);
    const domeW = Math.round(36 * s);
    const drumH = Math.round(20 * s);
    const domeR = Math.round(20 * s);

    // Octagonal platform
    g.fillStyle(0xd8c898, 1);
    g.fillRect(domeX - Math.round(domeW * 0.7), domeBase + drumH, Math.round(domeW * 1.4), Math.round(8 * s));

    // Drum body
    g.fillStyle(0xe0d0a0, 1);
    g.fillRect(domeX - domeW / 2, domeBase, domeW, drumH);
    g.lineStyle(1, 0xc4aa80, 1);
    g.strokeRect(domeX - domeW / 2, domeBase, domeW, drumH);

    // Blue tilework on drum
    g.fillStyle(0x3a7abf, 0.7);
    for (let tx = domeX - domeW / 2 + Math.round(3 * s); tx < domeX + domeW / 2 - 3; tx += Math.round(8 * s)) {
      g.fillRect(tx, domeBase + Math.round(3 * s), Math.round(5 * s), Math.round(7 * s));
    }

    // Golden dome
    g.fillStyle(0xd4a820, 1);
    g.fillCircle(domeX, domeBase, domeR);
    // Highlight
    g.fillStyle(0xf0cc38, 0.65);
    g.fillCircle(domeX - Math.round(5 * s), domeBase - Math.round(6 * s), Math.round(9 * s));
    g.fillStyle(0xffe060, 0.3);
    g.fillCircle(domeX - Math.round(7 * s), domeBase - Math.round(8 * s), Math.round(5 * s));
    // Finial
    g.fillStyle(0xaa8010, 1);
    g.fillRect(domeX - Math.round(s), domeBase - domeR - Math.round(9 * s), Math.round(2 * s), Math.round(9 * s));
    g.fillCircle(domeX, domeBase - domeR - Math.round(9 * s), Math.round(3 * s));

    // ── Church of Holy Sepulchre tower ──
    const towerX = Math.round(panW * 0.20);
    const towerTopY = skyStartY + Math.round(panH * 0.12);
    const towerW = Math.round(11 * s);
    g.fillStyle(0xd8c8a8, 1);
    g.fillRect(towerX - towerW / 2, towerTopY, towerW, wallTopY - towerTopY);
    // Battlements on tower
    g.fillStyle(0xc4b494, 1);
    for (let tx = towerX - towerW / 2; tx < towerX + towerW / 2 - 2; tx += Math.round(4 * s)) {
      g.fillRect(tx, towerTopY, Math.round(2 * s), Math.round(-4 * s));
    }
    // Cross
    g.fillStyle(0x888880, 1);
    g.fillRect(towerX - 1, towerTopY - Math.round(11 * s), 2, Math.round(11 * s));
    g.fillRect(towerX - Math.round(4 * s), towerTopY - Math.round(8 * s), Math.round(8 * s), 2);

    // ── Minaret (right area) ──
    const minaretX = Math.round(panW * 0.61);
    const minaretTopY = skyStartY + Math.round(panH * 0.08);
    const minaretW = Math.round(7 * s);
    g.fillStyle(0xd0c8b0, 1);
    g.fillRect(minaretX - minaretW / 2, minaretTopY, minaretW, wallTopY - minaretTopY);
    // Balcony ledge
    g.fillStyle(0xbcb4a0, 1);
    g.fillRect(minaretX - Math.round(5 * s), minaretTopY + Math.round(28 * s), Math.round(10 * s), Math.round(2 * s));
    // Muezzin dome
    g.fillStyle(0xb0a888, 1);
    g.fillCircle(minaretX, minaretTopY, Math.round(4.5 * s));

    // ── Second minaret (far right) ──
    const m2X = Math.round(panW * 0.85);
    const m2TopY = skyStartY + Math.round(panH * 0.18);
    const m2W = Math.round(6 * s);
    g.fillStyle(0xcec6ae, 1);
    g.fillRect(m2X - m2W / 2, m2TopY, m2W, wallTopY - m2TopY);
    g.fillStyle(0xaaa088, 1);
    g.fillCircle(m2X, m2TopY, Math.round(4 * s));

    // ── Olive trees in foreground ──
    for (let ot = 0; ot < 6; ot++) {
      const tx = Math.round((0.04 + ot * 0.16) * panW);
      const ty = wallTopY - Math.round(12 * s);
      // Trunk
      g.fillStyle(0x5a4a30, 1);
      g.fillRect(tx - 1, ty, 2, Math.round(12 * s));
      // Canopy
      g.fillStyle(0x4a6a30, 1);
      g.fillEllipse(tx, ty - Math.round(5 * s), Math.round(18 * s), Math.round(14 * s));
      g.fillStyle(0x3a5a22, 0.7);
      g.fillEllipse(tx + Math.round(4 * s), ty - Math.round(7 * s), Math.round(12 * s), Math.round(10 * s));
    }

    // Ground
    g.fillStyle(0xd4a853, 1);
    g.fillRect(0, groundY, panW, height - groundY);

    container.add(g);

    // Slide in from right
    this.tweens.add({
      targets: container,
      x: width - panW,
      duration: 3500,
      ease: 'Cubic.easeOut',
    });

    return container;
  }

  // ─────────────────────────────────────────────────────────────
  // Timeline
  // ─────────────────────────────────────────────────────────────

  _scheduleTimeline(width, height) {
    // Signpost at t=7s
    this.time.delayedCall(7000, () => {
      if (!this._sceneEnded) this._spawnSignpost(height);
    });

    // Jerusalem appears at t=13s, bus slows
    this.time.delayedCall(13000, () => {
      if (!this._sceneEnded) {
        this._showJerusalem(height);
        this.tweens.add({
          targets: this,
          _scrollSpeed: 18,
          duration: 3000,
          ease: 'Cubic.easeOut',
        });
      }
    });

    // Arrival message at t=17s
    this.time.delayedCall(17000, () => {
      if (!this._sceneEnded) this._showArrival(width, height);
    });
  }

  _showArrival(width, height) {
    this._scrollSpeed = 0;
    const s = this._scale(height);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.55);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(10000).setScrollFactor(0).setAlpha(0);

    const title = this.add.text(width / 2, height / 2 - height * 0.10, 'הגעתם לירושלים!', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: `${Math.round(height * 0.095)}px`,
      fontWeight: '900',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: Math.round(height * 0.014),
      align: 'center',
    });
    title.setOrigin(0.5).setDepth(10001).setScrollFactor(0).setAlpha(0);

    const sub = this.add.text(width / 2, height / 2 + height * 0.06, 'טפו להמשיך', {
      fontFamily: 'system-ui, monospace, sans-serif',
      fontSize: `${Math.round(height * 0.038)}px`,
      color: '#ffffff',
      align: 'center',
    });
    sub.setOrigin(0.5).setDepth(10001).setScrollFactor(0).setAlpha(0);

    this.tweens.add({
      targets: [overlay, title, sub],
      alpha: 1,
      duration: 1100,
      onComplete: () => {
        this.tweens.add({ targets: sub, alpha: 0.25, duration: 650, yoyo: true, repeat: -1 });
        this.input.once('pointerdown', () => this._endScene());
      },
    });
  }

  _endScene() {
    if (this._sceneEnded) return;
    this._sceneEnded = true;
    this._stopMusic();
    this.cameras.main.fade(800, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Day1Scene');
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Music (Web Audio — Hijaaz modal scale on D)
  // ─────────────────────────────────────────────────────────────

  _startMusic() {
    try {
      const ctx = this.sound.context;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      this._audioCtx = ctx;
      this._scheduleMusic(ctx);
    } catch (_) {}
  }

  _scheduleMusic(ctx) {
    // Hijaaz / Freygish scale on D:
    // D3  Eb3  F#3  G3  A3  Bb3  C4  D4  Eb4  F#4  G4  A4  Bb4
    const hz = {
      D3: 146.83, Eb3: 155.56, Fs3: 184.99, G3: 196.00,
      A3: 220.00, Bb3: 233.08, C4: 261.63, D4: 293.66,
      Eb4: 311.13, Fs4: 369.99, G4: 392.00, A4: 440.00, Bb4: 466.16,
    };

    // Melody motif (two phrases)
    const melody = [
      // Phrase 1 — ascending yearning line
      [hz.D4, 0.35], [hz.Eb4, 0.20], [hz.Fs4, 0.40], [hz.G4, 0.20],
      [hz.A4, 0.40], [hz.G4, 0.20], [hz.Fs4, 0.40], [hz.Eb4, 0.20],
      [hz.D4, 0.80],
      // Phrase 2 — descending resolution
      [hz.D4, 0.30], [hz.C4, 0.20], [hz.Bb3, 0.40], [hz.A3, 0.40],
      [hz.G3, 0.35], [hz.A3, 0.20], [hz.Bb3, 0.40], [hz.A3, 0.20],
      [hz.G3, 0.80],
      // Phrase 3 — flourish
      [hz.Fs3, 0.30], [hz.G3, 0.20], [hz.A3, 0.30], [hz.Bb3, 0.40],
      [hz.A3, 0.35], [hz.G3, 0.20], [hz.Fs3, 0.40], [hz.Eb3, 0.20],
      [hz.D3, 1.20],
    ];

    const playNote = (freq, startT, dur, vol = 0.17) => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filt = ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.value = freq;

        filt.type = 'lowpass';
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

    const melodyDur = melody.reduce((s, [, d]) => s + d, 0);
    const now = ctx.currentTime + 0.4;

    // 4 repetitions (~22s total melody)
    for (let rep = 0; rep < 4; rep++) {
      let t = now + rep * melodyDur;
      for (const [freq, dur] of melody) {
        playNote(freq, t, dur * 0.92);
        t += dur;
      }
    }

    // Bass drone
    try {
      const drone = ctx.createOscillator();
      const droneGain = ctx.createGain();
      const droneFilt = ctx.createBiquadFilter();
      drone.type = 'sine';
      drone.frequency.value = hz.D3 / 2; // D2
      droneFilt.type = 'lowpass';
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
          if (typeof node.stop === 'function') {
            node.stop(now + 0.5);
          }
        } catch (_) {}
      }
    } catch (_) {}
    this._musicNodes = [];
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────

  _scale(height) {
    return Math.max(1, height / 200);
  }
}
