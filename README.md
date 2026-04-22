# Loner Assistant

An [Obsidian](https://obsidian.md) plugin for playing **Loner 4e**, a minimalist solo tabletop RPG by Roberto Bisceglie. It brings the full play loop — Oracle rolls, Twist Counter, Scene Transitions, Conflict resolution, and post-session bookkeeping — directly into your vault, with all game state persisted as YAML frontmatter in your notes.

---

## Features

- **Oracle Widget** — interactive code block, rolls Chance and Risk dice, handles Advantage/Disadvantage, displays results with styled badges
- **Twist Counter** — persistent status bar item, auto-increments on doubles, triggers and rolls the Twist table at 3
- **Protagonist Sidebar** — full character sheet with live frontmatter sync: identity, skills/gear, luck pips, tags, challenge/status tracks, leverage, twist counter
- **Scene Transition** — 1d6 roll with dramatic/quiet/meanwhile outcomes; full guided Meanwhile procedure
- **Inspiration Tables** — Verb × Noun × Adjective random prompt generator (all 6×6 tables included)
- **Harm & Luck (Conflict Mode)** — damage tracking inside the Oracle widget; applies to protagonist or an ephemeral opponent counter
- **Challenge Tracks** — 4-box progress tracks embedded in notes via `loner-track` code blocks
- **Status Tracks** — 3-box consequence tracks (Physical / Social / Psychological) via `loner-status` code blocks
- **Leverage** — bank a `Yes, and...` result, spend it as Advantage on a future roll
- **Adventure Maker** — 2d6 setting/premise/tone generator
- **Living World** — guided end-of-session wizard for character growth, NPC/location updates, and unresolved events
- **Step Dice variant** — Appendix D oracle using d6/d8/d10 step dice instead of dice pools
- **Lonelog mode** — optional output in [Lonelog v1.4.1](https://zeruhur.space/lonelog) notation instead of Obsidian callouts

---

## Installation

### Via BRAT (recommended for beta)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) from the Obsidian community plugins list.
2. Open BRAT settings → **Add Beta Plugin**.
3. Enter: `zeruhur/loner-obsidian`
4. Enable **Loner Assistant** in Settings → Community Plugins.

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest).
2. Copy them into `.obsidian/plugins/loner-assistant/` inside your vault.
3. Reload Obsidian and enable the plugin.

---

## Quick Start

1. **Create your Protagonist note.** Add this frontmatter (minimum required fields):

   ```yaml
   ---
   loner_protagonist: true
   name: "Zahra Nakajima"
   concept: "Witty Street Cat"
   frailty: "Merciful"
   skills:
     - "Streetwise"
     - "Nimble"
   gear:
     - "Knife"
     - "Low O2 Supplement"
   luck: 6
   luck_max: 6
   twist_counter: 0
   ---
   ```

2. **Point the plugin to your note.** Go to Settings → Loner Assistant → *Protagonist note path* → enter the note's path (e.g. `Characters/Zahra.md`).

3. **Open the Protagonist Sheet** via the ribbon dice icon or command palette (`Open Protagonist Sheet`).

4. **Insert an Oracle widget** in any note:

   ````
   ```loner-oracle
   ```
   ````

5. **Roll the Oracle.** Select Advantage/Disadvantage if needed, click *Ask the Oracle*.

See the [User Guide](docs/user-guide.md) for full documentation of all features.

---

## Settings

| Setting | Default | Description |
|---|---|---|
| Protagonist note path | *(empty)* | Vault path to the active Protagonist note |
| Enable Challenge Tracks | On | Show Challenge Track section in sidebar |
| Enable Leverage | On | Show Leverage section in sidebar |
| Enable Status Track | On | Show Status Track section in sidebar |
| Use Step Dice Oracle | Off | Appendix D variant: d6/d8/d10 instead of dice pools |
| Auto-insert results into note | On | Show "Copy result to note" button after each roll |
| Result callout style | Callout | Obsidian callout / blockquote / plain text |
| Enable Lonelog output mode | Off | Output Lonelog notation instead of callouts |
| Lonelog session note path | *(empty)* | Target note for Lonelog insertion |

---

## Loner 4e

Loner 4e is a one-page solo tabletop RPG by Roberto Bisceglie, published under CC BY-SA 4.0. You need the rulebook to play — available at [zeruhur.space](https://zeruhur.space).

---

## License

MIT — see [LICENSE](LICENSE).

Lonelog v1.4.1 notation format by Roberto Bisceglie, CC BY-SA 4.0.
