/* Restore this version's saved design pins to the same map used for a hand-placed walk. */
void function () {
  const scope = new URL('./', location.href);
  const root = new URL('../../../', scope);
  let mounted = false;

  async function mount() {
    const host = document.getElementById('satnav-field-tools');
    const survey = document.getElementById('satnav-compact')?.satnavSurvey;
    if (!host || !survey || mounted) return;
    mounted = true;
    document.removeEventListener('satnav:ready', mount);

    try {
      const {mountOfflinePlan} = await import(new URL('tools/satnav/field-reliability/offline-plan.mjs', root));
      const area = mountOfflinePlan({container: host, getPins: survey.getPins, maths: survey.maths});
      const [save, forget] = area.querySelectorAll('button');
      if (save.disabled) return;

      const status = area.querySelector('[role="status"]');
      const restore = document.createElement('button');
      restore.type = 'button';
      restore.textContent = 'Use saved plan';
      forget.before(restore, ' ');
      // Saving and forgetting already lock these controls while the cache is changing.
      new MutationObserver(() => { restore.disabled = save.disabled; })
        .observe(save, {attributes: true, attributeFilter: ['disabled']});

      restore.onclick = async () => {
        if (save.disabled) return;
        const previous = survey.getPins();
        save.disabled = forget.disabled = restore.disabled = true;
        try {
          const key = new URL('__saved-field-plan__', scope);
          const response = await caches.match(key, {cacheName: 'ventus-satnav-offline-plans-v1'});
          if (!response) {
            status.textContent = 'No saved plan for this map.';
            return;
          }
          // The existing offline document stores design coordinates as JSON.
          // Read its data in an inert template, without loading its offline viewer.
          const snapshot = document.createElement('template');
          snapshot.innerHTML = await response.text();
          const data = snapshot.content.querySelector('script#saved-plan[type="application/json"]');
          const coordinates = JSON.parse(data?.textContent ?? 'null')?.coordinates;
          if (!Array.isArray(coordinates) || coordinates.length < 2) throw Error('Invalid saved plan');
          if (survey.getPins() !== previous) {
            status.textContent = 'The plan changed. Tap Use saved plan again to replace it.';
            return;
          }
          // replacePlan validates every pin before changing endpoints and notifying walking guidance.
          survey.replacePlan(coordinates);
          status.textContent = 'Saved plan loaded · ' + coordinates.length.toLocaleString('en-GB') + ' pins.';
        } catch {
          status.textContent = 'Could not load the saved plan.';
        } finally {
          save.disabled = forget.disabled = restore.disabled = false;
        }
      };
    } catch {
      const message = document.createElement('p');
      message.setAttribute('role', 'status');
      message.textContent = 'Saved plan controls could not load.';
      host.append(message);
    }
  }
  document.addEventListener('satnav:ready', mount);
  void mount();
}();
