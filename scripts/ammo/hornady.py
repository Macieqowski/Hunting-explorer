# Hornady: every rifle product page in the sitemap. Tables are in yards / fps / ft-lb;
# norm.py converts them to metres.
import os,re,json,subprocess,sys,html as H
from concurrent.futures import ThreadPoolExecutor
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
def get(u): return subprocess.run(['curl','-sS','-L','--max-time','40','-A',UA,u],capture_output=True,text=True).stdout
urls=sorted(set(re.findall(r'<loc>(https://www.hornady.com/ammunition/rifle/[^<]+)</loc>',get('https://www.hornady.com/sitemap.xml'))))
print(len(urls),file=sys.stderr)
def flat(t):
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S)
    t=re.sub(r'\s+',' ',H.unescape(re.sub(r'<[^>]+>','|',t))); return re.sub(r'(\| ?)+','|',t)
def one(u):
    raw=get(u)
    try:
        title=json.loads('"'+re.search(r'"title":"((?:[^"\\]|\\.)*)"',raw).group(1)+'"')
        rec=lambda k: (re.search(r'"'+k+r'":([^,]+),',raw) or [None,None])[1]
        t=flat(raw)
        m=re.search(r'\|Test Barrel \(([\d.]+)"?\)\|Muz\|((?:\d+ Yards\|)+)Velocity \|\(FPS\)\|Energy \|\(ft/lb\)\|Trajectory \|\(inches\)\|((?:-?[\d.,]+\|)+)',t)
        if not m: print('NOTABLE',u,file=sys.stderr); return None
        yd=[0]+[int(x) for x in re.findall(r'(\d+) Yards',m.group(2))]
        nums=[float(x.replace(',','')) for x in m.group(3).strip('|').split('|')]
        rows=[nums[i*3:i*3+3] for i in range(len(yd))]
        line=re.sub(r'<[^>]+>','',json.loads('"'+(re.search(r'"linetitle":"((?:[^"\\]|\\.)*)"',raw) or [0,''])[1]+'"'))
        return dict(url=u,title=title,line=H.unescape(line),barrel_in=float(m.group(1)),gr=float(rec('weight')),bc=rec('ball_coef'),bct=rec('ball_coef_type'),bc2=rec('ball_coef_2'),bct2=rec('ball_coef_type_2'),
                    yd=yd,fps=[r[0] for r in rows],ftlb=[r[1] for r in rows])
    except Exception as ex:
        print('FAIL',u,ex,file=sys.stderr)
with ThreadPoolExecutor(4) as ex: out=[x for x in ex.map(one,urls) if x]
json.dump(out,open(os.environ.get('AMMO_CACHE','.ammo-cache')+'/hornady.json','w'))
print(len(out),file=sys.stderr)
