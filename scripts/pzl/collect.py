# Usage: collect.py TYP STATE.json RUNS  -- walks PZL quiz runs, learns correct answers by elimination
import sys, re, time, html, json, os, requests
typ, statef, runs = sys.argv[1], sys.argv[2], int(sys.argv[3])
DELAY = float(os.environ.get("DELAY", "0.6"))
B = "https://pzlow.pl"
st = json.load(open(statef)) if os.path.exists(statef) else {"q": {}, "runs": 0}
Q = st["q"]
s = requests.Session(); s.headers["User-Agent"] = "Mozilla/5.0 (hunting-explorer importer)"
s.verify = os.environ.get("REQUESTS_CA_BUNDLE", True)

def imgs(h): return [html.unescape(x) for x in re.findall(r'<img[^>]*src="([^"]+)"', h)]
def txt(h):
    h = re.sub(r'<br\s*/?>', '\n', h); h = re.sub(r'<[^>]+>', ' ', h)
    return re.sub(r'[ \t]+', ' ', html.unescape(h)).replace(' \n', '\n').strip()
def norm(h): return re.sub(r'\s+', ' ', txt(h)).strip()
def imgid(u): m = re.search(r'_ID=(\d+)', u); return m.group(1) if m else u

def parse_q(page):
    form = re.search(r'<form method="post" action="([^"]+)".*?</form>', page, re.S)
    if not form: return None
    f = form.group(0)
    rows = re.findall(r'<td style="vertical-align:top;text-align:left;font-weight:bold;">(.*?)</td>', f, re.S)
    pos = int(re.search(r'Pytanie\s+(\d+)\s*/\s*(\d+)', rows[0]).group(1))
    qh = rows[1]
    ans = []
    for m in re.finditer(r'<input name="formqst" value="(\d+);(\d+)" type="radio"/>(.*?)</td>', f, re.S):
        ah = m.group(3)
        t = re.sub(r'^\s*[a-z]\)\s*', '', txt(ah))
        ans.append({"id": m.group(2), "text": t, "images": imgs(ah)})
        qid = m.group(1)
    return dict(action=html.unescape(form.group(1)), pos=pos, qid=qid, q=txt(qh), qnorm=norm(qh), images=imgs(qh), answers=ans)

def pick(q):
    e = Q.get(q["qid"])
    ids = sorted(a["id"] for a in q["answers"])
    if not e: return ids[0]
    if e.get("correct"): return e["correct"]
    rem = [i for i in ids if i not in e["wrong"]]
    return rem[0]

import fcntl
def save():
    global Q
    with open(statef + ".lock", "w") as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        disk = json.load(open(statef)) if os.path.exists(statef) else {"q": {}, "runs": 0}
        D = disk["q"]
        for k, e in Q.items():
            d = D.get(k)
            if not d: D[k] = e; continue
            d["answers"].update(e["answers"])
            d["wrong"] = sorted(set(d["wrong"]) | set(e["wrong"]))
            d["correct"] = d["correct"] or e["correct"]
            d["positions"] = d["positions"] + [p for p in e["positions"][len(d["positions"]):]] if len(e["positions"]) > len(d["positions"]) else d["positions"]
        for d in D.values():
            if not d["correct"] and len(d["answers"]) - len(d["wrong"]) == 1:
                d["correct"] = [i for i in d["answers"] if i not in d["wrong"]][0]
        disk["runs"] += 1
        json.dump(disk, open(statef + ".tmp", "w"), ensure_ascii=False); os.replace(statef + ".tmp", statef)
        st["q"] = Q = D

def one_run():
    r = s.get(f"{B}/palio/html.run?_Instance=www&_PageID=251&_Lang=&typ={typ}&newser=no&_C=C_DZIALY.SZKOLENIA.SPRAWDZWIEDZE")
    url = B + html.unescape(re.search(r'href="([^"]*_PageID=250[^"]*)">Zacznij', r.text).group(1))
    time.sleep(DELAY); r = s.get(url)
    asked = []; new = 0
    while True:
        q = parse_q(r.text)
        if not q: break
        e = Q.get(q["qid"])
        if not e:
            new += 1
            e = Q[q["qid"]] = {k: q[k] for k in ("qid", "q", "qnorm", "images")} | {"answers": {}, "wrong": [], "correct": None, "positions": []}
        for a in q["answers"]: e["answers"][a["id"]] = {"text": a["text"], "images": a["images"]}
        e["positions"].append(q["pos"])
        c = pick(q); asked.append((q, c))
        time.sleep(DELAY)
        r = s.post(B + q["action"], data={"formqst": f"{q['qid']};{c}", "_next": "Dalej"})
    res = r.text
    if "Podsumowanie" not in res:
        open(f"bad_{typ}.html", "w").write(res); print("no summary!"); return
    wl = res[res.find("Błędne odpowiedzi"):]
    wrong = [(norm(m), [imgid(u) for u in imgs(m)]) for m in re.findall(r'<td style="text-align:left;">(.*?)</td>', wl, re.S)]
    # greedy subsequence match of wrong list against asked order
    wi = 0; nw = 0
    from collections import Counter
    key = lambda q: (q["qnorm"], tuple(imgid(u) for u in q["images"]))
    cnt = Counter(key(q) for q, _ in asked)
    for q, c in asked:
        if cnt[key(q)] > 1:  # same text twice in this run: result is ambiguous, learn nothing
            if wi < len(wrong) and wrong[wi][0] == q["qnorm"] and wrong[wi][1] == [imgid(u) for u in q["images"]]: wi += 1
            continue
        if wi < len(wrong) and wrong[wi][0] == q["qnorm"] and wrong[wi][1] == [imgid(u) for u in q["images"]]:
            wi += 1; nw += 1
            if c not in Q[q["qid"]]["wrong"]: Q[q["qid"]]["wrong"].append(c)
            if Q[q["qid"]]["correct"] == c: print("CONFLICT", q["qid"])
        else:
            Q[q["qid"]]["correct"] = c
    if wi != len(wrong): print("MATCH FAIL", wi, len(wrong), wrong[wi] if wi < len(wrong) else None)
    for e in Q.values():
        if not e["correct"] and len(e["answers"]) - len(e["wrong"]) == 1:
            e["correct"] = [i for i in e["answers"] if i not in e["wrong"]][0]
    save()
    known = sum(1 for e in Q.values() if e["correct"])
    print(f"run: asked {len(asked)} new {new} wrong {nw} total {len(Q)} known {known}", flush=True)
    time.sleep(DELAY * 3)

done = 0
while done < runs:
    try:
        one_run(); done += 1
    except requests.RequestException as ex:
        print("network error, run abandoned:", ex, flush=True); time.sleep(30)
