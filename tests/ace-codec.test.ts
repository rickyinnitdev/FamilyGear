import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checksum, decodeTravel, isReply, packet, updateTravel } from '../src/devices/ace-codec.ts';

function configuration() {
  const raw = new Uint8Array(1024);
  raw.set([0xa6, 0x31, 49, 0x92, 9, 0xe4, 19, 0xc8], 8 * 3);
  raw.set([0xa2, 0x12, 99, 0x44, 19, 0x22, 29, 0x34], 8 * 7);
  return raw;
}
test('56-byte packets use offsets and payload checksum, including the final short chunk', () => {
  const request = packet(0xa1, 1008, 16, Uint8Array.from({ length: 16 }, (_, i) => i));
  assert.equal(request.length, 64);
  assert.equal(request[5], 240);
  assert.equal(request[6], 3);
  assert.equal(request[3], (16 + 240 + 3 + 120) & 255);
  assert.equal(request[24], 0);
});
test('responses must match command, offset, length, success code and checksum', () => {
  const req = packet(0xa0, 56, 56);
  const reply = req.slice(); reply[0] = 0xaa;
  assert.ok(isReply(req, reply));
  for (const index of [1, 2, 3, 4, 5, 6, 7]) { const bad = reply.slice(); bad[index] ^= 1; assert.equal(isReply(req, bad), false); }
  const payloadCorruption = reply.slice(); payloadCorruption[8] = 1;
  assert.equal(isReply(req, payloadCorruption), false);
  payloadCorruption[3] = checksum(payloadCorruption);
  assert.ok(isReply(req, payloadCorruption));
  assert.equal(isReply(req, reply.slice(0, 12)), false);
});
test('travel edits preserve key mode, switch type, flags, unrelated slots and input buffer', () => {
  const original = configuration(), snapshot = original.slice();
  const result = updateTravel(original, [3], { actuation: 1.2, press: 0.12, release: 0.22 });
  assert.deepEqual(original, snapshot);
  assert.deepEqual(result.subarray(8 * 7, 8 * 8), original.subarray(8 * 7, 8 * 8));
  for (const offset of [0, 1, 3, 5, 7]) assert.equal(result[24 + offset], original[24 + offset]);
  const key = decodeTravel(result).find(k => k.slot === 3)!;
  assert.equal(key.actuation, 1.2); assert.equal(key.press, 0.12); assert.equal(key.release, 0.22);
});
test('incomplete, unknown or empty configurations and invalid values fail closed', () => {
  assert.throws(() => decodeTravel(new Uint8Array(100)));
  assert.throws(() => decodeTravel(new Uint8Array(1024)));
  const bad = configuration(); bad[24] = 0xf0; assert.throws(() => decodeTravel(bad));
  for (const distance of [NaN, -1, 0.02, 4.02, 1.01]) assert.throws(() => updateTravel(configuration(), [3], { actuation: distance, press: 0.2, release: 0.2 }));
  assert.throws(() => updateTravel(configuration(), [125], { actuation: 1, press: 0.2, release: 0.2 }));
});
