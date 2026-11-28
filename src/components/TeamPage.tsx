import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Github, Linkedin, Mail, ShieldCheck } from 'lucide-react';
import { TEAM, TEAM_NAME, type TeamMember } from '../data/team';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

// Chamfered "agency badge" outline: top-left and bottom-right corners cut.
const CHAMFER = 'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)';
const BANNER = 'polygon(14px 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 14px 100%, 0 50%)';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

const PlaceholderAvatar: React.FC<{ name: string }> = ({ name }) => {
  const gid = `silhouette-${React.useId().replace(/:/g, '')}`;
  return (
  <div role="img" aria-label={`Placeholder portrait for ${name}`} className="absolute inset-0 flex items-end justify-center">
    <svg viewBox="0 0 200 250" className="w-[78%] h-auto text-slate-600/70" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#334155" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="92" r="44" fill={`url(#${gid})`} />
      <path d="M18 250c0-58 37-98 82-98s82 40 82 98z" fill={`url(#${gid})`} />
    </svg>
    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[85%] font-display text-2xl font-semibold tracking-wider text-cyan-200/80">
      {initials(name)}
    </span>
  </div>
  );
};

const Portrait: React.FC<{ member: TeamMember }> = ({ member }) => {
  const [failed, setFailed] = useState(false);
  const src = member.photo ? `/team/${member.photo}` : '';
  return (
    <div className="relative aspect-[4/5] overflow-hidden bg-[radial-gradient(ellipse_at_50%_30%,rgba(0,229,255,0.10),transparent_65%),linear-gradient(180deg,#0E1626,#070A10)]">
      {src && !failed ? (
        <img
          src={src}
          alt={`Portrait of ${member.name}`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <PlaceholderAvatar name={member.name} />
      )}
      {/* scanlines + corner brackets */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[repeating-linear-gradient(0deg,#fff_0px,#fff_1px,transparent_1px,transparent_4px)]"
      />
      <span aria-hidden="true" className="absolute top-3 right-3 w-4 h-4 border-t border-r border-cyan-300/60" />
      <span aria-hidden="true" className="absolute bottom-3 left-3 w-4 h-4 border-b border-l border-cyan-300/60" />
    </div>
  );
};

const ContactPill: React.FC<{ member: TeamMember }> = ({ member }) => {
  const linkCls =
    'flex items-center justify-center w-7 h-7 rounded-full text-slate-300 hover:text-cyan-200 hover:bg-cyan-400/10 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70';
  const emptyCls = 'flex items-center justify-center w-7 h-7 rounded-full text-slate-700';
  return (
    <div className="mt-4 flex items-center gap-1 rounded-full border border-white/[0.1] bg-black/30 pl-3 pr-1 py-1">
      <Mail aria-hidden="true" className="w-3.5 h-3.5 shrink-0 text-cyan-300/70" />
      {member.email ? (
        <a
          href={`mailto:${member.email}`}
          className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-300 hover:text-cyan-200 outline-none focus-visible:underline"
        >
          {member.email}
        </a>
      ) : (
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-500">Email to be added</span>
      )}
      {member.github ? (
        <a href={member.github} target="_blank" rel="noreferrer" aria-label={`${member.name} on GitHub`} className={linkCls}>
          <Github aria-hidden="true" className="w-3.5 h-3.5" />
        </a>
      ) : (
        <span className={emptyCls} title="GitHub not added yet">
          <Github aria-hidden="true" className="w-3.5 h-3.5" />
          <span className="sr-only">GitHub not added yet</span>
        </span>
      )}
      {member.linkedin ? (
        <a href={member.linkedin} target="_blank" rel="noreferrer" aria-label={`${member.name} on LinkedIn`} className={linkCls}>
          <Linkedin aria-hidden="true" className="w-3.5 h-3.5" />
        </a>
      ) : (
        <span className={emptyCls} title="LinkedIn not added yet">
          <Linkedin aria-hidden="true" className="w-3.5 h-3.5" />
          <span className="sr-only">LinkedIn not added yet</span>
        </span>
      )}
    </div>
  );
};

const TeamCard: React.FC<{ member: TeamMember; index: number; reduced: boolean }> = ({ member, index, reduced }) => {
  const roleMissing = !member.role || member.role.trim().toUpperCase() === 'TODO';
  return (
    <motion.li
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28 }}
      whileInView={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: reduced ? 0.2 : 0.55, ease: 'easeOut', delay: reduced ? 0 : index * 0.08 }}
      className="list-none"
    >
      <article
        aria-labelledby={`member-${member.id}`}
        className="team-card group h-full transition-[transform,filter] duration-300 ease-out hover:-translate-y-1.5 hover:[filter:drop-shadow(0_0_18px_rgba(0,229,255,0.28))] focus-within:[filter:drop-shadow(0_0_18px_rgba(0,229,255,0.28))]"
      >
        {/* 1px gradient border, then the card body, both chamfered */}
        <div className="h-full p-px bg-gradient-to-b from-cyan-300/55 via-white/[0.08] to-cyan-300/30" style={{ clipPath: CHAMFER }}>
          <div className="relative h-full bg-[#0A0F19]" style={{ clipPath: CHAMFER }}>
            <div className="flex items-center justify-between px-4 pt-3 pb-2 font-mono text-[9px] tracking-[0.25em] text-slate-500">
              <span>V3S · {String(index + 1).padStart(2, '0')}</span>
              <ShieldCheck aria-hidden="true" className="w-3.5 h-3.5 text-cyan-300/60" />
            </div>
            <div className="mx-3 overflow-hidden rounded-sm border border-white/[0.06]">
              <Portrait member={member} />
            </div>
            <div className="px-4 pt-4 pb-5">
              <h3 id={`member-${member.id}`} className="font-display text-lg font-semibold text-white leading-tight">
                {member.name}
              </h3>
              <p
                className={`mt-1 font-mono text-[11px] tracking-wider uppercase ${
                  roleMissing ? 'text-slate-500 normal-case tracking-normal italic' : 'text-cyan-300/85'
                }`}
              >
                {roleMissing ? 'Role to be added' : member.role}
              </p>
              <ContactPill member={member} />
            </div>
            <span aria-hidden="true" className="absolute left-0 top-[18px] bottom-6 w-px bg-gradient-to-b from-cyan-300/50 to-transparent" />
          </div>
        </div>
      </article>
    </motion.li>
  );
};

export const TeamPage: React.FC = () => {
  const reduced = usePrefersReducedMotion();
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070A10] text-slate-100 pb-[calc(var(--dock-clearance)+32px)]">
      {/* backdrop: faint grid + accent glow (no external images) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05] bg-[linear-gradient(rgba(255,255,255,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.9)_1px,transparent_1px)] bg-[size:48px_48px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full bg-cyan-500/[0.08] blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-16 sm:pt-20">
        <motion.header
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-center"
        >
          <p className="font-mono text-[10px] sm:text-[11px] tracking-[0.35em] text-cyan-300/70">PRAHARI // PERSONNEL</p>
          <h1 className="mt-3 font-display text-4xl sm:text-6xl font-bold tracking-tight text-white">
            Meet the <span className="text-cyan-300 [text-shadow:0_0_28px_rgba(0,229,255,0.35)]">Team</span>
          </h1>
          <div className="mt-6 flex justify-center">
            <div className="p-px bg-gradient-to-r from-cyan-300/20 via-cyan-300/70 to-cyan-300/20" style={{ clipPath: BANNER }}>
              <div
                className="flex items-center gap-3 bg-[#0B1322] px-10 sm:px-14 py-2.5 font-display text-lg sm:text-xl font-semibold tracking-[0.18em] text-cyan-100"
                style={{ clipPath: BANNER }}
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#00E5FF]" />
                {TEAM_NAME}
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#00E5FF]" />
              </div>
            </div>
          </div>
        </motion.header>

        <ul aria-label={`${TEAM_NAME} members`} className="mt-12 sm:mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-7">
          {TEAM.map((m, i) => (
            <TeamCard key={m.id} member={m} index={i} reduced={reduced} />
          ))}
        </ul>

        <motion.section
          aria-label="About Prahari"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-14 mx-auto max-w-2xl text-center"
        >
          <div aria-hidden="true" className="mx-auto mb-5 h-px w-40 bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
          <p className="text-sm sm:text-[15px] leading-relaxed text-slate-400">
            <span className="font-semibold text-slate-200">About Prahari:</span> a Telegram &amp; social media illegal
            trade monitor, built by {TEAM_NAME} for the R4C Hackathon 2026 (problem statement PS02).
          </p>
        </motion.section>
      </div>
    </main>
  );
};
