# Prvi Partizan (PPU): the rifle ammunition search, one calibre at a time, then each load's
# "Ballistics" page (metric, 50 m steps). PPU publishes no BC; norm.py fits one to the table.
import os,re,json,subprocess,sys,html as H
from concurrent.futures import ThreadPoolExecutor
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
B='https://www.prvipartizan.com/'
def get(u,*a): return subprocess.run(['curl','-sS','-L','--max-time','40','-A',UA,*a,u],capture_output=True,text=True,errors='replace').stdout
def flat(t):
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S)
    t=re.sub(r'\s+',' ',H.unescape(re.sub(r'<[^>]+>','|',t))); return re.sub(r'(\| ?)+','|',t)
out=[]
for page in ('rifle_ammo.php','rifle_grom.php','leadless.php','rifle_new.php'):
    form=re.search(r'<form action="(search_r[^"]*)".*?</form>',get(B+page),re.S)
    if not form: continue
    cals=[H.unescape(c).strip() for c in re.findall(r'<option>([^<]+)</option>',form.group(0))]
    for c in cals:
        raw=get(B+form.group(1),'--data-urlencode','searchterm='+c,'-d','searchtype=calibre','-d','submit=Search')
        for row in re.findall(r'<tr\s*>(.*?)(?=<tr\s*>|</table>)',raw,re.S):
            td=[re.sub(r'<[^>]+>','',x).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>',row,re.S)]
            m=re.search(r'href=(search_rb\.php\?id=[A-Z]-\d+)',row)
            if m and len(td)>=6: out.append(dict(cal=c,art=td[0],type=td[2],mass=td[3],gr=td[4],barrel=td[5],url=B+m.group(1)))
by={}
for x in out: by.setdefault(x['url'],x)
out=list(by.values()); print(len(out),file=sys.stderr)
def one(x):
    t=flat(get(x['url']))
    try:
        d=[int(v) for v in t.split('Ballistics |')[1].split('|')[:12] if v.strip().isdigit()]
        v=[float(a) for a in t.split('|Velocity [m/s]|')[1].split('|Energy')[0].split('|')]
        e=[float(a) for a in t.split('|Energy [J]|')[1].split('|Trajectory')[0].split('|')]
        x.update(dist=d[:len(v)],v=v,e=e)
    except Exception as ex: print('FAIL',x['url'],ex,file=sys.stderr)
    return x
with ThreadPoolExecutor(4) as ex: out=[x for x in ex.map(one,out) if 'v' in x]
json.dump(out,open(os.environ.get('AMMO_CACHE','.ammo-cache')+'/ppu.json','w'))
print(len(out),file=sys.stderr)
