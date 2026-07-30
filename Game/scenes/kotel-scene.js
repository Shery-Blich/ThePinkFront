import Phaser from 'phaser';
import { Character } from '../entities/character.js';
import { Player } from '../entities/player.js';
import { Banana } from '../entities/banana.js';
import { DialogSystem } from '../systems/dialog-system.js';
import { KOTEL_INTRO_DIALOG, KOTEL_VICTORY_DIALOG } from '../data/dialog-data.js';
import { startSceneMusic } from '../systems/bg-music.js';
import { showVictoryHelper, showGameOverHelper } from '../systems/level-ui-helper.js';
import { LivesManager } from '../systems/lives-manager.js';
import { addGlobalScore } from '../systems/score-manager.js';

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

    // --- President NPC (Dynamic body, starts ~2 player-widths ahead of player) ---
    const presStartX = startX + 26 * this.s;
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

    // --- Start Intro Dialogue ---
    this._updateHUD('שידור נכנס');
    const introDialog = new DialogSystem(this, KOTEL_INTRO_DIALOG, () => {
      this.player.enable();
      this.gameplayStarted = true;
      this._updateHUD('רדוף אחרי הנשיא! השתמש במקשים או בג׳ויסטיק כדי לזוז!');
    });
    introDialog.start();

    this.events.once('shutdown', () => {
      if (this.activeBananas) {
        this.activeBananas.forEach((b) => b.destroy());
        this.activeBananas = [];
      }
    });
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

    // Update active landed bananas (check if player moves near them on floor)
    if (this.activeBananas && this.activeBananas.length > 0) {
      this.activeBananas.forEach((b) => b.update(delta));
      this.activeBananas = this.activeBananas.filter((b) => !b.isResolved);
    }

    // President banana dropping & AI state updates
    if (this.gameplayStarted && !this.isSceneOver && this.president && this.player) {
      this.chaseTimer += delta;

      // Proximity catch trigger (guarantees catching President when touching him)
      const distToPres = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.president.x, this.president.y
      );
      if (distToPres < 24 * this.s) {
        this.catchPresident();
        return;
      }

      // Drop banana every 2.5 seconds (2500ms) up to 7 bananas total
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
   * Updates President NPC actions: natural organic wandering (like Scene 1 NPCs),
   * dynamic player evasion when close, and slow NPC pacing when exhausted.
   * @private
   */
  /**
   * Updates President NPC movement during the chase.
   * - Natural rightward linear movement with smooth organic Y-wobble.
   * - Stamina decays over 21 seconds so player naturally catches him.
   * - Keeps President mostly on-screen so banana drops remain visible.
   * @param {number} time - Current scene time in ms
   * @param {number} delta - Delta time in ms
   * @private
   */
  _updatePresidentBehavior(time, delta) {
    if (!this.president || !this.president.active || !this.player || !this.player.active) return;

    const s = this.s;
    const charW = 12 * s;
    const worldWidth = WORLD_CHARS_WIDE * charW;
    const playerSpeed = this.player.baseSpeed || 120 * s;

    let speedFactor;

    if (this.chaseTimer <= 3000) {
      // --- Initial rapid sprint burst (0s to 3s) ---
      // Starts right near player and rapidly pulls further ahead to entice chase!
      const sprintProgress = this.chaseTimer / 3000;
      speedFactor = 1.60 - (sprintProgress * 0.40); // 1.60x down to 1.20x
    } else {
      // --- Dynamic stamina decay (3s to 21s) ---
      const chaseProgress = Math.min(1.0, (this.chaseTimer - 3000) / 18000);
      speedFactor = 1.20 - (chaseProgress * 0.90); // 1.20x down to 0.30x
    }

    // Relative distance ahead of player
    const distAhead = this.president.x - this.player.x;

    // Keep President mostly on-screen in view of the player:
    // If he gets too far ahead (> 150 * s), cap speed so player keeps him in view
    if (distAhead > 150 * s) {
      speedFactor = Math.min(speedFactor, 0.6);
    }

    // Guaranteed exhaustion at/after 21 seconds (stamina depleted)
    if (this.chaseTimer >= 21000) {
      speedFactor = 0.25; // Slow panting walk
    }

    // Target rightward velocity
    let vx = playerSpeed * speedFactor;

    // Organic Y-axis movement (combination of smooth sine waves)
    const timeSec = time / 1000;
    let vy = Math.sin(timeSec * 2.2) * (35 * s) + Math.cos(timeSec * 1.1) * (15 * s);

    // Boundary constraints: keep inside road strip
    if (this.president.y > this.roadBottom - 20 * s) {
      vy = -Math.abs(vy || 20 * s);
    } else if (this.president.y < this.roadTop + 20 * s) {
      vy = Math.abs(vy || 20 * s);
    }

    // World right boundary clamp
    if (this.president.x > worldWidth - 40 * s) {
      vx = Math.min(vx, 0);
    }

    this.president.body.setVelocity(vx, vy);

    // Flip sprite facing direction based on movement
    if (vx > 5) {
      this.president.setFlipX(false);
    } else if (vx < -5) {
      this.president.setFlipX(true);
    }
  }

  /**
   * Drops a banana peel mine either slightly behind the President (50%) or predictively thrown at the player (50%).
   */
  dropBanana() {
    if (!this.gameplayStarted || this.isSceneOver || !this.president || !this.player) return;

    this.bananasDropped++;

    const sx = this.president.x;
    const sy = this.president.y;

    let tx, ty;

    // 50% chance: Drop slightly behind President (cookie trail), 50% chance: Throw predictively at player
    const isBehind = Phaser.Math.Between(0, 100) < 50;

    if (isBehind) {
      // Drop slightly behind President
      tx = this.president.x - 35 * this.s;
      ty = this.president.y + Phaser.Math.Between(-15, 15) * this.s;
    } else {
      // Predictive throw at Player: calculate target location based on player velocity vector
      const pVx = this.player.body ? this.player.body.velocity.x : 0;
      const pVy = this.player.body ? this.player.body.velocity.y : 0;
      // Lead target based on 0.8s flight prediction
      tx = this.player.x + (pVx * 0.8) + Phaser.Math.Between(-10, 10) * this.s;
      ty = this.player.y + (pVy * 0.8) + Phaser.Math.Between(-10, 10) * this.s;
    }

    // Clamp target coordinates within visible road viewport near player to guarantee visibility!
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
      onAvoid: () => {
        // Player avoided banana! (+3 points awarded inside Banana class)
      }
    });

    this.activeBananas.push(banana);
  }

  /**
   * Catches the President! Overlap handler.
   */
  catchPresident() {
    if (!this.gameplayStarted || this.isSceneOver) return;
    this.isSceneOver = true;
    this.gameplayStarted = false;

    // Destroy active banana indicators/sprites
    if (this.activeBananas) {
      this.activeBananas.forEach((b) => b.destroy());
      this.activeBananas = [];
    }

    // 1. Freeze player and President
    this.player.disable();
    this.player.body.setVelocity(0, 0);
    this.president.body.setVelocity(0, 0);

    // 2. Play catch effects (little camera shake and flash)
    this.cameras.main.shake(150, 0.005);
    this.cameras.main.flash(300, 255, 255, 255);
    this._updateHUD('נתפס!');

    // Calculate score: Base +9 points + remaining unthrown bananas bonus (+3 points each)
    const remainingBananas = Math.max(0, this.maxBananas - this.bananasDropped);
    const bonusPoints = remainingBananas * 3;
    const catchScore = 9 + bonusPoints;

    addGlobalScore(this, catchScore, this.president.x, this.president.y);

    if (bonusPoints > 0) {
      // Floating bonus points indicator
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

    // 3. Show small speech bubble directly above President in-game: "זאת לא רפובליקת בננות!"
    const speechBubble = this.createPresidentSpeechBubble('זאת לא רפובליקת בננות!');

    // 4. Wait 3 seconds showing the ending speech bubble, then trigger regular dialogue textboxes
    this.time.delayedCall(3000, () => {
      if (speechBubble) {
        speechBubble.destroy();
      }

      const dialog = new DialogSystem(this, KOTEL_VICTORY_DIALOG, () => {
        this.showVictoryScreen();
      });
      dialog.start();
    });
  }

  /**
   * Creates a small styled speech bubble container directly above the President.
   * @param {string} text - Message text to display inside speech bubble
   * @returns {Phaser.GameObjects.Container}
   */
  createPresidentSpeechBubble(text) {
    const s = this.s;
    const px = this.president.x;
    const py = this.president.y - 42 * s;

    const container = this.add.container(px, py).setDepth(4000);

    const paddingX = 10 * s;
    const paddingY = 6 * s;

    const labelText = this.add.text(0, 0, text, {
      fontFamily: 'Rubik, Arial, sans-serif',
      fontSize: `${Math.max(13, Math.round(15 * s))}px`,
      fontWeight: 'bold',
      color: '#0f172a',
      align: 'center'
    }).setOrigin(0.5, 0.5);

    const bounds = labelText.getBounds();
    const bgWidth = bounds.width + paddingX * 2;
    const bgHeight = bounds.height + paddingY * 2;

    const bgGraphics = this.add.graphics();
    // Rounded white speech bubble box with blue border
    bgGraphics.fillStyle(0xffffff, 0.95);
    bgGraphics.lineStyle(2 * s, 0x0284c7, 1);
    bgGraphics.fillRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 6 * s);
    bgGraphics.strokeRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 6 * s);

    // Speech bubble pointer triangle at bottom
    bgGraphics.fillStyle(0xffffff, 0.95);
    bgGraphics.fillTriangle(
      -5 * s, bgHeight / 2,
      5 * s, bgHeight / 2,
      0, bgHeight / 2 + 6 * s
    );

    container.add([bgGraphics, labelText]);

    // Pop-in animation
    container.setScale(0.2);
    this.tweens.add({
      targets: container,
      scale: 1,
      duration: 250,
      ease: 'Back.easeOut'
    });

    return container;
  }

  // ---------------------------------------------------------------------------
  // HUD & Transition Screen
  // ---------------------------------------------------------------------------

  /** @private */
  _createHUD() {
    LivesManager.showHUD();
  }

  /** @private */
  _updateHUD(message) {
    // Instructions HUD is removed
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
