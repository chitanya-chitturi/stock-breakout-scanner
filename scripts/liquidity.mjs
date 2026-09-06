import fs from 'node:fs/promises';
import path from 'node:path';
export function eligibleEquity(row){
 const cap=Number(String(row.marketCap||'').replaceAll(',',''));
 return Number.isFinite(cap)&&cap>5e9&&!/preferred|preference|warrants?|\bunits?\b|\brights?\b|\bETF\b|\bETN\b|\bfund\b|\bnotes\b|debentures/i.test(row.name)&&/^[A-Z][A-Z./-]*$/.test(row.symbol);
}
export function averageDollarVolume(bars,sessions){
 const lookup=new Map(bars.map(b=>[b.date,b]));
 if(sessions.length!==20||new Set(bars.map(b=>b.date)).size!==bars.length)return null;
 const sample=sessions.map(d=>lookup.get(d));
 if(sample.some(b=>!b||!Number.isFinite(b.close)||!Number.isFinite(b.volume)||b.close<=0||b.volume<=0))return null;
 return sample.reduce((n,b)=>n+b.close*b.volume,0)/20;
}
export async function prepareLiquidity(root,asOf,headers,refresh=false){
 const cache=path.join(root,'work/liquidity');await fs.mkdir(cache,{recursive:true});
 async function get(url,h=headers){for(let attempt=0;attempt<3;attempt++){const r=await fetch(url,{headers:h,signal:AbortSignal.timeout(60000)});if(r.ok)return r.json();if(r.status===429||r.status>=500){await new Promise(r=>setTimeout(r,1500*(attempt+1)));continue;}throw Error(`Data request failed: ${new URL(url).hostname} HTTP ${r.status}`);}throw Error('Data request failed after retries');}
 const start=new Date(asOf+'T00:00:00Z');start.setUTCMonth(start.getUTCMonth()-6);
 const calendar=await get(`https://paper-api.alpaca.markets/v2/calendar?start=${start.toISOString().slice(0,10)}&end=${asOf}`);
 const now=new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'});
 const completed=calendar.filter(d=>`${d.date} ${d.close}:00`<now).map(d=>d.date).sort();const session=completed.at(-1);
 if(completed.length<61)throw Error('Insufficient exchange calendar history.');
 const rankingSessions=completed.slice(-21,-1); // Never use the signal day's price or volume to select the universe.
 const monday=new Date(asOf+'T00:00:00Z');monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);const week=monday.toISOString().slice(0,10);
 let previous;try{previous=JSON.parse(await fs.readFile(path.join(cache,'membership.json'),'utf8'));}catch{}
 const reuse=!refresh&&previous?.week===week&&previous?.rankingEnd<session;
 if(reuse){try{const data=JSON.parse(await fs.readFile(path.join(cache,'prepared.json'),'utf8'));if(data.session===session&&data.membershipGeneratedAt===previous.generatedAt){console.log('Reusing same-session liquidity data.');return data;}}catch{}}
 let candidates,sourceCount,excludedTypes,missingAssets=[];
 if(reuse){candidates=previous.members;sourceCount=previous.sourceCount;excludedTypes=previous.excludedTypes;}
 else{
  const raw=await get('https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&download=true',{'User-Agent':'Mozilla/5.0','Accept':'application/json'});
  const rows=raw.data?.rows;if(!Array.isArray(rows)||rows.length<1000)throw Error('Incomplete Nasdaq universe response.');
  sourceCount=rows.length;excludedTypes=rows.filter(r=>Number(r.marketCap)>5e9&&!eligibleEquity(r)).length;
  const assets=await get('https://paper-api.alpaca.markets/v2/assets?status=active&asset_class=us_equity');
  const available=new Set(assets.filter(a=>['NYSE','NASDAQ','AMEX','ARCA','BATS'].includes(a.exchange)&&a.tradable).map(a=>a.symbol));
  candidates=rows.filter(eligibleEquity).map(r=>({symbol:r.symbol.replaceAll('/','.'),name:r.name,cap:Number(r.marketCap),bars:[]}));
  missingAssets=candidates.filter(s=>!available.has(s.symbol)).map(s=>({symbol:s.symbol,reason:'Not an active supported exchange-listed Alpaca equity.'}));
  candidates=candidates.filter(s=>available.has(s.symbol));
  if(new Set(candidates.map(s=>s.symbol)).size!==candidates.length)throw Error('Duplicate symbols in universe.');
  console.log(`Liquidity source: ${sourceCount} listings; ${candidates.length} supported equities above $5B.`);
 }
 const bars={},end=new Date(Date.parse(session+'T00:00:00Z')+86400000).toISOString();
 // Batch historical requests rather than making two provider calls for every symbol.
 for(let offset=0;offset<candidates.length;offset+=100){let token=null,pages=0;const symbols=candidates.slice(offset,offset+100).map(s=>s.symbol).join(',');
 do{const u=new URL('https://data.alpaca.markets/v2/stocks/bars');Object.entries({symbols,timeframe:'1Day',start:start.toISOString(),end,feed:'sip',adjustment:'split',limit:'10000',...(token?{page_token:token}:{})}).forEach(([k,v])=>u.searchParams.set(k,v));const j=await get(u);for(const [s,rows] of Object.entries(j.bars||{}))bars[s]=[...(bars[s]||[]),...rows];token=j.next_page_token;if(++pages>10)throw Error('Pagination bound exceeded');await new Promise(r=>setTimeout(r,350));}while(token);
 console.log(`Liquidity bars loaded: ${Math.min(offset+100,candidates.length)}/${candidates.length}`);
 }
 const dates=new Set(completed),loaded=candidates.map(s=>({...s,bars:(bars[s.symbol]||[]).map(b=>({date:b.t.slice(0,10),open:b.o,high:b.h,low:b.l,close:b.c,volume:b.v,final:true})).filter(b=>dates.has(b.date)).sort((a,z)=>a.date.localeCompare(z.date))}));
 let membership=previous;
 if(!reuse){const ranked=[],exclusions=[...missingAssets];for(const s of loaded){const adv=averageDollarVolume(s.bars,rankingSessions);if(adv===null){exclusions.push({symbol:s.symbol,reason:'Missing or invalid bars in the 20-session liquidity window.'});continue;}ranked.push({...s,averageDollarVolume:adv});}
 ranked.sort((a,z)=>z.averageDollarVolume-a.averageDollarVolume||a.symbol.localeCompare(z.symbol));if(ranked.length<500)throw Error(`Only ${ranked.length} stocks have valid liquidity history; refusing to label this a top-500 scan.`);
 membership={week,generatedAt:new Date().toISOString(),source:'Nasdaq US-listed equities screener; active Alpaca exchange-listed assets; ADRs included',sourceCount,excludedTypes,candidates:candidates.length,rankable:ranked.length,rankingStart:rankingSessions[0],rankingEnd:rankingSessions.at(-1),exclusions,members:ranked.slice(0,500).map(({bars,...s},i)=>({...s,liquidityRank:i+1}))};
 await fs.writeFile(path.join(cache,'membership.json'),JSON.stringify(membership));
 }
 const bySymbol=new Map(loaded.map(s=>[s.symbol,s]));const stocks=membership.members.map(s=>({...s,bars:bySymbol.get(s.symbol)?.bars||[]}));
 const data={session,membershipGeneratedAt:membership.generatedAt,stocks,liquidity:{...membership,members:membership.members}};
 await fs.writeFile(path.join(cache,'prepared.json'),JSON.stringify(data));
 await fs.writeFile(path.join(root,'public/liquidity-universe.json'),JSON.stringify(membership,null,2));
 const columns=['liquidityRank','symbol','name','cap','averageDollarVolume'];await fs.writeFile(path.join(root,'public/liquidity-universe.csv'),columns.join(',')+'\n'+membership.members.map(s=>columns.map(k=>'"'+String(s[k]).replaceAll('"','""')+'"').join(',')).join('\n'));
 console.log(`Selected 500; lowest average daily dollar volume: $${membership.members.at(-1).averageDollarVolume.toFixed(0)}`);return data;
}
