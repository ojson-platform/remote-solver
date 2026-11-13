# source-line Specification

## Purpose
Plan and Design render as one markdown document, and a click opens the remark draft on the source line that place came from. A source line is not wrapped as its own markdown document. The painted place is not a diff row.

## Requirements

### Requirement: The document renders as one markdown document

Plan and Design SHALL render the source as one markdown document. Headings, lists, emphasis, links, and code SHALL render in that document. A source line SHALL NOT be wrapped as its own markdown document.

#### Scenario: Plan and Design render the source as one markdown document

- **WHEN** the caller opens Plan on a source that contains a heading, a list, emphasis, a link, and code, and then opens Design on that same source
- **THEN** Plan shows one markdown document in which that heading, list, emphasis, link, and code are rendered, and Design shows one markdown document in which those same parts are rendered

#### Scenario: A source line is not wrapped as its own markdown document

- **WHEN** the caller opens Plan on a source of several lines and then opens Design on that same source
- **THEN** on each surface those lines render inside the one document, and no source line is wrapped as its own markdown document

### Requirement: The line stays a comment target

The source line a rendered place came from SHALL stay a comment target.

#### Scenario: The line stays a comment target

- **WHEN** the caller opens Plan or Design and a place is painted from a source line
- **THEN** that source line is a comment target

### Requirement: A click opens the remark draft on that line

A click on a rendered place SHALL open the remark draft on the source line that place came from.

#### Scenario: A click opens the remark draft on the source line

- **WHEN** the caller clicks a rendered place that came from one source line while a different source line is also painted
- **THEN** the remark draft opens on the source line that place came from and does not open on the other source line

### Requirement: There is no diff row

The painted place on Plan and Design SHALL NOT be a diff row.

#### Scenario: There is no diff row

- **WHEN** the caller opens Plan or Design and a place is painted from the source
- **THEN** that painted place is not a diff row

### Requirement: PlanLines stays the leaf

`PlanLines` SHALL stay the leaf that renders the markdown document.

#### Scenario: PlanLines stays the leaf

- **WHEN** the caller opens Plan or Design
- **THEN** `PlanLines` is the leaf that renders the markdown document

### Requirement: data-line is the source line with trailing space removed and stays the draft key

`data-line` SHALL be the source line the rendered place came from, with trailing space removed, and SHALL stay the draft key.

#### Scenario: data-line is the source line with trailing space removed and stays the draft key

- **WHEN** Plan paints a source line that ends with trailing space
- **THEN** `data-line` is that source line with the trailing space removed, and the draft key is that same value

### Requirement: data-path is proposal.md or design.md under the change read path

On Plan and Design, `data-path` SHALL be `proposal.md` or `design.md` under the change read path.

#### Scenario: data-path is proposal.md or design.md under the change read path

- **WHEN** the caller opens Plan and then opens Design
- **THEN** on Plan `data-path` is `proposal.md` under the change read path, and on Design `data-path` is `design.md` under the change read path

### Requirement: data-at is the source line number the rendered place came from

`data-at` SHALL be the source line number the rendered place came from.

#### Scenario: data-at is the source line number the rendered place came from

- **WHEN** a place is painted from a source line
- **THEN** `data-at` is that source line's number

### Requirement: data-side is right

`data-side` SHALL be `right`.

#### Scenario: data-side is right

- **WHEN** Plan or Design paints a source line
- **THEN** `data-side` is `right`

### Requirement: LineNote and posted line comments stay on that path and line

`LineNote` and posted line comments SHALL stay on that path and that source line.

#### Scenario: LineNote and posted line comments stay on that path and line

- **WHEN** the caller posts a line comment on a painted source line
- **THEN** `LineNote` and the posted line comment stay on that path and that source line

### Requirement: On Design, model.design.questions is passed only for Open questions

On Design, `model.design.questions` SHALL be passed only for Open questions. Every other section SHALL pass an empty list so a checkbox outside Open questions stays a line comment.

#### Scenario: On Design, model.design.questions is passed only for Open questions, and a checkbox outside Open questions stays a line comment

- **WHEN** the caller opens Design, Open questions is present, and another section contains a checkbox
- **THEN** `model.design.questions` is passed only for Open questions, the other section passes an empty list, and that checkbox stays a line comment

### Requirement: With no pull request, the document is not a comment target

With no pull request, a place in the rendered document SHALL NOT be a comment target.

#### Scenario: With no pull request, the document is not a comment target

- **WHEN** the caller opens Plan or Design and there is no pull request
- **THEN** a place in the rendered document is not a comment target

### Requirement: The phase foot stays outside the document

The phase foot SHALL stay outside the document.

#### Scenario: The phase foot stays outside the document

- **WHEN** the caller opens Plan or Design
- **THEN** the phase foot is outside the document
