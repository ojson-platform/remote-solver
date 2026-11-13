sdd-absorbed: b07077694ef663ac

- [ ] `plan-lines-markdown` Plan and Design render the source as one markdown document; A source line is not wrapped as its own markdown document; PlanLines stays the leaf; data-line is the source line with trailing space removed and stays the draft key; data-path is proposal.md or design.md under the change read path; data-at is the source line number the rendered place came from; data-side is right
- [ ] `plan-lines-remark` The line stays a comment target; A click opens the remark draft on the source line; There is no diff row; LineNote and posted line comments stay on that path and line
- [x] `plan-lines-sections` On Design, model.design.questions is passed only for Open questions, and a checkbox outside Open questions stays a line comment; A ## line stays the section h3, not a button; A ### line stays the h4 from partsOf, not a button
- [ ] `plan-lines-chrome` With no pull request, the document is not a comment target; The phase foot stays outside the document
