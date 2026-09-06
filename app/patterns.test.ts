import assert from 'node:assert/strict';
import {discoverPatterns} from './discover-patterns.ts';
import {validatePattern,validBars,type Proposal} from './patterns.ts';
import type {Stock} from './scanner.ts';
const date=(i:number)=>new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10);
function flag(bull=true){
 const bars=Array.from({length:71},(_,i)=>{let c=i<40?80:i<50?80+(i-40)*2:100-(i-50)*.1;const peak=[52,58,64].includes(i),trough=[55,61,67].includes(i);return {date:date(i),open:c,close:c,high:c+(peak?2:1),low:c-(trough?2:1),volume:100,final:true};});
 Object.assign(bars[70],{open:100,close:102,high:103,low:99,volume:200});
 if(!bull)bars.forEach(b=>{const {open,close,high,low}=b;Object.assign(b,{open:200-open,close:200-close,high:200-low,low:200-high});});
 const s:Stock={symbol:'TEST',name:'Synthetic',cap:6e9,bars};const p:Proposal={pattern:bull?'Bull flag':'Bear flag',start:date(50),end:date(69),upper:[52,58,64].map(date),lower:[55,61,67].map(date),turns:[],poleStart:date(40),poleEnd:date(50),explanation:'Synthetic fixture'};
 if(!bull)[p.upper,p.lower]=[p.lower,p.upper];return {s,p};
}
for(const bull of [true,false]){const {s,p}=flag(bull);const r=validatePattern(s,p);assert.equal(r.status,'Confirmed',r.reason);assert.equal(r.direction,bull?'Breakout':'Breakdown');assert.ok(discoverPatterns(s).some(x=>x.pattern===p.pattern),p.pattern+' discovery');}
let {s,p}=flag();s.cap=5e9;assert.equal(validatePattern(s,p).status,'Rejected');
({s,p}=flag());s.bars.at(-1)!.volume=100;assert.equal(validatePattern(s,p).status,'Rejected');
({s,p}=flag());s.bars.at(-1)!.final=false;assert.equal(validatePattern(s,p).status,'Rejected');
({s,p}=flag());p.upper=[date(64),date(70)];assert.equal(validatePattern(s,p).status,'Rejected');
({s,p}=flag());p.poleStart=null;assert.equal(validatePattern(s,p).status,'Rejected');
({s,p}=flag());p.start='2099-01-01';assert.equal(validatePattern(s,p).status,'Rejected');
({s,p}=flag());s.bars.at(-1)!.close=validatePattern(s,p).level!;assert.equal(validatePattern(s,p).status,'Rejected');
({s,p}=flag());s.bars[60].close=110;s.bars[60].high=111;assert.equal(validatePattern(s,p).status,'Rejected');
({s,p}=flag());s.bars[1].date=s.bars[0].date;assert.equal(validBars(s.bars),false);
({s,p}=flag());s.bars[1].volume=NaN;assert.equal(validBars(s.bars),false);
console.log('12 pattern checks passed. Synthetic fixtures validate rules, not real-market accuracy.');
for(const falling of [true,false]){
 const {s,p}=flag();p.pattern=falling?'Falling wedge':'Rising wedge';p.poleStart=null;p.poleEnd=null;
 for(let i=50;i<70;i++){const k=i-50,u=104-.3*k,l=96-.1*k,c=(u+l)/2;Object.assign(s.bars[i],{open:c,close:c,high:u-([52,58,64].includes(i)?0:.8),low:l+([55,61,67].includes(i)?0:.8)});}
 if(!falling){s.bars.forEach(b=>{const {open,close,high,low}=b;Object.assign(b,{open:200-open,close:200-close,high:200-low,low:200-high});});[p.upper,p.lower]=[p.lower,p.upper];}
 const r=validatePattern(s,p);assert.equal(r.status,'Confirmed',r.reason);assert.ok(discoverPatterns(s).some(x=>x.pattern===p.pattern),p.pattern+' discovery');
 p.pattern=falling?'Rising wedge':'Falling wedge';assert.equal(validatePattern(s,p).status,'Rejected');
}
for(const inverse of [false,true]){
 const {s,p}=flag();p.pattern=inverse?'Inverse head and shoulders':'Head and shoulders';p.turns=[50,54,58,62,66].map(date);p.upper=[];p.lower=[];p.start=date(48);
 const points=[[46,103],[50,110],[54,101],[58,117],[62,101],[66,110],[69,104],[70,98]];
 for(let i=46;i<=70;i++){let j=points.findIndex(a=>a[0]>=i);if(j===0)j=1;const a=points[j-1],z=points[j],c=a[1]+(z[1]-a[1])*(i-a[0])/(z[0]-a[0]);Object.assign(s.bars[i],{open:c,close:c,high:c+1,low:c-1});}
 if(inverse)s.bars.forEach(b=>{const {open,close,high,low}=b;Object.assign(b,{open:250-open,close:250-close,high:250-low,low:250-high});});
 const r=validatePattern(s,p);assert.equal(r.status,'Confirmed',r.reason);assert.ok(discoverPatterns(s).some(x=>x.pattern===p.pattern),p.pattern+' discovery');
 p.turns=[50,54,58,62,70].map(date);assert.equal(validatePattern(s,p).status,'Rejected');
}
console.log('8 additional wedge and head-and-shoulders checks passed (both directions).');

{const {s}=flag();s.bars.forEach(b=>Object.assign(b,{open:100,close:100,high:101,low:99}));assert.deepEqual(discoverPatterns(s),[]);}
console.log('Discovery checks passed for all six patterns and a flat negative control.');
