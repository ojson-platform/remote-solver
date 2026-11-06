import {requirement, scenario, spec} from '@ojson/spec-coverage';

spec('unsent-remark', () => {
  requirement('A new remark stays in the window until send', () => {
    scenario('A new remark stays in the window until send', () => {});
  });

  requirement('The send control posts every unsent remark as its own review thread', () => {
    scenario(
      'The send control on the remark field posts every unsent remark as its own review thread',
      () => {},
    );
  });

  requirement('«Принять» stays on the phase row', () => {
    scenario('«Принять» stays on the phase row', () => {});
    scenario('The send control does not take its place', () => {});
  });

  requirement('A successful send shows the thread and clears the draft', () => {
    scenario(
      'Immediately after a successful send the thread is visible in the sidebar and the draft is cleared together with that',
      () => {},
    );
    scenario('After the GitHub thread has been accepted, the draft must disappear', () => {});
  });

  requirement('The draft remains only when that thread is not on the pull request', () => {
    scenario('A failed send leaves the draft', () => {});
    scenario(
      'Once GitHub has accepted the thread, the draft disappears, including when the window reported an error such as stale',
      () => {},
    );
    scenario('The draft remains only when that thread is not on the pull request', () => {});
    scenario('The draft remains only when the thread is not on the pull request', () => {});
  });

  requirement('A retry does not post a second thread with the same text on the same line', () => {
    scenario(
      'When the pull request already has that thread, including after the window reported an error, a retry does not post a second thread with the same text on the same line',
      () => {},
    );
    scenario(
      'If the window replied with an error after the write, including stale, a retry does not create a second thread with the same text on the same line',
      () => {},
    );
  });

  requirement('The window holds the queue for the open ticket', () => {
    scenario('The window holds the queue for the open ticket', () => {});
    scenario('A reload drops unsent remarks', () => {});
  });
});
