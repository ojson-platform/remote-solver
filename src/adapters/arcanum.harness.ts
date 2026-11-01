export const specPath = 'openspec/changes/issue-1/specs/case-read/spec.md';
export const activeDiff = '/v1/pull-requests/42/active-diff?fields=id';
export const changelist = '/v2/public/diff/7/changelist?fields=path,entry_id';

type Posted = {path: string; body: unknown};

export function fakeHttp(active: unknown = {id: 7}) {
  const gets: string[] = [];
  const posts: Posted[] = [];
  const get = async (path: string): Promise<unknown> => {
    gets.push(path);
    if (path === activeDiff) {
      return active;
    }
    if (path === changelist) {
      return [{path: specPath, entry_id: 'e1'}];
    }
    throw new Error(`unexpected get ${path}`);
  };
  const post = async (path: string, body: unknown): Promise<void> => {
    posts.push({path, body});
  };
  return {get, post, gets, posts};
}
