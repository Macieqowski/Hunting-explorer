# Federal: every rifle product page in the sitemap. Tables are in yards / fps / ft-lb;
# norm.py converts them to metres.
import os,re,json,subprocess,sys,html as H
from concurrent.futures import ThreadPoolExecutor
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
B='https://www.federalpremium.com'
def get(u): return subprocess.run(['curl','-sS','-L','--max-time','40','-A',UA,u],capture_output=True,text=True).stdout
urls=sorted(set(re.findall(r'<loc>('+B+r'/rifle/[^<]+/[^<]+\.html)</loc>',get(B+'/sitemap_0.xml'))))
print(len(urls),file=sys.stderr)
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
        return dict(url=u,line=re.search(r'/rifle/([^/]+)/',u).group(1),title=(re.search(r'\|Buy ([^|]+?) Ammo \|',t) or [0,None])[1],cal=f('Caliber'),gr=f('Grain Weight'),bullet=f('Bullet Style'),
                    v0=f('Muzzle Velocity'),bc=f('Ballistic Coefficient'),barrel=f('Test Barrel Length In'),use=f('Usage'),yd=yd,fps=fps,ftlb=ftlb)
    except Exception as ex:
        print('FAIL',u,ex,file=sys.stderr)
with ThreadPoolExecutor(4) as ex: out=[x for x in ex.map(one,urls) if x]
json.dump(out,open(os.environ.get('AMMO_CACHE','.ammo-cache')+'/federal.json','w'))
print(len(out),file=sys.stderr)
