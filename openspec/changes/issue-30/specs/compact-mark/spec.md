# compact-mark

## Purpose

Task words and spec badges share one compact mark, so the caller sees the same small chip for each of them.

## ADDED Requirements

### Requirement: The task words and the spec badges share one compact mark

`impl`, `готово`, `открыто`, and the spec badges `new`, `changed`, and `removed` SHALL share one compact mark: smaller padding, no glow, one line.

#### Scenario: impl, готово, открыто, and the spec badges new, changed, and removed share one compact mark

- **WHEN** `impl`, `готово`, `открыто`, and the spec badges `new`, `changed`, and `removed` are already visible, and they already share one compact mark with smaller padding, no glow, and one line, together with larger padding, a glow, or a second line as the limit that can replace that mark
- **THEN** `impl`, `готово`, `открыто`, and the spec badges `new`, `changed`, and `removed` share one compact mark: smaller padding, no glow, one line
