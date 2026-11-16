from html.parser import HTMLParser
from html import escape
import re
VOID={"img","input","meta","link","br","hr","source","wbr"}
class N:
 def __init__(self,t,a=(),p=None):self.t=t;self.a=dict(a);self.p=p;self.c=[]
 def walk(self):
  yield self
  for c in self.c:
   if isinstance(c,N):yield from c.walk()
 def text(self):return re.sub(r'\s+',' ',' '.join(c.text() if isinstance(c,N) else c for c in self.c)).strip()
 def cls(self,s):self.a['class']=(self.a.get('class','')+' '+s).strip()
 def append(self,n):n.p=self;self.c.append(n);return n
 def html(self):
  if self.t=='root':return ''.join(c.html() if isinstance(c,N) else c for c in self.c)
  attrs=''.join(' '+k+(('="'+escape(str(v),quote=True)+'"') if v is not None else '') for k,v in self.a.items())
  if self.t in VOID:return '<'+self.t+attrs+'>'
  return '<'+self.t+attrs+'>'+''.join(c.html() if isinstance(c,N) else (c if self.t in {'script','style'} else escape(c)) for c in self.c)+'</'+self.t+'>'
class P(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.root=N('root');self.at=self.root
 def handle_starttag(self,t,a):
  n=N(t,a,self.at);self.at.c.append(n)
  if t not in VOID:self.at=n
 def handle_endtag(self,t):
  n=self.at
  while n.p and n.t!=t:n=n.p
  if n.p:self.at=n.p
 def handle_data(self,s):self.at.c.append(s)
def fragment(s):p=P();p.feed(s);return p.root.c
