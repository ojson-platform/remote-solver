# focus-pager

## Purpose

The focus pager is the pair of words on the focus block. A word that cannot move is left out. The count of written pages is not on the pager.

## Requirements

### Requirement: The focus pager is the words «назад» and «вперёд»

The focus pager SHALL show the word «назад», the word «вперёд», or both, and no other text. When both words are shown, «назад» SHALL come before «вперёд». On the latest of more than one written page, the pager SHALL show «назад» and omit «вперёд». On the oldest of more than one written page, the pager SHALL show «вперёд» and omit «назад». On a written page that is neither the latest nor the oldest, the pager SHALL show both words. A single written page SHALL leave the pager out.

#### Scenario: A middle page shows both words and no count

- **WHEN** the open written page is neither the latest nor the oldest
- **THEN** the pager shows «назад» and then «вперёд», and those words are its only text

#### Scenario: The latest page omits «вперёд»

- **WHEN** more than one written page is open and the open page is the latest
- **THEN** the pager shows «назад» and omits «вперёд»

#### Scenario: The oldest page omits «назад»

- **WHEN** more than one written page is open and the open page is the oldest
- **THEN** the pager shows «вперёд» and omits «назад»

#### Scenario: A single written page leaves the pager out

- **WHEN** a single written page is open
- **THEN** the pager is absent

### Requirement: The words are their own line and scroll with the focus block

While the pager is shown, the words SHALL be their own line at the start of the focus block, and that line SHALL scroll with the focus block.

#### Scenario: The words are their own line at the start of the focus block

- **WHEN** the pager is shown
- **THEN** the words are their own line at the start of the focus block

#### Scenario: The words scroll with the focus block

- **WHEN** the focus block scrolls and the pager is shown
- **THEN** the words scroll with the focus block
