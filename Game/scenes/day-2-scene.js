import Phaser from 'phaser';
import { Character } from '../entities/character.js';
import { Player } from '../entities/player.js';
import { Product } from '../entities/product.js';
import { JoystickMove } from '../systems/joystick-move.js'
import VirtualJoyStickPlugin from 'phaser3-rex-plugins/plugins/virtualjoystick-plugin.js';

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
    this._debugText = null;
    this._errorMessages = [];
    this._lastTapTime = 0;
    this._doubleTapThreshold = 300;
    this._activePointerId = null;
    this._isPointerDown = false;
    this._moveDirection = 0;
    this._baseRunSpeed = 120;
    this._speedAdjust = 140;
    this._minRunSpeed = 80;
    this._jumpVelocity = -420;
    this._cursors = null;
    this._levelWidth = 0;
    this.s = 1;
  }

  create() {
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

    // 1. Build the static map elements first
    this._buildGround(width, height);
    this._buildShelves(width, height);
    this._buildCashier(width, height); // <--- FIXED: Added missing cashier initialization

    // 2. Instantiate your player BEFORE adding colliders
    this._createPlayer(width, height); // <--- FIXED: Added missing player initialization

    this.productGroup = this.physics.add.group({
      immovable: true,
      allowGravity: false,
    });
    this._spawnProducts(width, height);

    // 3. Set up physical collisions
    this.physics.add.collider(this.player, this.platformGroup);
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.productGroup, this.collectProduct, null, this);
    this.physics.add.overlap(this.player, this.finishZone, this._reachCashier, null, this);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this._setupInput(width);
    this._createHUD();
  }

  update() {
    if (this.isGameOver) {
      return;
    }

    if (this._cursors && this.player && this.player.body) {
      if (this._cursors.left.isDown) {
        this._moveDirection = -1;
      } else if (this._cursors.right.isDown) {
        this._moveDirection = 1;
      } else if (!this._isPointerDown) {
        this._moveDirection = 0;
      }

      if (Phaser.Input.Keyboard.JustDown(this._cursors.up) ||
          Phaser.Input.Keyboard.JustDown(this._cursors.space)) {
        this._doJump();
      }
    }

    this._applyMoveVelocity();

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
        'Tap left/right to steer, double-tap to jump',
      ]);
    }
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
    } else {
      this.player = this.physics.add.sprite(startX, startY, 'player');
      this.player.setOrigin(0.5, 1);
      this.player.setScale(2);
      if (this.player.body) {
        this.player.body.setSize(12, 20);
        this.player.body.setOffset(-6, -20);
        this.player.setCollideWorldBounds(true);
      }
    }
  }

  _setupInput(width) {
    this.input.on('pointerdown', (pointer) => {
      if (this.isGameOver) {
        return;
      }

      const now = this.time.now || Date.now();
      const dt = now - (this._lastTapTime || 0);

      if (dt <= this._doubleTapThreshold) {
        this._doJump();
        this._lastTapTime = 0;
        return;
      }

      this._lastTapTime = now;
      this._activePointerId = pointer.id;
      this._isPointerDown = true;

      const playerX = this.player && this.player.x != null ? this.player.x : width / 2;
      this._moveDirection = pointer.worldX < playerX ? -1 : 1;
    });

    this.input.on('pointerup', (pointer) => {
      if (pointer.id === this._activePointerId) {
        this._stopMovement();
        this._activePointerId = null;
        this._isPointerDown = false;
      }
    });

    this.input.on('pointercancel', (pointer) => {
      if (pointer.id === this._activePointerId) {
        this._stopMovement();
        this._activePointerId = null;
        this._isPointerDown = false;
      }
    });

    if (this.input.keyboard) {
      this._cursors = this.input.keyboard.createCursorKeys();
    }
  }

  _applyMoveVelocity() {
    if (!this.player || !this.player.body) {
      return;
    }

    // FIXED: Halt movement entirely if no move direction is active
    if (this._moveDirection === 0) {
      this.player.body.setVelocityX(0);
      return;
    }

    const extra = this._moveDirection * this._speedAdjust;
    const velocityX = this._moveDirection * Math.max(this._minRunSpeed, this._baseRunSpeed + Math.abs(extra));
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
    // Note: If you want this text label to scroll along with the game world, 
    // change setScrollFactor(0) to setScrollFactor(1) or remove it.
    label.setScrollFactor(1); 
  }

  _reachCashier() {
    if (this.isGameOver) {
      return;
    }

    this.isGameOver = true;
    if (this.player && this.player.body) {
      this.player.body.setVelocity(0);
      this.player.body.moves = false;
    }

    const message = this.add.text(this.scale.width / 2, this.scale.height / 2, 'You reached the cashier!', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#000000c0',
      padding: { x: 10, y: 8 },
    }).setOrigin(0.5, 0.5);
    message.setScrollFactor(0);
  }

  collectProduct(player, product) {
    const actualProduct = product && product.gameObject ? product.gameObject : product;
    if (!actualProduct) {
      return;
    }

    if (actualProduct.priceLabel) {
      actualProduct.priceLabel.destroy();
    }

    const price = typeof actualProduct.price === 'number' ? actualProduct.price : 0;
    this.score = Math.max(0, this.score - price);
    this._updateHUD();

    if (actualProduct.disableBody) {
      actualProduct.disableBody(true, true);
    } else if (actualProduct.destroy) {
      actualProduct.destroy();
    }
  }

  _createHUD() {
    const hudStyle = {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#f8f8f2',
      backgroundColor: '#000000dd',
      padding: { x: 8, y: 6 },
    };

    this.scoreText = this.add.text(16, 16, `Budget: ${this._formatPrice(this.score)}`, hudStyle)
      .setScrollFactor(0)
      .setShadow(1, 1, '#000000', 1, true, true);
  }

  _updateHUD() {
    if (this.scoreText) {
      this.scoreText.setText(`Budget: ${this._formatPrice(this.score)}`);
    }
  }

  _formatPrice(value) {
    return `${value.toFixed(2)} nis`;
  }

  triggerGameOver() {
    this.isGameOver = true;
  }
}