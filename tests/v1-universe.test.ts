import assert from 'node:assert/strict';
import {stocks} from '../app/data.ts';
import {scan} from '../app/scanner.ts';
import members from '../public/liquidity-universe.json' with {type:'json'};
import baseline from './v1-baseline.json' with {type:'json'};
import type {Stock} from '../app/scanner';
assert.equal(stocks.length,500);
assert.deepEqual(stocks.map(s=>s.symbol),members.members.map(s=>s.symbol));
assert.deepEqual(stocks.map(s=>s.cap),members.members.map(s=>s.cap));
assert.ok(stocks.every(s=>s.bars.length>=21&&s.bars.length<=47&&s.bars.at(-1)?.date==='2026-09-04'));
const previous=scan(baseline as Stock[]),current=scan(stocks);
for(const old of previous){const r=current.find(s=>s.symbol===old.symbol);assert.ok(r,old.symbol);assert.deepEqual([r.direction,r.level,r.ratio,r.high,r.low,r.baseStart],[old.direction,old.level,old.ratio,old.high,old.low,old.baseStart]);}
assert.equal(current.length,14);
console.log('Shared-universe checks passed: all 500 symbols/caps match version 2; original five signals retain their levels and ratios.');
