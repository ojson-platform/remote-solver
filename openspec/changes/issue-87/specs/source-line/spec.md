<!--
sdd-absorbed: 254d92efc244adbb
-->

# Spec Delta

## Purpose

Plan and Design render the source as one markdown document, and a click opens the remark draft on the source line that place came from. A source line is not parsed as its own markdown document. A covered line shows the node's value, and a line the value does not contain does not show the raw source. On an indented code block that spans several source lines, the first covered line shows the node's value and each later covered line shows that line's slice of the value. The opening marker line and the closing marker line of a closed fenced code block do not show the raw source. A `##` line stays the section heading and a `###` line stays the smaller heading, a run of blank lines that no node covers stays one gap, a blank line the value contains stays the slice of that value, and with no pull request the line is not a comment target. The painted place is not a diff row.

## ADDED Requirements

### Requirement: The document renders as one markdown document

Plan and Design SHALL render the source as one markdown document. Headings, lists, emphasis, links, and code SHALL render in that document. A source line SHALL NOT be parsed as its own markdown document. A covered line SHALL show the node's value. A line the value does not contain SHALL NOT show the raw source.

#### Scenario: Plan and Design render the source as one markdown document

- **WHEN** the caller opens Plan on a source that contains a heading, a list, emphasis, a link, and code, and then opens Design on that same source
- **THEN** Plan shows one markdown document in which that heading, list, emphasis, link, and code are rendered, and Design shows one markdown document in which those same parts are rendered

#### Scenario: A source line is not parsed as its own markdown document

- **WHEN** the caller opens Plan on a source of several lines and then opens Design on that same source
- **THEN** on each surface those lines render inside the one document, and no source line is parsed as its own markdown document

#### Scenario: A covered line shows the node's value

- **WHEN** the caller opens Plan on a source that contains an indented code block spanning several source lines, whose raw indented first line is not in the node value, a closed fenced code block whose opening and closing marker text is not in the node value, and a fenced block set in a blockquote whose later covered line has the raw source "> alpha" while the node value is only "alpha", and then opens Design on that same source
- **THEN** on each surface a covered line shows the node value, a line the value does not contain does not show the raw source, the first covered line of that indented block shows the node's value and does not show the raw indented source, each later covered line shows that line's slice of the value and does not show the previous line slice of the value, the opening marker line and the closing marker line are not painted as the raw fence, and the later covered line of the fenced block set in the blockquote shows "alpha" and does not show the raw source "> alpha"

### Requirement: The line stays a comment target

The source line a rendered place came from SHALL stay a comment target.

#### Scenario: The line stays a comment target

- **WHEN** the caller opens Plan or Design while a pull request is open
- **THEN** that source line is a comment target

### Requirement: A click opens the remark draft on that line

A click on a rendered place SHALL open the remark draft on the source line that place came from.

#### Scenario: A click opens the remark draft on the source line

- **WHEN** the caller clicks a rendered place that came from one source line while a different source line is also painted
- **THEN** the remark draft opens on the source line that place came from and does not open on the other source line

### Requirement: There is no diff row

The painted place on Plan and Design SHALL NOT be a diff row.

#### Scenario: There is no diff row

- **WHEN** the caller opens Plan or Design
- **THEN** the painted place is not a diff row

### Requirement: PlanLines stays the leaf

`PlanLines` SHALL stay the leaf that renders the markdown document.

#### Scenario: PlanLines stays the leaf

- **WHEN** the caller opens Plan or Design
- **THEN** `PlanLines` is the leaf that renders the markdown document

### Requirement: data-line is the source line with trailing space removed and stays the draft key

`data-line` SHALL be the source line the rendered place came from, with trailing space removed, and SHALL stay the draft key.

#### Scenario: data-line is the source line with trailing space removed and stays the draft key

- **WHEN** the caller opens Plan or Design on a source line that ends with trailing space
- **THEN** `data-line` is that source line with the trailing space removed, and the draft key is that same value

### Requirement: data-path is proposal.md or design.md under the change read path

On Plan and Design, `data-path` SHALL be `proposal.md` or `design.md` under the change read path.

#### Scenario: data-path is proposal.md or design.md under the change read path

- **WHEN** the caller opens Plan and then opens Design
- **THEN** on Plan `data-path` is `proposal.md` under the change read path, and on Design `data-path` is `design.md` under the change read path

### Requirement: data-at is the source line number sectionsOf already assigns

`data-at` SHALL be the source line number `sectionsOf` already assigns.

#### Scenario: data-at is the source line number sectionsOf already assigns

- **WHEN** the caller opens Plan on a source line and then opens Design on that same source
- **THEN** on each surface `data-at` is the source line number `sectionsOf` already assigns

### Requirement: data-side is right

`data-side` SHALL be `right`.

#### Scenario: data-side is right

- **WHEN** the caller opens Plan or Design
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

### Requirement: A level-two heading stays the section h3, not a button

A `##` line SHALL stay the section `h3` and SHALL NOT be a button.

#### Scenario: A level-two heading stays the section h3, not a button

- **WHEN** the caller opens Plan on a source that contains a `##` line and then opens Design on that same source
- **THEN** on each surface that line is the section `h3` and is not a button

### Requirement: A level-three heading stays the h4 from partsOf, not a button

A `###` line SHALL stay the `h4` from `partsOf` and SHALL NOT be a button.

#### Scenario: A level-three heading stays the h4 from partsOf, not a button

- **WHEN** the caller opens Plan on a source that contains a `###` line and then opens Design on that same source
- **THEN** on each surface that line is the `h4` from `partsOf` and is not a button

### Requirement: A run of blank lines stays one span.gap

A run of blank lines that no node covers SHALL stay one `span.gap`. A blank line that a code node covers SHALL stay the slice of that value, because the value contains that empty line, and SHALL stay a comment target.

#### Scenario: A run of blank lines stays one span.gap

- **WHEN** the caller opens Plan on a source that contains a run of blank lines that no node covers, and then opens Design on that same source
- **THEN** on each surface that run is one `span.gap`

#### Scenario: A covered blank line stays the slice of the value

- **WHEN** the caller opens Plan on a source that contains a fenced code block with a blank line inside it, and then opens Design on that same source
- **THEN** on each surface that covered blank line stays the slice of the value and is a comment target, and it is not one `span.gap`

### Requirement: With no pull request, the line stays a p.line and is not a comment target

With no pull request, the line SHALL stay a `p.line` and SHALL NOT be a comment target.

#### Scenario: With no pull request, the line stays a p.line and is not a comment target

- **WHEN** the caller opens Plan and then opens Design and there is no pull request
- **THEN** on each surface the line is a `p.line` and is not a comment target

### Requirement: The phase foot stays outside the document

The phase foot SHALL stay outside the document.

#### Scenario: The phase foot stays outside the document

- **WHEN** the caller opens Plan or Design
- **THEN** the phase foot is outside the document
