"""Only dashboard link routing; no API clients or credentials."""
import json,os,pathlib,re
def base_url():
 p=pathlib.Path(os.environ.get('GG_ROUTING_STATE','/srv/gg/routing/mode.json'))
 mode=json.loads(p.read_text())['mode'] if p.exists() else 'domain'
 return {'domain':'https://dash.genglas.ru','ip':'https://201.51.7.251:8443'}[mode]
def route_text(text,base=None):
 if not isinstance(text,str):return text
 base=base or base_url()
 text=re.sub(r'https://(?:dash\.genglas\.ru|201\.51\.7\.251:8443)(?=/|[\s"\'<>)]|$)',base,text)
 return re.sub(r'https://oliverjone01-dev\.github\.io/t1(?=/(?:rop(?:-[a-z-]+)?|dashboards|dialog|office|prod|pto|economics|econ-control|plan|structure|status)(?:/|[?#\s"\'<>)]|$))',base,text)
def route_payload(payload):
 out=dict(payload);base=base_url()
 for key in ['text','caption']:
  if isinstance(out.get(key),str):out[key]=route_text(out[key],base)
 markup=out.get('reply_markup')
 if isinstance(markup,dict) and 'inline_keyboard' in markup:
  out['reply_markup']={**markup,'inline_keyboard':[[{**b,'url':route_text(b['url'],base)} if 'url' in b else b for b in row] for row in markup['inline_keyboard']]}
 return out
