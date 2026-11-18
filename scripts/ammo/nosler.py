# Nosler: product pages from the sitemap. Tables in yards / fps / ft-lb, no BC printed;
# norm.py converts to metres and fits a BC to the table.
import os,re,json,subprocess,sys,html as H
from concurrent.futures import ThreadPoolExecutor
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
B='https://www.nosler.com'
def get(u): return subprocess.run(['curl','-sS','-L','--max-time','40','-A',UA,u],capture_output=True,text=True,errors='replace').stdout
urls=sorted(set(re.findall(r'<loc>('+B+r'/[^/<]*ammunition[^/<]*\.html)</loc>',get(B+'/sitemap.xml'))))
print(len(urls),file=sys.stderr)
def flat(t):
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S)
    t=re.sub(r'\s+',' ',H.unescape(re.sub(r'<[^>]+>','|',t))); return re.sub(r'(\| ?)+','|',t)
def one(u):
    t=flat(get(u))
    if '|VELOCITY (FPS)|' not in t: return None
    try:
        def table(head):
            n=[x for x in t.split('|'+head+'|Muzzle|')[1].split('|')]
            n=[float(x.replace(',','')) for x in n[:n.index(next(x for x in n if not re.fullmatch(r'[\d.,]+',x)))]]
            k=0
            while k<len(n) and n[k]-(n[k-1] if k else 0) in (50,100): k+=1   # the distance header: (50,) 100, 200, ...
            return [0]+[int(x) for x in n[:k]],n[k:2*k+1]
        info=t.split('|More Information|')[-1]  # the page menu also lists cartridges
        f=lambda k: (re.search(r'\|'+k+r'\|([^|]+)\|','|'+info) or [None,None])[1]
        yd,fps=table('VELOCITY (FPS)'); _,ftlb=table('ENERGY (FT-LBS)')
        return dict(url=u,name=f('Product Name ') or f('Product Name'),cal=f('Cartridge'),use=f('Ammunition Use'),bullet=f('Bullet Type'),gr=f('Bullet Weight'),lf=f('Lead Free'),barrel=f('Test Barrel Length'),hg=f('Handgun Ammunition'),yd=yd,fps=fps,ftlb=ftlb)
    except Exception as ex: print('FAIL',u,ex,file=sys.stderr)
with ThreadPoolExecutor(4) as ex: out=[x for x in ex.map(one,urls) if x]
json.dump(out,open(os.environ.get('AMMO_CACHE','.ammo-cache')+'/nosler.json','w'))
print(len(out),file=sys.stderr)
