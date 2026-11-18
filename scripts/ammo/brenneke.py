# Brenneke: rifle ammunition line pages -> one detail page per load (metric table). The BC is
# printed only where the same bullet is sold for reloading; norm.py fits one to the table otherwise.
import os,re,json,subprocess,sys,html as H
from concurrent.futures import ThreadPoolExecutor
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
B='https://www.brenneke-ammunition.de'
def get(u): return subprocess.run(['curl','-sS','-L','--max-time','40','-A',UA,u],capture_output=True,text=True,errors='replace').stdout
lines=sorted(set(re.findall(r'href="(/en/brands/rifle-ammunition/[a-z0-9-]+)"',get(B+'/en/'))))
det={}
for l in lines:
    if 'reloading' in l: continue
    for d in re.findall(r'href="(/en/details/[^"]+)"',get(B+l)): det.setdefault(H.unescape(d),l)
print(len(lines),len(det),file=sys.stderr)
def one(it):
    d,l=it; raw=get(B+d)
    try:
        h=re.search(r'Ballistic data ([^<]+)</h3>',raw); cal,mass=[x.strip() for x in H.unescape(h.group(1)).split('|')]
        tb=raw[h.end():]; tb=tb[:tb.find('</table>')]
        def row(label):
            r=re.search(re.escape(label)+r'</td>(.*?)</tr>',tb,re.S).group(1)
            return {int(a):float(b.replace(',','.')) for a,b in re.findall(r'data-label="Distance (\d+)">\s*([\d.,]+)\s*<',r)}
        name=H.unescape(re.sub(r'<[^>]+>','',re.search(r'<h1[^>]*>(.*?)</h1>',raw,re.S).group(1))).strip()
        t=re.sub(r'\s+',' ',H.unescape(re.sub(r'<[^>]+>','|',raw)))
        bc=re.search(r'Bullets for reloaders.*?\|\s*(0,\d+)\s*\|',t)
        return dict(url=B+d,line=l.rsplit('/',1)[1],name=name,cal=cal,mass=mass,bc=bc.group(1) if bc else None,v=row('Velocity (m/sec)'),e=row('Projectile energy in joule'))
    except Exception as ex: print('FAIL',d,ex,file=sys.stderr)
with ThreadPoolExecutor(4) as ex: out=[x for x in ex.map(one,det.items()) if x]
json.dump(out,open(os.environ.get('AMMO_CACHE','.ammo-cache')+'/brenneke.json','w'))
print(len(out),file=sys.stderr)
