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

  preload() {}

  create() {
    this._generatePlayerTexture();
    this._generateNpcTexture();
    this._generateBuildingTextures();
    this._generateRoadTexture();
    this._generateDroneTexture();
    this._generateParticleTexture();
    this._generateSolbergPortrait();

    this.scene.start('Day1Scene');
  }

  // ---------------------------------------------------------------------------
  // 16×16 base pixel art textures
  // ---------------------------------------------------------------------------

  /** Player: 12×20 red character */
  _generatePlayerTexture() {
    const gfx = this.add.graphics();

    // Body
    gfx.fillStyle(0xdc2626, 1);
    gfx.fillRect(0, 4, 12, 16);

    // Head
    gfx.fillStyle(0xef4444, 1);
    gfx.fillRect(2, 0, 8, 7);

    // Eyes
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(3, 2, 2, 2);
    gfx.fillRect(7, 2, 2, 2);

    // Feet
    gfx.fillStyle(0x991b1b, 1);
    gfx.fillRect(1, 17, 4, 3);
    gfx.fillRect(7, 17, 4, 3);

    gfx.generateTexture('player', 12, 20);
    gfx.destroy();
  }

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
}
