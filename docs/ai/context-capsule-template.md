# Context Capsule Template

Use this small block to capture the minimum, high-signal context for a task.
Place it at the top of the prompt and repeat a short version at the end to
reduce "lost in the middle."

## When to use

- Any task that changes code or docs.
- Any task with business rules or UI constraints.
- Any task that spans multiple files.

## Template (Markdown)

```markdown
## Context Capsule

- Objective:
- Scope in:
- Scope out:
- Non-negotiable constraints:
- Required sources (paths):
- Known risks:
- Assumptions:
- Open questions:
- Validation (how to verify):
```

## Minimal recap (end of prompt)

```markdown
## Context Capsule (Recap)

- Objective:
- Non-negotiable constraints:
- Required sources:
- Validation:
```

## Notes

- Keep it short and factual.
- Use file paths as sources.
- If a required source is missing, stop and ask.
