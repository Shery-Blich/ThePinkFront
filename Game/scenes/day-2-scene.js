import Phaser from 'phaser';
import { Character } from '../entities/character.js';
import { Player } from '../entities/player.js';
import { Product } from '../entities/product.js';
import { JoystickMove } from '../systems/joystick-move.js';
import { startSceneMusic } from '../systems/bg-music.js';
import { showVictoryHelper, showGameOverHelper } from '../systems/level-ui-helper.js';
import { LivesManager } from '../systems/lives-manager.js';
import { MovementTutorial } from '../systems/movement-tutorial.js';
import { playDialogOnce } from '../systems/dialog-system.js';
import { DAY_2_INTRO_DIALOG } from '../data/dialog-data.js';

import { addGlobalScore } from '../systems/score-manager.js';

const WORLD_CHARS_WIDE = 120;
const PRODUCT_COUNT = 12;
const BLOCK_HEIGHT = 50;

export class Day2Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Day2Scene' });

    this.player = null;
    this._playerEntity = null;
    this.productGroup = null;
    this.platformGroup = null;
    this.score = 67.0;
    this.isGameOver = false;
    this.isSceneOver = false;
    this._debugText = null;
    this._errorMessages = [];
    this._baseRunSpeed = 160; 
    this._speedAdjust = 0;
    this._minRunSpeed = 0;
    this._jumpVelocity = -420;
    this._levelWidth = 0;
    this.joystick = null;
    this.s = 1;
    this._autoScrollSpeed = 80; // px/sec

    this._collectedCount = 0;
    this._canDoubleJump = false;   
    this._hasDoubleJumped = false; 
    this._sounds = {
      collect: null,
      cashier: null,
      ambient: [],
    };
    this._ambientSoundEvent = null;
    this.backgroundImage = null;
    this._backgroundScrollX = 0;
  }

  create() {
    this.score = 67.0;
    this._totalShekelsSpent = 0;
    this._shekelPointsAwarded = 0;
    this.isGameOver = false;
    this.isSceneOver = false;
    this._errorMessages = [];
    this._playerEntity = null;
    this.player = null;
    this._debugText = null;
    this.joystick = null;
    this._isScrollingStarted = false;
    this._dialogActive = true;
    this._lastNoMoneyToastTime = 0;
    this._cashierDialogStarted = false;

    this._moveDirection = 0;
    this._collectedCount = 0; 
    this._canDoubleJump = false;
    this._hasDoubleJumped = false;
    if (this.cameras && this.cameras.main) {
      this.cameras.main.scrollX = 0;
    }
    
    const { width, height } = this.scale;
    this.s = Character.computeScale(height);
    const charWidth = 12 * this.s;
    const worldWidth = WORLD_CHARS_WIDE * charWidth;
    this._levelWidth = Math.max(worldWidth, width * 2.5, 2200);

    if (!this.physics) {
      const message = 'Arcade physics unavailable';
      console.error(message);
      this.add.text(16, 16, message, {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ff0000',
      });
      return;
    }

    if (this.textures.exists('day2-bg')) {
      const bgSource = this.textures.get('day2-bg').getSourceImage();
      const texW = bgSource?.width || 0;
      const texH = bgSource?.height || 0;
      // Skip broken / oversize textures that failed on mobile WebGL
      if (texW > 0 && texH > 0) {
        const scale = Math.max(width / texW, height / texH);
        this.backgroundImage = this.add.image(0, 0, 'day2-bg')
          .setOrigin(0, 0)
          .setScrollFactor(0)
          .setDepth(0)
          .setScale(scale);
        this._backgroundScrollX = 0;
      }
    }

    this.cameras.main.setBackgroundColor(0x74b9ff);
    this.physics.world.setBounds(0, 0, this._levelWidth, height);
    this.cameras.main.setBounds(0, 0, this._levelWidth, height);

    this.physics.world.gravity.y = 900;

    this._buildGround(width, height);
    this._buildShelves(width, height);

    this.productGroup = this.physics.add.staticGroup();
    this._spawnProducts(width, height);

    this._buildCashier(width, height);

    this._createPlayer(width, height);

    // Initialize joystick
    this.joystick = new JoystickMove(this, this.player, {
      speed: this._baseRunSpeed,
      leftOffset: 60,
      bottomOffset: 60,
      horizontalOnly: true,
    });

    // Destroy the player's default joystick to prevent duplicate joystick rendering
    if (this.player && this.player.movement) {
      this.player.movement.destroy();
      this.player.movement = null;
    }

    // Start with joystick disabled for the intro dialogue
    this.joystick.disable();

    this.physics.add.collider(this.player, this.platformGroup);
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.overlap(this.player, this.productGroup, this.collectProduct, null, this);
    this.physics.add.overlap(this.player, this.finishZone, this._reachCashier, null, this);

    this._setupSounds();
    startSceneMusic(this, 'bg-middle');
    this._setupInput(width);
    this._createHUD();

    // Play intro dialogue before starting gameplay
    playDialogOnce('Day2Scene', this, DAY_2_INTRO_DIALOG, () => {
      this._dialogActive = false;
      this.joystick.enable();

      // Show the jump tutorial after dialogue finishes
      MovementTutorial.showJumpTutorial(this);

      // Start scrolling the screen only after the player fulfills the tutorial by jumping
      this.events.once('player-jump', () => {
        this._isScrollingStarted = true;
      });
    });

    this.events.once('shutdown', () => {
      if (this.joystick) this.joystick.destroy();
      if (typeof window.hideHUD === 'function') {
        window.hideHUD('html-stats-hud');
      }
    });
  }


  update(time, delta) {
    if (this.isGameOver || this.isSceneOver) {
      return;
    }

    if (this._isScrollingStarted && this.backgroundImage) {
      const scrollSpeed = 10;
      this._backgroundScrollX += (scrollSpeed * delta) / 1000;
      const maxOffset = Math.max(0, this.backgroundImage.displayWidth - this.scale.width);
      if (this._backgroundScrollX > maxOffset) {
        this._backgroundScrollX = 0;
      }
      this.backgroundImage.x = -this._backgroundScrollX;
    }


    const cam = this.cameras && this.cameras.main;
    if (cam && this.player && typeof this.player.x === 'number') {
      const leftEdge = cam.scrollX;
      const loseMargin = 8;
      if (this.player.x < leftEdge + loseMargin) {
        if (!this.player.isInvulnerable) {
          const remaining = LivesManager.deductLife();
          if (remaining > 0) {
            this.player.takeDamage();
            this.player.x = leftEdge + 60 * this.s;
          } else {
            this.triggerGameOver('LEFT_BEHIND');
            return;
          }
        }
      }

      // Clamp player to prevent escaping the right screen border
      const rightLimit = cam.scrollX + cam.displayWidth - 16;
      if (this.player.x > rightLimit) {
        this.player.x = rightLimit;
        if (this.player.body) {
          this.player.body.setVelocityX(Math.min(0, this.player.body.velocity.x));
        }
      }
    }

    // Reset double-jump on landing
    if (this.player && this.player.body) {
      const body = this.player.body;
      const onGround = !!(
        body.blocked && body.blocked.down ||
        body.touching && body.touching.down ||
        (typeof body.onFloor === 'function' && body.onFloor())
      );
      if (onGround) {
        this._canDoubleJump = false;
        this._hasDoubleJumped = false;
      }
    }

    // --- MOVEMENT DISPATCHER ---
    let joystickActive = false;

    // 1. Update Joystick State
    if (this.joystick && this.player && this.player.body) {
      this.joystick.update();
      
      // Limit player movement (prevent running horizontal) until they perform their tutorial jump
      if (!this._isScrollingStarted) {
        this.player.body.setVelocityX(0);
        this.joystick.isMoving = false;
        if (this.player.anims && typeof this.player.anims.stop === 'function') {
          this.player.anims.stop();
        }
      }

      // Check if joystick is being dragged
      if (this.joystick.isMoving) {
        joystickActive = true;
      }
    }

    // Keyboard fallback and jump checks are now centrally managed by JoystickMove update.

    this._scrollCamera(delta);

    if (this._playerEntity && this._playerEntity.update) {
      try {
        this._playerEntity.update();
      } catch (e) {
        // ignore
      }
    }

    this._updateHUD();
  }

  _scrollCamera(delta) {
    if (!this._isScrollingStarted) {
      return;
    }
    if (!this.cameras.main) {
      return;
    }

    const camera = this.cameras.main;
    const maxScrollX = Math.max(0, this._levelWidth - camera.displayWidth);
    
    let scrollSpeed = this._autoScrollSpeed;

    // Speed up camera scroll if player is past the middle width of the screen
    if (this.player) {
      const halfWidth = camera.displayWidth / 2;
      const playerRelativeX = this.player.x - camera.scrollX;

      if (playerRelativeX > halfWidth) {
        const overshoot = playerRelativeX - halfWidth;
        const factor = overshoot / halfWidth; // Normalized 0 to 1
        // Speed up the camera movement up to 2.5x the base scroll speed
        scrollSpeed += factor * this._autoScrollSpeed * 1.5;
      }
    }

    camera.scrollX = Phaser.Math.Clamp(
      camera.scrollX + (scrollSpeed * delta) / 1000,
      0,
      maxScrollX,
    );
  }

  _createPlayer(width, height) {
    const startX = 350; // Shifted right to center so player has time to react to autoscroll edge
    const startY = height - 40; // Spawns directly on the floor surface

    try {
      this._playerEntity = new Player(this, startX, startY, this.s);
    } catch (e) {
      console.warn('Player entity failed, falling back to sprite', e);
      this._playerEntity = null;
      this._errorMessages.push(`Player fallback: ${e.message || e}`);
    }

    if (this._playerEntity && this._playerEntity.body) {
      this.player = this._playerEntity;
      this.player.body.setCollideWorldBounds(true);
      if (this.player.body) this.player.body.moves = true;
    } else {
      this.player = this.physics.add.sprite(startX, startY, 'player');
      this.player.setOrigin(0.5, 1);
      this.player.setScale(2);
      if (this.player.body) {
        this.player.body.setSize(12, 20);
        this.player.body.setOffset(-6, -20);
        this.player.setCollideWorldBounds(true);
        this.player.body.moves = true;
      }
    }
  }

  _setupInput(width) {
    this.input.on('pointerdown', (pointer) => {
      if (this.isGameOver || this.isSceneOver) {
        return;
      }
      if (this._dialogActive) {
        return;
      }

      // If they are tapping the screen to jump, make sure it's not on top of the joystick
      if (this._isPointerOnJoystick(pointer)) {
        return;
      }

      this._doJump();
    });

  }

  _isPointerOnJoystick(pointer) {
    if (!this.joystick || !this.joystick.config) {
      return false;
    }
    const baseX = this.joystick.baseX || 60;
    const baseY = this.joystick.baseY || (this.scale.height - 60);
    const radius = this.joystick.config.maxRadius || 50;

    const dx = pointer.x - baseX;
    const dy = pointer.y - baseY;
    return Math.hypot(dx, dy) <= radius;
  }

  _stopMovement() {
    if (this.player && this.player.body) {
      this.player.body.setVelocityX(0);
    }
  }

  _doJump() {
    if (this._dialogActive) return;
    if (!this.player || !this.player.body) return;
    this.events.emit('player-jump');
    const body = this.player.body;
    const onGround = !!(
      body.blocked && body.blocked.down ||
      body.touching && body.touching.down ||
      (typeof body.onFloor === 'function' && body.onFloor())
    );

    if (onGround) {
      if (typeof body.setVelocityY === 'function') {
        body.setVelocityY(this._jumpVelocity);
      } else {
        body.velocity && (body.velocity.y = this._jumpVelocity);
      }
      this._canDoubleJump = true;
      this._hasDoubleJumped = false;
      return;
    }

    if (this._canDoubleJump && !this._hasDoubleJumped) {
      if (typeof body.setVelocityY === 'function') {
        body.setVelocityY(this._jumpVelocity);
      } else {
        body.velocity && (body.velocity.y = this._jumpVelocity);
      }
      this._hasDoubleJumped = true;
      this._canDoubleJump = false;
      return;
    }
  }

  _buildGround(width, height) {
    this.ground = this.add.rectangle(this._levelWidth / 2, height - 20, this._levelWidth, 40, 0x7b4f18);
    this.physics.add.existing(this.ground, true);
  }

  _getShelfDefinitions(width, height) {
    const floorY = height - 20;
    const finishBuffer = 280;
    const safeEndX = this._levelWidth - finishBuffer;

    const shelves = [
      { x: 520, y: floorY - 80, width: 180, height: 24 },
      { x: 800, y: floorY - 130, width: 180, height: 24 },
      { x: 1100, y: floorY - 100, width: 180, height: 24 },
      { x: 1400, y: floorY - 170, width: 180, height: 24 },
      { x: 1700, y: floorY - 80, width: 180, height: 24 },
      { x: this._levelWidth - 500, y: floorY - 140, width: 180, height: 24 },
    ];

    return shelves.filter((shelf) => shelf.x + shelf.width / 2 < safeEndX);
  }

  _buildShelves(width, height) {
    this.platformGroup = this.physics.add.staticGroup();

    for (const shelf of this._getShelfDefinitions(width, height)) {
      const platform = this.add.rectangle(shelf.x, shelf.y, shelf.width, shelf.height, 0x8b4513);
      this.physics.add.existing(platform, true);
      this.platformGroup.add(platform);
    }
  }

  _spawnProducts(width, height) {
    const shelfDefs = this._getShelfDefinitions(width, height);
    const productPositions = [];
    const productsPerShelf = Math.ceil(PRODUCT_COUNT / shelfDefs.length);

    shelfDefs.forEach((shelf) => {
      for (let i = 0; i < productsPerShelf && productPositions.length < PRODUCT_COUNT; i += 1) {
        const offsetX = (i - (productsPerShelf - 1) / 2) * 42;
        const x = Phaser.Math.Clamp(
          shelf.x + offsetX,
          shelf.x - shelf.width / 2 + 20,
          shelf.x + shelf.width / 2 - 20,
        );
        const y = shelf.y - shelf.height / 2;
        productPositions.push({ x, y });
      }
    });

    for (const pos of productPositions) {
      const product = new Product(this, pos.x, pos.y);
      this.productGroup.add(product);
      
      if (product.body) {
        product.body.updateFromGameObject();
      }
    }
  }

  _buildCashier(width, height) {
    const x = this._levelWidth - 100;
    const y = height - 20;
    this.finishZone = this.add.rectangle(x, y - 40, 32, 80, 0x10b981, 0);
    this.physics.add.existing(this.finishZone, true);

    if (this.textures.exists('cashier-character')) {
      this.add.image(x, y - 40, 'cashier-character')
        .setOrigin(0.5, 1)
        .setScale(0.5);
    }

    const label = this.add.text(x, y - 100, 'קופה', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#00000099',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 1);
    label.setScrollFactor(0);
  }

  _createHUD() {
    LivesManager.showHUD();
    if (typeof window.showHUD === 'function') {
      window.showHUD('html-stats-hud', `תקציב: ${this._formatPrice(this.score)}`);
    }
  }

  _updateHUD() {
    if (typeof window.updateHUDText === 'function') {
      window.updateHUDText('html-stats-hud', `תקציב: ${this._formatPrice(this.score)}`);
    }
  }

  _reachCashier() {
    if (this.isGameOver || this.isSceneOver) {
      return;
    }

    if (this.score > 0) {
      this.triggerGameOver('BUDGET_REMAINING');
      return;
    }

    this._playSound('cashier');
    this._runCashierDialog();
  }

  _runCashierDialog() {
    if (this._cashierDialogStarted) {
      return;
    }
    this._cashierDialogStarted = true;

    // Freeze the player in place while the closing dialogue plays out
    this.joystick?.disable();
    if (this.player && this.player.body) {
      this.player.body.setVelocity(0, 0);
      this.player.body.moves = false;
    }

    const playerLine = `איך יצא לי ${this._collectedCount} מוצרים ב67₪?!`;
    this._showSpeechBubble(this.player, playerLine, {
      offsetY: 18 * this.s,
      duration: 2000,
    });

    this.time.delayedCall(2200, () => {
      const cashierTarget = this.finishZone;
      this._showSpeechBubble(cashierTarget, '!יאללה לא מעניין! הבא בתור', {
        offsetY: 55,
        duration: 1600,
      });

      this.time.delayedCall(1800, () => {
        this.triggerSceneOver();
      });
    });
  }

  /**
   * Renders a literal cartoon-style speech bubble: a rounded white bubble
   * with a black outline and a small triangular tail pointing at the
   * speaker's head, with the text centered inside. Pops in, holds, then
   * fades out and is destroyed.
   */
  _showSpeechBubble(target, text, options = {}) {
    if (!target) {
      return null;
    }

    const {
      offsetY = 25,
      duration = 1800,
      fontSize = '15px',
      textColor = '#1f2937',
      fillColor = 0xffffff,
      strokeColor = 0x1f2937,
      maxWidth = 230,
    } = options;

    const anchorX = target.x;
    const anchorY = target.y - offsetY;

    // Build the label first so the bubble can be sized around it.
    const label = this.add.text(0, 0, text, {
      fontFamily: 'Arial',
      fontSize,
      color: textColor,
      align: 'center',
      wordWrap: { width: maxWidth - 28 },
    }).setOrigin(0.5, 0.5);

    const paddingX = 16;
    const paddingY = 12;
    const bubbleWidth = label.width + paddingX * 2;
    const bubbleHeight = label.height + paddingY * 2;
    const cornerRadius = 14;
    const tailWidth = 16;
    const tailHeight = 10;

    // The tail tip sits at local (0,0) — i.e. right at the speaker's head —
    // and the rounded bubble body floats above it.
    const bubbleCenterY = -(bubbleHeight / 2) - tailHeight;
    const rectX = -bubbleWidth / 2;
    const rectY = bubbleCenterY - bubbleHeight / 2;

    const graphics = this.add.graphics();

    // Soft drop shadow for a bit of cartoon depth.
    graphics.fillStyle(0x000000, 0.15);
    graphics.fillRoundedRect(rectX + 3, rectY + 4, bubbleWidth, bubbleHeight, cornerRadius);

    // Bubble body.
    graphics.fillStyle(fillColor, 1);
    graphics.fillRoundedRect(rectX, rectY, bubbleWidth, bubbleHeight, cornerRadius);
    graphics.lineStyle(3, strokeColor, 1);
    graphics.strokeRoundedRect(rectX, rectY, bubbleWidth, bubbleHeight, cornerRadius);

    // Pointer tail from the bottom of the bubble down to the speaker.
    const tailBaseY = rectY + bubbleHeight - 2;
    graphics.fillStyle(fillColor, 1);
    graphics.fillTriangle(
      -tailWidth / 2, tailBaseY,
      tailWidth / 2, tailBaseY,
      0, 0,
    );
    graphics.lineStyle(3, strokeColor, 1);
    graphics.beginPath();
    graphics.moveTo(-tailWidth / 2, tailBaseY);
    graphics.lineTo(0, 0);
    graphics.moveTo(tailWidth / 2, tailBaseY);
    graphics.lineTo(0, 0);
    graphics.strokePath();

    label.setPosition(0, bubbleCenterY);

    const container = this.add.container(anchorX, anchorY, [graphics, label]);
    container.setDepth(2000);
    container.setScale(0.3);
    container.setAlpha(0);

    // Cartoon pop-in.
    this.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: 220,
      ease: 'Back.easeOut',
    });

    // Hold, then float up and fade out.
    this.tweens.add({
      targets: container,
      y: anchorY - 15,
      alpha: 0,
      delay: duration,
      duration: 350,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        container.destroy();
      },
    });

    return container;
  }

  collectProduct(player, product) {
    const actualProduct = product && product.gameObject ? product.gameObject : product;
    if (!actualProduct) {
      return;
    }

    if (this._collectedCount >= PRODUCT_COUNT) {
      return;
    }

    // Block collection if budget is already at 0
    if (this.score <= 0) {
      this._showNoMoneyToast();
      return;
    }

    const price = typeof actualProduct.getPrice === 'function'
      ? actualProduct.getPrice()
      : (typeof actualProduct.price === 'number' ? actualProduct.price : 0);

    this.score = Math.max(0, this.score - price);

    // Track total shekels spent for global score (1 point per 3 shekels, capped at 20 points max for stage 2)
    this._totalShekelsSpent = (this._totalShekelsSpent || 0) + price;
    const totalShekelPoints = Math.min(20, Math.floor(this._totalShekelsSpent / 3));
    const newPoints = totalShekelPoints - (this._shekelPointsAwarded || 0);
    if (newPoints > 0) {
      this._shekelPointsAwarded = totalShekelPoints;
      const px = this.player ? this.player.x : actualProduct.x;
      const py = this.player ? this.player.y : actualProduct.y;
      addGlobalScore(this, newPoints, px, py);
    }

    if (actualProduct.priceLabel) {
      actualProduct.priceLabel.destroy();
    }

    if (actualProduct.disableBody) {
      actualProduct.disableBody(true, true);
    } else {
      actualProduct.setVisible(false);
      if (actualProduct.body) {
        actualProduct.body.enable = false;
      }
    }

    if (this.productGroup && this.productGroup.remove) {
      this.productGroup.remove(actualProduct, true, true);
    }

    this._collectedCount += 1;
    this._playSound('collect');

    if (this.score <= 0) {
      this.productGroup.getChildren().forEach((p) => {
        const productObj = p && p.gameObject ? p.gameObject : p;
        if (productObj && typeof productObj.setPriceColor === 'function') {
          productObj.setPriceColor('#ef4444');
        } else if (productObj && productObj.priceLabel) {
          productObj.priceLabel.setColor('#ef4444');
        }
      });

      if (typeof window.showToastNotification === 'function') {
        window.showToastNotification('פיו! סיימתי את הקניות להיום!');
      }
    }
  }

  _formatPrice(value) {
    return `₪${value.toFixed(2)}`;
  }

  _showNoMoneyToast() {
    const now = this.time.now;
    if (this._lastNoMoneyToastTime && now - this._lastNoMoneyToastTime < 2500) {
      return;
    }
    this._lastNoMoneyToastTime = now;

    if (!this.player) return;

    const bubbleX = this.player.x;
    const bubbleY = this.player.y - (25 * this.s);

    const toast = this.add.text(bubbleX, bubbleY, 'אין לי מספיק כסף!', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#ef4444',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 1).setDepth(2000);

    this.tweens.add({
      targets: toast,
      y: bubbleY - 30,
      alpha: 0,
      duration: 1500,
      onComplete: () => {
        toast.destroy();
      }
    });
  }

  triggerGameOver(reason = 'LEFT_BEHIND') {
    if (this.isGameOver || this.isSceneOver) {
      return;
    }
    this._stopAmbientSounds();
    this.isGameOver = true;
    this.sound.play('sfx-gameover', { volume: 0.6 });
    this.joystick?.disable();
    this.physics.pause();

    if (this.player && this.player.body) {
      this.player.body.setVelocity(0, 0);
      this.player.body.moves = false;
    }

    // Falling / grey out animation
    this.tweens.add({
      targets: this.player,
      angle: 90,
      tint: 0x333333,
      y: this.player.y + 50,
      duration: 600,
      ease: 'Bounce.easeOut'
    });

    let titleText = 'נפסלת!';
    let messageText = 'הזמן עבר! מישהו פה זז בקצב של כנסת ישראל... הקופאית כבר יצאה לפנסיה!';

    if (reason === 'BUDGET_REMAINING') {
      titleText = 'נשאר לך עודף!';
      messageText = `השארת עודף של ${this._formatPrice(this.score)}! ממתי משאירים עודף בתקציב המדינה? תחזיר הכל למשרד האוצר!`;
    }

    showGameOverHelper(this, titleText, messageText);
  }

  triggerSceneOver() {
    if (this.isSceneOver || this.isGameOver) {
      return;
    }
    this._stopAmbientSounds();
    this.isSceneOver = true;
    this.sound.play('sfx-levelup', { volume: 0.6 });
    this.joystick?.disable();
    this.physics.pause();

    this.showVictoryScreen();
  }

  showVictoryScreen() {
    showVictoryHelper(
      this,
      'Day2Scene',
      "השלב הושלם!",
      "הצלחת לאסוף את כל מצרכי היסוד ולהגיע לקופה בזמן."
    );
  }

  _setupSounds() {
    if (!this.sound || !this.cache || !this.cache.audio) {
      return;
    }

    this._sounds.collect = this._createSound('collect');
    this._sounds.cashier = this._createSound('cashier');

    const ambientKeys = ['ambient1', 'ambient2', 'ambient3'];
    this._sounds.ambient = ambientKeys
      .map((key) => this._createSound(key))
      .filter(Boolean);

    this._scheduleAmbientSound();
  }

  _createSound(key, config = {}) {
    if (!this.cache.audio.exists(key)) {
      return null;
    }

    try {
      return this.sound.add(key, config);
    } catch (e) {
      console.warn(`Unable to create sound '${key}':`, e);
      return null;
    }
  }

  _playSound(key) {
    const sound = this._sounds && this._sounds[key];
    if (sound && typeof sound.play === 'function') {
      sound.play();
    }
  }

  _scheduleAmbientSound() {
    if (!this.time || !this._sounds || !this._sounds.ambient.length) {
      return;
    }

    if (this._ambientSoundEvent) {
      this._ambientSoundEvent.remove();
    }

    const delay = Phaser.Math.Between(5000, 12000);
    this._ambientSoundEvent = this.time.addEvent({
      delay,
      callback: this._playRandomAmbientSound,
      callbackScope: this,
    });
  }

  _playRandomAmbientSound() {
    const ambientSounds = this._sounds.ambient;
    if (!ambientSounds || !ambientSounds.length) {
      return;
    }

    const index = Phaser.Math.Between(0, ambientSounds.length - 1);
    const sound = ambientSounds[index];
    if (sound && typeof sound.play === 'function') {
      sound.play();
    }

    this._scheduleAmbientSound();
  }

  _stopAmbientSounds() {
    if (this._ambientSoundEvent) {
      this._ambientSoundEvent.remove();
      this._ambientSoundEvent = null;
    }

    const ambientSounds = this._sounds && this._sounds.ambient;
    if (ambientSounds && ambientSounds.length) {
      ambientSounds.forEach((sound) => {
        if (sound && typeof sound.stop === 'function') {
          sound.stop();
        }
      });
    }
  }
}