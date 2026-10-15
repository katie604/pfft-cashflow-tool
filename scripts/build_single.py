#!/usr/bin/env python3
"""Build Katie's Cashflow Creation as ONE self-contained .html file (Katie, 16 Oct 2026).

Output: ~/Documents/my-powerhouse/calculators/katies-cashflow-creation.html
Double-click it - no server needed. Inside it: Cashflow Creation (the React app), and the
Allocation Calculator and Profit First Assessment, each embedded from its ONE canonical file
in my-powerhouse/calculators/ (never copied by hand - re-run this after changing either).

What it does:
  1. vite build with base ./ into a temp folder
  2. inlines the JS, the CSS and the logo
  3. embeds the two calculators as window.__EMBED (App.tsx's frame() loads them via srcdoc)
  4. patches ONLY the embedded copies so they still work inside the file:
     - location.search -> the app's own query (an srcdoc page cannot see the address bar)
     - the Assessment's Approve and send jumps to THIS file, not the 5173 dev server
Every patch asserts its match count, so a changed calculator fails the build loudly instead
of producing a file that quietly does not work.

Pull from Xero still needs the Xero helper running (com.katie.cash-compass-api, port 8765) and
the Assessment needs com.katie.overheads-xero-bridge (8766). A file cannot reach Xero itself.

Run:  python3 scripts/build_single.py
"""
import base64
import json
import re
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CALC = Path.home() / "Documents" / "my-powerhouse" / "calculators"
OUT = CALC / "katies-cashflow-creation.html"
EMBEDS = {
    "allocation-calculator.html": CALC / "pfft-profit-first-allocation-calculator.html",
    "profit-first-assessment.html": CALC / "pfft-profit-first-assessment.html",
}
SHIM = ('<script>/* single-file build: read the app\'s query, not about:srcdoc */'
        'function __kccQS(){try{return parent.__frameQS||"";}catch(e){return "";}}</script>')


def sub_exact(s, old, new, expected, what):
    n = s.count(old)
    if n != expected:
        sys.exit(f"BUILD STOPPED: {what} - expected {expected} match(es) for {old!r}, found {n}")
    return s.replace(old, new)


def embed_page(name, path):
    s = path.read_text(encoding="utf-8")
    n = s.count("location.search")
    s = s.replace("location.search", "__kccQS()")
    if name == "profit-first-assessment.html":
        s = sub_exact(s, "'http://127.0.0.1:5173/pfft-cashflow-tool/?'",
                      "(window.top.location.href.split(/[?#]/)[0]+'?')", 1,
                      "Assessment Approve-and-send jump")
    m = re.search(r"<head[^>]*>", s, re.I)
    if m:
        s = s[:m.end()] + SHIM + s[m.end():]
    else:  # no <head>: after the doctype, never before it (that would be quirks mode)
        d = re.match(r"\s*<!doctype[^>]*>", s, re.I)
        cut = d.end() if d else 0
        s = s[:cut] + SHIM + s[cut:]
    print(f"  embedded {name}: {len(s):,} chars, {n} address reads redirected")
    return s


def main():
    for name, p in EMBEDS.items():
        if not p.exists():
            sys.exit(f"BUILD STOPPED: {p} is missing")
    with tempfile.TemporaryDirectory() as tmp:
        r = subprocess.run(["npx", "vite", "build", "--base", "./", "--outDir", tmp, "--emptyOutDir"],
                           cwd=ROOT, capture_output=True, text=True)
        if r.returncode:
            sys.exit("vite build failed:\n" + r.stderr[-2000:])
        out = Path(tmp)
        html = (out / "index.html").read_text(encoding="utf-8")
        js_files = list((out / "assets").glob("*.js"))
        css_files = list((out / "assets").glob("*.css"))
        if len(js_files) != 1 or len(css_files) != 1:
            sys.exit(f"BUILD STOPPED: expected 1 js + 1 css, got {len(js_files)} + {len(css_files)}")
        js = js_files[0].read_text(encoding="utf-8")
        css = css_files[0].read_text(encoding="utf-8")
        logo = "data:image/png;base64," + base64.b64encode((out / "brand" / "pfft-logo.png").read_bytes()).decode()

    # The logo: built code does "./"+X.logoSrc - drop the prefix, make logoSrc the image itself.
    js, n = re.subn(r'"\./"\+(\w+)\.logoSrc', r"\1.logoSrc", js)
    if n < 1:
        sys.exit("BUILD STOPPED: logo path pattern not found in the built app")
    js = sub_exact(js, '"brand/pfft-logo.png"', json.dumps(logo), js.count('"brand/pfft-logo.png"') or 1, "logo")
    if "</script" in js.lower():
        js = js.replace("</script", "<\\/script")

    embeds = {name: embed_page(name, p) for name, p in EMBEDS.items()}
    embed_js = "window.__EMBED=" + json.dumps(embeds).replace("</", "<\\/") + ";"

    html = re.sub(r'<link rel="icon"[^>]*>', f'<link rel="icon" type="image/png" href="{logo}" />', html)
    html = re.sub(r'\s*<script type="module"[^>]*src="[^"]+"></script>', "", html)
    html = re.sub(r'\s*<link rel="stylesheet"[^>]*href="\./assets/[^"]+">', "", html)
    stamp = datetime.now().strftime("%d %b %Y %H:%M")
    html = html.replace(
        "<head>",
        "<head>\n<!-- GENERATED FILE - do not edit by hand. Built " + stamp +
        " by ~/Documents/pfft-cashflow-tool/scripts/build_single.py from the app and the two\n"
        "     canonical calculators in my-powerhouse/calculators/. Change those, then re-run. -->",
        1)
    html = html.replace("</head>",
                        "<style>\n" + css + "\n</style>\n<script>" + embed_js + "</script>\n</head>", 1)
    html = html.replace("</body>", '<script type="module">\n' + js + "\n</script>\n</body>", 1)

    for must in ("window.__EMBED=", "GENERATED FILE", "__kccQS"):
        if must not in html:
            sys.exit(f"BUILD STOPPED: {must} missing from the output")
    if re.search(r'(src|href)="\./(assets|brand)/', html):
        sys.exit("BUILD STOPPED: a ./assets or ./brand reference survived - the file would not stand alone")
    OUT.write_text(html, encoding="utf-8")
    print(f"WROTE {OUT}  ({OUT.stat().st_size/1e6:.1f} MB)")


if __name__ == "__main__":
    main()
