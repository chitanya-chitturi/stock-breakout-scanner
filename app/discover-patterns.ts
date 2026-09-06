import type {Stock} from './scanner';
import {validatePattern,validBars,type Proposal,type PatternResult} from './patterns.ts';
/** Deterministic discovery. All pivot searches stop two candles before the signal. */
export function discoverPatterns(stock:Stock):PatternResult[]{
 if(!validBars(stock.bars))return [];
 const b=stock.bars,end=b.length-2,first=Math.max(2,end-60);
 const pivots=(side:'high'|'low')=>b.flatMap((bar,i)=>i>=first&&i<=end-2&&(side==='high'?bar.high>=Math.max(...b.slice(i-2,i+3).map(x=>x.high)):bar.low<=Math.min(...b.slice(i-2,i+3).map(x=>x.low)))?[i]:[]);
 const highs=pivots('high'),lows=pivots('low'),results=new Map<string,PatternResult>();
 function consider(p:Proposal){const r=validatePattern(stock,p);if(r.status==='Confirmed'&&!results.has(r.pattern))results.set(r.pattern,r);}
 const base=(start:number):Proposal=>({pattern:'Bull flag',start:b[start].date,end:b[end].date,upper:[],lower:[],turns:[],poleStart:null,poleEnd:null,explanation:'Detected from established price pivots; no AI used.'});
 // Search all recent channel lengths; retain all extrema in each window rather than cherry-picking pairs.
 for(let length=Math.min(45,end-first+1);length>=8;length--){
  const start=end-length+1,upper=highs.filter(i=>i>=start),lower=lows.filter(i=>i>=start);
  if(upper.length<2||lower.length<2)continue;
  const p={...base(start),upper:upper.map(i=>b[i].date),lower:lower.map(i=>b[i].date)};
  for(const pattern of ['Rising wedge','Falling wedge'] as const)consider({...p,pattern});
  if(length>31)continue;
  for(const pattern of ['Bull flag','Bear flag'] as const){
   // The pole must terminate at, or within three sessions before, the channel.
   for(let pe=start;pe>=Math.max(1,start-3);pe--){
    const choices=Array.from({length:Math.min(20,pe)},(_,i)=>pe-i-1).sort((a,z)=>pattern==='Bull flag'?b[a].close-b[z].close:b[z].close-b[a].close);
    for(const ps of choices){consider({...p,pattern,poleStart:b[ps].date,poleEnd:b[pe].date});if(results.has(pattern))break;}
    if(results.has(pattern))break;
   }
  }
 }
 // Consecutive major extrema: each pair of shoulders/head encloses an intervening neck pivot.
 for(const inverse of [false,true]){
  const peaks=inverse?lows:highs,necks=inverse?highs:lows;
  for(let j=0;j<peaks.length-2;j++){
   const [left,head,right]=peaks.slice(j,j+3);if(right-left<12||end-right>12)continue;
   const between=(a:number,z:number)=>necks.filter(i=>i>=a+3&&i<=z-3).sort((a,z)=>inverse?b[z].high-b[a].high:b[a].low-b[z].low)[0];
   const n1=between(left,head),n2=between(head,right);if(n1===undefined||n2===undefined)continue;
   consider({...base(Math.max(2,left-2)),pattern:inverse?'Inverse head and shoulders':'Head and shoulders',turns:[left,n1,head,n2,right].map(i=>b[i].date)});
  }
 }
 return [...results.values()].sort((a,z)=>a.pattern.localeCompare(z.pattern));
}
