import Phaser from 'phaser';
import { LivesManager } from './lives-manager.js';

/**
 * SceneOrchestrator — Connects and manages scene flow.
 * 
 * It holds the order of playable stages in an array and manages the transitions
 * between them. Individual scenes remain completely unaware of the orchestrator;
 * they simply emit a standard 'complete' event when they are finished, and this
 * class listens for those events and coordinates the next scene or menu transition.
 */
export class SceneOrchestrator {
  /**
   * @param {Phaser.Game} game - The Phaser game instance.
   * @param {Function[]} sceneClasses - The ordered list of scene classes to run.
   */
  constructor(game, sceneClasses) {
    this.game = game;
    this.sceneClasses = sceneClasses;
    this.sceneOrder = []; // Will store the resolved string keys of the scenes

    // Define level titles and subtitles for the loading screens
    this.levelInfo = [
      { title: "יום 1: קלפי קריית שמונה", subtitle: "מתחילים את המסע לירושלים!" },
      { title: "יום 2: מחסום בצפון", subtitle: "הוועדה לא מאשרת כל כך בקלות..." },
      { title: "יום 3: הכביש המהיר", subtitle: "מתקדמים אל עבר הבירה!" },
      { title: "יום 4: הכנסת", subtitle: "בלב מקבלת ההחלטות" },
      { title: "יום 5: ועדת הבחירות המרכזית", subtitle: "מאבק על כל קול!" },
      { title: "הכותל המערבי", subtitle: "רגע של תקווה ואחדות" },
      { title: "הקלפי בירושלים", subtitle: "מממשים את זכות הבחירה!" },
      { title: "הניצחון הוורוד", subtitle: "תוצאות האמת!" }
    ];

    // Wait for the game instance to boot and be ready before initializing scene links
    this.game.events.once('ready', () => {
      this.init();
    });
  }

  /**
   * Connects event listeners to all managed scenes.
   */
  init() {
    console.log('SceneOrchestrator: Initializing scene flow...');

    // Resolve the string keys from the provided scene classes
    this.sceneOrder = this.sceneClasses.map(SceneClass => {
      let instance = this.game.scene.scenes.find(s => s instanceof SceneClass);
      if (!instance && SceneClass.name) {
        instance = this.game.scene.scenes.find(s => s.sys && (s.sys.settings.key === SceneClass.name || s.constructor.name === SceneClass.name));
      }
      if (instance) {
        return instance.sys.settings.key;
      } else {
        console.warn(`SceneOrchestrator: Could not find instantiated scene for class:`, SceneClass);
        return null;
      }
    }).filter(Boolean);

    // 1. Listen for BootScene complete event to kick off the first playable scene
    const bootScene = this.game.scene.getScene('BootScene');
    if (bootScene) {
      bootScene.events.on('complete', () => {
        console.log('SceneOrchestrator: BootScene complete. Starting first playable stage.');
        this.startSceneAtIndex(0);
      });
    } else {
      console.warn('SceneOrchestrator: BootScene not found in the game scene manager.');
    }

    // 2. Listen to complete events for each stage in the running sequence
    this.sceneOrder.forEach((sceneKey, index) => {
      const scene = this.game.scene.getScene(sceneKey);
      if (scene) {
        scene.events.on('complete', () => {
          console.log(`SceneOrchestrator: Stage "${sceneKey}" completed.`);
          this.handleSceneComplete(index);
        });
      } else {
        console.warn(`SceneOrchestrator: Configured scene "${sceneKey}" not found in the game scene manager.`);
      }
    });
  }

  /**
   * Starts a scene at a specific index in our sequence.
   * @param {number} index
   */
  startSceneAtIndex(index) {
    if (index >= 0 && index < this.sceneOrder.length) {
      const targetSceneKey = this.sceneOrder[index];
      console.log(`SceneOrchestrator: Transitioning to stage "${targetSceneKey}" (index: ${index})`);

      const info = this.levelInfo[index] || { title: "טוען...", subtitle: "הכנות אחרונות" };

      if (window.showLoadingScreen) {
        window.showLoadingScreen(info.title, info.subtitle, () => {
          // Ensure BootScene or other scenes are stopped before starting the target
          this.game.scene.scenes.forEach(scene => {
            if (scene.scene.key !== targetSceneKey) {
              this.game.scene.stop(scene.scene.key);
            }
          });

          this.game.scene.start(targetSceneKey);

          // Get the newly started scene instance
          const sceneInstance = this.game.scene.getScene(targetSceneKey);
          if (sceneInstance) {
            // Pause the scene update/timers and pause all sounds
            sceneInstance.scene.pause();
            this.game.sound.pauseAll();
          }

          // Wait a brief delay (300ms) to ensure Phaser has completed its synchronous initialization (create() method)
          setTimeout(() => {
            if (window.hideLoadingScreen) {
              window.hideLoadingScreen();
            }
            // Resume the scene and sounds
            if (sceneInstance) {
              sceneInstance.scene.resume();
              this.game.sound.resumeAll();
            }
          }, 300);
        });
      } else {
        // Fallback without loading screen
        this.game.scene.scenes.forEach(scene => {
          if (scene.scene.key !== targetSceneKey) {
            this.game.scene.stop(scene.scene.key);
          }
        });
        this.game.scene.start(targetSceneKey);
      }
    } else {
      console.error(`SceneOrchestrator: Attempted to start invalid scene index: ${index}`);
    }
  }

  /**
   * Transitions from the completed scene to the next scene in the order.
   * If there are no more scenes, returns to the main HTML menu.
   * @param {number} completedIndex
   */
  handleSceneComplete(completedIndex) {
    const completedSceneKey = this.sceneOrder[completedIndex];
    const completedScene = this.game.scene.getScene(completedSceneKey);

    const fadeDuration = 600;

    if (completedScene) {
      // Play a premium camera fade out transition before stopping the scene (RGB 18, 18, 28 maps to #12121c)
      completedScene.cameras.main.fade(fadeDuration, 18, 18, 28);
      completedScene.cameras.main.once('camerafadeoutcomplete', () => {
        this.game.scene.stop(completedSceneKey);

        const nextIndex = completedIndex + 1;
        if (nextIndex < this.sceneOrder.length) {
          this.startSceneAtIndex(nextIndex);
        } else {
          console.log('SceneOrchestrator: All stages completed. Resetting to main menu.');
          this.resetToMainMenu();
        }
      });
    } else {
      // Fallback transition if the completed scene object is unavailable
      const nextIndex = completedIndex + 1;
      if (nextIndex < this.sceneOrder.length) {
        this.startSceneAtIndex(nextIndex);
      } else {
        this.resetToMainMenu();
      }
    }
  }

  /**
   * Resets the game state and returns back to the HTML main menu overlay.
   */
  resetToMainMenu() {
    window.gameStarted = false;
    LivesManager.hideHUD();

    // Display the HTML welcome/menu screen again with smooth transition
    const menu = document.getElementById('html-menu');
    if (menu) {
      menu.style.display = 'flex';
      // Force reflow
      menu.offsetHeight;
      menu.style.opacity = '1';
    }

    // Load BootScene back so it's ready to handle start-game event again
    this.game.scene.start('BootScene');
  }
}
