# accept-caption

## Purpose

The Accept row's caption is the sentence about whether the machine merges on its own.

## Requirements

### Requirement: The Accept row caption is the auto-merge sentence

Once the spine is read, the Accept row caption SHALL be «На приёмке машина мержит сама.» when the issue carries `sdd:auto-merge`, and «На приёмке мерж ждёт человека.» when it does not. Before the spine is read, the caption SHALL be «На приёмке мерж ждёт человека.» even when the issue carries `sdd:auto-merge`. A focus comment SHALL NOT replace the caption. A comment whose first line is `sdd:focus:accept` SHALL NOT become the caption. When the Accept row is open, the row SHALL show a paragraph after the caption. When the caption is «На приёмке машина мержит сама.», that paragraph SHALL be «Метка sdd:auto-merge стоит. Машина мержит сама, когда проверки зелёные.» Otherwise that paragraph SHALL be «Метки sdd:auto-merge нет. Машина мержит только с этой меткой.»

#### Scenario: Auto-merge sets the machine sentence

- **WHEN** the issue carries `sdd:auto-merge`, the spine is read, and the Accept row is open
- **THEN** the caption is «На приёмке машина мержит сама.» and the row shows «Метка sdd:auto-merge стоит. Машина мержит сама, когда проверки зелёные.»

#### Scenario: No auto-merge sets the person sentence

- **WHEN** the issue does not carry `sdd:auto-merge`, the spine is read, and the Accept row is open
- **THEN** the caption is «На приёмке мерж ждёт человека.» and the row shows «Метки sdd:auto-merge нет. Машина мержит только с этой меткой.»

#### Scenario: Before the spine is read the caption waits for a person

- **WHEN** the issue carries `sdd:auto-merge`, the spine is not read, and the Accept row is open
- **THEN** the caption is «На приёмке мерж ждёт человека.» and the row shows «Метки sdd:auto-merge нет. Машина мержит только с этой меткой.»

#### Scenario: A focus comment leaves the caption

- **WHEN** the spine is read, the issue does not carry `sdd:auto-merge`, the Accept row is open, and a comment's first line is `sdd:focus:accept` followed by a sentence
- **THEN** the caption is «На приёмке мерж ждёт человека.» and the row shows «Метки sdd:auto-merge нет. Машина мержит только с этой меткой.»
