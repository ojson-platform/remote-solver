sdd-absorbed: 3e9bd7da96ee11eb

- [x] `spec-row-markdown` A marked line renders as markdown; A code span across two source lines shows the paint of its own line
- [x] `spec-row-coloring` Added, deleted, and unchanged rows keep their classes; A changed span is marked; A changed marked word is marked on the painted span; A line with no changed span has no marked span; An unchanged spec row is plain
- [x] `spec-row-line-numbers` A changed row keeps both number cells and the fold bar is separate; An unchanged spec shows one line number; A code block keeps the line numbers in sequence; A fence marker stays a row
- [x] `spec-row-comment-control` The row button is the comment control; A row with no pull request is not a comment control; A line with no text is not a comment control
- [x] `spec-row-remark` A click opens the remark draft; An anchored row carries the file, the line, and the right side; A row with no anchor opens a draft and shows no posted line comment
- [x] `spec-row-scenario-name` A scenario line carries its scenario name