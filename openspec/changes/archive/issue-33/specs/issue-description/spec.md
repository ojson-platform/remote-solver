## ADDED Requirements

### Requirement: A pool cycle shows its issue description in the sidebar

A cycle in the pool SHALL show its issue description in the sidebar. The person SHALL be able to read that description when choosing a ticket, along with the title. The description SHALL be the issue body the tracker already returned, the author's text outside `<!-- sdd:begin -->` and `<!-- sdd:end -->`. An empty description SHALL leave no block. When the cycle leaves the pool, the block SHALL go. The spine of a taken cycle SHALL stay as it is.

#### Scenario: A cycle in the pool shows its issue description in the sidebar

- **WHEN** a cycle in the pool, its issue description, and the sidebar are already visible, together with an empty description
- **THEN** a cycle in the pool shows its issue description in the sidebar

#### Scenario: The person reads the issue description when choosing a ticket, along with the title

- **WHEN** the person, the issue description, and the title are already visible when choosing a ticket, together with the spine of a taken cycle
- **THEN** the person can read the issue description when choosing a ticket, along with the title

#### Scenario: The description is the issue body the tracker already returned, the author's text outside the markers

- **WHEN** the description, the issue body the tracker already returned, and the author's text outside `<!-- sdd:begin -->` and `<!-- sdd:end -->` are already visible, together with the text inside those markers
- **THEN** the description is the issue body the tracker already returned, the author's text outside `<!-- sdd:begin -->` and `<!-- sdd:end -->`

#### Scenario: An empty description leaves no block

- **WHEN** an empty description is already visible, together with an issue description in the sidebar
- **THEN** an empty description leaves no block

#### Scenario: The block goes when the cycle leaves the pool

- **WHEN** a cycle that has left the pool and the block are already visible, together with a cycle in the pool showing its issue description in the sidebar
- **THEN** the block goes

#### Scenario: The spine of a taken cycle stays as it is

- **WHEN** the spine of a taken cycle is already visible, together with the issue description block
- **THEN** the spine of a taken cycle stays as it is
