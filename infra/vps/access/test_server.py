import http.client,importlib.util,json,pathlib,socket,tempfile,threading,subprocess
spec=importlib.util.spec_from_file_location('access_server',pathlib.Path(__file__).with_name('server.py'));app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)
with tempfile.TemporaryDirectory(prefix='gg-access-test-') as folder:
 app.DATA=pathlib.Path(folder);sock=str(app.DATA/'test.sock')
 (app.DATA/'users.htpasswd').write_text('admin:'+app.password_hash('admin','temporary-password-123')+'\nviewer:'+app.password_hash('viewer','temporary-password-123')+'\n')
 (app.DATA/'admins.json').write_text('["admin"]')
 server=app.Server(sock,app.Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
 def request(method,path,data=None,user='admin',csrf=True,origin=app.ORIGIN):
  client=http.client.HTTPConnection('localhost');client.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);client.sock.connect(sock)
  headers={'X-GG-Authenticated-User':user,'Origin':origin,'Content-Type':'application/json'}
  if csrf:headers['X-GG-CSRF']=app.token(user)
  client.request(method,path,body=None if data is None else json.dumps(data),headers=headers);r=client.getresponse();result=json.loads(r.read());client.close();return r.status,result
 assert request('GET','/session',user='')[0]==401
 assert request('GET','/users',user='viewer')[0]==403
 assert request('GET','/session',user='viewer')[1]['isAdmin'] is False
 record={'username':'testuser','password':'test-password-12345','admin':False}
 assert request('POST','/users',record,csrf=False)[0]==403
 assert request('POST','/users',record,origin='https://untrusted.invalid')[0]==403
 assert request('POST','/users',{**record,'password':'short'})[0]==400
 assert request('POST','/users',record)[0]==200
 assert request('POST','/users',record)[0]==409
 assert request('GET','/users')[1]['users'][0]['username']=='admin'
 assert all(set(u)=={'username','admin','current'} for u in request('GET','/users')[1]['users'])
 assert request('PUT','/users/testuser',{'username':'renamed','password':'','admin':True})[0]==200
 assert subprocess.run(['/usr/bin/htpasswd','-v','-i',str(app.DATA/'users.htpasswd'),'renamed'],input='test-password-12345\n',text=True,capture_output=True).returncode==0
 assert request('PUT','/users/renamed',{'username':'renamed','password':'replacement-password-123','admin':False})[0]==200
 assert subprocess.run(['/usr/bin/htpasswd','-v','-i',str(app.DATA/'users.htpasswd'),'renamed'],input='replacement-password-123\n',text=True,capture_output=True).returncode==0
 assert request('DELETE','/users/admin',{})[0]==400
 assert request('PUT','/users/admin',{'username':'admin','password':'','admin':False})[0]==400
 assert request('DELETE','/users/renamed',{})[0]==200
 assert set(app.load()[0])=={'admin','viewer'}
 server.shutdown();server.server_close()
 print('PASS: create, edit, rename, password verification, delete, roles, CSRF, origin and self/last-admin protections')
