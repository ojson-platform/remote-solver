# hammer

## Purpose

While the spy's running set contains the issue, the task that wears `impl` also wears the hammer. The hammer is the chosen mark: one filled path, blunt poll and a 45° wedge, handle through the middle.

## Requirements

### Requirement: The plaque of the phase a worker is in wears the hammer

The hammer SHALL hang on the plaque of the phase the worker is in. A worker improving a spec SHALL hang it on the specifying plaque. A worker archiving SHALL hang it on the accepting plaque. Any phase the running set is actually working SHALL get the same mark. When the worker leaves, the hammer SHALL go and the `impl` badge SHALL stay. A cycle that is waiting for a person SHALL show no hammer. The plaque SHALL be the mark. The Tasks-row hammer SHALL NOT stay beside it. The hammer SHALL stay the chosen mark: one filled path, blunt poll and a 45° wedge, handle through the middle. That path SHALL be `M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z`. The hammer SHALL knock about 45° around the handle, with `transform-origin: 43.75% 93.75%`, and SHALL repeat while the worker stays.

#### Scenario: The hammer hangs on the plaque of the phase the worker is in

- **WHEN** the hammer is already hanging on the plaque of the phase the worker is in, together with the Tasks row as the limit that can replace that plaque
- **THEN** the hammer hangs on the plaque of the phase the worker is in

#### Scenario: A worker improving a spec hangs the hammer on the specifying plaque

- **WHEN** a worker improving a spec is already visible and the hammer already hangs on the specifying plaque, together with the accepting plaque as the limit that can replace that specifying plaque
- **THEN** a worker improving a spec hangs the hammer on the specifying plaque

#### Scenario: A worker archiving hangs the hammer on the accepting plaque

- **WHEN** a worker archiving is already visible and the hammer already hangs on the accepting plaque, together with the specifying plaque as the limit that can replace that accepting plaque
- **THEN** a worker archiving hangs the hammer on the accepting plaque

#### Scenario: Any phase the running set is actually working gets the same mark

- **WHEN** a phase the running set is actually working already shows the same mark, together with a cycle waiting for a person as the limit that can replace that working
- **THEN** any phase the running set is actually working gets the same mark

#### Scenario: The hammer goes when the worker leaves

- **WHEN** the worker has already left and the hammer is already gone, together with the worker staying as the limit that can replace that leaving
- **THEN** when the worker leaves, the hammer goes

#### Scenario: A cycle that is waiting for a person shows no hammer

- **WHEN** a cycle is already waiting for a person and shows no hammer, together with a phase the running set is actually working as the limit that can replace that waiting
- **THEN** a cycle that is waiting for a person shows no hammer

#### Scenario: The plaque is the mark

- **WHEN** the plaque is already visible as the mark, together with the Tasks row as the limit that can replace that plaque
- **THEN** the plaque is the mark

#### Scenario: The Tasks-row hammer does not stay beside the plaque

- **WHEN** the Tasks row is already beside the plaque and shows no hammer, together with the plaque as the limit that can replace that Tasks row
- **THEN** the Tasks-row hammer does not stay beside the plaque

#### Scenario: The mark stays one filled path while the worker stays

- **WHEN** the mark is already visible as one filled path, a blunt poll and a 45° wedge, the handle through the middle, knocking about 45° while the worker stays, together with the worker leaving as the limit that can replace that stay
- **THEN** the mark is one filled path, a blunt poll and a 45° wedge, handle through the middle, knocking about 45° while the worker stays

#### Scenario: The hammer is the chosen mark

- **WHEN** the hammer is already visible as the chosen mark, one filled path, blunt poll and a 45° wedge, handle through the middle, together with the filled path `M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z` as the limit that can replace that description
- **THEN** the hammer is the chosen mark: one filled path, blunt poll and a 45° wedge, handle through the middle

#### Scenario: The filled path is M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z

- **WHEN** the hammer already shows the filled path `M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z`, together with a blunt poll, a 45° wedge, and the handle through the middle as the limit that can replace that path
- **THEN** the hammer is the filled path `M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z`

#### Scenario: The hammer knocks about 45 degrees and repeats while the worker stays

- **WHEN** the hammer already knocks about 45° around the handle, `transform-origin: 43.75% 93.75%` is already visible, and the knock already repeats while the worker stays, together with the worker leaving as the limit that can replace that stay
- **THEN** it knocks about 45° around the handle, `transform-origin: 43.75% 93.75%`, and repeats while the worker stays

#### Scenario: The hammer goes and the impl badge stays when the worker leaves

- **WHEN** the worker has already left, the hammer is already gone, and the `impl` badge stays, together with the worker staying as the limit that can replace that leaving
- **THEN** when the worker leaves, the hammer goes and the `impl` badge stays
