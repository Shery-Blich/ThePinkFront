import Phaser from 'phaser';

export class Product extends Phaser.GameObjects.Rectangle {
  constructor(scene, x, y, price = null) {
    const width = 40;
    const height = 40;
    super(scene, x, y, width, height, 0xffcc33);

    scene.add.existing(this);
    scene.physics.add.existing(this, true);

    this.price = price !== null
      ? price
      : Phaser.Math.Between(5, 15);

    this.setStrokeStyle(2, 0x663300);
    this.setOrigin(0.5, 1);

    this.body.setSize(width, height);
    this.body.setOffset(-width / 2, -height);

    this.priceLabel = scene.add.text(x, y - height - 6, `₪${this.price}`, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#1f2937',
      backgroundColor: '#ffffffdd',
      padding: { x: 4, y: 2 },
      align: 'center',
      fixedWidth: width + 8,
    }).setOrigin(0.5, 1);

    this.priceLabel.setDepth(1);
  }

  preUpdate(time, delta) {
    if (this.priceLabel) {
      this.priceLabel.setPosition(this.x, this.y - this.height - 6);
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