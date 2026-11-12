<!--
sdd-absorbed: 3f092f8d92ae1270
-->

# Spec Delta

## MODIFIED Requirements

### Requirement: The focus pager is one control on the focus row, opposite the badge

The focus pager SHALL be one control on the focus row, opposite the badge.

Its back and forward controls SHALL be rounds. Each round SHALL hold a chevron icon. `<` and `>` SHALL NOT be the mark.

The count SHALL stay between the two rounds.

A round that cannot move SHALL stay in place and go quiet, so the number SHALL NOT jump.

One written focus SHALL still leave the pager out.

The count SHALL run from the oldest page, so the latest page SHALL read `12/12`.

A single written focus SHALL leave the control out.

The row SHALL then be the badge and the prose.

Back SHALL still walk older written comments, newest first.

Forward SHALL still return toward now.

Opening SHALL still land on the latest page.

The badge and the prose SHALL stay as they are.

#### Scenario: One control on the focus row, opposite the badge, shows a back chevron, the current page and the count, and a forward chevron, in the form `< 11/12 >`

- **WHEN** one control, the focus row, the badge, a back chevron, the current page, the count, and a forward chevron are already visible, and that control is already opposite the badge, each chevron already held in a round, the count already between those rounds, and the characters `<` and `>` are already not the mark, together with those characters as the mark and the words «назад» and «вперёд» as the limit that can replace that control
- **THEN** one control on the focus row, opposite the badge, shows a back chevron and a forward chevron, each in a round, with the current page and the count between those rounds, and the characters `<` and `>` are not the mark

#### Scenario: The focus pager's back and forward controls are rounds

- **WHEN** the focus pager's back control and its forward control are already visible, and those controls are already rounds, together with a new circle as the limit that can replace that face
- **THEN** the focus pager's back and forward controls are rounds

#### Scenario: Each round holds a chevron icon

- **WHEN** each round and a chevron icon are already visible, and each round already holds a chevron icon, together with a word on the round as the limit that can replace that icon
- **THEN** each round holds a chevron icon

#### Scenario: The characters `<` and `>` are not the mark

- **WHEN** the characters `<` and `>` and the mark are already visible, and those characters are already not the mark, together with those characters as the mark as the limit that can replace the chevron icon
- **THEN** the characters `<` and `>` are not the mark

#### Scenario: The count stays between the two rounds

- **WHEN** the count and the two rounds are already visible, and the count already stays between the two rounds, together with the count outside the two rounds as the limit that can replace that place
- **THEN** the count stays between the two rounds

#### Scenario: The count runs from the oldest page, so the latest page reads `12/12`

- **WHEN** the count, the oldest page, and the latest page are already visible, and the latest page already reads `12/12`, together with a count from the newest page so the latest page reads `1/12` as the limit that can replace that reading
- **THEN** the count runs from the oldest page, so the latest page reads `12/12`

#### Scenario: A chevron that cannot move stays in place and goes quiet, so the number does not jump

- **WHEN** a chevron that cannot move, the round that holds it, and the number are already visible, and that round already stays in place and goes quiet, together with that chevron disappearing as the limit that can replace it and make the number jump
- **THEN** a chevron that cannot move stays in place and goes quiet, so the number does not jump, and the round that holds it stays in place and goes quiet

#### Scenario: A round that cannot move stays in place and goes quiet

- **WHEN** a round that cannot move is already visible, and that round already stays in place and goes quiet, together with that round disappearing as the limit that can replace staying in place and going quiet
- **THEN** a round that cannot move stays in place and goes quiet

#### Scenario: A single written focus leaves the control out

- **WHEN** a single written focus is already visible and the control is already left out, together with the control on that row as the limit that can replace that absence
- **THEN** a single written focus leaves the control out

#### Scenario: One written focus still leaves the pager out

- **WHEN** one written focus is already visible and the pager is already left out, together with the pager on that row as the limit that can replace that absence
- **THEN** one written focus still leaves the pager out

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
