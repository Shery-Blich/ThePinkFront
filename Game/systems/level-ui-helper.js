import { runLevelTrivia, hasLevelTrivia } from './level-trivia.js';
import { LivesManager } from './lives-manager.js';

/**
 * Helper to show victory screen and handle the transition to the level trivia.
 *
 * @param {Phaser.Scene} scene - The current scene instance.
 * @param {string} sceneKey - The key of the current scene (e.g. 'Day1Scene').
 * @param {string} title - The title text for the victory overlay.
 * @param {string} [buttonText='המשך'] - Optional button text for victory overlay.
 */
export function showVictoryHelper(scene, sceneKey, title, message, buttonText = 'המשך') {
  scene.sound.play('sfx-levelup', { volume: 0.6 });
  
  const hasTrivia = hasLevelTrivia(sceneKey);

  if (hasTrivia) {
    runLevelTrivia(scene, sceneKey)
      .catch((err) => {
        console.warn('[Trivia Warning] Fallback triggered on trivia error:', err);
      })
      .finally(() => {
        scene.events.emit('complete');
      });
  } else {
    scene.events.emit('complete');
  }
}

/**
 * Helper to show game over screen and handle scene restart.
 *
 * @param {Phaser.Scene} scene - The current scene instance.
 * @param {string} title - The title text for the game over overlay.
 * @param {string} message - The detail message text for the game over overlay.
 */
export function showGameOverHelper(scene, title, message) {
  if (typeof window.showGameOver === 'function') {
    window.showGameOver(
      title,
      message,
      () => {
        LivesManager.restoreStageStartLives();
        scene.scene.restart();
      }
    );
  } else {
    scene.time.delayedCall(1000, () => {
      LivesManager.restoreStageStartLives();
      scene.scene.restart();
    });
  }
}
