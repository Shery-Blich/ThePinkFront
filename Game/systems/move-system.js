export class MoveSystem {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.walkSpeed = 220;
  }

  update() {
    const body = this.player.body;
    if (!body) {
      return;
    }

    body.setVelocityX(0);

    if (this.cursors.left.isDown) {
      body.setVelocityX(-this.walkSpeed);
    } else if (this.cursors.right.isDown) {
      body.setVelocityX(this.walkSpeed);
    }
  }
}