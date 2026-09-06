import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {scoreStrength,rankStrength} from '../app/strength.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const report=JSON.parse(await fs.readFile(path.join(root,'public/pattern-results.json'),'utf8'));
for(const result of report.results){const stock=JSON.parse(await fs.readFile(path.join(root,'work/pattern-cache',result.symbol+'-bars.json'),'utf8'));result.strength=scoreStrength(stock,result);if(result.status==='Confirmed'&&!result.strength)throw Error('Unable to score '+result.symbol+'; report unchanged.');}
report.results.sort(rankStrength);
await fs.writeFile(path.join(root,'public/pattern-results.json'),JSON.stringify(report,null,2));
console.log(report.results.map(r=>`${r.symbol}: ${r.pattern}: ${r.strength?.label} ${r.strength?.score}/100`).join('\n'));
