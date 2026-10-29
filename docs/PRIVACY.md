# Privacy: GridAtlas and www.globalgrid2050.com

Draft, 29 October 2026. This statement covers:
- GridAtlas (`ventusltd.github.io/gridatlas/`);
- the www.globalgrid2050.com homepage;
- Pipeline News;
- the Energy Transition Simulator (Solar Design Studio).

Other pages on globalgrid2050.com have not been checked yet, and this statement does not describe them.

## In short

**We do not track you.** There are:
- no analytics, tracking pixels or tag managers;
- no advertising;
- no cookies of our own;
- no accounts, sign-ups or forms that send anything to us.

We do not run a server. Every page is a static file served by **GitHub Pages**.

**Some things are still recorded.**
- **GitHub, our host, logs your IP address** when you load a page, for security purposes. It does this on every GitHub Pages site, and we cannot switch it off. We do not see these logs.
- **The pages load maps, code and data from the other services listed below.** Each of those services receives the same basic request data. Each one handles it under its own privacy policy.

## What every request carries

A browser request to any service carries:
- your IP address;
- your browser's user-agent;
- the address of the file requested.

It usually also carries the site you came from. That is normally just the origin, such as `https://ventusltd.github.io`, not the full page address.

For map tiles, the file address shows the area you are looking at. For searches, it includes the text you searched for.

## GridAtlas

**On every visit**, GridAtlas contacts:
- **GitHub** (`ventusltd.github.io`, `raw.githubusercontent.com`), for the app and its data;
- **jsDelivr** (`cdn.jsdelivr.net`), for the MapLibre map library and the DuckDB database engine;
- **DuckDB** (`extensions.duckdb.org`), for the database engine's Parquet reader;
- **CARTO** (`basemaps.cartocdn.com`), for the dark basemap. Its map tiles show the area on screen.

**Only when you use a feature:**
- **Search** sends the text you type to **postcodes.io** (`api.postcodes.io`) as you type. When you press Enter or the search button, it also sends that text to the OpenStreetMap Foundation's **Nominatim** (`nominatim.openstreetmap.org`). Nominatim is not used when the text is a UK postcode.
- **Satellite** loads imagery tiles from **Esri** (`server.arcgisonline.com`).
- **Lightning** loads the lightning feed and history from **GitHub** (`raw.githubusercontent.com`).
- **News and image links** open Google in a new tab, with the project name in the search. Other links open GitHub, OpenStreetMap, Open Charge Map, or other GlobalGrid2050 pages.

**On your device:**
- GridAtlas stores one setting, `gridatlas.dash.collapsed`, which records whether the layers panel is hidden.
- It sets no cookies, and it does not use session storage, IndexedDB or a service worker.
- **Files you download** (CSV, PNG, PDF and "print source code") are made in your browser and are not sent anywhere. The source-code text file includes the page address and your browser's user-agent, so check it before you share it.

## www.globalgrid2050.com homepage

The homepage loads only files from globalgrid2050.com. It contacts no other service until you follow a link, and it stores nothing on your device.

## Pipeline News

**On every visit**, Pipeline News contacts:
- **jsDelivr**, for the Chart.js charting library;
- **GitHub** (`raw.githubusercontent.com`, `ventusltd.github.io`), for the news file and the map-link contract.

**Only when you click:**
- **NEWS** opens a Google News search for the project name.
- Headlines open the publisher's site.
- **MAP** opens GridAtlas.

Pipeline News stores nothing on your device.

## Energy Transition Simulator

**On every visit**, the simulator contacts:
- **jsDelivr**, for MapLibre;
- **Esri** (`server.arcgisonline.com`), for satellite imagery;
- **Amazon Web Services** (`s3.amazonaws.com`), for terrain;
- **GitHub** (`ventusltd.github.io`), for GridAtlas grid data.

Imagery and terrain requests show the area on screen.

**Depending on what you do:**
- **Arriving at a place** (Find/Go, Walk, Drone, Build here or Stream ground) asks the **Environment Agency** (`environment.data.gov.uk`) for LiDAR heights covering a 2 km square around that place.
- **A postcode you type** is sent to **postcodes.io**.
- **Assess land** sends a 2 km box to **Esri ArcGIS Online**, for the Natural England land-grade and Environment Agency flood layers.
- **Rows** sends the visible map area to the OpenStreetMap **Overpass API** (`overpass-api.de`).
- **Connect here**, with road routing, sends the site and substation coordinates to the public **OSRM** demonstration router (`router.project-osrm.org`).
- **Dark** loads the basemap from **CARTO**.

**On your device**, the simulator uses local storage for two things:
- **Postcode lookups** (`pc:<POSTCODE>`) are saved so that postcodes.io is not asked twice. In the current version they stay until you clear site data for globalgrid2050.com. A candidate version keeps them for 30 days and adds a "forget postcodes" command.
- **`lidarStream.day`** holds today's date and a count, so the simulator can cap its daily LiDAR requests.

## Links you share

Addresses can contain a place or a project. Examples are the simulator's `?lat=…&lon=…` and the GridAtlas deep links. Anyone you send such a link to can see that place.

## Clearing what is stored

Clear site data for `globalgrid2050.com` or `ventusltd.github.io` in your browser's settings.

## Services and their policies

- GitHub Pages, including what it logs: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection
- GitHub General Privacy Statement: https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement
- The other services are jsDelivr, CARTO, Esri, Amazon Web Services, DuckDB, postcodes.io, OpenStreetMap Foundation (Nominatim), FOSSGIS (Overpass), the OSRM project, the Environment Agency, and Google, for links only. Each publishes its own privacy policy.

## How this was checked, and its limits

This statement comes from reading the code of the following versions:
- GridAtlas live generation 202610281340;
- GridAtlas preview generations 202610290045 and 202610290050;
- homepage owner bundle cb741ca;
- Pipeline News 202609082224;
- Energy Transition Simulator 202609282123.

Most of it is a static reading of that code. Only the GridAtlas requests listed for every visit were also seen in an earlier browser network log. Behaviour inside the third-party libraries was checked by searching their published npm packages. It was not observed in those services.

The audit evidence and the full host-by-host inventory, with file and line references, are kept with the release hardening records. Update this statement whenever a release adds a service or a stored item.
