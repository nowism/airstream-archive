#!/usr/bin/env python3
import os, re, json, shutil, unicodedata

SRC = "/Users/danburke/Dropbox (Personal)/Dan Burke/Old Items/AirstreamTrailers/Vintage Ads from CD/Curved Beauties In Silver/Airstream (1932)"
DEST_DIR = "/Users/danburke/EWUA Dropbox/Dan Burke/AirstreamTrailer/assets/ads"
MANIFEST = "/Users/danburke/EWUA Dropbox/Dan Burke/AirstreamTrailer/data/ads.json"

os.makedirs(DEST_DIR, exist_ok=True)
IMG_EXT = (".jpg", ".jpeg", ".png", ".gif")

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Za-z0-9.\-]+", "_", s).strip("_")
    return re.sub(r"_+", "_", s)

def parse_year(*parts):
    for p in parts:
        m = re.search(r"(19[3-9]\d|20[0-2]\d)", p)
        if m:
            return int(m.group(1))
    return None

def month_key(name):
    months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"]
    low = name.lower()
    for i, m in enumerate(months):
        if m in low:
            return i
    return 99

records = []
seen = set()
for root, dirs, files in os.walk(SRC):
    rel = os.path.relpath(root, SRC)
    folder = "" if rel == "." else rel
    for fn in files:
        if fn.startswith("._") or fn == ".DS_Store":
            continue
        ext = os.path.splitext(fn)[1].lower()
        if ext not in IMG_EXT:
            continue
        full = os.path.join(root, fn)
        try:
            if os.path.getsize(full) == 0:
                continue
        except OSError:
            continue
        stem = os.path.splitext(fn)[0]
        # web-safe destination name (prefix with folder slug to avoid collisions)
        base = (slug(folder) + "__" if folder else "") + slug(fn)
        # ensure uniqueness
        cand = base
        n = 1
        while cand.lower() in seen:
            cand = base.rsplit(".", 1)[0] + f"_{n}." + base.rsplit(".", 1)[1]
            n += 1
        seen.add(cand.lower())
        shutil.copy2(full, os.path.join(DEST_DIR, cand))

        year = parse_year(fn, folder)
        path_low = (folder + " " + fn).lower()
        if "floor" in path_low:
            category = "floorplan"
        elif "brochure" in path_low:
            category = "brochure"
        elif "argosy" in path_low:
            category = "argosy"
        else:
            category = "ad"
        # nicer label
        label = stem.replace("_", " ").strip()
        records.append({
            "file": "assets/ads/" + cand,
            "year": year,
            "label": label,
            "folder": folder,
            "category": category,
            "_mk": month_key(fn),
        })

# sort: year asc (None last), then category, then month
records.sort(key=lambda r: (r["year"] is None, r["year"] or 9999, r["_mk"], r["label"].lower()))
for r in records:
    del r["_mk"]

years = sorted({r["year"] for r in records if r["year"]})
manifest = {
    "meta": {
        "source": "Personal collection — 'Curved Beauties in Silver' vintage Airstream ad archive",
        "count": len(records),
        "yearRange": [years[0], years[-1]] if years else [],
    },
    "ads": records,
}
with open(MANIFEST, "w") as f:
    json.dump(manifest, f, indent=1, ensure_ascii=False)

# summary
from collections import Counter
by_cat = Counter(r["category"] for r in records)
by_dec = Counter((r["year"]//10*10) for r in records if r["year"])
undated = sum(1 for r in records if not r["year"])
print("copied:", len(records))
print("categories:", dict(by_cat))
print("by decade:", dict(sorted(by_dec.items())))
print("undated:", undated)
print("year range:", manifest["meta"]["yearRange"])
total = sum(os.path.getsize(os.path.join(DEST_DIR, os.path.basename(r["file"]))) for r in records)
print("total size MB: %.1f" % (total/1048576))
