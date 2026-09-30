# mirror

## Purpose

The mirror verb updates one layer line on the issue and leaves the author's text in place.

## Requirements

### Requirement: Mirror keeps the author's text

`mirror` SHALL replace one layer line between `<!-- sdd:begin -->` and `<!-- sdd:end -->` and SHALL leave the text outside that block. When the block is missing, it SHALL append the block at the end. The author's text SHALL stay.

#### Scenario: A missing block is appended

- **WHEN** the issue body has no mirror block and mirror sets a layer line
- **THEN** the author's text stays and the block is appended at the end with that line

#### Scenario: An existing layer line is replaced

- **WHEN** the block already has the layer and another layer
- **THEN** that layer's line is replaced and the other layer and the author's text stay
