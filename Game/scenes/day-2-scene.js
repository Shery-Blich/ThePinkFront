import Phaser from 'phaser';
import { Character } from '../entities/character.js';
import { Player } from '../entities/player.js';
import { Product } from '../entities/product.js';
import { JoystickMove } from '../systems/joystick-move.js';

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
  }

  create() {
    this.score = 67.0;
    this.isGameOver = false;
    this.isSceneOver = false;
    this._errorMessages = [];
    this._playerEntity = null;
    this.player = null;
    this._debugText = null;
    this.joystick = null;

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
    this.joystick.enable();

    this.physics.add.collider(this.player, this.platformGroup);
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.overlap(this.player, this.productGroup, this.collectProduct, null, this);
    this.physics.add.overlap(this.player, this.finishZone, this._reachCashier, null, this);

    this._setupSounds();
    this._setupInput(width);
    this._createHUD();
  }

  update(time, delta) {
    if (this.isGameOver || this.isSceneOver) {
      return;
    }

    const cam = this.cameras && this.cameras.main;
    if (cam && this.player && typeof this.player.x === 'number') {
      const leftEdge = cam.scrollX;
      const loseMargin = 8;
      if (this.player.x < leftEdge + loseMargin) {
        this.triggerGameOver();
        return;
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
    if (!this.player || !this.player.body) return;
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
    this.finishZone = this.add.rectangle(x, y - 40, 32, 80, 0x10b981);
    this.physics.add.existing(this.finishZone, true);

    const label = this.add.text(x, y - 100, 'Cashier', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#00000099',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 1);
    label.setScrollFactor(0);
  }

  _createHUD() {
    this._debugText = this.add.text(16, 16, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#00000099',
      padding: { x: 10, y: 5 }
    });
    this._debugText.setScrollFactor(0);
    this._debugText.setDepth(2000);
    this._updateHUD();
  }

  _updateHUD() {
    if (this._debugText) {
      this._debugText.setText([
        `Budget: ${this._formatPrice(this.score)}`,
        'Use joystick/arrows to move, tap/space to jump',
      ]);
    }
  }

  _reachCashier() {
    if (this.isGameOver || this.isSceneOver) {
      return;
    }

    if (this.score > 0) {
      this.triggerGameOver();
      return;
    }

    this._playSound('cashier');
    this.triggerSceneOver();
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
      return;
    }

    const price = typeof actualProduct.getPrice === 'function'
      ? actualProduct.getPrice()
      : (typeof actualProduct.price === 'number' ? actualProduct.price : 0);

    this.score = Math.max(0, this.score - price);

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
  }

  _formatPrice(value) {
    return `₪${value.toFixed(2)}`;
  }

  triggerGameOver() {
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

    // Screen darken overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, this.scale.width, this.scale.height);
    overlay.setScrollFactor(0);
    overlay.setDepth(10000);
    overlay.setAlpha(0);

    const title = this.add.text(this.scale.width / 2, this.scale.height / 2 - 40, 'GAME OVER', {
      fontFamily: 'Impact, sans-serif',
      fontSize: `${Math.round(this.scale.height * 0.12)}px`,
      color: '#ff2a5f',
      stroke: '#000000',
      strokeThickness: 6,
      align: 'center'
    });
    title.setOrigin(0.5);
    title.setScrollFactor(0);
    title.setDepth(10001);
    title.setAlpha(0);

    const subtitle = this.add.text(this.scale.width / 2, this.scale.height / 2 + 20, 'TAP ANYWHERE TO TRY AGAIN', {
      fontFamily: 'monospace',
      fontSize: `${Math.round(this.scale.height * 0.045)}px`,
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
        this.input.once('pointerdown', () => {
          this.scene.restart();
        });
      }
    });
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
    const overlay = this.add.graphics();
    overlay.fillStyle(0x0f0c1b, 0.85);
    overlay.fillRect(0, 0, this.scale.width, this.scale.height);
    overlay.setScrollFactor(0);
    overlay.setDepth(10000);
    overlay.setAlpha(0);

    const title = this.add.text(this.scale.width / 2, this.scale.height / 2 - 30, 'SCENE CLEAR', {
      fontFamily: 'Impact, sans-serif',
      fontSize: `${Math.round(this.scale.height * 0.1)}px`,
      color: '#00ffcc',
      stroke: '#000000',
      strokeThickness: 6,
      align: 'center'
    });
    title.setOrigin(0.5);
    title.setScrollFactor(0);
    title.setDepth(10001);
    title.setAlpha(0);

    const subtitle = this.add.text(this.scale.width / 2, this.scale.height / 2 + 25, 'TAP ANYWHERE TO CONTINUE', {
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
        this.input.once('pointerdown', () => {
          this.events.emit('complete');
        });
      }
    });
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