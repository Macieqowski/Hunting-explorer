# Lapua: product list from the site's public product feed, tables from each product page (metric).
import os,re,json,subprocess,sys,html as H
from concurrent.futures import ThreadPoolExecutor
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
B='https://www.lapua.com'
def get(u): return subprocess.run(['curl','-sS','-L','--max-time','40','-A',UA,u],capture_output=True,text=True).stdout
urls=[]; pg=1
while True:
    try: r=json.loads(get(f'{B}/wp-json/wp/v2/product?per_page=100&page={pg}&_fields=link'))
    except Exception: break
    if not isinstance(r,list) or not r: break
    urls+=[x['link'] for x in r]; pg+=1
urls=sorted(u for u in set(urls) if not re.search(r'brass|rimfire|22-lr|-case-',u))
print(len(urls),file=sys.stderr)
def flat(t):
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S)
    t=re.sub(r'\s+',' ',H.unescape(re.sub(r'<[^>]+>','|',t))); return re.sub(r'(\| ?)+','|',t)
def one(u):
    t=flat(get(u))
    if '|Factory-loaded cartridge|' not in t or '|Metric chart|' not in t: return None
    try:
        f=lambda k: (re.search(r'\|'+k+r'\|([^|]+)\|',t) or [None,None])[1]
        m=re.search(r'\|Metric chart\|((?:\d+ m\|)+)((?:\d+\|)+)',t)
        dist=[int(x) for x in re.findall(r'(\d+) m',m.group(1))]
        nums=[int(x) for x in m.group(2).strip('|').split('|')]
        # velocities, then energies, for as many leading distances as the page fills in
        n=next(i for i in range(1,len(nums)) if nums[i]>nums[i-1])
        return dict(url=u,cal=f('Caliber'),bullet=f('Bullet'),type=f('Bullet type'),mass=f('Bullet weight'),purpose=f('Purpose'),g1=f('BC G1'),g7=f('BC G7'),
                    barrel=(re.search(r'Test barrel length \[mm\]: (\d+)',t) or [0,None])[1],dist=dist[:n],v=nums[:n],e=nums[n:2*n])
    except Exception as ex:
        print('FAIL',u,ex,file=sys.stderr)
with ThreadPoolExecutor(4) as ex: out=[x for x in ex.map(one,urls) if x]
json.dump(out,open(os.environ.get('AMMO_CACHE','.ammo-cache')+'/lapua.json','w'))
print(len(out),file=sys.stderr)
