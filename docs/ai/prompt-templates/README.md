# Hybrid Prompt Templates

These templates define a structured JSON output for common tasks. Use them with
a short narrative context plus a Context Capsule.

## Templates

- `docs/ai/prompt-templates/bugfix.json`
- `docs/ai/prompt-templates/feature-change.json`
- `docs/ai/prompt-templates/documentation-update.json`
- `docs/ai/prompt-templates/code-review.json`

## Usage

1. Read required docs and build a Context Capsule.
2. Provide a short narrative context above the JSON.
3. Return JSON that follows the chosen template.
4. If a required source is missing, stop and ask.
