import os,json,re,sys
S=os.environ.get('AMMO_CACHE','.ammo-cache')+'/'
DISPLAY={'30-06springfield':'.30-06 Springfield','30-06':'.30-06 Springfield','338lapuamagnum':'.338 Lapua Mag.','338lapuamag':'.338 Lapua Mag.',
 '375h\\u0026hmag':'.375 H&H Mag.','375h&hmag':'.375 H&H Mag.','8x57irs(jrs)':'8x57 JRS','8x57jrs':'8x57 JRS','8x57is(js)':'8x57 JS','8x57js':'8x57 JS',
 '500/416ne3\\\\':'.500/416 N.E. 3¼"','500ne3\\\\':'.500 N.E. 3"','404jeffery(rimlne)':'.404 Jeffery','56x50magnum':'5,6x50 Magnum','56x50rmagnum':'5,6x50 R Magnum','17hornet':'.17 Hornet','204ruger':'.204 Ruger','22-250rem':'.22-250 Rem.','30carbine':'.30 Carbine','30-30win':'.30-30 Win.','300aacblackout':'.300 AAC Blackout','303british':'.303 British','45-70govt':'.45-70 Govt.','6mmcreedmoor':'6 mm Creedmoor','68mmremspc':'6,8 mm Rem. SPC','65-284norma':'6,5-284 Norma','7mm-08rem':'7mm-08 Rem.','300wbymag':'.300 Wby. Mag.','7mmwbymag':'7 mm Wby. Mag.'}
SKIP={'12/70','22longrifle','545x39','30-06springfield(form1garand)'}
def key(c):
    c=c.lower().replace(',', '.').replace('×','x').replace('spring.','springfield')
    c=re.sub(r'springfield$','springfield',c)
    return re.sub(r'[\s.]','',c)
def pretty(c):
    # RWS/Geco style: ".308 Win.", "7x64", "9,3x62"
    c=c.replace('\\u0026','&').strip()
    c=re.sub(r'\s*[×x]\s*',r'x',c) if re.match(r'^\d',c) and re.search(r'\d\s*[×x]\s*\d',c) else c
    if re.match(r'^\d{2,3}(\b|-|/| )',c) and not re.match(r'^\d+,\d',c) and not re.match(r'^\d+x',c) and not re.match(r'^\d+ ?mm',c): c='.'+c
    return c
names={}
def canon(raw,maker):
    k=key(raw)
    if k in SKIP: return None
    if k not in names or maker in ('RWS','Geco'): names.setdefault(k,DISPLAY.get(k) or pretty(raw))
    if maker in ('RWS','Geco') and k not in DISPLAY: names[k]=pretty(raw)
    if k in DISPLAY: names[k]=DISPLAY[k]
    return k
out=[]
def num(x):
    if x is None: return None
    m=re.search(r'[\d]+(?:[.,]\d+)?',str(x)); return float(m.group(0).replace(',','.')) if m else None
def add(**d):
    if not d['m'] or not d['g1'] or not d['v'][0]: print('skip',d['u'],file=sys.stderr); return
    out.append(d)
# Sellier & Bellot
SB_LABEL={'SP':'Soft Point','SPCE':'SPCE','PTS':'PTS (Polymer Tip)','HPC':'HPC','SBT':'SBT','XRG':'eXergy (XRG)','TXRG':'eXergy Blue (TXRG)','EDGE':'eXergy Edge','V-MAX™':'Hornady V-MAX','HPBT':'HPBT'}
for x in json.load(open(S+'sb.json')):
    if x['type'] not in SB_LABEL: continue
    if x['type']=='HPBT' and 'Hunting' not in (x['use'] or ''): continue
    k=canon(x['cal'],'S&B')
    if not k: continue
    add(mk='Sellier & Bellot',k=k,n=SB_LABEL[x['type']],b=SB_LABEL[x['type']],lf=1 if x['type'] in ('XRG','TXRG','EDGE') else 0,
        m=x['mass'],g1=x['g1'],g7=x['g7'],bl=x['barrel'],v=[x['v'][i] for i in range(4)],e=[x['e'][i] for i in range(4)],u=x['url'])
# Norma
for x in json.load(open(S+'norma.json')):
    bd=x['major'].get('bulletDescription') or ''
    if bd in ('FMJ','Solid') or 'Jaktmatch' in x['line']: continue
    k=canon(x['cal'],'Norma')
    if not k: continue
    d=x['data']; g=lambda p,i: num(d.get(f'{p}{i}'))
    nm=re.sub(r'\s+',' ',x['name'].replace('\\u0026','&'))
    add(mk='Norma',k=k,n=re.split(r'\s(?=[.\d])',nm.replace('Norma ','',1),maxsplit=1)[0],b=(x['line'].replace('Norma ','')+(' · '+bd if bd else '')),lf=1 if x['major'].get('leadFree') else 0,
        m=x['major'].get('weight_gram'),g1=x['major'].get('ballisticCoefficientG1'),g7=x['major'].get('ballisticCoefficientG7'),bl=x['major'].get('barrelLength'),
        v=[g('velocity',i) for i in (0,100,200,300)],e=[g('energy',i) for i in (0,100,200,300)],u=x['url'])
# RWS
for x in json.load(open(S+'rws.json')):
    if x['bullet'] in ('TARGET ELITE PLUS',): continue
    k=canon(x['cal'],'RWS')
    if not k: continue
    add(mk='RWS',k=k,n=x['bullet'].title().replace('Ks','KS').replace('Dk','DK').replace('Id ','ID ').replace('Hit','HIT').replace('Tms','TMS'),b=x['bullet'].title().replace('Ks','KS').replace('Dk','DK').replace('Id ','ID ').replace('Hit','HIT'),lf=1 if x['lead_free']=='Yes' else 0,
        m=num(x['mass']),g1=num(x['bc']),g7=None,bl=num(x['barrel']),v=[num(x['v'].get(str(i))) for i in (0,100,200,300)],e=[num(x['e'].get(str(i))) for i in (0,100,200,300)],u=x['url'])
# Geco
for x in json.load(open(S+'geco.json')):
    if x['bullet'] in ('FMJ','HPBT'): continue
    k=canon(x['cal'],'Geco')
    if not k: continue
    add(mk='Geco',k=k,n=re.split(r'\s(?=[.\d])',x['name'].replace('GECO ','',1),maxsplit=1)[0].title(),b=x['bullet'],lf=1 if x['lead']=='No' else 0,
        m=num(x['mass']),g1=num(x['bc']),g7=None,bl=num(x['barrel']),v=[num(x['v'].get(str(i))) for i in (0,100,200,300)],e=[num(x['e'].get(str(i))) for i in (0,100,200,300)],u=x['url'])
def tidy(n):
    n=re.sub(r'^NORMA ','',n)
    n=' '.join(w.capitalize() if w.isupper() and len(w)>4 else w for w in n.split())
    return {'Verminxtreme':'VerminXtreme','Vermin Xtreme Tipped':'VerminXtreme Tipped'}.get(n,n)
for d in out:
    if d['mk']=='Norma': d['n']=tidy(d['n'])
cals={}
for d in out:
    d['c']=names[d.pop('k')]
# ids
seen=set()
for d in out:
    base=re.sub(r'[^a-z0-9]+','-',(d['mk'][:3]+' '+d['c']+' '+d['n']+' '+f"{d['m']:g}g").lower()).strip('-'); i=base;n=2
    while i in seen: i=f'{base}-{n}'; n+=1
    seen.add(i); d['id']=i
    for f in ('g7','bl'):
        if d[f] is None: del d[f]
    d['v']=[None if v is None else int(v) for v in d['v']]; d['e']=[None if v is None else int(v) for v in d['e']]
    if d.get('bl'): d['bl']=int(d['bl'])
# Published tables that a standard drag model can't reproduce within 3% (typos or other data errors on the maker's page).
EXCLUDE={'https://www.norma-ammunition.com/products/hunting/norma-tipstrike/norma-tipstrike-270-wsm-140gr---20169532',
 'https://www.norma-ammunition.com/products/hunting/norma-tipstrike/norma-tipstrike-270-winchester-140gr---20169292',
 'https://www.norma-ammunition.com/products/hunting/norma-tipstrike/norma-tipstrike-280-remington-160gr---20171222',
 'https://www.norma-ammunition.com/products/hunting/norma-tipstrike/norma-tipstrike-6-5-creedmoor-140gr---20166512',
 'https://www.norma-ammunition.com/products/hunting/norma-whitetail/norma-whitetail-7x57-150gr---20171592',
 'https://www.norma-ammunition.com/products/hunting/norma-oryx/norma-oryx-9-3-x-62-285gr---20193132'}
out=[d for d in out if d['u'] not in EXCLUDE]
for d in out:
    if d['mk']!='Sellier & Bellot': d.pop('g7',None)
out.sort(key=lambda d:(d['c'],d['mk'],d['n'].lower(),d['m']))
order=['id','c','mk','n','b','lf','m','g1','g7','bl','v','e','u']
out=[{k:d[k] for k in order if k in d} for d in out]
json.dump({'checked':__import__('datetime').date.today().isoformat(),'loads':out},open(sys.argv[1],'w'),ensure_ascii=False,separators=(',',':'))
print(len(out),len(set(d['c'] for d in out)),file=sys.stderr)
print(sorted(set(d['c'] for d in out)),file=sys.stderr)
