# source-line Specification

## Purpose
Each source line of Plan and Design renders as markdown and stays a comment target a click can open, and that line is not a diff row.

## Requirements

### Requirement: On each surface, every source line the leaf paints renders markdown

On each surface, every source line the leaf paints SHALL render markdown (headings, lists, emphasis, links, and code).

#### Scenario: On each surface, every source line the leaf paints renders markdown (headings, lists, emphasis, links, and code)

- **WHEN** each surface, every source line the leaf paints, and markdown (headings, lists, emphasis, links, and code) are already visible
- **THEN** on each surface, every source line the leaf paints renders markdown (headings, lists, emphasis, links, and code)

### Requirement: The line stays a comment target

The line SHALL stay a comment target.

#### Scenario: The line stays a comment target

- **WHEN** the line and a comment target are already visible
- **THEN** the line stays a comment target

### Requirement: A click opens the remark draft on that line

A click SHALL open the remark draft on that line.

#### Scenario: A click opens the remark draft on that line

- **WHEN** a click, the remark draft, and that line are already visible
- **THEN** a click opens the remark draft on that line

### Requirement: There is no diff row

The painted source line SHALL NOT be a diff row.

#### Scenario: There is no diff row

- **WHEN** the painted source line and a diff row are already visible
- **THEN** there is no diff row

### Requirement: PlanLines stays the leaf

`PlanLines` SHALL stay the leaf.

#### Scenario: PlanLines stays the leaf

- **WHEN** `PlanLines` and the leaf are already visible
- **THEN** `PlanLines` stays the leaf

### Requirement: data-line is the source line with trailing space removed and stays the draft key

`data-line` SHALL be the source line with trailing space removed and SHALL stay the draft key.

#### Scenario: data-line is the source line with trailing space removed and stays the draft key

- **WHEN** the source line, its trailing space, `data-line`, and the draft key are already visible
- **THEN** `data-line` is the source line with trailing space removed and stays the draft key

### Requirement: data-path is proposal.md or design.md under the change read path

`data-path` SHALL be `proposal.md` or `design.md` under the change read path.

#### Scenario: data-path is proposal.md or design.md under the change read path

- **WHEN** `data-path`, `proposal.md`, `design.md`, and the change read path are already visible
- **THEN** `data-path` is `proposal.md` or `design.md` under the change read path

### Requirement: data-at is the source line number sectionsOf already assigns

`data-at` SHALL be the source line number `sectionsOf` already assigns.

#### Scenario: data-at is the source line number sectionsOf already assigns

- **WHEN** `data-at`, the source line number, and the number `sectionsOf` already assigns are already visible
- **THEN** `data-at` is the source line number `sectionsOf` already assigns

### Requirement: data-side is right

`data-side` SHALL be `right`.

#### Scenario: data-side is right

- **WHEN** `data-side` and `right` are already visible
- **THEN** `data-side` is `right`

### Requirement: LineNote and posted line comments stay on that path and line

`LineNote` and posted line comments SHALL stay on that path and line.

#### Scenario: LineNote and posted line comments stay on that path and line

- **WHEN** `LineNote`, posted line comments, that path, and that line are already visible
- **THEN** `LineNote` and posted line comments stay on that path and line

### Requirement: On Design, model.design.questions is passed only for Open questions

On Design, `model.design.questions` SHALL be passed only for Open questions. Every other section SHALL pass an empty list so a checkbox outside Open questions stays a line comment.

#### Scenario: On Design, model.design.questions is passed only for Open questions, and a checkbox outside Open questions stays a line comment

- **WHEN** Design, Open questions, every other section, `model.design.questions`, an empty list, a checkbox outside Open questions, and a line comment are already visible
- **THEN** on Design, `model.design.questions` is passed only for Open questions, every other section passes an empty list, and a checkbox outside Open questions stays a line comment

### Requirement: A ## line stays the section h3, not a button

A `##` line SHALL stay the section `h3`, not a button.

#### Scenario: A ## line stays the section h3, not a button

- **WHEN** a `##` line, the section `h3`, and a button are already visible
- **THEN** a `##` line stays the section `h3`, not a button

### Requirement: A ### line stays the h4 from partsOf, not a button

A `###` line SHALL stay the `h4` from `partsOf`, not a button.

#### Scenario: A ### line stays the h4 from partsOf, not a button

- **WHEN** a `###` line, the `h4` from `partsOf`, and a button are already visible
- **THEN** a `###` line stays the `h4` from `partsOf`, not a button

### Requirement: A run of blank lines stays one span.gap

A run of blank lines SHALL stay one `span.gap`.

#### Scenario: A run of blank lines stays one span.gap

- **WHEN** a run of blank lines and one `span.gap` are already visible
- **THEN** a run of blank lines stays one `span.gap`

### Requirement: With no pull request, the line stays a p.line and is not a comment target

With no pull request, the line SHALL stay a `p.line` and SHALL NOT be a comment target.

#### Scenario: With no pull request, the line stays a p.line and is not a comment target

- **WHEN** no pull request, the line, a `p.line`, and a comment target are already visible
- **THEN** with no pull request, the line stays a `p.line` and is not a comment target

### Requirement: The phase foot stays outside the document

The phase foot SHALL stay outside the document.

#### Scenario: The phase foot stays outside the document

- **WHEN** the phase foot and the document are already visible
- **THEN** the phase foot stays outside the document
