# link-mark

## Purpose

Every card and the open sidebar show the same direct marks, a chip with a number.

## Requirements

### Requirement: Every card and the open sidebar show the same marks

Every card, in a column and in the pool, and the open sidebar SHALL show the same marks. A mark SHALL be a chip with a number. A mark SHALL be shown only when the other issue is on the board. A closed issue and a cancelled issue are absent, so they SHALL have no mark. A mark SHALL be direct. The issue that holds another SHALL list that next issue, not the issues beyond it. When one issue is both a child and a blocker, the card SHALL show both marks.

#### Scenario: Every card, in a column and in the pool, and the open sidebar show the same marks

- **WHEN** a card in a column, a card in the pool, and the open sidebar already show the same marks, together with a different mark on the open sidebar as the limit that can replace the card's marks
- **THEN** every card, in a column and in the pool, and the open sidebar show the same marks

#### Scenario: A mark is a chip with a number

- **WHEN** a mark is already a chip with a number, together with a mark that is only a word as the limit that can replace that chip
- **THEN** a mark is a chip with a number

#### Scenario: A mark is shown only when the other issue is on the board

- **WHEN** a mark is already shown only when the other issue is on the board, together with a mark for an issue that is off the board as the limit that can replace that
- **THEN** a mark is shown only when the other issue is on the board

#### Scenario: A closed issue and a cancelled issue are absent, so they have no mark

- **WHEN** a closed issue and a cancelled issue are already absent and have no mark, together with a cancelled issue as the limit that can replace that closed issue
- **THEN** a closed issue and a cancelled issue are absent, so they have no mark

#### Scenario: A mark is direct

- **WHEN** a mark is already direct, together with a mark that names an issue beyond the next one as the limit that can replace that
- **THEN** a mark is direct

#### Scenario: The issue that holds another lists that next issue, not the issues beyond it

- **WHEN** the issue that holds another already lists that next issue, not the issues beyond it, together with the issues beyond it as the limit that can replace that next issue
- **THEN** the issue that holds another lists that next issue, not the issues beyond it

#### Scenario: When one issue is both a child and a blocker, the card shows both marks

- **WHEN** one issue is already both a child and a blocker and the card already shows both marks, together with a single mark as the limit that can replace those two
- **THEN** when one issue is both a child and a blocker, the card shows both marks

### Requirement: A chip shows its kind, wraps, and follows key order

Chips SHALL wrap onto the next line and SHALL NOT be cut off. Within one kind the numbers SHALL follow key order. A light corner, down and then right, with no arrowhead, SHALL be a child and SHALL stand only on the parent. The child SHALL have no chip pointing back at the parent. A muted arrow to the left SHALL be an issue this one waits on. A brass arrow to the right SHALL be an issue this one holds. Children SHALL come first, then the issues it waits on, then the issues it holds.

#### Scenario: Chips wrap onto the next line and are not cut off

- **WHEN** chips already wrap onto the next line and are not cut off, together with a chip cut off at the edge as the limit that can replace that wrap
- **THEN** chips wrap onto the next line and are not cut off

#### Scenario: Within one kind the numbers follow key order

- **WHEN** within one kind the numbers already follow key order, together with board order as the limit that can replace that key order
- **THEN** within one kind the numbers follow key order

#### Scenario: A light corner, down and then right, with no arrowhead, is a child and stands only on the parent

- **WHEN** a light corner, down and then right, with no arrowhead, is already a child and already stands only on the parent, together with that corner standing on the child as the limit that can replace the parent
- **THEN** a light corner, down and then right, with no arrowhead, is a child and stands only on the parent

#### Scenario: The child has no chip pointing back at the parent

- **WHEN** the child already has no chip pointing back at the parent, together with a chip on the child that names its parent as the limit that can replace that
- **THEN** the child has no chip pointing back at the parent

#### Scenario: A muted arrow to the left is an issue this one waits on

- **WHEN** a muted arrow to the left is already an issue this one waits on, together with a brass arrow to the right as the limit that can replace that muted arrow
- **THEN** a muted arrow to the left is an issue this one waits on

#### Scenario: A brass arrow to the right is an issue this one holds

- **WHEN** a brass arrow to the right is already an issue this one holds, together with a muted arrow to the left as the limit that can replace that brass arrow
- **THEN** a brass arrow to the right is an issue this one holds

#### Scenario: Children come first, then the issues it waits on, then the issues it holds

- **WHEN** children already come first, then the issues it waits on, then the issues it holds, together with the issues it holds coming first as the limit that can replace that order
- **THEN** children come first, then the issues it waits on, then the issues it holds

### Requirement: The sidebar chips stay under the title

In the sidebar the chips SHALL sit under the title and SHALL stay in place while the body scrolls.

#### Scenario: In the sidebar the chips sit under the title and stay in place while the body scrolls

- **WHEN** in the sidebar the chips already sit under the title and stay in place while the body scrolls, together with the chips scrolling with the body as the limit that can replace that
- **THEN** in the sidebar the chips sit under the title and stay in place while the body scrolls

### Requirement: The reason block no longer names children or blockers

The reason block SHALL no longer name children or blockers. Open questions, Ask, and the merge SHALL stay in that block.

#### Scenario: The reason block no longer names children or blockers

- **WHEN** the reason block is already visible and no longer names children or blockers, together with children and blockers named in that block as the limit that can replace that
- **THEN** the reason block no longer names children or blockers

#### Scenario: Open questions, Ask, and the merge stay in that block

- **WHEN** Open questions, Ask, and the merge are already in that block, together with dropping Open questions, Ask, and the merge from that block as the limit that can replace that
- **THEN** Open questions, Ask, and the merge stay in that block

### Requirement: A chip opens the issue it names

Clicking a chip SHALL open that issue the way clicking its card does. Hovering the chip SHALL show that issue's title. The click SHALL NOT open the card the chip stands on.

#### Scenario: Clicking a chip opens that issue the way clicking its card does

- **WHEN** clicking a chip already opens that issue the way clicking its card does, together with clicking its card as the limit that can replace that chip click
- **THEN** clicking a chip opens that issue the way clicking its card does

#### Scenario: Hovering the chip shows that issue's title

- **WHEN** hovering the chip already shows that issue's title, together with a chip that shows only its number as the limit that can replace that title
- **THEN** hovering the chip shows that issue's title

#### Scenario: The click does not open the card the chip stands on

- **WHEN** the click already does not open the card the chip stands on, together with opening that card as the limit that can replace that
- **THEN** the click does not open the card the chip stands on
