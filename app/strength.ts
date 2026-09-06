import type {Stock} from './scanner';
import type {PatternResult} from './patterns';
export type Strength={label:'Strong'|'Moderate'|'Weak';score:number;volumeRatio:number;breakInRanges:number;breakPercent:number;closePosition:number;averageTrueRange:number;reasons:string[];rubric:'break-strength-v1'};
/** Heuristic evidence score, not probability of a successful trade. Baseline excludes signal day. */
export function scoreStrength(stock:Stock,r:PatternResult):Strength|null{
 const b=stock.bars,day=b.at(-1),prior=b.slice(0,-1);
 if(r.status!=='Confirmed'||r.level===null||!Number.isFinite(r.level)||r.level<=0||!day||day.date!==r.date||day.close!==r.close||b.length<22||b.some((x,i)=>!x.final||![x.high,x.low,x.close,x.volume].every(Number.isFinite)||x.low<=0||x.high<x.close||x.low>x.close||x.volume<0||(i>0&&x.date<=b[i-1].date)))return null;
 const avgVolume=prior.slice(-20).reduce((n,x)=>n+x.volume,0)/20;
 const tr=prior.slice(-14).map((x,j)=>{const previous=b[prior.length-14+j-1].close;return Math.max(x.high-x.low,Math.abs(x.high-previous),Math.abs(x.low-previous));});
 const averageTrueRange=tr.reduce((a,x)=>a+x,0)/14;
 const distance=r.direction==='Breakout'?day.close-r.level:r.level-day.close;
 if(avgVolume<=0||averageTrueRange<=0||distance<=0||day.volume<=avgVolume||day.high<=day.low)return null;
 const volumeRatio=day.volume/avgVolume,breakInRanges=distance/averageTrueRange,breakPercent=distance/r.level*100;
 const closePosition=r.direction==='Breakout'?(day.close-day.low)/(day.high-day.low):(day.high-day.close)/(day.high-day.low);
 const volumePoints=volumeRatio>=2?40:volumeRatio>=1.5?30:volumeRatio>=1.1?15:5;
 const distancePoints=breakInRanges>=.75?40:breakInRanges>=.3?30:breakInRanges>=.1?15:5;
 const closePoints=closePosition>=.8?20:closePosition>=.65?15:closePosition>=.5?10:0;
 const score=volumePoints+distancePoints+closePoints;
 const weak=volumeRatio<1.1||breakInRanges<.1||closePosition<.5;
 const label=weak?'Weak':score>=70&&volumeRatio>=1.5&&breakInRanges>=.3&&closePosition>=.65?'Strong':'Moderate';
 const reasons=[`${volumeRatio.toFixed(2)}× volume: ${volumeRatio>=1.5?'substantial participation':volumeRatio>=1.1?'above average, below the strong threshold':'only marginally above average'}.`,`${breakInRanges.toFixed(2)}× average true range beyond the boundary: ${breakInRanges>=.3?'decisive distance':breakInRanges>=.1?'modest distance':'a marginal break'}.`,`${(closePosition*100).toFixed(0)}% directional close position: ${closePosition>=.65?'closed toward the breakout side':closePosition>=.5?'closed around mid-range':'faded into the opposite half of the candle'}.`];
 return {label,score,volumeRatio,breakInRanges,breakPercent,closePosition,averageTrueRange,reasons,rubric:'break-strength-v1'};
}
export function rankStrength(a:PatternResult,b:PatternResult){const rank={Strong:3,Moderate:2,Weak:1};return (b.strength?rank[b.strength.label]:0)-(a.strength?rank[a.strength.label]:0)||(b.strength?.score??-1)-(a.strength?.score??-1)||b.relativeVolume-a.relativeVolume||a.symbol.localeCompare(b.symbol)||a.pattern.localeCompare(b.pattern);}
