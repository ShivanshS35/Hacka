import os, re, sys, json, datetime
from html import escape as E
sys.path.insert(0, os.path.dirname(__file__))
from diagrams import ALL
from qa1 import QA1
from qa2 import QA2
from qa3 import QA3
from qa4 import QA4

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
QA = QA1 + QA2 + QA3 + QA4
from qa_v2 import OVERRIDES, RENAME, PATCH, NEW
_keys = {x[1] for x in QA}
assert set(OVERRIDES) <= _keys, set(OVERRIDES) - _keys
assert all(q in _keys for q, _, _ in PATCH)
_out = []
for x in QA:
    g, q = x[0], x[1]
    x = (g, q) + OVERRIDES[q] if q in OVERRIDES else x
    for pq, a, b in PATCH:
        if q == pq:
            assert any(a in f for f in x[4:]), (q, a)
            x = tuple(f.replace(a, b) if isinstance(f, str) else f for f in x)
    if q in RENAME:
        x = (x[0], RENAME[q]) + x[2:]
    _out.append(x)
QA = _out + NEW
GROUPS = {"A": "Problem and context", "B": "Data collection, scope and ethics", "C": "Classifier and NLP",
          "D": "Financial-ad detector and risk scoring", "E": "Identifier extraction", "F": "Link analysis and entity graph",
          "G": "Evidence, hash, PDF and legal", "H": "Architecture, deployment, security and privacy",
          "I": "Accuracy, metrics and honesty", "J": "Demo, team and future"}

# ---------------------------------------------------------------- diagrams to files
for k, fn in ALL.items():
    open(os.path.join(OUT, "img", f"diagram-{k}.svg"), "w", encoding="utf8").write(fn())

def badge(s):
    c = {"IMPLEMENTED": "g", "PARTIAL": "a", "PLANNED": "b", "MISSING": "r", "COMPLIANT": "g"}[s]
    return f'<span class="b {c}">{s}</span>'

# ---------------------------------------------------------------- requirement matrix
MATRIX = [
 ("MUST HAVE", "Import a provided dataset", "Import Intel > CSV / JSON Export; POST /api/ingest/file (main.py)", "IMPLEMENTED", "CSV, JSON or Telegram Desktop export; max 500 records and 10 MB; re-importing the same file is skipped as duplicates."),
 ("MUST HAVE", "Collect from 2-3 public channels", "Import Intel > Telegram Scraper; POST /api/scan/channel; telegram_scraper.py", "PARTIAL", "On-demand, one channel per scan, public t.me/s preview only; no scheduled monitoring."),
 ("MUST HAVE", "Classify posts", "classifier.py classify_text + gemini_classifier.hybrid_classify; POST /api/scan/text", "IMPLEMENTED", "Rules + 232-term lexicon; a single keyword needs a second signal; news/warnings and shop notices are not flagged."),
 ("MUST HAVE", "Extract identifiers", "extractor.py extract_entities", "IMPLEMENTED", "Phone, UPI, @handle, BTC/ETH/TRON wallet, bank a/c, IFSC, district. Obfuscated forms handled (spaced or spelled-out digits, '(at)', look-alike letters)."),
 ("MUST HAVE", "Link identifiers across channels", "graph_engine.py; GET /api/graph; 3D Entity Topology; Command Center live graph", "IMPLEMENTED", "Node keyed by the lower-cased identifier; 2+ channels marks a cross-channel link. Generic handles, toll-free and placeholder numbers are never linked."),
 ("MUST HAVE", "Alert dashboard with evidence snapshots", "Alerts tab (GET /api/alerts); Forensic Dossier (GET /api/dossier/{id})", "IMPLEMENTED", "Text, UTC time, channel, platform, source label, SHA-256 digest, risk reasons."),
 ("KEY FEATURE 2", "Curated slang + emoji lexicon", "classifier.py SLANG_DICTIONARY", "IMPLEMENTED", "232 terms: English, Hinglish, Devanagari, emoji; strong vs ambiguous terms; 2 different emoji needed for emoji-only posts."),
 ("KEY FEATURE 2", "Trained ML classifier", "none", "PLANNED", "No model trained on labelled data yet. Needs a labelled set (R4C sample) first."),
 ("KEY FEATURE 2", "AI second opinion", "gemini_classifier.py; X-Gemini-Key header", "PARTIAL", "Optional Gemini LLM, only when rules are unsure and a key is supplied; falls back to rules."),
 ("KEY FEATURE 3", "Account, ATM card, net-banking kit ads", "FINANCIAL group in the lexicon; ACCOUNT_KIT_RE", "IMPLEMENTED", "Context rules reduce false alarms."),
 ("KEY FEATURE 3", "SIM card sale or rent", "classifier.py FINANCIAL SIM-trade terms", "IMPLEMENTED", "Pre-activated / KYC SIMs for sale or rent are flagged as FINANCIAL."),
 ("KEY FEATURE 3", "Buy / sell / rent direction", "classifier.detect_direction; SELLING / RENT OFFERED badges", "IMPLEMENTED", "SELL, BUY, RENT_OFFER, RENT_WANTED or UNKNOWN; a keyword hint, not a verdict."),
 ("KEY FEATURE 3", "Risk classification with evidence", "analytics.risk_for; Alerts 'Why:' lines", "IMPLEMENTED", "Additive 0-9, LOW / MEDIUM / HIGH, every point has a reason."),
 ("KEY FEATURE 4", "Locations from text", "extractor.py RAJASTHAN_DISTRICT_SYNONYMS (41 districts)", "PARTIAL", "District names only; first match wins."),
 ("KEY FEATURE 4", "Identifiers from images", "Import Intel > Screenshot / Image; POST /api/ingest/image", "PARTIAL", "Text read in the browser (tesseract.js, English), then the normal pipeline. Accuracy on real posters to be measured."),
 ("KEY FEATURE 5", "Repeated / coordinated ads (text)", "analytics.find_coordinated; GET /api/coordinated; Alerts > Coordinated ads", "IMPLEMENTED", "Char n-gram TF-IDF cosine >= 0.65, union-find."),
 ("KEY FEATURE 5", "Image similarity", "images.py dhash; GET /api/image-matches; SIMILAR IMAGE graph edges", "IMPLEMENTED", "64-bit perceptual hash; distance <= 10 = same picture resized or re-compressed; +2 risk when seen in 2+ channels."),
 ("KEY FEATURE 6", "Evidence snapshot: text, time, channel, hash", "AlertsPanel, ForensicDossier, pdfGenerator.ts", "IMPLEMENTED", "Hash is a content digest of rawText, not a certificate."),
 ("GOOD TO HAVE", "OCR of images / posters", "UploadModal image tab; images.server_ocr if tesseract is installed", "PARTIAL", "Works in the browser; the free Render tier has no tesseract, so server OCR is off there."),
 ("GOOD TO HAVE", "Hindi / Hinglish slang", "classifier.py lexicon", "IMPLEMENTED", "Plus Unicode, look-alike letter and spacing handling."),
 ("GOOD TO HAVE", "Automatic evidence report (PDF)", "src/utils/pdfGenerator.ts (jsPDF, in the browser)", "IMPLEMENTED", "Banner says 'prototype record, not a legal certificate'."),
 ("ADDED", "Analyst case status", "Alerts > status buttons; POST /api/posts/{id}/status", "IMPLEMENTED", "NEW, REVIEWING, ESCALATED, FALSE POSITIVE, CLOSED, with a note; never changes the evidence record."),
 ("ADDED", "Audit log", "casework.py; GET /api/audit, /api/audit/verify; Alerts > Audit trail", "IMPLEMENTED", "Hash-chained; tamper-evident, not authenticated (no logins)."),
 ("ADDED", "Re-verify hash", "Dossier > RE-VERIFY HASH; POST /api/dossier/{id}/verify", "IMPLEMENTED", "Server re-hashes the stored text and reports match / mismatch; logged."),
 ("ADDED", "Export alerts", "Alerts > CSV / JSON; GET /api/export", "IMPLEMENTED", "Spreadsheet-formula characters neutralised in CSV."),
 ("ADDED", "Signature, trusted timestamp, logins", "none", "PLANNED", "See diagram 4d."),
 ("OUT OF SCOPE", "Join private groups / fake identities", "telegram_scraper.py uses public preview only", "COMPLIANT", "Not attempted."),
 ("OUT OF SCOPE", "Interact with or buy from sellers", "no such endpoint", "COMPLIANT", "Not attempted."),
 ("OUT OF SCOPE", "Collect from private accounts", "no such path", "COMPLIANT", "Not attempted."),
]

SCREENS = [
 ("3.1 Landing showcase", "s1-landing.png",
  "A boot animation (it also wakes the backend), then an editorial page: problem, numbers (232 terms, about 2 s for 500 posts, 41 districts), five-stage pipeline, a classifier test box, topology preview and the button LAUNCH COMMAND CENTER.",
  "Scroll once to the numbers and pipeline, then press LAUNCH COMMAND CENTER.",
  "'Public ads are easy to find; linking them is hard. This is the five-stage pipeline that does the linking.'",
  "App.tsx shows EditorialShowcase first. checkHealth() pings GET /api/health to wake Render. The test box on this page runs the browser rule engine (utils/detectionEngine.ts), not the backend.",
  "Do not use the landing test box to demo false-alarm handling; use Import Intel > Raw Slang Scanner, which uses the backend."),
 ("3.2 Command Center", "s3-command.png",
  "Left: signals feed with category filter, confidence floor (default 70%), search, and badges for platform (TELEGRAM) and direction (SELLING, RENT OFFERED). Centre: map of the 41 Rajasthan districts with threat pins. Right: case topology card, a small live entity graph (LIVE badge) and the dossier panel.",
  "Click @delhi_highs in the feed, then a district on the map, then a node in the small graph.",
  "'Every card shows why it was flagged: matched slang in red, identifiers as chips, whether it is selling or renting, and a label saying it is synthetic demo data.'",
  "Feed from GET /api/feed and WebSocket /ws/stream. The small graph polls GET /api/graph every 10 s and refreshes on new posts; it shows SAMPLE only if the backend cannot be reached. Simulation Live adds synthetic browser posts every 12 s.",
  "Identifier chips: UPI = cyan, TEL = amber, BANK and IFSC = emerald, CRYPTO = purple, TG = sky. Known glitch: simulated (browser) posts can show a TG chip such as @oksbi taken from inside a UPI ID; posts analysed by the backend do not."),
 ("3.3 Import Intel", "s7-import.png",
  "A dialog with five tabs: Telegram Scraper, Raw Slang Scanner, CSV / JSON Export, Screenshot / Image, R4C Benchmark (4 synthetic posts).",
  "Raw Slang Scanner: paste the mule-account ad and press scan; then close the dialog.",
  "'Same pipeline for a pasted post, an uploaded file, a screenshot or a public channel.'",
  "Scraper: POST /api/scan/channel. Scanner: POST /api/scan/text. File: POST /api/ingest/file. Image: POST /api/ingest/image. Each ends in process_and_store_post: classify, extract, direction, district, SHA-256, duplicate check, SQLite, graph, audit entry, WebSocket broadcast.",
  "Suggested paste: Selling fully KYC verified current account with ATM card + net-banking kit. Rs 15000. UPI raj.pay@oksbi (expected FINANCIAL 0.99). Re-importing the same file reports 'duplicates skipped'."),
 ("3.4 Screenshot / Image tab", "s8-image.png",
  "A file picker for PNG, JPG or WebP (max 8 MB) and a platform selector.",
  "Optional: upload a prepared ad poster; show the extracted text and the alert it creates.",
  "'Sellers post pictures to dodge text filters. We read the text in the picture and fingerprint the picture itself, so the same poster in another channel is linked even if it is resized.'",
  "The browser runs OCR (tesseract.js, assets bundled with the site, no CDN) and sends the text with the file. The backend stores the SHA-256 and a 64-bit perceptual hash (dHash), not the image, then runs the normal pipeline and links images within distance 10.",
  "Only English OCR in the browser. Test your poster before the demo; do not claim OCR accuracy numbers."),
 ("3.5 Alerts and case workflow", "s4-alerts.png",
  "Ranked alerts (ALRT-date-xxxx) with category, platform and direction badges, identifiers, 'Why:' reasons, a status row (NEW, REVIEWING, ESCALATED, FALSE POSITIVE, CLOSED) with a note box, a copyable SHA-256 and 'Open dossier'. Filters by level and status; CSV and JSON export. Right: Coordinated ads and the Audit trail with a CHAIN OK badge.",
  "Type your name in LOGGED AS, mark the top alert ESCALATED with a note, point at the new audit-trail line and CHAIN OK.",
  "'The risk score is additive and every point has a reason. The analyst decides; every decision is logged in a hash-chained trail, and changing the status never touches the evidence.'",
  "GET /api/alerts runs analytics.build_alerts over stored posts and attaches the analyst status. POST /api/posts/{id}/status writes the case_status table and an audit entry. GET /api/audit/verify recomputes the whole chain.",
  "There are no logins: the name is whatever is typed. Say 'tamper-evident', never 'tamper-proof'."),
 ("3.6 3D Entity Topology", "s5-topology.png",
  "A graph of the selected case: the post, its channel, district nexus and identifiers. Tabs: Case topology and Global demo graph. A side panel lists channels linked in graph and network relations.",
  "Select @seller_raj, read 'Channels linked in graph', press 'Locate on Rajasthan Map'.",
  "'One handle, several channels. That is the lead an investigator would otherwise miss.'",
  "GET /api/graph returns nodes and edges from graph_engine.DynamicEntityGraph; the page uses it when the backend has data and otherwise shows a built-in demo graph.",
  "The graph is a custom class, not NetworkX. A link is a lead, not proof that it is the same person."),
 ("3.7 Forensic Dossier and PDF", "s6-dossier.png",
  "A case-binder view: exhibits, the SHA-256 integrity hash with RE-VERIFY HASH and COPY HASH, raw text, extracted identifiers, and an Export Demo Report button. The PDF has four numbered sections, platform and direction, and a disclaimer.",
  "Press RE-VERIFY HASH (shows match), then Export Demo Report.",
  "'The server re-hashes the stored text and compares it with the digest taken at capture. It detects edits; it is not a legal certificate, and we say so on the page.'",
  "POST /api/dossier/{id}/verify recomputes SHA-256 over the stored UTF-8 rawText, checks the copies agree and logs a VERIFY_HASH entry. The PDF is generated in the browser by src/utils/pdfGenerator.ts using jsPDF.",
  "Avoid saying 'sealed', 'court-ready' or 'judicial evidence'. Under the BSA, Section 63 certification is a separate legal step."),
]

PITCH = [
 ("1", "Hook", "0:30", "The advertisements are public; the networks are not.", "Open with the problem: finding posts is easy, linking sellers is hard.", "The real problem is linking, not finding."),
 ("2", "By the numbers", "0:30", "232 terms, about 2 s for 500 posts, 41 districts.", "Say these are measured prototype numbers. If the deck still shows 189 / 1.5 s, update it or say the new numbers.", "It is fast and we only quote what we measured."),
 ("3", "Same UPI", "0:30", "One UPI can sit in a drug ad and a mule ad.", "Tell the drug-ad and mule-ad story; do not say 'nobody does this'.", "Identifier linking is the value."),
 ("4", "Pipeline", "0:45", "Collect, classify, extract, link, alert.", "Name each stage in one phrase; say the analyst stays in control.", "A complete loop, not a single feature."),
 ("5", "Detection engine", "0:50", "Rules + lexicon, optional AI; real outputs shown.", "Say: 94.4% precision and 68.0% recall on 50 synthetic held-out posts; real-world accuracy not yet measured.", "It is explainable and honest about accuracy."),
 ("6", "Entity graph", "0:45", "Same identifier. Two posts. One link.", "Point at the shared UPI node; mention the same picture is linked too.", "Cross-channel links are visible."),
 ("7", "Evidence snapshot", "0:40", "A content digest you can re-verify, and a logged trail.", "Say the digest detects edits, the trail is tamper-evident, certification is a separate legal step.", "We do not overclaim evidence."),
 ("8", "Multilingual", "0:30", "Hindi, Hinglish, English, emoji, evasion tricks.", "Read one Hinglish example and one disguised one (spaced digits).", "It reads local slang and common tricks."),
 ("9", "What changes", "0:30", "Less manual copying and cross-checking.", "Qualitative, no multipliers.", "The analyst saves effort."),
 ("10", "Today vs next", "0:40", "Built today / not yet.", "Say the gaps yourself: trained ML, real-data accuracy, logins, signature, scheduled monitoring.", "Trust through honesty."),
 ("11", "Close", "0:20", "We do not just find posts; we find networks.", "Pause, then 'questions'.", "Memorable close."),
]

def md_table_html(headers, rows, cls=""):
    h = "".join(f"<th>{E(x)}</th>" for x in headers)
    r = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>" for row in rows)
    return f'<table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{r}</tbody></table>'

def img(name, cap=""):
    c = f"<figcaption>{E(cap)}</figcaption>" if cap else ""
    return f'<figure><img src="img/{name}"/>{c}</figure>'

# ---------------------------------------------------------------- html
today = "28 November 2026"
css = """
@page { size: A4; margin: 14mm 12mm 16mm 12mm; }
*{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#1b2433;font-size:10.2pt;line-height:1.42;margin:0}
h1{font-size:25pt;margin:0 0 4mm} h2{font-size:16pt;margin:0 0 3mm;padding-top:2mm;color:#0b3d91;border-bottom:2px solid #0b3d91;padding-bottom:1.5mm}
h3{font-size:12pt;margin:4mm 0 1.5mm;color:#0b3d91} h4{font-size:10.5pt;margin:2mm 0 1mm}
.section{page-break-before:always} .nb{page-break-inside:avoid}
.cover{height:255mm;display:flex;flex-direction:column;justify-content:center}
.tag{display:inline-block;background:#0b3d91;color:#fff;padding:1mm 3mm;border-radius:3px;font-size:9pt;margin-bottom:4mm}
table{border-collapse:collapse;width:100%;font-size:8.6pt} th{background:#0b3d91;color:#fff;text-align:left;padding:1.6mm}
td{border-bottom:1px solid #d8dde6;padding:1.4mm;vertical-align:top} tr{page-break-inside:avoid}
.b{display:inline-block;padding:.3mm 2mm;border-radius:10px;font-size:7.8pt;font-weight:bold;white-space:nowrap}
.b.g{background:#e6f6ec;color:#127a40;border:1px solid #1a9a52}.b.a{background:#fff4d6;color:#8a5d00;border:1px solid #c98a00}
.b.r{background:#fdeaea;color:#a12b2b;border:1px solid #d64545}.b.b{background:#e8f0fe;color:#274a9c;border:1px solid #3b6fd4}
figure{margin:2mm 0;text-align:center} figure img{max-width:100%;border:1px solid #c8cfda;border-radius:4px} figcaption{font-size:8.5pt;color:#556}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.box{border:1px solid #cfd6e2;border-radius:6px;padding:2.5mm 3.5mm;background:#f7f9fc}
.warn{border-left:4px solid #c98a00;background:#fff8e6;padding:2mm 3mm;margin:2mm 0}.ok{border-left:4px solid #1a9a52;background:#effaf3;padding:2mm 3mm;margin:2mm 0}
.qa{border:1px solid #d3d9e4;border-radius:6px;margin:0 0 3mm;padding:2.2mm 3.2mm;page-break-inside:avoid}
.qa .q{font-weight:bold;font-size:10.4pt;color:#0b3d91}.meta{font-size:8pt;color:#566;margin:.5mm 0 1.2mm}
.qa p{margin:.8mm 0}.lbl{font-weight:bold;color:#334}.trap{background:#fff4d6;border-radius:4px;padding:1mm 2mm;margin-top:1.2mm}
.d-E{color:#127a40}.d-M{color:#8a5d00}.d-H{color:#a12b2b}
ul{margin:1mm 0 1mm 5mm;padding:0}li{margin:.4mm 0}
code{background:#eef1f6;padding:0 1mm;border-radius:3px;font-size:9pt}
.small{font-size:8.6pt;color:#445}
.es{font-size:9.6pt;line-height:1.34}.es h3{margin:2.6mm 0 1mm}.es ol,.es ul{margin-top:.5mm;margin-bottom:.5mm}
.rtm{font-size:7.9pt}.rtm td{padding:1mm 1.2mm}
"""

parts = []
# ---- cover + 1 executive summary
parts.append(f"""
<div class="cover">
 <span class="tag">R4C HACKATHON 2026  -  PS02  -  TEAM V3S</span>
 <h1>PRAHARI<br/>Hackathon Prep Guide</h1>
 <p style="font-size:13pt;margin:0 0 6mm">Telegram and Social Media Illegal Trade Monitor<br/>Evidence-based pitch, demo and judge Q&amp;A guide</p>
 <p class="small">Version 2, prepared {today} from a read-only audit of the repository (branch fix/audit-tier2, PR #21: includes the classifier fixes, case workflow, audit log, image intake and the district-boundary fix). All accuracy numbers are on synthetic data we wrote; real-world accuracy is not yet measured. Nothing in this guide claims a feature that is not in the code. Where a number is not measured it says <b>to be measured</b> and gives the method.</p>
 <div class="box nb"><b>How to use it</b><ul>
  <li>Section 1-2: know exactly what is built (and what is not).</li><li>Section 3-4: know every screen and diagram.</li>
  <li>Section 5: rehearse the 6.5-minute pitch and the 4-minute click path; keep the fallback ready.</li>
  <li>Section 6: {len(QA)} judge questions, each with a spoken answer, a proof to show and a trap follow-up.</li></ul></div>
</div>""")

parts.append(f"""
<div class="section es"><h2>1. Executive summary</h2>
<h3>Problem</h3><p>Drug, arms, fake-document and mule-account sellers advertise on public Telegram channels and social media in coded Hinglish and emojis. Analysts read channel by channel, and seller identifiers (phone, UPI, handle) are rarely collated across channels.</p>
<h3>Solution: PRAHARI</h3><p>A web dashboard that imports or collects public posts, flags illegal-sale ads with slang-aware rules, extracts seller identifiers, links the same identifier across channels, scores risk with stated reasons, shows it on a Rajasthan district map and exports an evidence dossier.</p>
<h3>How it works in 5 lines</h3><ol>
<li><b>Collect</b>: CSV/JSON import, pasted text, screenshots (text read in the browser), or a public Telegram preview scan (no login).</li>
<li><b>Classify</b>: 232-term lexicon (English, Hinglish, Devanagari, emoji) with context rules; a lone keyword needs a second signal; optional Gemini second opinion.</li>
<li><b>Extract</b>: phone, UPI, @handle, crypto wallet, bank account, IFSC, district, and whether the ad sells, buys or rents.</li>
<li><b>Link</b>: identifier graph across channels, near-duplicate text and near-identical images.</li>
<li><b>Alert</b>: risk-scored alerts with evidence (text, time, channel, SHA-256), analyst status, a hash-chained audit trail, re-verify, export and a PDF dossier.</li></ol>
<h3>Three headline impact points (measured on our test set)</h3><ul>
<li>Imports, scores and stores 500 posts in about 2 s or less (1.3 s in our latest run); rules take about 0.5 ms per post.</li>
<li>Every flag is explainable: matched words highlighted, risk reasons listed, analyst decisions logged.</li>
<li>Cross-channel linking turns separate ads into a lead: one handle in three demo channels, one UPI in a drug ad and a mule-account ad.</li></ul>
<h3>What is unique</h3><p>Context-aware slang rules that also see through common disguises, a transparent additive risk score, identifier and image linking on a district map, and an evidence record you can re-verify that is explicit about its own limits.</p>
<div class="cols nb" style="font-size:8.6pt;line-height:1.3">
<div class="box"><b>Measured numbers (synthetic data, from the repo)</b><ul>
<li>Lexicon: 232 terms, 4 categories. 92 automated backend tests pass.</li>
<li>Dev set (n=60, used for tuning): precision 100%, recall 83.3%.</li>
<li>Held-out set (n=50, never tuned on): precision 94.4%, recall 68.0%, accuracy 82.0%; F1 about 0.79.</li>
<li>Evasion check: 45 hand-written disguise cases (spaced digits, look-alike letters, zero-width characters...) pass, after fixing a typo in 2 test inputs.</li>
<li>All of these are on posts we wrote. With n=50 one post moves a percentage by 2 points or more.</li></ul></div>
<div class="box"><b>Honest limits (say them first)</b><ul>
<li>Not a trained ML classifier: rules + lexicon, optional Gemini, ML-style similarity (TF-IDF, perceptual hash).</li>
<li>Real-world accuracy not measured; needs a labelled set such as the R4C sample.</li>
<li>Hash is a content digest, not a legal certificate; audit log is tamper-evident, not authenticated (no logins).</li>
<li>On-demand scans, not 24x7 monitoring; free-tier hosting; synthetic demo data.</li></ul></div></div>
</div>""")

# ---- 2 matrix
rows = [(E(c), E(r), E(m), badge(s), E(n)) for c, r, m, s, n in MATRIX]
cnt = {}
for c, r, m, s, n in MATRIX:
    cnt[s] = cnt.get(s, 0) + 1
parts.append(f"""
<div class="section"><h2>2. Requirement traceability matrix</h2>
<p class="small">Status key: IMPLEMENTED = works in the code today. PARTIAL = works with stated limits. PLANNED = on our next list, no code. MISSING = not planned. COMPLIANT = an out-of-scope item we deliberately do not do. ADDED = not asked for, built for police workflow. Totals: {", ".join(f"{k} {v}" for k, v in cnt.items())}.</p>
{md_table_html(["Group", "Requirement", "Where in PRAHARI (screen / file / endpoint)", "Status", "Note"], rows, "rtm")}
</div>""")

# ---- 3 screens
s3 = ['<div class="section"><h2>3. How the website works, screen by screen</h2>',
      '<p class="small">Screenshots were captured on 28 November 2026 from a local run of the current code (synthetic demo data, the corrected district boundaries). The demo data labels itself as synthetic on every post.</p>']
for i, (title, im, sees, click, say, behind, note) in enumerate(SCREENS):
    s3.append(f'<div class="nb"><h3>{E(title)}</h3>{img(im)}'
              f'<table><tr><td width="16%"><b>Judge sees</b></td><td>{E(sees)}</td></tr>'
              f'<tr><td><b>You click</b></td><td>{E(click)}</td></tr>'
              f'<tr><td><b>You say</b></td><td>{E(say)}</td></tr>'
              f'<tr><td><b>Behind the scenes</b></td><td>{E(behind)}</td></tr>'
              f'<tr><td><b>Note</b></td><td>{E(note)}</td></tr></table></div>')
    if title.startswith("3.5"):
        s3.append('<div class="nb"><h4>Close-up: one alert card and the audit trail</h4>' + img("s4b-alert-card.png") + img("s4c-audit-trail.png", "Status buttons and note on the card; the trail shows who said they acted and CHAIN OK when the chain re-computes.") + '</div>')
    if i in (1, 3, 5):
        s3.append('<div style="page-break-after:always"></div>')
s3.append('<div class="box nb"><h3>Colour-coded identifier chips</h3><table><tr><th>Chip</th><th>Colour</th><th>Meaning</th></tr>'
          '<tr><td>UPI</td><td style="color:#0891b2"><b>cyan</b></td><td>UPI payment ID such as raj.pay@oksbi</td></tr>'
          '<tr><td>TEL</td><td style="color:#d97706"><b>amber</b></td><td>Indian mobile number (normalised to 10 digits)</td></tr>'
          '<tr><td>BANK / IFSC</td><td style="color:#059669"><b>emerald</b></td><td>9-18 digit account number / IFSC code</td></tr>'
          '<tr><td>CRYPTO</td><td style="color:#7e22ce"><b>purple</b></td><td>BTC, ETH or TRON wallet address</td></tr>'
          '<tr><td>TG</td><td style="color:#0284c7"><b>sky</b></td><td>Telegram @handle</td></tr>'
          '<tr><td>red words</td><td style="color:#e11d48"><b>red</b></td><td>matched slang terms inside the post</td></tr></table></div></div>')
parts.append("".join(s3))

# ---- 4 diagrams
def dia(key, title, note):
    return (f'<div class="nb"><h3>{E(title)}</h3>{ALL[key]()}<p class="small">{note}</p></div>')
parts.append('<div class="section"><h2>4. Diagrams</h2>'
  + dia("4a", "4a. System architecture", "The graph is a custom class (no NetworkX). Gemini is optional and uses the user's own key. SQLite on Render's free tier can be reset. The telegram scraper is partial: on-demand, public preview only.")
  + dia("4b", "4b. End-to-end data pipeline", "Green = in the code today. Amber = optional. Red dashed = not built: a trained ML model, logins, signatures and scheduled scanning.")
  + '</div>')
parts.append('<div class="section">' + dia("4c", "4c. Entity-graph example: one identifier across three channels", "Built from the synthetic seed posts (checked against GET /api/feed). Linking is a lead, not proof of identity.")
  + dia("4d", "4d. Evidence chain: today and next", "Today: content digest, duplicate check, re-verify button and a hash-chained audit log. Not built: logins, signature, trusted timestamp, write-once storage.") + '</div>')
parts.append('<div class="section">' + dia("4e", "4e. Risk-scoring logic", "Source: backend/analytics.py risk_for. Maximum score is 9.") + '</div>')

# ---- 5 presentation
prow = [(E(a), E(b), E(c), E(d), E(e), E(f)) for a, b, c, d, e, f in PITCH]
parts.append(f"""<div class="section"><h2>5. Presentation flow</h2>
<h3>5.1 Pitch: slide by slide (about 6.5 minutes)</h3>
<p class="small">Uses the corrected 11-slide deck (Prahari_Threat_Analysis_fixed.pptx). Total 6:30 leaves room inside a 7-minute slot.</p>
{md_table_html(["#", "Slide", "Time", "Sentence it must land", "Speaker note", "Takeaway"], prow)}
<div class="warn"><b>Do not say:</b> court-ready, sealed, tamper-proof, 100X, thousands of channels, nobody does this, real-time 24x7, our ML model, 94% accurate (without 'on synthetic data').<br/>
<b>Say instead:</b> evidence snapshot with a content digest you can re-verify; tamper-evident audit trail; measured on a small synthetic set; analyst-in-the-loop; on-demand scan and import; rule-based detection with ML-assisted parts and optional AI.</div>
</div>""")
parts.append('<div class="section"><h3>5.2 Live-demo click path (about 4 minutes)</h3>' + ALL["5b"]() +
 """<ol class="small"><li>Open the site 10 minutes early, wait for the 'Python OSINT: online' chip, then leave it.</li>
<li>Paste text for step 4 is in a note: <code>Selling fully KYC verified current account with ATM card + net-banking kit. Rs 15000. UPI raj.pay@oksbi</code></li>
<li>Expected: category FINANCIAL, confidence 0.99, a UPI chip, a new alert in the Alerts tab.</li>
<li>If a judge asks for a false-alarm test, paste <code>Chitta village fair on Sunday</code> or <code>Police warn: fake Aadhaar racket busted</code> into the same scanner: neither should flag.</li>
<li>If a judge asks about disguises, paste <code>chitta available, call nine eight seven six five four three two one zero</code>: it flags DRUGS and extracts the phone 9876543210.</li>
<li>Optional if time allows: Screenshot / Image tab with a poster you have tested beforehand.</li>
<li>Never use a real person's number or a real channel you have not checked first.</li></ol>
<h3>5.3 Demo-fails fallback flow</h3>""" + ALL["5c"]() + '</div>')

# ---- 6 Q&A
qs = ['<div class="section"><h2>6. Judge Q&amp;A bank</h2>'
      f'<p class="small">{len(QA)} questions in 10 groups. Each has the likely asker, difficulty, a spoken answer, a proof to show and a follow-up trap. Answers state only what the code does.</p>']
idx = 0
for g, gname in GROUPS.items():
    items = [x for x in QA if x[0] == g]
    qs.append(f'<h3 style="{"" if g=="A" else "page-break-before:always"}">{g}. {E(gname)} ({len(items)} questions)</h3>')
    for (_, q, who, diff, ans, show, tq, ta) in items:
        idx += 1
        qs.append(f'<div class="qa"><div class="q">{g}{items.index((_, q, who, diff, ans, show, tq, ta)) + 1}  (Q{idx}). {E(q)}</div>'
                  f'<div class="meta">Asked by: {E(who)}  |  Difficulty: <b class="d-{diff[0]}">{diff}</b></div>'
                  f'<p><span class="lbl">Say:</span> {E(ans)}</p><p><span class="lbl">Show this:</span> {E(show)}</p>'
                  f'<div class="trap"><span class="lbl">Follow-up trap:</span> {E(tq)} <b>&rarr;</b> {E(ta)}</div></div>')
qs.append('</div>')
parts.append("".join(qs))

# ---- appendices
parts.append("""<div class="section"><h2>Appendix A. Fact sheet (what the code actually does)</h2>
<div class="cols"><div class="box"><b>Backend (FastAPI, Python)</b><ul>
<li>Read: GET /api/health, /api/feed, /api/alerts (?status=), /api/coordinated, /api/districts, /api/graph, /api/dossier/{id}, /api/posts/{id}/history, /api/audit, /api/audit/verify, /api/export (csv/json), /api/image-matches.</li>
<li>Write: POST /api/scan/text, /api/scan/channel, /api/ingest/file, /api/ingest/image, /api/posts/{id}/status, /api/dossier/{id}/verify, /api/gemini/check; WebSocket /ws/stream.</li>
<li>classifier.py: 232-term lexicon with concept groups; strong and ambiguous terms; a lone keyword needs sale context or a second concept; news/warning and legitimate-trade phrases suppressed; look-alike letters folded; direction detection; flag threshold 0.70.</li>
<li>extractor.py: works on a normalised copy (Unicode, digits in other scripts, spelled-out digits, '(at)/(dot)' UPIs); lower-cases identifiers; generic handles, toll-free and same-digit numbers go to a 'shared' list and are never linked.</li>
<li>casework.py: case status table, hash-chained audit log (BEGIN IMMEDIATE), chain verify, duplicate index, re-verify.</li>
<li>images.py: SHA-256 + 64-bit dHash, Hamming distance &lt;= 10; server OCR only if tesseract is installed; images not stored.</li>
<li>SQLite file; newest 300 posts in memory; 500-record and 10 MB import limits; 8 MB image limit.</li></ul></div>
<div class="box"><b>Frontend (React 18, Vite, Tailwind)</b><ul>
<li>Tabs: Command Center (feed, map, live graph, dossier panel), 3D Entity Topology, Forensic Dossier, Alerts; global search with Ctrl/Cmd+K.</li>
<li>MapLibre map with no third-party tiles; bundled India outline and 41-district GeoJSON (newer-district borders corrected on 28 Nov).</li>
<li>Import dialog: Telegram Scraper, Raw Slang Scanner, CSV / JSON, Screenshot / Image (tesseract.js, self-hosted), R4C Benchmark (4 synthetic posts).</li>
<li>jsPDF dossier export in the browser; click-to-copy identifier chips; analyst name stored in the browser only.</li>
<li>Browser-side rule engine for the synthetic simulation and offline fallback only.</li>
<li>Hosting: Vercel (frontend), Render free tier (backend, sleeps, ephemeral disk).</li></ul></div></div>
<h3>Wording to avoid (and what the product now says)</h3>
<table><tr><th>Topic</th><th>Do not say</th><th>Say</th></tr>
<tr><td>Evidence</td><td>sealed, court-ready, Section 65B certificate</td><td>content digest you can re-verify; certification is a separate legal step (Section 63 BSA)</td></tr>
<tr><td>Audit log</td><td>tamper-proof, secure log</td><td>tamper-evident trail; no logins yet, so it records who said they acted</td></tr>
<tr><td>Accuracy</td><td>94% accurate</td><td>94.4% precision and 68% recall on 50 synthetic held-out posts; real-world accuracy not yet measured</td></tr>
<tr><td>AI</td><td>our ML model</td><td>rule-based detection with ML-assisted parts (TF-IDF, perceptual hash, OCR) and an optional Gemini second opinion</td></tr>
<tr><td>Scale</td><td>monitors thousands of channels 24x7</td><td>on-demand public-channel scans and dataset import</td></tr></table>
<h3>Appendix B. How to measure precision, recall and F1 on the R4C labelled set</h3>
<ol><li>Create a CSV with columns <code>text,label</code> where label is DRUGS, ARMS, DOCUMENTS, FINANCIAL or NONE.</li>
<li>Split it (for example 50/50, stratified by label). Tune the lexicon only on the first half.</li>
<li>Score the second half the way <code>backend/eval_classifier.py</code> does: for each category count TP, FP, FN.</li>
<li>Precision = TP/(TP+FP); Recall = TP/(TP+FN); F1 = 2PR/(P+R). Also report overall accuracy and the confusion matrix.</li>
<li>Add a 95% Wilson interval for each ratio and say the sample size next to every number.</li>
<li>Report the rules-only result and, separately, the result with Gemini enabled. Until this is run on real labelled data, real-world figures are <b>to be measured</b>.</li></ol>
<div class="nb"><h3>Appendix C. Still open after this version</h3>
<ul><li>Trained classifier once labelled data exists (for example TF-IDF + logistic regression next to the rules, reported separately).</li>
<li>User logins so audit entries are authenticated; signature and trusted timestamp on the audit-log head.</li>
<li>Scheduled scanning of a watch-list of public channels; Hindi OCR; multiple districts per post.</li>
<li>Browser simulation engine: treat text after '@' inside a UPI ID as part of the UPI, not a Telegram handle (cosmetic, simulation only).</li>
<li>Update the PPT numbers (189 terms, 1.5 s, 89.5%) to 232 terms, about 2 s, 94.4% on synthetic data.</li></ul></div></div>""")

body = "\n".join(parts)
html = f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>PRAHARI Hackathon Prep Guide</title><style>{css}</style></head><body>{body}</body></html>'
open(os.path.join(OUT, "PRAHARI_Hackathon_Prep_Guide.html"), "w", encoding="utf8").write(html)

# ---------------------------------------------------------------- markdown source
md = ["# PRAHARI Hackathon Prep Guide (version 2)", f"Prepared {today}. R4C Hackathon 2026, PS02, Team V3S. Read-only audit of the repository; nothing here claims an unbuilt feature.\n",
      "See the PDF for the formatted version with screenshots and diagrams (images in `img/`).\n",
      "## 1. Executive summary\n- Problem: sellers advertise on public channels in coded Hinglish; identifiers are rarely collated.\n- Solution: import, scan or upload, classify (232-term lexicon + context rules, optional Gemini), extract identifiers and direction, link across channels (identifiers, text, images), risk-score with reasons, analyst status with a hash-chained audit trail, re-verifiable evidence dossier.\n- Measured on synthetic data: dev P 100% / R 83.3% (n=60, tuned on); held-out P 94.4% / R 68.0% (n=50, not tuned on); 45 evasion cases pass; 92 backend tests pass. Real-world accuracy not yet measured.\n- Limits: no trained ML model, no logins, no signature; hash is a content digest, not a legal certificate.\n",
      "## 2. Requirement traceability matrix\n| Group | Requirement | Where | Status | Note |\n|---|---|---|---|---|"]
for c, r, m, s, n in MATRIX:
    md.append(f"| {c} | {r} | {m} | {s} | {n} |")
md.append("\n## 3. Screens")
for title, im, sees, click, say, behind, note in SCREENS:
    md.append(f"### {title}\n![{title}](img/{im})\n- Judge sees: {sees}\n- You click: {click}\n- You say: {say}\n- Behind the scenes: {behind}\n- Note: {note}\n")
md.append("## 4. Diagrams")
for k, t in [("4a", "System architecture"), ("4b", "Data pipeline"), ("4c", "Entity graph example"), ("4d", "Evidence chain"), ("4e", "Risk scoring")]:
    md.append(f"### {k}. {t}\n![{t}](img/diagram-{k}.svg)\n")
md.append("## 5. Presentation flow\n| # | Slide | Time | Sentence | Speaker note | Takeaway |\n|---|---|---|---|---|---|")
for p in PITCH:
    md.append("| " + " | ".join(p) + " |")
md.append("\n### Demo click path\n![Demo path](img/diagram-5b.svg)\n\n### Fallback flow\n![Fallback](img/diagram-5c.svg)\n\n## 6. Judge Q&A bank\n")
for g, gname in GROUPS.items():
    md.append(f"### {g}. {gname}\n")
    for n, x in enumerate([x for x in QA if x[0] == g], 1):
        _, q, who, diff, ans, show, tq, ta = x
        md.append(f"**{g}{n}. {q}** (asked by {who}; {diff})\n- Say: {ans}\n- Show this: {show}\n- Trap: {tq} -> {ta}\n")
open(os.path.join(OUT, "PRAHARI_Hackathon_Prep_Guide.md"), "w", encoding="utf8").write("\n".join(md))
print("questions", len(QA), "status counts", cnt)
