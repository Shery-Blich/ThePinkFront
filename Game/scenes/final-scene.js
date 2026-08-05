import Phaser from 'phaser';
import { Character } from '../entities/character.js';
import { startSceneMusic } from '../systems/bg-music.js';
import { trackGameCompleted } from '../analytics.js';
import { getGlobalScoreSummary } from '../systems/score-manager.js';
import { playDialogOnce } from '../systems/dialog-system.js';

/**
 * FinalScene — The voting booth climax.
 * 
 * Features:
 * - A beautiful neon pixel-style voting booth graphic.
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

    // Play victory dialogue then trigger score popup
    playDialogOnce('FinalScene-dialog', this, [
      { speaker: 'שירי', text: 'סוף סוף הצבעתי! הגיע הזמן לנוח' }
    ], () => {
      this.showScorePopup();
    });
  }

  /**
   * Displays the Kalpi PNG illustration in center screen with floating envelope animation on the middle right wing.
   * @private
   */
  _createVotingBoothGraphic(width, height) {
    const cx = width / 2;
    const cy = height * 0.50;

    let boothWidth = 160 * this.s;

    // Display Kalpi PNG image (large centered asset)
    const kalpiTex = this.textures.exists('kalpi') ? 'kalpi' : (this.textures.exists('day5-bg') ? 'day5-bg' : null);
    if (kalpiTex) {
      const booth = this.add.image(cx, cy, kalpiTex);
      booth.setOrigin(0.5, 0.5);
      const desiredHeight = 220 * this.s; // Bigger Kalpi PNG
      const aspect = (booth.width || 1) / (booth.height || 1);
      boothWidth = aspect * desiredHeight;
      booth.setDisplaySize(boothWidth, desiredHeight);
    } else {
      // Fallback voting booth graphic
      const booth = this.add.graphics();
      booth.fillStyle(0x0f0c1b, 1);
      booth.lineStyle(3 * this.s, 0xff007f, 1);
      booth.fillRoundedRect(cx - 90 * this.s, cy - 60 * this.s, 180 * this.s, 120 * this.s, 8 * this.s);
      booth.strokeRoundedRect(cx - 90 * this.s, cy - 60 * this.s, 180 * this.s, 120 * this.s, 8 * this.s);
      boothWidth = 180 * this.s;
    }

    // Floating envelope graphics
    const envelope = this.add.graphics();
    envelope.fillStyle(0xffffff, 1);
    envelope.fillRect(-18 * this.s, -10 * this.s, 36 * this.s, 20 * this.s);
    envelope.lineStyle(1.5 * this.s, 0x1a1a2e, 1);
    // Draw envelope lines
    envelope.lineBetween(-18 * this.s, -10 * this.s, 0, 0);
    envelope.lineBetween(18 * this.s, -10 * this.s, 0, 0);
    envelope.lineBetween(-18 * this.s, 10 * this.s, -7 * this.s, 0);
    envelope.lineBetween(18 * this.s, 10 * this.s, 7 * this.s, 0);
    envelope.lineBetween(-7 * this.s, 0, 7 * this.s, 0);

    // Position envelope on the middle right wing of the Kalpi PNG
    const envStartX = cx + (boothWidth * 0.22);
    const envStartY = cy - 10 * this.s;
    const envContainer = this.add.container(envStartX, envStartY);
    envContainer.add(envelope);

    // Float animation (hovering at the middle right wing of the ballot box)
    this.tweens.add({
      targets: envContainer,
      y: envStartY + 10 * this.s,
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
    const scoreSummary = getGlobalScoreSummary();
    trackGameCompleted({
      score: scoreSummary.score,
      max_score: scoreSummary.maxScore,
      correct_answers: scoreSummary.correctAnswers,
      answered_questions: scoreSummary.answeredQuestions,
    });
    if (typeof window.showScorePopup === 'function') {
      window.showScorePopup(scoreSummary);
    }

    // Listen for the replay event triggered by the HTML overlay
    window.addEventListener('replay-game-event', () => {
      this.events.emit('complete');
    }, { once: true });
  }
}
