# Blaser: one page per bullet (CDC, CDB, CDX); each calibre is a variant of that page, reached
# the way the page's own "Caliber" menu does it. Metric tables.
import os,re,json,subprocess,sys,html as H,urllib.parse
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
B='https://www.blaser.de'
def get(u): return subprocess.run(['curl','-sS','-L','--max-time','40','-A',UA,u],capture_output=True,text=True).stdout
def flat(t):
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S)
    t=re.sub(r'\s+',' ',H.unescape(re.sub(r'<[^>]+>','|',t))); return re.sub(r'(\| ?)+','|',t)
start=sorted(set(re.findall(r'href="('+B+r'/en/C[A-Z]{2}-[^"]+)"',get(B+'/en/Ammunition/'))))
print(start,file=sys.stderr)
seen={}; todo=list(start); out=[]
while todo:
    u=todo.pop()
    if u in seen: continue
    raw=get(u); seen[u]=1
    sw=re.search(r'data-variant-switch-options="([^"]+)"',raw)
    groups=re.findall(r'<select name="([0-9a-f]{32})"[^>]*>(.*?)</select>',raw,re.S)
    sel={}; labels={}
    for g,body in groups:
        for val,s,lab in re.findall(r'<option value="([0-9a-f]{32})"\s*(selected="selected"|selected)?\s*>\s*([^<]+?)\s*</option>',body):
            labels[val]=H.unescape(lab)
            if s: sel[g]=val
    if sw and groups:
        url=json.loads(H.unescape(sw.group(1)))['url']
        for g,body in groups:
            for val in re.findall(r'<option value="([0-9a-f]{32})"',body):
                if sel.get(g)==val: continue
                o=dict(sel); o[g]=val
                try:
                    r=json.loads(get(url+'?options='+urllib.parse.quote(json.dumps(o))+'&switched='+g))
                    if r.get('url') and r['url'] not in seen: todo.append(r['url'])
                except Exception as ex: print('switch fail',u,ex,file=sys.stderr)
    t=flat(raw)
    try:
        f=lambda k: (re.search(r'\|'+k+r'\|([^|]+)\|',t) or [None,None])[1]
        name=re.search(r'\|Ammunition\|([^|]+?) ?\|',t).group(1)
        def tab(head,unit):
            seg=t.split('|'+head+'|Distance (m)|'+unit+'|')[1]
            return dict(re.findall(r'(\d+) \|(\d+)\|',seg.split('|Point of impact')[0].split('|Energy over')[0]+'|'))
        out.append(dict(url=u,name=name,cal=' / '.join(labels[v] for v in sel.values()),bc=f(r'Ballistic coefficient \(BC\)'),barrel=f('Barrel length'),mass=f('Projectile weight'),
                        v=tab('Velocity over distance',r'Velocity (m/s)'),e=tab('Energy over distance','Energy (J)')))
    except Exception as ex: print('FAIL',u,ex,file=sys.stderr)
json.dump(out,open(os.environ.get('AMMO_CACHE','.ammo-cache')+'/blaser.json','w'))
print(len(out),file=sys.stderr)
