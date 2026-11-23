### Requirement: A covered line shows the node value

A covered line SHALL show the node value. A line the value does not contain SHALL NOT show the raw source.

#### Scenario: A covered line shows the node value

- **WHEN** the person opens a document where a node covers several lines, the node value does not contain every one of those lines, and the line the scenario names is alpha
- **THEN** the line the scenario names shows the node value alpha, and that line does not show the raw source
