### Requirement: A covered line shows the node value

A covered line SHALL show the node value. A line the value does not contain SHALL NOT show the raw source.

#### Scenario: A covered line shows the node value

- **WHEN** the person opens a document where a node covers several lines and the node value does not contain every one of those lines
- **THEN** a covered line shows the node value, and a line the value does not contain does not show the raw source
