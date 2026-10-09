# Context Intake/Output Checklist

Use this checklist to keep context selection and documentation consistent.

## Intake (before writing code)

- [ ] Restate the task objective in one line.
- [ ] Read `AGENTS.md` and `docs/ai/boot.md`.
- [ ] Use `docs/ai/context-map.md` to find required docs.
- [ ] Read `docs/issues/known-issues.index.md`, then run `rg -n` on
      `docs/issues/known-issues.md` for relevant sections.
- [ ] Read the feature doc for the component/page. If missing, ask or create it
      from `docs/features/_template.md`.
- [ ] Check `docs/COMPONENT_INVENTORY.md` to avoid duplication.
- [ ] Build a Context Capsule (see `docs/ai/context-capsule-template.md`).
- [ ] For new features or multi-file tasks, save the capsule in
      `docs/ai/context-capsules/`.
- [ ] Verify constraints (scope, design system, security, changelog rules).
- [ ] Confirm there are no doc conflicts (follow `AGENTS.md` and `boot.md`).

## Output (after writing code)

- [ ] Ensure changes match the request (no scope creep).
- [ ] If bugfix: update `docs/issues/known-issues.md` and index if recurring.
- [ ] If feature/component change: update `docs/features/<feature>.md`.
- [ ] If process change: update relevant `docs/ai/` docs.
- [ ] Update `CHANGELOG.md` with the real date from `git log`.
- [ ] Validate docs for placeholders (no real credentials).
- [ ] Run `pnpm docs:validate` when index or link changes are made.
- [ ] Expect CI to run `pnpm docs:validate` on PRs; keep links green.
- [ ] Provide validation steps or tests (manual or automated).
