/* Native PDF writer extracted from 66b445b908005bcf3cb542de6bbd47090d855e76 atlas/modules/202609031958-menu-bar.js; source SHA256 0531678926f3063465c80398a48a9f0545a24f490fcb2c60d72f94f25d01e234. Footer wrapping and bounded capture added. */
(()=>{
const registry=window.__GRIDATLAS_MODULES__ ||= {};
function cleanText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

function attributionText(doc) {
    var node = doc.querySelector('.custom-map-attrib');
    return cleanText(node && node.textContent)
      || 'Data © OpenStreetMap contributors | © CARTO | EV data © Open Charge Map';
  }

function generationText() {
    var atlas = window.__GRIDATLAS_ATLAS__;
    var generation = (atlas && atlas.generation)
      || (document.documentElement && document.documentElement.dataset
        && document.documentElement.dataset.gridatlasGeneration);
    return generation ? 'generation ' + generation : '';
  }

function looksBlank(canvas) {
    try {
      var probe = document.createElement('canvas');
      probe.width = 40; probe.height = 40;
      var context = probe.getContext('2d');
      context.drawImage(canvas, 0, 0, 40, 40);
      var data = context.getImageData(0, 0, 40, 40).data;
      for (var i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
      return true;
    } catch (_) {
      /* A tainted canvas throws here. That is not blank, and treating it as
         blank would send the reader to print for no reason. */
      return false;
    }
  }

function mapHandle() {
    var map = window.__GRIDATLAS_V9_MAP__;
    if (map && map.getCanvas) return map;
    return (window.map && window.map.getCanvas) ? window.map : null;
  }

function pdfEscape(text) {
    return String(text == null ? '' : text)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[^\x20-\x7e]/g, '');
  }

function buildMapPdf(jpegBinary, pixelWidth, pixelHeight, heading, leftFoot, rightFoot) {
    /* ONE PAGE UNIT PER CAPTURED PIXEL. NO PAPER, NO REDUCTION.
       -------------------------------------------------------------------
       This scaled the long edge to 1190pt, "A3-ish". That is a paper
       assumption, and on a 1390x518 desktop capture it emitted a 1190x443
       page -- a 14% REDUCTION of the record. "THE PRINT MUST BE HIGH RES OF
       WHAT THE USER SEES NOT A REDUCED CRAP VERSION", "WE ARE NOT USING
       PAPER", "THIS IS A CALL FOR A 2026 era TELEPRINTER".

       A teleprinter emits the record as it was. So the page is exactly the
       captured raster: one PDF unit per pixel, no scaling in either
       direction, and the canvas is captured at devicePixelRatio -- 1149x2514
       on a phone at dpr 3, native on a desktop at dpr 1. Nothing is resampled
       on the way out, and a viewer showing it at 100% shows the reader's own
       pixels. */
    if(!Number.isInteger(pixelWidth)||!Number.isInteger(pixelHeight)||pixelWidth<1||pixelHeight<1)throw Error('The map has no drawable dimensions.');
    var pageW = pixelWidth;
    var pageH = pixelHeight;
    /* Furniture scaled to the record rather than to an assumed sheet, so a
       2514px-tall phone capture and a 518px-tall desktop one both carry a
       legible credit rather than one sized for A3. */
    var unit = Math.max(1, Math.min(pageW, pageH) / 520);
    var band = Math.round(Math.min(pageH * 0.14, 46 * unit));
    var headSize = Math.round(13 * unit);
    var footSize = Math.round(8 * unit);
    var pad = Math.round(14 * unit);
    var maxChars=Math.max(8,Math.floor((pageW-2*pad)/(footSize*1.1)));
    var footerLines=[...wrapPdfText(leftFoot,maxChars),...wrapPdfText(rightFoot,maxChars)];
    var lineHeight=Math.ceil(footSize*1.45),footerHeight=footerLines.length*lineHeight+pad;
    var footerCommands=footerLines.map((text,i)=>'BT /F1 '+footSize+' Tf 0.86 0.93 0.94 rg '+pad+' '+(footerHeight-pad-i*lineHeight)+' Td ('+pdfEscape(text)+') Tj ET');

    var content = [
      'q', pageW + ' 0 0 ' + pageH + ' 0 0 cm', '/Im0 Do', 'Q',
      /* Scrim bands at 55% alpha so the text reads over a dark basemap
         without dimming the map itself. */
      'q', '/GsA gs', '0.02 0.06 0.07 rg',
      '0 ' + (pageH - band) + ' ' + pageW + ' ' + band + ' re f',
      '0 0 ' + pageW + ' ' + footerHeight + ' re f', 'Q',
      'BT /F1 ' + headSize + ' Tf 1 1 1 rg ' + pad + ' ' + (pageH - pad - headSize)
        + ' Td (' + pdfEscape(heading) + ') Tj ET',
      ...footerCommands
    ].join('\n');

    var objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + ']'
        + ' /Resources << /XObject << /Im0 5 0 R >> /Font << /F1 6 0 R >>'
        + ' /ExtGState << /GsA 7 0 R >> >> /Contents 4 0 R >>',
      '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream',
      '<< /Type /XObject /Subtype /Image /Width ' + pixelWidth + ' /Height ' + pixelHeight
        + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '
        + jpegBinary.length + ' >>\nstream\n' + jpegBinary + '\nendstream',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /ExtGState /ca 0.55 >>'
    ];

    var out = '%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n';
    var offsets = [];
    var i;
    for (i = 0; i < objects.length; i += 1) {
      offsets.push(out.length);
      out += (i + 1) + ' 0 obj\n' + objects[i] + '\nendobj\n';
    }
    var xref = out.length;
    out += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
    for (i = 0; i < offsets.length; i += 1) {
      out += ('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n';
    }
    out += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n'
      + 'startxref\n' + xref + '\n%%EOF\n';

    var bytes = new Uint8Array(out.length);
    for (i = 0; i < out.length; i += 1) bytes[i] = out.charCodeAt(i) & 0xff;
    return { bytes: bytes, pageW: pageW, pageH: pageH };
  }

function captureMapJpeg(doc, then) {
    var map = mapHandle(),settled=false,timer;
    var finish=function(url,canvas){if(settled)return;settled=true;clearTimeout(timer);if(map&&map.off&&grab)map.off('render',grab);then(url,canvas);};
    timer=setTimeout(function(){finish(null,null);},10000);
    var canvas = doc.querySelector('.maplibregl-canvas')
      || (map && map.getCanvas ? map.getCanvas() : null);
    if (!canvas) { finish(null, null); return; }
    var grab = function () {
      var url = null;
      try { url = canvas.toDataURL('image/jpeg', 0.92); } catch (_) { url = null; }
      if (!url || url.indexOf('data:image/jpeg') !== 0 || looksBlank(canvas)) {
        finish(null, canvas);
        return;
      }
      finish(url, canvas);
    };
    if (map && map.once && map.triggerRepaint) {
      map.once('render', grab);
      map.triggerRepaint();
    } else {
      grab();
    }
  }

function pdfFileStamp() {
    var d = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate())
      + pad(d.getUTCHours()) + pad(d.getUTCMinutes());
  }

  function wrapPdfText(value,maxChars){
    const text=String(value??'').replace(/\u00a9/g,'(c)').replace(/[\u00b7\u2013\u2014]/g,'-').replace(/[^\x20-\x7e]/g,' ').replace(/\s+/g,' ').trim();
    const lines=[];let line='';
    for(const word of text.split(' ')){let rest=word;while(rest.length>maxChars){if(line){lines.push(line);line='';}lines.push(rest.slice(0,maxChars));rest=rest.slice(maxChars);}if(!rest)continue;if(line.length+rest.length+1>maxChars){lines.push(line);line=rest;}else line+=(line?' ':'')+rest;}
    if(line)lines.push(line);return lines;
  }
  function savePdf(doc,button){
    if(button.disabled)return;button.disabled=true;button.textContent='Building map PDF...';
    captureMapJpeg(doc,function(data,canvas){
      button.disabled=false;
      if(!data){button.textContent='Map capture unavailable - redraw and try again';return;}
      try{
        const binary=atob(data.slice(data.indexOf(',')+1));
        const built=buildMapPdf(binary,canvas.width,canvas.height,'GlobalGrid2050 - Grid Atlas map',attributionText(doc),generationText()+' - '+new Date().toISOString().slice(0,16).replace('T',' ')+' UTC');
        const url=URL.createObjectURL(new Blob([built.bytes],{type:'application/pdf'})),anchor=doc.createElement('a');
        anchor.href=url;anchor.download='globalgrid2050-map-'+pdfFileStamp()+'.pdf';doc.body.append(anchor);anchor.click();anchor.remove();
        setTimeout(()=>URL.revokeObjectURL(url),30000);button.textContent='PDF saved - '+built.pageW+' x '+built.pageH+' native pixels';
      }catch(error){button.textContent='PDF could not be created: '+error.message;}
    });
  }
  function install(){
    if(document.getElementById('gridatlas-export-pdf'))return true;
    const sibling=document.getElementById('gridatlas-export-image')||[...document.querySelectorAll('#gridatlas-menu-bar button[data-gm-export]')].find(button=>/save an image/i.test(button.textContent));if(!sibling)return false;
    const button=document.createElement('button');button.id='gridatlas-export-pdf';button.type='button';button.dataset.gmExport='pdf';
    button.textContent='Save map as PDF';button.title='Download the visible map at native resolution, with source credits and release identity';button.style.minHeight='44px';button.setAttribute('aria-live','polite');
    button.addEventListener('click',()=>savePdf(document,button));sibling.before(button);return true;
  }
  registry.mapPdf=Object.freeze({schema:'gridatlas.map-pdf.v1',buildMapPdf,wrapPdfText,install});
  if(typeof document!=='undefined'&&!install()){
    const observer=new MutationObserver(()=>{if(install())observer.disconnect();});observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),120000);
  }

})();
