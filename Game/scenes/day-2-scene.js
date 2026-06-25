import Phaser from 'phaser';
import { Player } from '../entities/player.js';
import { Product } from '../entities/product.js';

const BLOCK_HEIGHT = 50;
const PRODUCT_COUNT = 12;

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

    this._baseScrollSpeed = 120;
    this._speedAdjust = 140;
    this._minRunSpeed = 60;
    this._jumpVelocity = -420;
    this._cursors = null;
    this._levelWidth = 0;
  }

  create() {
    try {
      const { width, height } = this.scale;
      this._levelWidth = Math.max(width * 3, 2000);

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

      this.cameras.main.setBackgroundColor(0xa6d8ff);
      this.physics.world.setBounds(0, 0, this._levelWidth, height);
      this.cameras.main.setBounds(0, 0, this._levelWidth, height);

      if (this.physics.world.gravity && this.physics.world.gravity.y === 0) {
        this.physics.world.gravity.y = 1000;
      }

      this._buildGround(width, height);
      this._buildPlatforms(width, height);

      this.productGroup = this.physics.add.staticGroup();
      this._spawnProducts(width, height);

      this._buildFinishLine(width, height);

      try {
        this._playerEntity = new Player(this, 100, height - BLOCK_HEIGHT - 80, 1);
      } catch (e) {
        console.warn('Player entity failed, falling back to sprite', e);
        this._playerEntity = null;
        this._errorMessages.push(`Player fallback: ${e.message || e}`);
      }

      if (this._playerEntity && this._playerEntity.body) {
        this.player = this._playerEntity;
        this.player.body.setCollideWorldBounds(true);
      } else {
        const px = this._playerEntity && this._playerEntity.x != null
          ? this._playerEntity.x
          : 100;
        const py = this._playerEntity && this._playerEntity.y != null
          ? this._playerEntity.y
          : height - BLOCK_HEIGHT - 80;

        this.player = this.physics.add.sprite(px, py, 'player');
        this.player.setOrigin(0.5, 1);
        this.player.setScale(2);
        if (this.player.body) {
          this.player.body.setSize(12, 20);
          this.player.body.setOffset(-6, -20);
          this.player.setCollideWorldBounds(true);
        }
      }

      this.physics.add.collider(this.player, this.platformGroup);
      this.physics.add.collider(this.player, this.ground);
      this.physics.add.overlap(this.player, this.productGroup, this.collectProduct, null, this);
      this.physics.add.overlap(this.player, this.finishZone, this._reachCashier, null, this);

      this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

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

        const playerX = this.player && this.player.x != null
          ? this.player.x
          : width / 2;
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

      this._createHUD();

      const debugLines = [
        'Day2Scene loaded',
        'Auto-run to the cashier',
        'Tap left/right to steer, double-tap to jump',
      ];
      if (this._errorMessages.length) {
        debugLines.push(`Errors: ${this._errorMessages.join(' | ')}`);
      }
      this._debugText = this.add.text(16, 48, debugLines.join('\n'), {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#000000',
        backgroundColor: '#ffffff80',
        padding: { x: 6, y: 4 },
      }).setScrollFactor(0);
    } catch (err) {
      console.error('Day2Scene create error:', err);
      const msg = err && err.message ? err.message : String(err);
      this.add.text(16, 120, `Error: ${msg}`, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ff0000',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 6 },
      }).setScrollFactor(0);
    }
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
      const lines = [
        'Day2Scene loaded',
        `Budget: ${this._formatPrice(this.score)}`,
        'Auto-run to the cashier',
        'Tap left/right to steer, double-tap to jump',
      ];
      if (this._errorMessages.length) {
        lines.push(`Errors: ${this._errorMessages.join(' | ')}`);
      }
      this._debugText.setText(lines.join('\n'));
    }
  }

  _applyMoveVelocity() {
    if (!this.player || !this.player.body) {
      return;
    }

    const extra = this._moveDirection * this._speedAdjust;
    const velocityX = Math.max(this._minRunSpeed, this._baseScrollSpeed + extra);
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
    return [
      { x: 260, y: floorY - 80, width: 180, height: 24 },
      { x: 620, y: floorY - 130, width: 180, height: 24 },
      { x: 1040, y: floorY - 100, width: 180, height: 24 },
      { x: 1460, y: floorY - 170, width: 180, height: 24 },
      { x: 1860, y: floorY - 80, width: 180, height: 24 },
      { x: this._levelWidth - 300, y: floorY - 140, width: 180, height: 24 },
    ];
  }

  _buildPlatforms(width, height) {
    this.platformGroup = this.physics.add.staticGroup();

    this._getShelfDefinitions(width, height).forEach((shelf) => {
      const platform = this.add.rectangle(shelf.x, shelf.y, shelf.width, shelf.height, 0x8b4513);
      this.physics.add.existing(platform, true);
      this.platformGroup.add(platform);
    });
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

    productPositions.forEach((pos) => {
      let product = null;
      try {
        product = new Product(this, pos.x, pos.y);
      } catch (e) {
        console.warn('Product fallback rectangle used', e);
        this._errorMessages.push(`Product fallback: ${e.message || e}`);
      }

      if (!product) {
        product = this.add.rectangle(pos.x, pos.y, 32, 32, 0xffcc00);
        this.physics.add.existing(product, true);
        product.price = Number(`${Phaser.Math.Between(10, 99)}.99`);
        product.priceLabel = this.add.text(pos.x, pos.y - 18, `${product.price.toFixed(2)} nis`, {
          fontFamily: 'Arial',
          fontSize: '11px',
          color: '#1f2937',
          backgroundColor: '#ffffffdd',
          padding: { x: 4, y: 2 },
          align: 'center',
          fixedWidth: 40,
        }).setOrigin(0.5, 1);
      }

      this.productGroup.add(product);
    });
  }

  _buildFinishLine(width, height) {
    const x = this._levelWidth - 80;
    const y = height - 20;
    this.finishZone = this.add.rectangle(x, y - 40, 24, 80, 0x10b981);
    this.physics.add.existing(this.finishZone, true);

    this.add.text(x, y - 90, 'Cashier', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#00000099',
      padding: { x: 6, y: 4 },
    }).setOrigin(0.5, 1);
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

    this.add.text(this.cameras.main.midPoint.x, 120, 'You reached the cashier!', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#000000c0',
      padding: { x: 10, y: 8 },
    }).setOrigin(0.5, 0.5).setScrollFactor(0);
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

    if (actualProduct.destroy) {
      actualProduct.destroy();
    }
  }

  _createHUD() {
    this.scoreText = this.add.text(16, 16, `Budget: ${this._formatPrice(this.score)}`, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#00000080',
      padding: { x: 8, y: 6 },
    }).setScrollFactor(0);
  }

  _updateHUD() {
    if (this.scoreText) {
      this.scoreText.setText(`Budget: ${this._formatPrice(this.score)}`);
    }
  }

  _makeProductPrice() {
    return Number(`${Phaser.Math.Between(10, 99)}.99`);
  }

  _formatPrice(value) {
    return `${value.toFixed(2)} nis`;
  }

  triggerGameOver() {
    this.isGameOver = true;
  }
}


 
