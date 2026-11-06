# compact-mark

## Purpose

The badges `impl`, `готово`, `открыто`, `new`, `changed`, and `removed` share one compact mark. That mark is one line, with smaller padding and no glow.

## ADDED Requirements

### Requirement: The badges share one compact mark

`impl`, `готово`, `открыто`, and the spec badges `new`, `changed`, and `removed` SHALL share one compact mark. That mark SHALL stay one line, with smaller padding and no glow.

#### Scenario: impl, готово, открыто, and the spec badges new, changed, and removed share one compact mark

- **WHEN** `impl`, `готово`, `открыто`, and the spec badges `new`, `changed`, and `removed` are already visible and already share one compact mark, with smaller padding, no glow, and one line, together with a second word, a glow, and larger padding as the limit that can replace that mark
- **THEN** `impl`, `готово`, `открыто`, and the spec badges `new`, `changed`, and `removed` share one compact mark: smaller padding, no glow, one line

#### Scenario: The mark stays one line, with smaller padding and no glow

- **WHEN** the mark is already one line, with smaller padding and no glow, together with a second word, a glow, and larger padding as the limit that can replace that mark
- **THEN** the mark stays one line, with smaller padding and no glow
