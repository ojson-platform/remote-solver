# live-frame

## Purpose

A gesture that only changes a frame the window already has paints that frame before the server answers. A later snapshot replaces the data. A brass strip shows while the answer is still due.

## Requirements

### Requirement: Opening paints the ticket before the spine is read

Choosing a cycle SHALL paint a drawer with that ticket's key and title before the server answers. The reason line on the plaque SHALL be the reason block when the plaque has one.

#### Scenario: Opening shows the ticket title before the spine is read

- **WHEN** the person chooses a cycle whose plaque title is known
- **THEN** the drawer shows that key and that title before the response

### Requirement: Opening the same ticket keeps the spine already read

Choosing a cycle whose spine was already shown SHALL paint that spine before the server answers. That spine SHALL stay ready.

#### Scenario: Opening the same ticket shows the spine already read

- **WHEN** the person opens a cycle whose spine was already read
- **THEN** the drawer shows that spine before the response, and the spine stays ready

### Requirement: A hold outranks a snapshot that has not caught up

Closing SHALL hide the drawer before the response. Opening settings SHALL show the sheet before the response. A gate click SHALL flip that station's sign before the response, except when the click is the confirmation that leaves the cycle without control. A snapshot that arrives during a hold SHALL NOT undo it. Rows, the lamp, and the spy line from that snapshot SHALL still apply.

#### Scenario: Closing hides the drawer before the response

- **WHEN** the person closes the open drawer
- **THEN** the drawer is gone before the response

#### Scenario: A snapshot during close leaves the drawer closed

- **WHEN** a snapshot with that drawer arrives while the close has not returned
- **THEN** the drawer stays closed and the snapshot's spy line is shown

#### Scenario: Settings open before the response

- **WHEN** the person opens settings
- **THEN** the sheet is open before the response

#### Scenario: A gate click flips the sign before the response

- **WHEN** the person clicks a gate that is not the last one still on
- **THEN** that station's sign flips before the response

### Requirement: The strip shows work that has not caught up

The window SHALL show one strip while a gesture response, a snapshot read, or a promised spine is outstanding. The drawer SHALL show a strip while its spine is not ready. The settings sheet SHALL show a strip while the sheet is open and one of its gestures has not returned. A local gesture that sends nothing SHALL NOT light a strip.

#### Scenario: The window strip shows while an update is due and goes when the frame is caught up

- **WHEN** a gesture response or a snapshot read is outstanding, and then nothing is outstanding and the spine is ready
- **THEN** the window strip is on, then off

#### Scenario: The drawer strip shows until that ticket's spine is ready

- **WHEN** a drawer is open and its spine is not ready, and then the spine is ready
- **THEN** the drawer strip is on, then off

### Requirement: The snapshot does not wait to read the spine

The response SHALL include the drawer blocks and the last spine built for that ticket. A spine read SHALL stay stored when another cycle is opened. Opening a cycle whose stored spine is still current SHALL return it with `spineReady` true and SHALL NOT read it again. When the open cycle's branch fingerprint is known, the spine SHALL be read again only when that fingerprint changes, and an unchanged fingerprint SHALL leave `spineReady` true. When the fingerprint is not known and that spine is missing or older than the latest content epoch, `spineReady` SHALL be false and the read SHALL run after the response. When the fingerprint is not known and the spine is already ready for the current content epoch, the response SHALL include that spine with `spineReady` true and SHALL NOT read it again. A finished read SHALL publish a new generation without counting as new content. Opening or closing a cycle SHALL NOT count as new content. A failed read SHALL leave the previous spine, or a drawer without a diff, and SHALL set `spineReady` true. The open key SHALL stay, and that snapshot SHALL NOT set `status`. When the fingerprint changes, or the fingerprint is not known and a later content generation is published, the response SHALL keep the previous spine visible with `spineReady` false until the new spine is ready, and SHALL replace rows immediately.

#### Scenario: The next frame fills the spine in the same drawer

- **WHEN** a cycle is opened and the spine read has not finished
- **THEN** the first snapshot has the drawer and `spineReady` false, and the following snapshot has `spineReady` true and the capability diff

#### Scenario: A spy snapshot keeps the previous spine until the next one is ready

- **WHEN** a spine is ready, the branch fingerprint is not known, and a later content generation is published
- **THEN** the first snapshot of that generation still has the previous spine with `spineReady` false, and the following snapshot has `spineReady` true

#### Scenario: A failed read keeps the previous spine

- **WHEN** a spine is ready and the next read fails
- **THEN** the following snapshot has the same capability, `spineReady` true, the same drawer key, and no status

#### Scenario: A fatal ref lookup keeps the previous spine

- **WHEN** a spine is ready and the next ref lookup fails
- **THEN** the following snapshot has the same capability, `spineReady` true, the same drawer key, and no status

#### Scenario: Opening the same ticket again keeps the ready spine

- **WHEN** a cycle's spine is ready and the person closes it and opens it again
- **THEN** that response has the same spine and `spineReady` true

#### Scenario: Switching back to a ticket keeps the spine already read

- **WHEN** a cycle's spine is ready and the person opens another cycle and then the first again
- **THEN** that response has the first cycle's spine and `spineReady` true

#### Scenario: An unchanged fingerprint leaves the open spine ready

- **WHEN** a spine is ready and another cycle's ticket changes
- **THEN** the open cycle's snapshot still has `spineReady` true

#### Scenario: A changed fingerprint reads the spine again

- **WHEN** a spine is ready and that cycle's branch text changes
- **THEN** the next snapshot has the previous spine with `spineReady` false, and the following snapshot has `spineReady` true

### Requirement: The client reads one snapshot at a time

While one snapshot read is in flight, a further change SHALL NOT start another read. When the in-flight read finishes and a change arrived during it, the client SHALL start one follow-up read. The page SHALL keep the newest snapshot it has received.

#### Scenario: Two changes during one read become one follow-up

- **WHEN** two further changes arrive while a snapshot read is in flight
- **THEN** the client starts one follow-up read and does not start a third
