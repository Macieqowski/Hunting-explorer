import os,re,json,subprocess,sys
from concurrent.futures import ThreadPoolExecutor
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
B='https://www.norma-ammunition.com'
def get(u): return subprocess.run(['curl','-sS','-L','--max-time','40','-A',UA,u],capture_output=True,text=True).stdout.replace('\\"','"')
lines=sorted(set(re.findall(r'urlPath":"(/products/hunting/norma-[a-z0-9-]+)"',get(B+'/products/hunting'))))
urls=set()
for l in lines:
    p=get(B+l)
    found=set(re.findall(r'"url":"('+re.escape(l)+r'/[^"]+)"',p))
    print(l,len(found),file=sys.stderr); urls|=found
def one(u):
    p=get(B+u)
    m=re.search(r'"product":\{"_id":"product-\d+","sku":"(\d+)","name":"([^"]+)","productLine":"([^"]+)".*?"caliber":"([^"]+)".*?"dataFacts":(\{[^}]*\}),"majorFacts":(\{[^}]*\})',p)
    if not m: print('FAIL',u,file=sys.stderr); return None
    sku,name,line,cal,df,mf=m.groups()
    return dict(url=B+u,sku=sku,name=name,line=line,cal=cal,data=json.loads(df),major=json.loads(mf))
with ThreadPoolExecutor(6) as ex: out=[x for x in ex.map(one,sorted(urls)) if x]
json.dump(out,open(os.environ.get('AMMO_CACHE','.ammo-cache')+'/norma.json','w'))
print(len(urls),len(out),file=sys.stderr)
