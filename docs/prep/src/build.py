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
 ("MUST HAVE", "Import a provided dataset", "Import Intel > CSV / JSON Export; POST /api/ingest/file (main.py)", "IMPLEMENTED", "CSV or JSON or Telegram Desktop export; max 500 records and 10 MB."),
 ("MUST HAVE", "Collect from 2-3 public channels", "Import Intel > Telegram Scraper; POST /api/scan/channel; telegram_scraper.py", "PARTIAL", "On-demand, one channel per scan, public preview only; no scheduled monitoring."),
 ("MUST HAVE", "Classify posts", "classifier.py classify_text + gemini_classifier.hybrid_classify; POST /api/scan/text", "IMPLEMENTED", "Rules and lexicon (189 terms). Gemini optional."),
 ("MUST HAVE", "Extract identifiers", "extractor.py extract_entities", "IMPLEMENTED", "Phone, UPI, @handle, BTC/ETH/TRON wallet, bank a/c, IFSC, district."),
 ("MUST HAVE", "Link identifiers across channels", "graph_engine.py; GET /api/graph; 3D Entity Topology tab", "IMPLEMENTED", "Node keyed by identifier; 2+ channels marks a cross-channel link."),
 ("MUST HAVE", "Alert dashboard with evidence snapshots", "Alerts tab (GET /api/alerts); Forensic Dossier (GET /api/dossier/{id})", "IMPLEMENTED", "Text, UTC time, channel, source label, SHA-256 digest, risk reasons."),
 ("KEY FEATURE 2", "Curated slang + emoji lexicon", "classifier.py SLANG_DICTIONARY", "IMPLEMENTED", "English, Hinglish, Devanagari, emoji; strong vs ambiguous terms."),
 ("KEY FEATURE 2", "ML component", "gemini_classifier.py (optional); sklearn only for similarity", "PLANNED", "No trained classifier. Optional Gemini second opinion with user key."),
 ("KEY FEATURE 3", "Account, ATM card, net-banking kit ads", "FINANCIAL group in the lexicon; ACCOUNT_KIT_RE", "IMPLEMENTED", "Context rules reduce false alarms."),
 ("KEY FEATURE 3", "SIM card sale or rent", "none (only 'sim' as a kit hint)", "PLANNED", "Not detected as its own class in audit tests."),
 ("KEY FEATURE 3", "Buy / sell / rent direction", "none", "PLANNED", "Not extracted as a field."),
 ("KEY FEATURE 3", "Risk classification with evidence", "analytics.risk_for; Alerts 'Why:' lines", "IMPLEMENTED", "Additive, LOW / MEDIUM / HIGH, reasons shown."),
 ("KEY FEATURE 4", "Identifiers from text", "extractor.py", "IMPLEMENTED", "See above."),
 ("KEY FEATURE 4", "Locations from text", "extractor.py RAJASTHAN_DISTRICT_SYNONYMS (41 districts)", "PARTIAL", "District names only; first match wins."),
 ("KEY FEATURE 4", "Identifiers from images", "none", "PLANNED", "No OCR."),
 ("KEY FEATURE 5", "Repeated / coordinated ads (text)", "analytics.find_coordinated; GET /api/coordinated; Alerts > Coordinated ads", "IMPLEMENTED", "Char n-gram TF-IDF cosine >= 0.65, union-find."),
 ("KEY FEATURE 5", "Image similarity", "none", "PLANNED", "No image hashing."),
 ("KEY FEATURE 6", "Evidence snapshot: text, time, channel, hash", "AlertsPanel, ForensicDossier, pdfGenerator.ts", "IMPLEMENTED", "Hash is a content digest of rawText, not a certificate."),
 ("GOOD TO HAVE", "OCR of images / posters", "none", "PLANNED", "Needs R4C sample posters to evaluate."),
 ("GOOD TO HAVE", "Hindi / Hinglish slang", "classifier.py lexicon", "IMPLEMENTED", "Plus Unicode normalisation and obfuscation handling."),
 ("GOOD TO HAVE", "Automatic evidence report (PDF)", "src/utils/pdfGenerator.ts (jsPDF, in the browser)", "IMPLEMENTED", "One dossier per post; wording of banner to be softened."),
 ("OUT OF SCOPE", "Join private groups / fake identities", "telegram_scraper.py uses public preview only", "COMPLIANT", "Not attempted."),
 ("OUT OF SCOPE", "Interact with or buy from sellers", "no such endpoint", "COMPLIANT", "Not attempted."),
 ("OUT OF SCOPE", "Collect from private accounts", "no such path", "COMPLIANT", "Not attempted."),
 ("EXTRA", "Hash chain, signature, verify", "none", "PLANNED", "See diagram 4d."),
]

# ---------------------------------------------------------------- screens
SCREENS = [
 ("3.1 Landing showcase", "s1-landing.png",
  "A boot animation (it also wakes the backend), then an editorial page: problem, five-stage pipeline, a classifier test box, topology preview, prototype report, and the buttons LAUNCH COMMAND CENTER and AI settings.",
  "Scroll to the pipeline section, then press LAUNCH COMMAND CENTER.",
  "'Public ads are easy to find; linking them is hard. This is the five-stage pipeline that does the linking.'",
  "App.tsx shows EditorialShowcase first. checkHealth() pings GET /api/health to wake Render. The test box on this page runs the browser rule engine (utils/detectionEngine.ts), not the backend.",
  "Do not use the landing test box to demo false-alarm handling; use Import Intel > Raw Slang Scanner."),
 ("3.2 Command Center", "s3-command.png",
  "Left: signals feed with category filter, confidence floor (default 70%) and search. Centre: MapLibre map of India with the 41 Rajasthan districts coloured by threat level. Right: dossier panel for the selected post and district.",
  "Click a post in the feed, then a district on the map, then Copy Hash or PDF Report.",
  "'Every card shows why it was flagged: matched slang in red, identifiers as chips, source label saying it is synthetic demo data.'",
  "Feed from GET /api/feed and WebSocket /ws/stream (NEW_INTERCEPT messages). District counts come from posts; arcs between districts come from demo connection data. Simulation Live creates synthetic posts every 12 s and pauses when real data arrives.",
  "Identifier chips: UPI = cyan, TEL (phone) = amber, BANK and IFSC = emerald, CRYPTO = purple, TG (Telegram handle) = sky. Click any chip to copy the full value. Matched slang words are red."),
 ("3.3 Import Intel", "s7-import.png",
  "A dialog with four tabs: Telegram Scraper, Raw Slang Scanner, CSV / JSON Export, R4C Benchmark.",
  "Raw Slang Scanner: paste the mule-account ad and press scan; then close the dialog.",
  "'Same pipeline for a pasted post, an uploaded file or a public channel.'",
  "Scraper: POST /api/scan/channel. Scanner: POST /api/scan/text. File: POST /api/ingest/file. Each ends in process_and_store_post: classify, extract, district, SHA-256, SQLite, graph, WebSocket broadcast. If the backend is unreachable the Scanner falls back to the browser engine and labels the post LOCAL_ANALYSIS.",
  "Suggested paste: Selling fully KYC verified current account with ATM card + net-banking kit. Rs 15000. UPI raj.pay@oksbi (expected FINANCIAL 0.99)."),
 ("3.4 Alerts", "s4-alerts.png",
  "A ranked list of alerts (ALRT-date-xxxx) with category, matched words, identifiers, 'Why:' reasons, a copyable SHA-256 and an 'Open dossier' link, plus a Coordinated ads panel.",
  "Filter HIGH, open the border-drop alert, read the reasons, then open its dossier.",
  "'The risk score is additive and every point has a reason. No black box.'",
  "GET /api/alerts runs analytics.build_alerts over stored posts: risk_for per post, identifier-channel counts. GET /api/coordinated groups near-duplicate ads by TF-IDF character n-grams.",
  "Say 'identifier seen in 2+ channels' aloud: that is the cross-channel link."),
 ("3.5 3D Entity Topology", "s5-topology.png",
  "A graph of the selected case: the post, its channel, district nexus and identifiers. Tabs: Case topology and Global demo graph. A side panel lists channels linked in graph and network relations.",
  "Select @seller_raj, read 'Channels linked in graph', press 'Locate on Rajasthan Map'.",
  "'One handle, several channels. That is the lead an investigator would otherwise miss.'",
  "GET /api/graph returns nodes and edges from graph_engine.DynamicEntityGraph; the page uses it when the backend has data and otherwise shows a built-in demo graph.",
  "The graph is a custom class, not NetworkX. Shared helplines can create false hubs."),
 ("3.6 Forensic Dossier and PDF", "s6-dossier.png",
  "A case-binder view: exhibits, the SHA-256 integrity hash, raw text, extracted identifiers, and an Export Demo Report button. The PDF has four numbered sections and a disclaimer.",
  "Open the binder, read the digest scope line, press Export Demo Report.",
  "'The digest detects edits to this text. It is not a legal certificate, and we say so on the page.'",
  "PDF is generated in the browser by src/utils/pdfGenerator.ts using jsPDF. The digest is computed in the backend over UTF-8 rawText (extractor.generate_sha256); the dossier page says 'prototype digest, not certified'.",
  "Known wording to avoid saying aloud: 'sealed', 'court-ready', 'judicial evidence'. The PDF banner still uses stronger words than the product."),
]

# ---------------------------------------------------------------- pitch
PITCH = [
 ("1", "Hook", "0:30", "The advertisements are public; the networks are not.", "Open with the problem: finding posts is easy, linking sellers is hard.", "The real problem is linking, not finding."),
 ("2", "By the numbers", "0:30", "189 terms, 1.5 s for 500 posts, 41 districts.", "Say these are measured prototype numbers.", "It is fast and we only quote what we measured."),
 ("3", "Same UPI", "0:30", "One UPI can sit in a drug ad and a mule ad.", "Tell the drug-ad and mule-ad story; do not say 'nobody does this'.", "Identifier linking is the value."),
 ("4", "Pipeline", "0:45", "Collect, classify, extract, link, alert.", "Name each stage in one phrase; say the analyst stays in control.", "A complete loop, not a single feature."),
 ("5", "Detection engine", "0:50", "Rules + lexicon, optional AI; real outputs shown.", "Read the two real outputs; say precision 89.5% and recall 68.0% on a small synthetic holdout.", "It is explainable and honest about accuracy."),
 ("6", "Entity graph", "0:45", "Same identifier. Two posts. One link.", "Point at the shared UPI node.", "Cross-channel links are visible."),
 ("7", "Evidence snapshot", "0:40", "A content digest, not a legal certificate.", "Say the digest detects edits to the text; certification is a separate legal step.", "We do not overclaim evidence."),
 ("8", "Multilingual", "0:30", "Hindi, Hinglish, English, emoji.", "Read one Hinglish example.", "It reads local slang."),
 ("9", "What changes", "0:30", "Less manual copying and cross-checking.", "Qualitative, no multipliers.", "The analyst saves effort."),
 ("10", "Today vs next", "0:40", "Built today / not yet.", "Say the gaps yourself: ML, OCR, SIM, audit log, verify.", "Trust through honesty."),
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
"""

parts = []
# ---- cover + 1 executive summary
parts.append(f"""
<div class="cover">
 <span class="tag">R4C HACKATHON 2026  -  PS02  -  TEAM V3S</span>
 <h1>PRAHARI<br/>Hackathon Prep Guide</h1>
 <p style="font-size:13pt;margin:0 0 6mm">Telegram and Social Media Illegal Trade Monitor<br/>Evidence-based pitch, demo and judge Q&amp;A guide</p>
 <p class="small">Prepared {today} from a read-only audit of the repository (branch main, includes PRs #14 to #18). Nothing in this guide claims a feature that is not in the code. Where a number is not measured it says <b>to be measured</b> and gives the method.</p>
 <div class="box nb"><b>How to use it</b><ul>
  <li>Section 1-2: know exactly what is built (and what is not).</li><li>Section 3-4: know every screen and diagram.</li>
  <li>Section 5: rehearse the 6.5-minute pitch and the 3.5-minute click path; keep the fallback ready.</li>
  <li>Section 6: 120 judge questions, each with a spoken answer, a proof to show and a trap follow-up.</li></ul></div>
</div>""")

parts.append(f"""
<div class="section"><h2>1. Executive summary</h2>
<h3>Problem</h3><p>Drug, arms, fake-document and mule-account sellers advertise on public Telegram channels and social media in coded Hinglish and emojis. Analysts read channel by channel, and seller identifiers (phone, UPI, handle) are rarely collated across channels.</p>
<h3>Solution: PRAHARI</h3><p>A web dashboard that imports or collects public posts, flags illegal-sale ads with slang-aware rules, extracts seller identifiers, links the same identifier across channels, scores risk with stated reasons, shows it on a Rajasthan district map and exports an evidence dossier.</p>
<h3>How it works in 5 lines</h3><ol>
<li><b>Collect</b>: CSV/JSON import, pasted text, or a public Telegram preview scan (no login).</li>
<li><b>Classify</b>: 189-term lexicon (English, Hinglish, Devanagari, emoji); ambiguous words need sale context; optional Gemini second opinion.</li>
<li><b>Extract</b>: phone, UPI, @handle, crypto wallet, bank account, IFSC, district.</li>
<li><b>Link</b>: identifier graph across channels and near-duplicate ad grouping.</li>
<li><b>Alert</b>: risk-scored alerts with evidence (text, time, channel, SHA-256) and a PDF dossier.</li></ol>
<h3>Three headline impact points (measured or stated)</h3><ul>
<li>Imports and scores 500 posts in about 1.5 s on the demo backend; rules take about 0.6 ms per post.</li>
<li>Every flag is explainable: matched words highlighted, risk reasons listed.</li>
<li>Cross-channel linking turns separate ads into a lead: one handle appears in three demo channels.</li></ul>
<h3>What is unique</h3><p>Context-aware slang rules (ambiguous words need sale context), a transparent additive risk score, identifier linking on a district map, and an evidence record that is explicit about its own limits.</p>
<div class="cols nb">
<div class="box"><b>Measured numbers (from the repo)</b><ul>
<li>Lexicon: 189 terms, 4 categories.</li><li>Dev set (n=60, used for tuning): precision 100%, recall 83.3%.</li>
<li>Holdout (n=50, never tuned on): precision 89.5%, recall 68.0%, accuracy 80.0%.</li>
<li>F1 computed from those: about 0.91 dev, about 0.77 holdout.</li>
<li>Sets are synthetic and keyword-style; 95% interval on holdout precision is about 0.69-0.97.</li></ul></div>
<div class="box"><b>Honest limits (say them first)</b><ul>
<li>No trained ML; rules plus optional Gemini.</li><li>No OCR or image similarity; no SIM or buy/sell/rent detection.</li>
<li>Hash is a content digest, not a legal certificate; no signature or chain; not re-verifiable in-app.</li>
<li>No login; free-tier hosting; synthetic demo data.</li></ul></div></div>
</div>""")

# ---- 2 matrix
rows = [(E(c), E(r), E(m), badge(s), E(n)) for c, r, m, s, n in MATRIX]
cnt = {}
for c, r, m, s, n in MATRIX:
    cnt[s] = cnt.get(s, 0) + 1
parts.append(f"""
<div class="section"><h2>2. Requirement traceability matrix</h2>
<p class="small">Status key: IMPLEMENTED = works in the code today. PARTIAL = works with stated limits. PLANNED = on our next list, no code. MISSING = not planned. COMPLIANT = an out-of-scope item we deliberately do not do. Totals: {", ".join(f"{k} {v}" for k, v in cnt.items())}.</p>
{md_table_html(["Group", "Requirement", "Where in PRAHARI (screen / file / endpoint)", "Status", "Note"], rows)}
</div>""")

# ---- 3 screens
s3 = ['<div class="section"><h2>3. How the website works, screen by screen</h2>',
      '<p class="small">Screenshots were captured from a local run of the current code (synthetic demo data). The demo data labels itself as synthetic on every post.</p>']
for i, (title, im, sees, click, say, behind, note) in enumerate(SCREENS):
    s3.append(f'<div class="nb"><h3>{E(title)}</h3>{img(im)}'
              f'<table><tr><td width="16%"><b>Judge sees</b></td><td>{E(sees)}</td></tr>'
              f'<tr><td><b>You click</b></td><td>{E(click)}</td></tr>'
              f'<tr><td><b>You say</b></td><td>{E(say)}</td></tr>'
              f'<tr><td><b>Behind the scenes</b></td><td>{E(behind)}</td></tr>'
              f'<tr><td><b>Note</b></td><td>{E(note)}</td></tr></table></div>')
    if i in (1, 3):
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
  + dia("4a", "4a. System architecture", "The graph is a custom class (no NetworkX). Gemini is optional and uses the user's own key. SQLite on Render's free tier can be reset.")
  + dia("4b", "4b. End-to-end data pipeline", "Green = in the code today. Red dashed = planned. Image similarity, OCR and a trained model are not implemented.")
  + '</div>')
parts.append('<div class="section">' + dia("4c", "4c. Entity-graph example: one identifier across three channels", "Built from the synthetic seed posts. Linking is a lead, not proof of identity.")
  + dia("4d", "4d. Evidence chain: today and next", "Today the record is a content digest. A hash chain, signature, trusted timestamp, audit log and verify button are not built yet.") + '</div>')
parts.append('<div class="section">' + dia("4e", "4e. Risk-scoring logic", "Source: backend/analytics.py risk_for. Maximum score is 7.") + '</div>')

# ---- 5 presentation
prow = [(E(a), E(b), E(c), E(d), E(e), E(f)) for a, b, c, d, e, f in PITCH]
parts.append(f"""<div class="section"><h2>5. Presentation flow</h2>
<h3>5.1 Pitch: slide by slide (about 6.5 minutes)</h3>
<p class="small">Uses the corrected 11-slide deck (Prahari_Threat_Analysis_fixed.pptx). Total 6:30 leaves room inside a 7-minute slot.</p>
{md_table_html(["#", "Slide", "Time", "Sentence it must land", "Speaker note", "Takeaway"], prow)}
<div class="warn"><b>Do not say:</b> court-ready, sealed, 100X, thousands of channels, nobody does this, real-time 24x7, machine-learning model.<br/>
<b>Say instead:</b> evidence snapshot with a content digest; measured on a small synthetic set; analyst-in-the-loop; on-demand scan and import; rules plus optional AI.</div>
</div>""")
parts.append('<div class="section"><h3>5.2 Live-demo click path (about 3.5 minutes)</h3>' + ALL["5b"]() +
 """<ol class="small"><li>Open the site 10 minutes early, wait for the 'Python OSINT: online' chip, then leave it.</li>
<li>Paste text for step 4 is in a note: <code>Selling fully KYC verified current account with ATM card + net-banking kit. Rs 15000. UPI raj.pay@oksbi</code></li>
<li>Expected: category FINANCIAL, confidence 0.99, a UPI chip, a new alert in the Alerts tab.</li>
<li>If a judge asks for a false-alarm test, paste <code>weed out the ice cream</code> into the same scanner: it should not flag.</li>
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
<li>Endpoints: GET /api/health, /api/feed, /api/alerts, /api/coordinated, /api/districts, /api/graph, /api/dossier/{id}; POST /api/scan/text, /api/scan/channel, /api/ingest/file, /api/gemini/check; WebSocket /ws/stream.</li>
<li>classifier.py: lexicon with strong and ambiguous terms, sale-context rules, negative phrases, obfuscation handling; flag threshold 0.70.</li>
<li>gemini_classifier.py: only with a user key and only when unsure; cached, rate-limited (30/min, 300 calls per process); falls back to rules.</li>
<li>extractor.py: regex and linear scan for phone, UPI, handle, wallets, bank, IFSC; 41 district synonyms.</li>
<li>graph_engine.py: custom node/edge store; analytics.py: risk and TF-IDF similarity.</li>
<li>SQLite file; newest 300 posts in memory; 500-record and 10 MB import limits.</li></ul></div>
<div class="box"><b>Frontend (React 18, Vite, Tailwind)</b><ul>
<li>Tabs: Command Center, 3D Entity Topology, Forensic Dossier, Alerts; global search with Ctrl/Cmd+K.</li>
<li>MapLibre map with no third-party tiles; bundled India outline and 41-district GeoJSON.</li>
<li>jsPDF dossier export in the browser; click-to-copy identifier chips.</li>
<li>Browser-side rule engine for the synthetic simulation and offline fallback only.</li>
<li>Hosting: Vercel (frontend), Render free tier (backend, sleeps, ephemeral disk).</li></ul></div></div>
<h3>Wording still present in the product that overstates it</h3>
<table><tr><th>Where</th><th>Words</th><th>What to say if asked</th></tr>
<tr><td>Landing page section 07</td><td>'SAME INVESTIGATOR. 100X THE REACH.'</td><td>A slogan, not a measured result.</td></tr>
<tr><td>PDF banner and status</td><td>'JUDICIAL EVIDENCE USE ONLY', '// SEALED'</td><td>Handling banner; the certificate box says it is a content digest, not a legal certificate.</td></tr>
<tr><td>Record field / backend page</td><td>'section65B', 'SEC 65B CHAIN'</td><td>Internal labels; certified is always false.</td></tr>
<tr><td>README</td><td>MIT badge, no LICENSE file; screenshot named 'sec65b-court-pdf'</td><td>Licence file to be added.</td></tr></table>
<h3>Appendix B. How to measure precision, recall and F1 on the R4C labelled set</h3>
<ol><li>Create a CSV with columns <code>text,label</code> where label is DRUGS, ARMS, DOCUMENTS, FINANCIAL or NONE.</li>
<li>Split it (for example 50/50, stratified by label). Tune the lexicon only on the first half.</li>
<li>Run <code>python backend/eval_classifier.py</code> style scoring on the second half: for each category count TP, FP, FN.</li>
<li>Precision = TP/(TP+FP); Recall = TP/(TP+FN); F1 = 2PR/(P+R). Also report overall accuracy and the confusion matrix.</li>
<li>Add a 95% Wilson interval for each ratio and say the sample size next to every number.</li>
<li>Report the rules-only result and, separately, the result with Gemini enabled. Until this is run the figures are <b>to be measured</b>.</li></ol>
<div class="nb"><h3>Appendix C. Suggested fixes before or after the demo (not applied)</h3>
<ul><li>Reword the PDF banner and 'SEALED' label; remove 100X from the landing page; add a LICENSE file.</li>
<li>Require a second signal for a single strong keyword; suppress shared helpline numbers in the graph; add dedup and identifier normalisation; extract buy/sell/rent and SIM cards.</li>
<li>Add a verify-hash action and an analyst status with an audit log.</li></ul></div></div>""")

body = "\n".join(parts)
html = f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>PRAHARI Hackathon Prep Guide</title><style>{css}</style></head><body>{body}</body></html>'
open(os.path.join(OUT, "PRAHARI_Hackathon_Prep_Guide.html"), "w", encoding="utf8").write(html)

# ---------------------------------------------------------------- markdown source
md = ["# PRAHARI Hackathon Prep Guide", f"Prepared {today}. R4C Hackathon 2026, PS02, Team V3S. Read-only audit of the repository; nothing here claims an unbuilt feature.\n",
      "See the PDF for the formatted version with screenshots and diagrams (images in `img/`).\n",
      "## 1. Executive summary\n- Problem: sellers advertise on public channels in coded Hinglish; identifiers are rarely collated.\n- Solution: import or collect, classify (189-term lexicon, optional Gemini), extract identifiers, link across channels, risk-score with reasons, district map, evidence dossier.\n- Measured: dev P 100% / R 83.3% (n=60, tuned on); holdout P 89.5% / R 68.0% (n=50, synthetic, not tuned on); F1 about 0.91 / 0.77.\n- Limits: no trained ML, OCR, image similarity, SIM or buy/sell/rent detection; hash is a content digest, not a legal certificate.\n",
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
