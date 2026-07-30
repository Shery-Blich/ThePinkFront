import Phaser from 'phaser';

/**
 * MenuScene — The starting menu scene for ThePinkFront.
 * It features a stylized retro title, animated building backdrop,
 * and a premium interactive button to transition to Day1Scene.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const { width, height } = this.scale;

    // Scale factor based on height (matching game style)
    const s = Math.max(1, Math.round(height / 180));

    // --- Background Color ---
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // --- Background Image ---
    if (this.textures.exists('menu-bg')) {
      const bg = this.add.image(width / 2, height / 2, 'menu-bg');
      const coverScale = Math.max(width / bg.width, height / bg.height);
      bg.setScale(coverScale);
      bg.setDepth(-10);
    }

    // --- Title Text (Hebrew & English styling) ---
    const titleText = this.add.text(width / 2, height * 0.32, 'החזית הוורודה', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: `${Math.max(32, Math.round(height * 0.12))}px`,
      fontWeight: '900',
      color: '#ff007f', // Hot Pink
      align: 'center',
    });
    titleText.setOrigin(0.5);
    // Add retro 8-bit text stroke shadow
    titleText.setStroke('#000000', Math.max(4, s * 2));
    titleText.setShadow(2, 2, '#00e6ff', 2, true, true); // Neon cyan shadow

    // Gentle floating bounce on the title
    this.tweens.add({
      targets: titleText,
      y: height * 0.30,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // --- "Start Game" Interactive Button ---
    // Background button backing using a rectangle Graphics
    const btnWidth = Math.max(180, width * 0.25);
    const btnHeight = Math.max(44, height * 0.12);
    
    const btnContainer = this.add.container(width / 2, height * 0.72);

    const btnBg = this.add.graphics();
    // Normal state style: Pink base, white outline
    btnBg.fillStyle(0xff007f, 1);
    btnBg.fillRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
    btnBg.lineStyle(3, 0xffffff, 1);
    btnBg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
    // Add black 3D shadow box style
    btnBg.fillStyle(0x000000, 0.4);
    btnBg.fillRect(-btnWidth / 2 + 4, btnHeight / 2, btnWidth, 4);
    
    const btnText = this.add.text(0, 0, 'כניסה למשחק', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: `${Math.max(14, Math.round(height * 0.045))}px`,
      fontWeight: 'bold',
      color: '#ffffff',
    });
    btnText.setOrigin(0.5);

    btnContainer.add([btnBg, btnText]);

    // Make interactive
    const hitArea = new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
    btnContainer.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    // Hover states
    btnContainer.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0xff3399, 1); // Lighter pink
      btnBg.fillRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
      btnBg.lineStyle(3, 0x00e6ff, 1); // Cyan border
      btnBg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
      btnContainer.setScale(1.05);
    });

    btnContainer.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0xff007f, 1);
      btnBg.fillRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
      btnBg.lineStyle(3, 0xffffff, 1);
      btnBg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
      btnContainer.setScale(1);
    });

    // Click behavior
    btnContainer.on('pointerdown', () => {
      btnContainer.setScale(0.95);
      // Play transition effect (fade out camera)
      this.cameras.main.fade(500, 26, 26, 46);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('Day1Scene');
      });
    });

    // Add a pulsing instruction text at the very bottom
    const footerText = this.add.text(width / 2, height * 0.90, 'מיוצר באהבה לגליל 🌴 2026', {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: `${Math.max(10, Math.round(height * 0.03))}px`,
      color: '#a0a0b0',
    });
    footerText.setOrigin(0.5);
    this.tweens.add({
      targets: footerText,
      alpha: 0.4,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
  }
}
