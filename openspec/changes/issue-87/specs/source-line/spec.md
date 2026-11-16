<!--
sdd-absorbed: 254d92efc244adbb
-->

# Spec Delta

## Purpose

Plan and Design render the source as one markdown document, and a click opens the remark draft on the source line that place came from. A source line is not parsed as its own markdown document. A covered line shows the node's value, and a line the value does not contain does not show the raw source. A link reference definition covering three source lines does not show the raw source on those lines when the definition url and title do not contain it. A later line of a closed four-backtick fence whose text is three backticks shows that line slice of the value. An indented code block whose value is fence-shaped text shows the node value on the first covered line, and the next line shows that line slice and does not show the previous line slice. A reference link whose label spans two source lines renders as a link, and each of those covered lines shows the node value. On an unclosed fence whose opening line is the raw marker ```fence and whose node value is a blank line followed by x, that opening line does not show the raw source. An unclosed fence nested in a list, whose code value is a blank line followed by x, shows the node value on that blank line and does not paint it as x, and the later line shows the node value and does not show the raw indented source. On an indented code block that spans several source lines, the first covered line shows the node's value and each later covered line shows that line's slice of the value. On a closed tilde fence spanning several source lines, the line alpha shows that line slice of the value and does not show beta, and the closing ~~~ line does not show the raw marker, which is not in the value. The opening marker line and the closing marker line of a closed fenced code block do not show the raw source, and each later covered line shows that line slice of the value. A closed fenced code block opened with backticks, whose code node value is ~~~, shows that later line of tildes as that line slice of the value and does not paint it as an empty code element, and a tilde run is not the end of that backtick fence. A `##` line stays the section heading and a `###` line stays the smaller heading, a run of blank lines that no node covers stays one gap, a blank line the value contains stays the slice of that value, and with no pull request the line is not a comment target. A fenced code block set in a nested blockquote, whose value is only alpha, shows alpha on the later covered line and does not show the raw source "> alpha", and the closing line does not show "> ```". An indented code block set in a blockquote, whose value is the fence-shaped lines ``` then body then tail, shows the node value on the first covered line and that line is not painted empty, the next line shows that line slice of the value and does not show the previous line slice of the value, and tail shows that line slice of the value. An indented code block set in a blockquote inside a list item, whose value is a fence line, then body, then tail, shows the node value on the first covered line and that line is not painted empty, the next line shows that line slice of the value and does not show the fence line, and the tail line shows that line slice of the value and does not show body. The painted place is not a diff row.

## ADDED Requirements

### Requirement: The document renders as one markdown document

Plan and Design SHALL render the source as one markdown document. Headings, lists, emphasis, links, and code SHALL render in that document. A source line SHALL NOT be parsed as its own markdown document. A covered line SHALL show the node's value. A line the value does not contain SHALL NOT show the raw source. The opening marker line and the closing marker line of a closed fenced code block SHALL NOT show the raw source, and each later covered line SHALL show that line slice of the value. An unclosed fence nested in a list, whose code value is a blank line followed by x, SHALL show the node value on that blank line and SHALL NOT paint that blank line as x, and the later line SHALL show the node value and SHALL NOT show the raw indented source.

#### Scenario: Plan and Design render the source as one markdown document

- **WHEN** the caller opens Plan on a source that contains a heading, a list with a nested list item, a code block inside a list item, emphasis, a link, and code, and then opens Design on that same source
- **THEN** Plan shows one markdown document in which that heading, list, emphasis, link, and code are rendered, and Design shows one markdown document in which those same parts are rendered, a covered line shows the node value, the nested list item shows the node's value so the inner text appears, the code block inside the list item shows the node's value so the code value appears, and neither covered line is painted empty

#### Scenario: A source line is not parsed as its own markdown document

- **WHEN** the caller opens Plan on a source of several lines and then opens Design on that same source
- **THEN** on each surface those lines render inside the one document, and no source line is parsed as its own markdown document

#### Scenario: A covered line shows the node's value

- **WHEN** the caller opens Plan on a source that contains an indented code block spanning several source lines, whose raw indented first line is not in the node value, a closed fenced code block, and a fenced block set in a blockquote whose later covered line has the raw source "> alpha" while the node value is only "alpha", and then opens Design on that same source
- **THEN** on each surface a covered line shows the node value, a line the value does not contain does not show the raw source, the first covered line of that indented block shows the node's value and does not show the raw indented source, each later covered line shows that line slice of the value and does not show the previous line slice of the value, the opening marker line and the closing marker line of that closed fenced code block do not show the raw source, and the later covered line of the fenced block set in the blockquote shows "alpha" and does not show the raw source "> alpha"

#### Scenario: A fenced code block set in a nested blockquote shows alpha and does not show the raw source

- **WHEN** the caller opens Plan on a fenced code block set in a nested blockquote, whose value is only alpha, whose later covered line has the raw source "> alpha", and whose closing line has the raw source "> ```", and then opens Design on that same source
- **THEN** on each surface the later covered line shows alpha and does not show the raw source "> alpha", the closing line does not show "> ```", and a line the value does not contain does not show the raw source

#### Scenario: A closed tilde fence shows that line slice and not the raw marker

- **WHEN** the caller opens Plan on a closed tilde fence spanning several source lines whose covered lines are alpha and beta and whose closing ~~~ marker is not in the node value, and then opens Design on that same source
- **THEN** on each surface the line alpha shows that line slice of the value and does not show beta, and the closing ~~~ line does not show the raw marker

#### Scenario: An unclosed fence line the value does not contain does not show the raw source

- **WHEN** the caller opens Plan on an unclosed fence whose opening line is the raw marker ```fence, that marker is not in the node value, and the node value is a blank line followed by x, and then opens Design on that same source
- **THEN** on each surface that line does not show the raw source

#### Scenario: An unclosed fence nested in a list shows the node value and does not show the raw source

- **WHEN** the caller opens Plan on an unclosed fence nested in a list, whose code value is a blank line followed by x, and then opens Design on that same source
- **THEN** on each surface that blank line shows the node value and is not painted as x, the later line shows the node value and does not show the raw indented source, a covered line shows the node value, and a line the value does not contain does not show the raw source

#### Scenario: A link reference definition does not show the raw source

- **WHEN** the caller opens Plan on a link reference definition that covers three source lines, whose definition url and title do not contain the raw source of those lines, and then opens Design on that same source
- **THEN** on each surface each of those lines does not show the raw source

#### Scenario: A four-backtick fence line and a fence-shaped indented block show that line slice

- **WHEN** the caller opens Plan on a source that contains a closed four-backtick fence whose later covered line is three backticks and that slice is the node value, and an indented code block whose value is fence-shaped text, and then opens Design on that same source
- **THEN** on each surface that later line shows that line slice of the value and is not painted empty, the first covered line of the indented code block shows the node value and is not painted empty, and the next line shows that line slice of the value and does not show the previous line slice of the value

#### Scenario: An indented code block set in a blockquote shows the node value and each later line slice

- **WHEN** the caller opens Plan on an indented code block set in a blockquote, whose value is the fence-shaped lines ``` then body then tail, and then opens Design on that same source
- **THEN** on each surface the first covered line shows the node value and is not painted empty, the next line shows that line slice of the value and does not show the previous line slice of the value, and tail shows that line slice of the value

#### Scenario: An indented code block set in a blockquote inside a list item shows the node value and each later line slice

- **WHEN** the caller opens Plan on an indented code block set in a blockquote inside a list item, whose value is a fence line, then body, then tail, and then opens Design on that same source
- **THEN** on each surface the first covered line shows the node value and is not painted empty, the next line shows that line slice of the value and does not show the fence line, and the tail line shows that line slice of the value and does not show body

#### Scenario: A reference link whose label spans two source lines shows the node value

- **WHEN** the caller opens Plan on a source that contains a reference link whose label spans two source lines, and then opens Design on that same source
- **THEN** on each surface that link is rendered, and each of those covered lines shows the node value so the label is visible and neither line is painted empty

### Requirement: A later line of tildes in a backtick fence shows that line slice

A later line of tildes in a closed fenced code block opened with backticks, whose code node value is ~~~, SHALL show that line slice of the value and SHALL NOT be painted as an empty code element. A tilde run SHALL NOT be the end of that backtick fence. Each later covered line of that closed fenced code block SHALL show that line slice of the value.

#### Scenario: A closed backtick fence shows a later line of tildes as that line slice

- **WHEN** the caller opens Plan on a closed fenced code block opened with backticks, whose later covered line is a run of tildes and whose code node value is ~~~, and then opens Design on that same source
- **THEN** on each surface that covered line shows that line slice of the value and is not painted as an empty code element, a tilde run is not the end of that backtick fence, and each later covered line of that closed fenced code block shows that line slice of the value

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
