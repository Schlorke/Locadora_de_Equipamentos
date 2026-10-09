# Architecture Diagrams

This folder keeps minimal Mermaid diagrams for critical flows and a few
templates for new diagrams. Diagrams are treated as source-of-truth context for
IAs and humans.

## Baseline diagrams

- `docs/architecture/diagrams/system-overview.mermaid`
- `docs/architecture/diagrams/quote-flow.mermaid`
- `docs/architecture/diagrams/quote-boleto-flow.mermaid`
- `docs/architecture/diagrams/quote-email-flow.mermaid`
- `docs/architecture/diagrams/quote-status-flow.mermaid`
- `docs/architecture/diagrams/admin-auth-permissions.mermaid`

## Templates

- `docs/architecture/diagrams/templates/architecture-system-overview.mermaid`
- `docs/architecture/diagrams/templates/sequence-flow-template.mermaid`
- `docs/architecture/diagrams/templates/state-machine-template.mermaid`

## Checklist

- `docs/architecture/diagrams/checklist.md`

## Update rules

- Update diagrams when a flow or integration changes.
- Keep diagrams small and focused (avoid deep implementation detail).
- Prefer short node labels and explicit edges.
