# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains specifications for **`loner-4e`**, an Obsidian plugin (TypeScript) for playing the Loner 4e solo tabletop RPG. No source code exists yet — the three markdown files here are the complete reference material:

- **`loner4e-obsidian-plugin-spec.md`** — Primary implementation spec: architecture, data model, module-by-module UI/logic, CSS classes, Obsidian API patterns, and the recommended build order. Start here.
- **`loner-4e.md`** — The Loner 4e rulebook. The canonical source for game mechanics. Consult when the spec is ambiguous.
- **`lonelog.md`** — Lonelog v1.4.1 spec (CC BY-SA 4.0, by Roberto Bisceglie). Defines the session-log notation format used by Module 9.

## Architecture

The plugin is built as a standard Obsidian plugin (`main.ts` + `src/` directory). Key architectural decisions from the spec:

**All game state lives in vault notes (YAML frontmatter), never in `data.json`.** The player's journal is the game record. Read via `app.metadataCache.getFileCache(file)?.frontmatter`; write via `app.fileManager.processFrontMatter(file, fn)`.

**Rendering strategy by component:**
- Oracle, Challenge Track, Status Track → `registerMarkdownCodeBlockProcessor` (code fence widgets)
- Protagonist Sheet → custom `ItemView` sidebar leaf (`VIEW_TYPE_PROTAGONIST`)
- Twist Counter → `addStatusBarItem()` persistent bottom bar
- Scene Transition, Inspiration, Adventure Maker, Living World → `addCommand` + `Modal`

**Central class: `ProtagonistSheet`** (`src/protagonist-sheet.ts`) — all frontmatter reads/writes for the active protagonist note go through this class. The active note path is stored in `settings.protagonistNotePath`.

**Code block state** (track fill state, etc.) must be read from and written back into the block's source text using `ctx.getSectionInfo(el)` + `app.vault.read` / `app.vault.modify`.

**Output routing:** When `settings.useLonelog` is `true`, all "Insert into Note" actions across all modules route through `LonelogFormatter` (`src/lonelog.ts`) instead of building callout strings directly. This class only formats — no game logic.

## Build Order

Implement in this sequence (from the spec) to reach a playable state quickly:

1. Plugin scaffold + settings boilerplate
2. `ProtagonistSheet` class (frontmatter foundation)
3. Oracle engine (`src/oracle.ts`) — pure logic, no UI
4. Oracle code block widget + Twist Counter
5. Protagonist sidebar (Sections 1–6)
6. Scene Transition, Inspiration Tables
7. Leverage, Challenge Tracks, Status Track
8. Harm & Luck conflict mode, Adventure Maker, Living World
9. Step Dice variant, Lonelog integration, styling pass

## Critical Mechanical Constraints

These rules must be implemented exactly — see spec section "Mechanical Constraints":

1. **Doubles are always `Yes, but...`** — the both-≤3 / both-≥4 modifier check does NOT apply when dice are equal. Doubles yield exactly `Yes, but...` + 1 Twist increment.
2. **Advantage cap** — maximum 2 Chance Dice or 2 Risk Dice per roll, regardless of tag count.
3. **Twist Counter does NOT increment during Harm & Luck conflicts.**
4. **Leverage is cleared inside `incrementTwistCounter()`** at the moment of Twist, before displaying the result.
5. **Step Dice thresholds are unchanged** — a 4 on a d10 triggers `and...` the same as a 4 on a d6.

## Obsidian API Patterns

- Register processors: `this.registerMarkdownCodeBlockProcessor(lang, handler)`
- Commands: `this.addCommand({ id, name, callback })`
- Status bar: `this.addStatusBarItem()` — store the returned element reference
- Sidebar: extend `ItemView`, open with `app.workspace.getRightLeaf(false)`
- Modals: extend `Modal`, implement `onOpen()` and `onClose()`
- Safe concurrent writes: `app.fileManager.processFrontMatter(file, fn)`
- All event listeners: `this.registerEvent(...)` for cleanup on unload
- Surface errors as `new Notice('...')` — never silent failures
