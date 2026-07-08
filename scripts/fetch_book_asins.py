#!/usr/bin/env python3
"""Find a verified ISBN-10 (usable as an Amazon ASIN) for each book.
Only accepts a match when the author surname is present AND the title tokens
overlap strongly AND the year is close. Prints a report for eyeballing."""
import json, re, urllib.parse, urllib.request, time

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
STOP = {"the", "a", "an", "of", "to", "and", "on", "in"}

def toks(s):
    return set(w for w in re.sub(r"[^a-z0-9 ]", " ", s.lower()).split() if w and w not in STOP)

def isbn10(lst):
    for x in lst or []:
        x = x.replace("-", "")
        if len(x) == 10:
            return x
    return None

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25) as r:
        return json.loads(r.read())

out = {}
for slug, title, author, year in BOOKS:
    q = urllib.parse.quote(title + " " + author)
    url = ("https://openlibrary.org/search.json?q=" + q +
           "&fields=title,author_name,first_publish_year,isbn,edition_count&limit=8")
    chosen = None
    try:
        docs = get(url).get("docs", [])
        want = toks(title)
        for d in docs:
            auths = " ".join(d.get("author_name", [])).lower()
            if author.lower() not in auths:
                continue
            overlap = len(want & toks(d.get("title", "")))
            if overlap < max(1, len(want) // 2):
                continue
            fy = d.get("first_publish_year") or 0
            if fy and abs(fy - year) > 4:
                continue
            isbn = isbn10(d.get("isbn"))
            if isbn:
                chosen = {"asin": isbn, "match": d.get("title"), "auth": d.get("author_name"), "year": fy}
                break
    except Exception as e:
        chosen = {"error": str(e)[:50]}
    out[slug] = chosen
    if chosen and chosen.get("asin"):
        print("%-32s ASIN=%-12s  %s (%s)" % (slug, chosen["asin"], chosen["match"], chosen.get("year")))
    else:
        print("%-32s --- no confident ISBN (keep search link)" % slug)
    time.sleep(0.4)

with open("/Users/danburke/EWUA Dropbox/Dan Burke/AirstreamTrailer/scripts/asin_results.json", "w") as f:
    json.dump(out, f, indent=1)
got = sum(1 for v in out.values() if v and v.get("asin"))
print("\n%d / %d books got a confident ISBN/ASIN" % (got, len(BOOKS)))
