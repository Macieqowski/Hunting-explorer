import os,re,json,subprocess,sys,html as H
from concurrent.futures import ThreadPoolExecutor
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
B='https://www.rws-ammunition.com'
def get(u): return subprocess.run(['curl','-sS','-L','--max-time','40','-A',UA,u],capture_output=True,text=True).stdout
start='/en/products/centerfire-rifle-cartridges'
seen=set(); todo=[start]; prods=set(); pages=set()
while todo:
    u=todo.pop()
    if u in seen: continue
    seen.add(u); p=get(B+u)
    prods|=set(re.findall(r'href="(/en/products/centerfire-rifle-cartridges/[a-z0-9-]+)"',p))
    for m in re.findall(r'href="(/en/products/centerfire-rifle-cartridges/\?tx_twruag[^"#]*)',p):
        m=H.unescape(m); pg=re.search(r'currentPage%5D=(\d+)',m).group(1)
        if pg not in pages: pages.add(pg); todo.append(m)
print(len(pages),len(prods),file=sys.stderr)
def flat(t):
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S)
    t=H.unescape(re.sub(r'<[^>]+>','|',t)); return re.sub(r'\s*\|[\s|]*','|',t)
def one(u):
    t=flat(get(B+u))
    try:
        name=re.search(r'\|Centerfire rifle cartridges\|(RWS [^|]+)\|',t).group(1)
        f=lambda k: (re.search(r'\|'+k+r'\|([^|]+)\|',t) or [None,None])[1]
        vel=dict(re.findall(r'\|(\d+) m\|(\d+) m/s','|'+t.split('|Range|Velocity|')[1].split('|Range|Energy|')[0]))
        en=dict(re.findall(r'\|(\d+) m\|(\d+) J','|'+t.split('|Range|Energy|')[1].split('|Range|')[0]))
        return dict(url=B+u,name=name,cal=f('Caliber'),bullet=f('Bullet'),mass=f('Bullet weight'),bc=f('BC value'),barrel=f('Barrel length'),lead_free=f('Lead free'),use=f('Especially recommended for:'),v=vel,e=en)
    except Exception as ex:
        print('FAIL',u,ex,file=sys.stderr)
with ThreadPoolExecutor(6) as ex: out=[x for x in ex.map(one,sorted(prods)) if x]
json.dump(out,open(os.environ.get('AMMO_CACHE','.ammo-cache')+'/rws.json','w'))
print(len(out),file=sys.stderr)
