import Phaser from 'phaser';
import { DialogSystem } from '../systems/dialog-system.js';
import { Character } from '../entities/character.js';
import { startSceneMusic } from '../systems/bg-music.js';
import { trackGameCompleted } from '../analytics.js';

/**
 * FinalScene — The voting booth climax.
 * 
 * Features:
 * - A beautiful neon pixel-style voting booth graphic.
 * - Dialogue acknowledging reaching the booth.
 * - A premium retro score overlay with share, Instagram, and website buttons.
 */
export class FinalScene extends Phaser.Scene {
  constructor() {
    super({ key: 'FinalScene' });
    this.s = 1; // scale factor
  }

  create() {
    const { width, height } = this.scale;
    this.s = Character.computeScale(height);

    startSceneMusic(this, 'bg-end');

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

    // --- Stylized Voting Booth Backdrop (Graphic Placeholder) ---
    this._createVotingBoothGraphic(width, height);

    // --- Start Climax Dialogue ---
    const dialogueLines = [
      { speaker: 'שלומי', text: 'וואו, סוף סוף הגעתי לתא ההצבעה!' }
    ];

    const dialog = new DialogSystem(this, dialogueLines, () => {
      this.showScorePopup();
    });
    dialog.start();
  }

  /**
   * Draws a premium retro voting box illustration with float animation.
   * @private
   */
  _createVotingBoothGraphic(width, height) {
    const cx = width / 2;
    const cy = height * 0.42;

    // Draw Voting Box Container
    const booth = this.add.graphics();
    booth.fillStyle(0x0f0c1b, 1);
    booth.lineStyle(3 * this.s, 0xff007f, 1); // Neon pink border
    booth.fillRoundedRect(cx - 60 * this.s, cy - 40 * this.s, 120 * this.s, 80 * this.s, 8 * this.s);
    booth.strokeRoundedRect(cx - 60 * this.s, cy - 40 * this.s, 120 * this.s, 80 * this.s, 8 * this.s);

    // Add slot details
    booth.fillStyle(0x00e6ff, 1); // Neon cyan slot glow
    booth.fillRect(cx - 30 * this.s, cy - 25 * this.s, 60 * this.s, 6 * this.s);
    booth.fillStyle(0x000000, 1);
    booth.fillRect(cx - 28 * this.s, cy - 23 * this.s, 56 * this.s, 2 * this.s);

    // Box label
    const voteLabel = this.add.text(cx, cy + 15 * this.s, 'הצביעו', {
      fontFamily: 'monospace',
      fontSize: `${18 * this.s}px`,
      fontWeight: '900',
      color: '#00e6ff'
    });
    voteLabel.setOrigin(0.5);
    voteLabel.setStroke('#000000', 4 * this.s);

    // Floating envelope graphics
    const envelope = this.add.graphics();
    envelope.fillStyle(0xffffff, 1);
    envelope.fillRect(-20 * this.s, -12 * this.s, 40 * this.s, 24 * this.s);
    envelope.lineStyle(1.5 * this.s, 0x1a1a2e, 1);
    // Draw envelope lines
    envelope.lineBetween(-20 * this.s, -12 * this.s, 0, 0);
    envelope.lineBetween(20 * this.s, -12 * this.s, 0, 0);
    envelope.lineBetween(-20 * this.s, 12 * this.s, -8 * this.s, 0);
    envelope.lineBetween(20 * this.s, 12 * this.s, 8 * this.s, 0);
    envelope.lineBetween(-8 * this.s, 0, 8 * this.s, 0);

    const envContainer = this.add.container(cx, cy - 65 * this.s);
    envContainer.add(envelope);

    // Float animation
    this.tweens.add({
      targets: envContainer,
      y: cy - 54 * this.s,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  /**
   * Delegates the display of the final score screen to the responsive HTML overlay APIs.
   */
  showScorePopup() {
    trackGameCompleted();
    if (typeof window.showScorePopup === 'function') {
      window.showScorePopup();
    }

    // Listen for the replay event triggered by the HTML overlay
    window.addEventListener('replay-game-event', () => {
      this.events.emit('complete');
    }, { once: true });
  }
}
