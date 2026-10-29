/// 05 flashes and cells: feature validation and de-duplication, month grids, the REPD land mask, the cell layer data.
///
/// ok: a valid optical-flash Point inside the UK box with a finite time and a scalar id. co: collect the features of the
/// window, de-duplicated by id (or time and position), sorted by time; a.bad counts the rejected ones.
ok=f=>f&&f.type==='Feature'&&f.geometry&&f.geometry.type==='Point'&&(c=>AI(c)&&c.length<4&&bx(c[0],c[1]))(f.geometry.coordinates)&&f.properties&&FEED_SCHEMA.split('/')[1]===f.properties.observation_kind&&isFinite(tm(f))&&!(f.id&&typeof f.id=='object'),
co=(parts,ws,we)=>{///
    let m=new Map();///
    let k=0;///
    for(let part of parts)for(let f of part){///
      if(!ok(f)){k++;///
        continue}let t=tm(f);///
      if(t>=ws&&t<we)m.set(f.id==null?t+','+f.geometry.coordinates:JSON.stringify(f.id),f)///
    }let a=[...m.values()].sort((a,b)=>tm(a)-tm(b));///
    a.bad=k;///
    return a///
  },
/// Cells: month grids grid/YYYY-MM.json (0.1°, per UTC day); a day counts only if coverage, count and sha256 match its index
/// row. LR-security S1: 2 MB cap, checked on the raw bytes before parsing. The const below stays const: test-engine asserts
/// its text (build-M A5 KEEP).
gg=mo=>{if(!/^\d{4}-\d\d$/.test(mo))E('grid path');const u=AR+'grid/'+mo+'.json',h=lg(u);if(h)return h.p;
let p=gj(u,'no-cache',1).then(async b=>{///
        let o=b.byteLength>2e6?E('grid size'):b.byteLength>=0?await new Response(b).json():b;///
        if(!o||o.schema!==GS||o.month!==mo||o.cols!==140||o.rows!==120||o.cell_deg!==.1||!AI(o.days)||o.days.length>31||!AI(o.cells)||o.cells.length>16800)E('invalid grid '+mo);///
        let t=[];
for(let r of o.cells){///
          if(!AI(r)||r.length%2<1||r.length<3||r.length>63||r[0]>>>0!==r[0]||r[0]>=16800)E('grid cell');///
          for(let i=1;///
            i<r.length;///
            i+=2){///
            let d=r[i],n=r[i+1];///
            if(d>>>0!==d||d<1||d>31||n>>>0!==n||!n)E('grid count');///
            t[d]=(t[d]||0)+n///
          }///
        }
for(let d of o.days)if(!d||!AI(d.sha256)||(d.date+'').slice(0,8)!==mo+'-'||(t[+d.date.slice(8)]||0)!==(d.count||0))E('grid sum '+mo);///
        return o///
      }).catch(e=>{lru.delete(u);///
        throw e});///
    ls(u,{p});///
    return p///
  },
/// Land mask: cells whose centre is within 30 km of an onshore REPD site, as run lengths over the 140 x 120 grid; totals keep
/// every cell. L3 (LR-bugs LRB1) dropped the REPD placeholder 49.766807,-7.55716 (OSGB 0,0): 5,508 -> 5,472 cells. The
/// const in the loop below stays const (build-M A5 KEEP).
LM=()=>{///
    if(!LM.a){///
      let a=LM.a=new Uint8Array(16800);///
      let p=0,v=1;///
      for(const c of'M3bCjeCie83C7rC6sC6r4583Bmr1a28BmAg26BaAqB7AsB6AsB5AtB3AuB4AtB4AsB5AsAw81AqAvB0AvAzAxB0AwB1AvB3AuB3AuB8ArB6AtB4AvB0AwAzAuAyAwAzAxAyAyAxB0AvB0AuB1AmBaAmBbAkBe82A7Bh47A5BrA4Av4e5aA3Am71b7a6A3Alo4b4A4Ajr3c2A5Agv3c1A5Agw3AfAhz3AbAkA0161A3AnB9AoB5AsB1AxAyAzAwB1l2A8B2AtB9AnBbAkBdAiBdAjBcAjBdAiBfAgBiAdBnA6Bh44A5Bh81A6BgAgBgAhBgAhBiAgBjAdBib1A3B872AgB692AfB6ArB5AsB6ArBcAkBdAjB973AcB9b1A9BaA793BeA6BrA7BoAaBmf1vBnd5rBp9dlBs2hmCcmCghChfCghCfhCgfCidCl9Cr2L07ChhCdkCckCdjCehCkdCkdCkcClbClaCp4Tj'.match(/[A-Z]?./g))a.fill(v^=1,///
        p,p+=c[1]?(c.charCodeAt(0)-64)*36+parseInt(c[1],36):parseInt(c,36))///
    }return LM.a///
  },
/// gd: the cell layer data for the window's known days: n flashes in all cells, k drawn inside the mask, st days not yet in a
/// grid, e the refused month's reason (LR-bugs LRB3), T the glow floor = max(30, p95 of drawn cells). LRB2: if every grid day
/// is stale, fall back to the summary.
gd=async(rows,sn)=>{///
    let er,n=0,st=0,k=0;///
    let gs=new Map(await Promise.all([...new Set(rows.filter(y=>y.count>0).map(y=>y.date.slice(0,7)))].map(async m=>[m,await gg(m).catch(e=>(er=e,{days:[],cells:[]}))]))),ok=new Set,c=new Map,f=[],v=[];
for(let y of rows)if(y.count>0){///
      let d=gs.get(y.date.slice(0,7)).days.find(d=>d.date===y.date);///
      if(d&&d.count===y.count&&d.coverage===y.coverage&&d.sha256+''==(y.path?[y.sha256]:y.parts.map(p=>p.sha256))+'')ok.add(y.date),n+=y.count;///
      else st++///
    }if(!n)throw er||Error('grid stale');
for(let[m,g]of gs)for(let r of g.cells)for(let i=1;///
      i<r.length;///
      i+=2)if(ok.has(m+'-'+(r[i]+'').padStart(2,0)))c.set(r[0],(c.get(r[0])||0)+r[i+1]);
for(let[q,x]of c)if(LM()[q]){///
      let lon=-11+(q%140+.5)/10,lat=49.5+((q/140|0)+.5)/10;///
      k+=x;///
      v.push(x);///
      f.push({///
          type:'Feature',properties:{cell:q,n:x,lon,lat,s:sn},geometry:{type:'Point',coordinates:[lon,lat]}///
        })///
    }
v.sort((a,b)=>a-b);return{fc:FC(f),n,k,st,e:er&&msg(er),T:MX(30,v[v.length*.95|0]||0)}},
