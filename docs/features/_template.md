# [Feature Name]

> **Status**: [Critical|Standard]  
> **Last updated**: YYYY-MM-DD

---

## 1. Purpose

Explain the business goal and why this feature exists.

## 2. Scope

**In scope**

- ...

**Out of scope**

- ...

## 3. Entry Points

- Routes: `apps/clients/web/src/app/...` (host) and
  `packages/frontend/src/pages/...`
- Components: `packages/frontend/src/{widgets,features,entities}/...` and
  `packages/ui/src/...`
- APIs: `apps/services/api/src/app/api/...` (thin HTTP host)
- Backend: public entrypoint of `packages/backend` and its owning
  `src/{http,modules,runtime}/...` responsibility; shared schemas belong to
  `packages/contracts` and domain rules to `packages/domain`.

## 4. Core Flow

1. Step one
2. Step two
3. Step three

## 5. Components and Files

- `packages/frontend/src/...`
- `packages/ui/src/...`
- `apps/services/api/src/app/api/...`
- `packages/backend/src/{http,modules,runtime}/...`
- `packages/contracts/src/...` / `packages/domain/src/...` when applicable

## 6. Data and State

- Database tables
- Zustand stores
- Server actions / API routes
- External services

## 7. Constraints and Edge Cases

- ...

## 8. Error Handling

- ...

## 9. Performance and Accessibility

- ...

## 10. Tests and Validation

- Manual validation steps
- Automated tests (unit/e2e)

## 11. Related Docs

- `docs/features/...`
- `docs/issues/...`
- `docs/guides/...`

## 12. Change Log

- YYYY-MM-DD: Summary of change

---

_Template version: 2026-10-09_
