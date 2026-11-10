# line-select

## Purpose

A sidebar line is one that takes a comment: a plan line, a design line, a spec line, or a diff line. A sidebar line is selectable and the selected text is copyable. A drag that leaves selected text is not a click.

## Requirements

### Requirement: A sidebar line can be selected and copied

A sidebar line SHALL be one that takes a comment: a plan line, a design line, a spec line, or a diff line.

A sidebar line SHALL be selectable and the selected text SHALL be copyable.

A drag that leaves selected text SHALL NOT be a click.

That drag SHALL NOT open the line's comment, and it SHALL NOT close one that is already open.

The field SHALL stay as it was.

#### Scenario: A sidebar line can be selected and copied

A click that leaves no selection SHALL still open an empty field, SHALL still close an empty field, and SHALL still leave a field that holds text open.

- **WHEN** a sidebar line, its selected text, and the copy of that text are already visible, together with a click that leaves no selection as the limit that can replace that selection
- **THEN** a sidebar line can be selected and copied

#### Scenario: A drag that leaves selected text is not a click

- **WHEN** a drag that leaves selected text is already visible, together with a click that leaves no selection as the limit that can replace that drag
- **THEN** a drag that leaves selected text is not a click

#### Scenario: The drag does not open the line's comment and does not close one that is already open

- **WHEN** a drag that leaves selected text, the line's comment, and one that is already open are already visible, together with a click that leaves no selection as the limit that can replace that drag
- **THEN** it does not open the line's comment, and it does not close one that is already open

#### Scenario: The field stays as it was

- **WHEN** the field is already visible as it was, together with a click that leaves no selection as the limit that can replace the drag that leaves selected text
- **THEN** the field stays as it was

#### Scenario: A click that leaves no selection still opens an empty field, still closes an empty field, and still leaves a field that holds text open

- **WHEN** a click that leaves no selection, an empty field that opens, an empty field that closes, and a field that holds text are already visible, together with a drag that leaves selected text as the limit that can replace that click
- **THEN** a click that leaves no selection still opens an empty field, still closes an empty field, and still leaves a field that holds text open
