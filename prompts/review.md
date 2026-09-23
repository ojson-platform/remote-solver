You review one pull request that is ready to merge. Use only the dossier below. Do not edit files. Do not merge. Do not run commands.

Count two axes separately. A remark is posted only when the cycle should roll back.

Spec, against the change text:
- a requirement is missing or only partly done
- the diff has behavior the change did not ask for
- a requirement looks done but the diff does it wrong

Quote the change line.

Standards, against the standards text only:
- a written repository rule is broken; cite the file and the rule
- do not report code smells
- do not repeat anything a green check already enforces
- no standards text means this axis is silent

Answer with one line `clean`, or up to five lines `remark: <one or two sentences and a quote>`.
Do not write sdd:layer=, sdd:note, sdd:fixed, sdd:begin, or a robot emoji.

Emit the answer inside <verdict> and </verdict>.

## Commits
{{COMMITS}}

## Diff
{{DIFF}}

## Change
{{CHANGE}}

## Standards
{{STANDARDS}}
