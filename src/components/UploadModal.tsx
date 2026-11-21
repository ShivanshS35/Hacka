import React, { useState } from 'react';
import { Upload, X, FileText, CheckCircle2, AlertTriangle, Sparkles, Database } from 'lucide-react';
import { InterceptPost } from '../types';
import { classifyText, generateSHA256 } from '../utils/detectionEngine';
import { sound } from '../utils/audio';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngestPosts: (newPosts: InterceptPost[]) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onIngestPosts
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processTextData = async (rawString: string) => {
    setIsProcessing(true);
    try {
      const generatedPosts: InterceptPost[] = [];
      const lines = rawString.split('\n').filter(l => l.trim() !== '');

      // Check if JSON
      if (rawString.trim().startsWith('[') || rawString.trim().startsWith('{')) {
        const parsed = JSON.parse(rawString);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const text = item.text || item.message || item.rawText || JSON.stringify(item);
          const channel = item.channel || item.sender || '@custom_ingest';
          const classification = classifyText(text);
          const hash = await generateSHA256(text);

          generatedPosts.push({
            id: `post_up_${Date.now()}_${i}`,
            channel,
            channelSubscribers: '5.2K',
            timestamp: new Date().toISOString(),
            capturedAt: new Date().toISOString(),
            rawText: text,
            categories: classification.categories,
            confidence: classification.confidence,
            matchedSlang: classification.matchedTerms,
            entities: classification.extracted,
            districtId: item.districtId || 'jaipur',
            districtName: item.districtName || 'Jaipur',
            sha256: hash,
            views: Math.floor(Math.random() * 2000) + 300,
            verified: true,
            status: 'FLAGGED'
          });
        }
      } else {
        // Assume CSV or plaintext lines
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (i === 0 && line.toLowerCase().includes('text')) continue; // Skip header
          const text = line.split(',')[0] || line;
          if (text.length < 5) continue;
          const classification = classifyText(text);
          const hash = await generateSHA256(text);

          generatedPosts.push({
            id: `post_up_${Date.now()}_${i}`,
            channel: '@telegram_csv_dump',
            channelSubscribers: '3.4K',
            timestamp: new Date().toISOString(),
            capturedAt: new Date().toISOString(),
            rawText: text,
            categories: classification.categories,
            confidence: classification.confidence,
            matchedSlang: classification.matchedTerms,
            entities: classification.extracted,
            districtId: i % 2 === 0 ? 'jaipur' : 'jodhpur',
            districtName: i % 2 === 0 ? 'Jaipur' : 'Jodhpur',
            sha256: hash,
            views: Math.floor(Math.random() * 1500) + 200,
            verified: true,
            status: 'FLAGGED'
          });
        }
      }

      if (generatedPosts.length > 0) {
        sound.playSuccessChime();
        onIngestPosts(generatedPosts);
        setSuccessCount(generatedPosts.length);
        setTimeout(() => {
          setSuccessCount(null);
          onClose();
        }, 1400);
      }
    } catch (err) {
      alert('Error parsing uploaded file format. Please ensure valid JSON or CSV.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = ev => {
        const text = ev.target?.result as string;
        if (text) processTextData(text);
      };
      reader.readAsText(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = ev => {
        const text = ev.target?.result as string;
        if (text) processTextData(text);
      };
      reader.readAsText(file);
    }
  };

  // Pre-configured Benchmark Test Data
  const loadBenchmarkData = () => {
    sound.playClick();
    const benchmarkJson = JSON.stringify([
      {
        channel: '@shekhawati_underground',
        text: 'Desi katta 315 bore available with 15 live rounds. Direct highway handover in Sikar/Churu bypass. DM @shekhawati_lead',
        districtId: 'sikar',
        districtName: 'Sikar'
      },
      {
        channel: '@havala_rajasthan_network',
        text: 'Need 10 ICICI & SBI current accounts with ATM kits for crypto arbitrage rent. ₹45,000 month fixed. Contact 9876543210 UPI raj.pay@oksbi',
        districtId: 'jaipur',
        districtName: 'Jaipur'
      },
      {
        channel: '@thar_chitta_syndicate',
        text: 'Afeem & chitta consignment arrived. Pure white quality. Delivery in Bikaner & Sri Ganganagar. Escrow bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
        districtId: 'bikaner',
        districtName: 'Bikaner'
      },
      {
        channel: '@doc_bypass_mewar',
        text: 'Fake Aadhaar, PAN card, and driving license 100% hologram verified. Instant dispatch to Kota/Udaipur. WhatsApp 9876543210',
        districtId: 'udaipur',
        districtName: 'Udaipur'
      }
    ]);
    processTextData(benchmarkJson);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none font-mono">
      <div className="bg-[#0b1019] border border-cyan-500/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(0,229,255,0.25)]">
        {/* Header */}
        <div className="p-4 bg-[#0e1522] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-white text-sm">INGEST SOCIAL MEDIA / TELEGRAM DATASET</span>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs">
          {successCount !== null ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
              <div className="text-emerald-400 font-bold text-base">
                SUCCESSFULLY INGESTED {successCount} NEW INTERCEPTS!
              </div>
              <p className="text-slate-400">
                Data classified, SHA-256 hashed, and mapped onto the Rajasthan tactical grid.
              </p>
            </div>
          ) : (
            <>
              {/* Drag & Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-cyan-400 bg-cyan-950/40'
                    : 'border-slate-700 hover:border-cyan-500/50 bg-[#070b12]'
                }`}
              >
                <FileText className="w-10 h-10 text-cyan-400/80 mx-auto mb-3" />
                <p className="text-slate-200 font-bold mb-1">
                  DRAG & DROP CSV OR JSON CHAT EXPORT
                </p>
                <p className="text-slate-500 text-[11px] mb-4">
                  Supports Telegram desktop chat export (.json) or custom CSV formats
                </p>

                <label className="inline-block bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-lg font-bold cursor-pointer transition-all">
                  <span>BROWSE LOCAL FILE</span>
                  <input
                    type="file"
                    accept=".json,.csv,.txt"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Benchmark One-Click Ingestion */}
              <div className="pt-2">
                <button
                  onClick={loadBenchmarkData}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 bg-[#121a26] hover:bg-[#162334] border border-cyan-500/50 text-cyan-400 p-3 rounded-xl font-bold transition-all"
                >
                  <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span>LOAD R4C BENCHMARK DATASET (ONE-CLICK)</span>
                </button>
                <p className="text-[10px] text-slate-500 text-center mt-2">
                  Injects 4 authentic test intercepts spanning Sikar, Jaipur, Bikaner, and Udaipur.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
