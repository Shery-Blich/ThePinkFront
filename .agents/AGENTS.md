# The Pink Front - Global Agent Rules & Standards

This document establishes the development standards, code style, naming conventions, and project architecture for **The Pink Front** project. All agents and developers working on this project must strictly adhere to these rules.

---

## 1. Core Principles
* **Modularity**: Logic, rendering, and content configuration must remain separate. No hardcoded game narrative, dialogue text, or trivia questions.
* **Responsive & Mobile-First**: The game and admin panel must scale and display correctly across all devices (mobile, tablet, desktop) and orientations.
* **Low-Capped Filenames**: To avoid case-sensitivity conflicts in multi-platform builds and deployments, all file and directory names must be strictly lowercase and use kebab-case (e.g., `boot-scene.js`, `tap-to-move.js`).
  * *Note: Existing PascalCase files (e.g., `BootScene.js`) are deprecated and should be refactored to kebab-case.*

---

## 2. Directory Structure
All developments must align with the following directory structure:
```
/ThePinkFront
  ├── /Admin              # Admin dashboard to configure game content
  │     ├── /css          # CSS styles (using vanilla CSS variables and themes)
  │     └── /js           # Vanilla Javascript modules for configuration logic
  ├── /Game               # Phaser.js game source
  │     ├── /assets       # Art, audio, and configuration JSON assets
  │     │     └── /config # game-data.json (central question/dialogue database)
  │     ├── /entities     # Game entity classes (character, player, npc, etc.)
  │     ├── /scenes       # Phaser Scene classes (boot, level-1, supermarket)
  │     └── /systems      # Reusable gameplay systems (movement, scoring, HUD)
  ├── vite.config.js      # Vite build configurations
  └── package.json        # Main dependencies and run scripts
```

---

## 3. Code Standards & Naming Conventions
* **Files**: Lowercase, kebab-case (e.g., `day1-scene.js`, `game-data.json`).
* **JavaScript Variables & Functions**: camelCase (e.g., `playerScore`, `spawnDrones()`).
* **Classes**: PascalCase (e.g., `class TapToMove` inside `tap-to-move.js`).
* **CSS Classes**: Lowercase, kebab-case (e.g., `.admin-panel-container`).
* **JSON Keys**: camelCase or snake_case as per data structures, but must be consistent.
* **Documentation**: Provide JSDoc headers for all classes, helper functions, and custom Phaser methods detailing types and parameters.

---

## 4. Git & Commit Guidelines
* Follow **Conventional Commits** format:
  * `feat: add female character sprite selection`
  * `fix: prevent player from moving during Solberg trivia dialogues`
  * `chore: update packages and format configuration rules`
* Make small, incremental, and well-tested changes.

---

## 5. Scope-Specific Development Pointers
Depending on the task you are assigned, you must immediately read and follow the respective rules:

* **Game Scene / Gameplay Mechanics**: Read and follow [.agents/game.md](file:///C:/Github/ThePinkFront/ThePinkFront/.agents/game.md)
* **Admin Dashboard / Content CMS**: Read and follow [.agents/admin.md](file:///C:/Github/ThePinkFront/ThePinkFront/.agents/admin.md)
