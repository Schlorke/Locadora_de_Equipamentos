# Diagram Maintenance Checklist

Use this checklist after any change that affects architecture or critical flows.

## Create or update

- [ ] Check if a relevant diagram already exists.
- [ ] Update the existing diagram instead of creating a duplicate.
- [ ] Keep labels short and unambiguous.
- [ ] Ensure edges reflect real data flow (not assumptions).

## Validate

- [ ] Mermaid syntax renders without errors.
- [ ] Paths or component names match the codebase/docs.
- [ ] The diagram matches the described flow in docs/features.

## Document

- [ ] Add or update links in `docs/architecture/diagrams/README.md`.
- [ ] Reference the diagram in the relevant feature doc (if critical).
