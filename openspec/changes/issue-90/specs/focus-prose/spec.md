<!--
sdd-absorbed: 68ce34c407b94bc8
-->

# Spec Delta

## ADDED Requirements

### Requirement: The prose renders markdown

The words after the marker SHALL be rendered as markdown beside the badge. A heading, a list, emphasis, a link, and code SHALL render, and their marks SHALL NOT stay the characters that were written. Those words SHALL stay the words that were written. That prose SHALL NOT be left in a `pre`. When a scenario name sits on the first line of a list item that spans three or more lines, and that line has no text after the name, the words on a line between the first and the last SHALL be beside the badge. Those words SHALL be the words after the marker line, and they SHALL NOT be rewritten.

#### Scenario: The prose renders markdown

- **WHEN** the person opens a written focus whose prose contains a heading, a list, emphasis, a link, and code
- **THEN** the prose beside the badge renders that heading, that list, that emphasis, that link, and that code, and the heading mark, the list mark, the emphasis marks, the link marks, and the code marks do not stay the characters that were written

#### Scenario: The prose is rendered beside the badge

- **WHEN** the person opens a written focus
- **THEN** the prose is rendered beside the badge, and it is not left in a `pre`

#### Scenario: The words after the marker are not rewritten

- **WHEN** the person opens a written focus
- **THEN** the badge is the first line, and the prose beside the badge is the words after that line and those words are not rewritten

#### Scenario: A middle line stays beside the badge

- **WHEN** the person opens a written focus where a scenario name sits on the first line of a list item that spans three or more lines, and that line has no text after the name
- **THEN** the words on the line between the first and the last are beside the badge, the prose beside the badge is the words after the marker line, and those words are not rewritten

### Requirement: Marks stay beside the jump button

When a scenario name sits on a line of a multi-line list item, the prose beside the badge SHALL show that item's list mark once and a heading mark on that line once, in front of the jump button. That line's document paint SHALL NOT include those two marks. The paint SHALL run on the text around the name, including a later line of the item. Emphasis, a link, and code on that line SHALL render as markdown. Link marks and code marks SHALL NOT stay the characters that were written. When a scenario name sits on the first line of a multi-line list item and text remains on that line after the name, an emphasis mark, a link mark, and a code mark that each open on that line and close on a later line SHALL render as markdown. Those marks SHALL NOT stay the characters that were written. The jump line SHALL NOT show the written emphasis mark, the written link mark, or the written code mark. The later line SHALL NOT paint that mark on its own. When a scenario name sits on a later line of a multi-line list item and that line carries a heading mark, the prose beside the badge SHALL show that item's list mark once and a heading mark on that line once, in front of the jump button. That line SHALL NOT be painted as a heading. That line's document paint SHALL NOT include those two marks.

#### Scenario: Marks stay beside the jump button

- **WHEN** the person opens a written focus whose prose contains a heading mark, a list mark, emphasis, a link, and code, and a scenario name sits on a line of a multi-line list item, including a later line of that item
- **THEN** the prose beside the badge shows that item's list mark once and a heading mark on that line once, in front of the jump button, that line's document paint does not include those two marks, the paint runs on the text around the name, including a later line of the item, emphasis, a link, and code on that line render as markdown, and the link marks and the code marks do not stay the characters that were written

#### Scenario: A mark that opens on the first line closes as markdown

- **WHEN** the person opens a written focus where a scenario name sits on the first line of a multi-line list item, text remains on that line after the name, and an emphasis mark, a link mark, and a code mark each open on that line and close on a later line
- **THEN** those marks do not stay the characters that were written, the jump line does not show the written emphasis mark, the written link mark, or the written code mark, the later line does not paint that mark on its own, and emphasis, a link, and code on that line render as markdown

#### Scenario: A heading mark on a later line stays in front of the jump

- **WHEN** the person opens a written focus where a scenario name sits on a later line of a multi-line list item and that line carries a heading mark
- **THEN** the prose beside the badge shows that item's list mark once and a heading mark on that line once, in front of the jump button, that line is not painted as a heading, and that line's document paint does not include those two marks

### Requirement: The marker line stays the badge and is not a heading

The marker line SHALL be the badge and SHALL be the first line. That line SHALL NOT be a heading of the prose.

#### Scenario: The marker line stays the badge and is not a heading

- **WHEN** the person opens a written focus
- **THEN** the marker line is the badge, the badge is the first line, and that line is not a heading

### Requirement: A scenario name stays a button.jump

A scenario name in the written prose SHALL stay a `button.jump`.

#### Scenario: A scenario name stays a button.jump

- **WHEN** the person opens a written focus whose prose contains a scenario name
- **THEN** that scenario name is a `button.jump`

### Requirement: The live page sentence is not the written prose

The prose beside the badge SHALL be the written prose and SHALL NOT be the live page sentence.

#### Scenario: The live page sentence is not the written prose

- **WHEN** the person opens a written focus
- **THEN** the prose beside the badge is the written prose and is not the live page sentence

## REMOVED Requirements

### Requirement: The written prose is the words after the marker
