#!/usr/bin/env python3
"""Give every unlocated REPD row a coordinate, or say plainly why it has none.

REPD locates almost everything it lists. The rows it does not locate arrive in
the browser registry carrying a single shared placeholder point,
-7.55716, 49.766807 - a spot in the Western Approaches roughly 60 km west of
the Isles of Scilly, which is not a location, it is the absence of one. Thirty
six rows carry it. The Atlas engine refuses to measure from it, correctly:
otherwise Dogger Bank South West gets measured to the Isles of Scilly. So those
rows produce no measurement at all until something else locates them.

This tool locates what can be located and writes it out with its provenance. It
never edits REPD: the register is the register, and a derived point must be
labelled as derived, with the thing it was derived from named.

The governing rule is bind or write nothing. A row with no defensible public
source is omitted. An omitted row is a good outcome. A fabricated one is the
worst possible outcome, because the map prints it as fact.

Things here that were learned the hard way and are load-bearing:

  * Reduce a lease polygon with point-on-surface, not a centroid. The centroid
    of a concave or multipart lease can fall in open water outside the lease,
    and an arrival must land on the site it names.

  * Do not fuzzy-match site names to lease names. The previous version of this
    tool matched on normalised names and reported Morecambe as NO_LEASE_MATCH
    because REPD spells it "Morecombe" while the lease register spells it
    "Morecambe". Worse, fuzzy matching is silent when it is wrong: Thistle Wind
    Partners hold two ScotWind leases of identical 1008 MW capacity, Ayre off
    Orkney and Bowdun off Stonehaven, 200 km apart, and a name-similarity score
    will happily pick the wrong one. Every bind in this file is therefore
    explicit, written down, and carries the evidence that justifies it.

  * Fetch the lease layers from the publishers rather than from a snapshot on
    somebody's disk. The previous version globbed the filesystem for
    *crown*estate*.geojson and could not run anywhere those files were absent.
    The layers below are the live first-party services; responses are cached
    under tools/offshore/cache/ so a rerun is cheap and an offline rerun works.

  * Cross-check every bind against a second field. Name, tenant and capacity all
    agreeing is a bind; a name alone is a guess. The capacity column of the
    Crown Estate Scotland lease layer agrees with REPD's own capacity to the
    megawatt for Muir Mhor, MarramWind, MachairWind, Spiorad na Mara, Ayre and
    Cenos, which is what turns those from plausible into bound.

Usage:
    python tools/offshore/reconcile_offshore_coordinates.py
    python tools/offshore/reconcile_offshore_coordinates.py --offline
    python tools/offshore/reconcile_offshore_coordinates.py --check
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import math
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parent / "cache"
REGISTRY = REPO / "data" / "repd_browser_registry_202608290716.json"
DEFAULT_OUT = REPO / "atlas" / "data" / "offshore-coordinates.json"

# The single point the registry uses to mean "not located". Any output row that
# equals this is a bug, and --check fails on it.
PLACEHOLDER = (-7.55716, 49.766807)

# Rough envelope of the UK EEZ plus the Channel Islands. A coordinate outside it
# did not come from where this tool claims it came from.
GB_BOUNDS = (-14.0, 48.9, 3.7, 61.5)

# ---------------------------------------------------------------------------
# Lease layers. First-party publishers, queried live, cached locally.
# ---------------------------------------------------------------------------

LAYERS = {
    # The Crown Estate leases the seabed of England, Wales and Northern Ireland.
    "crown-estate-wind-sites.geojson": {
        "url": (
            "https://services2.arcgis.com/PZklK9Q45mfMFuZs/arcgis/rest/services/"
            "WindSite_EngWalNI_TheCrownEstate/FeatureServer/0"
        ),
        "portal": (
            "https://opendata-thecrownestate.opendata.arcgis.com/datasets/"
            "thecrownestate::wind-site-agreements-england-wales-ni-the-crown-estate"
        ),
        "publisher": "The Crown Estate",
        "name_field": "Name_Prop",
        "tenant_field": "Name_Ten",
        "capacity_field": None,
        "region": "England/Wales/NI",
    },
    # Crown Estate Scotland leases the Scottish seabed. This layer is the named
    # one: the ScotWind_Offers and INTOG_Application_Areas layers on the same
    # service carry only an option number and a lead applicant, which is why the
    # earlier attempt at this could not name what it had found.
    "crown-estate-scotland-wind-sites.geojson": {
        "url": (
            "https://services3.arcgis.com/nGV4jiurzcahJ9LV/arcgis/rest/services/"
            "Offshore_Wind_Crown_Estate_Scotland/FeatureServer/0"
        ),
        "portal": "https://services3.arcgis.com/nGV4jiurzcahJ9LV/arcgis/rest/services",
        "publisher": "Crown Estate Scotland",
        "name_field": "Property_Description",
        "tenant_field": "Tenant_Name",
        "capacity_field": "Capacity_MW",
        "region": "Scotland",
    },
}

QUERY = "/query?where=1%3D1&outFields=*&outSR=4326&f=geojson"

# ---------------------------------------------------------------------------
# Explicit binds. repd_ref -> the exact lease feature, and why.
#
# "evidence" is not decoration. It is the thing that has to survive review, and
# it is what a future reader checks when a lease register is republished with
# different names.
# ---------------------------------------------------------------------------

LEASE_BINDS = {
    "10913": {
        "layer": "crown-estate-wind-sites.geojson",
        "feature": "North Falls",
        "evidence": "Lease property name matches the REPD site name exactly; tenant North Falls Offshore Wind Farm Limited.",
    },
    "10919": {
        "layer": "crown-estate-wind-sites.geojson",
        "feature": "R4 Project 6 (Morgan)",
        "evidence": "Round 4 leases are catalogued as 'R4 Project n (Name)'; tenant Morgan Offshore Wind Limited matches REPD operator BP/EnBW joint venture.",
    },
    "10922": {
        "layer": "crown-estate-wind-sites.geojson",
        "feature": "Morecambe",
        "evidence": "REPD spells the site 'Morecombe'; the lease register spells it 'Morecambe'. Tenant Morecambe Offshore Windfarm Ltd. Lease nearest edge is 29.3 km from Blackpool against REPD's stated '30km offshore from Blackpool'.",
    },
    "11109": {
        "layer": "crown-estate-wind-sites.geojson",
        "feature": "R4 Project 2 (Dogger Bank South East)",
        "evidence": "Lease name contains the REPD site name verbatim; tenant RWE Renewables matches REPD operator.",
    },
    "20217": {
        "layer": "crown-estate-wind-sites.geojson",
        "feature": "R4 Project 1 (Dogger Bank South West)",
        "evidence": "Lease name contains the REPD site name verbatim; tenant RWE Renewables matches REPD operator.",
    },
    "11613": {
        "layer": "crown-estate-scotland-wind-sites.geojson",
        "feature": "Buchan Offshore Wind Farm",
        "evidence": "REPD 'Fraserburgh - Buchan Floating Wind Project', 1000 MW, address 'Ne/O Fraserburgh'. Lease Buchan Offshore Wind Farm, 960 MW, sole BayWa ScotWind holding, lease nearest edge 76 km NNE of Fraserburgh.",
    },
    "13417": {
        "layer": "crown-estate-scotland-wind-sites.geojson",
        "feature": "Ayre Offshore Wind Farm",
        "evidence": "REPD 'Cluaran Deas Ear / Ayre Wind Farm (Thistle South East)', 1008 MW, '33km offshore from Orkney'. Lease Ayre, 1008 MW exact, nearest edge 36 km from Kirkwall. Thistle Wind Partners' other 1008 MW lease, Bowdun, lies 200 km south off Stonehaven and is excluded by the stated distance from Orkney.",
    },
    "13428": {
        "layer": "crown-estate-scotland-wind-sites.geojson",
        "feature": "MachairWind",
        "evidence": "REPD 'Machair', 2000 MW, 'north-west of Islay and west of Colonsay'. Lease MachairWind, 2000 MW exact, bbox -6.96..-6.45 lon / 55.81..56.17 lat, which is north-west of Islay and west of Colonsay.",
    },
    "13429": {
        "layer": "crown-estate-scotland-wind-sites.geojson",
        "feature": "Ossian Offshore Wind Farm",
        "evidence": "Lease property name contains the REPD site name; 3528 MW against REPD's 3600 MW; nearest edge 83 km from Aberdeen against REPD's '80 km SE of Aberdeenshire coast'.",
    },
    "13431": {
        "layer": "crown-estate-scotland-wind-sites.geojson",
        "feature": "Muir Mhor",
        "evidence": "REPD 'Muir Mhor', 1000 MW, '63km east of Peterhead'. Lease Muir Mhor, 1000 MW exact, sole Vattenfall ScotWind holding, nearest edge 63.7 km east of Peterhead.",
    },
    "13432": {
        "layer": "crown-estate-scotland-wind-sites.geojson",
        "feature": "MarramWind",
        "evidence": "REPD 'Marram', 3000 MW, operator Shell New Energies / ScottishPower Renewables. Lease MarramWind, 3000 MW exact, tenant MarramWind Limited, the Shell/SPR joint venture; nearest edge 81 km from Peterhead against REPD's '75 km off the north-east coast'.",
    },
    "13528": {
        "layer": "crown-estate-scotland-wind-sites.geojson",
        "feature": "Cenos",
        "evidence": "REPD 'Cenos Offshore Wind Farm', 1350 MW, address 'INTOG 11'. Lease Cenos, 1350 MW exact, tenant Cenos Offshore Windfarm; the same polygon is INTOG application area ID 11 on the Crown Estate Scotland INTOG layer.",
    },
    "13735": {
        "layer": "crown-estate-scotland-wind-sites.geojson",
        "feature": "Spiorad na Mara",
        "evidence": "Lease property name matches the REPD site name exactly; 900 MW exact; tenant Spiorad Na Mara Limited; lease bbox lies immediately off the west coast of Lewis, against REPD's '5km off the west coast of Lewis'.",
    },
    # Morven is one lease. REPD splits it into two projects, North and South, of
    # 1450 MW each against the lease's 2907 MW. The lease geometry is a single
    # polygon and does not record where the register's split falls, so both rows
    # get the whole-lease point and say so. Inventing a dividing line would be
    # inventing a coordinate.
    "10920": {
        "layer": "crown-estate-scotland-wind-sites.geojson",
        "feature": "Morven",
        "evidence": "REPD 'Morven North', 1450 MW, '61km off the Aberdeenshire Coast', operator BP/EnBW. Lease Morven, 2907 MW, tenant Morven Offshore Wind Limited; REPD's North plus South is 2900 MW against the lease's 2907 MW; lease nearest edge 63.5 km from Stonehaven.",
        "precision_km": 30.0,
        "notes": "Whole-lease point. The register splits this single Crown Estate Scotland lease into Morven North and Morven South; the lease geometry does not distinguish them, so both REPD rows resolve to the same point. The lease spans roughly 52 km north to south, hence the stated precision.",
    },
    "21087": {
        "layer": "crown-estate-scotland-wind-sites.geojson",
        "feature": "Morven",
        "evidence": "REPD 'Morven South', 1450 MW, '61km off the Aberdeenshire Coast', operator BP/EnBW. Lease Morven, 2907 MW, tenant Morven Offshore Wind Limited; REPD's North plus South is 2900 MW against the lease's 2907 MW; lease nearest edge 63.5 km from Stonehaven.",
        "precision_km": 30.0,
        "notes": "Whole-lease point. The register splits this single Crown Estate Scotland lease into Morven North and Morven South; the lease geometry does not distinguish them, so both REPD rows resolve to the same point. The lease spans roughly 52 km north to south, hence the stated precision.",
    },
}

# ---------------------------------------------------------------------------
# Rows located from something other than a seabed lease. Each carries the source
# it came from and what the coordinate actually denotes. These are researched
# rather than computed, so they are written down here in full and re-emitted
# deterministically; nothing in this block is derived from a name.
# ---------------------------------------------------------------------------

CURATED: list[dict] = [
    {
        "repd_ref": "10603",
        "grid_ref": "NN 03615 17578",
        "easting": 203615,
        "northing": 717578,
        "method": "GRID_REFERENCE_CONVERTED_OSGB36_TO_WGS84",
        "source_url": "https://www.energyconsents.scot/ApplicationDetails.aspx?cr=ECU00003444",
        "precision_km": 3.0,
        "region": "Scotland",
        "notes": "Central national grid reference NN 03615 17578, stated twice: on the Energy Consents Unit page for ECU00003444 ('NGR 03615 17578 in Argyll and Bute close to Lochan Airigh ... approximately 4.4 km to the south of the village of Portsonachan'), and in the Balliemeanoch Pumped Storage Hydro Scoping Report (AECOM for ILI), section 2.1, which supplies the NN prefix: https://www.balliemeanochpsh.co.uk/Balliemeanoch_Scoping_Report.pdf. Scheme centre of a multi-component pumped-storage development spanning Lochan Airigh, Loch Awe and Loch Fyne, hence the stated precision. Check: the converted point is 4.68 km south of Portsonachan against the document's 4.4 km.",
    },
    {
        "repd_ref": "14546",
        "grid_ref": None,
        "easting": 235551,
        "northing": 601181,
        "method": "GRID_REFERENCE_CONVERTED_OSGB36_TO_WGS84",
        "source_url": "https://www.energyconsents.scot/ApplicationDetails.aspx?cr=ECU00004830",
        "precision_km": 2.5,
        "region": "Scotland",
        "notes": "Central grid reference Easting 235551, Northing 601181, from the statutory Electricity Act 1989 section 36 public notice ('Back Fell Wind Farm S36 Advert') in the ECU00004830 document library. Applicant's declared application-site centre. The scoping report's 14-turbine indicative layout spans E 234173-237009 / N 600622-602551 and brackets this point. Note: REPD's address says '900m south of Straiton'; the converted point is 2.34 km from Straiton (KA19 7QS, the postcode the advert itself quotes), which agrees with the scoping report's own '2.6km south of Straiton' and not with REPD's prose. Secondary web sources quote Northing 601871 - that figure does not appear in the advert and is not used here.",
    },
    {
        "repd_ref": "14547",
        "grid_ref": None,
        "easting": 235551,
        "northing": 601181,
        "method": "GRID_REFERENCE_CONVERTED_OSGB36_TO_WGS84",
        "source_url": "https://www.energyconsents.scot/ApplicationDetails.aspx?cr=ECU00004830",
        "precision_km": 2.5,
        "region": "Scotland",
        "notes": "Battery element of Back Fell Wind Farm, same ECU reference ECU00004830 and same section 36 advert centre as ref 14546.",
    },
    {
        "repd_ref": "15385",
        "grid_ref": "NS 65411 08094",
        "easting": 265411,
        "northing": 608094,
        "method": "GRID_REFERENCE_CONVERTED_OSGB36_TO_WGS84",
        "source_url": "https://www.energyconsents.scot/ApplicationDetails.aspx?cr=ECU00004967",
        "precision_km": 3.0,
        "region": "Scotland",
        "notes": "Site centre NS 65411 08094, stated identically in three primary documents in the ECU00004967 library: the Edinburgh Gazette section 36 notice of 27 January 2026 (issue 29226), and EIA Report Volume 1 chapters 1 and 5. This is the repowering application boundary centre, not the existing wind farm, which lies 2.7 km west. The applied-for 23-turbine table in EIA Vol 1 Ch 5 Table 5.3 spans E 264500-268025 / N 605539-610678 and brackets this point. Recorded discrepancy: the Gazette notice describes the site as 'approximately 1.5 km south east of New Cumnock', but this centre is 6.7 km south east of New Cumnock; the numeric grid reference and the turbine table agree with each other and the prose does not, so the numbers are used.",
    },
    {
        "repd_ref": "15386",
        "grid_ref": "NS 65411 08094",
        "easting": 265411,
        "northing": 608094,
        "method": "GRID_REFERENCE_CONVERTED_OSGB36_TO_WGS84",
        "source_url": "https://www.energyconsents.scot/ApplicationDetails.aspx?cr=ECU00004967",
        "precision_km": 3.0,
        "region": "Scotland",
        "notes": "Battery element of the Hare Hill repowering, same ECU reference ECU00004967 and same site centre as ref 15385.",
    },
    {
        "repd_ref": "15368",
        "longitude": -2.829821,
        "latitude": 59.152274,
        "method": "DEVELOPER_PUBLISHED_ARRAY_CENTRE_WGS84",
        "source_url": "https://marine.gov.scot/sites/default/files/seastar_pid_v1.0.pdf",
        "precision_km": 0.6,
        "region": "Scotland",
        "notes": "Array centre 59 09 08.188 N, 2 49 47.354 W, published in WGS 84 in the SEASTAR Project Information Document v1.0 (Nova Innovation), section 3.1 Table 5, hosted by the Scottish Government Marine Directorate; marine licence MS-00010650. The site is EMEC's Fall of Warness tidal test site west of Eday, Orkney - it is inside EMEC's existing lease and is not a separate Crown Estate Scotland lease, which is why it does not appear in the lease layers. Corroborated by the Crown Estate Scotland tidal lease layer, whose 'EMEC Fall of Warness' polygon point-on-surface lies 1.6 km away. Caution: REPD's postcode district KW16 is EMEC's Stromness office, not the deployment site.",
    },
    {
        "repd_ref": "17134",
        "longitude": -2.830441,
        "latitude": 59.14681,
        "method": "DEVELOPER_PUBLISHED_ARRAY_CENTRE_WGS84",
        "source_url": "https://marine.gov.scot/sites/default/files/oceanstar_pid_v1.0.pdf",
        "precision_km": 1.5,
        "region": "Scotland",
        "notes": "Array centre 59 08 48.516 N, 2 49 49.587 W, published in WGS 84 in the OCEANSTAR Project Information Document v1.0 (Nova Innovation), section 3.1 Table 5, hosted by the Scottish Government Marine Directorate; marine licence application 00010649. Same EMEC Fall of Warness site as ref 15368, 0.6 km south of the SEASTAR array centre. The PID states the array will sit toward the north of the licensed project area, so the centre point and the project-area box are not concentric; hence the wider stated precision. Caution: REPD's postcode district KW16 is EMEC's Stromness office, not the deployment site.",
    },
    {
        "repd_ref": "17260",
        "longitude": -6.472908,
        "latitude": 54.758041,
        "method": "POSTCODE_CENTROID_FROM_REPD_ADDRESS",
        "source_url": "https://api.postcodes.io/postcodes/BT41%203SF",
        "precision_km": 0.2,
        "region": "Northern Ireland",
        "notes": "Full unit postcode BT41 3SF from the REPD postcode column, resolved to its ONS/OSNI unit-postcode centroid (quality 1, within the building). REPD address 'Steeple Road', Antrim. This is the postcode centroid, not the solar farm boundary.",
    },
    {
        "repd_ref": "17044",
        "longitude": -2.05618,
        "latitude": 49.180893,
        "method": "OSM_WAY_CENTROID_OF_NAMED_ROAD",
        "source_url": "https://www.openstreetmap.org/way/166491249",
        "precision_km": 0.5,
        "region": "Channel Islands",
        "notes": "OpenStreetMap way 166491249, 'Rue du Moulin a Vent', in St Clement, Jersey, matching the REPD address 'La Rue Du Moulin A Vent, St Clement'. Jersey postcodes are not covered by postcodes.io. This locates the road, not fields C210/C213/C214/C221.",
    },
    {
        "repd_ref": "17120",
        "longitude": -2.173967,
        "latitude": 49.243318,
        "method": "OSM_WAY_CENTROID_OF_NAMED_ROAD",
        "source_url": "https://www.openstreetmap.org/way/169432715",
        "precision_km": 0.5,
        "region": "Channel Islands",
        "notes": "OpenStreetMap way 169432715, 'La Hougue Mauger', in St Mary, Jersey, matching the REPD address 'La Rue De La Hougue Mauger, St Mary'. Jersey postcodes resolve in postcodes.io but carry null coordinates. This locates the road, not the My4xx/My6xx fields.",
    },
]

# repd_refs deliberately left out, with the reason. Written into the output so
# that the omission is a recorded decision rather than an oversight.
OMITTED = {
    "1613": "Portfolio row: 169 individual Sainsbury's stores across Great Britain. No single location exists and REPD gives neither address nor postcode.",
    "1616": "Portfolio row: First Wessex housing stock across Aldershot, Eastleigh and Portsmouth, three separate towns. No single location exists.",
    "9947": "Portfolio row: 'Various Locations Throughout Bristol'. Only a postcode district, BS1, which is the city centre and not where the council's roof arrays are.",
    "20447": "Portfolio row: 'Various Locations Throughout Exeter'. No postcode and no single location.",
}


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------


def point_on_surface(geometry: dict) -> tuple[float, float] | None:
    """A point guaranteed to lie inside the polygon, unlike a centroid.

    Ray-cast across the largest ring at its median latitude and take the midpoint
    of the widest interior span.
    """
    kind = (geometry or {}).get("type")
    if kind == "Polygon":
        rings = geometry.get("coordinates") or []
    elif kind == "MultiPolygon":
        rings = [ring for poly in (geometry.get("coordinates") or []) for ring in poly]
    else:
        return None
    if not rings:
        return None

    def shoelace(ring: list) -> float:
        total = 0.0
        for i in range(len(ring)):
            x1, y1 = ring[i - 1][0], ring[i - 1][1]
            x2, y2 = ring[i][0], ring[i][1]
            total += x1 * y2 - x2 * y1
        return abs(total) / 2.0

    ring = max(rings, key=shoelace)
    lats = sorted(point[1] for point in ring)
    y = lats[len(lats) // 2]

    crossings: list[float] = []
    for i in range(len(ring)):
        x1, y1 = ring[i - 1][0], ring[i - 1][1]
        x2, y2 = ring[i][0], ring[i][1]
        if (y1 > y) != (y2 > y):
            crossings.append(x1 + (y - y1) / (y2 - y1) * (x2 - x1))
    crossings.sort()

    widest, x = -1.0, None
    for i in range(0, len(crossings) - 1, 2):
        span = crossings[i + 1] - crossings[i]
        if span > widest:
            widest, x = span, (crossings[i] + crossings[i + 1]) / 2.0
    if x is None:
        return None
    return round(x, 6), round(y, 6)


def osgb36_en_to_wgs84(easting: float, northing: float) -> tuple[float, float]:
    """OSGB36 National Grid eastings/northings to WGS84 longitude/latitude.

    Inverse Transverse Mercator on the Airy 1830 ellipsoid, then the standard
    7-parameter Helmert shift OSGB36 -> WGS84. This is the Ordnance Survey
    "approximate" transformation and is good to about 5 m; OSTN15, which is the
    rigorous one, is a gridded correction and is deliberately not applied here.
    Any coordinate produced by this function must say so in its method field.

    Kept in the tool rather than in a notebook so that a grid reference quoted
    in a planning document can be converted reproducibly.
    """
    a, b = 6377563.396, 6356256.909  # Airy 1830
    f0, lat0, lon0 = 0.9996012717, math.radians(49.0), math.radians(-2.0)
    n0, e0 = -100000.0, 400000.0
    e2 = 1 - (b * b) / (a * a)
    n = (a - b) / (a + b)

    lat = lat0
    m = 0.0
    for _ in range(100):
        lat = (northing - n0 - m) / (a * f0) + lat
        dlat, slat = lat - lat0, lat + lat0
        m = b * f0 * (
            (1 + n + 1.25 * n * n + 1.25 * n ** 3) * dlat
            - (3 * n + 3 * n * n + 2.625 * n ** 3) * math.sin(dlat) * math.cos(slat)
            + (1.875 * n * n + 1.875 * n ** 3) * math.sin(2 * dlat) * math.cos(2 * slat)
            - (35.0 / 24.0) * n ** 3 * math.sin(3 * dlat) * math.cos(3 * slat)
        )
        if abs(northing - n0 - m) < 1e-5:
            break

    sl, cl, tl = math.sin(lat), math.cos(lat), math.tan(lat)
    nu = a * f0 / math.sqrt(1 - e2 * sl * sl)
    rho = a * f0 * (1 - e2) / (1 - e2 * sl * sl) ** 1.5
    eta2 = nu / rho - 1
    t2, t4, t6 = tl ** 2, tl ** 4, tl ** 6
    vii = tl / (2 * rho * nu)
    viii = tl / (24 * rho * nu ** 3) * (5 + 3 * t2 + eta2 - 9 * t2 * eta2)
    ix = tl / (720 * rho * nu ** 5) * (61 + 90 * t2 + 45 * t4)
    x_ = 1 / (cl * nu)
    xi = 1 / (cl * 6 * nu ** 3) * (nu / rho + 2 * t2)
    xii = 1 / (cl * 120 * nu ** 5) * (5 + 28 * t2 + 24 * t4)
    xiia = 1 / (cl * 5040 * nu ** 7) * (61 + 662 * t2 + 1320 * t4 + 720 * t6)
    de = easting - e0
    lat_a = lat - vii * de ** 2 + viii * de ** 4 - ix * de ** 6
    lon_a = lon0 + x_ * de - xi * de ** 3 + xii * de ** 5 - xiia * de ** 7

    # Airy 1830 geodetic -> cartesian, Helmert, -> WGS84 geodetic.
    sa, ca = math.sin(lat_a), math.cos(lat_a)
    v = a / math.sqrt(1 - e2 * sa * sa)
    x = v * ca * math.cos(lon_a)
    y = v * ca * math.sin(lon_a)
    z = (1 - e2) * v * sa
    tx, ty, tz = 446.448, -125.157, 542.060
    s = 20.4894e-6
    rx, ry, rz = (math.radians(v / 3600.0) for v in (0.1502, 0.2470, 0.8421))
    x2 = tx + x * (1 + s) + (-rz) * y + ry * z
    y2 = ty + rz * x + y * (1 + s) + (-rx) * z
    z2 = tz + (-ry) * x + rx * y + z * (1 + s)

    a2, b2 = 6378137.000, 6356752.3141  # WGS84
    e2b = 1 - (b2 * b2) / (a2 * a2)
    p = math.sqrt(x2 * x2 + y2 * y2)
    lat_b = math.atan2(z2, p * (1 - e2b))
    for _ in range(100):
        v2 = a2 / math.sqrt(1 - e2b * math.sin(lat_b) ** 2)
        new = math.atan2(z2 + e2b * v2 * math.sin(lat_b), p)
        if abs(new - lat_b) < 1e-12:
            lat_b = new
            break
        lat_b = new
    return round(math.degrees(math.atan2(y2, x2)), 6), round(math.degrees(lat_b), 6)


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    (x1, y1), (x2, y2) = a, b
    p1, p2 = math.radians(y1), math.radians(y2)
    h = (
        math.sin((p2 - p1) / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(math.radians(x2 - x1) / 2) ** 2
    )
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------


def fetch_layer(filename: str, spec: dict, offline: bool) -> dict:
    """Return a layer's GeoJSON, from the publisher or from the local cache."""
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / filename
    if offline:
        if not cached.is_file():
            raise SystemExit(f"--offline but no cached copy of {filename} in {CACHE}")
        return json.loads(cached.read_text(encoding="utf-8"))
    url = spec["url"] + QUERY
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "gridatlas-reconcile/2"})
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if not payload.get("features"):
            raise ValueError("no features returned")
        cached.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        print(f"  fetched  {filename}  {len(payload['features'])} features")
        return payload
    except Exception as error:  # network down, service moved, schema changed
        if cached.is_file():
            print(f"  WARNING  {filename}: {error}; using cache", file=sys.stderr)
            return json.loads(cached.read_text(encoding="utf-8"))
        raise SystemExit(f"cannot fetch {filename} ({error}) and no cache in {CACHE}")


# The browser registry carries U+FFFD in a handful of fields: an upstream REPD
# export was decoded with the wrong codec before it reached us, so "Muir Mhor"
# lost its accented o and REPD's standard redaction em-dash became a replacement
# character. Repaired on the way out so this file does not appear to have
# corrupted them; the registry itself is not edited here, and only substitutions
# whose correct form is unambiguous are listed.
MOJIBAKE = {
    "Muir Mh�r": "Muir Mhòr",
    "WITHHELD � POSSIBLE INDIVIDUAL": "WITHHELD — POSSIBLE INDIVIDUAL",
}


def repair(text: str) -> str:
    return MOJIBAKE.get(text, text)


def load_registry() -> list[dict]:
    payload = json.loads(REGISTRY.read_text(encoding="utf-8"))
    return payload.get("records") or []


def unlocated(records: list[dict]) -> list[dict]:
    """Rows carrying the placeholder point, in register order."""
    rows = [
        r
        for r in records
        if r.get("longitude") == PLACEHOLDER[0] and r.get("latitude") == PLACEHOLDER[1]
    ]
    return sorted(rows, key=lambda r: int(r["repd_ref"]))


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------


def build(offline: bool) -> dict:
    records = load_registry()
    gaps = unlocated(records)
    by_ref = {r["repd_ref"]: r for r in gaps}

    layers = {name: fetch_layer(name, spec, offline) for name, spec in LAYERS.items()}
    index: dict[str, dict] = {}
    for name, payload in layers.items():
        spec = LAYERS[name]
        for feature in payload.get("features") or []:
            properties = feature.get("properties") or {}
            key = str(properties.get(spec["name_field"]) or "").strip()
            if key:
                index[f"{name}::{key}"] = (feature, properties, spec)

    coordinates: list[dict] = []

    for ref, bind in LEASE_BINDS.items():
        row = by_ref.get(ref)
        if row is None:
            print(f"  NOTE     {ref} is bound here but is no longer unlocated", file=sys.stderr)
        found = index.get(f"{bind['layer']}::{bind['feature']}")
        if found is None:
            print(
                f"  MISSING  {ref}: '{bind['feature']}' is not in {bind['layer']}; omitted",
                file=sys.stderr,
            )
            continue
        feature, properties, spec = found
        point = point_on_surface(feature.get("geometry") or {})
        if point is None:
            print(f"  MISSING  {ref}: '{bind['feature']}' has no usable polygon", file=sys.stderr)
            continue
        entry = {
            "repd_ref": ref,
            "site_name": repair((row or {}).get("name", "")),
            "operator": repair((row or {}).get("repd_operator_or_applicant") or ""),
            "matched_lease": bind["feature"],
            "tenant": str(properties.get(spec["tenant_field"]) or "").strip() or None,
            "region": spec["region"],
            "source_file": bind["layer"],
            "longitude": point[0],
            "latitude": point[1],
            "crs": "EPSG:4326",
            "method": "CROWN_ESTATE_LEASE_POINT_ON_SURFACE",
            "source_url": spec["url"],
            "publisher": spec["publisher"],
            "evidence": bind["evidence"],
        }
        if spec["capacity_field"]:
            entry["lease_capacity_mw"] = properties.get(spec["capacity_field"])
        if "precision_km" in bind:
            entry["precision_km"] = bind["precision_km"]
        if "notes" in bind:
            entry["notes"] = bind["notes"]
        coordinates.append(entry)

    for curated in CURATED:
        row = by_ref.get(curated["repd_ref"])
        # A row given as eastings/northings is converted here rather than by hand,
        # so the published grid reference stays visible in the output beside the
        # degrees it became, and the conversion is rerunnable.
        if "easting" in curated:
            longitude, latitude = osgb36_en_to_wgs84(curated["easting"], curated["northing"])
        else:
            longitude, latitude = curated["longitude"], curated["latitude"]
        entry = {
            "repd_ref": curated["repd_ref"],
            "site_name": repair((row or {}).get("name", "")),
            "operator": repair((row or {}).get("repd_operator_or_applicant") or ""),
            "matched_lease": None,
            "tenant": None,
            "region": curated.get("region"),
            "source_file": None,
            "longitude": longitude,
            "latitude": latitude,
            "crs": "EPSG:4326",
            "method": curated["method"],
            "source_url": curated["source_url"],
            "precision_km": curated["precision_km"],
            "notes": curated["notes"],
        }
        if "easting" in curated:
            entry["source_easting_northing_osgb36"] = [curated["easting"], curated["northing"]]
            entry["source_grid_reference"] = curated.get("grid_ref")
            entry["transform"] = (
                "Airy 1830 inverse Transverse Mercator, then Helmert 7-parameter OSGB36->WGS84 "
                "(tx=+446.448 ty=-125.157 tz=+542.060 m, s=+20.4894 ppm, "
                "rx=+0.1502\" ry=+0.2470\" rz=+0.8421\"). OSTN15 not applied. "
                "Verified against six postcodes.io points that publish both OSGB36 eastings/northings "
                "and WGS84 degrees, spanning Argyll to Redcar: maximum error 2.7 m, mean 2.0 m."
            )
        coordinates.append(entry)

    coordinates.sort(key=lambda e: int(e["repd_ref"]))

    resolved = {e["repd_ref"] for e in coordinates}
    unresolved = []
    for row in gaps:
        ref = row["repd_ref"]
        if ref in resolved:
            continue
        unresolved.append(
            {
                "repd_ref": ref,
                "site_name": repair(row.get("name", "")),
                "technology": row.get("technology"),
                "reason": OMITTED.get(
                    ref,
                    "No coordinate found in a public source that could be bound to this row. "
                    "Omitted rather than approximated.",
                ),
            }
        )

    return {
        "schema": "gridatlas.offshore-coordinates.v1",
        "generated_utc": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "purpose": (
            "Coordinates for REPD rows that the register itself does not locate - the rows that "
            "reach the browser registry carrying the shared placeholder point -7.55716, 49.766807. "
            "Derived, not authoritative: REPD remains the register and is never edited by this "
            "tool, and every row here names the public source its coordinate came from. Rows that "
            "could not be bound to a source are listed under unresolved rather than estimated."
        ),
        "placeholder_coordinate": {"longitude": PLACEHOLDER[0], "latitude": PLACEHOLDER[1]},
        "sources": {
            "registry": REGISTRY.relative_to(REPO).as_posix(),
            "lease_layers": [
                {"file": name, "url": spec["url"], "publisher": spec["publisher"], "portal": spec["portal"]}
                for name, spec in LAYERS.items()
            ],
            "other": [
                "https://api.postcodes.io/ (ONS/OSNI postcode centroids)",
                "https://www.openstreetmap.org/ (ODbL, © OpenStreetMap contributors)",
            ],
        },
        "register": {
            "rows": len(records),
            "placeholder_rows": len(gaps),
        },
        "resolved": len(coordinates),
        "unresolved_count": len(unresolved),
        "coordinates": coordinates,
        "unresolved": unresolved,
    }


def sanity(report: dict) -> list[str]:
    """Every check that would catch a fabricated or misplaced point."""
    problems = []
    seen = set()
    for entry in report["coordinates"]:
        ref, lon, lat = entry["repd_ref"], entry["longitude"], entry["latitude"]
        if lon is None or lat is None:
            problems.append(f"{ref}: null coordinate in the coordinates array")
            continue
        if haversine_km((lon, lat), PLACEHOLDER) < 0.001:
            problems.append(f"{ref}: equals the placeholder point")
        if abs(lon) < 0.01 and abs(lat) < 0.01:
            problems.append(f"{ref}: Null Island")
        if not (GB_BOUNDS[0] <= lon <= GB_BOUNDS[2] and GB_BOUNDS[1] <= lat <= GB_BOUNDS[3]):
            problems.append(f"{ref}: {lon},{lat} is outside the UK/CI envelope {GB_BOUNDS}")
        if not entry.get("method") or not (entry.get("source_url") or entry.get("source_file")):
            problems.append(f"{ref}: no method or no source")
        if ref in seen:
            problems.append(f"{ref}: duplicated")
        seen.add(ref)
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument("--offline", action="store_true", help="use the cached lease layers only")
    parser.add_argument("--check", action="store_true", help="run the checks, write nothing")
    args = parser.parse_args()

    report = build(args.offline)

    print(f"  registry        {report['register']['rows']} rows, "
          f"{report['register']['placeholder_rows']} carrying the placeholder")
    print(f"  RESOLVED        {report['resolved']}")
    print(f"  unresolved      {report['unresolved_count']}")
    for entry in report["coordinates"]:
        precision = f"  ±{entry['precision_km']}km" if entry.get("precision_km") else ""
        print(f"    {entry['repd_ref']:<8}{entry['site_name'][:36]:<38}"
              f"{entry['longitude']:>11.6f},{entry['latitude']:>10.6f}  {entry['method']}{precision}")
    for entry in report["unresolved"]:
        print(f"    {entry['repd_ref']:<8}{entry['site_name'][:36]:<38}omitted")

    problems = sanity(report)
    if problems:
        print("\n  SANITY FAILURES", file=sys.stderr)
        for problem in problems:
            print(f"    {problem}", file=sys.stderr)
        return 1
    print(f"\n  sanity          {report['resolved']} coordinates, no failures")

    if args.check:
        out_path = Path(args.out)
        if not out_path.exists():
            print(f"  {out_path} does not exist yet", file=sys.stderr)
            return 1
        previous = json.loads(out_path.read_text(encoding="utf-8"))
        before = len([c for c in previous.get("coordinates", []) if c.get("longitude") is not None])
        if report["resolved"] < before:
            print(f"  REGRESSED: {report['resolved']} against {before} committed", file=sys.stderr)
            return 1
        print(f"  no regression ({report['resolved']} >= {before})")
        return 0

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"  written         {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
