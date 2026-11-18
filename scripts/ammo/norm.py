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
ALIAS.update({'65x57mauser':'65x57','762x39mm':'762x39','762x39mmsoviet':'762x39','8mmmauser(8x57)':'8x57js','7mmmauser(7x57)':'7x57','7x64mmbrenneke':'7x64','68spc':'68mmremspc',
 '65mmgrendel':'65grendel','765x53argentine':'765x53arg','7mmremsaum':'7mmrsaum','300remsaum':'300rsaum','300remum':'300rum','7mmremum':'7mmrum','338remum':'338rum','375remum':'375rum',
 '556nato':'556x45','300winmag':'300winmag','65x54mannlicherschoenauer':'65x54ms','75x54french':'75x54mas','8x56rsmannlicher':'8x56r','8x50rlebel':'8x50rlebel','792x33kurz':'792x33'})
ALIAS.update({'7mmshootingtimeswesterner':'7mmstw','7x57mauser':'7x57','325winshortmag':'325wsm','8x57jsmauser':'8x57js','221remfireball':'221fireball','93x62mauser':'93x62','65x55mauser':'65x55se'})
ALIAS.update({'300hhmag':'300h&hmag','338lapmag':'338lapuamag','375hh':'375h&hmag','404rimjeffery':'404jeffery','450400magne3':'450-400ne3"','500416ne314':'500/416ne3¼"','500ne':'500ne3"',
 '56x50mag':'56x50magnum','56x50rmag':'56x50rmagnum'})
# short-range revolver and pistol calibres some makers list among rifle loads
SKIP2={'10mmauto','357mag','44remmag','45colt','44-40win','38-40win','32-20win','25-20win','46x30h&k'}
NEW={'338blasermag':'.338 Blaser Mag.','375cheytac':'.375 CheyTac','408cheytac':'.408 CheyTac','45blaser':'.45 Blaser','577ne3':'.577 N.E. 3"','600ne':'.600 N.E.','103x60r':'10,3x60 R',
 '65x64reb':'6,5x64 REB','65x65rws':'6,5x65 RWS','6x62freres':'6x62 Frères','6x62rfreres':'6x62 R Frères',
 '22nosler':'.22 Nosler','26nosler':'.26 Nosler','27nosler':'.27 Nosler','30nosler':'.30 Nosler','33nosler':'.33 Nosler','300h&hmag':'.300 H&H Mag.','270wbymag':'.270 Wby. Mag.','792x33':'7,92x33 Kurz',
 '65x52carcano':'6,5x52 Carcano','85x63reb':'8,5x63 REB','8x60s':'8x60 S','7mmrum':'7 mm RUM','264winmag':'.264 Win. Mag.','25wssm':'.25 WSSM','17rem':'.17 Rem.',
 '7mmrsaum':'7 mm RSAUM','7mmblasermag':'7 mm Blaser Mag.','65x54ms':'6,5x54 M.-Sch.','38-55win':'.38-55 Win.','375win':'.375 Win.','375rum':'.375 RUM','356win':'.356 Win.',
 '338rum':'.338 RUM','325wsm':'.325 WSM','307win':'.307 Win.','300hamr':'.300 HAMR','30remar':'.30 Rem. AR','284win':'.284 Win.','257roberts':'.257 Roberts','225win':'.225 Win.',
 '221fireball':'.221 Rem. Fireball','17remfireball':'.17 Rem. Fireball','300blasermag':'.300 Blaser Mag.','85x55blaser':'8,5x55 Blaser','75x54mas':'7,5x54 MAS','8x56r':'8x56 R','8x50rlebel':'8x50 R Lebel',
 '218bee':'.218 Bee','22arc':'.22 ARC','22creedmoor':'.22 Creedmoor','220swift':'.220 Swift','222remmag':'.222 Rem. Mag.','223wssm':'.223 WSSM',
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
    if k not in byname and k not in names and k not in NEW:
        # long spellings ("300 Winchester Magnum", "8 x 57 IS", "30-06 Spr.") -> the short keys used above
        for x,y in (('winchester','win'),('remington','rem'),('magnum','mag'),('weatherby','wby'),('government','govt'),('swedish','se'),('x57is','x57js'),('x57irs','x57jrs'),('ultramag','um')):
            k=k.replace(x,y)
        k=re.sub(r'^30-06.*','30-06springfield',k); k=ALIAS.get(k,k)
    if k in SKIP2: return None
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
# A maker that prints a velocity table but no BC: fit the G1 BC that reproduces the table
# (same drag table and standard atmosphere as src/ballistics.ts). Such loads are marked bf=1.
_src=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','src','ballistics.ts')).read()
G1T=[float(x) for x in re.search(r'G1: \[([^\]]+)\]',_src).group(1).split(',')]
def _cd(m):
    if m<=G1T[0]: return G1T[1]
    if m>=G1T[-2]: return G1T[-1]
    lo,hi=0,len(G1T)//2-1
    while hi-lo>1:
        mid=(lo+hi)//2
        if G1T[mid*2]>m: hi=mid
        else: lo=mid
    return G1T[lo*2+1]+(G1T[hi*2+1]-G1T[lo*2+1])*(m-G1T[lo*2])/(G1T[hi*2]-G1T[lo*2])
def _fly(v0,bc,dists):
    k=1.225*3.141592653589793/(8*bc*703.0696); c=331.3*(1+15/273.15)**0.5
    out=[]; v=v0; x=0.0
    for d in dists:
        while x<d-1e-9:
            st=min(1.0,d-x); a=-k*_cd(v/c)*v; vm=v+a*st/2; v+=-k*_cd(vm/c)*vm*st; x+=st
        out.append(v)
    return out
def fit_g1(pts):
    """pts: [(distance m, velocity m/s)], the first at 0 m. Returns (bc, worst relative error)."""
    pts=[(d,v) for d,v in pts if v]; v0=pts[0][1]; rest=[p for p in pts[1:] if p[0]<=460]
    if len(rest)<2: return None,None
    def err(bc):
        f=_fly(v0,bc,[d for d,_ in rest]); return sum(((a-v)/v)**2 for a,(_,v) in zip(f,rest))
    lo,hi=0.05,1.3
    for _ in range(40):
        a=lo+(hi-lo)*0.382; b=lo+(hi-lo)*0.618
        if err(a)<err(b): hi=b
        else: lo=a
    bc=round((lo+hi)/2,3); f=_fly(v0,bc,[d for d,_ in rest])
    return bc,max(abs(a-v)/v for a,(_,v) in zip(f,rest))
def bc_or_fit(maker,url,given,pts):
    """The printed BC, or one fitted to the maker's table (then the load is marked bf=1)."""
    if given:
        # a printed BC is used when it reproduces the table; a few pages print the BC of another bullet
        rest=[(d,v) for d,v in pts[1:] if v and d<=460]
        if not rest or max(abs(a-v)/v for a,(_,v) in zip(_fly(pts[0][1],given,[d for d,_ in rest]),rest))<=0.03: return given,0
    bc,worst=fit_g1(pts)
    if bc is None or worst>0.02: print('no BC fits',maker,url,bc,worst,file=sys.stderr); return None,0
    return bc,1
YD=0.9144
# Federal, Remington, Fiocchi (US site): same shop software, same fields
def shop(maker,file,skip,lines,lead_free):
    for x in load(file):
        if x['line'] in skip or re.search(r'Full Metal|Total Metal|Match|Target|Solid|OTM|Open Tip|Lead Round Nose|Boat Tail$|^Boat Tail|RDF',x['bullet'] or ''): continue
        k=canon2(x['cal'])
        if not k: continue
        bs=re.sub(r'[®™]','',x['bullet'] or '')
        ln=lines.get(x['line']) or ('' if x['line']=='shop-by-caliber' else x['line'].replace('-rifle','').replace('-',' ').title().replace('Power Shok','Power-Shok').replace('Core Lokt','Core-Lokt').replace('Accutip','AccuTip'))
        add(mk=maker,k=k,n=ln or bs,b=bs,lf=1 if re.search(lead_free,ln+' '+bs) else 0,
            m=round(num(x['gr'])*GR,2),g1=float(x['bc'] or 0),g7=None,bl=None,v=at_metres(x['yd'],x['fps'],FPS),e=at_metres(x['yd'],x['ftlb'],FTLB),u=x['url'])
shop('Federal','federal.json',{'american-eagle','federal-training','gold-medal','gold-medal-sierra-tipped-matchking','federal-subsonic','safari-trophy-bonded-sledgehammer-solid','safari-woodleigh-hydro-solid'},
 {'eld-x':'ELD-X','fusion-msr':'Fusion MSR','fusion-tipped-rifle':'Fusion Tipped','power-shok-copper-rifle':'Power-Shok Copper','varmint-and-predator-2':'Varmint & Predator',
  'barnes-lrx':'Barnes LRX','barnes-tsx':'Barnes TSX','swift-scirocco-ii':'Swift Scirocco II','safari-swift-a-frame':'Safari Swift A-Frame',
  'safari-trophy-bonded-bear-claw':'Safari Trophy Bonded Bear Claw','hammerdown':'HammerDown','federal-x-henry-250th-anniversary':'Federal X Henry','federal-x-henry-cattleman':'Federal X Henry Cattleman'},r'Copper|Barnes')
shop('Remington','remington.json',{'umc-rifle','premier-match','subsonic-rifle'},{'high-performance-rifle':'High Performance','premier-accutip-v':'Premier AccuTip-V','premier-cut':'Premier CuT','premier-scirocco':'Premier Scirocco Bonded'},r'Copper|CuT')
shop('Fiocchi','fiocchi.json',{'range-dynamics-rifle','hyperformance-match','hyperformance-defense-rifle','cowboy-action-rifle','defense-dynamics-rifle'},{'hyperformance-hunt-rifle':'Hyperformance Hunt'},r'Copper|TTSX')
# Blaser
for x in load('blaser.json'):
    cal=x['cal'].split(' / ')[0]; cal={'.30 R':'.30 R Blaser','.30-06':'.30-06 Springfield'}.get(cal,cal)
    k=canon2(cal)
    if not k: continue
    code=re.search(r'/en/(C[A-Z]{2})-([^/]+)/',x['url'])
    add(mk='Blaser',k=k,n=code.group(1),b=code.group(2).replace('-',' '),lf=0 if code.group(1)=='CDB' else 1,m=num(x['mass']),g1=num(x['bc']),g7=None,bl=num(x['barrel']),
        v=[num(x['v'].get(str(i))) for i in (0,100,200,300)],e=[num(x['e'].get(str(i))) for i in (0,100,200,300)],u=x['url'])
# Brenneke
BR={'tig-torpedo-ideal-bullet':'TIG','tug-torpedo-universal-bullet':'TUG','tug-nature':'TUG nature+','tog-torpedo-original-bullet':'TOG','tag-torpedo-alternativ-bullet':'TAG',
 'basic':'Basic','basic-nature':'Basic nature','teilmantel':'Teilmantel'}
for x in load('brenneke.json'):
    k=canon2(x['cal'].replace('Win.Mag','Win. Mag').replace('Rem.Mag','Rem. Mag'))
    if not k: continue
    bc,bf=bc_or_fit('Brenneke',x['url'],num(x['bc']),sorted((int(d),val) for d,val in x['v'].items()))
    if not bc: continue
    g,gr=(num(p) for p in (x['mass'].split('/')+[''])[:2])
    if gr and abs(g-gr*GR)/g>0.05: g=round(gr*GR,1)  # "4g/130grs": the grams are misprinted, the grains agree with the energy
    add(mk='Brenneke',k=k,n=BR[x['line']],b=BR[x['line']],lf=1 if x['line'] in ('tag-torpedo-alternativ-bullet','tug-nature','basic-nature') else 0,m=g,g1=bc,bf=bf,g7=None,bl=None,
        v=[x['v'].get(str(i)) for i in (0,100,200,300)],e=[x['e'].get(str(i)) for i in (0,100,200,300)],u=x['url'])
# PPU: no BC published
PPU={'SP':'Soft Point','SP BT':'Soft Point Boat Tail','PSP':'Pointed Soft Point','PSP BT':'Pointed Soft Point Boat Tail','SP RN':'Soft Point Round Nose','GROM':'Grom','FSP':'Flat Soft Point',
 'HSP':'Hollow Soft Point','SJFP':'Semi-Jacketed Flat Point','HP':'Hollow Point'}
for x in load('ppu.json'):
    if x['type'] not in PPU: continue
    k=canon2(x['cal'])
    if not k: continue
    bc,bf=bc_or_fit('PPU',x['url'],None,list(zip(x['dist'],x['v'])))
    if not bc: continue
    at=lambda a: [a[x['dist'].index(d)] if d in x['dist'] else None for d in (0,100,200,300)]
    add(mk='PPU (Prvi Partizan)',k=k,n=PPU[x['type']],b=x['type']+' · '+x['art'],lf=0,m=num(x['mass']),g1=bc,bf=bf,g7=None,bl=num(x['barrel']),v=at(x['v']),e=at(x['e']),u=x['url'])
# Nosler: no BC on the page
for x in load('nosler.json'):
    nm=(x['name'] or '').replace(' Ammunition','')
    if x['hg']=='Yes' or re.search(r'Match Grade|ASP|Defense|Solid|Blemished|BLEM|Factory Second|Free Can|\d ?ct\b|Count',nm,re.I) or not x['cal']: continue
    k=canon2(x['cal'])
    if not k: continue
    gr=num(x['gr']); bc,bf=bc_or_fit('Nosler',x['url'],None,[(d*YD,v*FPS) for d,v in zip(x['yd'],x['fps'])])
    if not bc or not gr: continue
    mm=re.search(r'\b%d ?(?:gr|g)?\.?\s+(.*)$'%int(gr or 0),nm); nm=re.sub(r'\s*-\s*RMEF','',nm).replace('Accubond','AccuBond')
    add(mk='Nosler',k=k,n=re.sub(r'\s*-\s*RMEF','',mm.group(1)).replace('Accubond','AccuBond').strip() if mm else nm,b=x['bullet'] or '',lf=1 if x['lf']=='Yes' else 0,m=round(gr*GR,2),g1=bc,bf=bf,g7=None,bl=round(num(x['barrel'])*25.4) if x['barrel'] else None,
        v=at_metres(x['yd'],x['fps'],FPS),e=at_metres(x['yd'],x['ftlb'],FTLB),u=x['url'])
# Winchester and Browning: no BC on the page
def olin(maker,file,skip,lead_free):
    for x in load(file):
        if re.search(skip,x['line']) or not x['head']: continue
        mm=re.match(r'(.+), ([\d.]+) Grain',x['head'])
        if not mm: continue
        k=canon2(mm.group(1))
        if not k: continue
        rows=[r for r in x['table'][1:] if r[1]]
        yd=[0 if r[0]=='muzzle' else int(r[0]) for r in rows]; fps=[float(r[1]) for r in rows]; ftlb=[float(r[2]) if r[2] else None for r in rows]
        bc,bf=bc_or_fit(maker,x['url'],None,[(d*YD,v*FPS) for d,v in zip(yd,fps)])
        if not bc: continue
        ln=re.sub(r'\s+',' ',x['line'].replace('-',' ')).strip()
        add(mk=maker,k=k,n=ln,b=ln+' · '+x['symbol'],lf=1 if re.search(lead_free,x['line']) else 0,m=round(float(mm.group(2))*GR,2),g1=bc,bf=bf,g7=None,bl=None,
            v=at_metres(yd,fps,FPS),e=at_metres(yd,ftlb,FTLB),u=x['url'])
olin('Winchester','winchester.json',r'^USA|Match|Defender|Suppressed|Garand|Anniversary',r'Copper|Lead-Free')
olin('Browning','browning.json',r'Match|Target|FMJ|Defense|Training',r'Copper|Solid-Expansion|Lead-Free')
# Sax: lead-free; calibre, bullet and weight are in the page address (".30-06-Spr.-KJG-SR-8-0-g")
for x in load('sax.json'):
    mm=re.match(r'(.+?)-((?:KJG|KDG|MJG)(?:-[A-Z]+)?)-(\d+)-(\d)-g$',x['slug'])
    if not mm: continue
    cal=mm.group(1); cal=re.sub(r'^(\d+)-(\d)(?=x|-)',r'\1,\2',cal)
    cal=re.sub(r'-(?!(?:06|250|284|378|70)\b)',' ',cal)
    k=canon2(cal)
    if not k: continue
    bc,bf=bc_or_fit('Sax',x['url'],None,list(zip(x['dist'],x['v'])))
    if not bc: continue
    at=lambda a: [a[x['dist'].index(d)] if d in x['dist'] and x['dist'].index(d)<len(a) else None for d in (0,100,200,300)]
    add(mk='Sax',k=k,n=mm.group(2),b=mm.group(2),lf=1,m=float(mm.group(3)+'.'+mm.group(4)),g1=bc,bf=bf,g7=None,bl=None,v=at(x['v']),e=at(x['e']),u=x['url'])
# The makers above are read in bulk, so their pages are checked here rather than by hand: a load
# listed twice is kept once, and a load whose own numbers contradict each other (muzzle energy
# against weight and velocity, or the table against the BC, by more than 3%) is left out.
AUTO={'Sax','Remington','Fiocchi','Blaser','Brenneke','PPU (Prvi Partizan)','Nosler','Winchester','Browning'}
_seen=set(); _keep=[]
for d in out:
    if d['mk'] in AUTO:
        sig=(d['mk'],d['k'],d['n'],d['m'],d['g1'],tuple(d['v']))
        if sig in _seen: continue
        _seen.add(sig)
        bad=None
        if d['e'][0] and abs(0.5*d['m']/1000*d['v'][0]**2-d['e'][0])/d['e'][0]>0.03: bad='muzzle energy'
        else:
            ds=[i*100 for i in (1,2,3) if d['v'][i]]
            if ds and max(abs(a-d['v'][x//100])/d['v'][x//100] for a,x in zip(_fly(d['v'][0],d['g1'],ds),ds))>0.028: bad='table'
        if bad: print('inconsistent page ('+bad+')',d['u'],file=sys.stderr); continue
    _keep.append(d)
out=_keep
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
    for f in ('g7','bl','bf'):
        if not d.get(f): d.pop(f,None)
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
order=['id','c','mk','n','b','lf','m','g1','g7','bf','bl','v','e','u']
out=[{k:d[k] for k in order if k in d} for d in out]
json.dump({'checked':__import__('datetime').date.today().isoformat(),'loads':out},open(sys.argv[1],'w'),ensure_ascii=False,separators=(',',':'))
print(len(out),len(set(d['c'] for d in out)),file=sys.stderr)
print(sorted(set(d['c'] for d in out)),file=sys.stderr)
