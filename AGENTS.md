# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

**BS Detector** — a multi-agent AI pipeline that analyzes legal briefs (starting with a Motion for Summary Judgment in _Rivera v. Harmon Construction Group_) and produces a structured verification report. See `SPEC.md` for the full task, `ROADMAP.md` for planned work, and `REFLECTION.md` for design notes.

Source documents to analyze live in `documents/`.

## Commands

```bash
pnpm build       # next build
pnpm lint        # eslint
pnpm format      # prettier --write "**/*.{ts,tsx}"
pnpm typecheck   # tsc --noEmit
```

## Rules

- Never start the dev server (e.g., `pnpm dev`), since it's already running at `http://localhost:3000`. Just use the existing server.
- Do not edit files inside `**/components/ui/` directly. These are the shadcn/ui shared base components for the app; when a component needs visual adjustments, change the `className` where the component is used instead of modifying the base component file.
