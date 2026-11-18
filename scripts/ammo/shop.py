# Federal, Remington and Fiocchi (US site) run the same shop software, so one script reads all
# three: python3 scripts/ammo/shop.py federal|remington|fiocchi
# Tables are in yards / fps / ft-lb; norm.py converts them to metres.
import os,re,json,subprocess,sys,html as H
from concurrent.futures import ThreadPoolExecutor
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
SITES={'federal':('https://www.federalpremium.com','/rifle/'),'remington':('https://www.remington.com','/rifle/'),'fiocchi':('https://www.fiocchiusa.com','/centerfire-rifle/')}
site=sys.argv[1]; B,root=SITES[site]
def get(u): return subprocess.run(['curl','-sS','-L','--max-time','40','-A',UA,u],capture_output=True,text=True).stdout
PROD=re.escape(root)+r'[^"<?]+/\d+-[^"<?/]+\.html'
urls=set(re.findall(r'<loc>'+re.escape(B)+'('+PROD+')</loc>',get(B+'/sitemap_0.xml')))
if not urls: urls=set(re.findall(r'href="('+PROD+')"',get(B+root+'?sz=1000')))  # sitemap without products: read the category page
# the same product can sit under several categories: keep one URL per product number, the line page first
by={}
for u in sorted(urls,key=lambda u:('shop-by-caliber' in u,u)): by.setdefault(u.rsplit('/',1)[1],B+u)
urls=sorted(by.values()); print(len(urls),file=sys.stderr)
def flat(t):
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S)
    t=re.sub(r'\s+',' ',H.unescape(re.sub(r'<[^>]+>','|',t))); return re.sub(r'(\| ?)+','|',t)
def one(u):
    t=flat(get(u))
    try:
        specs=t.split('|Specs|')[1].split('|Ballistics|')[0]
        f=lambda k: (re.search(r'\|'+k+r'\|([^|]+)\|','|'+specs+'|') or [None,None])[1]
        def table(head):
            m=re.search(re.escape(head)+r'\|Muzzle\|((?:\d+ Y\|)+)((?:[\d.,]+\|)+)',t)
            yd=[0]+[int(x) for x in re.findall(r'(\d+) Y',m.group(1))]
            return yd,[float(x.replace(',','')) for x in m.group(2).strip('|').split('|')][:len(yd)]
        yd,fps=table('Velocity in feet per second'); _,ftlb=table('Energy in Foot Pounds')
        return dict(url=u,line=u[len(B+root):].split('/')[0],title=(re.search(r'\|Buy ([^|]+?) Ammo \|',t) or [0,None])[1],cal=f('Caliber'),gr=f('Grain Weight'),bullet=f('Bullet Style'),
                    v0=f('Muzzle Velocity'),bc=f('Ballistic Coefficient'),use=f('Usage'),yd=yd,fps=fps,ftlb=ftlb)
    except Exception as ex:
        print('FAIL',u,ex,file=sys.stderr)
with ThreadPoolExecutor(4) as ex: out=[x for x in ex.map(one,urls) if x]
json.dump(out,open(os.environ.get('AMMO_CACHE','.ammo-cache')+'/'+site+'.json','w'))
print(len(out),file=sys.stderr)
