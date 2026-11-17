/** Presentation only. The pinned Pipeline producer consumer owns fact admission. */
export function renderOfficialContext({host, document: D, facts, provenance, css = ''}) {
  if (facts) {
    day(facts.event_date);
    if (facts.planned_metric?.kind !== 'planned_transmission_upper_bound' || facts.planned_metric.unit !== 'MW' || !Number.isFinite(facts.planned_metric.value)
        || ['current_capacity_mw', 'commissioned', 'connection', 'repd_ref', 'coordinates'].some(k => facts[k] !== null) || facts.documents?.length !== 2) throw new Error('Unsupported context claim');
    for (const d of facts.documents) { const u = new URL(d.url); if (u.origin !== 'https://www.gov.uk' || u.username || u.password) throw new Error('Non-government context URL'); day(d.published_date); day(d.event_date); for (const value of Object.values(d.milestones || {})) day(value); }
  }
  const node = (tag, text, parent, attrs = {}) => { const e = D.createElement(tag); if (text !== undefined) e.textContent = String(text); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.appendChild(e); return e; };
  const root = node('details', undefined, host, {class: 'gj-official-context', 'data-state': facts ? 'reviewed-facts' : 'withheld'});
  node('style', css, root);
  node('summary', facts ? 'Official planning context · 1 notice' : 'Official planning context · WITHHELD', root);
  if (!facts) {
    node('p', 'Planning context withheld: the pinned source record or its independent narrow fact-rights review is unavailable. Existing Journey and map layers remain separate.', root, {role: 'status'});
  } else {
    node('strong', `${facts.scheme} · ${facts.application_ref}`, root);
    node('p', '1 source-qualified planning notice · 2 government documents. Standalone planning example: no association with the selected map asset is established. These are documentary evidence counts, not counts of network assets or upgrades.', root);
    node('p', `Reported planning stage: ${facts.reported_stage}. Decision: ${day(facts.event_date)}. Reported network operator: ${facts.reported_network_operator}; government publishers are identified separately below.`, root);
    node('p', facts.description, root);
    node('p', `Up to ${facts.planned_metric.value.toLocaleString('en-GB')} ${facts.planned_metric.unit}: planned transmission upper bound. Current capacity, commissioning and available headroom are UNKNOWN.`, root, {class: 'gj-context-caveat'});
    const gaps = node('details', undefined, root);
    node('summary', 'Coverage gaps and boundaries', gaps);
    node('p', 'This notice creates 0 REPD/ETYS/asset joins and supplies 0 accepted real circuit routes or surveyed polylines. Circuit identity, geometry, connection, operating state and coordinates remain WITHHELD or UNKNOWN.', gaps);
    node('p', 'Consent is a planning decision. It does not establish construction, energisation, measured power flow, direction or available connection capacity. UK network coverage is not assessed by this example.', gaps);
    const sources = node('details', undefined, root);
    node('summary', 'Source dates and provenance', sources);
    for (const doc of facts.documents) {
      const article = node('div', undefined, sources, {class: 'gj-context-source'});
      const a = node('a', doc.publisher, article, {target: '_blank', rel: 'noopener noreferrer'});
      const u = new URL(doc.url); if (u.origin !== 'https://www.gov.uk' || u.username || u.password) throw new Error('Non-government context URL');
      a.setAttribute('href', u.href);
      node('p', `Published: ${day(doc.published_date)}. Decision: ${day(doc.event_date)}. Retrieved: ${doc.retrieved_at}. Source update time: UNKNOWN.`, article);
      for (const [name, value] of Object.entries(doc.milestones || {})) node('p', `${name.replaceAll('_', ' ')}: ${day(value)}`, article);
      node('pre', `HTML SHA256 ${doc.source_sha256}\n${doc.source_receipt.bytes} source bytes; document ${doc.source_record_id}`, article);
    }
    node('p', 'Narrow government-authored facts under the stated Open Government Licence v3.0. Images, logos, linked submissions and third-party material are excluded. No document bodies are republished here.', sources);
    const p = node('p', undefined, sources); node('a', 'Open Government Licence v3.0', p, {href: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/', target: '_blank', rel: 'noopener noreferrer'});
    node('pre', `Producer ${provenance.repository}@${provenance.commit}\nArtifact ${provenance.path}\nArtifact SHA256 ${provenance.sha256}\nFact SHA256 ${provenance.factsSha256}`, sources);
  }
  return Object.freeze({element: root, close() { root.open = false; }, destroy() { root.remove(); }});
}

function day(value) {
  if (value?.precision !== 'DAY' || !/^\d{4}-\d{2}-\d{2}$/.test(value.value)) throw new Error('Context date requires day precision');
  return value.value + ' (day precision)';
}
