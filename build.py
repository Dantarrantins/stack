"""Builds index.html from the shared Stack page source (the same file the Claude artifact publishes)."""
import sys
src = open(sys.argv[1]).read()
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
<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
'''
i = src.index('<header class="top">')
pre, body = src[:i], src[i:]
libs = ''.join(f'<script src="{f}"></script>\n' for f in ['vendor/firebase-app-compat.js','vendor/firebase-auth-compat.js','vendor/firebase-firestore-compat.js','firebase-config.js','cloud.js','local-db.js'])
body = body.replace('<script>', libs + '<script>', 1)
sw = '<script>if("serviceWorker" in navigator&&location.protocol==="https:"){addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}))}</script>\n'
open('index.html', 'w').write(head + pre + '</head>\n<body>\n' + body + '\n' + sw + '</body>\n</html>\n')
