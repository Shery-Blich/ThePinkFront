# Game Development Standards & Scene 1 Specification

This guide defines styling, programming, and layout practices for the Phaser.js client (`/Game`), along with structural rules for implementing **Scene 1 (Kiryat Shmona)**.

---

## 1. Phaser.js Best Practices & Architecture

### Class & File structure
* **Game Entities**: Extend `Character` (defined in [character.js](file:///C:/Github/ThePinkFront/ThePinkFront/Game/entities/character.js)).
* **Movement / Systems**: Write standalone system classes (like [tap-to-move.js](file:///C:/Github/ThePinkFront/ThePinkFront/Game/systems/tap-to-move.js)) that emit events, rather than wrapping logic inside the Scene class itself.
* **Lowercase File Names**: Ensure new files use lowercase kebab-case (e.g., `character.js`, `tap-to-move.js`).

### Device-Independent Scaling & Positioning
* The game config uses `Phaser.Scale.RESIZE`. Everything must be placed and sized dynamically relative to the runtime canvas size:
  ```javascript
  const { width, height } = this.scale;
  ```
* **Sprite Scaling**: Scale factors must be computed using screen height so assets look identical across phone, tablet, and desktop screens:
  ```javascript
  this.spriteScale = Character.computeScale(height); // usually ~12% height / 20px
  ```
* **Road & Ground Bounds**: Specify top/bottom bounds as relative values (e.g. `this.roadTop = Math.round(height * 0.60)`).
* **Speed / Distance**: Calculate movement speed and collision bounds in units scaled by `spriteScale` to keep gameplay feel consistent regardless of resolution.

### Depth Sorting
* Set character sprite origins to `(0.5, 1)` (feet placement).
* In the scene's `update()` function, always update depths based on Y coordinates:
  ```javascript
  sprite.setDepth(sprite.y);
  ```

### Memory Management & Clean-up
* **Destroy Listeners**: In any custom system/helper class, listen to the scene's `shutdown` and `destroy` events to release keyboard/pointer inputs, destroy tweens, stop running loops, and set sprite references to `null`.

---

## 2. Scene 1 (Kiryat Shmona) Design & Flow

### Level Parameters
* **Target Score**: 100 points.
* **Scoring Rules**:
  * Correct Trivia Answer: `+20 points`
  * Drone Collision: `-1 Life` and `-5 points`

### Stage 1: Character Select & Cutscene Intro
1. **Character Selection**: Before gameplay begins, present an overlay or sub-state to select between Male and Female character assets. Store the selected texture key in the global/scene player state.
2. **Kiryat Shmona Street**: Player starts outside their home. A target marker directs them to the polling station.
3. **Dialogue Interaction**: Upon touching the station door, the polling station clerk NPC triggers a dialogue: "Entry denied. You must vote at the polling station nearest to your parent's home."
4. **Solberg Intervention**: The Chairman of the Election Committee, Judge Solberg, appears on-screen.
   * **Dialogue**: "Nice to meet you, I am Judge Solberg, Chairman of the Election Committee! The road to the ballot is not simple today... Dodge the drones, answer questions correctly, and collect 100 points. Democracy is in your hands!"

### Stage 2: Core Gameplay (Dodging & Friend Encounter)
1. **Drones Dodge System**: An infinite-runner style side scroller. Spawn 10 drones flying across the road at varying heights that the player must dodge using tap-to-move input.
2. **Encounter Friend**: After surviving the 10 drones, spawn a "Friend" NPC blocking the path.
3. **Dialogue Choice**:
   * **Player**: "Who are you voting for?"
   * **Friend**: "Maybe The Pirates."
   * **Player**: "But they won't pass the threshold."
4. **Solberg Trivia Trigger**: Solberg interrupts with a trivia question.
   * **Question**: *If many people vote for parties that don't pass the threshold, how does it affect the parties that did enter the Knesset?*
   * **Options**:
     * A. There will be fewer than 120 members.
     * B. It doesn't matter, those votes just disappear.
     * C. The parties that entered get more power, their votes are worth more seats. **[CORRECT]**
     * D. Results are disqualified and new elections are called.

### Stage 3: Supermarket Transition
1. **Visual Transition**: The street background scrolls out and transforms into a Supermarket interior.
2. **Illegal Activity**: An NPC stands at a booth labeled *"Discount coupon for those who photographed themselves at the polling station!"* requesting a photo of the player's ballot.
3. **Solberg Alert**: Solberg interrupts: "Hey! That is illegal election propaganda!"
4. **Collect Quest**: Player must navigate the supermarket to collect food items (Fruits, Vegetables, Cheese, Bread).
5. **Cashier Dialogue**: Upon checking out:
   * **Cashier**: "Not enough money, maybe let's sign an 'Excess Vote Agreement'?"
6. **Solberg Trivia Trigger**: Solberg interrupts with the second trivia question.
   * **Question**: *Parties sign 'Excess Vote Agreements' before elections. What is the goal?*
   * **Options**:
     * A. Decide to merge into one large party.
     * B. Combine "surplus" votes (that didn't make a full mandate) to potentially gain another seat. **[CORRECT]**
     * C. Split tax money received.
     * D. Allow members to switch parties mid-term.

---

## 3. Data Modularity

* All text, dialogues, questions, options, correct answers, scoring weights, drone counts, and supermarkets items **must** be loaded from `/Game/assets/config/game-data.json`.
* Do **not** hardcode strings or parameters in scene files.

### Expected JSON Schema:
```json
{
  "constants": {
    "targetScore": 100,
    "pointsForCorrectAnswer": 20,
    "pointsDeductedOnDroneCollision": 5,
    "startingLives": 3,
    "droneCount": 10
  },
  "dialogues": {
    "clerkRejection": [
      { "speaker": "Clerk", "text": "Entry denied. You must vote at the polling station nearest to your parent's home." }
    ],
    "solbergIntro": [
      { "speaker": "Solberg", "text": "Nice to meet you, I am Judge Solberg, Chairman of the Election Committee! The road to the ballot is not simple today..." }
    ],
    "friendEncounter": [
      { "speaker": "Player", "text": "Who are you voting for?" },
      { "speaker": "Friend", "text": "Maybe The Pirates." },
      { "speaker": "Player", "text": "But they won't pass the threshold." }
    ]
  },
  "trivia": [
    {
      "id": "threshold_impact",
      "question": "If many people vote for parties that don't pass the threshold, how does it affect the parties that did enter the Knesset?",
      "options": [
        "There will be fewer than 120 members.",
        "It doesn't matter, those votes just disappear.",
        "The parties that entered get more power, their votes are worth more seats.",
        "Results are disqualified and new elections are called."
      ],
      "correctIndex": 2
    }
  ],
  "supermarket": {
    "itemsToCollect": ["Fruits", "Vegetables", "Cheese", "Bread"]
  }
}
```
