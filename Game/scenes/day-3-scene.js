import Phaser from 'phaser';
import { Character } from '../entities/character.js';
import { Player } from '../entities/player.js';
import { startSceneMusic } from '../systems/bg-music.js';
import { showVictoryHelper } from '../systems/level-ui-helper.js';
import { LivesManager } from '../systems/lives-manager.js';
import { DialogSystem } from '../systems/dialog-system.js';

/**
 * Day3Scene — Bus Cutscene: Supermarket Exit, Bus Stop, Refusal and Acceptance
 *
 * Player walks from supermarket exit to bottom sidewalk bus stop.
 * First bus arrives and refuses women passengers.
 * Second bus arrives, opens doors, and accepts all passengers.
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
    this.supermarketX = 0;
  }

  create() {
    const { width, height } = this.scale;

    LivesManager.showHUD();
    startSceneMusic(this, 'bg-sessions');

    this.s = Character.computeScale(height);
    this.roadTop = Math.round(height * 0.55);
    this.roadBottom = Math.round(height * 0.82);
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

    // Add road band & sidewalk
    this._buildRoadBand(width, height, roadHeight);

    // Build Supermarket building at top-left
    this.supermarketX = 90 * this.s;
    this._buildSupermarket(this.supermarketX);

    // Build Bus Stop on bottom sidewalk
    const busStopX = width / 2;
    const busStopY = this.roadBottom + 12 * this.s;
    this._buildBusStop(busStopX, busStopY);

    // Setup physics world
    this.physics.world.setBounds(0, 0, width, height);

    // Create player emerging from supermarket door
    const doorX = this.supermarketX;
    const doorY = this.roadTop - 8 * this.s;
    this.player = new Player(this, doorX, doorY, this.s);
    this.player.disable();
    this.player.setDepth(this.player.y);

    this.cameras.main.fadeIn(500);

    // Start cutscene timeline
    this._startCutscene(width, busStopX, busStopY);
  }

  update() {
    if (this.player) {
      this.player.update();
      this.player.depthSort();
    }
  }

  _buildSupermarket(x) {
    const s = this.s;
    const w = 70 * s;
    const h = 85 * s;
    const doorW = 18 * s;
    const doorH = 30 * s;

    const gfx = this.add.graphics();
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(x - w / 2, this.roadTop - h, w, h);

    gfx.fillStyle(0xe11d48, 1);
    gfx.fillRect(x - w / 2, this.roadTop - h, w, 8 * s);

    gfx.fillStyle(0x110e1a, 1);
    gfx.fillRect(x - doorW / 2, this.roadTop - doorH, doorW, doorH);
    gfx.setDepth(4);

    this.add.text(x, this.roadTop - h + 12 * s, 'סופרמרקט', {
      fontFamily: 'Arial, sans-serif',
      fontSize: `${Math.max(10, Math.round(10 * s))}px`,
      fontWeight: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5, 0).setDepth(5);
  }

  _buildBusStop(x, y) {
    const s = this.s;

    if (this.textures.exists('bus-stop')) {
      const busStopSprite = this.add.image(x, y, 'bus-stop');
      busStopSprite.setOrigin(0.5, 1);
      const targetH = 55 * s;
      const tex = this.textures.get('bus-stop').getSourceImage();
      if (tex) {
        const aspect = tex.width / tex.height;
        busStopSprite.setDisplaySize(targetH * aspect, targetH);
      } else {
        busStopSprite.setDisplaySize(32 * s, 55 * s);
      }
      busStopSprite.setDepth(y);
    } else {
      const gfx = this.add.graphics();
      gfx.fillStyle(0x64748b, 1);
      gfx.fillRect(x - 2 * s, y - 45 * s, 4 * s, 45 * s);
      gfx.fillStyle(0x0284c7, 1);
      gfx.fillRect(x - 16 * s, y - 55 * s, 32 * s, 16 * s);
      gfx.fillStyle(0xfacc15, 1);
      gfx.fillRect(x - 12 * s, y - 52 * s, 24 * s, 10 * s);
      gfx.setDepth(y);
    }
  }

  _buildRoadBand(width, height, roadHeight) {
    const roadGfx = this.add.graphics();
    roadGfx.fillStyle(0x333333, 1);
    roadGfx.fillRect(0, this.roadTop, width, roadHeight);
    roadGfx.setScrollFactor(0).setDepth(2);

    const lineGfx = this.add.graphics();
    lineGfx.fillStyle(0xffff00, 0.7);
    lineGfx.fillRect(0, this.roadCenterY - 2, width, 4);
    lineGfx.setScrollFactor(0).setDepth(2);

    const swGfx = this.add.graphics();
    swGfx.fillStyle(0x555555, 1);
    swGfx.fillRect(0, this.roadBottom, width, height - this.roadBottom);
    swGfx.lineStyle(2, 0x444444, 1);
    swGfx.strokeRect(0, this.roadBottom, width, height - this.roadBottom);
    swGfx.setScrollFactor(0).setDepth(3);
  }

  _startCutscene(width, busStopX, busStopY) {
    this._playerExitsSupermarket(width, busStopX, busStopY);
  }

  _playerExitsSupermarket(width, busStopX, busStopY) {
    this.tweens.add({
      targets: this.player,
      y: this.roadCenterY,
      duration: 1000,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.time.delayedCall(300, () => {
          this._playerWalksToBusStop(width, busStopX, busStopY);
        });
      }
    });
  }

  _playerWalksToBusStop(width, busStopX, busStopY) {
    const targetX = busStopX - 25 * this.s;
    const targetY = busStopY;

    this.tweens.add({
      targets: this.player,
      x: targetX,
      y: targetY,
      duration: 2200,
      ease: 'Linear',
      onComplete: () => {
        this.time.delayedCall(1000, () => {
          this._spawnFirstBus(width, busStopX);
        });
      }
    });
  }

  _spawnFirstBus(width, busStopX) {
    this.bus1 = this.add.image(-100 * this.s, this.roadCenterY, 'egged_bus');
    this.bus1.setScale(this.s).setDepth(100);

    this.tweens.add({
      targets: this.bus1,
      x: busStopX - 40 * this.s,
      duration: 2500,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.time.delayedCall(300, () => {
          this._showRefusalDialog(width, busStopX);
        });
      }
    });
  }

  _showRefusalDialog(width, busStopX) {
    const refusalDialog = [
      { speaker: 'נהג האוטובוס', text: 'סליחה גברת, זה אוטובוס לגברים בלבד!' },
      { speaker: 'שירי', text: 'מה?! אבל זה לא חוקי!' },
    ];

    const dialog = new DialogSystem(this, refusalDialog, () => {
      this.time.delayedCall(500, () => {
        this._firstBusLeaves(width, busStopX);
      });
    });
    dialog.start();
  }

  _firstBusLeaves(width, busStopX) {
    this.tweens.add({
      targets: this.bus1,
      x: width + 100 * this.s,
      duration: 2000,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (this.bus1) this.bus1.destroy();

        this.time.delayedCall(800, () => {
          this._spawnSecondBus(width, busStopX);
        });
      }
    });
  }

  _spawnSecondBus(width, busStopX) {
    this.bus2 = this.add.image(-100 * this.s, this.roadCenterY, 'egged_bus');
    this.bus2.setScale(this.s).setDepth(100);

    this.tweens.add({
      targets: this.bus2,
      x: busStopX - 40 * this.s,
      duration: 2500,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // Open bus doors!
        if (this.textures.exists('egged_bus_open')) {
          this.bus2.setTexture('egged_bus_open');
        }

        this.time.delayedCall(300, () => {
          this._playerBoardsBus();
        });
      }
    });
  }

  _playerBoardsBus() {
    // Door entrance coordinate on bus2
    const doorX = this.bus2.x + 24 * this.s;
    const doorY = this.bus2.y + 6 * this.s;

    // Player walks up from sidewalk to bus open door and fades inside
    this.tweens.add({
      targets: this.player,
      x: doorX,
      y: doorY,
      duration: 600,
      ease: 'Linear',
      onComplete: () => {
        this.tweens.add({
          targets: this.player,
          alpha: 0,
          scaleX: 0.1,
          scaleY: 0.1,
          duration: 200,
          ease: 'Quad.easeIn',
          onComplete: () => {
            this.player.setVisible(false);

            if (this.textures.exists('egged_bus')) {
              this.bus2.setTexture('egged_bus');
            }

            const { width } = this.scale;
            this.tweens.add({
              targets: this.bus2,
              x: width + 120 * this.s,
              duration: 1000,
              ease: 'Quad.easeIn',
              onComplete: () => {
                if (this.bus2) this.bus2.destroy();
                this._endScene();
              }
            });
          }
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
      'לירושלים!',
      'לירושלים!'
    );
  }
}
