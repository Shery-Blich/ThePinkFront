import Phaser from 'phaser';
import { Character } from '../entities/character.js';
import { Player } from '../entities/player.js';
import { Product } from '../entities/product.js';
import { JumpSystem } from '../systems/jump-system.js';
import { MoveSystem } from '../systems/move-system.js';

const BLOCK_HEIGHT = 50;
const PRODUCT_COUNT = 12;

export class Day2Scene extends Phaser.Scene {
  constructor() {
    super({ key: 'Day2Scene' });

    this.player = null;
    this.jumpSystem = null;
    this.moveSystem = null;
    this.productGroup = null;
    this.platformGroup = null;
    this.score = 0;
    this.isGameOver = false;
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(0xa6d8ff);
    this.physics.world.setBounds(0, 0, width, height);

    this._buildGround(width, height);
    this._buildPlatforms();

    this.productGroup = this.physics.add.staticGroup();
    this._spawnProducts();

    this.player = new Player(this, 100, height - BLOCK_HEIGHT - 80, 1);
    this.player.body.setCollideWorldBounds(true);

    this.physics.add.collider(this.player, this.platformGroup);
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.overlap(this.player, this.productGroup, this.collectProduct, null, this);

    this.jumpSystem = new JumpSystem(this, this.player);
    this.moveSystem = new MoveSystem(this, this.player);

    this._createHUD();

    this.input.on('pointerdown', () => {
      if (!this.isGameOver) {
        this.jumpSystem.jump();
      }
    });
  }

  update() {
    if (this.isGameOver) {
      return;
    }

    this.moveSystem.update();
    this.jumpSystem.update();
    this.player.update && this.player.update();
  }

  _buildGround(width, height) {
    this.ground = this.add.rectangle(width / 2, height - 20, width, 40, 0x7b4f18);
    this.physics.add.existing(this.ground, true);
  }

  _buildPlatforms() {
    this.platformGroup = this.physics.add.staticGroup();

    const platformPositions = [
      { x: 180, y: 420 },
      { x: 420, y: 360 },
      { x: 680, y: 300 },
      { x: 940, y: 420 },
      { x: 300, y: 220 },
    ];

    platformPositions.forEach((pos) => {
      const platform = this.add.rectangle(pos.x, pos.y, 180, 24, 0x8b4513);
      this.physics.add.existing(platform, true);
      this.platformGroup.add(platform);
    });
  }

  _spawnProducts() {
    const productPositions = [
      { x: 180, y: 380 },
      { x: 420, y: 320 },
      { x: 680, y: 260 },
      { x: 940, y: 380 },
      { x: 300, y: 180 },
      { x: 120, y: 520 },
      { x: 560, y: 520 },
      { x: 820, y: 520 },
      { x: 1000, y: 520 },
      { x: 520, y: 180 },
      { x: 760, y: 180 },
      { x: 260, y: 520 },
    ];

    productPositions.slice(0, PRODUCT_COUNT).forEach((pos) => {
      const product = new Product(this, pos.x, pos.y);
      this.productGroup.add(product);
    });
  }

  collectProduct(player, product) {
    product.destroy();
    this.score += 1;
    this._updateHUD();
  }

  _createHUD() {
    this.scoreText = this.add.text(16, 16, `Products: ${this.score}`, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#00000080',
      padding: { x: 8, y: 6 },
    });
  }

  _updateHUD() {
    this.scoreText.setText(`Products: ${this.score}`);
  }

  triggerGameOver() {
    this.isGameOver = true;
  }
}