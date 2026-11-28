"""Vector diagrams for the prep guide (plain SVG strings)."""
from html import escape

G = ("#e6f6ec", "#1a9a52")   # implemented
A = ("#fff4d6", "#c98a00")   # partial
R = ("#fdeaea", "#d64545")   # planned / missing
B = ("#e8f0fe", "#3b6fd4")   # neutral / infrastructure
N = ("#f1f3f6", "#8a94a6")   # grey

def svg(w, h, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="100%" '
            f'font-family="Arial, Helvetica, sans-serif">'
            '<defs><marker id="ar" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">'
            '<path d="M0,0 L10,4 L0,8 z" fill="#44506a"/></marker></defs>' + body + '</svg>')

def box(x, y, w, h, lines, col=B, dash=False, fs=12, bold_first=True, tc="#1b2433"):
    fill, stroke = col
    d = ' stroke-dasharray="5,4"' if dash else ''
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{fill}" stroke="{stroke}" stroke-width="1.6"{d}/>'
    if isinstance(lines, str):
        lines = [lines]
    n = len(lines)
    lh = fs + 3
    y0 = y + h / 2 - (n - 1) * lh / 2 + fs / 3
    for i, t in enumerate(lines):
        wt = "bold" if (i == 0 and bold_first) else "normal"
        sz = fs if i == 0 else fs - 1
        out += (f'<text x="{x + w/2}" y="{y0 + i*lh}" text-anchor="middle" font-size="{sz}" '
                f'font-weight="{wt}" fill="{tc}">{escape(t)}</text>')
    return out

def arrow(x1, y1, x2, y2, label="", dash=False, lx=None, ly=None):
    d = ' stroke-dasharray="5,4"' if dash else ''
    out = f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#44506a" stroke-width="1.6" marker-end="url(#ar)"{d}/>'
    if label:
        mx = lx if lx is not None else (x1 + x2) / 2
        my = ly if ly is not None else (y1 + y2) / 2 - 5
        out += f'<text x="{mx}" y="{my}" text-anchor="middle" font-size="10" fill="#44506a">{escape(label)}</text>'
    return out

def text(x, y, t, fs=11, anchor="start", fill="#44506a", bold=False):
    return (f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-size="{fs}" fill="{fill}" '
            f'font-weight="{"bold" if bold else "normal"}">{escape(t)}</text>')

def legend(x, y):
    items = [(G, "implemented"), (A, "partial"), (R, "planned / missing"), (B, "infrastructure")]
    out = ""
    for i, (c, t) in enumerate(items):
        out += f'<rect x="{x + i*150}" y="{y}" width="16" height="12" rx="3" fill="{c[0]}" stroke="{c[1]}" stroke-width="1.5"/>'
        out += text(x + i*150 + 22, y + 10, t, 11)
    return out

# ---------------------------------------------------------------- 4a architecture
def d_architecture():
    b = ""
    b += box(10, 20, 170, 56, ["Public Telegram preview", "t.me/s/<channel> (no login)"], N, fs=12)
    b += box(10, 96, 170, 56, ["CSV / JSON export", "(Telegram Desktop export ok)"], N)
    b += box(10, 172, 170, 56, ["Analyst pasted text", "Raw Slang Scanner"], N)
    # browser
    b += box(230, 20, 230, 250, [""], B)
    b += text(345, 44, "BROWSER  -  Vercel", 13, "middle", "#1b2433", True)
    b += text(345, 62, "React 18 + Vite + Tailwind", 11, "middle")
    b += text(345, 77, "MapLibre map  -  jsPDF report", 11, "middle")
    for i, t in enumerate(["Command Center (feed + map)", "3D Entity Topology", "Alerts + coordinated ads", "Forensic Dossier + PDF"]):
        b += box(245, 92 + i * 42, 200, 34, [t], G, fs=11, bold_first=False)
    b += box(245, 262 - 4, 200, 1, [""], B)
    # backend
    b += box(540, 20, 250, 250, [""], B)
    b += text(665, 44, "FastAPI  -  Render (free tier)", 13, "middle", "#1b2433", True)
    mods = [("telegram_scraper.py", G), ("classifier.py (189-term lexicon)", G), ("gemini_classifier.py (optional)", A),
            ("extractor.py (phone, UPI, wallet...)", G), ("graph_engine.py (custom, no NetworkX)", A),
            ("analytics.py (risk + TF-IDF similarity)", G)]
    for i, (t, c) in enumerate(mods):
        b += box(552, 56 + i * 34, 226, 28, [t], c, fs=11, bold_first=False)
    # right side
    b += box(840, 20, 140, 70, ["SQLite", "prahari.db", "ephemeral on free tier"], B, fs=12)
    b += box(840, 120, 140, 70, ["Gemini API", "optional, user key", "sent as header"], R, dash=True)
    b += box(840, 220, 140, 50, ["Newest 300 posts", "in memory"], N)
    # arrows
    b += arrow(180, 48, 230, 80)
    b += arrow(180, 124, 230, 124)
    b += arrow(180, 200, 230, 170)
    b += arrow(460, 110, 540, 110, "REST /api/*", lx=500, ly=102)
    b += arrow(540, 160, 460, 160, "WebSocket /ws/stream", lx=500, ly=178)
    b += arrow(790, 55, 840, 55, "save", lx=815, ly=48)
    b += arrow(790, 155, 840, 155, "if unsure", dash=True, lx=815, ly=148)
    b += arrow(790, 245, 840, 245, "", lx=815)
    b += text(10, 300, "Telegram scans are fetched by the backend; uploads and pasted text go browser -> backend.", 11)
    b += text(10, 318, "Frontend also has a simpler browser-side rule engine used only for the synthetic simulation and offline fallback.", 11)
    b += legend(10, 340)
    return svg(1000, 366, b)

# ---------------------------------------------------------------- 4b pipeline
def d_pipeline():
    b = ""
    w, h = 205, 74
    row1 = [("1 INGEST", ["CSV / JSON, public Telegram", "preview, pasted text"], G),
            ("2 NORMALISE", ["Unicode fold, lower-case,", "spaced / leet / repeated letters"], G),
            ("3 LEXICON CLASSIFIER", ["189 terms, 4 categories,", "ambiguous words need sale context"], G),
            ("4 GEMINI 2nd OPINION", ["only if unsure + user key", "falls back to rules"], A)]
    row2 = [("5 IDENTIFIER EXTRACTION", ["phone, UPI, @handle, wallet,", "bank a/c, IFSC, district"], G),
            ("6 EVIDENCE RECORD", ["text, UTC time, channel,", "source label, SHA-256"], G),
            ("7 STORE", ["SQLite + newest 300 in memory", "WebSocket broadcast"], G),
            ("8 ENTITY GRAPH", ["identifier -> channels", "2+ channels = cross-channel link"], G)]
    row3 = [("9 RISK SCORE", ["additive, reasons shown", "LOW / MEDIUM / HIGH"], G),
            ("10 TEXT SIMILARITY", ["char n-gram TF-IDF cosine", ">= 0.65 groups ads"], G),
            ("11 ALERT DASHBOARD", ["alerts + map + dossier", "+ client-side PDF"], G),
            ("PLANNED", ["trained ML, OCR, image hash,", "SIM + buy/sell/rent"], R)]
    xs = [10, 245, 480, 715]
    for r, row in enumerate([row1, row2, row3]):
        y = 16 + r * 118
        for i, (t, ls, c) in enumerate(row):
            b += box(xs[i], y, w + 20, h, [t] + ls, c, dash=(c == R), fs=12)
        for i in range(3):
            if r == 2 and i == 2:
                b += arrow(xs[i] + w + 20, y + h / 2, xs[i + 1], y + h / 2, dash=True)
            else:
                b += arrow(xs[i] + w + 20, y + h / 2, xs[i + 1], y + h / 2)
    # wrap arrows between rows
    b += arrow(xs[3] + 110, 16 + h, xs[0] + 110 + 0, 16 + 118 - 2) if False else ""
    b += f'<path d="M {xs[3]+110} {16+h} L {xs[3]+110} {16+h+22} L {xs[0]+110} {16+h+22} L {xs[0]+110} {134}" fill="none" stroke="#44506a" stroke-width="1.6" marker-end="url(#ar)"/>'
    b += f'<path d="M {xs[3]+110} {134+h} L {xs[3]+110} {134+h+22} L {xs[0]+110} {134+h+22} L {xs[0]+110} {252}" fill="none" stroke="#44506a" stroke-width="1.6" marker-end="url(#ar)"/>'
    b += text(10, 372, "Steps 9 and 10 run when the Alerts tab asks for them (GET /api/alerts, /api/coordinated), over the stored posts.", 11)
    b += legend(10, 392)
    return svg(960, 416, b)

# ---------------------------------------------------------------- 4c entity graph
def circle(cx, cy, r, col, label, sub="", fs=11):
    fill, stroke = col
    out = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
    out += text(cx, cy + 4 - (7 if sub else 0), label, fs, "middle", "#1b2433", True)
    if sub:
        out += text(cx, cy + 12, sub, 9, "middle")
    return out

def d_graph():
    sky = ("#e0f2fe", "#0284c7"); cyan = ("#cffafe", "#0891b2"); purple = ("#f3e8ff", "#7e22ce")
    amber = ("#fef3c7", "#d97706"); grey = ("#f1f3f6", "#8a94a6")
    ch = [("@delhi_highs", "DRUGS", 130, 70), ("@doc_forge_raj", "DOCUMENTS", 130, 190), ("@border_drop_01", "DRUGS", 130, 310)]
    b = ""
    hub = (480, 190)
    for name, cat, x, y in ch:
        b += f'<line x1="{x+60}" y1="{y}" x2="{hub[0]-48}" y2="{hub[1]}" stroke="#0284c7" stroke-width="2"/>'
        b += f'<text x="{(x+60+hub[0]-48)/2}" y="{(y+hub[1])/2-6}" font-size="10" fill="#0284c7">contact handle</text>'
    for name, cat, x, y in ch:
        b += circle(x, y, 54, grey, name, cat, 10)
    b += circle(hub[0], hub[1], 48, sky, "@seller_raj", "TG handle", 11)
    # UPI shared by delhi_highs and mule_bazaar
    b += circle(480, 40, 40, cyan, "raj.pay@", "oksbi (UPI)", 10)
    b += circle(840, 70, 54, grey, "@mule_bazaar", "FINANCIAL", 10)
    b += f'<line x1="184" y1="62" x2="442" y2="46" stroke="#0891b2" stroke-width="2" stroke-dasharray="6,4"/>'
    b += f'<line x1="520" y1="44" x2="787" y2="68" stroke="#0891b2" stroke-width="2" stroke-dasharray="6,4"/>'
    b += text(310, 40, "UPI ESCROW", 10, "middle", "#0891b2")
    b += text(660, 44, "UPI ESCROW", 10, "middle", "#0891b2")
    # crypto wallet shared by arms hub and border drop
    b += circle(840, 330, 54, grey, "@rajasthan_arms_hub", "ARMS", 9)
    b += circle(600, 330, 40, purple, "bc1q... wallet", "not extracted*", 9)
    b += f'<line x1="640" y1="330" x2="786" y2="330" stroke="#7e22ce" stroke-width="2" stroke-dasharray="6,4"/>'
    b += f'<line x1="184" y1="316" x2="562" y2="326" stroke="#7e22ce" stroke-width="2" stroke-dasharray="6,4"/>'
    b += text(60, 392, "Synthetic demo data. @seller_raj appears in 3 channels; raj.pay@oksbi in a drug ad and a mule-account ad.", 11)
    b += text(60, 410, "* the demo wallet text is 20 characters, shorter than the extractor's pattern, so it is shown in the post text but not as a chip.", 11)
    # legend
    lx = 60
    for col, t in [(cyan, "UPI"), (("#fef3c7", "#d97706"), "phone"), (("#d1fae5", "#059669"), "bank / IFSC"), (purple, "crypto"), (sky, "Telegram handle")]:
        b += f'<circle cx="{lx}" cy="436" r="7" fill="{col[0]}" stroke="{col[1]}" stroke-width="2"/>' + text(lx + 12, 440, t, 11)
        lx += 130
    return svg(1000, 452, b)

# ---------------------------------------------------------------- 4d evidence chain
def d_evidence():
    b = text(10, 20, "TODAY (implemented)", 14, "start", "#1a9a52", True) + text(520, 20, "NEXT (planned, not in code)", 14, "start", "#d64545", True)
    left = [("Raw post text", "exactly as captured", G), ("SHA-256 digest", "of UTF-8 rawText only", G),
            ("Captured-at UTC + source label", "server clock; source timestamp kept separately", G),
            ("Alert ID from the digest", "ALRT-date-xxxx, stable across restarts", G),
            ("PDF with digest + disclaimer", "'content digest, not a legal certificate'", G)]
    right = [("Hash chain", "each record hash includes the previous one", R), ("Digital signature", "sign the chain head with a key", R),
             ("Trusted timestamp", "RFC 3161 time-stamping authority", R), ("Write-once store + audit log", "who viewed or exported what, when", R),
             ("Verify button", "re-hash stored text and compare", R)]
    for i, (t, s, c) in enumerate(left):
        y = 36 + i * 66
        b += box(10, y, 440, 50, [t, s], c, fs=13)
        if i < 4:
            b += arrow(230, y + 50, 230, y + 66)
    for i, (t, s, c) in enumerate(right):
        y = 36 + i * 66
        b += box(520, y, 440, 50, [t, s], c, dash=True, fs=13)
        if i < 4:
            b += arrow(740, y + 50, 740, y + 66)
    b += arrow(450, 180, 520, 180, "extends")
    b += text(10, 382, "Not provided today: authenticity of the source, chain of custody, signatures, tamper-proof storage, in-app re-verification.", 11)
    return svg(980, 400, b)

# ---------------------------------------------------------------- 4e risk flow
def d_risk():
    b = ""
    b += box(10, 10, 260, 44, ["Post flagged", "rule score >= 0.70"], B)
    steps = [("Rule score >= 0.90 ?", "+2   (else >= 0.70: +1)"), ("More than one category ?", "+1"),
             ("Contact / payment identifier present ?", "+1  (UPI, phone, handle, wallet, bank a/c)"),
             ("Same identifier in 2+ channels ?", "+2"), ("FINANCIAL post with bank a/c or UPI ?", "+1")]
    for i, (t, s) in enumerate(steps):
        y = 80 + i * 66
        b += box(10, y, 360, 50, [t, s], A, fs=12)
        b += arrow(140 if i == 0 else 190, y - 26 if i else 54, 140 if i == 0 else 190, y)
    b += arrow(190, 80 + 4 * 66 + 50, 190, 80 + 5 * 66)
    b += box(10, 80 + 5 * 66, 360, 50, ["Add the points (maximum 7)", "every point has a text reason"], G)
    b += arrow(370, 80 + 5 * 66 + 25, 470, 80 + 5 * 66 + 25)
    b += box(470, 120, 220, 56, ["HIGH", "5 or more"], ("#fdeaea", "#d64545"), fs=14)
    b += box(470, 240, 220, 56, ["MEDIUM", "3 or 4"], ("#fff4d6", "#c98a00"), fs=14)
    b += box(470, 360, 220, 56, ["LOW", "0 to 2"], ("#e6f6ec", "#1a9a52"), fs=14)
    b += f'<path d="M 690 {80+5*66+25} L 740 {80+5*66+25} L 740 148 L 690 148" fill="none" stroke="#44506a" stroke-width="1.5" stroke-dasharray="4,3"/>'
    b += text(480, 106, "Result (analytics.risk_for)", 12, "start", "#1b2433", True)
    b += text(10, 80 + 5 * 66 + 78, "Example: border-drop demo alert = strong match (+2) + identifier (+1) + identifier in 2+ channels (+2) = 5 = HIGH.", 11)
    b += text(10, 80 + 5 * 66 + 96, "Weights are judgement-based, not trained; they are a transparent triage aid, not a probability.", 11)
    return svg(760, 80 + 5 * 66 + 108, b)

# ---------------------------------------------------------------- demo click-path
def d_demo():
    steps = [("0  BEFORE", ["warm backend (/api/health),", "hard-refresh site, Simulation on"], N),
             ("1  LANDING", ["scroll once, click", "LAUNCH COMMAND CENTER"], B),
             ("2  COMMAND CENTER", ["point at feed + map; say", "'synthetic demo data'"], B),
             ("3  CLICK a post", ["@border_drop_01: red slang,", "identifier chips, 'PDF Report'"], G),
             ("4  IMPORT INTEL", ["Raw Slang Scanner: paste the", "mule-account ad, press scan"], G),
             ("5  ALERTS tab", ["open the HIGH alert,", "read the 'Why:' reasons"], G),
             ("6  3D ENTITY TOPOLOGY", ["select @seller_raj ->", "channels linked in graph"], G),
             ("7  FORENSIC DOSSIER", ["open binder, read the digest;", "export the PDF"], G),
             ("8  CLOSE", ["slide 'Today vs Next';", "say the limits yourself"], A)]
    b = ""
    cols = 3
    w, h, gx, gy = 280, 70, 40, 46
    for i, (t, ls, c) in enumerate(steps):
        r, cc = divmod(i, cols)
        x = 10 + cc * (w + gx); y = 14 + r * (h + gy)
        b += box(x, y, w, h, [t] + ls, c, fs=12)
        if i < len(steps) - 1:
            if cc < cols - 1:
                b += arrow(x + w, y + h / 2, x + w + gx, y + h / 2)
            else:
                b += f'<path d="M {x+w/2} {y+h} L {x+w/2} {y+h+22} L {10+w/2} {y+h+22} L {10+w/2} {y+h+gy}" fill="none" stroke="#44506a" stroke-width="1.6" marker-end="url(#ar)"/>'
    b += text(10, 14 + 3 * (h + gy) - 20, "Total about 3.5 minutes. Type the paste text beforehand in a note; do not improvise numbers.", 11)
    return svg(960, 14 + 3 * (h + gy) - 4, b)

def d_fallback():
    b = ""
    b += box(10, 10, 200, 50, ["Demo step fails"], R)
    b += arrow(210, 35, 260, 35)
    b += box(260, 10, 220, 50, ["Backend slow? (cold start)"], A)
    b += arrow(480, 35, 530, 35, "yes")
    b += box(530, 10, 420, 50, ["Wait up to 30 s, talk over the pipeline slide;", "the header chip says 'Python OSINT: online'"], B, fs=12)
    b += arrow(370, 60, 370, 100, "no")
    b += box(260, 100, 220, 50, ["Site or Vercel down?"], A)
    b += arrow(480, 125, 530, 125, "yes")
    b += box(530, 100, 420, 50, ["Run locally: npm run dev + uvicorn", "(commands pinned in a note)"], B, fs=12)
    b += arrow(370, 150, 370, 190, "no")
    b += box(260, 190, 220, 50, ["Wi-Fi down / anything else"], A)
    b += arrow(480, 215, 530, 215, "yes")
    b += box(530, 190, 420, 50, ["Play the backup video (recorded earlier,", "on the laptop, no network)"], G, fs=12)
    b += arrow(740, 240, 740, 280)
    b += box(530, 280, 420, 56, ["Still stuck after 30 s: show offline screenshots", "(this guide + the deck) and keep talking"], G, fs=12)
    b += box(10, 100, 200, 130, ["Pre-demo kit", "backup MP4 on desktop", "screenshots in the deck", "local run commands", "UptimeRobot on /api/health"], N, fs=12)
    b += text(10, 360, "Rule: decide within 30 seconds. A calm switch to the video scores better than a long debug.", 12, "start", "#1b2433", True)
    return svg(960, 376, b)

ALL = {"4a": d_architecture, "4b": d_pipeline, "4c": d_graph, "4d": d_evidence, "4e": d_risk,
       "5b": d_demo, "5c": d_fallback}
