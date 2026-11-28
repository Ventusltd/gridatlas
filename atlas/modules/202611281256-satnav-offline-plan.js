// Optional cartridge for the versioned waypoint maps. Loading it never stores a plan.
void async function () {
  if (!/\/atlas\/v\/satnav-[\w.-]+\/(?:index\.html)?$/.test(location.pathname)) return;
  const root = new URL('../../../', location.href);
  const hostId = 'satnav-field-tools';
  let mounted = false;

  async function attach() {
    const host = document.getElementById(hostId);
    const survey = document.getElementById('satnav-compact')?.satnavSurvey;
    if (mounted || !host || !survey?.getPins) return;
    mounted = true;
    document.removeEventListener('satnav:ready', attach);
    try {
      const [{mountOfflinePlan}, maths] = await Promise.all([
        import(new URL('tools/satnav/field-reliability/offline-plan.mjs', root)),
        import(new URL('tools/satnav/vendor/9698781539e549deaa6ecaa4a2b34610c1f9fd29/vendor/grid-distance-maths/src/geodesy.mjs', root)),
      ]);
      mountOfflinePlan({container: host, getPins: survey.getPins, maths});
    } catch {
      const message = document.createElement('p');
      message.setAttribute('role', 'status');
      message.textContent = 'Offline plan controls could not load.';
      host.append(message);
    }
  }
  document.addEventListener('satnav:ready', attach);
  await attach();
}();
