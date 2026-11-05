# archive-refusal

## Purpose

The archive refuses with a non-zero exit when a baseline would have no requirement after the fold, and it does not commit.

## Requirements

### Requirement: The archive refuses a baseline that would have no requirement

The archive SHALL refuse with a non-zero exit when a baseline would have no requirement after the fold, and it SHALL NOT commit.

#### Scenario: The archive refuses with a non-zero exit and does not commit

- **WHEN** a baseline that would have no requirement after the fold, a non-zero exit, and no commit are already visible, and the archive already refuses with that non-zero exit and does not commit, together with a zero exit and a commit of that baseline as the limit that can replace that refusal
- **THEN** the archive refuses with a non-zero exit when a baseline would have no requirement after the fold, and it does not commit
