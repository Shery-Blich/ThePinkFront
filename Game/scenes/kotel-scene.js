import Phaser from 'phaser';
import { Character } from '../entities/character.js';
import { Player } from '../entities/player.js';
import { Banana } from '../entities/banana.js';
import { startSceneMusic } from '../systems/bg-music.js';
import { showVictoryHelper, showGameOverHelper } from '../systems/level-ui-helper.js';
import { LivesManager } from '../systems/lives-manager.js';
import { addGlobalScore } from '../systems/score-manager.js';
import { playDialogOnce } from '../systems/dialog-system.js';
import { KOTEL_INTRO_DIALOG, KOTEL_VICTORY_DIALOG } from '../data/dialog-data.js';
import { updateCharacterAnimation } from '../systems/character-animator.js';

// How many character-widths wide the world is
const WORLD_CHARS_WIDE = 120;

export class KotelScene extends Phaser.Scene {
  constructor() {
    super({ key: 'KotelScene' });

    /** @type {Player} */
    this.player = null;

    /** @type {Phaser.Physics.Arcade.Sprite} */
    this.president = null;

    /** @type {Phaser.GameObjects.Text} */
    this.presidentLabel = null;

    /** @type {number} sprite scale factor */
    this.s = 1;

    /** @type {number} */
    this.roadTop = 0;

    /** @type {number} */
    this.roadBottom = 0;

    /** @type {boolean} */
    this.isSceneOver = false;

    /** @type {boolean} */
    this.gameplayStarted = false;

    // --- President movement & chase state ---
    this.chaseTimer = 0;
    this.targetVx = 0;
    this.targetVy = 0;

    /** @type {number} */
    this.bananasDropped = 0;
    /** @type {number} Max bananas President will drop (7 total) */
    this.maxBananas = 7;
    /** @type {number} Timer tracking 2.5s banana drop intervals */
    this.bananaDropTimer = 0;
    /** @type {Banana[]} Active banana objects */
    this.activeBananas = [];
    /** @type {number} Total bananas that hit/slid the player */
    this.bananasHitCount = 0;
  }

  /**
   * Lazy-loads the shared end-game background music.
   * bg-end is shared between KotelScene, KalpiScene, and FinalScene — only
   * downloaded once; subsequent scenes find it in the audio cache.
   */
  preload() {
    // ── Kotel panoramic background images ──
    const imgAssets = [
      ['kotel-start',        'assets/backgrounds/kotel-start.webp'],
      ['kotel-mid',          'assets/backgrounds/kotel-mid.webp'],
      ['kotel-end',          'assets/backgrounds/kotel-end.webp'],
      ['kotel-panoramic-bg', 'assets/backgrounds/Kotel-panoramic.webp'],
      ['kotel-bg',           'assets/backgrounds/Kotel-panoramic.webp'],
      ['nassi-2',            'assets/Characters/Nassi-2.webp'],
      ['bus-stop',           'assets/Ellements/bus_stop_jerusalem_transparent.webp'],
    ];
    imgAssets.forEach(([key, path]) => {
      if (!this.textures.exists(key)) this.load.image(key, path);
    });
    // ── Audio ──
    if (!this.cache.audio.exists('bg-end')) {
      this.load.audio('bg-end', 'assets/sounds/gaming-for-end.mp3');
    }
  }

  create() {
    const { width, height } = this.scale;

    startSceneMusic(this, 'bg-end');

    // --- Reset states ---
    this.isSceneOver = false;
    this.gameplayStarted = false;
    this.chaseTimer = 0;
    this.targetVx = 0;
    this.targetVy = 0;
    this.bananasDropped = 0;
    this.bananaDropTimer = 0;
    this.activeBananas = [];
    this.bananasHitCount = 0;

    // --- Scale from screen height ---
    this.s = Character.computeScale(height);

    const charH = 20 * this.s;
    const charW = 12 * this.s;

    // --- Road band (Jerusalem Plaza floor) ---
    this.roadTop = Math.round(height * 0.60);
    this.roadBottom = Math.round(height * 0.92);
    const roadHeight = this.roadBottom - this.roadTop;
    const roadCenterY = this.roadTop + roadHeight / 2;

    // --- World size ---
    const worldWidth = WORLD_CHARS_WIDE * charW;

    // --- Background ---
    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // 1. Draw the Kotel backdrop image
    this._buildKotelBackground(worldWidth, this.roadTop);

    // 2. Draw Jerusalem Stone Road Plaza & Upper Sidewalk
    this._buildJerusalemPlaza(worldWidth, roadHeight);

    // --- Bus stop on upper sidewalk ---
    const busStopX = 120 * this.s;
    const busStopY = this.roadTop;
    this._buildBusStop(busStopX, busStopY);

    // --- Start position for cutscene ---
    const startX = busStopX;
    const startY = this.roadTop - 2 * this.s;

    // --- Player ---
    this.player = new Player(this, startX, startY, this.s);
    this.player.setWorldBounds(0, this.roadTop, worldWidth, roadHeight);
    this.player.disable(); // Disabled for cutscene
    this.player.setVisible(false); // Initially hidden before bus arrives!
    this.player.setDepth(this.player.y);

    // --- President NPC (positioned roughly one player width outside initial viewing screen width) ---
    const presStartX = width + 12 * this.s;
    const presStartY = Phaser.Math.Clamp(
      roadCenterY,
      this.roadTop + 30 * this.s,
      this.roadBottom - 10 * this.s
    );
    this.president = this.physics.add.sprite(presStartX, presStartY, 'nassi-2');
    const texW = this.president.width || 24;
    const texH = this.president.height || 40;
    const targetHeight = 20 * this.s;
    const targetWidth = (texW / texH) * targetHeight;
    const scaleX = targetWidth / texW;
    const scaleY = targetHeight / texH;

    this.president.setScale(scaleX, scaleY);
    this.president.setOrigin(0.5, 1);
    this.president.body.setCollideWorldBounds(true);
    
    // Set up bottom-half collision body in un-scaled local texture coordinates
    const localWidth = (12 * this.s) / (scaleX || 1);
    const localHeight = (14 * this.s) / (scaleY || 1);
    const localOffsetX = ((targetWidth - 12 * this.s) / 2) / (scaleX || 1);
    const localOffsetY = (targetHeight - 14 * this.s) / (scaleY || 1);

    this.president.body.setSize(localWidth, localHeight);
    this.president.body.setOffset(localOffsetX, localOffsetY);

    // Give President a distinct blue tint to look special
    this.president.setTint(0xa0c0ff);

    // Floating text label above President
    this.presidentLabel = this.add.text(this.president.x, this.president.y - 24 * this.s, 'הנשיא 🇮🇱', {
      fontFamily: 'monospace',
      fontSize: `${Math.max(10, Math.round(10 * this.s))}px`,
      fontWeight: 'bold',
      color: '#00e6ff',
      backgroundColor: '#000000aa',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5, 1);
    this.presidentLabel.setDepth(3000);

    // --- Camera ---
    this.cameras.main.setBounds(0, 0, worldWidth, height);
    this.cameras.main.startFollow(this.player, true, 0.1, 0);

    // --- Overlap Trigger to Catch President ---
    this.physics.add.overlap(
      this.player,
      this.president,
      this.catchPresident,
      null,
      this
    );

    // --- HUD ---
    this._createHUD();

    // Fade in camera & start Kotel drop-in cutscene
    this.cameras.main.fadeIn(500);
    this._runKotelIntroCutscene(busStopX, presStartX);

    // Shutdown cleanup listener
    this.events.once('shutdown', () => {
      if (this.activeBananas) {
        this.activeBananas.forEach((b) => b.destroy());
        this.activeBananas = [];
      }
    });
  }

  /**
   * Intro Cutscene: Bus drops off player on upper sidewalk, drives off, player walks up near President, then triggers intro dialog.
   */
  _runKotelIntroCutscene(busStopX, presStartX) {
    // 1. Bus drives in and stops at upper sidewalk bus stop (bus set on top depth layer 2000)
    const bus = this.add.image(-120 * this.s, this.roadTop + 10 * this.s, 'egged_bus');
    bus.setScale(this.s).setDepth(2000);

    this.tweens.add({
      targets: bus,
      x: busStopX + 15 * this.s,
      duration: 2000,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // 2. Player spawns / becomes visible behind the bus when bus reaches the station
        this.player.setPosition(busStopX, this.roadTop - 2 * this.s);
        this.player.setVisible(true);

        this.time.delayedCall(400, () => {
          // Bus drives off
          this.tweens.add({
            targets: bus,
            x: busStopX + 600 * this.s,
            duration: 2200,
            ease: 'Quad.easeIn',
            onComplete: () => {
              bus.destroy();
            }
          });

          // 3. As bus drives off, player is revealed and walks down to plaza & president
          this.time.delayedCall(600, () => {
            const targetX = presStartX - 35 * this.s;
            const targetY = this.roadTop + (this.roadBottom - this.roadTop) / 2;

            const walkDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, targetX, targetY);
            // Slower, natural walking speed (~75px/sec)
            const walkDuration = Math.round((walkDist / (75 * this.s)) * 1000);

            if (this.player.anims) {
              this.player.anims.play('walk-right', true);
            }

            this.tweens.add({
              targets: this.player,
              x: targetX,
              y: targetY,
              duration: walkDuration,
              ease: 'Linear',
              onComplete: () => {
                if (this.player.anims) {
                  this.player.anims.stop();
                }

                // 4. Player arrives near President — trigger intro dialog
                this.time.delayedCall(300, () => {
                  playDialogOnce("KotelScene-intro", this, KOTEL_INTRO_DIALOG, () => {
                    // Dialogue ended — enable player & start President chase!
                    this.player.enable();
                    this.gameplayStarted = true;
                  });
                });
              }
            });
          });
        });
      }
    });
  }

  update(time, delta) {
    if (this.player) {
      this.player.update();
    }

    // Depth sort President and update label position
    if (this.president && this.president.active) {
      this.president.setDepth(this.president.y);
      if (this.presidentLabel) {
        this.presidentLabel.setPosition(this.president.x, this.president.y - 24 * this.s);
        this.presidentLabel.setDepth(this.president.depth + 1);
      }

      const presSpeed = this.president.body
        ? Math.hypot(this.president.body.velocity.x, this.president.body.velocity.y)
        : 0;
      updateCharacterAnimation(this.president, presSpeed, 'crying');
    }

    // Update active landed bananas
    if (this.activeBananas && this.activeBananas.length > 0) {
      this.activeBananas.forEach((b) => b.update(delta));
      this.activeBananas = this.activeBananas.filter((b) => !b.isResolved);
    }

    // President banana dropping & chase behavior during active gameplay
    if (this.gameplayStarted && !this.isSceneOver && this.president && this.player) {
      this.chaseTimer += delta;

      // Proximity catch trigger
      const distToPres = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.president.x, this.president.y
      );
      if (distToPres < 24 * this.s) {
        this.catchPresident();
        return;
      }

      // Drop banana every 2.5 seconds up to maxBananas
      if (this.bananasDropped < this.maxBananas) {
        this.bananaDropTimer += delta;
        if (this.bananaDropTimer >= 2500) {
          this.bananaDropTimer = 0;
          this.dropBanana();
        }
      }

      this._updatePresidentBehavior(time, delta);
    }
  }

  _buildKotelBackground(worldWidth, groundY) {
    if (this.textures.exists('kotel-start') && this.textures.exists('kotel-mid') && this.textures.exists('kotel-end')) {
      const sectionW = groundY * (16 / 9);

      // 1. Start section on far left (plaza entrance)
      const startBg = this.add.image(sectionW / 2, groundY / 2, 'kotel-start');
      startBg.setDisplaySize(sectionW, groundY);
      startBg.setDepth(1);

      // 2. End section on far right (golden dome view)
      const endBg = this.add.image(worldWidth - sectionW / 2, groundY / 2, 'kotel-end');
      endBg.setDisplaySize(sectionW, groundY);
      endBg.setDepth(1);

      // 3. Middle loopable section (tileable Kotel wall facade)
      const midStartX = sectionW;
      const midEndX = worldWidth - sectionW;
      const midWidth = midEndX - midStartX;

      if (midWidth > 0) {
        const midBg = this.add.tileSprite(midStartX + midWidth / 2, groundY / 2, midWidth, groundY, 'kotel-mid');
        const texture = this.textures.get('kotel-mid').getSourceImage();
        if (texture && texture.height) {
          const scaleY = groundY / texture.height;
          midBg.setTileScale(scaleY, scaleY);
        }
        midBg.setDepth(1);
      }
      return;
    }

    const bgKey = this.textures.exists('kotel-panoramic-bg')
      ? 'kotel-panoramic-bg'
      : (this.textures.exists('kotel-bg') ? 'kotel-bg' : null);
    if (!bgKey) return;

    const bg = this.add.image(worldWidth / 2, groundY / 2, bgKey);
    bg.setDisplaySize(worldWidth, groundY);
    bg.setDepth(1);
  }

  _buildJerusalemPlaza(worldWidth, roadHeight) {
    const s = this.s;
    const tileW = 32 * s;
    const tileH = 16 * s;
    const cols = Math.ceil(worldWidth / tileW) + 1;
    const rows = Math.ceil(roadHeight / tileH);

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const tx = col * tileW;
        const ty = this.roadTop + row * tileH;

        const stone = this.add.image(tx, ty, 'stone_intact');
        stone.setOrigin(0, 0);
        stone.setDisplaySize(tileW, tileH);
        stone.setDepth(2);
      }
    }

    const swTileW = 16 * s;
    const swNeeded = Math.ceil(worldWidth / swTileW) + 1;

    // Upper sidewalk above roadTop
    const upperSwH = 14 * s;
    for (let i = 0; i < swNeeded; i++) {
      const swUpper = this.add.image(i * swTileW, this.roadTop - upperSwH, 'sidewalk');
      swUpper.setOrigin(0, 0);
      swUpper.setDisplaySize(swTileW, upperSwH);
      swUpper.setDepth(2);
    }

    // Lower sidewalk below roadBottom
    for (let i = 0; i < swNeeded; i++) {
      const sw = this.add.image(i * swTileW, this.roadBottom, 'sidewalk');
      sw.setOrigin(0, 0);
      sw.setDisplaySize(swTileW, this.scale.height - this.roadBottom);
      sw.setDepth(3);
    }
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

  _updatePresidentBehavior(time, delta) {
    if (!this.president || !this.president.active || !this.player || !this.player.active) return;

    const s = this.s;
    const charW = 12 * s;
    const worldWidth = WORLD_CHARS_WIDE * charW;
    const playerSpeed = this.player.baseSpeed || 120 * s;

    let speedFactor;

    if (this.chaseTimer <= 3000) {
      const sprintProgress = this.chaseTimer / 3000;
      speedFactor = 1.60 - (sprintProgress * 0.40);
    } else {
      const chaseProgress = Math.min(1.0, (this.chaseTimer - 3000) / 18000);
      speedFactor = 1.20 - (chaseProgress * 0.90);
    }

    const distAhead = this.president.x - this.player.x;
    if (distAhead > 150 * s) {
      speedFactor = Math.min(speedFactor, 0.6);
    }

    if (this.chaseTimer >= 21000) {
      speedFactor = 0.25;
    }

    let vx = playerSpeed * speedFactor;
    const timeSec = time / 1000;
    let vy = Math.sin(timeSec * 2.2) * (35 * s) + Math.cos(timeSec * 1.1) * (15 * s);

    if (this.president.y > this.roadBottom - 20 * s) {
      vy = -Math.abs(vy || 20 * s);
    } else if (this.president.y < this.roadTop + 20 * s) {
      vy = Math.abs(vy || 20 * s);
    }

    if (this.president.x > worldWidth - 40 * s) {
      vx = Math.min(vx, 0);
    }

    this.president.body.setVelocity(vx, vy);

    if (vx > 5) {
      this.president.setFlipX(false);
    } else if (vx < -5) {
      this.president.setFlipX(true);
    }
  }

  dropBanana() {
    if (!this.gameplayStarted || this.isSceneOver || !this.president || !this.player) return;

    this.bananasDropped++;

    const sx = this.president.x;
    const sy = this.president.y;

    let tx, ty;
    const isBehind = Phaser.Math.Between(0, 100) < 50;

    if (isBehind) {
      tx = this.president.x - 35 * this.s;
      ty = this.president.y + Phaser.Math.Between(-15, 15) * this.s;
    } else {
      const pVx = this.player.body ? this.player.body.velocity.x : 0;
      const pVy = this.player.body ? this.player.body.velocity.y : 0;
      tx = this.player.x + (pVx * 0.8) + Phaser.Math.Between(-10, 10) * this.s;
      ty = this.player.y + (pVy * 0.8) + Phaser.Math.Between(-10, 10) * this.s;
    }

    const minVisibleX = Math.max(40 * this.s, this.player.x - 70 * this.s);
    const maxVisibleX = Math.min(WORLD_CHARS_WIDE * 12 * this.s - 40 * this.s, this.player.x + 150 * this.s);

    tx = Phaser.Math.Clamp(tx, minVisibleX, maxVisibleX);
    ty = Phaser.Math.Clamp(ty, this.roadTop + 15 * this.s, this.roadBottom - 15 * this.s);

    const banana = new Banana(this, sx, sy, tx, ty, this.s, {
      player: this.player,
      onSlip: () => {
        this.bananasHitCount++;
        this.cameras.main.shake(150, 0.008);
      },
      onAvoid: () => {}
    });

    this.activeBananas.push(banana);
  }

  catchPresident() {
    if (!this.gameplayStarted || this.isSceneOver) return;
    this.isSceneOver = true;
    this.gameplayStarted = false;

    if (this.activeBananas) {
      this.activeBananas.forEach((b) => b.destroy());
      this.activeBananas = [];
    }

    this.player.disable();
    this.player.body.setVelocity(0, 0);
    this.president.body.setVelocity(0, 0);

    this.cameras.main.shake(150, 0.005);
    this.cameras.main.flash(300, 255, 255, 255);

    const remainingBananas = Math.max(0, this.maxBananas - this.bananasDropped);
    const bonusPoints = remainingBananas * 3;
    const catchScore = 9 + bonusPoints;

    addGlobalScore(this, catchScore, this.president.x, this.president.y);

    if (bonusPoints > 0) {
      const s = this.s || 1;
      const bonusText = this.add.text(this.president.x, this.president.y - 45 * s, `+${bonusPoints} בונוס תפיסה מהירה!`, {
        fontFamily: 'Rubik, sans-serif',
        fontSize: `${Math.max(12, Math.round(14 * s))}px`,
        fontWeight: 'bold',
        color: '#facc15',
        stroke: '#000000',
        strokeThickness: 3 * s,
      }).setOrigin(0.5, 1).setDepth(3500);

      this.tweens.add({
        targets: bonusText,
        y: bonusText.y - 25 * s,
        alpha: 0,
        duration: 1800,
        onComplete: () => bonusText.destroy()
      });
    }

    playDialogOnce("KotelScene-victory", this, KOTEL_VICTORY_DIALOG, () => {
      this.showVictoryScreen();
    });
  }

  _createHUD() {
    LivesManager.showHUD();
  }

  showVictoryScreen() {
    showVictoryHelper(
      this,
      'KotelScene',
      "ההגעה לכותל הושלמה!",
      "תפסת את הנשיא לחיבוק חם - הוא היה זקוק לזה מאוד!"
    );
  }
}
