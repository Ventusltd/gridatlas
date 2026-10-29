/// 15 install: after the menu bar, Pipeline News and the map exist; the public NS.ukLightning surface.
///
/// ins: install after the menu bar, Pipeline News and the map exist; appended last to the Layers panel and the fullscreen
/// curtain. Polled every 250 ms and on DOM mutations until it succeeds.
ins=()=>{if(S.installed)return true;
let M=NS.menuBar,P=window.__GRIDATLAS_PIPELINE_LAYERS__,host=Q('scada-ui-container'),miss=[];
if(!(M&&M.installed===true))miss.push('menuBar');///
    if(!(P&&P.installed))miss.push('pipelineLayers');///
    if(!mh())miss.push('map');///
    if(!host||!host.querySelector('.key-group'))miss.push('groups');///
    S.waiting_for=miss;///
    if(miss.length)return false;
let main=bg('main');ap(host,main.group);bt(host);S.sfs.push(main);
let cur=Q('fs-curtain-keys');if(cur){let fs=bg('fs');ap(cur,fs.group);bt(cur);S.sfs.push(fs)}
S.installed=true;///
    pt(!S.res);///
    for(let e of['resize','orientationchange','click','transitionend'])addEventListener(e,fit);///
    return true///
  };
if(typeof setInterval==='function'&&typeof MutationObserver==='function'){///
    let ob=new MutationObserver(()=>tick()),poll=setInterval(()=>tick(),250),
tick=()=>{///
      try{if(ins()){clearInterval(poll);///
          ob.disconnect()}}catch(e){note('install: '+msg(e))}///
    };///
    ob.observe(document.documentElement,{childList:true,subtree:true})///
  }
/// The public surface: schema, generation, state, install, setOn, load, windowFor.
NS.ukLightning=Object.freeze({///
      schema:S.schema,generation:GEN,state:S,install:ins,setOn:so,load:()=>ld(true),windowFor:wf///
    });
})();
