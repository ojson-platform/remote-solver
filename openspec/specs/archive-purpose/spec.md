# archive-purpose

## Purpose

On a spec that did not exist, the archive writes placeholder Purpose (`TBD - created by archiving change ...`). An existing spec's Purpose stays unchanged.

## Requirements

### Requirement: Purpose is written only for a spec that did not exist

On a spec that did not exist, the archive SHALL write placeholder Purpose (`TBD - created by archiving change ...`). The archive SHALL leave an existing spec's Purpose unchanged.

#### Scenario: On a spec that did not exist, the archive writes placeholder Purpose

- **WHEN** a spec that did not exist and the placeholder Purpose `TBD - created by archiving change ...` are already visible, and the archive already writes that placeholder Purpose, together with an existing spec's Purpose left unchanged as the limit that can replace that placeholder
- **THEN** on a spec that did not exist, the archive writes placeholder Purpose (`TBD - created by archiving change ...`)

#### Scenario: The archive leaves an existing spec's Purpose unchanged

- **WHEN** an existing spec's Purpose is already visible, and the archive already leaves that Purpose unchanged, together with the placeholder Purpose `TBD - created by archiving change ...` as the limit that can replace that unchanged Purpose
- **THEN** the archive leaves an existing spec's Purpose unchanged
