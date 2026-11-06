"""One public dashboard address, shared by nginx routing and scheduled reports."""
import json,os,pathlib,tempfile
from datetime import datetime,timezone
OWNER='yanchoglov'
BASES={'domain':'https://dash.genglas.ru','ip':'https://201.51.7.251:8443'}
STATE=pathlib.Path(os.environ.get('GG_ROUTING_STATE','/srv/gg/routing/mode.json'))
def read_mode():
 try:
  item=json.loads(STATE.read_text(encoding='utf-8'))
  mode=item['mode']
  if mode not in BASES:raise ValueError('Invalid routing mode')
 except FileNotFoundError:
  item={};mode='domain'
 return {'mode':mode,'baseUrl':BASES[mode],'updatedAt':item.get('updatedAt'),'updatedBy':item.get('updatedBy'),'recoveryUrl':BASES['ip']+'/_access/recovery/'}
def write_mode(mode,actor):
 if actor!=OWNER or mode not in BASES:raise ValueError('Owner and a valid mode required')
 item={'mode':mode,'updatedAt':datetime.now(timezone.utc).isoformat(),'updatedBy':actor}
 fd,tmp=tempfile.mkstemp(prefix='.mode-',dir=STATE.parent)
 try:
  os.fchmod(fd,0o644)
  with os.fdopen(fd,'w',encoding='utf-8') as f:json.dump(item,f);f.write('\n');f.flush();os.fsync(f.fileno())
  os.replace(tmp,STATE)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)
 return read_mode()
