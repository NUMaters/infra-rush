"""Small static preview server. Preload once to avoid file I/O during asset requests."""
import argparse, pathlib, mimetypes, re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, unquote
parser=argparse.ArgumentParser();parser.add_argument('--directory',default='dist');parser.add_argument('--port',type=int,default=5175);parser.add_argument('--bind',default='0.0.0.0');args=parser.parse_args()
root=pathlib.Path(args.directory).resolve()
cache={('/'+p.relative_to(root).as_posix()):(p.read_bytes(),mimetypes.guess_type(p.name)[0] or 'application/octet-stream') for p in root.rglob('*') if p.is_file() and not p.name.startswith('.') and not re.search(r' \d+$',p.stem) and not any(x.startswith('bundle-') for x in p.parts)}
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  path=unquote(urlsplit(self.path).path);path=path+'index.html' if path.endswith('/') else path
  if path not in cache:self.send_error(404);return
  body,mime=cache[path];total=len(body);start=0;end=total-1;partial=False
  requested=self.headers.get('Range')
  if requested:
   match=re.fullmatch(r'bytes=(\d*)-(\d*)',requested.strip())
   try:
    if not match or not any(match.groups()):raise ValueError()
    first,last=match.groups()
    if first:start=int(first);end=min(int(last),total-1) if last else total-1
    else:start=max(0,total-int(last));end=total-1
    if start>=total or end<start:raise ValueError()
    partial=True
   except ValueError:
    self.send_response(416);self.send_header('Content-Range',f'bytes */{total}');self.send_header('Content-Length','0');self.end_headers();return
  self.send_response(206 if partial else 200);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(end-start+1));self.send_header('Accept-Ranges','bytes')
  if partial:self.send_header('Content-Range',f'bytes {start}-{end}/{total}')
  self.send_header('Cache-Control','no-cache');self.end_headers()
  if self.command=='HEAD':return
  try:self.wfile.write(body[start:end+1])
  except (BrokenPipeError,ConnectionResetError):pass
 def do_HEAD(self):self.do_GET()
 def log_message(self,*args):pass
print(f'INFRA RUSH: {len(cache)} files, {sum(len(x[0]) for x in cache.values())/1048576:.2f} MiB preloaded; http://localhost:{args.port}/',flush=True)
ThreadingHTTPServer((args.bind,args.port),Handler).serve_forever()
