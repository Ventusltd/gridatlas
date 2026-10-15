# GridAtlas community photographs — contribution and publication policy

## Phase 1 — open-source photographic submissions

Contributors use GitHub's `Contribute a photograph` issue form:

https://github.com/Ventusltd/gridatlas/issues/new?template=photograph-submission.yml

A GitHub account is required. Users can attach photographs directly. **The issue and its attachments are public immediately**; this is not a private moderation inbox. No GitHub API credentials are placed in the browser.

### What contributors provide

- Site/asset name and asset category.
- A general location and, optionally, publicly established coordinates.
- Optional official REPD reference or other public source identifying the site.
- Date taken (if known), photographic evidence and a public photographer credit.
- Agreement to license their own photograph under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Attestation that they have the right to publish, and have removed personal/sensitive metadata and protected information.

Do not publish photos obtained through trespass, confidential engineering plans, protective infrastructure/security arrangements, identifiable people without permission, number plates or sensitive EXIF location data. Photographs should be taken from lawful public vantage points or with appropriate permission.

### Editorial checks — before map publication

1. Verify rights/attribution and open the image file safely; reject non-image content, deceptive links, abusive content and irrelevant submissions.
2. Confirm the asset's **identity from public evidence**, preferably a source ID/reference; do not turn geographic proximity into an identity claim.
3. Review location, privacy, security, and misleading descriptions. Accept uncertainty or abstain. Approve a photo without exposing precise site access instructions.
4. If approved, create a small public, versioned photo index (JSON) with source issue URL, photo URL, asset ID if verified, date, licence, credit and review status. Link it to the relevant GridAtlas feature where an independently established asset ID exists.
5. Only reviewed entries are rendered on the map. Do not parse untrusted GitHub Issue bodies directly in the browser. Provide a takedown/correction path through a GitHub Issue.

This repository owns the UI. `Ventusltd/data-gridatlas` owns durable derived records, source contracts, validation and release manifests. **Do not put user-submitted photo binaries into Git history**; use attachment links for the pilot and plan durable independent image storage for production.

### Suggested reviewed record (future data schema)

```json
{
  "schema": "gridatlas.community-photo.v1",
  "source_issue": "https://github.com/Ventusltd/gridatlas/issues/123",
  "verified_asset_id": null,
  "asset_name": "Public asset name",
  "general_location": "County, UK",
  "photo_url": "https://.../reviewed-photo.jpg",
  "photographer_credit": "Contributor pseudonym",
  "licence": "CC-BY-4.0",
  "taken_on": null,
  "verified_on": null,
  "review_status": "approved"
}
```

All example URLs and records above are illustrative; no photo data has yet been approved or published.

### Phase 2 — direct uploads on the map

A public `Add photograph` control can be delivered as a new independently hashed Atlas cartridge, without changing an immutable release or `atlas/current.json` outside an atomic, tested composition. For visitors without GitHub accounts, use a small serverless upload service (e.g. a Cloudflare Worker), bot protection, rate limits, content type/size validation, quarantine storage, moderation and a **reviewed-only** publication index. Keep upload credentials off the client. Strip metadata server-side in this route, store provenance and licence, and give users a report/removal path.

This Phase 1 issue form is an intake mechanism **only**. It does not change the live map or automatically publish submissions.
