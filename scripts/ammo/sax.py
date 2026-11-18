# Sax (lead-free KJG / KDG loads): the ammunition list, page by page, then each product page
# (metric table in 50 m steps). No BC on the page; norm.py fits one to the table.
import os,re,json,subprocess,sys,html as H
from concurrent.futures import ThreadPoolExecutor
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
B='https://www.sax-munition.de'
def get(u): return subprocess.run(['curl','-sS','-L','--max-time','40','-A',UA,u],capture_output=True,text=True,errors='replace').stdout
urls=set(); pg=1
while pg<30:
    found=set(re.findall(r'href="('+re.escape(B)+r'/[^"/]+/M[0-9.]+(?:-[0-9]+)?)"',get(B+'/munition/?p=%d'%pg)))
    if not found-urls: break
    urls|=found; pg+=1
urls=sorted(urls); print(len(urls),file=sys.stderr)
def flat(t):
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S)
    t=re.sub(r'\s+',' ',H.unescape(re.sub(r'<[^>]+>','|',t))); return re.sub(r'(\| ?)+','|',t)
def one(u):
    t=flat(get(u))
    try:
        seg=t.split('|Angaben 100m Fleckschuss|')[1].split('|Angaben nach GEE')[0]
        row=lambda k: [float(x.replace('.','').replace(',','.')) for x in re.search(re.escape(k)+r' ?\|((?:-?[\d.,]+ ?\|)+)',seg).group(1).replace(' ','').strip('|').split('|')]
        d=row('Weite'); v=row('V (m/s)'); e=row('Energie (J)')
        slug=H.unescape(u[len(B)+1:].rsplit('/',1)[0])
        return dict(url=u,slug=slug,dist=[int(x) for x in d][:len(v)],v=v,e=e)
    except Exception as ex: print('FAIL',u,ex,file=sys.stderr)
with ThreadPoolExecutor(4) as ex: out=[x for x in ex.map(one,urls) if x]
json.dump(out,open(os.environ.get('AMMO_CACHE','.ammo-cache')+'/sax.json','w'))
print(len(out),file=sys.stderr)
