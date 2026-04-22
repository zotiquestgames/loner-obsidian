# Loner 4e Obsidian Plugin — LLM Implementation Specification

## Overview

You are building an Obsidian plugin (TypeScript, Obsidian API) that supports playing **Loner 4e**, a minimalist solo tabletop RPG. The plugin provides in-note interactive components and a persistent sidebar for the Protagonist sheet. It covers the full play loop: Oracle rolls, Advantage/Disadvantage, Twist Counter, Scene Transitions, Inspiration Tables, and all optional modules (Challenge Tracks, Leverage, Status Track). A secondary set of modules handles the Adventure Maker and the Living World post-session procedure.

The plugin is called **`loner-4e`** and its main class is `LonerPlugin`.

All game state is persisted in YAML frontmatter of designated notes (see Data Model). The plugin never stores mutable game state in its own `data.json` — it reads from and writes to vault notes. This ensures the player's journal IS the game record.

---

## Project Structure

```
loner-4e/
├── main.ts                  # Plugin entry point
├── manifest.json
├── styles.css
├── src/
│   ├── oracle.ts            # Oracle roll engine
│   ├── twist.ts             # Twist Counter logic
│   ├── scene.ts             # Scene Transition roller
│   ├── inspiration.ts       # Open-Ended Questions tables
│   ├── tracks.ts            # Challenge Track & Status Track
│   ├── leverage.ts          # Leverage module
│   ├── adventure-maker.ts   # Adventure Maker tables
│   ├── protagonist-view.ts  # Sidebar leaf (ProtagonistView)
│   ├── protagonist-sheet.ts # Sheet read/write helpers
│   ├── living-world.ts      # Living World post-session modal
│   ├── modals.ts            # Shared modal base classes
│   ├── tables.ts            # All static table data
│   └── lonelog.ts           # Lonelog output formatter (optional)
```

---

## Architecture

### Rendering Strategy

| Component | Approach |
|---|---|
| Oracle Roller | Markdown code block processor: ` ```loner-oracle ``` ` |
| Challenge Track | Markdown code block processor: ` ```loner-track ``` ` |
| Status Track | Markdown code block processor: ` ```loner-status ``` ` |
| Protagonist Sheet | Custom sidebar leaf (`VIEW_TYPE_PROTAGONIST`) |
| Twist Counter | Obsidian status bar item (bottom bar, persistent) |
| Scene Transition | Command Palette command + modal output |
| Inspiration Tables | Command Palette command + modal output |
| Adventure Maker | Command Palette command + modal output |
| Living World | Command Palette command + dedicated modal |
| Leverage | Rendered inside Protagonist sidebar panel |

### Code Block Processors

Register processors in `onload()` using `this.registerMarkdownCodeBlockProcessor(lang, handler)`. The handler receives `source` (the block's text), `el` (the container element), and `ctx` (MarkdownPostProcessorContext). Render interactive HTML into `el`.

State for code block components (track fill state, etc.) must be read from and written back to the block's `source` text in the note. Use `ctx.getSectionInfo(el)` to find the block's line range, then `app.vault.read` / `app.vault.modify` to update the note file.

---

## Data Model

### Protagonist Note (YAML Frontmatter)

The player designates one note as the active Protagonist sheet via a plugin setting (`settings.protagonistNotePath`). The plugin reads and writes this note's YAML frontmatter.

```yaml
---
loner_protagonist: true
name: "Zahra Nakajima"
concept: "Witty Street Cat"
skills:
  - "Streetwise"
  - "Nimble"
frailty: "Merciful"
gear:
  - "Knife"
  - "Low O2 Supplement"
goal: "Obtain unknown technology to save her planet"
motive: "She feels responsible for her home's survival"
nemesis: "The Naturalist Order"
luck: 6
luck_max: 6
tags: []
relationship_tags: []
leverage: null          # null or string description of held leverage
twist_counter: 0
challenge_tracks: []    # array of ChallengeTrack objects
status_tracks: []       # array of StatusTrack objects
---
```

#### ChallengeTrack Object
```yaml
- id: "expose-leton"
  label: "Expose the Leton Corporation"
  boxes: [true, true, false, false]   # 4 booleans
  reversed: false                     # true = threat track (fills = bad)
```

#### StatusTrack Object
```yaml
- id: "zahra-status"
  label: "Physical"
  type: "physical"       # physical | social | psychological
  boxes: [true, false, false]
  tags:
    - "Hurt"
    - "Injured"
    - "Overcome"
```

### NPC/Location Notes

The plugin does not enforce a schema for NPC or Location notes. Instead, it offers Living World modal assistance that opens relevant notes and prompts the player to update tags and descriptions. Notes with `loner_entity: true` in their frontmatter are surfaced in the Living World modal.

---

## Module 1: Oracle Roller (Core)

### Mechanics

- Roll **1 Chance Die (d6)** and **1 Risk Die (d6)**.
- Compare: Chance > Risk → **Yes**; Risk > Chance → **No**; Both equal → **Yes, but...** (and increment Twist Counter by 1).
- Modifier check: both dice ≤ 3 → append **but...**; both dice ≥ 4 → append **and...**.
- Doubles are always **Yes, but...** regardless of modifier check (doubles ≤ 3 or ≥ 4 do not change the result, only add +1 Twist).

Full resolution table:

| Condition | Result |
|---|---|
| Chance > Risk | Yes |
| Chance > Risk, both ≤ 3 | Yes, but... |
| Chance > Risk, both ≥ 4 | Yes, and... |
| Risk > Chance | No |
| Risk > Chance, both ≤ 3 | No, but... |
| Risk > Chance, both ≥ 4 | No, and... |
| Both equal | Yes, but... (+1 Twist Counter) |

### Advantage and Disadvantage

- **Advantage**: roll **2 Chance Dice**, keep the highest. Still roll 1 Risk Die normally.
- **Disadvantage**: roll **2 Risk Dice**, keep the highest. Still roll 1 Chance Die normally.
- **Cap**: never more than 2 Chance or 2 Risk Dice total per roll, regardless of how many tags apply.
- Multiple positive tags (net of negatives) → Advantage. Multiple negative tags (net of positives) → Disadvantage. Positives and negatives cancel each other out → Neutral.

### Step Dice Oracle Variant (Appendix D)

When `settings.useStepDice` is `true`, replace the Advantage/Disadvantage dice pool logic:
- Base roll: Chance d6 vs Risk d6.
- 1 advantage → Chance die steps up to **d8**.
- 2+ advantages → Chance die steps up to **d10**.
- 1 disadvantage → Risk die steps up to **d8**.
- 2+ disadvantages → Risk die steps up to **d10**.
- Resolution logic (compare, both ≤ 3, both ≥ 4) is identical. Thresholds do **not** change with die size.

### Code Block Format

The player inserts this block into any note:

````
```loner-oracle
```
````

The block renders as a self-contained widget with no required parameters. It reads the current Advantage/Disadvantage state from the Protagonist sheet's context (or offers toggle buttons in the widget itself).

### Rendered Widget

The widget renders as a `div.loner-oracle-widget` containing:

1. **Advantage/Disadvantage toggles**: three buttons labeled `Disadvantage`, `Neutral`, `Advantage`. Active state is highlighted. This is per-widget state (not persisted to the sheet); it's a roll-time modifier.

2. **Roll button**: labeled `Ask the Oracle`. On click:
   - Rolls dice according to active modifier mode and `settings.useStepDice`.
   - Computes result string (e.g. `Yes, and...`).
   - Checks for doubles → if doubles, calls `incrementTwistCounter()`.
   - Displays result in the widget's result area.

3. **Result display area**: shows:
   - Individual die values (e.g. `Chance: 5 | Risk: 4` or in Step Dice mode: `Chance (d8): 6 | Risk (d6): 3`).
   - Result badge (large, styled by result type: Yes/No/and/but).
   - If doubles: a notice `+1 Twist Counter` with current counter value.
   - If Twist triggered: a notice `⚡ Twist triggered!` with the rolled Twist result (see Module 3).

4. **Luck Conflict mode toggle** (optional, inside the widget): a checkbox `Conflict (Harm & Luck)`. When checked, the result display also shows the Luck damage amount:
   - Yes, and... → Deal 3 / No, and... → Take 3
   - Yes → Deal 2 / No → Take 2
   - Yes, but... → Deal 1 / No, but... → Take 1
   - Buttons to apply damage to Protagonist Luck or to an opponent Luck (player inputs opponent's current Luck inline).

### Output to Note

After rolling, a `Copy result to note` button appends a formatted callout to the current note:

```markdown
> [!oracle] Yes, and...
> Chance: 5 · Risk: 4 · Advantage
> *Zahra forces the hatch without triggering an alarm, and finds a map inside.*
```

The callout type maps to the result: `[!oracle-yes]`, `[!oracle-no]`, `[!oracle-twist]`.

---

## Module 2: Protagonist Sidebar (Core)

### View Registration

Register a custom leaf view with `VIEW_TYPE_PROTAGONIST = 'loner-protagonist-view'`. Open it via a ribbon icon (d6 icon) and a command `Open Protagonist Sheet`.

The view reads from and writes to `settings.protagonistNotePath`. If no note is set, it shows a prompt to select or create one.

### Layout

The sidebar is divided into collapsible sections:

#### Section 1: Identity
- Editable fields: Name, Concept, Frailty, Goal, Motive, Nemesis.
- Each field is an inline text input. On blur, write back to frontmatter.

#### Section 2: Skills & Gear
- Two Skills (editable text inputs).
- Two Gear items (editable text inputs).
- A `+` button to add additional Skills or Gear beyond the base two (the rules do not hard-cap these after character advancement).

#### Section 3: Luck
- Displays current Luck as clickable pips (6 filled circles by default).
- Click a pip to reduce Luck to that value.
- A `Reset Luck` button restores `luck` to `luck_max` (default 6).
- A `+` / `−` stepper for `luck_max` (for NPCs or unusual cases).

#### Section 4: Tags
- A list of active tags (free-form strings). Each tag has a delete button.
- An input + `Add Tag` button to add a new tag.
- Tags here are general scene/condition tags (not relationship tags).
- Each tag has a visual indicator button to mark it as `[Adv]` or `[Dis]` for the current scene — this is a non-persisted visual reminder, not a separate data field.

#### Section 5: Relationship Tags
- Separate list from general tags. Same add/delete interface.
- Each relationship tag shows as `[NPC Name] — Tag Text` (the player enters both parts as free text).

#### Section 6: Twist Counter
- Displays the counter as a row of 3 pips (0, 1, 2, 3).
- Manual `+1` and `Reset` buttons (the Oracle roller handles automatic increment, but manual control is needed).
- At value 3: the section turns highlighted (warning color) and shows a `Roll Twist` button.
- Clicking `Roll Twist` triggers the Twist procedure (see Module 3) and resets the counter to 0.

#### Section 7: Leverage (Optional Module)
- Toggle to enable/disable this module globally (`settings.useLeverage`).
- When enabled: shows current Leverage state.
  - **Empty**: a button `Bank Leverage` (enabled only when the last Oracle roll in this session was `Yes, and...`). On click: text input for the Leverage description.
  - **Held**: displays the description string. Two action buttons:
    - `Spend as Advantage` — clears Leverage, grants Advantage on next Oracle roll (sets a session flag `leverageAdvantageActive = true`).
    - `Convert No to No, but...` — clears Leverage; the player applies this manually to the next No result.
  - A `Discard` button to expire Leverage without spending it.
  - **Important**: Leverage is lost automatically when a Twist occurs. The `incrementTwistCounter()` function must check and clear Leverage when the counter resets (i.e., on Twist trigger).

#### Section 8: Challenge Tracks (Optional Module)
- Toggle to enable (`settings.useChallengeTracks`).
- When enabled: lists all open Challenge Tracks from the frontmatter.
- Each track shows:
  - Label (editable).
  - 4 clickable boxes (filled = marked). Clicking toggles a box.
  - A `Reversed` indicator if the track is a threat track.
  - A `Close Track` button (removes from the array).
- A `New Track` button opens a small form: Label, Reversed toggle, then creates a new track with 4 empty boxes.
- When all 4 boxes fill: the track highlights with a completion notice (`Challenge resolved.`). It does not auto-close; the player decides when to archive it.

#### Section 9: Status Track (Optional Module)
- Toggle to enable (`settings.useStatusTrack`).
- Lists all open Status Tracks from the frontmatter.
- Each track shows:
  - Label and type (Physical / Social / Psychological).
  - 3 clickable boxes. Filled boxes display their corresponding consequence tag.
  - Default tags by type:
    - Physical: Hurt / Injured / Overcome
    - Social: Rattled / On the Back Foot / Humiliated
    - Psychological: Unsettled / Shaken / Broken
  - Tags are editable (the rules note these are examples, not fixed).
  - When box 3 fills: notice `Character is overcome.`
  - A `Clear Box` button removes one box (requires narrative justification, noted in the UI as tooltip: "Recovery requires fictional justification: rest, treatment, or a recovery scene.").
  - A `Close Track` button.
- A `New Status Track` button: form for Label and Type.

---

## Module 3: Twist Counter & Twist Table (Core)

### Counter Logic

`twist_counter` lives in the Protagonist note's frontmatter. All reads/writes go through `protagonistSheet.getTwistCounter()` and `protagonistSheet.setTwistCounter(n)`.

`incrementTwistCounter()`:
1. Read current value.
2. Increment by 1.
3. If new value ≥ 3: trigger Twist (see below), then set counter to 0.
4. Else: write new value to frontmatter and update status bar.

The status bar item (registered with `this.addStatusBarItem()`) always shows `🔄 Twist: N/3`.

### Twist Procedure

When triggered (counter reaches 3):
1. If Leverage is held, discard it (Leverage rule: lost when a Twist occurs).
2. Roll 1d6 for Subject and 1d6 for Action independently (two separate rolls, each 1–6).
3. Look up both values in the Twist Table.
4. Display the result in a notice and in the Oracle widget's result area.

### Twist Table

Subject (1d6):
```
1: A third party
2: The hero
3: An encounter
4: A physical event
5: An emotional event
6: An object
```

Action (1d6):
```
1: Appears
2: Alters the location
3: Helps the hero
4: Hinders the hero
5: Changes the goal
6: Ends the scene
```

### Twist Intensity Note

After displaying the Subject + Action pair, the plugin shows a two-line interpretive prompt:
- If Luck is ≤ 3 or the Status Track has 2+ boxes filled (high pressure): `High pressure — interpret at maximum disruption.`
- Otherwise: `Clean state — interpret as a shift, not a collapse.`

This is a display heuristic only, not a mechanical rule.

### Output to Note

The Twist result is appended as a callout:

```markdown
> [!twist] Twist: A physical event / Changes the goal
> *(High pressure — interpret at maximum disruption.)*
```

---

## Module 4: Scene Transition (Core)

### Mechanic

Roll 1d6 at the end of a scene:
- 1–3: **Dramatic Scene** — stakes rise, new obstacles emerge.
- 4–5: **Quiet Scene** — protagonist has initiative; recovery, planning, relationships.
- 6: **Meanwhile** — the world acts. Follow the two-step procedure.

### Meanwhile Procedure (on result 6)

The plugin opens a modal (`MeanwhileModal`) that guides through two steps:

**Step 1: Update the Opposition**
- Text prompt: `Who holds power over the current situation? What do they do next?`
- A text input for the old tag and a text input for the updated tag.
- A button `Open NPC Note` that fuzzy-searches for loner_entity notes and opens the relevant one.

**Step 2: Ask the Oracle**
- Fixed question displayed: `Does an ally or wildcard act independently?`
- A `Roll Oracle` button that runs the standard Oracle (no Advantage/Disadvantage, no Twist Counter increment for this procedural roll).
- On Yes (any kind): prompt `Who is the NPC most affected by recent events? What do they do? Update their tags.` with a tag-update inline form and `Open NPC Note` button.
- On No: display `They hold. No independent action.`

### Command and Output

Command: `Loner: Roll Scene Transition`. Displays result in a modal and offers `Insert into Note` which appends:

```markdown
> [!scene] Quiet Scene (5)
> *Recovery, planning, or deepening a relationship.*
```

---

## Module 5: Open-Ended Questions / Inspiration Tables (Core)

### Mechanic

Roll 1d6 on the row and 1d6 on the column for each of three tables (Verbs, Nouns, Adjectives). Minimum result: Verb + Noun. Adjective is optional.

### Tables

#### Verbs (6×6)

```
     |  1      |  2      |  3      |  4       |  5      |  6      |
  1  | inject  | pass    | own     | divide   | bury    | borrow  |
  2  | continue| learn   | ask     | multiply | receive | imagine |
  3  | develop | behave  | replace | damage   | collect | turn    |
  4  | share   | hand    | play    | explain  | improve | cough   |
  5  | face    | expand  | found   | gather   | prefer  | belong  |
  6  | trip    | want    | miss    | dry      | employ  | destroy |
```

#### Adjectives (6×6)

```
     |  1          |  2             |  3          |  4             |  5          |  6        |
  1  | frequent    | faulty         | obscene     | scarce         | rigid       | long-term |
  2  | ethereal    | sophisticated  | rightful    | knowledgeable  | astonishing | ordinary  |
  3  | descriptive | insidious      | poor        | proud          | reflective  | amusing   |
  4  | silky       | worthless      | fixed       | loose          | willing     | cold      |
  5  | quiet       | stormy         | spooky      | delirious      | innate      | late      |
  6  | magnificent | arrogant       | unhealthy   | enormous       | truculent   | charming  |
```

#### Nouns (6×6)

```
     |  1          |  2      |  3     |  4      |  5        |  6       |
  1  | cause       | stage   | change | verse   | thrill    | spot     |
  2  | front       | event   | home   | bag     | measure   | birth    |
  3  | prose       | motion  | trade  | memory  | chance    | drop     |
  4  | instrument  | friend  | talk   | liquid  | fact      | price    |
  5  | word        | morning | edge   | room    | system    | camp     |
  6  | key         | income  | use    | humor   | statement | argument |
```

### Modal Layout (`InspirationModal`)

Command: `Loner: Roll Inspiration`. Opens a modal with:
- Three roll sections: **Verb**, **Noun**, **Adjective** (Adjective section has an "Include Adjective" checkbox, default checked).
- Each section has a `Roll` button and displays the current result.
- A `Roll All` button rolls all active sections at once.
- A `Re-roll` button per section.
- The combined prompt displays prominently: e.g. `multiply · motion · stormy`.
- An `Insert into Note` button appends:

```markdown
> [!inspiration] multiply · motion · stormy
```

### Contextual Oracle Integration

When the Oracle widget produces a `but...` or `and...` result, it shows a small `Roll Inspiration` link below the result display. Clicking it opens the InspirationModal directly.

---

## Module 6: Adventure Maker (Optional)

### Command

`Loner: Adventure Maker` — opens `AdventureMakerModal`.

### Tables

All tables use 2d6 (row = first d6, column = second d6). The plugin rolls and looks up each table. Tables are defined in `src/tables.ts` as 6×6 arrays.

#### Generate a Setting

- **Settings Table** (Table 1, 6×6): roll once.
- **Tones Table** (Table 2, 6×6): roll once.
- **Things Table** (Table 3, 6×6): roll **twice** (two separate results).

#### Generate an Adventure Premise

- **Opposition Table** (Table 5, 6×6): roll once.
- **Actions Table** (Table 4, 6×6): roll **twice**.
- **Things Table** (Table 3, 6×6): roll once.

#### Also Available

- **5W+H Adventure Frame Table** (Table in the "Start Your Game" section, single d6 per column, 6 columns: Who, What, Why, Where, How, Obstacle). Roll 1d6 per column.

### Modal Layout

Two tabs: **Setting** and **Adventure Premise**. Each tab has a `Roll` button, individual `Re-roll` buttons per entry, and `Insert into Note`.

Insert format:
```markdown
> [!adventure-maker] Adventure Setup
> **Setting**: Space Opera Adventure
> **Tone**: Suspenseful and thrilling
> **Things**: Vast Empires · Different Factions
> **Opposition**: Sinister organizations
> **Actions**: Seek · Uncover
```

---

## Module 7: Living World (Post-Session)

### Command

`Loner: Living World — End of Session`. Opens `LivingWorldModal`.

### Modal Steps

The modal is a guided multi-step wizard:

**Step 1: Character Growth**
- Prompt: `What did the Protagonist learn or gain?`
- Three optional fields: Add Skill, Add Gear, Add Frailty (each a text input with an `Add` button that writes back to the frontmatter).
- A `Modify Existing Trait` field: dropdown of current Skills, Gear, Frailty + text input for the new value.
- A `New Nemesis` field.

**Step 2: NPC Updates**
- Lists all vault notes with `loner_entity: true` in frontmatter that are tagged as NPCs.
- For each: shows current name, concept, and relationship tag (if any).
- Controls: `Update Relationship Tag` (text input), `Mark as Gone/Inactive` (checkbox), `Open Note`.
- A free-text note area for "What do they want now?"

**Step 3: Location Updates**
- Lists all vault notes with `loner_entity: true` tagged as Locations.
- For each: `Update Tag` (text input showing old tag → arrow → new tag), `Accessible?` toggle, `Open Note`.

**Step 4: Unresolved Events**
- A free-text area to note unresolved threads and the pressure they continue to exert.
- An `Add Event Note` button that creates a new note with a standard template.

**Step 5: Summary**
- Displays all changes made in this session for review.
- A `Finish` button that writes all pending frontmatter changes.

---

## Module 8: Harm & Luck (Conflict Mode)

This is not a standalone module — it is a mode within the Oracle widget and the Protagonist sidebar. No separate registration is needed beyond what Modules 1 and 2 provide.

### Luck Damage Table

| Oracle Result | Luck Change |
|---|---|
| Yes, and... | Deal 3 to opponent |
| Yes | Deal 2 to opponent |
| Yes, but... | Deal 1 to opponent |
| No, but... | Take 1 from protagonist |
| No | Take 2 from protagonist |
| No, and... | Take 3 from protagonist |

When `Conflict (Harm & Luck)` mode is active in the Oracle widget:
- Display the damage amount prominently after each roll result.
- Provide `Apply to Me` (decrements Protagonist Luck) and `Apply to Opponent` buttons.
- `Apply to Opponent`: shows an inline input for the opponent's current Luck. Decrements it locally (not persisted — opponent Luck is ephemeral). Displays `Opponent Luck: N` and a visual bar.
- When Protagonist Luck hits 0: display `Conflict lost. Interpret consequences.` notice and optionally prompt to open a Status Track.
- **Twist Counter does not increment during Harm & Luck conflicts.** Disable Twist Counter increment in the Oracle roll logic when conflict mode is active.
- Luck resets at conflict end (manually via `Reset Luck` in the sidebar). The rules state Luck is scoped to a single conflict.

---

## Settings

Register settings via `LonerPlugin.loadSettings()` and a `LonerSettingTab`.

```typescript
interface LonerSettings {
  protagonistNotePath: string;     // Path to the active Protagonist note
  useChallengeTracks: boolean;     // Default: true
  useLeverage: boolean;            // Default: true
  useStatusTrack: boolean;         // Default: true
  useStepDice: boolean;            // Default: false (Appendix D variant)
  insertResultsIntoNote: boolean;  // Default: true (auto-insert oracle results)
  resultCalloutStyle: string;      // 'callout' | 'blockquote' | 'plain'
  useLonelog: boolean;             // Default: false — enable Lonelog output mode
  lonelogSessionNotePath: string;  // Path to the active session log note (optional)
}
```

Default `resultCalloutStyle` is `'callout'` (uses Obsidian callout syntax).

---

## Module 9: Lonelog Integration (Optional)

**Lonelog** (v1.4.1, CC BY-SA 4.0, by Roberto Bisceglie) is a system-agnostic notation standard for solo RPG session logging. When `settings.useLonelog` is `true`, every "Insert into Note" action across all modules outputs Lonelog-formatted notation instead of Obsidian callouts. The game logic does not change; only the string output changes.

Lonelog support is toggled in settings. When active, it also unlocks two additional commands for session log management. All Lonelog output is wrapped in a fenced code block (` ``` `) per the Lonelog spec, which requires notation to be inside code fences in digital markdown to prevent symbol conflicts.

### `LonelogFormatter` class (`lonelog.ts`)

This class is the single output layer for all Lonelog-formatted strings. All other modules call it instead of building their own output strings when `settings.useLonelog` is true. It has no game logic — it only formats.

```typescript
class LonelogFormatter {
  constructor(private session: LonelogSession) {}

  formatOracle(question: string, roll: OracleRollDetail, result: OracleResult): string
  formatTwist(subject: string, action: string, pressure: 'high' | 'clean'): string
  formatSceneTransition(roll: number, sceneType: string): string
  formatInspiration(verb: string, noun: string, adjective?: string): string
  formatAdventureMaker(entries: AdventureMakerEntries): string
  formatProtagonistTag(data: ProtagonistData): string
  formatNpcTag(name: string, tags: string[], isFirstMention: boolean): string
  formatLocationTag(name: string, tags: string[]): string
  formatChallengeTrackState(track: ChallengeTrack): string
  formatStatusTrackState(track: StatusTrack): string
  formatLeverage(description: string): string
  formatSessionHeader(date: string, duration?: string): string
  formatSceneHeader(number: string, description: string): string
}
```

### `LonelogSession` — First-Mention Tracking

Lonelog distinguishes between a first mention of an NPC or Location (`[N:Name|tags]`) and subsequent references (`[#N:Name]`). The plugin tracks this per session in a `LonelogSession` object held in memory (not persisted — it resets when Obsidian closes or a new session is started manually).

```typescript
interface LonelogSession {
  mentionedNpcs: Set<string>;       // NPC names mentioned at least once this session
  mentionedLocations: Set<string>;  // Location names mentioned at least once this session
}
```

`formatNpcTag(name, tags, isFirstMention)`:
- If `isFirstMention` (name not in `mentionedNpcs`): output `[N:Name|tag1|tag2]`, add name to set.
- If already mentioned: output `[#N:Name]` (unless tags have changed, in which case output full form with new tags to signal a state change).

A `Reset Session Tracking` command clears both sets (use when starting a new session log).

### Note Insertion Logic

When inserting Lonelog output into a note, the plugin must detect whether the cursor is already inside a fenced code block to avoid double-wrapping.

```typescript
async function insertLonelogIntoNote(
  app: App,
  content: string,
  targetFile: TFile
): Promise<void>
```

Procedure:
1. Read the current file content.
2. Find the cursor position using `app.workspace.activeEditor?.editor?.getCursor()`.
3. Check if the cursor line falls within an existing ` ``` ` ... ` ``` ` range by scanning upward and downward for fence markers.
4. **If inside a code block**: insert `content` as bare text at the cursor (no additional fences).
5. **If outside a code block**: insert the content wrapped in a fenced code block:
   ````
   ```
   {content}
   ```
   ````
6. If no active editor or cursor is unavailable, append to the end of the file using the appropriate wrapping.

### Output Format Mapping

Every module's "Insert into Note" action routes through `LonelogFormatter` when Lonelog mode is active. The mapping is as follows.

#### Oracle Roll

Standard callout output (when Lonelog is OFF):
```markdown
> [!oracle] Yes, and...
> Chance: 5 · Risk: 4 · Advantage
```

Lonelog output (when Lonelog is ON):
```
? Does Zahra make it inside unnoticed?
d: Chance 5 · Risk 4 (Advantage) -> Yes, and...
=>
```

The `=>` line is appended with an empty consequence — the player fills it in. The question text is drawn from an optional "Question" text field added to the Oracle widget when Lonelog mode is active (a simple text input above the Roll button labeled `Question (optional)`). If the field is empty, the `?` line is omitted.

For Step Dice mode, the die sizes are included:
```
? Does the rope hold?
d: Chance d8=6 · Risk d6=3 -> Yes, and...
=>
```

For Harm & Luck conflict mode, the damage line is added:
```
d: Chance 5 · Risk 2 -> Yes (Deal 2 to opponent)
```

#### Twist

```
gen: Twist 2d6 -> A physical event / Changes the goal
(note: High pressure — interpret at maximum disruption.)
=>
```

#### Scene Transition

```
tbl: Scene Transition d6=4 -> Quiet Scene
```

For Meanwhile results, the two-step procedure is appended as comment lines:
```
tbl: Scene Transition d6=6 -> Meanwhile
(note: Update opposition tags. Ask: Does an ally act independently?)
```

#### Inspiration Tables

```
gen: Inspiration -> multiply · motion · stormy
=>
```

If only Verb + Noun are rolled:
```
gen: Inspiration -> multiply · motion
=>
```

#### Adventure Maker

```
gen: Adventure Maker
  Setting: Space Opera Adventure
  Tone: Suspenseful and thrilling
  Things: Vast Empires · Different Factions
  Opposition: Sinister organizations
  Actions: Seek · Uncover
```

#### Challenge Track State

When a track box is updated (marked or erased), an optional "Log to note" button on the track widget inserts the current state:

```
[Track:Expose Leton 2/4]
```

For reversed (threat) tracks, use `[Clock:]` instead — threat clocks fill toward a bad outcome, matching Lonelog's Clock semantics:

```
[Clock:Corporate Pursuit 1/4]
```

#### Status Track State

```
[Clock:Physical 1/3]
```

The active consequence tag is appended as a note:
```
[Clock:Physical 1/3]
(note: Active tag: Hurt)
```

#### Leverage

```
(note: Leverage held: full server access credentials)
```

When spent:
```
(note: Leverage spent as Advantage)
```

When discarded/expired:
```
(note: Leverage expired: full server access credentials)
```

### Additional Commands (Lonelog mode only)

These commands are registered only when `settings.useLonelog` is `true`.

#### `Loner: Export Protagonist as Lonelog Tag`

Reads the active Protagonist note and formats a full `[PC:...]` tag. Output:

```
[PC:Zahra Nakajima|concept:Witty Street Cat|skill:Streetwise,Nimble|frailty:Merciful|gear:Knife,Low O2 Supplement|luck:6]
```

If Challenge Tracks are active, appends them on separate lines:
```
[Track:Expose Leton 2/4]
```

If Status Tracks are active:
```
[Clock:Physical 1/3]
```

Inserts into the active note using the standard insertion logic above. Intended for use at the top of a session note or after session start.

#### `Loner: Insert NPC Tag`

Opens a small modal (`InsertNpcTagModal`) with:
- Text input: NPC Name.
- Text input: Tags (comma-separated).
- A `First mention` checkbox (auto-checked if the name is not in `session.mentionedNpcs`; unchecked if it is).
- Insert button.

Output (first mention): `[N:Melina Reade|hacker|trusted]`
Output (subsequent): `[#N:Melina Reade]`
Output (status change on subsequent): `[N:Melina Reade|hacker|trusted,Rattled]`

#### `Loner: Insert Location Tag`

Same pattern as NPC Tag modal.

Output (first mention): `[L:Transit Hub|crowded|rain-slicked]`
Output (subsequent): `[#L:Transit Hub]`

#### `Loner: Start Session Log`

Opens a `StartSessionLogModal` with:
- Text input: Session number.
- Text input: Date (pre-filled with today's date).
- Text input: Duration (optional).
- Text input: Opening scene number and description.
- A `Export Protagonist tag` checkbox (default checked) — if checked, runs the Protagonist export and includes it in the output.

Output inserted into a new note (or the `lonelogSessionNotePath` note if set):

````markdown
## Session 3
*Date: 2026-04-21 | Duration: 1h30*

### S1 *Transit Hub, rain-slicked corridors*

```
[PC:Zahra Nakajima|concept:Witty Street Cat|skill:Streetwise,Nimble|frailty:Merciful|gear:Knife,Low O2 Supplement|luck:6]
```
````

The session note is then set as the insertion target for all subsequent "Insert into Note" actions for this session (stored in `settings.lonelogSessionNotePath`). The player can override this at any time in settings or by running the command again.

### Lonelog CSS Classes

```css
.loner-lonelog-badge      /* Small "LL" badge on Insert buttons when Lonelog mode is active */
.loner-lonelog-preview    /* Inline preview of Lonelog output before insertion */
```

When Lonelog mode is active, all "Insert into Note" buttons display a small `LL` badge so the player knows the output format is Lonelog, not a callout.

---



### `rollDie(sides: number): number`
Returns a random integer from 1 to `sides` inclusive.
`Math.floor(Math.random() * sides) + 1`

### `resolveOracle(chance: number, risk: number): OracleResult`

```typescript
interface OracleResult {
  result: 'Yes' | 'No';
  modifier: 'and' | 'but' | null;
  isDouble: boolean;
  label: string; // e.g. "Yes, and..."
  luckDamage: { target: 'opponent' | 'protagonist'; amount: number };
}
```

Logic:
1. `isDouble = (chance === risk)`.
2. If `isDouble`: result = 'Yes', modifier = 'but', return (doubles always yield `Yes, but...`).
3. Else if `chance > risk`: result = 'Yes'.
4. Else: result = 'No'.
5. Modifier: if both ≤ 3 → 'but'; if both ≥ 4 → 'and'; else null.
6. `label` = assemble string from result + modifier.
7. `luckDamage`: map label to table values above.

### `rollOracleWithMode(mode: 'neutral' | 'advantage' | 'disadvantage', useStepDice: boolean): { chance: number; risk: number; result: OracleResult }`

Standard mode:
- Neutral: roll 1d6 chance, 1d6 risk.
- Advantage: roll 2d6 chance, keep highest; 1d6 risk.
- Disadvantage: roll 1d6 chance; roll 2d6 risk, keep highest.

Step Dice mode:
- Neutral: 1d6 vs 1d6.
- 1 advantage: 1d8 vs 1d6.
- 2+ advantages: 1d10 vs 1d6.
- 1 disadvantage: 1d6 vs 1d8.
- 2+ disadvantages: 1d6 vs 1d10.
- "Advantage mode" in this function maps to 1 advantage step; there is no 2+ step input from normal play (the player can only have Advantage or not in a single binary sense at the widget level, but the function supports it for completeness).

### `lookupTwist(subject: number, action: number): { subject: string; action: string }`

Uses the static TWIST_SUBJECTS and TWIST_ACTIONS arrays (1-indexed).

### `lookupInspiration(table: 'verb' | 'noun' | 'adjective', row: number, col: number): string`

Uses static 6×6 arrays in `tables.ts`. Row and col are 1-indexed (die values).

---

## CSS Classes & Styling

Use `styles.css` for all plugin styling. Do not use inline styles except for dynamic values (e.g. Luck pip fill state).

Key classes:

```css
.loner-oracle-widget          /* Container for oracle code block */
.loner-oracle-result          /* Result display area */
.loner-oracle-result--yes     /* Green accent */
.loner-oracle-result--no      /* Red accent */
.loner-oracle-result--and     /* Gold accent modifier */
.loner-oracle-result--but     /* Orange accent modifier */
.loner-oracle-result--twist   /* Purple accent (doubles) */
.loner-protagonist-view       /* Sidebar container */
.loner-luck-pip               /* Individual Luck circle */
.loner-luck-pip--filled       /* Filled state */
.loner-track-box              /* Challenge/Status track box */
.loner-track-box--filled      /* Filled state */
.loner-twist-counter          /* Twist counter status bar display */
.loner-twist-counter--warning /* Red state at counter = 2 */
.loner-twist-counter--trigger /* Pulsing state at counter = 3 */
.loner-callout-oracle         /* Inserted callout styling */
.loner-callout-twist
.loner-callout-scene
.loner-callout-inspiration
```

---

## Frontmatter Read/Write Helper

All frontmatter operations go through a `ProtagonistSheet` class in `protagonist-sheet.ts`.

```typescript
class ProtagonistSheet {
  constructor(private app: App, private settings: LonerSettings) {}

  async read(): Promise<ProtagonistData>
  async write(data: Partial<ProtagonistData>): Promise<void>
  async getTwistCounter(): Promise<number>
  async setTwistCounter(n: number): Promise<void>
  async getLuck(): Promise<number>
  async setLuck(n: number): Promise<void>
  async getLeverage(): Promise<string | null>
  async setLeverage(desc: string | null): Promise<void>
  async getChallengeTracks(): Promise<ChallengeTrack[]>
  async updateChallengeTrack(id: string, boxes: boolean[]): Promise<void>
  async addChallengeTrack(track: ChallengeTrack): Promise<void>
  async removeChallengeTrack(id: string): Promise<void>
  async getStatusTracks(): Promise<StatusTrack[]>
  async updateStatusTrack(id: string, boxes: boolean[]): Promise<void>
  async addStatusTrack(track: StatusTrack): Promise<void>
  async removeStatusTrack(id: string): Promise<void>
}
```

Use `app.metadataCache.getFileCache(file)?.frontmatter` for reads (fast, cached). For writes, use `app.fileManager.processFrontMatter(file, fn)` which safely handles YAML serialization and concurrent modification.

---

## Implementation Order

Build in this sequence to reach a playable state as early as possible:

1. **Plugin scaffold**: `main.ts`, manifest, settings boilerplate, ribbon icon.
2. **ProtagonistSheet class**: frontmatter read/write foundation.
3. **Oracle engine** (`oracle.ts`): pure logic, no UI, fully unit-testable.
4. **Oracle code block widget**: render, roll, display result.
5. **Twist Counter**: status bar item + `incrementTwistCounter()` + Twist Table lookup + output.
6. **Protagonist sidebar** (Sections 1–6: Identity, Skills/Gear, Luck, Tags, Relationship Tags, Twist Counter display).
7. **Scene Transition** command + MeanwhileModal.
8. **Inspiration Tables** command + InspirationModal.
9. **Leverage** (sidebar Section 7 + Oracle integration).
10. **Challenge Tracks** (sidebar Section 8 + `loner-track` code block).
11. **Status Track** (sidebar Section 9 + `loner-status` code block).
12. **Harm & Luck conflict mode** (Oracle widget extension).
13. **Adventure Maker** modal.
14. **Living World** wizard modal.
15. **Step Dice Oracle** variant (settings toggle, modify `rollOracleWithMode`).
16. **Lonelog integration**: `LonelogFormatter` class and `LonelogSession` tracker; swap all "Insert into Note" string templates behind a settings flag; register the four Lonelog-only commands; add the `Question` input field to the Oracle widget; add `LL` badges to Insert buttons.
17. **Styling pass**: complete `styles.css`.

---

## Obsidian API Notes

- Use `this.registerMarkdownCodeBlockProcessor` for code blocks. Wrap all DOM manipulation in `try/catch`.
- Use `this.addCommand` for all palette commands. Provide `id`, `name`, and `callback`.
- Use `this.addRibbonIcon('dice', 'Loner 4e', callback)` for the ribbon icon.
- Use `this.addStatusBarItem()` for the Twist Counter. Store the returned `El` reference.
- Use `ItemView` as the base class for the Protagonist sidebar. Override `getViewType()`, `getDisplayText()`, `getIcon()`, and `onOpen()`.
- Use `this.app.workspace.getRightLeaf(false)` to open the sidebar leaf on demand.
- For modals, extend `Modal` and implement `onOpen()` and `onClose()`.
- Use `this.app.vault.process(file, fn)` or `this.app.fileManager.processFrontMatter(file, fn)` for safe concurrent writes.
- Register all event listeners through `this.registerEvent(...)` to ensure cleanup on plugin unload.
- All async file operations must be awaited. Surface errors as `new Notice('...')` messages, not silent failures.

---

## Mechanical Constraints (Do Not Get These Wrong)

These are the precise rules from the text. Implement them exactly.

1. **Doubles are always `Yes, but...`**. The modifier check (both ≤ 3 / both ≥ 4) does NOT apply when both dice are equal. Doubles produce exactly `Yes, but...` + 1 Twist increment, nothing else.

2. **Advantage cap**: maximum 2 Chance Dice or 2 Risk Dice per roll, regardless of tag count. Multiple positive tags do not stack beyond one die extra.

3. **Twist Counter does NOT increment during Harm & Luck conflicts.** The Oracle still rolls and produces results, but the doubles/Twist check is suppressed in conflict mode.

4. **Leverage is lost when a Twist triggers.** Check and clear Leverage inside `incrementTwistCounter()` at the moment of Twist, before displaying the Twist result.

5. **Leverage cannot add Advantage if the player already has Advantage from tags.** When spending Leverage as Advantage, check if the current roll is already at Advantage mode. If so, display `No effect — you already have Advantage.` and do not consume the Leverage.

6. **Challenge Track advances only once per scene**, and only when the Protagonist was actively working that challenge when the scene was framed. The plugin cannot enforce this narratively — surface it as a tooltip reminder on the track update button: `"Update only if this challenge was the scene's stated focus when framed."`

7. **Luck resets at conflict start and end.** Luck is NOT a persistent health bar between conflicts. The `Reset Luck` button in the sidebar should be labeled `Reset Luck (end of conflict)` with a tooltip explaining this.

8. **Leverage expires by fiction, not scene boundary.** The plugin uses scene end as a practical expiry point (Leverage is cleared on Scene Transition roll), but also allows manual discard. Surface the rule as tooltip text.

9. **Status Track box 3 = overcome, not dead.** Never label box 3 as "dead" or "eliminated." Always "Overcome" with the fiction determining the consequence.

10. **Step Dice thresholds are unchanged.** A 4 on a d10 triggers `and...` the same as a 4 on a d6. The threshold values (≤3 = but, ≥4 = and) are fixed regardless of die size.
