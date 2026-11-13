sdd-absorbed: 5203d0361d4326a4

- [ ] `plan-lines-markdown` On each surface, every source line the leaf paints renders markdown (headings, lists, emphasis, links, and code); PlanLines stays the leaf; data-line is the source line with trailing space removed and stays the draft key; data-path is proposal.md or design.md under the change read path; data-at is the source line number sectionsOf already assigns; data-side is right; A run of blank lines stays one span.gap
- [ ] `plan-lines-remark` The line stays a comment target; A click opens the remark draft on that line; There is no diff row; LineNote and posted line comments stay on that path and line
- [ ] `plan-lines-sections` On Design, model.design.questions is passed only for Open questions, and a checkbox outside Open questions stays a line comment; A ## line stays the section h3, not a button; A ### line stays the h4 from partsOf, not a button
- [ ] `plan-lines-chrome` With no pull request, the line stays a p.line and is not a comment target; The phase foot stays outside the document
