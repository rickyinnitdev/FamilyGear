import {test} from 'node:test';import assert from 'node:assert/strict';import {pollingStats} from '../src/polling-stats';
test('movement rate measures sample timestamps including batched events',()=>{for(const rate of [125,500,1000]){const s=pollingStats(Array.from({length:rate+1},(_,i)=>i*1000/rate))!;assert.equal(s.hz,rate);assert.equal(s.medianMs,1000/rate);}});
test('empty, duplicate and invalid samples do not invent a rate',()=>{assert.equal(pollingStats([]),null);assert.equal(pollingStats([1,1,NaN]),null);assert.equal(pollingStats([4,2,2,0])!.hz,500);});
