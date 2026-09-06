import Phaser from 'phaser';

/**
 * BootScene — Generates 16×16 pixel art placeholder textures.
 *
 * All textures are small pixel art. The scene scales them up at runtime
 * using setScale(), and pixelArt: true in the config keeps them crisp.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Dynamically update progress bar
    this.load.on('progress', (value) => {
      const progressFill = document.getElementById('loading-progress-fill');
      if (progressFill) {
        progressFill.style.width = `${value * 100}%`;
      }
    });

    // Relative paths for Vite base `./` (local + GitHub Pages / Firebase).
    // ── Day 1 critical assets (lightweight WebP visuals needed on boot) ──
    this.load.image('player',    'assets/Characters/Shiri-front.webp');
    this.load.image('npc-yuval', 'assets/Characters/Yuval.webp');
    this.load.image('npc-shiri', 'assets/Characters/Shiri.webp');
    this.load.image('npc-dana',  'assets/Characters/Dana.webp');

    // Day 1 background & supermarket exterior
    this.load.image('day1-bg', 'assets/backgrounds/Kiryat shmona.webp');
    this.load.image('supermarket-outside', 'assets/backgrounds/supermarketOutside.webp');

    // ── Shared light SFX ──
    this.load.audio('sfx-explosion', 'assets/sounds/drone_bomb.mp3');
    this.load.audio('sfx-gameover',  'assets/sounds/game-over.mp3');
    this.load.audio('sfx-levelup',   'assets/sounds/level-up.mp3');
  }

  create() {
    // Player texture is preloaded from assets/Characters/Shiri-front.webp
    this._generateNpcTexture();
    this._generateBuildingTextures();
    this._generateRoadTexture();
    this._generateDroneTexture();
    this._generateParticleTexture();
    this._generateJerusalemStoneTextures();
    this._generateEggedBusTexture();
    this._generateJerusalemBuildings();
    this._generateAsphaltTextures();
    this._generateSolbergPortrait();
    this._generateBananaTexture();
    this._generateMineTexture();
    this._generatePedalTextures();

    // Hide the initial loading screen now that boot preloading is complete
    if (typeof window.hideLoadingScreen === 'function') {
      window.hideLoadingScreen();
    }

    if (window.gameStarted) {
      this.events.emit('complete');
    } else {
      window.addEventListener('start-game', () => {
        this.events.emit('complete');
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 16×16 base pixel art textures
  // ---------------------------------------------------------------------------

  /** NPC: 12×20 white character */
  _generateNpcTexture() {
    const gfx = this.add.graphics();

    // Body
    gfx.fillStyle(0xf0f0f0, 1);
    gfx.fillRect(0, 4, 12, 16);

    // Head
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(2, 0, 8, 7);

    // Eyes
    gfx.fillStyle(0x333333, 1);
    gfx.fillRect(3, 2, 2, 2);
    gfx.fillRect(7, 2, 2, 2);

    // Feet
    gfx.fillStyle(0xcccccc, 1);
    gfx.fillRect(1, 17, 4, 3);
    gfx.fillRect(7, 17, 4, 3);

    gfx.generateTexture('npc', 12, 20);
    gfx.destroy();
  }

  /** Buildings: small pixel art rectangles in a few sizes */
  _generateBuildingTextures() {
    const buildings = [
      { key: 'bld_a', w: 16, h: 32, color: 0x5a5a6e },
      { key: 'bld_b', w: 14, h: 24, color: 0x4a4a5e },
      { key: 'bld_c', w: 12, h: 18, color: 0x6a6a7e },
      { key: 'bld_d', w: 20, h: 28, color: 0x555568 },
      { key: 'bld_e', w: 10, h: 36, color: 0x484860 },
    ];

    for (const b of buildings) {
      const gfx = this.add.graphics();

      // Body
      gfx.fillStyle(b.color, 1);
      gfx.fillRect(0, 0, b.w, b.h);

      // Outline
      gfx.lineStyle(1, 0x333344, 1);
      gfx.strokeRect(0, 0, b.w, b.h);

      // Windows — 2×3 px each
      const winW = 2;
      const winH = 3;
      const padX = 2;
      const padY = 3;
      const gapX = 2;
      const gapY = 3;
      const cols = Math.floor((b.w - padX * 2 + gapX) / (winW + gapX));
      const rows = Math.floor((b.h - padY - 2) / (winH + gapY));

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const wx = padX + col * (winW + gapX);
          const wy = padY + row * (winH + gapY);
          const lit = (row + col) % 3 !== 0;
          gfx.fillStyle(lit ? 0x8888aa : 0x3a3a4e, 1);
          gfx.fillRect(wx, wy, winW, winH);
        }
      }

      gfx.generateTexture(b.key, b.w, b.h);
      gfx.destroy();
    }
  }

  /** Road: 16×16 asphalt tile, curb, and dashed line */
  _generateRoadTexture() {
    // Asphalt tile
    const gfx = this.add.graphics();
    gfx.fillStyle(0x3a3a3a, 1);
    gfx.fillRect(0, 0, 16, 16);
    gfx.fillStyle(0x404040, 1);
    gfx.fillRect(3, 5, 2, 1);
    gfx.fillRect(10, 11, 2, 1);
    gfx.fillRect(7, 2, 1, 1);
    gfx.generateTexture('road', 16, 16);
    gfx.destroy();

    // Curb — 16×2
    const curbGfx = this.add.graphics();
    curbGfx.fillStyle(0x888888, 1);
    curbGfx.fillRect(0, 0, 16, 2);
    curbGfx.fillStyle(0x999999, 1);
    curbGfx.fillRect(0, 0, 16, 1);
    curbGfx.generateTexture('curb', 16, 2);
    curbGfx.destroy();

    // Dashed center line — 6×1
    const lineGfx = this.add.graphics();
    lineGfx.fillStyle(0xcccc44, 1);
    lineGfx.fillRect(0, 0, 6, 1);
    lineGfx.generateTexture('road_line', 6, 1);
    lineGfx.destroy();

    // Sidewalk tile — 16×16
    const swGfx = this.add.graphics();
    swGfx.fillStyle(0x666666, 1);
    swGfx.fillRect(0, 0, 16, 16);
    swGfx.lineStyle(1, 0x555555, 1);
    swGfx.strokeRect(0, 0, 16, 16);
    swGfx.generateTexture('sidewalk', 16, 16);
    swGfx.destroy();
  }

  /** Drone: 24×16 metal quadcopter with red core and propellers */
  _generateDroneTexture() {
    const gfx = this.add.graphics();
    // Metal grey chassis
    gfx.fillStyle(0x3f3f46, 1);
    gfx.fillRect(4, 6, 16, 6);
    gfx.fillRect(10, 4, 4, 10);
    // Red sensor/eye
    gfx.fillStyle(0xef4444, 1);
    gfx.fillRect(11, 7, 2, 2);
    // Propellers/wings
    gfx.fillStyle(0x71717a, 1);
    gfx.fillRect(2, 4, 3, 2);
    gfx.fillRect(19, 4, 3, 2);
    gfx.fillRect(2, 12, 3, 2);
    gfx.fillRect(19, 12, 3, 2);

    gfx.generateTexture('drone', 24, 16);
    gfx.destroy();
  }

  /** Particle: 4×4 white block for explosions */
  _generateParticleTexture() {
    const gfx = this.add.graphics();
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(0, 0, 4, 4);
    gfx.generateTexture('particle', 4, 4);
    gfx.destroy();
  }

  /** Banana: 16×16 yellow pixel art banana */
  _generateBananaTexture() {
    const gfx = this.add.graphics();

    // Curved banana body (vibrant yellow)
    gfx.fillStyle(0xffe135, 1);
    gfx.fillRect(4, 3, 6, 2);
    gfx.fillRect(2, 5, 8, 4);
    gfx.fillRect(3, 9, 8, 3);
    gfx.fillRect(5, 12, 5, 2);

    // Inner shadow curve (golden orange)
    gfx.fillStyle(0xd4af37, 1);
    gfx.fillRect(3, 7, 3, 4);

    // Stem and tip (dark olive green)
    gfx.fillStyle(0x4a5d23, 1);
    gfx.fillRect(8, 2, 2, 2);
    gfx.fillRect(9, 13, 2, 2);

    gfx.generateTexture('banana', 16, 16);
    gfx.destroy();
  }

  /** Mine: 20×20 metallic landmine with spikes and red LED */
  _generateMineTexture() {
    const gfx = this.add.graphics();

    // Dark grey circular metallic body
    gfx.fillStyle(0x374151, 1);
    gfx.fillCircle(10, 10, 8);

    // Darker outer rim
    gfx.lineStyle(2, 0x1f2937, 1);
    gfx.strokeCircle(10, 10, 8);

    // Spikes/studs on sides
    gfx.fillStyle(0x4b5563, 1);
    gfx.fillRect(2, 9, 2, 2);
    gfx.fillRect(16, 9, 2, 2);
    gfx.fillRect(9, 2, 2, 2);
    gfx.fillRect(9, 16, 2, 2);

    // Red warning blinking LED center
    gfx.fillStyle(0xef4444, 1);
    gfx.fillCircle(10, 10, 3);
    gfx.fillStyle(0xf87171, 1);
    gfx.fillCircle(9, 9, 1);

    gfx.generateTexture('mine', 20, 20);
    gfx.destroy();
  }

  /** Jerusalem Stones: Intact, Cracked, and Broken (hole) */
  _generateJerusalemStoneTextures() {
    // Intact stone: beige/sand color
    const gfx = this.add.graphics();
    gfx.fillStyle(0xe6d5b8, 1); // Light sand/beige
    gfx.fillRect(0, 0, 32, 16);
    // Draw some stone texture highlights/borders
    gfx.lineStyle(1, 0xd4b88a, 1); // Darker sand border
    gfx.strokeRect(0, 0, 32, 16);
    // Add some random texture dots
    gfx.fillStyle(0xd4b88a, 1);
    gfx.fillRect(5, 4, 2, 1);
    gfx.fillRect(20, 11, 1, 2);
    gfx.fillRect(12, 8, 2, 2);
    gfx.generateTexture('stone_intact', 32, 16);
    gfx.destroy();

    // Cracked stone
    const crackedGfx = this.add.graphics();
    crackedGfx.fillStyle(0xe6d5b8, 1);
    crackedGfx.fillRect(0, 0, 32, 16);
    crackedGfx.lineStyle(1, 0xd4b88a, 1);
    crackedGfx.strokeRect(0, 0, 32, 16);
    // Texture dots
    crackedGfx.fillStyle(0xd4b88a, 1);
    crackedGfx.fillRect(5, 4, 2, 1);
    crackedGfx.fillRect(20, 11, 1, 2);
    crackedGfx.fillRect(12, 8, 2, 2);
    // Dark cracks (brown/grey)
    crackedGfx.lineStyle(1, 0x4a3c28, 1);
    crackedGfx.beginPath();
    crackedGfx.moveTo(4, 2);
    crackedGfx.lineTo(12, 8);
    crackedGfx.lineTo(10, 14);
    crackedGfx.moveTo(28, 4);
    crackedGfx.lineTo(20, 7);
    crackedGfx.lineTo(22, 12);
    crackedGfx.strokePath();
    crackedGfx.generateTexture('stone_cracked', 32, 16);
    crackedGfx.destroy();
    
    // Broken stone (hole)
    const brokenGfx = this.add.graphics();
    brokenGfx.fillStyle(0x110e1a, 1); // Dark pit color
    brokenGfx.fillRect(0, 0, 32, 16);
    brokenGfx.lineStyle(1, 0x2d1f47, 1);
    brokenGfx.strokeRect(0, 0, 32, 16);
    // Draw some jagged edges on the border
    brokenGfx.fillStyle(0xd4b88a, 1);
    brokenGfx.fillRect(0, 0, 4, 3);
    brokenGfx.fillRect(28, 0, 4, 4);
    brokenGfx.fillRect(0, 13, 3, 3);
    brokenGfx.fillRect(29, 12, 3, 4);
    brokenGfx.generateTexture('stone_broken', 32, 16);
    brokenGfx.destroy();
  }

  /** Egged Bus: Green/White Israeli Egged bus */
  _generateEggedBusTexture() {
    const w = 96;
    const h = 36;
    const doorX = 72;
    const doorW = 10;
    const doorH = 22;
    const winW = 12;
    const winH = 10;
    const winY = 8;
    const winGap = 4;
    const winStartX = 8;
    const whY = h - 6;

    // --- 1. CLOSED BUS ---
    const gfx = this.add.graphics();
    gfx.fillStyle(0x009b48, 1);
    gfx.fillRect(0, 6, w, h - 12);
    gfx.fillStyle(0xf3f4f6, 1);
    gfx.fillRect(2, 2, w - 4, 4);
    gfx.fillStyle(0x374151, 1);
    gfx.fillRect(0, h - 8, 6, 4);
    gfx.fillRect(w - 6, h - 8, 6, 4);

    for (let i = 0; i < 5; i++) {
      const wx = winStartX + i * (winW + winGap);
      gfx.fillStyle(0x1f2937, 1);
      gfx.fillRect(wx - 1, winY - 1, winW + 2, winH + 2);
      gfx.fillStyle(0x93c5fd, 1);
      gfx.fillRect(wx, winY, winW, winH);
      gfx.fillStyle(0xffffff, 0.4);
      gfx.fillRect(wx + 2, winY + 2, 2, winH - 4);
    }

    // Bus door closed
    gfx.fillStyle(0x111827, 1);
    gfx.fillRect(doorX - 1, 8, doorW + 2, doorH + 1);
    gfx.fillStyle(0xd1d5db, 1);
    gfx.fillRect(doorX, 9, doorW, doorH);
    gfx.fillStyle(0x111827, 1);
    gfx.fillRect(doorX + doorW/2 - 1, 9, 2, doorH);

    // Logo
    gfx.fillStyle(0xef4444, 1);
    gfx.fillRect(32, 22, 10, 6);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(33, 24, 2, 2);
    gfx.fillRect(36, 24, 2, 2);
    gfx.fillRect(39, 24, 2, 2);

    // Wheels
    gfx.fillStyle(0x111827, 1);
    gfx.fillCircle(20, whY, 8);
    gfx.fillCircle(76, whY, 8);
    gfx.fillStyle(0x9ca3af, 1);
    gfx.fillCircle(20, whY, 3);
    gfx.fillCircle(76, whY, 3);

    gfx.generateTexture('egged_bus', w, h);
    gfx.destroy();

    // --- 2. OPEN BUS ---
    const gfxOpen = this.add.graphics();
    gfxOpen.fillStyle(0x009b48, 1);
    gfxOpen.fillRect(0, 6, w, h - 12);
    gfxOpen.fillStyle(0xf3f4f6, 1);
    gfxOpen.fillRect(2, 2, w - 4, 4);
    gfxOpen.fillStyle(0x374151, 1);
    gfxOpen.fillRect(0, h - 8, 6, 4);
    gfxOpen.fillRect(w - 6, h - 8, 6, 4);

    for (let i = 0; i < 5; i++) {
      const wx = winStartX + i * (winW + winGap);
      gfxOpen.fillStyle(0x1f2937, 1);
      gfxOpen.fillRect(wx - 1, winY - 1, winW + 2, winH + 2);
      gfxOpen.fillStyle(0x93c5fd, 1);
      gfxOpen.fillRect(wx, winY, winW, winH);
      gfxOpen.fillStyle(0xffffff, 0.4);
      gfxOpen.fillRect(wx + 2, winY + 2, 2, winH - 4);
    }

    // Bus door open
    gfxOpen.fillStyle(0x111827, 1);
    gfxOpen.fillRect(doorX - 1, 8, doorW + 2, doorH + 1);
    gfxOpen.fillStyle(0xd1d5db, 1);
    gfxOpen.fillRect(doorX, 9, 2, doorH);
    gfxOpen.fillRect(doorX + doorW - 2, 9, 2, doorH);

    // Logo
    gfxOpen.fillStyle(0xef4444, 1);
    gfxOpen.fillRect(32, 22, 10, 6);
    gfxOpen.fillStyle(0xffffff, 1);
    gfxOpen.fillRect(33, 24, 2, 2);
    gfxOpen.fillRect(36, 24, 2, 2);
    gfxOpen.fillRect(39, 24, 2, 2);

    // Wheels
    gfxOpen.fillStyle(0x111827, 1);
    gfxOpen.fillCircle(20, whY, 8);
    gfxOpen.fillCircle(76, whY, 8);
    gfxOpen.fillStyle(0x9ca3af, 1);
    gfxOpen.fillCircle(20, whY, 3);
    gfxOpen.fillCircle(76, whY, 3);

    gfxOpen.generateTexture('egged_bus_open', w, h);
    gfxOpen.destroy();

    // --- 3. BUS WITHOUT DOORS (driver side / reverse view) ---
    const gfxNoDoors = this.add.graphics();
    gfxNoDoors.fillStyle(0x009b48, 1);
    gfxNoDoors.fillRect(0, 6, w, h - 12);
    gfxNoDoors.fillStyle(0xf3f4f6, 1);
    gfxNoDoors.fillRect(2, 2, w - 4, 4);
    gfxNoDoors.fillStyle(0x374151, 1);
    gfxNoDoors.fillRect(0, h - 8, 6, 4);
    gfxNoDoors.fillRect(w - 6, h - 8, 6, 4);

    for (let i = 0; i < 6; i++) {
      const wx = winStartX + i * (winW + winGap);
      gfxNoDoors.fillStyle(0x1f2937, 1);
      gfxNoDoors.fillRect(wx - 1, winY - 1, winW + 2, winH + 2);
      gfxNoDoors.fillStyle(0x93c5fd, 1);
      gfxNoDoors.fillRect(wx, winY, winW, winH);
      gfxNoDoors.fillStyle(0xffffff, 0.4);
      gfxNoDoors.fillRect(wx + 2, winY + 2, 2, winH - 4);
    }

    // Logo
    gfxNoDoors.fillStyle(0xef4444, 1);
    gfxNoDoors.fillRect(32, 22, 10, 6);
    gfxNoDoors.fillStyle(0xffffff, 1);
    gfxNoDoors.fillRect(33, 24, 2, 2);
    gfxNoDoors.fillRect(36, 24, 2, 2);
    gfxNoDoors.fillRect(39, 24, 2, 2);

    // Wheels
    gfxNoDoors.fillStyle(0x111827, 1);
    gfxNoDoors.fillCircle(20, whY, 8);
    gfxNoDoors.fillCircle(76, whY, 8);
    gfxNoDoors.fillStyle(0x9ca3af, 1);
    gfxNoDoors.fillCircle(20, whY, 3);
    gfxNoDoors.fillCircle(76, whY, 3);

    gfxNoDoors.generateTexture('egged_bus_no_doors', w, h);
    gfxNoDoors.destroy();
  }

  /** Jerusalem buildings: domes and arches */
  _generateJerusalemBuildings() {
    const jlmBuildings = [
      { key: 'jlm_bld_a', w: 18, h: 22, color: 0xdfcbaf },
      { key: 'jlm_bld_b', w: 16, h: 30, color: 0xcfb99c },
      { key: 'jlm_bld_c', w: 20, h: 26, color: 0xe5d6c0 },
      { key: 'jlm_bld_d', w: 14, h: 20, color: 0xd6c0a5 },
    ];

    for (const b of jlmBuildings) {
      const gfx = this.add.graphics();

      if (b.key === 'jlm_bld_b') {
        gfx.fillStyle(0xd9b36c, 1);
        gfx.fillEllipse(b.w / 2, 8, b.w - 4, 10);
        gfx.fillStyle(b.color, 1);
        gfx.fillRect(0, 8, b.w, b.h - 8);
        gfx.fillStyle(0x4a3a2d, 1);
        gfx.fillRect(b.w / 2 - 2, 14, 4, 6);
        gfx.fillCircle(b.w / 2, 14, 2);
      } else if (b.key === 'jlm_bld_c') {
        gfx.fillStyle(b.color, 1);
        gfx.fillRect(0, 4, b.w, b.h - 4);
        gfx.fillStyle(0x1a1a2e, 1);
        gfx.fillRect(4, 0, 4, 4);
        gfx.fillRect(12, 0, 4, 4);
        gfx.fillStyle(0x2b2118, 1);
        gfx.fillRect(b.w / 2 - 1, 10, 2, 6);
      } else {
        gfx.fillStyle(b.color, 1);
        gfx.fillRect(0, 0, b.w, b.h);
        gfx.fillStyle(0x4a3a2d, 1);
        gfx.fillRect(4, 6, 4, 6);
        gfx.fillCircle(6, 6, 2);
        gfx.fillRect(12, 6, 4, 6);
        gfx.fillCircle(14, 6, 2);
      }

      gfx.lineStyle(1, 0x9e8a75, 0.4);
      gfx.strokeRect(0, 0, b.w, b.h);

      gfx.generateTexture(b.key, b.w, b.h);
      gfx.destroy();
    }
  }

  /** Asphalt Road: Intact, Cracked, and Broken (hole) matching Kiryat Shmona */
  _generateAsphaltTextures() {
    // Intact asphalt: dark grey
    const gfx = this.add.graphics();
    gfx.fillStyle(0x3a3a3a, 1);
    gfx.fillRect(0, 0, 32, 16);
    // Add some random texture dots
    gfx.fillStyle(0x404040, 1);
    gfx.fillRect(5, 4, 2, 1);
    gfx.fillRect(20, 11, 2, 1);
    gfx.fillRect(12, 8, 1, 1);
    gfx.generateTexture('asphalt_intact', 32, 16);
    gfx.destroy();

    // Cracked asphalt: dark grey with light grey cracks
    const crackedGfx = this.add.graphics();
    crackedGfx.fillStyle(0x3a3a3a, 1);
    crackedGfx.fillRect(0, 0, 32, 16);
    crackedGfx.fillStyle(0x404040, 1);
    crackedGfx.fillRect(5, 4, 2, 1);
    crackedGfx.fillRect(20, 11, 2, 1);
    crackedGfx.fillRect(12, 8, 1, 1);
    // Cracks in light grey
    crackedGfx.lineStyle(1, 0x666666, 1);
    crackedGfx.beginPath();
    crackedGfx.moveTo(4, 2);
    crackedGfx.lineTo(12, 8);
    crackedGfx.lineTo(10, 14);
    crackedGfx.moveTo(28, 4);
    crackedGfx.lineTo(20, 7);
    crackedGfx.lineTo(22, 12);
    crackedGfx.strokePath();
    crackedGfx.generateTexture('asphalt_cracked', 32, 16);
    crackedGfx.destroy();
  }

  /** Solberg Portrait: 48×48 pixel art face, glasses, suit */
  _generateSolbergPortrait() {
    const gfx = this.add.graphics();

    // 1. Background box (slate grey)
    gfx.fillStyle(0x475569, 1);
    gfx.fillRect(0, 0, 48, 48);

    // 2. Suit/Shoulders (dark blue/navy)
    gfx.fillStyle(0x1e3a8a, 1);
    gfx.fillRect(6, 36, 36, 12);
    
    // Tie / Collar (white shirt, blue tie)
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(20, 36, 8, 4);
    gfx.fillStyle(0x0f172a, 1);
    gfx.fillRect(23, 38, 2, 10);

    // 3. Head/Face (skin tone)
    gfx.fillStyle(0xfbcfe8, 1);
    gfx.fillRect(14, 10, 20, 26);

    // Hair (grey)
    gfx.fillStyle(0x94a3b8, 1);
    gfx.fillRect(14, 6, 20, 5);
    gfx.fillRect(12, 10, 3, 16);
    gfx.fillRect(33, 10, 3, 16);

    // Glasses frame (black)
    gfx.fillStyle(0x000000, 1);
    gfx.fillRect(16, 17, 7, 2);
    gfx.fillRect(25, 17, 7, 2);
    gfx.fillRect(23, 17, 2, 1);

    // Eyes inside glasses
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(17, 18, 5, 2);
    gfx.fillRect(26, 18, 5, 2);
    gfx.fillStyle(0x3b82f6, 1);
    gfx.fillRect(19, 18, 1, 1);
    gfx.fillRect(28, 18, 1, 1);

    // Mouth / Smile (red line)
    gfx.fillStyle(0xe11d48, 1);
    gfx.fillRect(20, 29, 8, 1);

    // Outline / Border
    gfx.lineStyle(1.5, 0x0f172a, 1);
    gfx.strokeRect(0, 0, 48, 48);

    gfx.generateTexture('solberg_portrait', 48, 48);
    gfx.destroy();
  }

  /** Gas and Brake pixel art pedals */
  _generatePedalTextures() {
    // 1. GAS PEDAL (Normal: 20x32)
    let g = this.add.graphics();
    // Metal mounting arm
    g.fillStyle(0x334155, 1);
    g.fillRect(8, 0, 4, 8);
    // Outer shadow / frame
    g.fillStyle(0x0f172a, 1);
    g.fillRect(2, 6, 16, 26);
    // Pedal face (metallic slate)
    g.fillStyle(0x475569, 1);
    g.fillRect(3, 7, 14, 24);
    // Top highlight rim
    g.fillStyle(0x94a3b8, 1);
    g.fillRect(3, 7, 14, 2);
    // Green accent strip
    g.fillStyle(0x22c55e, 1);
    g.fillRect(3, 9, 14, 3);
    // Vertical rubber grip ridges
    g.fillStyle(0x0f172a, 1);
    g.fillRect(6, 14, 2, 14);
    g.fillRect(9, 14, 2, 14);
    g.fillRect(12, 14, 2, 14);

    g.generateTexture('pedal_gas', 20, 32);
    g.destroy();

    // GAS PEDAL (Pressed: 20x32 - depressed down)
    g = this.add.graphics();
    g.fillStyle(0x334155, 1);
    g.fillRect(8, 0, 4, 11);
    g.fillStyle(0x0f172a, 1);
    g.fillRect(2, 9, 16, 23);
    g.fillStyle(0x334155, 1);
    g.fillRect(3, 10, 14, 21);
    g.fillStyle(0x4ade80, 1);
    g.fillRect(3, 10, 14, 3);
    g.fillStyle(0x0f172a, 1);
    g.fillRect(6, 15, 2, 13);
    g.fillRect(9, 15, 2, 13);
    g.fillRect(12, 15, 2, 13);

    g.generateTexture('pedal_gas_pressed', 20, 32);
    g.destroy();

    // 2. BRAKE PEDAL (Normal: 30x24)
    g = this.add.graphics();
    // Metal mounting arm
    g.fillStyle(0x334155, 1);
    g.fillRect(13, 0, 4, 6);
    // Outer shadow / frame
    g.fillStyle(0x0f172a, 1);
    g.fillRect(2, 4, 26, 20);
    // Pedal face
    g.fillStyle(0x475569, 1);
    g.fillRect(3, 5, 24, 18);
    // Top highlight rim
    g.fillStyle(0x94a3b8, 1);
    g.fillRect(3, 5, 24, 2);
    // Red accent strip
    g.fillStyle(0xef4444, 1);
    g.fillRect(3, 7, 24, 3);
    // Horizontal rubber grip ridges
    g.fillStyle(0x0f172a, 1);
    g.fillRect(6, 12, 18, 2);
    g.fillRect(6, 15, 18, 2);
    g.fillRect(6, 18, 18, 2);

    g.generateTexture('pedal_brake', 30, 24);
    g.destroy();

    // BRAKE PEDAL (Pressed: 30x24 - depressed down)
    g = this.add.graphics();
    g.fillStyle(0x334155, 1);
    g.fillRect(13, 0, 4, 9);
    g.fillStyle(0x0f172a, 1);
    g.fillRect(2, 7, 26, 17);
    g.fillStyle(0x334155, 1);
    g.fillRect(3, 8, 24, 15);
    g.fillStyle(0xf87171, 1);
    g.fillRect(3, 8, 24, 3);
    g.fillStyle(0x0f172a, 1);
    g.fillRect(6, 13, 18, 2);
    g.fillRect(6, 16, 18, 2);

    g.generateTexture('pedal_brake_pressed', 30, 24);
    g.destroy();
  }
}
