## MODIFIED Requirements

### Requirement: A listed task wears готово or открыто

Each task listed in Tasks SHALL wear `готово` when that task is done and SHALL NOT wear `открыто` or `impl`. An open task that is not the current one SHALL wear `открыто` and SHALL NOT wear `impl`. While the cycle is in `implementing`, the first open task SHALL show the badge `impl` and SHALL NOT wear `открыто`. While the cycle is not in `implementing`, an open task SHALL wear `открыто` and no listed task SHALL wear `impl`.

#### Scenario: A done task wears готово

- **WHEN** Tasks lists a done task, and that task already wears `готово` and keeps `готово`, together with `impl` as the limit that can replace `готово`
- **THEN** that task wears `готово`, keeps `готово`, and does not wear `открыто` or `impl`

#### Scenario: An open task wears открыто

- **WHEN** the cycle is in `tasking` and Tasks lists an open task, and that task already wears `открыто`, together with `impl` as the limit that can replace `открыто`
- **THEN** that task wears `открыто` and does not wear `готово` or `impl`

#### Scenario: The first open task wears открыто in the list during implementing

- **WHEN** the cycle is in `implementing` and Tasks lists an open task, then a done task, then another open task, and the first open task already shows the badge `impl`, together with `открыто` as the limit that can replace `impl`
- **THEN** the first open task shows the badge `impl` and does not wear `открыто`, the done task wears `готово`, and the later open task wears `открыто`

#### Scenario: In Tasks, the first open task of a cycle in implementing shows the badge impl

- **WHEN** the first open task of a cycle in `implementing` already shows the badge `impl`, together with `открыто` as the limit that can replace `impl`
- **THEN** the first open task of a cycle in `implementing` shows the badge `impl`

#### Scenario: A done task keeps готово

- **WHEN** a done task already keeps `готово`, together with `impl` as the limit that can replace `готово`
- **THEN** a done task keeps `готово`

#### Scenario: An open task that is not the current one keeps открыто

- **WHEN** an open task that is not the current one already keeps `открыто`, together with `impl` as the limit that can replace `открыто`
- **THEN** an open task that is not the current one keeps `открыто`

#### Scenario: A cycle outside implementing has no impl badge

- **WHEN** a cycle outside `implementing` already has no `impl` badge, together with the badge `impl` on the first open task of a cycle in `implementing` as the limit that can replace that absence
- **THEN** a cycle outside `implementing` has no `impl` badge
