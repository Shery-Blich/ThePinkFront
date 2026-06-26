import Phaser from 'phaser';

const GROCERY_TEXTURES = [
  'grocery-vegetable',
  'grocery-bread',
  'grocery-milk',
  'grocery-proteins',
  'grocery-snack',
];

export class Product extends Phaser.GameObjects.Image {
  constructor(scene, x, y, price = null, textureKey = null) {
    const key = textureKey || Phaser.Math.RND.pick(GROCERY_TEXTURES);
    const size = 40;
    super(scene, x, y, key);

    scene.add.existing(this);
    scene.physics.add.existing(this, true);

    this.setDisplaySize(size, size);

    this.price = price !== null
      ? price
      : Phaser.Math.Between(5, 15);

    this.setOrigin(0.5, 1);

    if (this.body) {
      this.body.setSize(size, size);
      this.body.setOffset(-size / 2, -size);
    }

    this.priceLabel = scene.add.text(x, y - size - 6, `₪${this.price}`, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#1f2937',
      backgroundColor: '#ffffffdd',
      padding: { x: 4, y: 2 },
      align: 'center',
      fixedWidth: size + 8,
    }).setOrigin(0.5, 1);

    this.priceLabel.setDepth(1);
  }

  getPrice() {
    return this.price;
  }

  preUpdate(time, delta) {
    if (this.priceLabel) {
      this.priceLabel.setPosition(this.x, this.y - this.displayHeight - 6);
    }
  }

  destroy(fromScene) {
    if (this.priceLabel) {
      this.priceLabel.destroy();
      this.priceLabel = null;
    }
    super.destroy(fromScene);
  }
}
