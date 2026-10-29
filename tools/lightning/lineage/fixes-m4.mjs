// fixes-m4.mjs: review fixes folded into M4 (called by build-M4.mjs with its exact-once `once`).
export function fixes(once) {
  // M2R-camera MAJOR-2 (fix C, landscape / short map): with a map under 500 px tall and at least 300 px beside the card,
  // the card docks to the right edge (c.sd) and the camera frames the free area to its left (right padding = card width
  // + 32, top 60, bottom 100). Portrait and desktop are unchanged (M3 already carries L = M2R-layout F1-F3, i.e. MAJOR-1's
  // screen-pixel visibility test and the forced re-frame on toggle).
  once('cam-c-cpos', 'w=MN(480,k.width-16),L=k.left+(k.width-w)/2,h=c.offsetHeight||0;let b=8;',
    "w=MN(480,k.width-16),sd=c.sd=k.height<500&&k.width-w>=300,L=sd?k.right-8-w:k.left+(k.width-w)/2,h=c.offsetHeight||0;c.style.marginRight=sd?'0':'auto';let b=8;");
  once('cam-c-ck', 'H=C&&C.clientHeight||1e4,B=c&&(c.bb+c.offsetHeight||196)+24;if(!c||!k||f!==1&&k.every(a=>{let p=m.project(a);return p.x>=20&&p.x<=(C.clientWidth||1e4)-20&&p.y>=130&&p.y<=H-B}))return;',
    'H=C&&C.clientHeight||1e4,d=c&&c.sd,B=d?100:c&&(c.bb+c.offsetHeight||196)+24,R=d?c.offsetWidth+32:40,T=d?60:150;if(!c||!k||f!==1&&k.every(a=>{let p=m.project(a);return p.x>=20&&p.x<=(C.clientWidth||1e4)-R+20&&p.y>=T-20&&p.y<=H-B}))return;');
  once('cam-c-pad', 'padding:{top:150,left:40,right:40,bottom:H-150>B?B:MX(0,H-270)}', 'padding:{top:T,left:40,right:R,bottom:d?B:H-150>B?B:MX(0,H-270)}');
  // M2R-l3regress MINOR M3-L1: a tap on a drawn REPD dot belongs to the engine and closes the card (as L3), but M3 kept its
  // auto-switched layers on with no card. Now the tapped dot's technology is handed to the reader (it stays on, as the dot
  // the reader just engaged with) and every other layer M4 switched on is released.
  once('l3r-dot', 'if(!f){let rp=RP(m);if(rp.length&&m.queryRenderedFeatures(e.point,{layers:rp}).length)return;',
    'if(!f){let rp=RP(m),h=rp.length&&m.queryRenderedFeatures(e.point,{layers:rp});if(h&&h.length){for(let q of h)S.ly&&S.ly.delete(q.properties&&q.properties.tech);return Ry()}');
}
