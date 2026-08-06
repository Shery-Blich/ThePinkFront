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
    if (this.textures.exists('telaviv-bg')) {
      this.add.image(width / 2, height / 2, 'telaviv-bg')
        .setOrigin(0.5, 0.5)
        .setDisplaySize(width, height)
        .setDepth(-10);
    }

    // Play victory dialogue then trigger score popup
    playDialogOnce('FinalScene-dialog', this, [
      { speaker: 'שירי', text: 'סוף סוף הצבעתי! הגיע הזמן לנוח' }
    ], () => {
      this.showScorePopup();
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
