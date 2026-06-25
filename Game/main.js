import Phaser from 'phaser';
import { BootScene } from './scenes/boot-scene.js';
import { Day1Scene } from './scenes/day-1-scene.js';
import { TriviaScene } from './scenes/trivia-scene.js';

/**
 * Phaser game configuration.
 *
 * - No fixed resolution — RESIZE mode matches the device screen exactly
 * - pixelArt: true — nearest-neighbor scaling keeps 16×16 art crisp
 * - Works on any phone, tablet, or desktop at any aspect ratio
 */
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 640,
    height: 360,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  input: {
    activePointers: 1,
  },
  scene: [BootScene, Day1Scene, TriviaScene],
};

// eslint-disable-next-line no-unused-vars
const game = new Phaser.Game(config);
