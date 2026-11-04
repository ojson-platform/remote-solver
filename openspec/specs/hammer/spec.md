# hammer

## Purpose

While the spy's running set contains the issue, the task that wears `impl` also wears the hammer. The hammer is the chosen mark: one filled path, blunt poll and a 45° wedge, handle through the middle.

## Requirements

### Requirement: The impl task wears the hammer while the issue is in the running set

While the spy's running set contains the issue, the task that wears `impl` SHALL also wear the hammer. The hammer SHALL be the chosen mark: one filled path, blunt poll and a 45° wedge, handle through the middle. That path SHALL be `M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z`. The hammer SHALL knock about 45° around the handle, with `transform-origin: 43.75% 93.75%`, and SHALL repeat while the issue stays in the running set. When the agent leaves the issue, the hammer SHALL go and the `impl` badge SHALL stay. An issue in the running set with no `impl` task SHALL show no hammer.

#### Scenario: The task that wears impl wears the hammer while the issue is in the running set

- **WHEN** the spy's running set already contains the issue, the task that wears `impl` is already visible, and that task already wears the hammer, together with the agent leaving the issue as the limit that can replace that running set
- **THEN** while the spy's running set contains the issue, the task that wears `impl` also wears the hammer

#### Scenario: The hammer is the chosen mark

- **WHEN** the hammer is already visible as the chosen mark, one filled path, blunt poll and a 45° wedge, handle through the middle, together with the filled path `M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z` as the limit that can replace that description
- **THEN** the hammer is the chosen mark: one filled path, blunt poll and a 45° wedge, handle through the middle

#### Scenario: The filled path is M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z

- **WHEN** the hammer already shows the filled path `M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z`, together with a blunt poll, a 45° wedge, and the handle through the middle as the limit that can replace that path
- **THEN** the hammer is the filled path `M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z`

#### Scenario: The hammer knocks about 45 degrees and repeats while the issue stays in the running set

- **WHEN** the hammer already knocks about 45° around the handle, `transform-origin: 43.75% 93.75%` is already visible, and the knock already repeats while the issue stays in the running set, together with the agent leaving the issue as the limit that can replace that stay
- **THEN** it knocks about 45° around the handle, `transform-origin: 43.75% 93.75%`, and repeats while the issue stays in the running set

#### Scenario: The hammer goes and the impl badge stays when the agent leaves the issue

- **WHEN** the agent has already left the issue, the hammer is already gone, and the `impl` badge stays, together with the issue staying in the spy's running set as the limit that can replace that leaving
- **THEN** when the agent leaves the issue, the hammer goes and the `impl` badge stays

#### Scenario: An issue in the running set with no impl task shows no hammer

- **WHEN** the issue is already in the running set, no `impl` task is visible, and no hammer is visible, together with a task that wears `impl` as the limit that can replace that missing task
- **THEN** an issue in the running set with no `impl` task shows no hammer
