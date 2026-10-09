# AI Context System

> Status: Critical  
> Last updated: 2026-01-30

---

## 1. Purpose

Provide a documented, repeatable context intake/output system for IAs to reduce
hallucination and keep behavior consistent.

## 2. Scope

**In scope**

- AGENTS and docs/ai rules
- Known-issues index + targeted rg search
- Feature doc creation and updates
- CHANGELOG updates with real dates
- Documentation security guidelines

**Out of scope**

- Product/UI changes not requested
- RAG infrastructure implementation (future phase)
- External tool integrations beyond documentation

## 3. Entry Points

- Docs: `AGENTS.md`, `docs/ai/boot.md`, `docs/ai/context-map.md`,
  `docs/ai/context-precision-protocol.md`,
  `docs/ai/context-capsule-template.md`, `docs/ai/context-capsules/README.md`,
  `docs/ai/context-intake-output-checklist.md`,
  `docs/ai/prompt-templates/README.md`, `docs/architecture/diagrams/README.md`
- Internal: `docs/internal/ai-documentation-system-analysis.md`
- Indexes: `docs/issues/known-issues.index.md`, `docs/features/INDEX.md`
- Template: `docs/features/_template.md`

## 4. Core Flow

1. Read AGENTS and boot/context-map.
2. Use indexes + `rg` to locate relevant docs.
3. Read or create the feature doc if missing.
4. Check component inventory to avoid duplication.
5. Build a Context Capsule and persist it for new/multi-file tasks.
6. Execute the task within scope.
7. Update docs/issues/features/ai and CHANGELOG as required.

## 5. Components and Files

- `AGENTS.md`
- `docs/ai/boot.md`
- `docs/ai/context-map.md`
- `docs/ai/context-precision-protocol.md`
- `docs/ai/context-capsule-template.md`
- `docs/ai/context-capsules/README.md`
- `docs/ai/context-intake-output-checklist.md`
- `docs/ai/prompt-templates/README.md`
- `docs/issues/known-issues.index.md`
- `docs/issues/known-issues.md`
- `docs/features/INDEX.md`
- `docs/features/_template.md`
- `docs/COMPONENT_INVENTORY.md`
- `docs/architecture/diagrams/README.md`
- `docs/internal/documentation-security-guidelines.md`
- `scripts/validate-docs-indexes.js`

## 6. Data and State

- Short-term memory: current task + loaded docs.
- Medium-term memory: context capsules and summarized decisions in docs.
- Long-term memory: full docs and codebase.

## 7. Constraints and Edge Cases

- If a feature doc does not exist, ask the user or create from the template.
- Do not assume UI changes or business rules.
- Never expose credentials in documentation.

## 8. Error Handling

- If docs conflict, follow `AGENTS.md` and `docs/ai/boot.md`.
- If sources are missing, stop and request clarification.
- If context is too large, trim by priority and reliability.

## 9. Performance and Accessibility

- Prefer indexes and `rg` to minimize token usage.
- Avoid loading large files without targeted search.

## 10. Tests and Validation

- Manual: verify all referenced docs exist.
- Manual: confirm CHANGELOG updated with real date.
- Optional: run `pnpm docs:validate` after index/link changes.

## 11. Related Docs

- `docs/internal/ai-documentation-system-analysis.md`
- `docs/ai/context-precision-protocol.md`
- `docs/issues/known-issues.md`

## 12. Change Log

- 2026-01-20: Initial documentation.
- 2026-01-20: Added context capsule and checklist references.
- 2026-01-30: Added persistent context capsules guidance.
- 2026-01-20: Added diagram and prompt template references.
- 2026-01-20: Added docs index/link validation script reference.

---

_Template version: 2026-01-20_
