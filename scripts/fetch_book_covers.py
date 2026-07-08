#!/usr/bin/env python3
"""Look up each book on Open Library and download a cover thumbnail if one exists.
Prints a report; writes covers to assets/books/<slug>.jpg."""
import json, os, re, urllib.parse, urllib.request, time

DEST = "/Users/danburke/EWUA Dropbox/Dan Burke/AirstreamTrailer/assets/books"
os.makedirs(DEST, exist_ok=True)

# (slug, title, author-hint, expected_year)
BOOKS = [
    ("history-land-yacht", "Airstream The History of the Land Yacht", "Burkhart", 2000),
    ("americas-world-traveler", "Airstream America's World Traveler", "Foster", 2016),
    ("airstream-landau", "Airstream", "Landau", 1984),
    ("silver-palaces", "Silver Palaces", "Keister", 2004),
    ("ready-to-roll", "Ready to Roll Classic American Travel Trailer", "Gellner", 2003),
    ("airstream-living", "Airstream Living", "Littlefield", 2005),
    ("trailerama", "Trailerama", "Noyes", 2015),
    ("airstream-memories", "Airstream Memories", "Brunkowski", 2008),
    ("rvs-and-campers", "RVs and Campers An Illustrated History", "Wood", 2002),
    ("fifth-avenue-on-wheels", "Fifth Avenue on Wheels", "Byam", 1949),
    ("trailer-travel-here-and-abroad", "Trailer Travel Here and Abroad", "Byam", 1960),
    ("home-was-never-like-this", "Home Was Never Like This", "Payne", 1957),
    ("cape-town-to-cairo", "Cape Town to Cairo", "Douglas", 1959),
    ("land-yachting-central-america", "Land Yachting to Central America", "Payne", 1960),
    ("retire-to-adventure", "Retire to Adventure", "Karr", 1962),
    ("thank-you-marco-polo", "Thank You Marco Polo", "Smith", 1966),
    ("tow-each-his-own", "Tow Each His Own", "Kiefer", 1968),
    ("rainbow-road", "Rainbow Road", "Lokie", 1976),
    ("my-life-on-wheels", "My Life on Wheels", "Rouse", 1984),
    ("mexican-caravan", "Mexican Caravan", "MacDonald", 1999),
    ("wheel-estate", "Wheel Estate Mobile Homes", "Wallis", 1991),
    ("galloping-bungalows", "Galloping Bungalows House Trailer", "Thornburg", 1991),
]

UA = {"User-Agent": "AirstreamArchive/1.0 (personal history site)"}

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read()

results = {}
for slug, title, author, year in BOOKS:
    q = urllib.parse.quote(title + " " + author)
    url = ("https://openlibrary.org/search.json?q=" + q +
           "&fields=title,author_name,first_publish_year,cover_i,isbn&limit=5")
    cover_i = None; matched = None; isbn = None
    try:
        data = json.loads(get(url))
        docs = data.get("docs", [])
        # prefer a doc with a cover whose year is closest to expected
        best = None; best_score = 1e9
        for d in docs:
            if not d.get("cover_i"):
                continue
            fy = d.get("first_publish_year") or 0
            score = abs(fy - year) if fy else 50
            if score < best_score:
                best_score, best = score, d
        if best:
            cover_i = best["cover_i"]
            matched = best.get("title")
            isbn = (best.get("isbn") or [None])[0]
    except Exception as e:
        matched = "ERR " + str(e)[:40]

    downloaded = False
    if cover_i:
        try:
            img = get("https://covers.openlibrary.org/b/id/%s-L.jpg?default=false" % cover_i)
            if img and len(img) > 3000:
                with open(os.path.join(DEST, slug + ".jpg"), "wb") as f:
                    f.write(img)
                downloaded = True
        except Exception:
            downloaded = False
    results[slug] = {"cover_i": cover_i, "matched": matched, "isbn": isbn, "downloaded": downloaded}
    print("%-32s cover_i=%-8s dl=%-5s  match=%s" % (slug, cover_i, downloaded, matched))
    time.sleep(0.4)

with open(os.path.join(os.path.dirname(DEST), "..", "scripts", "cover_results.json"), "w") as f:
    json.dump(results, f, indent=1)
got = sum(1 for r in results.values() if r["downloaded"])
print("\nDownloaded %d / %d covers" % (got, len(BOOKS)))
