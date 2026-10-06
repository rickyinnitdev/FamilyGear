import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { repository } = createRequire(import.meta.url)('../desktop/community.cjs');

test('community links accept only a GitHub owner/repository and remain disconnected when absent', () => {
  assert.equal(repository(undefined), null);
  assert.equal(repository('https://github.com/friend/Family-Gear/'), 'friend/Family-Gear');
  for (const address of ['https://evil.example/owner/repo', 'owner/repo?token=secret', 'owner/../repo', 'owner/..', 'owner/repo#fragment']) assert.throws(() => repository(address));
});
