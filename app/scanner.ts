export type Bar={date:string;open:number;high:number;low:number;close:number;volume:number;final:boolean};
export type Stock={symbol:string;name:string;cap:number;bars:Bar[]};
// All pattern construction uses only candles BEFORE the signal session.
export function evaluate(s:Stock){
 const bars=s.bars.filter(b=>b.final).sort((a,b)=>a.date.localeCompare(b.date));
 if(new Set(bars.map(b=>b.date)).size!==bars.length||bars.some(b=>![b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)||b.low<=0||b.volume<0||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)))return null;
 if(bars.length<21||!Number.isFinite(s.cap)||s.cap<=5e9)return null;
 const day=bars.at(-1)!;const prior=bars.slice(0,-1);const avg=prior.slice(-20).reduce((n,b)=>n+b.volume,0)/20;
 for(let n=Math.min(15,prior.length);n>=8;n--){
 const base=prior.slice(-n);const high=Math.max(...base.map(b=>b.high)),low=Math.min(...base.map(b=>b.low));const width=high-low;
 if(width<=0||width/((high+low)/2)>.18)continue;
 const mean=base.reduce((a,b)=>a+b.close,0)/n;const center=(n-1)/2;const slope=base.reduce((a,b,i)=>a+(i-center)*(b.close-mean),0)/base.reduce((a,_,i)=>a+(i-center)**2,0);
 if(Math.abs(slope)*(n-1)>width*.35)continue;
 const upper=base.flatMap((b,i)=>b.high>=high-width*.2?[i]:[]),lower=base.flatMap((b,i)=>b.low<=low+width*.25?[i]:[]);
 if(upper.length<2||lower.length<2||upper.at(-1)!-upper[0]<3||lower.at(-1)!-lower[0]<3)continue;
 const direction=day.close>high?'Breakout':day.close<low?'Breakdown':null;
 const level=direction==='Breakdown'?low:high;
 return {...s,bars,day,avg,ratio:avg>0?day.volume/avg:0,high,low,baseStart:base[0].date,baseEnd:base.at(-1)!.date,sessions:n,direction,level,distance:(day.close/level-1)*100,qualified:direction!==null&&avg>0&&day.volume>avg};
 }
 return null;
}
export function scan(stocks:Stock[]){return stocks.map(evaluate).filter((r):r is NonNullable<ReturnType<typeof evaluate>>=>r!==null&&r.qualified).sort((a,b)=>b.ratio-a.ratio);}
