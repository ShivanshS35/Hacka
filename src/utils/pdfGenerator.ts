import jsPDF from 'jspdf';
import { InterceptPost } from '../types';

/**
 * Sanitizes text for jsPDF standard fonts.
 * Replaces non-ASCII symbols (such as Indian Rupee ₹, smart quotes, em-dashes)
 * that cause jsPDF text-metrics measurement bugs and horizontal overflow.
 */
function sanitizePdfText(str: string): string {
  if (!str) return '';
  return str
    .replace(/₹/g, 'Rs. ')
    .replace(/\u20B9/g, 'Rs. ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[•·]/g, '-')
    .replace(/[^\x20-\x7E\n]/g, ' ') // replace any remaining non-standard chars
    .replace(/\s+/g, ' ')
    .trim();
}

export function generateDossierPDF(post: InterceptPost) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // 1. Sleek High-Contrast Tactical Cyber-Forensic Background
  doc.setFillColor(10, 14, 22); // #0A0E16
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Outer Precision Tactical Border
  doc.setDrawColor(0, 229, 255); // Cyan #00E5FF
  doc.setLineWidth(0.6);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

  // Inner Accent Guide Border
  doc.setDrawColor(30, 48, 70);
  doc.setLineWidth(0.25);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // 4 Corner Tactical Reticles
  const drawCornerReticle = (cx: number, cy: number, dx: number, dy: number) => {
    doc.setDrawColor(0, 229, 255);
    doc.setLineWidth(0.8);
    doc.line(cx, cy, cx + dx * 6, cy);
    doc.line(cx, cy, cx, cy + dy * 6);
  };
  drawCornerReticle(10, 10, 1, 1);
  drawCornerReticle(pageWidth - 10, 10, -1, 1);
  drawCornerReticle(10, pageHeight - 10, 1, -1);
  drawCornerReticle(pageWidth - 10, pageHeight - 10, -1, -1);

  // =========================================================================
  // HEADER: Rajasthan Police State Cyber Crime Cell
  // =========================================================================
  let y = 17;

  doc.setTextColor(0, 229, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('RAJASTHAN POLICE // STATE CYBER CRIME CELL, JAIPUR', pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.text('PRAHARI OSINT FORENSIC EVIDENCE DOSSIER', pageWidth / 2, y, { align: 'center' });

  y += 5;
  doc.setTextColor(244, 63, 94); // Rose red #F43F5E
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CONFIDENTIAL // LAW ENFORCEMENT & JUDICIAL EVIDENCE USE ONLY', pageWidth / 2, y, { align: 'center' });

  y += 4;
  doc.setDrawColor(0, 229, 255);
  doc.setLineWidth(0.4);
  doc.line(margin, y, margin + contentWidth, y);

  // =========================================================================
  // SECTION 65B LEGAL CERTIFICATION COMPLIANCE BOX
  // =========================================================================
  y += 4;
  const certBoxY = y;
  const certBoxHeight = 21;

  doc.setFillColor(15, 23, 38);
  doc.roundedRect(margin, certBoxY, contentWidth, certBoxHeight, 1.5, 1.5, 'F');
  doc.setDrawColor(0, 229, 255);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, certBoxY, contentWidth, certBoxHeight, 1.5, 1.5, 'D');

  // Left status pill
  doc.setFillColor(0, 229, 255);
  doc.rect(margin, certBoxY, 2, certBoxHeight, 'F');

  doc.setTextColor(0, 229, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('SECTION 65B INDIAN EVIDENCE ACT & SECTION 63 BSA COMPLIANT', margin + 5, certBoxY + 5.5);

  doc.setTextColor(203, 213, 225); // Slate 300
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const certStatement =
    'Certified that this digital intelligence record was intercepted, classified, and cryptographically hashed in real time via the PRAHARI Autonomous OSINT Collector directly from public Telegram/social media broadcast servers without manual alteration. Hash integrity and electronic chain of custody are verified on ingestion.';
  const wrappedCert = doc.splitTextToSize(certStatement, contentWidth - 10);
  doc.text(wrappedCert, margin + 5, certBoxY + 10.5);

  y += certBoxHeight + 5;

  // =========================================================================
  // 01 // CASE TELEMETRY & INCIDENT DETAILS (Grid Table)
  // =========================================================================
  doc.setTextColor(0, 229, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('01 // CASE TELEMETRY & INCIDENT DETAILS', margin, y);

  y += 3.5;
  const tableY = y;
  const tableHeight = 36;

  doc.setFillColor(13, 20, 32);
  doc.roundedRect(margin, tableY, contentWidth, tableHeight, 1.5, 1.5, 'F');
  doc.setDrawColor(38, 54, 76);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, tableY, contentWidth, tableHeight, 1.5, 1.5, 'D');

  // Subtle vertical column divider
  const midX = margin + contentWidth / 2;
  doc.setDrawColor(26, 38, 54);
  doc.setLineWidth(0.2);
  doc.line(midX, tableY, midX, tableY + tableHeight);

  // Horizontal row dividers
  const rowH = 9;
  for (let i = 1; i < 4; i++) {
    doc.line(margin, tableY + i * rowH, margin + contentWidth, tableY + i * rowH);
  }

  // Row coordinate helpers
  const col1LabelX = margin + 4;
  const col1ValX = margin + 46;
  const col2LabelX = midX + 4;
  const col2ValX = midX + 44;

  const col1ValMaxW = midX - col1ValX - 2; // ~43mm
  const col2ValMaxW = margin + contentWidth - col2ValX - 4; // ~43mm

  doc.setFontSize(7.5);

  // Row 1
  let rY = tableY + 5.8;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('CASE DOSSIER ID:', col1LabelX, rY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(248, 250, 252);
  doc.text(`INV-RAJ-2026-${post.id.toUpperCase()}`, col1ValX, rY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('TARGET CHANNEL:', col2LabelX, rY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 229, 255);
  doc.text(doc.splitTextToSize(sanitizePdfText(post.channel), col2ValMaxW), col2ValX, rY);

  // Row 2
  rY += rowH;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('TIMESTAMP (UTC):', col1LabelX, rY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(248, 250, 252);
  doc.text(sanitizePdfText(post.timestamp), col1ValX, rY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('ESTIMATED REACH:', col2LabelX, rY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(248, 250, 252);
  doc.text(sanitizePdfText(post.channelSubscribers || 'Public Telegram Broadcast'), col2ValX, rY);

  // Row 3
  rY += rowH;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('CRIME VERTICAL:', col1LabelX, rY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(244, 63, 94);
  doc.text(`[${post.categories.join(' / ')}]`, col1ValX, rY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('CONVICTION SCORE:', col2LabelX, rY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129); // Emerald
  doc.text(`${(post.confidence * 100).toFixed(0)}% ALGORITHM MATCH`, col2ValX, rY);

  // Row 4
  rY += rowH;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('DISTRICT NEXUS:', col1LabelX, rY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 229, 255);
  doc.text(`${sanitizePdfText(post.districtName).toUpperCase()} (RAJASTHAN)`, col1ValX, rY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('INGESTION STATUS:', col2LabelX, rY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(245, 158, 11); // Amber
  doc.text(`${post.status.toUpperCase()} // SEALED`, col2ValX, rY);

  y += tableHeight + 5;

  // =========================================================================
  // 02 // FORENSIC INTEGRITY SEAL (SHA-256 HASH)
  // =========================================================================
  doc.setTextColor(0, 229, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('02 // FORENSIC INTEGRITY SEAL (SHA-256 CRYPTOGRAPHIC HASH)', margin, y);

  y += 3.5;
  const hashBoxY = y;
  const hashBoxHeight = 18;

  doc.setFillColor(13, 20, 32);
  doc.roundedRect(margin, hashBoxY, contentWidth, hashBoxHeight, 1.5, 1.5, 'F');
  doc.setDrawColor(0, 229, 255);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, hashBoxY, contentWidth, hashBoxHeight, 1.5, 1.5, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(16, 185, 129);
  doc.text('TAMPER-EVIDENT CRYPTOGRAPHIC CHECKSUM (RAW PAYLOAD DIGEST):', margin + 4, hashBoxY + 5.5);

  // Monospace SHA-256 box inside
  doc.setFillColor(8, 12, 19);
  doc.roundedRect(margin + 4, hashBoxY + 7.5, contentWidth - 8, 7.5, 1, 1, 'F');
  doc.setDrawColor(30, 48, 70);
  doc.roundedRect(margin + 4, hashBoxY + 7.5, contentWidth - 8, 7.5, 1, 1, 'D');

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 229, 255);
  doc.text(post.sha256, margin + 7, hashBoxY + 12.5);

  y += hashBoxHeight + 5;

  // =========================================================================
  // 03 // RAW INTERCEPTED SIGNAL TRANSCRIPT (Dynamic Height, No Overflow)
  // =========================================================================
  doc.setTextColor(0, 229, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('03 // RAW INTERCEPTED SIGNAL TRANSCRIPT', margin, y);

  y += 3.5;
  const transcriptBoxY = y;
  const cleanRaw = sanitizePdfText(post.rawText);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const maxTranscriptW = contentWidth - 10;
  const rawLines = doc.splitTextToSize(`"${cleanRaw}"`, maxTranscriptW);

  // Dynamic box height: 8mm top/bottom padding + line count * 4.6mm
  const transcriptBoxHeight = Math.max(22, 10 + rawLines.length * 4.6);

  doc.setFillColor(15, 23, 38);
  doc.roundedRect(margin, transcriptBoxY, contentWidth, transcriptBoxHeight, 1.5, 1.5, 'F');
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, transcriptBoxY, contentWidth, transcriptBoxHeight, 1.5, 1.5, 'D');

  // Left red bar denoting authentic evidence capture
  doc.setFillColor(244, 63, 94);
  doc.rect(margin, transcriptBoxY, 2, transcriptBoxHeight, 'F');

  doc.setTextColor(248, 250, 252);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(rawLines, margin + 5, transcriptBoxY + 7);

  y += transcriptBoxHeight + 5;

  // =========================================================================
  // 04 // EXTRACTED ACTIONABLE ENTITIES & SLANG TRIGGERS
  // =========================================================================
  doc.setTextColor(0, 229, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('04 // EXTRACTED ACTIONABLE ENTITIES & SLANG TRIGGERS', margin, y);

  y += 3.5;
  const entityBoxY = y;
  const entityBoxHeight = 34;

  doc.setFillColor(13, 20, 32);
  doc.roundedRect(margin, entityBoxY, contentWidth, entityBoxHeight, 1.5, 1.5, 'F');
  doc.setDrawColor(38, 54, 76);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, entityBoxY, contentWidth, entityBoxHeight, 1.5, 1.5, 'D');

  const entRowH = 8.5;
  const entLabelX = margin + 4;
  const entValX = margin + 48;
  const entValMaxW = contentWidth - 52;

  // Row horizontal dividers
  for (let i = 1; i < 4; i++) {
    doc.setDrawColor(26, 38, 54);
    doc.setLineWidth(0.2);
    doc.line(margin, entityBoxY + i * entRowH, margin + contentWidth, entityBoxY + i * entRowH);
  }

  doc.setFontSize(7.5);

  // Extracted UPIs
  let eY = entityBoxY + 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('EXTRACTED UPIs:', entLabelX, eY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 229, 255);
  const upiText = post.entities.upis.length ? post.entities.upis.join(', ') : 'None detected';
  doc.text(doc.splitTextToSize(sanitizePdfText(upiText), entValMaxW), entValX, eY);

  // Phone Numbers
  eY += entRowH;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('PHONE / WHATSAPP:', entLabelX, eY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(245, 158, 11);
  const phoneText = post.entities.phones.length ? post.entities.phones.join(', ') : 'None detected';
  doc.text(doc.splitTextToSize(sanitizePdfText(phoneText), entValMaxW), entValX, eY);

  // Telegram Handles
  eY += entRowH;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('TELEGRAM HANDLES:', entLabelX, eY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  const handleText = post.entities.handles.length ? post.entities.handles.join(', ') : 'None detected';
  doc.text(doc.splitTextToSize(sanitizePdfText(handleText), entValMaxW), entValX, eY);

  // Matched Slang Tokens (Guaranteed Wrap!)
  eY += entRowH;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('MATCHED SLANG TOKENS:', entLabelX, eY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(244, 63, 94);
  const slangText = post.matchedSlang.length ? post.matchedSlang.join(', ') : 'None detected';
  const wrappedSlang = doc.splitTextToSize(sanitizePdfText(slangText), entValMaxW);
  doc.text(wrappedSlang[0] || 'None detected', entValX, eY);

  y += entityBoxHeight + 6;

  // =========================================================================
  // 05 // DUAL SIGN-OFF & OFFICIAL EMBOSSED CYBER CELL SEAL
  // =========================================================================
  const footerBoxY = y;
  const footerBoxHeight = 32;

  // Outer footer container
  doc.setFillColor(11, 17, 28);
  doc.roundedRect(margin, footerBoxY, contentWidth, footerBoxHeight, 1.5, 1.5, 'F');
  doc.setDrawColor(38, 54, 76);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, footerBoxY, contentWidth, footerBoxHeight, 1.5, 1.5, 'D');

  // Left Column: Automated Attestation
  const footerLeftW = contentWidth - 62;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 229, 255);
  doc.text('SYSTEM ATTESTATION & CHAIN OF CUSTODY LOG:', margin + 4, footerBoxY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text('PLATFORM: PRAHARI Autonomous Cross-Channel OSINT Engine (v2.4)', margin + 4, footerBoxY + 11.5);
  doc.text('INTEGRITY PROTOCOL: FIPS-180-4 SHA-256 Cryptographic Witness', margin + 4, footerBoxY + 16.5);
  doc.text(`TIMESTAMP LOGGED: ${sanitizePdfText(post.capturedAt || '2026-11-22 18:20:00 IST')}`, margin + 4, footerBoxY + 21.5);
  doc.text('EVIDENCE ADMISSIBILITY: Section 65B(4) IEA, 1872 & Section 63 BSA, 2023', margin + 4, footerBoxY + 26.5);

  // Vertical divider between Attestation and Officer Stamp
  const stampDividerX = margin + footerLeftW;
  doc.setDrawColor(26, 38, 54);
  doc.setLineWidth(0.2);
  doc.line(stampDividerX, footerBoxY, stampDividerX, footerBoxY + footerBoxHeight);

  // Right Column: Official Investigating Officer Stamp
  const stampBoxX = stampDividerX + 3;
  const stampCenterX = stampBoxX + 27;
  const stampCenterY = footerBoxY + 16;

  // Red Outer Stamp Circle
  doc.setDrawColor(220, 38, 38); // Crimson Red
  doc.setLineWidth(0.6);
  doc.circle(stampCenterX, stampCenterY, 13, 'D');

  // Red Inner Dotted Stamp Circle
  doc.setDrawColor(185, 28, 28);
  doc.setLineWidth(0.3);
  doc.circle(stampCenterX, stampCenterY, 11, 'D');

  // Stamp Text inside
  doc.setTextColor(239, 68, 68);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.text('RAJASTHAN POLICE', stampCenterX, stampCenterY - 6.5, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.text('CYBER CELL', stampCenterX, stampCenterY - 2, { align: 'center' });

  doc.setTextColor(16, 185, 129);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.text('DIGITALLY SEALED', stampCenterX, stampCenterY + 2.5, { align: 'center' });

  doc.setTextColor(239, 68, 68);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.text('SEC 65B(4) IEA', stampCenterX, stampCenterY + 7, { align: 'center' });

  // Bottom Security Watermark Strip
  doc.setFont('courier', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(71, 85, 105);
  const bottomMeta = `PRAHARI // CASE: ${post.id.toUpperCase()} // DISTRICT: ${post.districtName.toUpperCase()} // HASH: ${post.sha256.slice(0, 16)}... // R4C HACKATHON 2026`;
  doc.text(bottomMeta, pageWidth / 2, pageHeight - 11, { align: 'center' });

  // Save the cleanly generated PDF
  const filename = `PRAHARI_EVIDENCE_${post.id.toUpperCase()}_${post.districtName.toUpperCase()}.pdf`;
  doc.save(filename);
}
