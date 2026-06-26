import Phaser from 'phaser';
import { Character } from '../entities/character.js';
import { Player } from '../entities/player.js';
import { DialogSystem } from '../systems/dialog-system.js';
import { KOTEL_INTRO_DIALOG, KOTEL_VICTORY_DIALOG } from '../data/dialog-data.js';
import { startSceneMusic } from '../systems/bg-music.js';
import { runLevelTrivia } from '../systems/level-trivia.js';

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

    // --- President movement states ---
    this.presidentState = 'WANDER'; // 'WANDER', 'FLEEING', 'STUNNED'
    this.presidentTargetX = 0;
    this.presidentTargetY = 0;
    this.stateTimer = 0;
    this.nextDecisionTime = 0; // Decide immediately
  }

  create() {
    const { width, height } = this.scale;

    startSceneMusic(this, 'bg-end');

    // --- Reset states ---
    this.isSceneOver = false;
    this.gameplayStarted = false;
    this.presidentState = 'WANDER';
    this.stateTimer = 0;
    this.nextDecisionTime = 0;

    // --- Scale from screen height ---
    this.s = Character.computeScale(height);

    const charH = 20 * this.s;
    const charW = 12 * this.s;

    // --- Road band (where player and President move) ---
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

    // 2. Draw Jerusalem Stone Road Plaza
    this._buildJerusalemPlaza(worldWidth, roadHeight);

    // --- Player ---
    const startX = 200 * this.s;
    const startY = roadCenterY;
    this.player = new Player(this, startX, startY, this.s);
    this.player.setWorldBounds(0, this.roadTop, worldWidth, roadHeight);
    this.player.disable(); // Disabled for intro dialogue

    // --- President NPC (Dynamic body, starts far away to the right) ---
    const presStartX = startX + 450 * this.s;
    this.president = this.physics.add.sprite(presStartX, roadCenterY, 'npc');
    this.president.setScale(this.s);
    this.president.setOrigin(0.5, 1);
    this.president.body.setCollideWorldBounds(true);
    
    // Set up bottom-half collision body to match standard Character depth styling
    this.president.body.setSize(10 * this.s, 10 * this.s);
    this.president.body.setOffset(1 * this.s, 10 * this.s);

    // Give President a distinct blue tint to look presidential/special
    this.president.setTint(0xa0c0ff);

    // Floating text label above the President
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

    // Setup player movement listeners for HUD feedback
    this.player.on('move-start', () => this._updateHUD('רודף אחרי הנשיא...'));
    this.player.on('move-end', () => this._updateHUD('מצא את הנשיא!'));
    this.player.on('move-blocked', () => this._updateHUD('חסום על ידי הקיר!'));

    // --- Start Intro Dialogue ---
    this._updateHUD('שידור נכנס');
    const introDialog = new DialogSystem(this, KOTEL_INTRO_DIALOG, () => {
      this.player.enable();
      this.gameplayStarted = true;
      this._updateHUD('רדוף אחרי הנשיא! השתמש במקשים או בג׳ויסטיק כדי לזוז!');
    });
    introDialog.start();
  }

  update(time, delta) {
    if (this.player) {
      this.player.update();
    }

    // Depth sort President and update its label position
    if (this.president && this.president.active) {
      this.president.setDepth(this.president.y);
      if (this.presidentLabel) {
        this.presidentLabel.setPosition(this.president.x, this.president.y - 24 * this.s);
        this.presidentLabel.setDepth(this.president.depth + 1);
      }
    }



    // President intelligence & chasing state updates
    if (this.gameplayStarted && !this.isSceneOver && this.president && this.player) {
      this._updatePresidentBehavior(delta);
    }
  }

  // ---------------------------------------------------------------------------
  // Kotel Background Drawing
  // ---------------------------------------------------------------------------

  /**
   * Builds the Kotel backdrop image.
   * @private
   */
  _buildKotelBackground(worldWidth, groundY) {
    const texture = this.textures.get('kotel-bg').getSourceImage();
    const scale = groundY / texture.height;
    const displayWidth = texture.width * scale;

    for (let x = displayWidth / 2; x < worldWidth + displayWidth / 2; x += displayWidth) {
      const bg = this.add.image(x, groundY / 2, 'kotel-bg');
      bg.setDisplaySize(displayWidth, groundY);
      bg.setDepth(1);
    }
  }

  /**
   * Paves the plaza road with Jerusalem stone textures.
   * @private
   */
  _buildJerusalemPlaza(worldWidth, roadHeight) {
    const s = this.s;
    const tileW = 32 * s;
    const tileH = 16 * s;
    const cols = Math.ceil(worldWidth / tileW) + 1;
    const rows = Math.ceil(roadHeight / tileH);

    // Draw plaza stones
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

    // Bottom barrier sidewalk line
    const swTileW = 16 * s;
    const swNeeded = Math.ceil(worldWidth / swTileW) + 1;
    for (let i = 0; i < swNeeded; i++) {
      const sw = this.add.image(i * swTileW, this.roadBottom, 'sidewalk');
      sw.setOrigin(0, 0);
      sw.setDisplaySize(swTileW, this.scale.height - this.roadBottom);
      sw.setDepth(3);
    }
  }

  // ---------------------------------------------------------------------------
  // President Chasing & AI Logic
  // ---------------------------------------------------------------------------

  /**
   * Updates President NPC actions: twitchy panicky movement, running towards
   * the player, fleeing when close, and getting stunned when hitting a wall.
   * @private
   */
  _updatePresidentBehavior(delta) {
    this.stateTimer += delta;

    const distToPlayer = Phaser.Math.Distance.Between(
      this.player.x, this.player.y,
      this.president.x, this.president.y
    );

    // If player is close, trigger panic flee
    if (distToPlayer < 120 * this.s && this.presidentState !== 'FLEEING' && this.presidentState !== 'STUNNED') {
      this.presidentState = 'FLEEING';
      this.stateTimer = 0;
      
      // Calculate flee direction away from player
      let dx = this.president.x - this.player.x;
      let dy = this.president.y - this.player.y;
      const len = Math.hypot(dx, dy) || 1;
      this.fleeDirX = dx / len;
      this.fleeDirY = dy / len;
      this._updateHUD('הנשיא בפאניקה!');
    }

    switch (this.presidentState) {
      case 'FLEEING':
        // Run away at high speed in the flee direction
        const fleeSpeed = 190 * this.s;
        this.president.body.setVelocity(this.fleeDirX * fleeSpeed, this.fleeDirY * fleeSpeed);

        // Check if President hit a world boundary/wall
        const isBlocked = this.president.body.blocked.left || 
                          this.president.body.blocked.right || 
                          this.president.body.blocked.up || 
                          this.president.body.blocked.down;

        if (isBlocked && this.stateTimer > 150) {
          // Hit the wall! Stun in place for 600ms, giving player a window to catch up
          this.presidentState = 'STUNNED';
          this.stateTimer = 0;
          this.president.body.setVelocity(0, 0);
          this._updateHUD('הנשיא נלכד ליד הקיר!');
        } else if (this.stateTimer > 1500) {
          // Fled long enough, return to WANDER
          this.presidentState = 'WANDER';
          this.stateTimer = 0;
          this.nextDecisionTime = 0; // Decide new direction immediately
        }
        break;

      case 'STUNNED':
        // Stuck/panicked at a wall, not moving
        this.president.body.setVelocity(0, 0);
        if (this.stateTimer > 600) {
          this.presidentState = 'WANDER';
          this.stateTimer = 0;
          this.nextDecisionTime = 0;
          this._updateHUD('תפוס את הנשיא!');
        }
        break;

      case 'WANDER':
      default:
        // Panicky twitchy wander: constantly change random direction
        if (this.stateTimer > this.nextDecisionTime) {
          this.stateTimer = 0;
          // Twitchy decision time: 300ms to 700ms
          this.nextDecisionTime = Phaser.Math.Between(300, 700);

          // 30% chance to run towards the player (gets close, then panics!)
          if (Phaser.Math.Between(0, 100) < 30) {
            let dx = this.player.x - this.president.x;
            let dy = this.player.y - this.president.y;
            const dist = Math.hypot(dx, dy) || 1;
            const speed = 130 * this.s;
            this.president.body.setVelocity((dx / dist) * speed, (dy / dist) * speed);
          } else {
            // Run in a random direction
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const speed = Phaser.Math.Between(90, 150) * this.s;
            this.president.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
          }
        }
        break;
    }
  }


  /**
   * Catches the President! Overlap handler.
   */
  catchPresident() {
    if (this.isSceneOver) return;
    this.isSceneOver = true;
    this.gameplayStarted = false;

    // 1. Freeze player and President
    this.player.disable();
    this.player.body.setVelocity(0, 0);
    this.president.body.setVelocity(0, 0);

    // 2. Play catch effects (little camera shake and flash)
    this.cameras.main.shake(150, 0.005);
    this.cameras.main.flash(300, 255, 255, 255);
    this._updateHUD('נתפס!');

    // Show dialogue
    this.time.delayedCall(400, () => {
      const dialog = new DialogSystem(this, KOTEL_VICTORY_DIALOG, () => {
        this.showVictoryScreen();
      });
      dialog.start();
    });
  }

  // ---------------------------------------------------------------------------
  // HUD & Transition Screen
  // ---------------------------------------------------------------------------

  /** @private */
  _createHUD() {
    const fontSize = Math.max(12, Math.round(this.scale.height * 0.026));
    this._hudText = this.add.text(10, 10, 'מצא את הנשיא...', {
      fontFamily: 'monospace',
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 4 },
    });
    this._hudText.setScrollFactor(0);
    this._hudText.setDepth(4000);
  }

  /** @private */
  _updateHUD(message) {
    if (this._hudText) {
      this._hudText.setText(message);
    }
  }

  showVictoryScreen() {
    this.sound.play('sfx-levelup', { volume: 0.6 });

    const overlay = this.add.graphics();
    overlay.fillStyle(0x0f0c1b, 0.85);
    overlay.fillRect(0, 0, this.scale.width, this.scale.height);
    overlay.setScrollFactor(0);
    overlay.setDepth(10000);
    overlay.setAlpha(0);

    const title = this.add.text(this.scale.width / 2, this.scale.height / 2 - 30, 'ההגעה לכותל הושלמה', {
      fontFamily: 'Impact, sans-serif',
      fontSize: `${Math.round(this.scale.height * 0.08)}px`,
      color: '#00ffcc',
      stroke: '#000000',
      strokeThickness: 5,
      align: 'center'
    });
    title.setOrigin(0.5);
    title.setScrollFactor(0);
    title.setDepth(10001);
    title.setAlpha(0);

    const subtitle = this.add.text(this.scale.width / 2, this.scale.height / 2 + 25, 'הקישו בכל מקום כדי להמשיך', {
      fontFamily: 'monospace',
      fontSize: `${Math.round(this.scale.height * 0.04)}px`,
      color: '#ffffff',
      align: 'center'
    });
    subtitle.setOrigin(0.5);
    subtitle.setScrollFactor(0);
    subtitle.setDepth(10001);
    subtitle.setAlpha(0);

    this.tweens.add({
      targets: [overlay, title, subtitle],
      alpha: 1,
      duration: 800,
      onComplete: () => {
        this.input.once('pointerdown', async () => {
          await runLevelTrivia(this, 'KotelScene');
          this.events.emit('complete');
        });
      }
    });
  }
}
