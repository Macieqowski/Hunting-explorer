# Usage: export.py STATE.json BANK.json BANKID TOPICMODE  -- writes known questions into the bank, downloads images
import sys, json, re, os, base64, hashlib, time, requests
statef, bankf, bid, mode = sys.argv[1:5]
root = os.path.dirname(bankf); outimg = os.path.join(root, "img", bid)
imgdir = os.path.join(os.environ.get("PZL_CACHE", ".pzl-cache"), "img", bid); os.makedirs(imgdir, exist_ok=True)
Q = json.load(open(statef))["q"]; bank = json.load(open(bankf))
s = requests.Session(); s.verify = os.environ.get("REQUESTS_CA_BUNDLE", True); s.headers["User-Agent"] = "Mozilla/5.0 (hunting-explorer importer)"
EXT = {"image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg"}
def img(u):
    if u.startswith("data:"):
        mime, b64 = re.match(r"data:([^;]+);base64,(.*)", u, re.S).groups(); data = base64.b64decode(b64)
        name = "d" + hashlib.sha1(data).hexdigest()[:12]
    else:
        name = re.search(r"_ID=(\d+)", u).group(1)
        have = [f for f in os.listdir(imgdir) if f.split(".")[0] == name]
        if have: return f"img/{bid}/{have[0]}"
        time.sleep(0.6); r = s.get("https://pzlow.pl" + u if u.startswith("/") else u); r.raise_for_status()
        mime, data = r.headers.get("content-type", "image/png").split(";")[0], r.content
    fn = f"{name}.{EXT.get(mime, 'png')}"
    open(os.path.join(imgdir, fn), "wb").write(data)
    return f"img/{bid}/{fn}"
def combo(qid, rels):
    # several images in one question (e.g. photos A-D): lay them out side by side in one PNG
    from PIL import Image
    fn = f"q{qid}-combo.jpg"; path = os.path.join(imgdir, fn)
    ims = [Image.open(os.path.join(imgdir, os.path.basename(r))).convert("RGB") for r in rels]
    h = min(max(i.height for i in ims), 400)
    ims = [i.resize((max(1, round(i.width * h / i.height)), h)) for i in ims]
    gap = 16; W = sum(i.width for i in ims) + gap * (len(ims) - 1)
    from PIL import ImageDraw, ImageFont
    font = ImageFont.load_default(size=30); lab = 44
    out = Image.new("RGB", (W, h + lab), "white"); d = ImageDraw.Draw(out); x = 0
    for n, i in enumerate(ims):
        out.paste(i, (x, 0))
        d.text((x + i.width / 2, h + lab / 2), "ABCDEFGH"[n], fill="black", font=font, anchor="mm")
        x += i.width + gap
    out.save(path, quality=85, optimize=True)
    return f"img/{bid}/{fn}"
def topic(e):
    if mode == "N": return "Bezpieczeństwo" if min(e["positions"]) <= 30 else "Wiedza ogólna"
    return "Selekcja"
def clean(t): return re.sub(r"\n{2,}", "\n", t).strip()
def cleanq(t, nimg): return re.sub(r"^(?:[A-H]\s+){2,}", "", clean(t)).strip() if nimg > 1 else clean(t)
out = []; skipped = 0; seen = set(); dups = 0
for qid in sorted(Q, key=int):
    e = Q[qid]
    if not e["correct"]: skipped += 1; continue
    ids = sorted(e["answers"], key=int)
    answers = []
    for i in ids:
        a = e["answers"][i]
        if a["images"]:
            o = {"image": img(a["images"][0])}
            if a["text"]: o["text"] = clean(a["text"])
            answers.append(o)
        else: answers.append(clean(a["text"]))
    q = {"id": f"pzl-{bid}-{qid}", "topic": topic(e), "q": cleanq(e["q"], len(e["images"]))}
    if len(e["images"]) == 1: q["image"] = img(e["images"][0])
    elif e["images"]: q["image"] = combo(qid, [img(u) for u in e["images"]])
    q["answers"] = answers; q["correct"] = ids.index(e["correct"])
    k = json.dumps([q["q"], q.get("image"), sorted(json.dumps(a, ensure_ascii=False) for a in answers), json.dumps(answers[q["correct"]], ensure_ascii=False)], ensure_ascii=False)
    if k in seen: dups += 1; continue  # PZŁ has a few identical questions under two ids
    seen.add(k); out.append(q)
bank["questions"] = out
used = set(re.findall(r'img/%s/([^"]+)' % bid, json.dumps(out, ensure_ascii=False)))
import shutil
shutil.rmtree(outimg, ignore_errors=True); os.makedirs(outimg)
for f in sorted(used): shutil.copy(os.path.join(imgdir, f), os.path.join(outimg, f))
print("images", len(used))

json.dump(bank, open(bankf, "w"), ensure_ascii=False, indent=1); open(bankf, "a").write("\n")
print(bid, "exported", len(out), "duplicates dropped", dups, "skipped (answer unknown)", skipped, "multi-image", sum(len(e["images"]) > 1 for e in Q.values()))
