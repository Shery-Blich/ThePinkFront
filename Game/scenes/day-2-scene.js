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
    this.score = 200.0;
    this.isGameOver = false;
    this.isSceneOver = false;
    this._debugText = null;
    this._errorMessages = [];
    this._baseRunSpeed = 120;
    this._speedAdjust = 140;
    this._minRunSpeed = 80;
    this._jumpVelocity = -420;
    this._cursors = null;
    this._levelWidth = 0;
    this.joystick = null;
    this.s = 1;
    this._autoScrollSpeed = 80; // px/sec
  }

  create() {
    // Reset scene state on first load and restart
    this.score = 200.0;
    this.isGameOver = false;
    this.isSceneOver = false;
    this._errorMessages = [];
    this._playerEntity = null;
    this.player = null;
    this._debugText = null;
    this.joystick = null;

    // ensure input / camera / movement state is clean for restarts
    this._cursors = null;
    this._moveDirection = 0;
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

    this.joystick = new JoystickMove(this, this.player, {
      speed: 140,
      leftOffset: 60,
      bottomOffset: 60,
      horizontalOnly: true,
    });
    this.joystick.enable();

    this.physics.add.collider(this.player, this.platformGroup);
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.overlap(this.player, this.productGroup, this.collectProduct, null, this);
    this.physics.add.overlap(this.player, this.finishZone, this._reachCashier, null, this);

    // remove follow so camera can auto-scroll independently
    // this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this._setupInput(width);
    this._createHUD();
  }

  update(time, delta) {
    if (this.isGameOver || this.isSceneOver) {
      return;
    }

    if (this.score <= 0) {
      this.triggerGameOver();
      return;
    }

    if (this._cursors && this.player && this.player.body) {
      if (Phaser.Input.Keyboard.JustDown(this._cursors.up) ||
          Phaser.Input.Keyboard.JustDown(this._cursors.space)) {
        this._doJump();
      }
    }

    if (this.joystick) {
      this.joystick.update();
    }

    this._scrollCamera(delta);

    if (this._playerEntity && this._playerEntity.update) {
      try {
        this._playerEntity.update();
      } catch (e) {
        // ignore
      }
    }

    if (this._debugText) {
      this._debugText.setText([
        `Budget: ${this._formatPrice(this.score)}`,
        'Use joystick to move, tap to jump',
      ]);
    }
  }

  _scrollCamera(delta) {
    if (!this.cameras.main) {
      return;
    }

    const camera = this.cameras.main;
    const maxScrollX = Math.max(0, this._levelWidth - camera.displayWidth);
    camera.scrollX = Phaser.Math.Clamp(
      camera.scrollX + (this._autoScrollSpeed * delta) / 1000,
      0,
      maxScrollX,
    );
  }

  _createPlayer(width, height) {
    const startX = 100;
    const startY = height - BLOCK_HEIGHT - 80;

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
      // ensure body is active on (re)start
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
    this.input.on('pointerup', (pointer) => {
      if (this.isGameOver) {
        return;
      }

      if (this._isPointerOnJoystick(pointer)) {
        return;
      }

      this._doJump();
    });

    if (this.input.keyboard) {
      this._cursors = this.input.keyboard.createCursorKeys();
    }
  }

  _isPointerOnJoystick(pointer) {
    if (!this.joystick) {
      return false;
    }

    const dx = pointer.x - this.joystick.baseX;
    const dy = pointer.y - this.joystick.baseY;
    return Math.hypot(dx, dy) <= this.joystick.config.maxRadius;
  }

  _applyMoveVelocity() {
    if (!this.player || !this.player.body) {
      return;
    }

    const extra = this._moveDirection * this._speedAdjust;
    const velocityX = Math.max(this._minRunSpeed, this._baseRunSpeed + extra);
    this.player.body.setVelocityX(velocityX);
  }

  _stopMovement() {
    this._moveDirection = 0;
  }

  _doJump() {
    if (!this.player || !this.player.body) {
      return;
    }

    const body = this.player.body;
    const grounded = (body.blocked && body.blocked.down) ||
                     (body.touching && body.touching.down);
    if (grounded) {
      body.setVelocityY(this._jumpVelocity);
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
      { x: 260, y: floorY - 80, width: 180, height: 24 },
      { x: 620, y: floorY - 130, width: 180, height: 24 },
      { x: 1040, y: floorY - 100, width: 180, height: 24 },
      { x: 1460, y: floorY - 170, width: 180, height: 24 },
      { x: 1860, y: floorY - 80, width: 180, height: 24 },
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
      
      // Forces the static body's size and position to match the custom Product object
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

  _reachCashier() {
    if (this.isGameOver || this.isSceneOver) {
      return;
    }
    this.triggerSceneOver();
  }

  collectProduct(player, product) {
    const actualProduct = product && product.gameObject ? product.gameObject : product;
    if (!actualProduct) {
      return;
    }

    // remove price label if present
    if (actualProduct.priceLabel) {
      actualProduct.priceLabel.destroy();
    }

    const price = typeof actualProduct.price === 'number' ? actualProduct.price : 0;
    // deduct price from the budget (but do not end game just because a product was touched)
    this.score = Math.max(0, this.score - price);
    this._updateHUD();

    // remove product from the world and its physics body
    try {
      // if the product is part of the static group, remove it from the group first
      if (this.productGroup && this.productGroup.remove) {
        this.productGroup.remove(actualProduct, true, true);
      } else if (actualProduct.disableBody) {
        actualProduct.disableBody(true, true);
      } else if (actualProduct.destroy) {
        actualProduct.destroy();
      }
    } catch (e) {
      // fallback: ensure it's destroyed
      if (actualProduct.destroy) actualProduct.destroy();
    }

    // only trigger game over if budget fully depleted
    if (this.score <= 0) {
      this.triggerGameOver();
    }
  }

  _formatPrice(value) {
    return `\$${value.toFixed(2)}`;
  }

  _createHUD() {
    const { width } = this.scale;

    this.hud = this.add.container(0, 0);
    this.hud.setScrollFactor(0);

    const background = this.add.graphics();
    background.fillStyle(0x000000, 0.5);
    background.fillRect(0, 0, width, 50);
    this.hud.add(background);

    this._debugText = this.add.text(10, 10, '', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#ffffff',
    });
    this.hud.add(this._debugText);

    this._updateHUD();
  }

  _updateHUD() {
    if (this._debugText) {
      this._debugText.setText([
        `Budget: ${this._formatPrice(this.score)}`,
        'Use joystick to move, tap to jump',
      ]);
    }
  }

  triggerGameOver() {
    if (this.isGameOver || this.isSceneOver) return;
    this.isGameOver = true;
    this.joystick?.disable();

    if (this.player && this.player.body) {
      this.player.body.setVelocity(0, 0);
      this.player.body.moves = false;
    }

    const restartLevel = () => {
      this.scene.restart();
    };
    this.input.once('pointerdown', restartLevel);

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
      duration: 800
    });
  }

  triggerSceneOver() {
    if (this.isSceneOver || this.isGameOver) return;
    this.isSceneOver = true;
    this.joystick?.disable();

    if (this.player && this.player.body) {
      this.player.body.setVelocity(0, 0);
      this.player.body.moves = false;
    }

    this.showVictoryScreen();
  }

  showVictoryScreen() {
    const restartLevel = () => {
      this.scene.restart();
    };
    this.input.once('pointerdown', restartLevel);

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

    const subtitle = this.add.text(this.scale.width / 2, this.scale.height / 2 + 25, 'TAP ANYWHERE TO REPLAY', {
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
      duration: 800
    });
  }
}