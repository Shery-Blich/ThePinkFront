import { runLevelTrivia, hasLevelTrivia } from './level-trivia.js';

/**
 * Helper to show victory screen and handle the transition to the level trivia.
 *
 * @param {Phaser.Scene} scene - The current scene instance.
 * @param {string} sceneKey - The key of the current scene (e.g. 'Day1Scene').
 * @param {string} title - The title text for the victory overlay.
 * @param {string} message - The detail message text for the victory overlay.
 */
export function showVictoryHelper(scene, sceneKey, title, message) {
  scene.sound.play('sfx-levelup', { volume: 0.6 });
  
  const hasTrivia = hasLevelTrivia(sceneKey);
  const buttonText = hasTrivia ? 'למעבר לחידון' : 'לשלב הבא';

  if (typeof window.showVictoryScreen === 'function') {
    window.showVictoryScreen(
      title,
      message,
      buttonText,
      async () => {
        await runLevelTrivia(scene, sceneKey);
        scene.events.emit('complete');
      }
    );
  } else {
    runLevelTrivia(scene, sceneKey).then(() => {
      scene.events.emit('complete');
    });
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
        scene.scene.restart();
      }
    );
  } else {
    scene.time.delayedCall(1000, () => {
      scene.scene.restart();
    });
  }
}
