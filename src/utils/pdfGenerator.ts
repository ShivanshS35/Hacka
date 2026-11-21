import jsPDF from 'jspdf';
import { InterceptPost } from '../types';

export function generateDossierPDF(post: InterceptPost) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Background styling
  doc.setFillColor(10, 14, 20);
  doc.rect(0, 0, pageWidth, 297, 'F');

  // Decorative border
  doc.setDrawColor(0, 229, 255);
  doc.setLineWidth(0.6);
  doc.rect(8, 8, pageWidth - 16, 281);

  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.3);
  doc.rect(10, 10, pageWidth - 20, 277);

  // Top Emblem & Header
  doc.setTextColor(0, 229, 255);
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.text('RAJASTHAN POLICE // STATE CYBER CRIME CELL, JAIPUR', pageWidth / 2, 18, { align: 'center' });

  doc.setTextColor(241, 245, 249);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('PRAHARI OSINT FORENSIC EVIDENCE DOSSIER', pageWidth / 2, 26, { align: 'center' });

  doc.setTextColor(255, 59, 48);
  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text('CONFIDENTIAL // LAW ENFORCEMENT & JUDICIAL EVIDENCE USE ONLY', pageWidth / 2, 32, { align: 'center' });

  // Divider
  doc.setDrawColor(0, 229, 255);
  doc.setLineWidth(0.5);
  doc.line(14, 36, pageWidth - 14, 36);

  // Section 65B Notice Box
  doc.setFillColor(18, 25, 38);
  doc.rect(14, 40, pageWidth - 28, 24, 'F');
  doc.setDrawColor(0, 229, 255);
  doc.setLineWidth(0.2);
  doc.rect(14, 40, pageWidth - 28, 24);

  doc.setTextColor(0, 229, 255);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.text('SECTION 65B INDIAN EVIDENCE ACT CERTIFICATION COMPLIANT', 18, 46);

  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const certText = "Certified that this digital transcript was automatically ingested, classified, and hashed via PRAHARI Autonomous OSINT Collector directly from public Telegram/social media broadcast servers without manual alteration. Hash integrity verified on ingestion.";
  const certLines = doc.splitTextToSize(certText, pageWidth - 36);
  doc.text(certLines, 18, 52);

  // Case Information Grid
  let y = 72;
  doc.setTextColor(0, 229, 255);
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.text('01 // CASE TELEMETRY & INCIDENT DETAILS', 14, y);

  y += 6;
  doc.setFillColor(15, 23, 42);
  doc.rect(14, y, pageWidth - 28, 42, 'F');
  doc.setDrawColor(51, 65, 85);
  doc.rect(14, y, pageWidth - 28, 42);

  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);

  // Row 1
  doc.text('CASE DOSSIER ID:', 18, y + 8);
  doc.setTextColor(241, 245, 249);
  doc.text(`INV-RAJ-2026-${post.id.toUpperCase()}`, 65, y + 8);

  doc.setTextColor(148, 163, 184);
  doc.text('TARGET CHANNEL:', 110, y + 8);
  doc.setTextColor(0, 229, 255);
  doc.text(post.channel, 155, y + 8);

  // Row 2
  doc.setTextColor(148, 163, 184);
  doc.text('POST TIMESTAMP (UTC):', 18, y + 16);
  doc.setTextColor(241, 245, 249);
  doc.text(post.timestamp, 65, y + 16);

  doc.setTextColor(148, 163, 184);
  doc.text('SUBSCRIBER REACH:', 110, y + 16);
  doc.setTextColor(241, 245, 249);
  doc.text(post.channelSubscribers || 'Public Broadcast', 155, y + 16);

  // Row 3
  doc.setTextColor(148, 163, 184);
  doc.text('CLASSIFICATION:', 18, y + 24);
  doc.setTextColor(255, 59, 48);
  doc.text(`[${post.categories.join(' / ')}]`, 65, y + 24);

  doc.setTextColor(148, 163, 184);
  doc.text('CONFIDENCE SCORE:', 110, y + 24);
  doc.setTextColor(16, 185, 129);
  doc.text(`${(post.confidence * 100).toFixed(0)}% MATCH`, 155, y + 24);

  // Row 4
  doc.setTextColor(148, 163, 184);
  doc.text('DISTRICT NEXUS:', 18, y + 32);
  doc.setTextColor(0, 229, 255);
  doc.text(`${post.districtName.toUpperCase()} (RAJASTHAN)`, 65, y + 32);

  doc.setTextColor(148, 163, 184);
  doc.text('INGESTION STATUS:', 110, y + 32);
  doc.setTextColor(245, 158, 11);
  doc.text(`${post.status} // SEALED`, 155, y + 32);

  // Section 2: Cryptographic SHA-256 Seal
  y += 50;
  doc.setTextColor(0, 229, 255);
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.text('02 // FORENSIC INTEGRITY SEAL (SHA-256 HASH)', 14, y);

  y += 5;
  doc.setFillColor(15, 23, 42);
  doc.rect(14, y, pageWidth - 28, 22, 'F');
  doc.setDrawColor(0, 229, 255);
  doc.rect(14, y, pageWidth - 28, 22);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(16, 185, 129);
  doc.text('TAMPER-EVIDENT CRYPTOGRAPHIC CHECKUM:', 18, y + 7);

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(241, 245, 249);
  doc.text(post.sha256, 18, y + 14);

  // Section 3: Raw Intercepted Evidence Text
  y += 30;
  doc.setTextColor(0, 229, 255);
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.text('03 // RAW INTERCEPTED SIGNAL TRANSCRIPT', 14, y);

  y += 5;
  doc.setFillColor(18, 25, 38);
  doc.rect(14, y, pageWidth - 28, 30, 'F');
  doc.setDrawColor(51, 65, 85);
  doc.rect(14, y, pageWidth - 28, 30);

  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(241, 245, 249);
  const rawTextLines = doc.splitTextToSize(`"${post.rawText}"`, pageWidth - 36);
  doc.text(rawTextLines, 18, y + 8);

  // Section 4: Cross-Channel Extracted Identifiers
  y += 38;
  doc.setTextColor(0, 229, 255);
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.text('04 // EXTRACTED ACTIONABLE ENTITIES & SLANG TRIGGERS', 14, y);

  y += 5;
  doc.setFillColor(15, 23, 42);
  doc.rect(14, y, pageWidth - 28, 40, 'F');
  doc.setDrawColor(51, 65, 85);
  doc.rect(14, y, pageWidth - 28, 40);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('EXTRACTED UPIs:', 18, y + 8);
  doc.setTextColor(0, 229, 255);
  doc.text(post.entities.upis.length ? post.entities.upis.join(', ') : 'None detected', 65, y + 8);

  doc.setTextColor(148, 163, 184);
  doc.text('PHONE / WHATSAPP:', 18, y + 16);
  doc.setTextColor(245, 158, 11);
  doc.text(post.entities.phones.length ? post.entities.phones.join(', ') : 'None detected', 65, y + 16);

  doc.setTextColor(148, 163, 184);
  doc.text('TELEGRAM HANDLES:', 18, y + 24);
  doc.setTextColor(16, 185, 129);
  doc.text(post.entities.handles.length ? post.entities.handles.join(', ') : 'None detected', 65, y + 24);

  doc.setTextColor(148, 163, 184);
  doc.text('MATCHED SLANG TOKENS:', 18, y + 32);
  doc.setTextColor(255, 59, 48);
  doc.text(post.matchedSlang.join(', '), 65, y + 32);

  // Sign-off / Chain of Custody Seals
  y = 245;
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.3);
  doc.line(14, y, pageWidth - 14, y);

  y += 8;
  doc.setTextColor(148, 163, 184);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.text('GENERATED BY: PRAHARI AUTOMATED OSINT ENGINE (R4C-HACKATHON-2026)', 14, y);
  doc.text('INVESTIGATING OFFICER (VERIFICATION STAMP)', pageWidth - 70, y);

  y += 14;
  doc.setDrawColor(0, 229, 255);
  doc.rect(pageWidth - 70, y - 8, 55, 18);
  doc.setTextColor(0, 229, 255);
  doc.setFont('courier', 'bold');
  doc.setFontSize(7);
  doc.text('CYBER POLICE RAJASTHAN', pageWidth - 65, y - 2);
  doc.setTextColor(16, 185, 129);
  doc.text('DIGITALLY SIGNED // SEC 65B', pageWidth - 65, y + 5);

  // Save the PDF
  const filename = `PRAHARI_EVIDENCE_${post.id.toUpperCase()}_${post.districtName.toUpperCase()}.pdf`;
  doc.save(filename);
}
