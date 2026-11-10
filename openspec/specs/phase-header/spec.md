# phase-header

## Purpose

The phase header is the row of phase names over the board. It stays at the top of the board while the board scrolls. Its background stays transparent. A ticket row that scrolls up fades out in the header's lower padding under the letters, and at rest the first row starts at the bottom of the header, fully readable.

## Requirements

### Requirement: The phase header stays at the top of the board

The phase header SHALL be the row of phase names over the board scroll.

The phase header SHALL stay at the top of the board while the board scrolls.

The seven phase names SHALL stay aligned with the station columns under them.

The header background SHALL stay transparent.

The phase names SHALL stay over the board, on a transparent header, and a row that scrolls up SHALL fade out before it covers the letters.

The empty band under the names SHALL go away.

#### Scenario: The phase header stays at the top of the board while the board scrolls

At rest the first row SHALL start at the bottom edge of the header and stay fully readable.

The fade SHALL be the header's lower padding and nowhere below it.

Content SHALL be gone through the letters, SHALL fade only across the padding under them, and SHALL be fully opaque from the bottom edge of the header.

Scrolling a row up SHALL fade it inside those 7px and SHALL hide it before it reaches the letters.

At rest the first row SHALL NOT be inside the fade.

The header SHALL be 28px tall.

The names SHALL be 10px type on a 1.35 line, centered in that 28px.

The letters SHALL run from about 7px to 21px, so the padding under the letters SHALL be the last 7px of the header, from 20.75px to 28px.

The fade SHALL belong in that lower padding and nowhere below it.

The mask SHALL stay on the scrolling board.

The names SHALL stay in the absolute `.head`, outside the mask, transparent, 28px tall, aligned with the station columns.

The mask SHALL be `linear-gradient(to bottom, transparent 0 20.75px, #000 28px, #000 100%)`, with the `-webkit-mask-image` prefix as well.

`padding-top` SHALL be `28px`, the header height.

The first row SHALL start on that edge.

The only air between the letters and the row SHALL be the header's own lower padding.

A shown card SHALL clear the fade by the board's computed `padding-top`.

That lead SHALL stay tied to the padding, so a shown card SHALL clear the fade when the padding changes.

There SHALL be no second offset.

The page bar above the board SHALL NOT be the phase header.

Scrolling the sidebar SHALL NOT move this header, and scrolling the board SHALL NOT move the sidebar.

- **WHEN** the phase header is already visible at the top of the board while the board scrolls, together with scrolling the sidebar as the limit that can replace that board scroll
- **THEN** the phase header stays at the top of the board while the board scrolls

#### Scenario: The seven phase names stay aligned with the station columns under them

- **WHEN** the seven phase names are already visible and aligned with the station columns under them, together with the board scroll that can move those columns out from under the names
- **THEN** the seven phase names stay aligned with the station columns under them

#### Scenario: A row that scrolls up fades out under the names and the names stay readable

- **WHEN** a row that scrolls up, the phase names, and the header's lower padding are already visible, together with the empty band under the names as the limit that can replace that padding
- **THEN** the row fades out under the names, the names stay readable, the fade is the header's lower padding, and at rest the first row starts at the bottom of the header, fully readable

#### Scenario: The page bar above the board is not the phase header

- **WHEN** the page bar is already visible above the board, together with the phase header, the row of phase names inside the board, as the limit that can replace that bar
- **THEN** the page bar above the board is not the phase header

#### Scenario: Scrolling the sidebar does not move the header and scrolling the board does not move the sidebar

- **WHEN** the phase header and the sidebar are already visible, and scrolling the sidebar does not move this header, together with scrolling the board as the limit that can replace that scroll
- **THEN** scrolling the sidebar does not move this header, and scrolling the board does not move the sidebar

#### Scenario: The phase names stay over the board on a transparent header and a row that scrolls up fades out before it covers the letters

- **WHEN** the phase names are already over the board on a transparent header, and a row that scrolls up already fades out before it covers the letters, together with the empty band under the names as the limit that can replace that fade
- **THEN** the phase names stay over the board, on a transparent header, and a row that scrolls up still fades out before it covers the letters

#### Scenario: The empty band under the names goes away

- **WHEN** the empty band under the names is already gone, together with the first row starting below a clear band as the limit that can replace that
- **THEN** the empty band under the names goes away

#### Scenario: At rest the first row starts at the bottom edge of the header and stays fully readable

- **WHEN** at rest the first row already starts at the bottom edge of the header and stays fully readable, together with a fade that runs down into the first row as the limit that can replace that
- **THEN** at rest the first row starts at the bottom edge of the header and stays fully readable

#### Scenario: The fade is the header's lower padding and nowhere below it

- **WHEN** the fade is already the header's lower padding and nowhere below it, together with a fade below the header as the limit that can replace that padding
- **THEN** the fade is the header's lower padding and nowhere below it

#### Scenario: Content is gone through the letters, fades only across the padding under them, and is fully opaque from the bottom edge of the header

- **WHEN** content is already gone through the letters, fades only across the padding under them, and is fully opaque from the bottom edge of the header, together with content that stays visible through the letters as the limit that can replace that
- **THEN** content is gone through the letters, fades only across the padding under them, and is fully opaque from the bottom edge of the header

#### Scenario: Scrolling a row up fades it inside those 7px and hides it before it reaches the letters

- **WHEN** a row scrolling up already fades inside those 7px and hides before it reaches the letters, together with the letters as the limit that the row can cover
- **THEN** scrolling a row up fades it inside those 7px and hides it before it reaches the letters

#### Scenario: At rest the first row is not inside the fade

- **WHEN** at rest the first row is already not inside the fade, together with the fade covering that row as the limit that can replace that
- **THEN** at rest the first row is not inside the fade

#### Scenario: The header is 28px tall

- **WHEN** the header is already 28px tall, together with a different header height as the limit that can replace it
- **THEN** the header is 28px tall

#### Scenario: The names are 10px type on a 1.35 line, centered in that 28px

- **WHEN** the names are already 10px type on a 1.35 line, centered in that 28px, together with a different type size as the limit that can replace that type
- **THEN** the names are 10px type on a 1.35 line, centered in that 28px

#### Scenario: The letters run from about 7px to 21px and the padding under them is the last 7px

- **WHEN** the letters already run from about 7px to 21px, and the padding under the letters is already the last 7px of the header, from 20.75px to 28px, together with a fade below 28px as the limit that can replace that padding
- **THEN** the letters run from about 7px to 21px, and the padding under the letters is the last 7px of the header, from 20.75px to 28px

#### Scenario: The fade belongs in that lower padding and nowhere below it

- **WHEN** the fade already belongs in the header's lower padding and nowhere below it, together with a fade below that padding as the limit that can replace it
- **THEN** the fade belongs in that lower padding and nowhere below it

#### Scenario: The mask stays on the scrolling board

- **WHEN** the mask is already on the scrolling board, together with the names taking that mask as the limit that can replace it
- **THEN** the mask stays on the scrolling board

#### Scenario: The names stay outside the mask, transparent, 28px tall, and aligned with the station columns

- **WHEN** the names are already in the absolute `.head`, outside the mask, transparent, 28px tall, and aligned with the station columns, together with the mask covering those names as the limit that can replace that
- **THEN** the names stay in the absolute `.head`, outside the mask, transparent, 28px tall, aligned with the station columns

#### Scenario: The mask fades from 20.75px to 28px

- **WHEN** the mask is already `linear-gradient(to bottom, transparent 0 20.75px, #000 28px, #000 100%)`, with the `-webkit-mask-image` prefix as well, together with a mask that stays transparent past 28px as the limit that can replace it
- **THEN** the mask is `linear-gradient(to bottom, transparent 0 20.75px, #000 28px, #000 100%)`, with the `-webkit-mask-image` prefix as well

#### Scenario: padding-top is 28px, the header height

- **WHEN** `padding-top` is already `28px`, the header height, together with a larger `padding-top` as the limit that can replace it
- **THEN** `padding-top` is `28px`, the header height

#### Scenario: The first row starts on that edge

- **WHEN** the first row already starts on the bottom edge of the header, together with the empty band under the names as the limit that can push the row below that edge
- **THEN** the first row starts on that edge

#### Scenario: The only air between the letters and the row is the header's own lower padding

- **WHEN** the only air between the letters and the row is already the header's own lower padding, together with air below the header as the limit that can replace that padding
- **THEN** the only air between the letters and the row is the header's own lower padding

#### Scenario: A shown card clears the fade by the board's computed padding-top

- **WHEN** a shown card already clears the fade by the board's computed `padding-top`, together with a second offset as the limit that can replace that lead
- **THEN** a shown card clears the fade by the board's computed `padding-top`

#### Scenario: That lead stays tied to the padding when the padding changes

- **WHEN** that lead is already tied to the padding and a shown card already clears the fade when the padding changes, together with a second offset as the limit that can replace that lead
- **THEN** that lead stays tied to the padding, so a shown card clears the fade when the padding changes

#### Scenario: There is no second offset

- **WHEN** no second offset is already the lead, together with a second offset as the limit that can replace the padding lead
- **THEN** there is no second offset
