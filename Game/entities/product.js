import Phaser from 'phaser';

export class Product extends Phaser.GameObjects.Rectangle {
  constructor(scene, x, y) {
    super(scene, x, y, 40, 40, 0xffcc00);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);

    this.setStrokeStyle(2, 0x663300);
    this.setOrigin(0.5, 1);

    this.body.setSize(40, 40);
    this.body.setOffset(-20, -40);
  }
}