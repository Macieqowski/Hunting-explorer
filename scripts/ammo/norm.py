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

# --- Makers added later: Sako, Lapua, Hornady, Federal. Their calibre spellings are mapped
# onto the names already in use; a calibre nobody above loads gets a name from NEW.
byname={key(v):k for k,v in names.items()}
ALIAS={'223remington':'223rem','270winchester':'270win','270winchestershortmagnum':'270wsm','280remington':'280rem','30-06sprg':'30-06springfield',
 '25-06remington':'25-06rem','257wbymagnum':'257wbymag','300blackout':'300aacblackout','300remultramag':'300rum','300remingtonultramag':'300rum',
 '300weatherbymag':'300wbymag','338lapua':'338lapuamag','338lapuamagnum':'338lapuamag','375h&h':'375h&hmag','375h&hmagnum':'375h&hmag',
 '416remington':'416remmag','416remmagnum':'416remmag','45-70government':'45-70govt','470nitroexpress':'470ne','500nitroexpress':'500ne3"',
 '500nitroexpress3"':'500ne3"','65mmprc':'65prc','65x55':'65x55se','65x55swedish':'65x55se','68mmspc':'68mmremspc','68remspc':'68mmremspc',
 '7mmmauser':'7x57','275rigby':'275rigby','8mmmauser':'8x57js','8x57is':'8x57js','8x57irs':'8x57jrs','300winshortmag':'300wsm','7mm08rem':'7mm-08rem',
 '458winmagnum':'458winmag','450nitroexpress31/4"':'450ne3¼"','450nitroexpress3¼”':'450ne3¼"','450-400nitroexpress3"':'450-400ne3"',
 '450-400nitroexpress3&prime;':'450-400ne3"','556nato':'556x45','556x45mm':'556x45','280ackleyimproved':'280ackley','300winmag':'300winmag',
 '30-378weatherbymag':'30-378wbymag','300remingtonshortactionultramag':'300rsaum','762x53r':'762x53r','7mmbackcountry':'7mmbackcountry'}
NEW={'218bee':'.218 Bee','22arc':'.22 ARC','22creedmoor':'.22 Creedmoor','220swift':'.220 Swift','222remmag':'.222 Rem. Mag.','223wssm':'.223 WSSM',
 '224valkyrie':'.224 Valkyrie','243wssm':'.243 WSSM','25creedmoor':'.25 Creedmoor','25-06rem':'.25-06 Rem.','25-35win':'.25-35 Win.','250savage':'.250 Savage',
 '257roberts+p':'.257 Roberts +P','257wbymag':'.257 Wby. Mag.','260rem':'.260 Rem.','275rigby':'.275 Rigby','28nosler':'.28 Nosler','280ackley':'.280 Ackley Imp.',
 '30tc':'.30 TC','30-378wbymag':'.30-378 Wby. Mag.','30-40krag':'.30-40 Krag','300rcm':'.300 RCM','300rsaum':'.300 RSAUM','300savage':'.300 Savage',
 '308marlinexpress':'.308 Marlin Express','32winspecial':'.32 Win. Special','338arc':'.338 ARC','338federal':'.338 Federal','338marlinexpress':'.338 Marlin Express',
 '338rcm':'.338 RCM','348win':'.348 Win.','35rem':'.35 Rem.','350legend':'.350 Legend','358win':'.358 Win.','360buckhammer':'.360 Buckhammer',
 '370sakomag':'.370 Sako Mag.','375ruger':'.375 Ruger','376steyr':'.376 Steyr','400legend':'.400 Legend','405win':'.405 Win.','416ruger':'.416 Ruger',
 '444marlin':'.444 Marlin','450bushmaster':'.450 Bushmaster','450marlin':'.450 Marlin','450ne3¼"':'.450 N.E. 3¼"','450-400ne3"':'.450/400 N.E. 3"',
 '458winmag':'.458 Win. Mag.','556x45':'5,56x45 NATO','65creedmoor+peak':'6,5 Creedmoor +Peak','65grendel':'6,5 Grendel','65x47lapua':'6,5x47 Lapua',
 '68western':'6,8 Western','6mmarc':'6 mm ARC','6mmgt':'6 mm GT','6mmrem':'6 mm Rem.','6mmbrnorma':'6 mm BR Norma','762x53r':'7,62x53 R','7mmstw':'7 mm STW',
 '7mmwsm':'7 mm WSM','7mmbackcountry':'7 mm Backcountry','93x53r':'9,3x53 R'}
def canon2(raw):
    k=key(re.sub(r'<[^>]+>|[®™]','',raw).replace('‑','-').strip().lstrip('.'))
    k=ALIAS.get(k,k)
    if k in byname: return byname[k]
    if k in names: return k
    if k not in NEW: print('unknown calibre',repr(raw),k,file=sys.stderr); return None
    names[k]=NEW[k]; return k
GR=0.06479891; FPS=0.3048; FTLB=1.3558179
def at_metres(yd,vals,k):
    # Tables in yards: value at 100/200/300 m by log-linear interpolation between the two nearest rows.
    import math
    out=[vals[0]*k]
    for m in (100,200,300):
        x=m/0.9144; i=next((i for i in range(1,len(yd)) if yd[i]>=x),None)
        if i is None or not vals[i] or not vals[i-1]: out.append(None); continue
        f=(x-yd[i-1])/(yd[i]-yd[i-1]); out.append(math.exp(math.log(vals[i-1])*(1-f)+math.log(vals[i])*f)*k)
    return [None if v is None else round(v) for v in out]
def load(f):
    try: return json.load(open(S+f))
    except FileNotFoundError: print('no',f,file=sys.stderr); return []
# Sako: muzzle velocity and BC only
SAKO_KEEP={'Gamehead','Gamehead Pro','Gamehead Varmint','Gamehead Varmint RX','Hammerhead','Super Hammerhead','Powerhead Blade','Powerhead Blade Pro'}
for x in load('sako.json'):
    if x['family'] not in SAKO_KEEP or 'Range' in x['cal']: continue
    k=canon2(x['cal'])
    if not k: continue
    bt=(x['bullet'] or '').replace('_',' ').title()
    add(mk='Sako',k=k,n=x['family'],b=' · '.join(p for p in (bt,x['code']) if p),lf=1 if 'Blade' in x['family'] else 0,
        m=x['mass'],g1=x['bc'],g7=None,bl=None,v=[x['v0'],None,None,None],e=[None]*4,u=x['url'])
# Lapua
for x in load('lapua.json'):
    if x['bullet'] not in ('Naturalis','Mega','TRX TrueRange Expanding','Soft Point'): continue
    k=canon2(x['cal'].replace('×','x'))
    if not k: continue
    pad=lambda a: [a[i] if i<len(a) and x['dist'][i]==i*100 else None for i in range(4)]
    add(mk='Lapua',k=k,n=x['bullet'].replace(' TrueRange Expanding',''),b=x['type'] or x['bullet'],lf=1 if x['bullet'] in ('Naturalis','TRX TrueRange Expanding') else 0,
        m=num(x['mass']),g1=num(x['g1']),g7=None,bl=num(x['barrel']),v=pad(x['v']),e=pad(x['e']),u=x['url'])
# Hornady
H_KEEP={'Superformance','Precision Hunter','Dangerous Game Series','Outfitter','Custom','Custom International','American Whitetail','American Whitetail TIPPED',
 'Superformance Varmint','Varmint Express','LEVERevolution','Custom Lite'}
for x in load('hornady.json'):
    clean=lambda t: re.sub(r'\s+',' ',re.sub(r'<[^>]+>|[®™]','',t).replace('‑','-').replace('&Prime;','"')).strip()
    line=clean(x['line']); t=clean(x['title'])
    if line not in H_KEEP or re.search(r'\b(FMJ|BTHP|Match|DGS|Subsonic)\b',t): continue
    mm=re.match(r'(.+?)\s+(\d+)\s*(?:gr\.?)?\s+(?=[A-Z])(.*)$',t,re.I)
    if not mm: print('skip title',t,file=sys.stderr); continue
    k=canon2(mm.group(1))
    if not k: continue
    nm=mm.group(3)
    gr=float(mm.group(2))  # the title's weight: a few pages carry another product's weight in their data
    if x['barrel_in']>40:  # a Custom International page with a metric table (barrel in cm, metres, m/s, J)
        at=lambda vals: [vals[x['yd'].index(d)] if d in x['yd'] else None for d in (0,100,200,300)]
        v,e,bl=at(x['fps']),at(x['ftlb']),x['barrel_in']*10
    else: v,e,bl=at_metres(x['yd'],x['fps'],FPS),at_metres(x['yd'],x['ftlb'],FTLB),x['barrel_in']*25.4
    add(mk='Hornady',k=k,n=nm,b=line,lf=1 if re.search(r'\b(CX|GMX|ECX|MonoFlex|NTX)\b',nm) else 0,
        m=round(gr*GR,2),g1=num(x['bc']),g7=None,bl=round(bl),v=v,e=e,u=x['url'])
# Federal
F_SKIP={'american-eagle','federal-training','gold-medal','gold-medal-sierra-tipped-matchking','federal-subsonic','safari-trophy-bonded-sledgehammer-solid','safari-woodleigh-hydro-solid'}
F_LINE={'eld-x':'ELD-X','fusion-msr':'Fusion MSR','fusion-tipped-rifle':'Fusion Tipped','power-shok-copper-rifle':'Power-Shok Copper','varmint-and-predator-2':'Varmint & Predator',
 'barnes-lrx':'Barnes LRX','barnes-tsx':'Barnes TSX','swift-scirocco-ii':'Swift Scirocco II','safari-swift-a-frame':'Safari Swift A-Frame',
 'safari-trophy-bonded-bear-claw':'Safari Trophy Bonded Bear Claw','hammerdown':'HammerDown','federal-x-henry-250th-anniversary':'Federal X Henry','federal-x-henry-cattleman':'Federal X Henry Cattleman'}
for x in load('federal.json'):
    if x['line'] in F_SKIP or re.search(r'Full Metal|Total Metal|Match|Target|Solid',x['bullet'] or ''): continue
    k=canon2(x['cal'])
    if not k: continue
    ln=F_LINE.get(x['line']) or x['line'].replace('-',' ').title().replace('Power Shok','Power-Shok')
    bs=re.sub(r'[®™]','',x['bullet'] or '')
    add(mk='Federal',k=k,n=ln,b=bs,lf=1 if re.search(r'Copper|Barnes',ln+' '+bs) else 0,
        m=round(num(x['gr'])*GR,2),g1=float(x['bc'] or 0),g7=None,bl=None,v=at_metres(x['yd'],x['fps'],FPS),e=at_metres(x['yd'],x['ftlb'],FTLB),u=x['url'])
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
EXCLUDE|={'https://www.hornady.com/ammunition/rifle/'+x for x in ('22-250-rem-35-gr-ntx-superformance','222-rem-35-gr-ntx-superformance',
 '270-win-130-gr-interlock-sp-american-whitetail','7mm-rem-mag-139-gr-interlock-sp-american-whitetail','7mm-prc-154-gr-sst-american-whitetail-tipped',
 '5.56-nato-55-gr.-cx-superformance','30-06-springfield-220-gr-rn-custom-international')}
EXCLUDE|={'https://www.lapua.com/product/'+x for x in ('30-06-spring-10-7-g-165-grains-n317107trx/','308-win-9-7-g-150-gr-trx-hunting-ammo-n317108/')}
out=[d for d in out if d['u'] not in EXCLUDE]
# A single misprinted cell on an otherwise consistent page: drop the cell, keep the load.
MISPRINT={'https://www.hornady.com/ammunition/rifle/30-06-springfield-180-gr-interlock-sp-american-whitetail':[('e',0)],   # 2714 ft-lb at the muzzle; 180 gr at 2700 fps is 2913
 'https://www.hornady.com/ammunition/rifle/338-win-mag-230-gr-eld-x-precision-hunter':[('v',2),('v',3)]}                    # 2831 fps at 300 yd, faster than at 200 yd
for d in out:
    for f,i in MISPRINT.get(d['u'],()): d[f][i]=None
for d in out:
    if d['mk']!='Sellier & Bellot': d.pop('g7',None)
out.sort(key=lambda d:(d['c'],d['mk'],d['n'].lower(),d['m']))
order=['id','c','mk','n','b','lf','m','g1','g7','bl','v','e','u']
out=[{k:d[k] for k in order if k in d} for d in out]
json.dump({'checked':__import__('datetime').date.today().isoformat(),'loads':out},open(sys.argv[1],'w'),ensure_ascii=False,separators=(',',':'))
print(len(out),len(set(d['c'] for d in out)),file=sys.stderr)
print(sorted(set(d['c'] for d in out)),file=sys.stderr)
