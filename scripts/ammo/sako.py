# Sako: each product family page carries its loads as JSON. Sako publishes muzzle velocity
# and BC only (no downrange table).
import os,re,json,subprocess,sys
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
B='https://www.sako.global'
def get(u): return subprocess.run(['curl','-sS','-L','--max-time','40','-A',UA,u],capture_output=True,text=True).stdout
fams=sorted(set(re.findall(r'href="(/ammunition/[a-z0-9-]+)"',get(B+'/ammunition'))))
out=[]
for f in fams:
    d=json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',get(B+f),re.S).group(1))
    c=d['props']['pageProps']['page']['content']
    name=(c.get('hero') or {}).get('title')
    for v in c.get('variants') or []:
        tr=v.get('translations') or {}
        out.append(dict(url=B+f,family=name or f.split('/')[-1],cal=tr.get('caliber.'+str(v.get('caliber'))) or v.get('caliber'),bullet=tr.get('bullet_type.'+str(v.get('bulletType'))) or v.get('bulletType'),
                        code=v.get('bulletCode'),mass=v.get('bulletWeight'),v0=v.get('muzzleVelocity'),bc=v.get('ballisticCoefficient'),pim=v.get('pimId')))
    print(f,len(c.get('variants') or []),file=sys.stderr)
json.dump(out,open(os.environ.get('AMMO_CACHE','.ammo-cache')+'/sako.json','w'))
print(len(out),file=sys.stderr)
