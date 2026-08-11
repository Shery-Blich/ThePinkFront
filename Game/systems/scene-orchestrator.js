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
    this.levelInfo = {
      Day1Scene: { title: "ההתחלה: קלפי קריית שמונה", subtitle: "מתחילים את המסע לירושלים!" },
      Day2Scene: { title: "ההכנה: סופר בארץ", subtitle: "יוקר המחייה בימינו..." },
      Day3Scene: { title: "היציאה: תחב\"צ בארץ", subtitle: "מתקדמים אל עבר הבירה!" },
      Day4Scene: { title: "הנסיעה: מי שבא ברוך הבא", subtitle: "מאבק על כל קול" },
      KotelScene: { title: "ההגעה: עולים לרגל", subtitle: "רגע של תקווה ואחדות!" },
      KalpiScene: { title: "הרגע לפני האחרון: הקלפי", subtitle: "מממשים את זכות הבחירה!" },
      FinalScene: { title: "הסיום: תוצאות האמת", subtitle: "תוצאות הבחירות!" },
    };

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
   * @param {boolean} [skipLoadingScreen=false] - Whether to skip HTML loading screen overlay
   */
  startSceneAtIndex(index, skipLoadingScreen = false) {
    if (index >= 0 && index < this.sceneOrder.length) {
      const targetSceneKey = this.sceneOrder[index];
      console.log(`SceneOrchestrator: Transitioning to stage "${targetSceneKey}" (index: ${index})`);

      if (index === 0) {
        LivesManager.resetLives();
      } else {
        LivesManager.recordStageStartLives();
      }

      const info = this.levelInfo[targetSceneKey] || { title: "טוען...", subtitle: "הכנות אחרונות" };

      const stageNumber = index + 1;
      if (!skipLoadingScreen && window.showLoadingScreen) {
        window.showLoadingScreen(info.title, info.subtitle, () => {
          // Ensure BootScene or other scenes are stopped before starting the target
          this.game.scene.scenes.forEach(scene => {
            if (scene.scene.key !== targetSceneKey) {
              this.game.scene.stop(scene.scene.key);
            }
          });

          const sceneInstance = this.game.scene.getScene(targetSceneKey);

          let hidden = false;
          const hideOverlay = () => {
            if (hidden) return;
            hidden = true;
            if (window.hideLoadingScreen) {
              window.hideLoadingScreen();
            }
          };

          if (sceneInstance) {
            // Track asset load progress on the progress bar
            sceneInstance.load.off('progress');
            sceneInstance.load.on('progress', (val) => {
              if (window.updateLoadingProgress) {
                window.updateLoadingProgress(Math.round(val * 100));
              }
            });

            // Only hide loading overlay when scene creation (and asset loading) completes
            sceneInstance.events.once('create', () => {
              setTimeout(hideOverlay, 150);
            });
          }

          // Fallback safety timeout in case of slow network/no assets
          setTimeout(hideOverlay, 10000);

          this.game.scene.start(targetSceneKey);
        }, stageNumber, targetSceneKey);
      } else {
        // Fallback or direct transition without loading screen overlay
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
          const skipLoading = (completedSceneKey === 'Day3Scene');
          this.startSceneAtIndex(nextIndex, skipLoading);
        } else {
          console.log('SceneOrchestrator: All stages completed. Resetting to main menu.');
          this.resetToMainMenu();
        }
      });
    } else {
      // Fallback transition if the completed scene object is unavailable
      const nextIndex = completedIndex + 1;
      if (nextIndex < this.sceneOrder.length) {
        const skipLoading = (completedSceneKey === 'Day3Scene');
        this.startSceneAtIndex(nextIndex, skipLoading);
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
