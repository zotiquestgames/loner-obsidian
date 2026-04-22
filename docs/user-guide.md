# Loner Assistant — User Guide

This guide covers every feature of the plugin. It assumes you have Loner 4e; refer to the rulebook for the underlying mechanics — this guide explains how the plugin implements and surfaces them.

---

## Table of Contents

1. [Protagonist Setup](#1-protagonist-setup)
2. [Protagonist Sidebar](#2-protagonist-sidebar)
3. [Oracle Widget](#3-oracle-widget)
4. [Twist Counter](#4-twist-counter)
5. [Scene Transition](#5-scene-transition)
6. [Inspiration Tables](#6-inspiration-tables)
7. [Harm & Luck (Conflict Mode)](#7-harm--luck-conflict-mode)
8. [Challenge Tracks](#8-challenge-tracks)
9. [Status Tracks](#9-status-tracks)
10. [Leverage](#10-leverage)
11. [Adventure Maker](#11-adventure-maker)
12. [Living World](#12-living-world)
13. [Step Dice Variant](#13-step-dice-variant)
14. [Lonelog Mode](#14-lonelog-mode)
15. [Settings Reference](#15-settings-reference)

---

## 1. Protagonist Setup

The plugin stores all game state in the YAML frontmatter of a single Protagonist note. Nothing is saved in the plugin's own config — your note is the record.

### Creating the note

Create any note in your vault and add this frontmatter block at the top. Fields you leave out default to empty/zero.

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
goal: "Obtain unknown technology to save her planet"
motive: "She feels responsible for her home's survival"
nemesis: "The Naturalist Order"
luck: 6
luck_max: 6
tags: []
relationship_tags: []
leverage: null
twist_counter: 0
challenge_tracks: []
status_tracks: []
---
```

### Pointing the plugin to your note

Settings → Loner Assistant → **Protagonist note path** → enter the vault-relative path, e.g. `Characters/Zahra.md`.

Once set, the sidebar and all widgets read from and write to this note automatically. You can switch protagonists at any time by changing the path.

---

## 2. Protagonist Sidebar

Open with the **dice ribbon icon** or via command palette: `Open Protagonist Sheet`.

The sidebar is divided into collapsible sections. Every edit writes back to frontmatter immediately on blur (text fields) or on click (pips, buttons). Editing the note's frontmatter directly also updates the sidebar in real time.

### Section 1 — Identity

Inline text fields for: Name, Concept, Frailty, Goal, Motive, Nemesis.

### Section 2 — Skills & Gear

Two Skills and two Gear items by default. Use the **+** button to add more after advancement — there is no hard cap.

### Section 3 — Luck

Displayed as a row of filled/empty circles equal to `luck_max` (default 6).

- **Click a pip** to reduce Luck to that value (click pip 4 → `luck: 4`).
- **Reset Luck (end of conflict)** restores `luck` to `luck_max`. Luck resets between conflicts, not between scenes — the label is intentional.
- **± stepper** adjusts `luck_max` for NPCs or unusual cases.

### Section 4 — Tags

General scene and condition tags. Each tag has:
- A **delete (×)** button.
- **[Adv]** / **[Dis]** visual toggle buttons — these mark the tag as an advantage or disadvantage source for the current scene. This is a non-persisted visual reminder; it does not automatically feed the Oracle widget.

Add new tags with the input + **Add Tag** button.

### Section 5 — Relationship Tags

A separate list for NPC relationship descriptors. Enter both parts as free text (e.g. `Melina Reade — Trusted hacker`). Same add/delete interface as Tags.

### Section 6 — Twist Counter

Three pips showing the current counter (0–3).

- **+1** manually increments the counter (and triggers a Twist if it reaches 3).
- **Reset** sets the counter to 0 without triggering a Twist.
- At value 2: the section turns orange as a warning.
- At value 3: **Roll Twist** button appears. Clicking it runs the full Twist procedure and resets the counter.

The Oracle widget increments the counter automatically on doubles.

### Section 7 — Leverage *(requires Enable Leverage setting)*

See [Leverage](#10-leverage) for full mechanics.

### Section 8 — Challenge Tracks *(requires Enable Challenge Tracks setting)*

See [Challenge Tracks](#8-challenge-tracks).

### Section 9 — Status Tracks *(requires Enable Status Track setting)*

See [Status Tracks](#9-status-tracks).

---

## 3. Oracle Widget

Insert this code block into any note — scene notes, session logs, anywhere:

````
```loner-oracle
```
````

The block renders as an interactive widget. Multiple widgets can be open simultaneously; each is independent.

### Mode buttons

Three buttons select the roll mode:

| Button | Effect |
|---|---|
| Disadvantage | Roll 2 Risk dice, keep highest; 1 Chance die |
| Neutral | 1 Chance die vs 1 Risk die |
| Advantage | Roll 2 Chance dice, keep highest; 1 Risk die |

Select based on your tags. The cap is one extra die: Advantage means 2d6-keep-highest for Chance, nothing more.

### Rolling

Click **Ask the Oracle**. The widget resolves the roll and displays:

- The individual die values (e.g. `Chance: 5 · Risk: 4`).
- The **result badge** — large, colour-coded:
  - Green = Yes results
  - Red = No results
  - Gold border = `and...` modifier
  - Orange border = `but...` modifier
  - Purple pulse = doubles / Twist
- A **+1 Twist Counter** notice if doubles were rolled, or a full Twist result if the counter reached 3.
- A **Roll Inspiration** link for `but...` and `and...` results (opens the Inspiration modal).

### Result table

| Chance vs Risk | Both ≤ 3 | Both ≥ 4 | Result |
|---|---|---|---|
| Chance > Risk | — | — | Yes |
| Chance > Risk | ✓ | — | Yes, but... |
| Chance > Risk | — | ✓ | Yes, and... |
| Risk > Chance | — | — | No |
| Risk > Chance | ✓ | — | No, but... |
| Risk > Chance | — | ✓ | No, and... |
| Equal (doubles) | any | any | Yes, but... + Twist |

Doubles are always **Yes, but...** — the modifier check is skipped entirely for doubles.

### Copying the result to your note

Click **Copy result to note** to append a formatted callout:

```markdown
> [!oracle-yes] Yes, and...
> Chance: 5 · Risk: 4 · Advantage
```

Callout types: `oracle-yes`, `oracle-no`, `oracle-twist`.

---

## 4. Twist Counter

The status bar at the bottom of Obsidian always shows `🔄 Twist: N/3`.

The counter increments automatically when the Oracle widget rolls doubles. When it reaches 3 the Twist procedure fires:

1. Any held Leverage is discarded (the fiction demands it).
2. Two d6 rolls against the Twist table (Subject + Action).
3. The result displays as a notice and in the Oracle widget area.
4. An intensity hint appears based on current pressure:
   - **High pressure** (Luck ≤ 3 or Status Track has 2+ boxes filled): *"interpret at maximum disruption."*
   - **Clean state**: *"interpret as a shift, not a collapse."*
5. Counter resets to 0.

**Twist table:**

| d6 | Subject | Action |
|---|---|---|
| 1 | A third party | Appears |
| 2 | The hero | Alters the location |
| 3 | An encounter | Helps the hero |
| 4 | A physical event | Hinders the hero |
| 5 | An emotional event | Changes the goal |
| 6 | An object | Ends the scene |

The counter does **not** increment during Harm & Luck conflicts (see [Section 7](#7-harm--luck-conflict-mode)).

---

## 5. Scene Transition

Command palette: `Loner: Roll Scene Transition`

Rolls 1d6 and shows the result in a modal:

| d6 | Scene type | Guidance |
|---|---|---|
| 1–3 | Dramatic | Stakes rise, new obstacles emerge |
| 4–5 | Quiet | Protagonist has initiative — recovery, planning, relationships |
| 6 | Meanwhile | The world acts — follow the two-step procedure |

### Meanwhile procedure

A two-step guided modal opens:

**Step 1 — Update the opposition.** Who holds power? What do they do next? Update their tags via the text inputs or open their note directly with *Open NPC Note*.

**Step 2 — Ask the Oracle.** The fixed question is *"Does an ally or wildcard act independently?"* Click *Roll Oracle* for an unmodified roll (no Advantage/Disadvantage, and this procedural roll does not increment the Twist Counter). On Yes: update the most affected NPC's tags. On No: no independent action.

Click **Insert into Note** to append the result as a callout.

---

## 6. Inspiration Tables

Command palette: `Loner: Roll Inspiration` — or use the **Roll Inspiration** link that appears in the Oracle widget after a `but...` or `and...` result.

The modal rolls three 6×6 tables (Verb, Noun, Adjective):

- **Roll All** — rolls all active sections at once.
- **Roll** / **Re-roll** per section — re-roll a single table without disturbing the others.
- **Include Adjective** checkbox — uncheck to roll only Verb + Noun.
- The combined result displays prominently: e.g. `multiply · motion · stormy`.

Click **Insert into Note** to append:

```markdown
> [!inspiration] multiply · motion · stormy
```

---

## 7. Harm & Luck (Conflict Mode)

The Oracle widget has a **Conflict (Harm & Luck)** checkbox. Enable it when entering a conflict.

When active, each oracle result shows the Luck damage amount:

| Result | Effect |
|---|---|
| Yes, and... | Deal 3 to opponent |
| Yes | Deal 2 to opponent |
| Yes, but... | Deal 1 to opponent |
| No, but... | Take 1 |
| No | Take 2 |
| No, and... | Take 3 |

### Applying damage

Two buttons appear after each roll:

- **Apply to Me** — subtracts from protagonist Luck (writes to frontmatter). If Luck reaches 0: *"Conflict lost. Interpret consequences."*
- **Apply to Opponent** — subtracts from the opponent's Luck counter shown in the widget. This counter is ephemeral (not saved anywhere) and resets when the widget reloads.

The opponent's starting Luck defaults to 6 and can be changed in the widget's number input before rolling.

### Important rules

- Doubles in conflict mode do **not** increment the Twist Counter.
- Luck is scoped to a single conflict. Use **Reset Luck (end of conflict)** in the sidebar when the conflict ends.

---

## 8. Challenge Tracks

Challenge Tracks are 4-box progress trackers. The source of truth is the protagonist note's frontmatter (`challenge_tracks` array).

### Inserting a track widget

````
```loner-track
expose-leton
```
````

The block source is the track's `id`. The widget reads the current state from frontmatter and renders 4 clickable boxes. Click a box to toggle it; the frontmatter updates immediately.

### Managing tracks in the sidebar

Section 8 of the Protagonist sidebar lists all open tracks:

- **Edit the label** inline.
- **Toggle boxes** by clicking.
- **Reversed** indicator — a threat track fills toward a bad outcome (use this for opposition clocks).
- **Close Track** removes the track from the frontmatter.
- **New Track** button → enter a label, optionally toggle *Reversed*, confirm.

When all 4 boxes are filled, a *Challenge resolved* notice appears. The track stays open until you manually close it.

> **Track rule reminder**: update a track box only once per scene, and only when the protagonist was actively working that specific challenge when the scene was framed. The plugin shows this as a tooltip but cannot enforce it mechanically.

---

## 9. Status Tracks

Status Tracks are 3-box consequence trackers for harm (physical, social, or psychological). The source of truth is the protagonist note's frontmatter (`status_tracks` array).

### Inserting a track widget

````
```loner-status
zahra-status
```
````

Same pattern as Challenge Tracks — the block source is the track's `id`.

### Default consequence tags

| Type | Box 1 | Box 2 | Box 3 |
|---|---|---|---|
| Physical | Hurt | Injured | Overcome |
| Social | Rattled | On the Back Foot | Humiliated |
| Psychological | Unsettled | Shaken | Broken |

Tags are editable — they are starting suggestions, not fixed rules.

When box 3 is filled, a **Character is overcome** notice appears. Box 3 means overcome — not dead or eliminated. The fiction determines the consequence.

### Clearing boxes

The **Clear Box** button removes one box (rightmost filled). Tooltip: *"Recovery requires fictional justification: rest, treatment, or a recovery scene."* The plugin cannot enforce this — it is your responsibility to only clear boxes when the narrative supports it.

---

## 10. Leverage

Leverage is a held narrative advantage banked from a `Yes, and...` oracle result and spent to gain Advantage on a future roll.

The Leverage section appears in the Protagonist sidebar (Section 7), enabled by the *Enable Leverage* setting.

### Banking Leverage

The **Bank Leverage** button is enabled only when the last oracle roll in this session produced `Yes, and...`. Click it, describe what you gained (e.g. *"Full server access credentials"*), and confirm. The description is saved to the protagonist note's frontmatter (`leverage` field).

### Spending Leverage

While Leverage is held, three action buttons appear:

| Button | Effect |
|---|---|
| **Spend as Advantage** | Queues Advantage for the next oracle roll. Leverage is consumed from frontmatter when the roll actually fires — if you already had Advantage when you roll, Leverage is retained. |
| **Convert No → No, but...** | Clears Leverage immediately. Apply the softened result to the next No you receive. |
| **Discard** | Expires Leverage without spending it. |

### Automatic expiry

Leverage is automatically cleared when a Twist triggers (inside `incrementTwistCounter`), before the Twist result is displayed.

---

## 11. Adventure Maker

Command palette: `Loner: Adventure Maker`

A modal with two tabs and a bonus tool:

### Setting tab

Rolls 2d6 on each of three tables to generate a setting:

- **Setting** — the genre/world type
- **Tone** — the emotional register
- **Things** — two results from the Things table

### Adventure Premise tab

Rolls 2d6 on three tables to generate a premise:

- **Opposition** — who or what stands against the protagonist
- **Actions** — two results (what must be done)
- **Things** — one result (the object or focus)

Use **Re-roll** next to any entry to replace just that one. Click **Insert into Note** to append the full block.

### 5W+H Frame

A supplemental tool (visible in both tabs) that rolls 1d6 per column: Who, What, Why, Where, How, Obstacle. Use it to set up the opening scene.

---

## 12. Living World

Command palette: `Loner: Living World — End of Session`

A five-step guided wizard for post-session bookkeeping.

### Step 1 — Character Growth

What did the protagonist learn or gain?

- **Add Skill / Add Gear** — appends to the frontmatter arrays immediately.
- **Add Frailty** — replaces the current frailty.
- **Modify Existing Trait** — dropdown of current skills and gear + new value field.
- **New Nemesis** — sets the nemesis field.

### Step 2 — NPC Updates

Lists all notes with `loner_entity: true` and `type: npc` in their frontmatter.

For each NPC:
- Update the **Relationship Tag** (writes to the NPC note's frontmatter on blur).
- **Mark as Gone/Inactive** checkbox.
- **Open Note** button.

To surface a note in this step, add to its frontmatter:

```yaml
---
loner_entity: true
type: npc
name: "Melina Reade"
concept: "Corporate hacker"
relationship_tag: "Trusted"
---
```

### Step 3 — Location Updates

Same pattern for notes with `type: location`. Updates the `current_tag` and `accessible` fields.

```yaml
---
loner_entity: true
type: location
name: "Transit Hub"
current_tag: "rain-slicked"
accessible: true
---
```

### Step 4 — Unresolved Events

Free-text area to capture hanging threads. **Add Event Note** creates a new note at `Events/Event-<timestamp>.md` with a standard template and opens it.

### Step 5 — Summary

Review all changes made during the wizard. Click **Finish** to close.

---

## 13. Step Dice Variant

Settings → Loner Assistant → **Use Step Dice Oracle**.

When enabled, the Advantage/Disadvantage dice pool (2d6-keep-highest) is replaced with a single stepped die:

| Mode | Chance die | Risk die |
|---|---|---|
| Neutral | d6 | d6 |
| Advantage | d8 | d6 |
| Disadvantage | d6 | d8 |

The resolution logic is identical — the ≤3 / ≥4 thresholds apply to the raw die face regardless of die size. A 4 on a d8 triggers `and...` the same as a 4 on a d6.

When Step Dice mode is active, die sizes are displayed in the Oracle widget: `Chance (d8): 6 · Risk (d6): 3`.

---

## 14. Lonelog Mode

Settings → Loner Assistant → **Enable Lonelog output mode**.

When active, every *Insert into Note* button outputs [Lonelog v1.4.1](https://zeruhur.space/lonelog) notation instead of Obsidian callouts. All Insert buttons show a small **LL** badge as a reminder. The game mechanics are unchanged — only the output format changes.

Lonelog output is wrapped in fenced code blocks (` ``` `) per the spec. The plugin detects whether the cursor is already inside a code fence and skips the wrapping if so.

### Oracle output

The Oracle widget gains an optional **Question** text input above the Roll button when Lonelog mode is active.

```
? Does Zahra make it inside unnoticed?
d: Chance 5 · Risk 4 (Advantage) -> Yes, and...
=>
```

The `=>` line is a blank consequence line — fill it in after the fact.

### Additional Lonelog commands

These commands are available regardless of mode, but show a notice and return early if Lonelog is disabled.

#### `Loner: Export Protagonist as Lonelog Tag`

Reads the active Protagonist note and inserts a `[PC:...]` tag into the active note:

```
[PC:Zahra Nakajima|concept:Witty Street Cat|skill:Streetwise,Nimble|frailty:Merciful|gear:Knife,Low O2 Supplement|luck:6]
[Track:Expose Leton 2/4]
[Clock:Physical 1/3]
```

#### `Loner: Insert NPC Tag`

Opens a modal. Enter a name and comma-separated tags.

- First mention: `[N:Melina Reade|hacker|trusted]` — also adds the name to the session tracking set.
- Subsequent mention (no change): `[#N:Melina Reade]`
- Subsequent mention (state changed): `[N:Melina Reade|hacker|trusted,Rattled]`

The *First mention* checkbox auto-checks based on whether the name has appeared in this session.

#### `Loner: Insert Location Tag`

Same pattern as NPC Tag.

- First mention: `[L:Transit Hub|crowded|rain-slicked]`
- Subsequent: `[#L:Transit Hub]`

#### `Loner: Start Session Log`

Opens a modal to create or append to a session log note:

- Session number, date (pre-filled with today), duration (optional).
- Opening scene number and description.
- **Export Protagonist tag** checkbox (checked by default) — includes the `[PC:...]` tag in the opening block.

The created note is set as the insertion target for all subsequent Lonelog output this session. You can override it at any time in settings.

#### `Loner: Reset Lonelog Session Tracking`

Clears the in-memory sets of mentioned NPCs and Locations. Run at the start of each new session so first-mention tags are generated correctly.

---

## 15. Settings Reference

| Setting | Default | Description |
|---|---|---|
| Protagonist note path | *(empty)* | Vault-relative path to your Protagonist note |
| Enable Challenge Tracks | On | Enables Section 8 in the sidebar |
| Enable Leverage | On | Enables Section 7 in the sidebar |
| Enable Status Track | On | Enables Section 9 in the sidebar |
| Use Step Dice Oracle | Off | Appendix D: d8/d10 stepped dice instead of 2d6-keep-highest |
| Auto-insert results into note | On | Shows the *Copy result to note* button after each oracle roll |
| Result callout style | Callout | `callout` (Obsidian `[!type]`), `blockquote`, or `plain` |
| Enable Lonelog output mode | Off | Outputs Lonelog notation; unlocks Lonelog commands |
| Lonelog session note path | *(empty)* | Target note for Lonelog insertion (set by Start Session Log command) |

---

## Frontmatter reference

### Protagonist note

```yaml
loner_protagonist: true     # required — marks this note as the protagonist
name: string
concept: string
frailty: string
skills: string[]
gear: string[]
goal: string
motive: string
nemesis: string
luck: number                # current luck (0–luck_max)
luck_max: number            # maximum luck, default 6
tags: string[]
relationship_tags: string[]
leverage: null | string     # null = no leverage held
twist_counter: number       # 0–2 (resets to 0 on Twist trigger)
challenge_tracks:
  - id: string
    label: string
    boxes: [bool, bool, bool, bool]
    reversed: bool          # true = threat clock
status_tracks:
  - id: string
    label: string
    type: physical | social | psychological
    boxes: [bool, bool, bool]
    tags: [string, string, string]
```

### NPC / Location notes

```yaml
loner_entity: true          # required to appear in Living World
type: npc | location | event
name: string
concept: string             # NPC only
relationship_tag: string    # NPC only
inactive: bool              # NPC only — marks them as gone
current_tag: string         # Location only
accessible: bool            # Location only
```
