"""Build Stack into dist/ for hosting.

  python3 build.py            -> dist/

- src/stack.html is the page source (the same file the Claude artifact publishes, used there as a design sandbox).
- src/static/* is copied as-is (scripts, icons, manifest, seed data, vendored Firebase SDK).
- The version (VERSION) and a hash of every shipped file are stamped into the page and the service worker,
  so each release gets a fresh offline cache and open copies of the app are told to refresh.
"""
import hashlib, os, shutil, subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC, STATIC, OUT = os.path.join(ROOT, "src"), os.path.join(ROOT, "src", "static"), os.path.join(ROOT, "dist")
version = open(os.path.join(ROOT, "VERSION")).read().strip()

shutil.rmtree(OUT, ignore_errors=True)
shutil.copytree(STATIC, OUT)
src = open(os.path.join(SRC, "stack.html")).read()

head = '''<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Stack: small, expert-backed habits stacked onto your morning, lunch and evening.">
<meta name="theme-color" content="#FBF9F4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#141716" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Stack">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}
.env-badge{position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 6px);z-index:70;font:600 11px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;padding:5px 9px;border-radius:999px;background:#C9832E;color:#fff;pointer-events:none}
.update-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 96px);z-index:70;display:flex;gap:12px;align-items:center;padding:10px 10px 10px 16px;border-radius:999px;background:#1E2421;color:#FBF9F4;font:500 14px/1.2 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.2)}
.update-bar button{font:inherit;border:0;border-radius:999px;padding:8px 14px;background:#FBF9F4;color:#1E2421;cursor:pointer}
@media (min-width:601px){.update-bar{bottom:24px}}</style>
'''
i = src.index('<header class="top">')
pre, body = src[:i], src[i:]
libs = f'<script>window.STACK_VERSION="{version}";</script>\n' + ''.join(
    f'<script src="{f}"></script>\n' for f in ["vendor/firebase-app-compat.js", "vendor/firebase-auth-compat.js",
                                              "vendor/firebase-firestore-compat.js", "firebase-config.js", "cloud.js", "local-db.js"])
body = body.replace('<script>', libs + '<script>', 1)

# Service worker + "new version" prompt + a badge on non-live copies so previews are never mistaken for the real app
tail = '''<script>
(function(){
  if(window.STACK_ENV&&window.STACK_ENV!=="live"){const b=document.createElement("div");b.className="env-badge";b.textContent=window.STACK_ENV==="preview"?"Preview":"Local";document.body.append(b)}
  if(!("serviceWorker" in navigator)||location.protocol!=="https:")return;
  let shown=false;const hadController=!!navigator.serviceWorker.controller;
  function offer(){if(shown||!hadController)return;shown=true;
    const bar=document.createElement("div");bar.className="update-bar";bar.setAttribute("role","status");
    const t=document.createElement("span");t.textContent="A new version of Stack is ready";
    const btn=document.createElement("button");btn.type="button";btn.textContent="Refresh";btn.onclick=()=>location.reload();
    bar.append(t,btn);document.body.append(bar)}
  navigator.serviceWorker.addEventListener("controllerchange",offer);
  addEventListener("load",()=>navigator.serviceWorker.register("sw.js").then(reg=>{
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")reg.update().catch(()=>{})})
  }).catch(()=>{}));
})();
</script>
'''
html = head + pre + '</head>\n<body>\n' + body + '\n' + tail + '</body>\n</html>\n'
open(os.path.join(OUT, "index.html"), "w").write(html)

# Cache name = version + hash of everything shipped, so any change produces a new cache and an update prompt
h = hashlib.sha256()
for dp, _, fs in sorted(os.walk(OUT)):
    for f in sorted(fs):
        if f == "sw.js": continue
        h.update(f.encode()); h.update(open(os.path.join(dp, f), "rb").read())
cache = f"stack-{version}-{h.hexdigest()[:8]}"
swp = os.path.join(OUT, "sw.js")
sw = open(swp).read().replace("__CACHE__", cache)
open(swp, "w").write(sw)
print(f"Built Stack {version} -> dist/ (cache {cache})")
