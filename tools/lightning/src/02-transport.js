/// 02 transport: fetch for .json (no redirects, 15 s timeout that also covers the body), XMLHttpRequest for the live feed,
/// and the LRU of day/grid promises.
///
note=m=>S.errors.push(String(m)),
/// gj: fetch JSON (or bytes with raw) with the 15 s timeout covering the body; a redirect is refused; "HTTP n" on error.
/// M2 (build-M2 gj-abort): once its own timer has aborted, any rejection (a body stream that errors on abort, as the
/// bridge's may) is reported as the timeout, not as "Failed to fetch".
gj=(u,cache,raw)=>{let c=new AbortController(),t=setTimeout(()=>c.abort(),TMO);S.requests++;
return fetch(u,{cache,signal:c.signal}).then(r=>{///
        if(!r.ok||r.redirected)throw new Error(r.ok?'redirected':'HTTP '+r.status);///
        return raw&&r.arrayBuffer?r.arrayBuffer():r.json()///
      }).catch(e=>{///
        throw c.signal.aborted||e&&e.name==='AbortError'?new Error(TOE):e///
      }).finally(()=>clearTimeout(t))///
  },
/// gx: the live feed by XMLHttpRequest (same timeout; a redirect is refused through responseURL).
gx=u=>{S.requests++;return new Promise((res,rej)=>{let x=new XMLHttpRequest();x.open('GET',u);x.timeout=TMO;
x.onload=()=>{///
          if(x.status>=200&&x.status<300){///
            try{///
              if(x.responseURL&&!x.responseURL.startsWith(u))E('redirected');///
              res(JSON.parse(x.responseText))///
            }catch(e){rej(e)}///
          }else rej(new Error('HTTP '+x.status))///
        };
x.onerror=()=>rej(new Error('network error'));x.ontimeout=()=>rej(new Error(TOE));x.send()})},
/// lg/ls: LRU get and set, at most RQ entries.
lg=k=>{///
    if(!lru.has(k))return;///
    let v=lru.get(k);///
    lru.delete(k);///
    lru.set(k,v);///
    return v///
  },///
  ls=(k,v)=>{///
    lru.delete(k);///
    lru.set(k,v);///
    while(lru.size>RQ)lru.delete(lru.keys().next().value)///
  },
