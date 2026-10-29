#!/usr/bin/env python3
"""Password administration behind nginx Basic Auth, over a local Unix socket."""
import contextlib,fcntl,hashlib,hmac,json,os,pathlib,re,secrets,socketserver,subprocess,tempfile,threading
from http.server import BaseHTTPRequestHandler
from urllib.parse import unquote

DATA=pathlib.Path(os.environ.get('GG_ACCESS_DATA','/srv/gg/access'))
SOCKET=os.environ.get('GG_ACCESS_SOCKET','/run/gg-access/http.sock')
ORIGIN='https://dash.genglas.ru'
SECRET=secrets.token_bytes(32)
LOCK=threading.RLock()
USER=re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]{1,63}\Z')

class Problem(Exception):
 def __init__(self,status,message):self.status,self.message=status,message

def load():
 users={}
 for line in (DATA/'users.htpasswd').read_text().splitlines():
  if line and ':' in line:
   name,hashed=line.split(':',1);users[name]=hashed
 admins=set(json.loads((DATA/'admins.json').read_text()))
 return users,admins

@contextlib.contextmanager
def locked():
 with LOCK:
  with (DATA/'write.lock').open('a') as f:
   fcntl.flock(f,fcntl.LOCK_EX)
   yield

def atomic(path,content,mode):
 fd,tmp=tempfile.mkstemp(prefix='.write-',dir=DATA)
 try:
  os.fchmod(fd,mode)
  with os.fdopen(fd,'w') as f:f.write(content);f.flush();os.fsync(f.fileno())
  os.replace(tmp,path)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)

def save(users,admins):
 if not admins.intersection(users):raise Problem(400,'Нужен хотя бы один администратор.')
 old_users=(DATA/'users.htpasswd').read_text();old_admins=(DATA/'admins.json').read_text()
 try:
  atomic(DATA/'users.htpasswd',''.join(n+':'+v+'\n' for n,v in sorted(users.items())),0o640)
  atomic(DATA/'admins.json',json.dumps(sorted(admins),ensure_ascii=False)+'\n',0o600)
 except Exception:
  atomic(DATA/'users.htpasswd',old_users,0o640);atomic(DATA/'admins.json',old_admins,0o600)
  raise

def password_hash(username,password):
 if not isinstance(password,str) or len(password)<12 or len(password.encode())>72 or any(c in password for c in '\r\n\x00'):
  raise Problem(400,'Пароль: от 12 символов, не более 72 байт, без переносов строки.')
 result=subprocess.run(['/usr/bin/htpasswd','-n','-B','-C','12','-i',username],input=password+'\n',text=True,capture_output=True,timeout=15)
 if result.returncode:raise Problem(500,'Не удалось сохранить пароль.')
 return result.stdout.strip().split(':',1)[1]

def token(user):return hmac.new(SECRET,user.encode(),hashlib.sha256).hexdigest()

class Handler(BaseHTTPRequestHandler):
 server_version='GG-Access'
 def log_message(self,*args):pass
 def reply(self,status,data):
  raw=json.dumps(data,ensure_ascii=False).encode();self.send_response(status)
  self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(raw)))
  self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(raw)
 def run_request(self,method):
  try:
   user=self.headers.get('X-GG-Authenticated-User','')
   with locked():users,admins=load()
   if not user or user not in users:raise Problem(401,'Требуется вход.')
   path=self.path.split('?',1)[0]
   if method=='GET' and path=='/session':return self.reply(200,{'username':user,'isAdmin':user in admins,'csrf':token(user) if user in admins else None})
   if user not in admins:raise Problem(403,'Управление доступом разрешено только администратору.')
   if method=='GET' and path=='/users':return self.reply(200,{'users':[{'username':name,'admin':name in admins,'current':name==user} for name in sorted(users)]})
   if method not in ('POST','PUT','DELETE'):raise Problem(404,'Раздел не найден.')
   if self.headers.get('Origin')!=ORIGIN or not hmac.compare_digest(self.headers.get('X-GG-CSRF',''),token(user)):
    raise Problem(403,'Обновите страницу и повторите действие.')
   if self.headers.get('Content-Type','').split(';')[0].strip()!='application/json':raise Problem(415,'Ожидается JSON.')
   try:length=int(self.headers.get('Content-Length','0'))
   except ValueError:raise Problem(400,'Неверный запрос.')
   if not 0<length<=8192:raise Problem(400,'Неверный размер запроса.')
   try:data=json.loads(self.rfile.read(length))
   except (ValueError,UnicodeError):raise Problem(400,'Неверный запрос.')
   if not isinstance(data,dict):raise Problem(400,'Неверный запрос.')
   name=data.get('username','');password=data.get('password','');admin=data.get('admin',False)
   if method!='DELETE' and (not isinstance(name,str) or not USER.fullmatch(name)):raise Problem(400,'Логин: 2–64 символа, латинские буквы, цифры, точка, дефис или подчёркивание.')
   if not isinstance(admin,bool):raise Problem(400,'Неверная роль.')
   hashed=password_hash(name,password) if method!='DELETE' and password else None
   if method=='POST' and hashed is None:raise Problem(400,'Укажите пароль нового пользователя.')
   with locked():
    users,admins=load()
    if user not in users or user not in admins:raise Problem(403,'Нет прав администратора.')
    if method=='POST' and path=='/users':
     if name in users:raise Problem(409,'Этот логин уже существует.')
     if len(users)>=100:raise Problem(400,'Достигнут предел пользователей.')
     users[name]=hashed
     if admin:admins.add(name)
     action='create'
    elif path.startswith('/users/'):
     old=unquote(path[len('/users/'):])
     if old not in users:raise Problem(404,'Пользователь не найден.')
     if method=='DELETE':
      if old==user:raise Problem(400,'Нельзя удалить собственный вход.')
      del users[old];admins.discard(old);name=old;action='delete'
     elif method=='PUT':
      if old==user and (name!=old or not admin):raise Problem(400,'Нельзя переименовать собственный вход или снять с себя права администратора.')
      if name!=old and name in users:raise Problem(409,'Этот логин уже существует.')
      value=users.pop(old);admins.discard(old);users[name]=hashed or value
      if admin:admins.add(name)
      action='update'
     else:raise Problem(404,'Раздел не найден.')
    else:raise Problem(404,'Раздел не найден.')
    save(users,admins)
   print(json.dumps({'event':'access.'+action,'actor':user,'user':name,'admin':name in admins},ensure_ascii=False),flush=True)
   return self.reply(200,{'ok':True})
  except Problem as e:self.reply(e.status,{'error':e.message})
  except Exception:self.reply(500,{'error':'Не удалось выполнить действие. Повторите позже.'})
 def do_GET(self):self.run_request('GET')
 def do_POST(self):self.run_request('POST')
 def do_PUT(self):self.run_request('PUT')
 def do_DELETE(self):self.run_request('DELETE')

class Server(socketserver.ThreadingMixIn,socketserver.UnixStreamServer):daemon_threads=True
if __name__=='__main__':
 pathlib.Path(SOCKET).unlink(missing_ok=True)
 with Server(SOCKET,Handler) as server:
  os.chmod(SOCKET,0o660);server.serve_forever()
