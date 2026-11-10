# focus-pager

## Purpose

The focus pager is the pair of words on the focus block. A word that cannot move is left out. The count of written pages is not on the pager.

## Requirements

### Requirement: The focus pager is one control on the focus row, opposite the badge

The focus pager SHALL be one control on the focus row, opposite the badge.

That control SHALL show a back chevron, the current page and the count, and a forward chevron, in the form `< 11/12 >`.

The count SHALL run from the oldest page, so the latest page SHALL read `12/12`.

A chevron that cannot move SHALL stay in place and go quiet, so the number SHALL NOT jump.

A single written focus SHALL leave the control out.

The row SHALL then be the badge and the prose.

#### Scenario: One control on the focus row, opposite the badge, shows a back chevron, the current page and the count, and a forward chevron, in the form `< 11/12 >`

Back SHALL still walk older written comments, newest first.

Forward SHALL still return toward now.

Opening SHALL still land on the latest page.

The badge and the prose SHALL stay as they are.

- **WHEN** one control, the focus row, the badge, a back chevron, the current page, the count, and a forward chevron are already visible, and that control already shows `< 11/12 >` opposite the badge, together with the words «назад» and «вперёд» as the limit that can replace that control
- **THEN** one control on the focus row, opposite the badge, shows a back chevron, the current page and the count, and a forward chevron, in the form `< 11/12 >`

#### Scenario: The count runs from the oldest page, so the latest page reads `12/12`

- **WHEN** the count, the oldest page, and the latest page are already visible, and the latest page already reads `12/12`, together with a count from the newest page so the latest page reads `1/12` as the limit that can replace that reading
- **THEN** the count runs from the oldest page, so the latest page reads `12/12`

#### Scenario: A chevron that cannot move stays in place and goes quiet, so the number does not jump

- **WHEN** a chevron that cannot move and the number are already visible, and that chevron already stays in place and goes quiet, together with that chevron disappearing as the limit that can replace it and make the number jump
- **THEN** a chevron that cannot move stays in place and goes quiet, so the number does not jump

#### Scenario: A single written focus leaves the control out

- **WHEN** a single written focus is already visible and the control is already left out, together with the control on that row as the limit that can replace that absence
- **THEN** a single written focus leaves the control out

#### Scenario: The row is the badge and the prose

- **WHEN** a single written focus, the row, the badge, and the prose are already visible, and the row is already the badge and the prose, together with the control on that row as the limit that can replace that
- **THEN** the row is the badge and the prose

#### Scenario: Back still walks older written comments, newest first

- **WHEN** Back and the older written comments are already visible, and Back already walks those comments, newest first, together with oldest first as the limit that can replace that order
- **THEN** Back still walks older written comments, newest first

#### Scenario: Forward still returns toward now

- **WHEN** Forward and now are already visible, and Forward already returns toward now, together with an older written comment as the limit that can replace now
- **THEN** Forward still returns toward now

#### Scenario: Opening still lands on the latest page

- **WHEN** opening and the latest page are already visible, and opening already lands on the latest page, together with an older page as the limit that can replace that latest page
- **THEN** opening still lands on the latest page

#### Scenario: The badge and the prose stay as they are

- **WHEN** the badge and the prose are already visible, and the badge and the prose already stay as they are, together with the control replacing the badge or the prose as the limit that can replace them
- **THEN** the badge and the prose stay as they are

### Requirement: The control sits in the right part of the focus row and scrolls with the block

The control SHALL sit in the right part of the focus row and SHALL scroll with the block. The row SHALL be the chosen placement. The header pin and the right-rim solid SHALL NOT be that placement.

#### Scenario: The control sits in the right part of the focus row and scrolls with the block

- **WHEN** the control, the right part of the focus row, and the block are already visible, and the control already sits in the right part of that row and scrolls with the block, together with its own line at the start of the focus block as the limit that can replace that place
- **THEN** the control sits in the right part of that row and scrolls with the block

#### Scenario: The row is the chosen placement

- **WHEN** the row is already the placement of the control, together with the header pin and the right-rim solid as the limit that can replace that row
- **THEN** the row is the chosen placement

#### Scenario: The header pin and the right-rim solid are not

- **WHEN** the header pin and the right-rim solid are already visible, together with the row as the limit that can replace them
- **THEN** the header pin and the right-rim solid are not the placement
