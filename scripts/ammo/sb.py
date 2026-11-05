import os,re,html,json,subprocess,sys,time
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
B='https://www.sellier-bellot.cz'
def get(u):
    return subprocess.run(['curl','-sS','-L','--max-time','30','-A',UA,u],capture_output=True,text=True).stdout
def flat(t):
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S)
    t=html.unescape(re.sub(r'<[^>]+>','|',t)); return re.sub(r'\s*\|[\s|]*','|',t)
home=get(B+'/en/products/rifle-ammunition/')
cats=sorted(set(re.findall(r'href="(/en/products/rifle-ammunition/[a-z0-9-]+/)"',home)))
details=set()
for c in cats:
    for suf in ('list/',''):
        p=get(B+c+suf)
        details|=set(re.findall(r'href="(/en/products/rifle-ammunition/[a-z0-9-]+/detail/\d+/)"',p))
print(len(cats),len(details),file=sys.stderr)
out=[]
def num(s): return float(s.replace(',','').replace(' ',''))
for d in sorted(details):
    t=flat(get(B+d))
    try:
        m=re.search(r'\|Rifle ammunition\|[^|]*\|([^|]+)\|\1\|([^|]+)\|(V\d+)\|([^|]+)\|',t)
        cal,typ,code,wt=m.groups()
        V=re.search(r'\|Velocity\|m/s\|((?:[\d,]+\|){5})',t).group(1).strip('|').split('|')
        E=re.search(r'\|Energy\|J\|((?:[\d,]+\|){5})',t).group(1).strip('|').split('|')
        g=re.search(r'\|Weight\|grs\|([\d.]+)\|g\|(\d+)\|\.(\d+)\|',t)
        g1=re.search(r'\|G1\|(\d)\|\.(\d+)\|',t); g7=re.search(r'\|G7\|(\d)\|\.(\d+)\|',t)
        tb=re.search(r'\|Test barrel length\|mm\|(\d+)\|',t)
        use=re.search(r'\|Suggested use\|([^|]+)\|',t)
        poi=re.search(r'\|Points of impact\|cm\|(.*?)\|Points of impact MRD',t)
        out.append(dict(url=B+d,cal=cal.strip(),type=typ.strip(),code=code,name=wt.strip(),
          grains=float(g.group(1)),mass=float(g.group(2)+'.'+g.group(3)),
          v=[num(x) for x in V],e=[num(x) for x in E],
          g1=float(g1.group(1)+'.'+g1.group(2)) if g1 else None,g7=float(g7.group(1)+'.'+g7.group(2)) if g7 else None,
          barrel=int(tb.group(1)) if tb else None,use=use.group(1) if use else None,poi=poi.group(1) if poi else None))
    except Exception as ex:
        print('FAIL',d,ex,file=sys.stderr)
json.dump(out,open(os.environ.get('AMMO_CACHE','.ammo-cache')+'/sb.json','w'),indent=0)
print(len(out),file=sys.stderr)
