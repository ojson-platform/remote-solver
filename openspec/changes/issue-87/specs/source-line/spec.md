<!--
sdd-absorbed: c5bde098fa94699f
-->

# Spec Delta

## Purpose

Plan and Design render as one markdown document, and a click opens the remark draft on the source line that place came from. The spec section composes that document with the diff marking and then renders the marking. The painted place is not a diff row.

## ADDED Requirements

### Requirement: The document renders as one markdown document

Plan and Design SHALL render the source as one markdown document. Headings, lists, emphasis, links, and code SHALL render in that document. A source line SHALL NOT be wrapped as its own markdown document.

#### Scenario: Plan and Design render the source as one markdown document

- **WHEN** Plan, Design, the source, and one markdown document are already visible, together with headings, lists, emphasis, links, and code
- **THEN** Plan and Design render the source as one markdown document, and headings, lists, emphasis, links, and code render in that document

#### Scenario: A source line is not wrapped as its own markdown document

- **WHEN** a source line and one markdown document are already visible
- **THEN** a source line is not wrapped as its own markdown document

### Requirement: The line stays a comment target

The source line a rendered place came from SHALL stay a comment target.

#### Scenario: The line stays a comment target

- **WHEN** the rendered place, the source line it came from, and a comment target are already visible
- **THEN** the source line stays a comment target

### Requirement: A click opens the remark draft on that line

A click on a rendered place SHALL open the remark draft on the source line that place came from.

#### Scenario: A click opens the remark draft on the source line

- **WHEN** a click, a rendered place, the remark draft, and the source line that place came from are already visible
- **THEN** a click opens the remark draft on the source line that place came from

### Requirement: There is no diff row

The painted place on Plan and Design SHALL NOT be a diff row.

#### Scenario: There is no diff row

- **WHEN** the painted place on Plan and Design and a diff row are already visible
- **THEN** there is no diff row

### Requirement: The spec section renders diff marking from the markdown document

The spec section SHALL be one markdown document whose text is marked with the diff. That marking SHALL then render in the document. The diff SHALL NOT be a diff row beside a source line.

#### Scenario: The spec section is a markdown document marked with the diff

- **WHEN** the spec section, one markdown document, and the diff marking in its text are already visible
- **THEN** the spec section is one markdown document whose text is marked with the diff

#### Scenario: The diff marking renders in the document

- **WHEN** the diff marking in the markdown document and the rendered document are already visible
- **THEN** the diff marking renders in the document and is not a diff row beside a source line

### Requirement: PlanLines stays the leaf

`PlanLines` SHALL stay the leaf that renders the markdown document.

#### Scenario: PlanLines stays the leaf

- **WHEN** `PlanLines`, the leaf, and the markdown document are already visible
- **THEN** `PlanLines` stays the leaf that renders the markdown document

### Requirement: data-line is the source line with trailing space removed and stays the draft key

`data-line` SHALL be the source line the rendered place came from, with trailing space removed, and SHALL stay the draft key.

#### Scenario: data-line is the source line with trailing space removed and stays the draft key

- **WHEN** the rendered place, the source line it came from, its trailing space, `data-line`, and the draft key are already visible
- **THEN** `data-line` is the source line with trailing space removed and stays the draft key

### Requirement: data-path is proposal.md or design.md under the change read path

On Plan and Design, `data-path` SHALL be `proposal.md` or `design.md` under the change read path.

#### Scenario: data-path is proposal.md or design.md under the change read path

- **WHEN** Plan, Design, `data-path`, `proposal.md`, `design.md`, and the change read path are already visible
- **THEN** `data-path` is `proposal.md` or `design.md` under the change read path

### Requirement: data-at is the source line number the rendered place came from

`data-at` SHALL be the source line number the rendered place came from.

#### Scenario: data-at is the source line number the rendered place came from

- **WHEN** `data-at`, the rendered place, and the source line number it came from are already visible
- **THEN** `data-at` is the source line number the rendered place came from

### Requirement: data-side is right

`data-side` SHALL be `right`.

#### Scenario: data-side is right

- **WHEN** `data-side` and `right` are already visible
- **THEN** `data-side` is `right`

### Requirement: LineNote and posted line comments stay on that path and line

`LineNote` and posted line comments SHALL stay on that path and that source line.

#### Scenario: LineNote and posted line comments stay on that path and line

- **WHEN** `LineNote`, posted line comments, that path, and that source line are already visible
- **THEN** `LineNote` and posted line comments stay on that path and line

### Requirement: On Design, model.design.questions is passed only for Open questions

On Design, `model.design.questions` SHALL be passed only for Open questions. Every other section SHALL pass an empty list so a checkbox outside Open questions stays a line comment.

#### Scenario: On Design, model.design.questions is passed only for Open questions, and a checkbox outside Open questions stays a line comment

- **WHEN** Design, Open questions, every other section, `model.design.questions`, an empty list, a checkbox outside Open questions, and a line comment are already visible
- **THEN** on Design, `model.design.questions` is passed only for Open questions, every other section passes an empty list, and a checkbox outside Open questions stays a line comment

### Requirement: With no pull request, the document is not a comment target

With no pull request, a place in the rendered document SHALL NOT be a comment target.

#### Scenario: With no pull request, the document is not a comment target

- **WHEN** no pull request, a place in the rendered document, and a comment target are already visible
- **THEN** with no pull request, the place is not a comment target

### Requirement: The phase foot stays outside the document

The phase foot SHALL stay outside the document.

#### Scenario: The phase foot stays outside the document

- **WHEN** the phase foot and the document are already visible
- **THEN** the phase foot stays outside the document
