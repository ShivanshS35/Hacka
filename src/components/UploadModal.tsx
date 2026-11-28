import React, { useState } from 'react';
import {
  Upload,
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Radio,
  Send,
  Search,
  Cpu,
  Layers,
  Image as ImageIcon,
} from 'lucide-react';
import { InterceptPost, Platform } from '../types';
import { PLATFORMS } from './MetaBadges';
import { prahariApi } from '../services/api';
import { sound } from '../utils/audio';
import { classifyText, generateSHA256 } from '../utils/detectionEngine';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngestPosts: (newPosts: InterceptPost[]) => void;
}

type IngestMode = 'CHANNEL' | 'TEXT' | 'FILE' | 'IMAGE' | 'BENCHMARK';

/** Read the text in an image in the browser (tesseract.js is loaded only when this is used). */
async function ocrInBrowser(file: File, onProgress: (pct: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  // Engine and English model are served from this site (public/tesseract), so no third-party CDN is involved.
  const base = `${import.meta.env.BASE_URL}tesseract`;
  const worker = await createWorker('eng', 1, {
    workerPath: `${base}/worker.min.js`,
    corePath: `${base}/core`,
    langPath: `${base}/lang`,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress(Math.round(m.progress * 100));
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return (data.text || '').trim();
  } finally {
    await worker.terminate();
  }
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onIngestPosts,
}) => {
  const [activeMode, setActiveMode] = useState<IngestMode>('CHANNEL');
  const [channelInput, setChannelInput] = useState('delhi_highs');
  const [rawTextInput, setRawTextInput] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [platform, setPlatform] = useState<Platform>('UNKNOWN');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageText, setImageText] = useState('');
  const [ocrPct, setOcrPct] = useState<number | null>(null);

  if (!isOpen) return null;

  const finish = (count: number, note?: string) => {
    setSuccessCount(count);
    if (note) setStatusMessage(note);
    setTimeout(() => {
      setSuccessCount(null);
      setStatusMessage(null);
      onClose();
    }, note ? 2600 : 1500);
  };

  // 5. Screenshot / photo: OCR in the browser, then the backend hashes it and compares it with earlier images
  const handleImageChosen = async (file: File) => {
    setImageFile(file);
    setImageText('');
    setOcrPct(0);
    setStatusMessage('Reading the text in the image (runs in your browser; the first run downloads about 10 MB of language data)...');
    try {
      const text = await ocrInBrowser(file, setOcrPct);
      setImageText(text);
      setStatusMessage(text ? 'Text read from the image. Check it, fix any mistakes, then submit.' : 'No text found in the image. You can type what it says, or submit it for image matching only.');
    } catch {
      setStatusMessage('In-browser text reading is unavailable (no internet?). Type the text from the image, or submit it for image matching only.');
    } finally {
      setOcrPct(null);
    }
  };

  const handleSubmitImage = async () => {
    if (!imageFile) return;
    setIsProcessing(true);
    setStatusMessage('Uploading image: hashing, reading text and comparing with earlier images...');
    try {
      sound.playClick();
      const rec = await prahariApi.ingestImage(imageFile, { channel: channelInput.trim() ? `@${channelInput.trim().replace(/^@/, '')}` : '@image_upload', platform, ocrText: imageText });
      sound.playSuccessChime();
      if (rec.duplicate) {
        finish(0, 'This exact image from this channel is already stored, so nothing new was added.');
      } else {
        onIngestPosts([rec]);
        const sims = rec.similarImages?.length ?? 0;
        finish(1, sims > 0 ? `Near-identical image found in ${sims} earlier post${sims > 1 ? 's' : ''}; a SIMILAR IMAGE link was added to the graph.` : undefined);
      }
      setImageFile(null);
      setImageText('');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 1. Live Telegram Channel Scraping
  const handleScanChannel = async () => {
    if (!channelInput.trim()) return;
    setIsProcessing(true);
    setStatusMessage(`Connecting to Telegram public preview for @${channelInput.trim()}...`);

    try {
      sound.playClick();
      const res = await prahariApi.scanChannel({ channel: channelInput.trim(), limit: 8 });
      if (res && res.intercepts && res.intercepts.length > 0) {
        sound.playSuccessChime();
        onIngestPosts(res.intercepts);
        setSuccessCount(res.intercepts.length);
        setTimeout(() => {
          setSuccessCount(null);
          setStatusMessage(null);
          onClose();
        }, 1500);
      } else {
        throw new Error('No public messages found');
      }
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Telegram preview request failed. No live posts were collected.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Direct Raw Text Scanning with Python NLP
  const handleScanRawText = async () => {
    if (!rawTextInput.trim()) return;
    setIsProcessing(true);
    setStatusMessage('Running Hinglish slang classifier & entity extraction engine...');

    try {
      sound.playClick();
      const res = await prahariApi.scanText({
        text: rawTextInput.trim(),
        channel: '@live_analyst_input',
        platform,
      });

      if (res) {
        sound.playSuccessChime();
        if (res.duplicate) {
          finish(0, 'This exact text from this channel is already stored, so nothing new was added.');
        } else {
          onIngestPosts([res]);
          finish(1);
        }
        setRawTextInput('');
      }
    } catch {
      // Fallback to local client classifier
      const detected = classifyText(rawTextInput);
      const sha = await generateSHA256(rawTextInput);
      const fallbackPost: InterceptPost = {
        id: `txt_${Date.now()}`,
        channel: '@live_analyst_input',
        channelSubscribers: 'Analyst Node',
        timestamp: 'Just now',
        capturedAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
        rawText: rawTextInput,
        categories: detected.categories,
        confidence: detected.confidence,
        matchedSlang: detected.matchedTerms,
        entities: detected.extracted,
        districtId: 'unknown',
        districtName: 'Unknown',
        sha256: sha,
        views: 0,
        verified: false,
        sourceType: 'LOCAL_ANALYSIS',
        status: detected.categories.length > 0 ? 'FLAGGED' : 'UNCLASSIFIED',
      };
      sound.playSuccessChime();
      onIngestPosts([fallbackPost]);
      setSuccessCount(1);
      setTimeout(() => {
        setSuccessCount(null);
        setStatusMessage(null);
        setRawTextInput('');
        onClose();
      }, 1500);
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. File Drag and Drop / Input
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setStatusMessage(`Uploading and processing ${file.name} in backend...`);

    try {
      sound.playClick();
      const res = await prahariApi.ingestFile(file, platform);
      const skipped = res?.duplicates_skipped ?? 0;
      if (res && res.records && res.records.length > 0) {
        sound.playSuccessChime();
        onIngestPosts(res.records);
        finish(res.records.length, skipped > 0 ? `${skipped} message${skipped > 1 ? 's were' : ' was'} already stored and skipped.` : undefined);
      } else if (skipped > 0) {
        finish(0, `All ${skipped} messages in this file were already stored, so nothing new was added.`);
      } else {
        throw new Error('No valid records parsed');
      }
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Dataset upload failed. Check the backend connection and file format, then retry.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // 4. One-Click R4C Benchmark Dataset
  const handleLoadBenchmark = async () => {
    setIsProcessing(true);
    setStatusMessage('Injecting 4 synthetic benchmark posts...');
    sound.playClick();

    const sampleTexts = [
      {
        channel: '@shekhawati_weapons',
        text: 'Desi .315 bore katta with 15 raund live ammo available. Highway handover Sikar / Churu bypass. Contact WhatsApp 9876543210 or DM @seller_raj',
        districtId: 'sikar',
      },
      {
        channel: '@mule_bazaar',
        text: 'Need 10 ICICI & SBI current accounts with ATM card kit for crypto arbitrage rent. ₹45,000 monthly. Payment advance to raj.pay@oksbi',
        districtId: 'jaipur',
      },
      {
        channel: '@thar_chitta_syndicate',
        text: 'Afeem & chitta consignment arrived. Pure white quality. Delivery in Bikaner & Sri Ganganagar. Escrow bc1qar0srr7x9z4xpmdq48995874251',
        districtId: 'bikaner',
      },
      {
        channel: '@doc_bypass_mewar',
        text: 'Fake Aadhaar, PAN card, and driving license 100% hologram verified. Instant dispatch to Kota/Udaipur. WhatsApp 9876543210',
        districtId: 'udaipur',
      },
    ];

    const newPosts: InterceptPost[] = [];
    for (let i = 0; i < sampleTexts.length; i++) {
      const s = sampleTexts[i];
      try {
        const res = await prahariApi.scanText({ text: s.text, channel: s.channel, districtId: s.districtId, platform: 'TELEGRAM' });
        if (!res.duplicate) newPosts.push(res);
      } catch {
        const detected = classifyText(s.text);
        const hash = await generateSHA256(s.text);
        newPosts.push({
          id: `bm_${Date.now()}_${i}`,
          channel: s.channel,
          channelSubscribers: '8.4K',
          timestamp: 'Just now',
          capturedAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
          rawText: s.text,
          categories: detected.categories,
          confidence: detected.confidence,
          matchedSlang: detected.matchedTerms,
          entities: detected.extracted,
          districtId: s.districtId,
          districtName: s.districtId.charAt(0).toUpperCase() + s.districtId.slice(1),
          sha256: hash,
          views: 650,
          verified: false,
          sourceType: 'SYNTHETIC_DEMO',
          status: 'FLAGGED',
        });
      }
    }

    sound.playSuccessChime();
    if (newPosts.length > 0) onIngestPosts(newPosts);
    setIsProcessing(false);
    if (newPosts.length === 0) {
      finish(0, 'The benchmark posts are already stored, so nothing new was added.');
    } else {
      finish(newPosts.length);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none font-sans">
      <div className="bg-[#0C101A] border border-white/[0.1] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-4 bg-white/[0.02] border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="font-semibold text-white text-sm">
                PRAHARI // Dataset Import & Analysis Prototype
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Connect live Telegram channels, paste raw chat text, or upload exports
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-4 pt-3 pb-2 bg-white/[0.01] border-b border-white/[0.06] flex items-center gap-2 overflow-x-auto text-xs">
          {[
            { key: 'CHANNEL', label: 'Telegram Scraper', icon: Radio },
            { key: 'TEXT', label: 'Raw Slang Scanner', icon: Send },
            { key: 'FILE', label: 'CSV / JSON Export', icon: Upload },
            { key: 'IMAGE', label: 'Screenshot / Image', icon: ImageIcon },
            { key: 'BENCHMARK', label: 'R4C Benchmark', icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeMode === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  sound.playClick();
                  setActiveMode(tab.key as IngestMode);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          {successCount !== null ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
              <div className="text-emerald-400 font-bold text-base">
                {successCount > 0 ? `IMPORT COMPLETE: ${successCount} NEW POST${successCount > 1 ? 'S' : ''} SCANNED` : 'NOTHING NEW TO ADD'}
              </div>
              <p className="text-slate-400 text-xs">
                {statusMessage || 'Identifiers extracted (UPI, phone, wallet, handle), a SHA-256 content digest recorded, and the district matched from the text.'}
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: LIVE TELEGRAM CHANNEL SCRAPER */}
              {activeMode === 'CHANNEL' && (
                <div className="space-y-3">
                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1.5">
                    <div className="text-slate-300 font-medium flex items-center gap-2">
                      <Radio className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Live Public Telegram Channel Scraper</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Scrapes live broadcast posts via Telegram's open public web preview endpoint (<code className="text-cyan-300">https://t.me/s/channel</code>). No phone number or login credentials required!
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400 font-mono">
                      TELEGRAM CHANNEL HANDLE OR LINK:
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-2.5 text-slate-500 font-mono text-xs">
                          t.me/
                        </span>
                        <input
                          type="text"
                          value={channelInput}
                          onChange={(e) => setChannelInput(e.target.value)}
                          placeholder="delhi_highs or mule_bazaar"
                          className="w-full pl-14 pr-3 py-2 bg-[#070A10] border border-white/[0.08] focus:border-cyan-500/50 rounded-xl text-white text-xs font-mono focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={handleScanChannel}
                        disabled={isProcessing || !channelInput.trim()}
                        className="bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 px-4 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(34,211,238,0.25)] shrink-0"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>{isProcessing ? 'Scraping...' : 'Live Scrape & Scan'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center gap-2 text-[11px] text-slate-500">
                    <span>Quick presets:</span>
                    {['delhi_highs', 'mule_bazaar', 'rajasthan_arms_hub', 'doc_forge_raj'].map(
                      (preset) => (
                        <button
                          key={preset}
                          onClick={() => setChannelInput(preset)}
                          className="text-cyan-400/80 hover:text-cyan-300 hover:underline font-mono"
                        >
                          @{preset}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: RAW TEXT SLANG SCANNER */}
              {activeMode === 'TEXT' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400 font-mono">
                      PASTE SUSPICIOUS HINGLISH / HINDI / ENGLISH CHAT TEXT:
                    </label>
                    <textarea
                      rows={4}
                      value={rawTextInput}
                      onChange={(e) => setRawTextInput(e.target.value)}
                      placeholder='e.g. "Pure white chitta 5g score available at Jaipur station. Payment strictly via raj.pay@oksbi or WhatsApp 9876543210. DM @seller_raj"'
                      className="w-full p-3 bg-[#070A10] border border-white/[0.08] focus:border-cyan-500/50 rounded-xl text-white text-xs font-sans leading-relaxed focus:outline-none resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() =>
                        setRawTextInput(
                          'Desi .315 bore katta with 10 raund available. Alwar / Sikar pickup only. WhatsApp order +91 9876543210 or BTC escrow bc1qar0srr7x9z4xpmdq'
                        )
                      }
                      className="text-[11px] text-cyan-400 hover:underline font-medium"
                    >
                      Paste Arms Trade Sample
                    </button>

                    <button
                      onClick={handleScanRawText}
                      disabled={isProcessing || !rawTextInput.trim()}
                      className="bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 px-4 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(34,211,238,0.25)]"
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>{isProcessing ? 'Classifying...' : 'Run NLP Classifier'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: FILE UPLOAD */}
              {activeMode === 'FILE' && (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    dragActive
                      ? 'border-cyan-400 bg-cyan-950/40'
                      : 'border-white/[0.08] hover:border-cyan-500/40 bg-[#070A10]'
                  }`}
                >
                  <FileText className="w-10 h-10 text-cyan-400/80 mx-auto mb-2" />
                  <p className="text-slate-200 font-semibold mb-1">
                    Drag & Drop Telegram CSV or JSON Chat Export
                  </p>
                  <p className="text-slate-500 text-[11px] mb-4">
                    Supports desktop chat exports, WhatsApp text exports, or custom tabular files
                  </p>
                  <label className="inline-block bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white px-4 py-2 rounded-xl font-medium cursor-pointer transition-all">
                    <span>Browse Local File</span>
                    <input
                      type="file"
                      accept=".json,.csv,.txt"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* TAB 4: BENCHMARK DATASET */}
              {activeMode === 'BENCHMARK' && (
                <div className="space-y-3">
                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1">
                    <div className="text-white font-medium">R4C Hackathon Pre-loaded Benchmark</div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Injects 4 synthetic test posts spanning Narcotics (Bikaner), Illegal Arms (Sikar), Mule Bank Kits (Jaipur), and Fake Aadhaar/DL Documents (Udaipur).
                    </p>
                  </div>

                  <button
                    onClick={handleLoadBenchmark}
                    disabled={isProcessing}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:brightness-110 text-slate-950 p-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isProcessing ? 'Injecting...' : 'Load R4C Benchmark Dataset (One-Click)'}</span>
                  </button>
                </div>
              )}

              {/* Tab 5: image */}
              {activeMode === 'IMAGE' && (
                <div className="space-y-3">
                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1">
                    <div className="text-slate-200 font-medium">Ad screenshots and photos</div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      The text in the picture is read in your browser and scanned like any post. The image gets a SHA-256 and a perceptual
                      hash, so the same picture re-posted in another channel is linked even if it was resized or re-compressed. The image
                      file itself is not stored.
                    </p>
                  </div>
                  <label className="block border-2 border-dashed border-white/[0.1] hover:border-cyan-500/40 rounded-xl p-5 text-center cursor-pointer bg-[#070A10]">
                    <ImageIcon className="w-8 h-8 text-cyan-400/80 mx-auto mb-1.5" />
                    <span className="text-slate-200 font-medium">{imageFile ? imageFile.name : 'Choose a PNG, JPG or WebP (max 8 MB)'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleImageChosen(e.target.files[0])}
                    />
                  </label>
                  {ocrPct !== null && (
                    <div className="h-1.5 rounded bg-white/[0.06] overflow-hidden">
                      <div className="h-full bg-cyan-400 transition-all" style={{ width: `${ocrPct}%` }} />
                    </div>
                  )}
                  {imageFile && (
                    <>
                      <label className="text-[11px] text-slate-400 font-mono">TEXT IN THE IMAGE (EDIT IF OCR GOT IT WRONG):</label>
                      <textarea
                        rows={3}
                        value={imageText}
                        onChange={(e) => setImageText(e.target.value)}
                        className="w-full p-3 bg-[#070A10] border border-white/[0.08] focus:border-cyan-500/50 rounded-xl text-white text-xs leading-relaxed focus:outline-none resize-none"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={channelInput}
                          onChange={(e) => setChannelInput(e.target.value)}
                          placeholder="channel / account the image came from"
                          className="flex-1 px-3 py-2 bg-[#070A10] border border-white/[0.08] rounded-xl text-white text-xs font-mono focus:outline-none"
                        />
                        <button
                          onClick={handleSubmitImage}
                          disabled={isProcessing || ocrPct !== null}
                          className="bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-slate-950 px-4 py-2 rounded-xl font-semibold shrink-0"
                        >
                          {isProcessing ? 'Uploading...' : 'Scan image'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Platform the material came from (recorded on each post) */}
              {(activeMode === 'TEXT' || activeMode === 'FILE' || activeMode === 'IMAGE') && (
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <label htmlFor="platform-select">SOURCE PLATFORM:</label>
                  <select
                    id="platform-select"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as Platform)}
                    className="bg-[#070A10] border border-white/[0.1] rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>{p === 'UNKNOWN' ? 'Not specified' : p}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status Message */}
              {statusMessage && (
                <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>{statusMessage}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
