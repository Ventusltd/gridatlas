/* Arrival tidy - the search machinery gets out of the way once it has answered.

   MEASURED, on v9.96 at 393x852, arriving at ?repd_ref=12588 the way a shared
   link arrives: the map canvas was topmost at 13 per cent of 3,200 sampled
   viewport points and the app's own controls at 87. Three of those controls
   were the SEARCH, not the answer - the results list still open at
   [40,136,302,92] holding the project the reader had already been taken to,
   the box holding "12588", a reference the reader never typed, and the
   identity repeated in the results row, the search bar and the card header.

   A deep link is not a search. The reader asked for one project by name and
   got it; the list of how it was found is scaffolding, and scaffolding left
   up is clutter. So on a RESOLVED arrival the list is dismissed and the box
   is emptied back to its placeholder.

   WHAT THIS DELIBERATELY DOES NOT DO

   - It does not touch a FAILED arrival. When the identity could not be
     resolved the results are the only thing on screen that explains why, and
     hiding them would leave a reader with a map and no account of it.
   - It does not clear a box the reader has touched. Focus or a keystroke
     retires this permanently, so a reader who starts typing while the
     arrival is still resolving never has their text taken away.
   - It does not clear a box holding something other than the ref, which is
     the same rule stated for the case where another lane wrote there first.
   - It hides with `style.display = 'none'`, which is what the shell's own
     Escape key and map click do. This is the product's mechanism, not a new
     one, so nothing has to be taught how to bring it back.

   It runs only where there is a MutationObserver. The cartridge proofs
   execute composed cartridges under node:vm against a window stub that has
   neither observers nor timers, and a module that throws there takes the
   whole cartridge down with it - which is exactly how v9.92 shipped a menu
   bar that broke the sandbox proof. Where there is no observer there is no
   arrival either, so doing nothing is the correct answer rather than a
   degraded one. */
(function arrivalTidy() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (typeof MutationObserver !== 'function') return;

  var ref = '';
  try {
    ref = String(new URLSearchParams(window.location.search).get('repd_ref') || '').trim();
  } catch (_) { return; }
  if (!ref) return;

  var typed = false;
  var done = false;

  function tidy() {
    if (done) return true;
    var state = document.body && document.body.dataset
      ? document.body.dataset.gridatlasRepdDeepLink : '';
    if (state !== 'resolved') return state === 'failed';   /* failed: stop watching, change nothing */
    var results = document.getElementById('search-results');
    var input = document.getElementById('search-input');
    if (!results || !input) return false;
    if (!typed) {
      results.style.display = 'none';
      if (input.value === ref) input.value = '';
    }
    done = true;
    return true;
  }

  function retire() { typed = true; }

  function watch() {
    var input = document.getElementById('search-input');
    if (input) {
      input.addEventListener('focus', retire, { once: true });
      input.addEventListener('input', retire, { once: true });
    }
    if (tidy()) return;
    var observer = new MutationObserver(function () {
      if (tidy()) observer.disconnect();
    });
    observer.observe(document.body, {
      attributes: true, attributeFilter: ['data-gridatlas-repd-deep-link']
    });
    window.__GRIDATLAS_ARRIVAL_TIDY__ = {
      installed: true,
      repd_ref: ref,
      get dismissed() { return done; },
      get retired_by_reader() { return typed; }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watch, { once: true });
  } else {
    watch();
  }
}());
