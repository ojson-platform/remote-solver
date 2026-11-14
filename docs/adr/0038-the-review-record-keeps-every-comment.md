---
status: accepted
---

# The review record keeps every comment and the latest body stays the marker

The review port keeps every comment of a thread, in the order the host returns them. The body and the reply handle stay the latest comment, so the machine still reads only that marker and a reply still targets it. A thread drops only when it has no comment or every author is ignored. A later `sdd:fixed` is a status on the first comment, not a second comment. The window splits the list with the marker grammar. Fetching only the latest comment was rejected: the original disappears once a reply exists. Storing that original as the body was rejected: the machine misses `sdd:fixed`, and the reply handle points at the wrong comment.
