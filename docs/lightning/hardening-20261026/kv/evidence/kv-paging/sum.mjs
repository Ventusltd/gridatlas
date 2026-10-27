import {readFileSync} from 'node:fs';
const o=JSON.parse(readFileSync(process.argv[2]));console.log('##',o.clock,o.commit,'errors',o.errors,'req',o.requests);
const row=x=>x.blocked?`  ${x.tag}: blocked`:`  ${x.tag.padEnd(14)} ${x.window} | ${x.label} | drawn ${x.drawn} truth ${x.truth.exact} (days ${x.truth.wholeDays}; srch ${x.truth.searched}/${x.truth.dates}${x.truth.allBefore?' ALLBEFORE':''}) | ${x.state} | out ${x.out} | P${x.prev} N${x.next} L${x.latest} fit ${x.fit}${x.outAfterFit!==undefined?' outAfterFit '+x.outAfterFit:''}\n     F: ${x.caps.flashes}\n     S: ${x.caps.searched}\n     W: ${x.caps.warning}\n     st: ${x.status}`;
for(const p in o.periods){console.log('#',p);for(const x of o.periods[p])console.log(row(x))}
console.log('# cross');for(const x of o.crossPeriod)console.log(row(x),' stack',x.stack);
console.log('# custom');for(const x of o.custom)console.log(row(x),'\n     Win:',x.caps.window);
