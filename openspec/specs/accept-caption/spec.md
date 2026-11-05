# accept-caption

## Purpose

When a comment's first line is `sdd:focus:accept`, the Accept row's caption is the first sentence of that comment. Until that comment exists, the caption is the sentence about whether the machine merges on its own.

## Requirements

### Requirement: The Accept row caption is the auto-merge sentence

When a comment's first line is `sdd:focus:accept`, the Accept row's caption SHALL be the first sentence of that comment. Until that comment exists, the row SHALL keep the sentence about auto-merge. Once the spine is read and that comment does not exist, the caption SHALL be «На приёмке машина мержит сама.» when the issue carries `sdd:auto-merge`, and «На приёмке мерж ждёт человека.» when it does not. Before the spine is read and that comment does not exist, the caption SHALL be «На приёмке мерж ждёт человека.» even when the issue carries `sdd:auto-merge`. A focus comment whose first line is not `sdd:focus:accept` SHALL NOT replace the caption. When the Accept row is open and the caption is a sentence about auto-merge, the row SHALL show a paragraph after the caption. When the caption is «На приёмке машина мержит сама.», that paragraph SHALL be «Метка sdd:auto-merge стоит. Машина мержит сама, когда проверки зелёные.» When the caption is «На приёмке мерж ждёт человека.», that paragraph SHALL be «Метки sdd:auto-merge нет. Машина мержит только с этой меткой.»

#### Scenario: The Accept row's caption becomes the first sentence of that comment

- **WHEN** the Accept row's caption, the first sentence, and the `sdd:focus:accept` comment are already visible, and the caption is already that first sentence, together with the sentence about auto-merge as the limit that can replace that first sentence
- **THEN** the Accept row's caption becomes the first sentence of that comment

#### Scenario: Until the comment exists, the row keeps the sentence about auto-merge

- **WHEN** the row and the sentence about auto-merge are already visible, the `sdd:focus:accept` comment is not, and the row already keeps that sentence, together with the first sentence of that comment as the limit that can replace that sentence
- **THEN** until the comment exists, the row keeps the sentence about auto-merge

#### Scenario: Auto-merge sets the machine sentence

- **WHEN** the issue carries `sdd:auto-merge`, the spine is read, the Accept row is open, and no comment begins with `sdd:focus:accept`
- **THEN** the caption is «На приёмке машина мержит сама.» and the row shows «Метка sdd:auto-merge стоит. Машина мержит сама, когда проверки зелёные.»

#### Scenario: No auto-merge sets the person sentence

- **WHEN** the issue does not carry `sdd:auto-merge`, the spine is read, the Accept row is open, and no comment begins with `sdd:focus:accept`
- **THEN** the caption is «На приёмке мерж ждёт человека.» and the row shows «Метки sdd:auto-merge нет. Машина мержит только с этой меткой.»

#### Scenario: Before the spine is read the caption waits for a person

- **WHEN** the issue carries `sdd:auto-merge`, the spine is not read, the Accept row is open, and no comment begins with `sdd:focus:accept`
- **THEN** the caption is «На приёмке мерж ждёт человека.» and the row shows «Метки sdd:auto-merge нет. Машина мержит только с этой меткой.»

#### Scenario: A focus comment leaves the caption

- **WHEN** the spine is read, the issue does not carry `sdd:auto-merge`, the Accept row is open, no comment begins with `sdd:focus:accept`, and a comment's first line is `sdd:focus:plan` followed by a sentence
- **THEN** the caption is «На приёмке мерж ждёт человека.» and the row shows «Метки sdd:auto-merge нет. Машина мержит только с этой меткой.»
