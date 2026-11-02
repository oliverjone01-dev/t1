import os,tempfile,pathlib,json,threading,http.client,socket,importlib.util
root=pathlib.Path(tempfile.mkdtemp(prefix='gg-routing-tests-'));data=root/'access';data.mkdir();route=root/'route';route.mkdir()
(data/'users.htpasswd').write_text('yanchoglov:fixture-owner-hash\nviewer:fixture-viewer-hash\nadmin2:fixture-admin-hash\n')
(data/'admins.json').write_text('["yanchoglov","admin2"]')
os.environ['GG_ACCESS_DATA']=str(data);os.environ['GG_ROUTING_STATE']=str(route/'mode.json')
import server as api
server=api.Server(str(root/'server.sock'),api.Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
class Unix(http.client.HTTPConnection):
 def connect(self):self.sock=socket.socket(socket.AF_UNIX);self.sock.connect(str(root/'server.sock'))
def request(path,user='yanchoglov',method='GET',body=None,extra=None):
 c=Unix('local');headers={'X-GG-Authenticated-User':user}
 if body is not None:headers.update({'Content-Type':'application/json','Origin':'https://201.51.7.251:8443','X-GG-CSRF':api.token(user)})
 if extra:headers.update(extra)
 c.request(method,path,None if body is None else json.dumps(body),headers);r=c.getresponse();out=(r.status,dict(r.getheaders()),r.read());c.close();return out
original=(data/'users.htpasswd').read_bytes()
assert request('/session')[0]==200
assert json.loads(request('/session')[2])['isRoutingOwner']
assert not json.loads(request('/session','admin2')[2])['isRoutingOwner']
for u in ['viewer','admin2']:
 for p in ['/routing','/recovery','/routing-client']:assert request(p,u)[0]==403
 assert request('/routing',u,'POST',{'mode':'ip'})[0]==403
assert request('/routing',method='POST',body={'mode':'ip'},extra={'Origin':'https://evil.invalid'})[0]==403
assert request('/routing',method='POST',body={'mode':'ip'},extra={'X-GG-CSRF':'wrong'})[0]==403
assert request('/routing',method='POST',body={'mode':'bad'})[0]==400
for mode,host,port in [('ip','201.51.7.251','8443'),('domain','dash.genglas.ru','443')]:
 r=request('/routing',method='POST',body={'mode':mode});assert r[0]==200,r
 state=json.loads(r[2]);assert state['mode']==mode
 assert request('/route-check',user='',extra={'X-GG-Request-Host':host,'X-GG-Request-Port':port})[0]==204
 r=request('/route-check',user='',extra={'X-GG-Request-Host':'wrong.invalid','X-GG-Request-Port':'443'})
 assert r[0]==403 and r[1]['X-GG-Redirect-Base']==state['baseUrl']
assert request('/routing','missing')[0]==401
assert request('/recovery')[0]==200
assert request('/routing-client')[0]==200
assert (data/'users.htpasswd').read_bytes()==original
server.shutdown();server.server_close()
print('PASS owner-only routing API, CSRF, exact origins, both modes, recovery, unknown users, immutable passwords')
