# Context Capsules

Use this folder to store short, high-signal context snapshots for tasks that
introduce new features or touch multiple files. Capsules are a durable, easy
to-reuse context layer that reduces ambiguity for future AI sessions.

## When to create

- New feature requests (no existing feature doc).
- Multi-file changes where rules or constraints must be preserved.
- Cross-cutting process changes in `docs/ai/`.

## Naming

`YYYY-MM-DD-<slug>.md` (ex: `2026-01-30-quote-status-v2.md`)

## Template

Use `docs/ai/context-capsule-template.md`.

## Rules

- Keep it short and factual.
- Always include required sources (file paths).
- Never include real credentials; use placeholders.
