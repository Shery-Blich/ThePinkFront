import Phaser from 'phaser';
import { Character } from '../entities/character.js';
import { Player } from '../entities/player.js';
import { startSceneMusic } from '../systems/bg-music.js';
import { showVictoryHelper } from '../systems/level-ui-helper.js';
import { LivesManager } from '../systems/lives-manager.js';
import { DialogSystem } from '../systems/dialog-system.js';

/**
 * Day3Scene — Bus Cutscene: Refusal and Acceptance
 *
 * Player walks from supermarket to bus stop.
 * First bus arrives and refuses women passengers.
 * Second bus arrives and accepts all passengers.
 * Player boards second bus and transitions to Day4Scene (catching game).
 */
export class Day3Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Day3Scene' });

    this.s = 1;
    this.roadTop = 0;
    this.roadBottom = 0;
    this.roadCenterY = 0;
    this.sceneEnded = false;
    this.bus1 = null;
    this.bus2 = null;
    this.player = null;
  }

  create() {
    const { width, height } = this.scale;

    LivesManager.showHUD();
    startSceneMusic(this, 'bg-sessions');

    this.s = Character.computeScale(height);
    this.roadTop = Math.round(height * 0.60);
    this.roadBottom = Math.round(height * 0.92);
    const roadHeight = this.roadBottom - this.roadTop;
    this.roadCenterY = this.roadTop + roadHeight / 2;

    // --- Background ---
    this.cameras.main.setBackgroundColor(0x1a1a2e);
    if (this.textures.exists('day3-bg')) {
      this.add.image(width / 2, height / 2, 'day3-bg')
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDisplaySize(width, height)
        .setDepth(-10);
    }

    // Add road band
    this._buildRoadBand(width, roadHeight);

    // Setup physics world
    this.physics.world.setBounds(0, 0, width, height);

    // Create player at supermarket (left side)
    const playerStartX = 100;
    const playerStartY = this.roadCenterY;
    this.player = new Player(this, playerStartX, playerStartY, this.s);
    this.player.disable(); // Start with disabled movement
    this.player.setDepth(this.player.y);

    this.cameras.main.fadeIn(500);

    // Start the cutscene timeline
    this._startCutscene(width);
  }

  update() {
    if (this.player) {
      this.player.update();
      this.player.depthSort();
    }
  }

  _buildRoadBand(width, roadHeight) {
    // Road band graphics
    const roadGfx = this.add.graphics();
    roadGfx.fillStyle(0x333333, 1);
    roadGfx.fillRect(0, this.roadTop, width, roadHeight);
    roadGfx.setScrollFactor(0).setDepth(5);

    // Road center line
    const lineGfx = this.add.graphics();
    lineGfx.fillStyle(0xffff00, 0.7);
    lineGfx.fillRect(0, this.roadCenterY - 2, width, 4);
    lineGfx.setScrollFactor(0).setDepth(5);
  }

  _startCutscene(width) {
    // Start with player walking to bus stop
    this._playerWalksToBusStop(width);
  }

  _playerWalksToBusStop(width) {
    // Player walks from left (supermarket) to center (bus stop)
    const targetX = width / 2;

    this.tweens.add({
      targets: this.player,
      x: targetX,
      duration: 3000,
      ease: 'Linear',
      onComplete: () => {
        // Wait 1 second, then first bus arrives
        this.time.delayedCall(1000, () => {
          this._spawnFirstBus(width);
        });
      }
    });
  }

  _spawnFirstBus(width) {
    // First bus enters from left
    this.bus1 = this.add.image(-100 * this.s, this.roadCenterY, 'egged_bus');
    this.bus1.setScale(this.s).setDepth(100);

    this.tweens.add({
      targets: this.bus1,
      x: width / 2 - 50 * this.s,
      duration: 2500,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // Bus settled - show refusal dialog
        this.time.delayedCall(500, () => {
          this._showRefusalDialog(width);
        });
      }
    });
  }

  _showRefusalDialog(width) {
    // Show refusal dialog
    const refusalDialog = [
      { speaker: 'Bus Driver', text: 'סליחה גברת, זה אוטובוס לגברים בלבד' },
      { speaker: 'Player', text: 'אבל זה לא חוקי!' },
    ];

    const dialog = new DialogSystem(this, refusalDialog, () => {
      // Dialog complete - bus leaves after 1 second
      this.time.delayedCall(1000, () => {
        this._firstBusLeaves(width);
      });
    });
    dialog.start();
  }

  _firstBusLeaves(width) {
    // First bus drives away to the right
    this.tweens.add({
      targets: this.bus1,
      x: width + 100 * this.s,
      duration: 2000,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (this.bus1) this.bus1.destroy();

        // Wait 1 second, then second bus arrives
        this.time.delayedCall(1000, () => {
          this._spawnSecondBus(width);
        });
      }
    });
  }

  _spawnSecondBus(width) {
    // Second bus enters from left
    this.bus2 = this.add.image(-100 * this.s, this.roadCenterY, 'egged_bus');
    this.bus2.setScale(this.s).setDepth(100);

    this.tweens.add({
      targets: this.bus2,
      x: width / 2 - 50 * this.s,
      duration: 2500,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // Bus settled - show acceptance dialog
        this.time.delayedCall(500, () => {
          this._showAcceptanceDialog(width);
        });
      }
    });
  }

  _showAcceptanceDialog(width) {
    // Show acceptance dialog
    const acceptanceDialog = [
      { speaker: 'Bus Driver', text: 'תכניסו כמה שיותר אנשים לאוטובוס, כדי שכל מי שיש לו זכות הצבעה יוכל להגיע לקלפי.' },
      { speaker: 'Narrator', text: 'סוף הסצנה - יאללה לירושלים!' },
    ];

    const dialog = new DialogSystem(this, acceptanceDialog, () => {
      // Dialog complete - player boards bus
      this.time.delayedCall(1000, () => {
        this._playerBoardsBus();
      });
    });
    dialog.start();
  }

  _playerBoardsBus() {
    // Player walks to bus door and boards
    const doorX = this.bus2.x + 24 * this.s;
    const doorY = this.bus2.y + 6 * this.s;

    this.tweens.add({
      targets: this.player,
      x: doorX,
      y: doorY,
      duration: 1200,
      ease: 'Linear',
      onComplete: () => {
        // Player enters bus - make invisible
        this.player.setVisible(false);

        // Wait for bus doors to close and depart
        this.time.delayedCall(800, () => {
          this.bus2.setTexture('egged_bus');
        });

        this.time.delayedCall(1200, () => {
          // Bus departs
          const { width } = this.scale;
          this.tweens.add({
            targets: this.bus2,
            x: width + 100 * this.s,
            duration: 2000,
            ease: 'Quad.easeIn',
            onComplete: () => {
              if (this.bus2) this.bus2.destroy();
              this._endScene();
            }
          });
        });
      }
    });
  }

  _endScene() {
    if (this.sceneEnded) return;
    this.sceneEnded = true;

    showVictoryHelper(
      this,
      'Day3Scene',
      'נמשיך לירושלים!',
      'האוטובוס קיבל את כולנו וממשיך לדרך. הגיע הזמן לעזור לאנשים שנופלים!'
    );

    // Emit complete event for orchestrator - with slight delay to let victory screen show
    this.time.delayedCall(2500, () => {
      this.events.emit('complete');
    });
  }
}
