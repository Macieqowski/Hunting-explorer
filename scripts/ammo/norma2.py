import os,re,json,subprocess,sys
from concurrent.futures import ThreadPoolExecutor
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
B='https://www.norma-ammunition.com'
def get(u): return subprocess.run(['curl','-sS','-L','--max-time','40','-A',UA,u],capture_output=True,text=True).stdout.replace('\\"','"')
cals=sorted(set(re.findall(r'href="(/products/calibers/[a-z0-9-]+)"',get(B+'/products/calibers'))))
def cp(c):
    p=get(B+c); f=set(re.findall(r'"url":"(/products/hunting/norma-[a-z0-9-]+/[^"]+)"',p)); return c,f
have={x['url'][len(B):] for x in json.load(open(os.environ.get('AMMO_CACHE','.ammo-cache')+'/norma.json'))}
urls=set()
with ThreadPoolExecutor(6) as ex:
    for c,f in ex.map(cp,cals):
        if len(f)>=12: print('CAP?',c,len(f),file=sys.stderr)
        urls|=f
new=sorted(urls-have); print(len(cals),len(urls),len(new),file=sys.stderr)
def one(u):
    p=get(B+u)
    m=re.search(r'"product":\{"_id":"product-\d+","sku":"(\d+)","name":"([^"]+)","productLine":"([^"]+)".*?"caliber":"([^"]+)".*?"dataFacts":(\{[^}]*\}),"majorFacts":(\{[^}]*\})',p)
    if not m: print('FAIL',u,file=sys.stderr); return None
    sku,name,line,cal,df,mf=m.groups()
    return dict(url=B+u,sku=sku,name=name,line=line,cal=cal,data=json.loads(df),major=json.loads(mf))
with ThreadPoolExecutor(6) as ex: out=[x for x in ex.map(one,new) if x]
allp=json.load(open(os.environ.get('AMMO_CACHE','.ammo-cache')+'/norma.json'))+out
json.dump(allp,open(os.environ.get('AMMO_CACHE','.ammo-cache')+'/norma.json','w'))
print(len(allp),file=sys.stderr)
