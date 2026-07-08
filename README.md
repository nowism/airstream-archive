# The Airstream Archive

An independent, illustrated history of Airstream travel trailers and motorhomes —
a page for **every model** and **every model-year** since **1931**, plus vintage
advertising, books, the Wally Byam caravans, a glossary, and more.

**Live:** https://nowism.github.io/airstream-archive/

It's a fast, dependency-free, **static multi-page site**: hand-written HTML/CSS/vanilla
JS, no framework and no build step. All content lives in JSON files under `data/`, so the
site grows by editing data, not code.

## Run it locally

The pages load their content from `data/*.json` with `fetch()`, so serve them over HTTP
(don't double-click the files):

```bash
cd AirstreamTrailer
python3 -m http.server 8722
# then visit http://localhost:8722
```

Any static host works — GitHub Pages (current), Netlify, Cloudflare, S3, etc.

## Pages & layout

Each section is its own real page (its own URL, `<title>` and meta description):

```
/            index.html          Home — hero + era timeline
/models/     models/index.html   The model archive (+ per-model & per-year detail)
/stoves/     stoves/index.html   Navigator Stove Works feature
/caravans/   caravans/index.html The Wally Byam caravans
/find/       find/index.html     "Find your Airstream" quiz + Compare tool
/ads/        ads/index.html      Vintage advertising archive
/books/      books/index.html    The Airstream bookshelf
/glossary/   glossary/index.html Airstream glossary
/about/      about/index.html    About

css/styles.css   All styling (polished-aluminum / road-blue theme)
js/app.js        Everything: shared shell, per-page rendering, router, lightbox
data/*.json      All content (see below)
assets/ads/      Vintage ad scans        assets/books/  Book covers
scripts/         One-off data generators (not served)
```

### How the shared shell works

There's still **one source of truth** even though the header/footer are on every page:
`js/app.js` **injects** the header, nav, footer, and lightbox into each page (so they're
not copy-pasted across nine files), and highlights the current page in the nav.

Each page's `<body data-page="...">` tells `app.js` which section to render. `app.js`
also derives the **site root from its own script URL**, so assets, `data/` fetches, and
cross-page links work from any folder depth and on any host (localhost or a project
subpath like `/airstream-archive/`). To add a new page: create `newsection/index.html`
(copy an existing one, set `data-page`, use `../css` / `../js` paths) and add a
`case 'newsection':` to the dispatch in `init()`.

## Data files

| File | Holds |
|------|-------|
| `data/airstream.json` | Eras, models, specs, floor plans, photos, `meta.milestones`, `meta.funFacts`, `meta.yearImages`, `meta.market` (weights/rarity/value), `meta.serial`, `meta.community` |
| `data/ads.json` | The vintage-ad index (year, label, category, file) |
| `data/books.json` | The bookshelf (title, authors, year, category, description, cover, asin, `meta.amazonTag`) |
| `data/context.json` | Per-year "that year in America" (gas, car, note) |
| `data/extras.json` | Caravans, glossary, and the Navigator stoves feature |

Data fetches use `cache: 'no-cache'`, so edits appear on reload without bumping the
`?v=` asset version (that param only busts cache for `css/styles.css` and `js/app.js`).

## A page for every model & year

On `/models/`, drilling into a model uses fast in-page routing (the archive swaps for a
detail view, no reload):

- `/models/#/model/<id>` — a model overview: specs, weights, collectibility/value, serial
  info, floor plans, and a grid linking to **every year** in its production run.
- `/models/#/model/<id>/<year>` — an individual year page (e.g.
  `/models/#/model/safari/1965`) with the model's specs plus **that exact year's ads,
  brochures and floor-plan sheets**, inflation-adjusted price, "that year in America"
  context, a Wally Byam quote, a fun fact, a documented milestone (if any), collectibility
  & value, a serial/VIN decoder, sibling/adjacent-year links, and an owner-community
  block. Prev/next-year navigation included.

Year pages generate from the data at runtime — add a model or widen its
`yearStart`/`yearEnd` and the pages appear automatically. Ads match a year via
`data/ads.json`. Year-specific hero photos come from `meta.yearImages` (`"<id>/<year>"`),
falling back to the model's default photo.

## Adding a model

Append to the `models` array in `data/airstream.json`:

```json
{
  "id": "unique-slug",
  "name": "Model Name",
  "era": "goldenage",
  "yearStart": 1965, "yearEnd": 1969,
  "type": "Travel Trailer",
  "lengths": ["22 ft", "24 ft"],
  "sleeps": "4",
  "priceNew": "≈ $3,000",
  "floorplans": ["Front bedroom, center bath, rear lounge & galley"],
  "highlights": ["Notable feature one", "Notable feature two"],
  "description": "A paragraph of history and context.",
  "images": [ { "file": "…jpg", "caption": "…", "credit": "Wikimedia Commons" } ],
  "ads": [ { "note": "…", "archive": "https://…" } ]
}
```

Optional extras keyed by model `id`: `meta.funFacts["<id>"]`, `meta.market["<id>"]`
(dry/gvwr/hitch/rarity/level/why/value/production), and `meta.yearImages["<id>/<year>"]`.

## Photos

Photos embed from **Wikimedia Commons** via stable `Special:FilePath` URLs (freely
licensed, credited, with a link back). References that are a URL or contain a `/`
(e.g. `assets/ads/1961.jpg`) are treated as **local files** and pass through as-is — so
you can mix Commons filenames and your own hosted images in any `images` array.

## Vintage advertising

800+ original Airstream ads, brochures and factory floor-plan sheets (1932–1991) live in
`assets/ads/`, indexed by `data/ads.json`. Browse `/ads/` by decade and type; relevant
ads also surface on each model-year page. Every ad opens in a navigable, full-resolution
lightbox.

Regenerate the index with `scripts/build_ads.py` (copies scans with web-safe names,
grouping by the 4-digit year in each file/folder name), or append entries manually:

```json
{ "file": "assets/ads/1961_ROAD_TEST.jpg", "year": 1961,
  "label": "1961 Road Test", "folder": "", "category": "ad" }
```

`category` ∈ `ad | brochure | floorplan | argosy`.

## Books & Amazon links

`data/books.json` is a categorized bibliography with a hand-written `description` and a
cover (in `assets/books/`, from Open Library) where one exists. Books with a verified
ISBN carry an `asin` and link to the Amazon product page (`/dp/<asin>`); the rest fall
back to an Amazon search. Helpers: `scripts/fetch_book_covers.py`,
`scripts/fetch_book_asins.py` (always eyeball their matches — obscure titles can mis-match).

**Affiliate:** set `meta.amazonTag` in `data/books.json` to your Amazon Associates ID and
every link carries `tag=…` (product + search). Links use `rel="sponsored nofollow"`.

## Caravans, glossary & stoves

All in `data/extras.json`:

- **`caravans`** — the Wally Byam journeys, illustrated with authentic period photos from
  `assets/ads/`.
- **`glossary`** — vintage-Airstream terms (auto-alphabetized).
- **`stoves`** — the Navigator Stove Works feature (company copy, the "why we love these"
  block, a not-sponsored disclosure, and the four-model lineup with specs, prices and
  links). Stove photos are **hotlinked from marinestove.com** and credited; a failed image
  hides itself rather than showing a broken icon.

## Deployment (GitHub Pages)

Served from the `main` branch root. `.nojekyll` makes Pages serve files as-is;
`wrangler.toml` + `.assetsignore` are for an optional Cloudflare Workers deploy and keep
`.git`/tooling out of the upload. Push to `main` and Pages rebuilds automatically.

## Accuracy note

Airstream often sold several lengths and floor plans under one model name in a single
year. Figures here are the best publicly documented values, representative of each
**model line**; weights, rarity and resale values are ballpark and condition-dependent.
Treat specific-year details as a starting point for deeper research.

## Legal

Independent, non-commercial history project. "Airstream" and the model names are
trademarks of their owner, used here for identification and educational purposes only.
Wikimedia photographs are © their respective contributors under the licenses on each
source page; vintage advertising is from a private collection; Navigator stove photos are
© Navigator Stove Works.
