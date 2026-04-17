# AGENTS.md

## Project
- Browser 2D game on Phaser 3 + TypeScript + Vite.
- Docker is part of the working setup.
- Game supports guest mode and Google login via Firebase.
- Leaderboards are split between local practice flow and future ranked backend flow.

## Always
- Keep changes small, targeted, and aligned with existing behavior unless the task requires a gameplay change.
- Work with a TypeScript strict mindset: avoid loose types, implicit assumptions, and dead code.
- Study the relevant files first, then change code.
- Prefer modular systems/services/helpers over growing `GameScene` into a giant controller.
- Keep gameplay logic, UI logic, auth logic, and leaderboard logic separated.
- Keep gameplay UI inside Phaser unless the task explicitly requires DOM UI.
- Isolate leaderboard behavior behind services/contracts so local practice and ranked backend flows stay swappable.
- Reuse existing shared constants, config, and types instead of adding new string literals.

## Gameplay And UI
- Do not spread reusable gameplay or UI behavior directly across scene files; extract to focused modules when logic starts growing.
- Preserve a stable Phaser lifecycle: on restart/shutdown clean up listeners, timers, tweens, overlaps, keyboard handlers, and scene-specific resources.
- Avoid duplicate event listeners, duplicate timers, and overlapping systems that can stack across restarts.
- Keep UI visually minimal and readable: clean sci-fi style, clear hierarchy, few accent colors, low visual noise, no oversized borders or redundant labels.

## Workflow
1. Briefly inspect the relevant files and surrounding module boundaries.
2. Share a short plan.
3. Make the minimum correct change set.
4. Validate the result.
5. Summarize what changed and any manual checks.

## Validation
- Run `npm run typecheck` when code changes affect types or logic.
- Run `npm run build` when changes affect runtime behavior, bundling, or assets.
- Run `npm run lint` when editing TypeScript files.
- If the task affects UI or gameplay, list the manual in-game checks for flow, visuals, input handling, and restart/shutdown behavior.

## Commits
- Suggest Conventional Commit messages when relevant: `feat`, `fix`, `chore`, `refactor`, `docs`, `style`, `test`.
