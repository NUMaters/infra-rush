"""Small static preview server. Preload once to avoid file I/O during asset requests."""
import argparse, pathlib, mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, unquote
parser=argparse.ArgumentParser();parser.add_argument('--directory',default='dist');parser.add_argument('--port',type=int,default=5175);parser.add_argument('--bind',default='0.0.0.0');args=parser.parse_args()
root=pathlib.Path(args.directory).resolve()
cache={('/'+p.relative_to(root).as_posix()):(p.read_bytes(),mimetypes.guess_type(p.name)[0] or 'application/octet-stream') for p in root.rglob('*') if p.is_file() and not p.name.startswith('.') and not any(x.startswith('bundle-') for x in p.parts)}
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  path=unquote(urlsplit(self.path).path);path=path+'index.html' if path.endswith('/') else path
  if path not in cache:self.send_error(404);return
  body,mime=cache[path];self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-cache');self.end_headers()
  try:self.wfile.write(body)
  except (BrokenPipeError,ConnectionResetError):pass
 def log_message(self,*args):pass
print(f'INFRA RUSH: {len(cache)} files, {sum(len(x[0]) for x in cache.values())/1048576:.2f} MiB preloaded; http://localhost:{args.port}/',flush=True)
ThreadingHTTPServer((args.bind,args.port),Handler).serve_forever()
