import Phaser from "phaser";
import { createApp } from "vue";
import { BootScene } from "./scenes/boot-scene.js";
import { Day1Scene } from "./scenes/day-1-scene.js";
import { Day2Scene } from "./scenes/day-2-scene.js";
import { Day3Scene } from "./scenes/day-3-scene.js";
import { Day4Scene } from "./scenes/day-4-scene.js";
import { KotelScene } from "./scenes/kotel-scene.js";
import { KalpiScene } from "./scenes/kalpi-scene.js";
import { FinalScene } from "./scenes/final-scene.js";
import { SceneOrchestrator } from "./systems/scene-orchestrator.js";
import { resetLevelTrivia } from "./systems/level-trivia.js";
import { resetGlobalScore } from "./systems/score-manager.js";
import { LivesManager } from "./systems/lives-manager.js";
import { trackGameStarted } from "./analytics.js";
import TriviaOverlay from "./components/trivia-overlay.vue";

/**
 * Phaser game configuration.
 *
 * - No fixed resolution — RESIZE mode matches the device screen exactly
 * - pixelArt: true — nearest-neighbor scaling keeps 16×16 art crisp
 * - Works on any phone, tablet, or desktop at any aspect ratio
 */
const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  backgroundColor: "#1a1a2e",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 640,
    height: 360,
  },
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },
  input: {
    activePointers: 2,
    // Force touch support on rather than relying on Phaser's one-time
    // Device.input.touch capability snapshot (taken when the library first
    // loads). If the page happens to load before touch is detectable — e.g.
    // a desktop-sized viewport that's later resized into a touch-emulated
    // or hybrid-device mode — that snapshot stays false for the rest of the
    // page's life and Phaser never attaches its touch listeners at all,
    // silently breaking touch/drag input (joystick, pedals, etc.) even
    // though touchstart events are reaching the canvas just fine.
    touch: true,
  },
  scene: [
    BootScene,
    Day1Scene,
    Day2Scene,
    Day3Scene,
    Day4Scene,
    KotelScene,
    KalpiScene,
    FinalScene,
  ],
};

const game = new Phaser.Game(config);
window.game = game; // Expose globally for resize handling

window.addEventListener('start-game', () => {
  LivesManager.showHUD();
  resetLevelTrivia();
  resetGlobalScore();
  trackGameStarted();
});

// Connect all the stages in chronological order using the Orchestrator
new SceneOrchestrator(game, [
  Day1Scene,
  Day2Scene,
  Day3Scene,
  Day4Scene,
  KotelScene,
  KalpiScene,
  FinalScene,
]);

// Mount the Vue trivia overlay component
createApp(TriviaOverlay).mount("#trivia-app");
