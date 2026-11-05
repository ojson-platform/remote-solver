# archive-fold

## Purpose

The OpenSpec CLI applies a change delta onto baselines with `openspec archive issue-<key> --yes`. The order is RENAMED, then REMOVED, then MODIFIED, then ADDED. Remote-solver assumes that CLI, the same tool as `openspec validate`.

## Requirements

### Requirement: The archive applies a change delta in fold order

The OpenSpec CLI SHALL apply a change delta onto baselines with `openspec archive issue-<key> --yes`. It SHALL apply RENAMED, then REMOVED, then MODIFIED, then ADDED. Remote-solver SHALL assume the CLI already behaves this way, the same tool as `openspec validate` (ADR 0015).

#### Scenario: The OpenSpec CLI applies a change delta onto baselines with openspec archive

- **WHEN** the OpenSpec CLI, a change delta, the baselines, and `openspec archive issue-<key> --yes` are already visible, and the CLI already applies that delta onto those baselines with that command, together with a tool other than `openspec validate` as the limit that can replace that command
- **THEN** the OpenSpec CLI applies a change delta onto baselines with `openspec archive issue-<key> --yes`

#### Scenario: The archive applies RENAMED, then REMOVED, then MODIFIED, then ADDED

- **WHEN** RENAMED, REMOVED, MODIFIED, and ADDED are already visible, and the archive already applies RENAMED, then REMOVED, then MODIFIED, then ADDED, together with ADDED, then MODIFIED, then REMOVED, then RENAMED as the limit that can replace that order
- **THEN** it applies RENAMED, then REMOVED, then MODIFIED, then ADDED

#### Scenario: Remote-solver assumes the CLI already behaves this way

- **WHEN** remote-solver, the CLI, `openspec validate`, and ADR 0015 are already visible, and remote-solver already assumes the CLI behaves this way as that same tool, together with a fold reimplemented apart from that CLI as the limit that can replace that assumption
- **THEN** remote-solver assumes the CLI already behaves this way, the same tool as `openspec validate` (ADR 0015)
