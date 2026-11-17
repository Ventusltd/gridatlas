/** Explicit DOM extension contract: append to the public #gridatlas-gj03-panel. */
export function createOfficialContextBridge({document: D, window: W, map, container, resolveFacts, cancelPending, render, provenance, css}) {
  if (!container || !W.MutationObserver || !map?.on || !map?.off) throw new Error('Existing native map/container unavailable');
  let alive = true, current = null, host = null, epoch = 0, state = 'waiting-for-journey';
  async function attach() {
    if (!alive) return;
    const target = D.getElementById('gridatlas-gj03-panel');
    if (target === host && current) return;
    ++epoch; current?.destroy(); current = null; host = target;
    if (!host) { state = 'waiting-for-journey'; return; }
    const ticket = epoch;
    try {
      const facts = await resolveFacts();
      if (!alive || epoch !== ticket || !host?.isConnected || host !== target) return;
      current = render({host, document: D, facts, provenance, css}); state = facts ? 'reviewed-facts' : 'withheld';
    } catch {
      if (!alive || epoch !== ticket || !host?.isConnected || host !== target) return;
      current = render({host, document: D, facts: null, provenance, css}); state = 'withheld';
    }
  }
  // Direct children only: Journey root mounting/removal. No document-wide subtree observer.
  const observer = new W.MutationObserver(attach); observer.observe(container, {childList: true});
  function destroy() { if (!alive) return; alive = false; ++epoch; observer.disconnect(); map.off('remove', destroy); cancelPending?.(); current?.destroy(); current = null; host = null; state = 'removed'; }
  map.on('remove', destroy); attach();
  return Object.freeze({close() { current?.close(); }, destroy, snapshot: () => ({alive, state, attached: !!current})});
}
