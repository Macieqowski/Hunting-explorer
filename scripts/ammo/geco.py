import os,re,json,subprocess,sys,html as H
from concurrent.futures import ThreadPoolExecutor
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
B='https://geco-ammunition.com'
P='/en/ammunition/products-overview/centrefire-rifle-cartridges/'
def get(u): return subprocess.run(['curl','-sS','-L','--max-time','40','-A',UA,u],capture_output=True,text=True).stdout
lines=sorted(set(re.findall(r'href="('+P+r'geco-[a-z0-9-]+)"',get(B+'/en/'))))
prods=set()
for l in lines:
    if 'target-fmj' in l: continue
    p=get(B+l); prods|=set(re.findall(r'href="('+re.escape(l)+r'/[a-z0-9-]+)"',p))
print(len(lines),len(prods),file=sys.stderr)
def flat(t):
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S)
    t=H.unescape(re.sub(r'<[^>]+>','|',t)); return re.sub(r'\s*\|[\s|]*','|',t)
def one(u):
    t=flat(get(B+u))
    try:
        f=lambda k: re.search(r'\|'+re.escape(k)+r'\|([^|]+)\|',t).group(1)
        name=re.search(r'\|(GECO [^|]+)\|Item no:',t).group(1)
        v={a:b for a,b in re.findall(r'\|V(\d+) \[m/s\]\|(\d+)',t)}
        e={a:b for a,b in re.findall(r'\|E(\d+) \[J\]\|(\d+)',t)}
        return dict(url=B+u,name=name,cal=f('Caliber:'),bullet=f('Bullet type:'),mass=f('Bullet Weight:'),bc=f('Ballistic Coefficient:'),barrel=f('Barrell Length:'),lead=f('Lead:'),v=v,e=e)
    except Exception as ex: print('FAIL',u,ex,file=sys.stderr)
with ThreadPoolExecutor(6) as ex: out=[x for x in ex.map(one,sorted(prods)) if x]
json.dump(out,open(os.environ.get('AMMO_CACHE','.ammo-cache')+'/geco.json','w')); print(len(out),file=sys.stderr)
