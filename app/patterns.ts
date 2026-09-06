import type {Strength} from './strength';
import type {Bar, Stock} from './scanner';
export const patternNames=['Bull flag','Bear flag','Rising wedge','Falling wedge','Head and shoulders','Inverse head and shoulders'] as const;
export type PatternName=typeof patternNames[number];
export type Proposal={pattern:PatternName;start:string;end:string;upper:string[];lower:string[];turns:string[];poleStart:string|null;poleEnd:string|null;explanation:string};
export type PatternResult={symbol:string;strength?:Strength|null;averageDollarVolume?:number;liquidityRank?:number;chart?:string;pattern:PatternName;status:'Confirmed'|'Rejected';reason:string;proposal:Proposal;date:string;direction:'Breakout'|'Breakdown';level:number|null;close:number;relativeVolume:number;cap:number;line:{date:string;price:number}[]};
export type PatternReport={liquidity?:{rankingStart:string;rankingEnd:string;generatedAt:string;candidates:number;rankable:number;exclusions:number;cutoff:number}|null;universeLabel?:string;engine?:string;status:string;generatedAt:string|null;session:string|null;model:string|null;requested:number;reviewed:number;errors:{symbol:string;reason:string}[];results:PatternResult[];charts:Record<string,string>;source:string};
const finite=(b:Bar)=>[b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)&&b.low>0&&b.volume>=0&&b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close);
export function validBars(bars:Bar[]){return bars.length>=60&&bars.every(finite)&&bars.every((b,i)=>i===0||bars[i-1].date<b.date)&&bars.every(b=>b.final);}
export function validatePattern(stock:Stock,p:Proposal):PatternResult{
 const b=stock.bars,day=b.at(-1)!;const direction=['Bull flag','Falling wedge','Inverse head and shoulders'].includes(p.pattern)?'Breakout':'Breakdown';
 const avg=b.slice(-21,-1).reduce((a,x)=>a+x.volume,0)/20;
 const out:PatternResult={symbol:stock.symbol,pattern:p.pattern,status:'Rejected',reason:'',proposal:p,date:day?.date??'',direction,level:null,close:day?.close??0,relativeVolume:avg>0?day.volume/avg:0,cap:stock.cap,line:[]};
 const reject=(reason:string)=>({...out,reason});
 if(!validBars(b))return reject('Invalid, incomplete, or insufficient history (60 sessions required).');
 if(!patternNames.includes(p.pattern))return reject('Unsupported pattern.');
 const idx=(d:string)=>b.findIndex(x=>x.date===d);const start=idx(p.start),end=idx(p.end),last=b.length-1;
 if(start<0||end<start+5||end!==last-1)return reject('Pattern must span at least six sessions and end before the signal candle.');
 const atr=b.slice(Math.max(0,start-14),end+1).reduce((n,x)=>n+x.high-x.low,0)/(end+1-Math.max(0,start-14));
 const tol=Math.max(atr*.6,b[end].close*.002);
 const anchors=(dates:string[],side:'high'|'low')=>{
  if(!Array.isArray(dates)||dates.length<2||new Set(dates).size!==dates.length)return null;
  const ids=dates.map(idx);if(ids.some((i,k)=>i<start||i>end-2||(k>0&&i<=ids[k-1]))||ids.at(-1)!-ids[0]<3)return null;
  if(ids.some(i=>side==='high'?b[i].high<Math.max(...b.slice(Math.max(0,i-2),i+3).map(x=>x.high)):b[i].low>Math.min(...b.slice(Math.max(0,i-2),i+3).map(x=>x.low))))return null;
  const mx=ids.reduce((a,i)=>a+i,0)/ids.length,my=ids.reduce((a,i)=>a+b[i][side],0)/ids.length;
  const m=ids.reduce((a,i)=>a+(i-mx)*(b[i][side]-my),0)/ids.reduce((a,i)=>a+(i-mx)**2,0);const at=(i:number)=>my+m*(i-mx);
  if(ids.some(i=>Math.abs(b[i][side]-at(i))>tol))return null;
  return {m,at};
 };
 let boundary:((i:number)=>number)|null=null;
 if(p.pattern.includes('shoulders')){
  const inverse=p.pattern==='Inverse head and shoulders',side=inverse?'low':'high';
  if(!Array.isArray(p.turns)||p.turns.length!==5)return reject('Head and shoulders requires five alternating turning points.');
  const t=p.turns.map(idx);
  if(t.some((i,k)=>i<start||i>end-2||(k>0&&i-t[k-1]<3)))return reject('Turning points must be ordered, separated and established before the close.');
  if(t.some((i,k)=>{const high=(k%2===0)!==inverse;return high?b[i].high<Math.max(...b.slice(i-2,i+3).map(x=>x.high)):b[i].low>Math.min(...b.slice(i-2,i+3).map(x=>x.low));}))return reject('Turning points are not local price pivots.');
  const l=b[t[0]][side],h=b[t[2]][side],r=b[t[4]][side];
  const height=inverse?Math.min(l,r)-h:h-Math.max(l,r);
  if(height<atr||Math.abs(l-r)>Math.max(atr,Math.abs(h-(l+r)/2)*.5))return reject('Head prominence or shoulder symmetry failed.');
  const neckSide=inverse?'high':'low';const a=b[t[1]][neckSide],z=b[t[3]][neckSide];
  boundary=i=>a+(z-a)*(i-t[1])/(t[3]-t[1]);
  const lead=b[Math.max(0,t[0]-10)].close;
  if(inverse?lead-l<atr:l-lead<atr)return reject('Missing trend into the reversal pattern.');
  for(let i=t[4];i<=end;i++)if(inverse?b[i].close>boundary(i):b[i].close<boundary(i))return reject('Neckline was already crossed before this session.');
 }else{
  const u=anchors(p.upper,'high'),l=anchors(p.lower,'low');
  if(!u||!l)return reject('Need two established local pivots on each boundary, fitted within tolerance.');
  const w0=u.at(start)-l.at(start),w1=u.at(end)-l.at(end);
  if(w0<=atr||w1<=0)return reject('Pattern boundaries cross or have insufficient width.');
  for(let i=start;i<=end;i++)if(b[i].high>u.at(i)+tol||b[i].low<l.at(i)-tol)return reject('Price does not fit the proposed boundaries.');
  if(p.pattern.includes('wedge')){
   const rising=p.pattern==='Rising wedge';
   if(w1/w0>.8||w1/w0<.1||(rising?u.m<=0||l.m<=u.m:l.m>=0||u.m>=l.m))return reject('Wedge must slope together and converge by at least 20%.');
  }else{
   const bull=p.pattern==='Bull flag';
   if(Math.abs(u.m-l.m)*(end-start)>w0*.35||(bull?u.m>tol/(end-start)||l.m>tol/(end-start):u.m< -tol/(end-start)||l.m< -tol/(end-start)))return reject('Flag must form a roughly parallel, flat or countertrend channel.');
   const ps=p.poleStart?idx(p.poleStart):-1,pe=p.poleEnd?idx(p.poleEnd):-1;
   if(ps<0||pe<=ps||pe-ps>20||pe>start||start-pe>3)return reject('Flag requires a preceding pole of 1–20 sessions.');
   const move=b[pe].close-b[ps].close,pole=Math.abs(move);
   const retrace=bull?b[pe].close-Math.min(...b.slice(start,end+1).map(x=>x.low)):Math.max(...b.slice(start,end+1).map(x=>x.high))-b[pe].close;
   if((bull?move<=0:move>=0)||pole<3*atr||pole/b[ps].close<.05||retrace>pole*.5||end-start>30)return reject('Flag pole strength, duration or maximum 50% retracement failed.');
  }
  boundary=direction==='Breakout'?u.at:l.at;
  for(let i=start;i<=end;i++)if(direction==='Breakout'?b[i].close>boundary(i):b[i].close<boundary(i))return reject('Boundary was already crossed before this session.');
 }
 out.level=boundary(last);out.line=[{date:b[start].date,price:boundary(start)},{date:day.date,price:out.level}];
 if(!Number.isFinite(out.level)||out.level<=0)return reject('Invalid projected boundary.');
 if(!Number.isFinite(stock.cap)||stock.cap<=5e9)return reject('Market cap must exceed $5B.');
 if(direction==='Breakout'?day.close<=out.level:day.close>=out.level)return reject('Latest completed close has not crossed the pattern boundary.');
 if(avg<=0||day.volume<=avg)return reject('Signal volume does not exceed the previous 20-session average.');
 return {...out,status:'Confirmed',reason:'Pattern geometry, completed close, market cap and volume checks passed.'};
}
