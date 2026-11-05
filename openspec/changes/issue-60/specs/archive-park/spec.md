## ADDED Requirements

### Requirement: The archive parks the change

The OpenSpec CLI SHALL park the change under `openspec/changes/archive/<date>-issue-<key>/`.

#### Scenario: The OpenSpec CLI parks the change under the dated archive path

- **WHEN** the change and `openspec/changes/archive/<date>-issue-<key>/` are already visible, and the OpenSpec CLI already parks the change under that path, together with leaving the change under `openspec/changes/issue-<key>/` as the limit that can replace that archive path
- **THEN** the OpenSpec CLI parks the change under `openspec/changes/archive/<date>-issue-<key>/`
