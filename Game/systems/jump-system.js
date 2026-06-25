export class JumpSystem {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.jumpVelocity = -420;

    this.scene.input.keyboard.on('keydown-UP', this.jump, this);
    this.scene.input.keyboard.on('keydown-SPACE', this.jump, this);
  }

  update() {
    const body = this.player.body;
    if (!body) {
      return;
    }
    this.grounded = body.blocked.down || body.touching.down;
  }

  jump() {
    const body = this.player.body;
    if (!body) {
      return;
    }

    if (body.blocked.down || body.touching.down) {
      body.setVelocityY(this.jumpVelocity);
    }
  }
}