# Admin Panel Development Standards & Specs

This guide establishes the coding standards, interface styling rules, and feature requirements for building the game's Admin content-management system (`/Admin`).

---

## 1. Project Stack & Design Aesthetics

### Tech Stack
* **Core**: Pure HTML5 (semantic elements), Vanilla ES Modules (`import`/`export`), and Vanilla CSS.
* **Vite Integration**: The build setup is managed through the root Vite config. Build outputs go to `/dist`.
* **File Naming**: Strictly lowercase, kebab-case (e.g., `constants-editor.js`, `dialogue-manager.js`, `admin-styles.css`).

### Design Guidelines (The Pink Front Brand identity)
* **Color Palette**: Modern, premium dark mode with vibrant pink/magenta accents.
  * *Primary Background*: Deep slate/dark gray (`#0f172a` or `#0b0f19`)
  * *Secondary Cards/Panels*: Dark blue-gray (`#1e293b` or `#161f30`)
  * *Accents/Highlights*: Vibrant pink/rose (`#f43f5e`, `#db2777`)
  * *Success/Info Colors*: Emerald green (`#10b981`), Cyan (`#06b6d4`)
* **Typography**: Modern sans-serif (e.g., `Inter`, `Outfit`, or system default). Set line heights and letter spacing for clean readability.
* **Layout**: Responsive grid/flex layout with left-sidebar navigation and a content viewport. No hardcoded pixel widths.
* **Interactions**: Implement smooth hover animations, focus transitions, and subtle active-click micro-animations.

---

## 2. Feature Requirements

The Admin panel is a content editor designed to read, modify, and save the central game content config file: `/Game/assets/config/game-data.json`.

### 1. Game Constants Editor
* **Target**: Manage numeric variables that control game balance.
* **Fields**:
  * Target score for completion (range: `20 - 500`)
  * Score reward for correct answer (range: `5 - 50`)
  * Score penalty for drone collision (range: `0 - 50`)
  * Starting lives (range: `1 - 10`)
  * Total drones to spawn (range: `1 - 50`)
* **Features**: Live validation (ensure inputs are numbers, reject invalid ranges).

### 2. Dialogue & Cutscene Script Editor
* **Target**: Customize text narratives for NPCs and Judge Solberg.
* **Features**:
  * List all dialogues grouped by trigger scenarios (e.g., `clerkRejection`, `solbergIntro`, `friendEncounter`).
  * Add, delete, and re-order dialogue steps.
  * Inputs for speaker names and speech text.

### 3. Trivia Database Manager
* **Target**: Maintain the list of trivia questions.
* **Features**:
  * Add new questions, or delete/edit existing ones.
  * Form inputs for:
    * Question text (Hebrew/English support).
    * Four distinct answer options.
    * Radio selector to mark the `correctIndex` (0 to 3).
  * Auto-validation: Prevent saving if options are empty or no correct answer is chosen.

### 4. Supermarket Item Configurator
* **Target**: Control grocery items collected in Stage 3.
* **Features**:
  * Tag-input or dynamic list to add/remove required items (e.g., `Bread`, `Milk`, `Cheese`).

---

## 3. Data Integration & Validation

### Persistence Model
* **Local Storage / Download**: In standard static-hosting mode, enable saving to browser `localStorage` and provide a **"Download game-data.json"** button so developers can easily save changes back to `/Game/assets/config/game-data.json`.
* **API Sync**: When a backend or development server is configured, support `POST` requests to save changes directly to the server filesystem.

### Schema Validation
* Prior to executing any save action:
  * Perform client-side validation against the game configuration schema.
  * Verify that `correctIndex` falls within `[0, options.length - 1]`.
  * Ensure critical constant keys (e.g. `targetScore`) are always present and are positive integers.
  * Warn the user of unsaved changes before page navigation.
