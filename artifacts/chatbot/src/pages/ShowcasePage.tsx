import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT_PINK = "#b5517a";
const ACCENT_GOLD = "#c9a45a";
const WA_URL = "https://wa.me/2348056683398";

// ── Shared animation helpers ──────────────────────────────────────────────────

const ease = [0.22, 1, 0.36, 1] as const;

const sceneWrap = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.45, ease } },
  exit: { opacity: 0, transition: { duration: 0.35, ease } },
};

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, delay, ease } },
  } as const;
}

// ── Scene 0 — Hook ────────────────────────────────────────────────────────────

function SceneHook() {
  return (
    <motion.div {...sceneWrap} className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.35, 0.65, 0.35] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ background: "radial-gradient(ellipse 65% 45% at 50% 60%, rgba(181,81,122,0.28) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 space-y-5">
        <motion.p
          {...fadeUp(0.2)}
          className="text-[12px] font-bold tracking-[0.2em] uppercase"
          style={{ color: `${ACCENT_PINK}99` }}
        >
          The reality for most businesses
        </motion.p>

        <motion.h1
          {...fadeUp(0.55)}
          className="text-[32px] font-bold leading-tight text-white"
          style={{ fontFamily: "Syne, sans-serif" }}
        >
          Every missed message<br />
          <span style={{ color: ACCENT_PINK }}>is a missed sale.</span>
        </motion.h1>

        <motion.p {...fadeUp(0.9)} className="text-[15px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
          You're busy. Customers give up.<br />
          They go to someone who replies.
        </motion.p>

        <motion.div {...fadeUp(1.3)} className="flex items-center justify-center gap-2 pt-3">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: `${ACCENT_PINK}70` }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, delay: i * 0.3, repeat: Infinity }}
            />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Scene 1 — Problem (missed messages) ───────────────────────────────────────

const MISSED = [
  { from: "Blessing A.", msg: "Hi! How much for wash & deep condition?", ago: "3h ago" },
  { from: "Chisom N.",   msg: "Are you available this Saturday? 🙏",      ago: "2h ago" },
  { from: "Funmi O.",    msg: "What's the price for a full revamp?",       ago: "47m ago" },
  { from: "Tolu B.",     msg: "Do you restyle wigs you didn't make?",      ago: "2m ago" },
];

function SceneProblem() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const timers = MISSED.map((_, i) =>
      setTimeout(() => setVisible(i + 1), 350 + i * 550),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div {...sceneWrap} className="absolute inset-0 flex flex-col px-5 pt-12 pb-8">
      <motion.div {...fadeUp(0)} className="mb-5 text-center">
        <span className="text-[11px] font-bold tracking-[0.18em] uppercase px-3 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
          Before BotForge
        </span>
      </motion.div>

      <motion.p {...fadeUp(0.15)} className="text-center text-[13px] mb-6" style={{ color: "rgba(255,255,255,0.35)" }}>
        Unread messages. No replies. Lost customers.
      </motion.p>

      <div className="flex flex-col gap-3">
        {MISSED.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 32 }}
            animate={visible > i ? { opacity: 1, x: 0 } : { opacity: 0, x: 32 }}
            transition={{ duration: 0.38, ease }}
            className="relative flex items-start gap-3 px-4 py-3 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold flex-shrink-0"
              style={{ background: `${ACCENT_PINK}18`, border: `1px solid ${ACCENT_PINK}30`, color: ACCENT_PINK }}
            >
              {m.from[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[13px] font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>{m.from}</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.28)" }}>{m.ago}</p>
              </div>
              <p className="text-[12px] leading-snug truncate" style={{ color: "rgba(255,255,255,0.38)" }}>{m.msg}</p>
            </div>

            <motion.div
              initial={{ scale: 0 }}
              animate={visible > i ? { scale: 1 } : { scale: 0 }}
              transition={{ delay: 0.18, type: "spring", stiffness: 320 }}
              className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"
            >
              <span className="text-[9px] text-white font-bold">1</span>
            </motion.div>
          </motion.div>
        ))}
      </div>

      <motion.p
        className="mt-auto text-center text-[12px] italic pt-5"
        style={{ color: "rgba(248,113,113,0.65)" }}
        initial={{ opacity: 0 }}
        animate={visible >= MISSED.length ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6 }}
      >
        4 customers waiting. Zero replies. All gone.
      </motion.p>
    </motion.div>
  );
}

// ── Scene 2 — BotForge intro ──────────────────────────────────────────────────

function SceneIntro() {
  return (
    <motion.div {...sceneWrap} className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        style={{ background: "radial-gradient(ellipse 75% 55% at 50% 50%, rgba(124,58,237,0.22) 0%, rgba(181,81,122,0.12) 60%, transparent 85%)" }}
      />

      <div className="relative z-10 flex flex-col items-center space-y-5">
        <motion.div {...fadeUp(0.1)}>
          <div
            className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center text-4xl mb-4"
            style={{
              background: "linear-gradient(135deg, rgba(124,58,237,0.28) 0%, rgba(181,81,122,0.18) 100%)",
              border: "1px solid rgba(139,92,246,0.32)",
              boxShadow: "0 0 40px rgba(124,58,237,0.2)",
            }}
          >
            ⚙️
          </div>
          <h1 className="text-[40px] font-bold text-white tracking-tight" style={{ fontFamily: "Syne, sans-serif" }}>
            BotForge
          </h1>
        </motion.div>

        <motion.p
          {...fadeUp(0.45)}
          className="text-[19px] font-semibold leading-snug"
          style={{ fontFamily: "Syne, sans-serif", color: "rgba(255,255,255,0.9)" }}
        >
          Your AI receptionist.<br />
          <span style={{ color: "#a78bfa" }}>That never sleeps.</span>
        </motion.p>

        <motion.p {...fadeUp(0.72)} className="text-[13px] leading-relaxed max-w-[260px]" style={{ color: "rgba(255,255,255,0.42)" }}>
          Instantly answers customers, captures their details, and hands them off to WhatsApp — all automatically.
        </motion.p>

        <motion.div {...fadeUp(1.0)} className="flex flex-wrap gap-2 justify-center pt-1">
          {["Always online", "Captures leads", "WhatsApp handoff"].map((f) => (
            <span
              key={f}
              className="text-[11px] px-3 py-1 rounded-full"
              style={{ border: "1px solid rgba(139,92,246,0.32)", color: "rgba(167,139,250,0.8)", background: "rgba(124,58,237,0.1)" }}
            >
              {f}
            </span>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Scene 3 — Live chat demo ──────────────────────────────────────────────────

type Bubble = { role: "user" | "bot"; text: string; delay: number };

const CHAT: Bubble[] = [
  { role: "user", text: "How much is a restyling?",                                                    delay: 600  },
  { role: "bot",  text: "Restyling starts at ₦2,500 for straight styles, ₦3,000 for curls! 💕 Want to book this weekend?", delay: 1900 },
  { role: "user", text: "Yes please, this Saturday!",                                                  delay: 3300 },
  { role: "bot",  text: "Amazing! Let me connect you with Fortune on WhatsApp 💬",                    delay: 4500 },
];

function SceneChat() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [typing, setTyping]   = useState(false);
  const [showWA, setShowWA]   = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    CHAT.forEach((b, i) => {
      if (b.role === "bot") {
        timers.push(setTimeout(() => setTyping(true), b.delay - 750));
      }
      timers.push(
        setTimeout(() => {
          setTyping(false);
          setBubbles((prev) => [...prev, b]);
        }, b.delay),
      );
      if (i === CHAT.length - 1) {
        timers.push(setTimeout(() => setShowWA(true), b.delay + 900));
      }
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div {...sceneWrap} className="absolute inset-0 flex flex-col">
      {/* Chat header */}
      <div
        className="flex-none px-4 pt-10 pb-4"
        style={{ borderBottom: `1px solid ${ACCENT_PINK}22`, background: `${ACCENT_PINK}08` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: `${ACCENT_PINK}18`, border: `1px solid ${ACCENT_PINK}30` }}
          >
            💅
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-white" style={{ fontFamily: "Syne, sans-serif" }}>
              Styled By Fortune
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.38)" }}>AI assistant online</span>
            </div>
          </div>
          <span className="text-[10px] italic" style={{ color: "rgba(167,139,250,0.6)" }}>⚡ BotForge</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden px-4 py-4 flex flex-col justify-end gap-2">
        <AnimatePresence initial={false}>
          {bubbles.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.33, ease }}
              className={`flex ${b.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2.5 text-[13px] leading-snug ${
                  b.role === "user" ? "rounded-2xl rounded-br-sm text-white" : "rounded-2xl rounded-bl-sm"
                }`}
                style={
                  b.role === "user"
                    ? { background: ACCENT_PINK }
                    : { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.88)" }
                }
              >
                {b.text}
              </div>
            </motion.div>
          ))}

          {typing && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-start"
            >
              <div
                className="px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="block w-1.5 h-1.5 rounded-full bg-white/40"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.65, delay: i * 0.14, repeat: Infinity }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* WhatsApp handoff */}
      <AnimatePresence>
        {showWA && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
            className="flex-none px-4 pb-8 pt-3"
            style={{ borderTop: `1px solid ${ACCENT_PINK}18` }}
          >
            <div
              className="w-full py-3.5 rounded-full text-center text-[13px] font-bold text-white flex items-center justify-center gap-2"
              style={{ background: ACCENT_PINK }}
            >
              💬 Continue on WhatsApp
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Scene 4 — Lead captured ───────────────────────────────────────────────────

function SceneLead() {
  return (
    <motion.div {...sceneWrap} className="absolute inset-0 flex flex-col items-center justify-center px-6">
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 65% 45% at 50% 55%, rgba(34,197,94,0.13) 0%, transparent 70%)" }}
      />

      <motion.p
        {...fadeUp(0.1)}
        className="relative z-10 text-[11px] font-bold tracking-[0.18em] uppercase mb-4"
        style={{ color: "rgba(74,222,128,0.8)" }}
      >
        What just happened
      </motion.p>

      {/* Lead card */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.25, duration: 0.5, ease }}
        className="relative z-10 w-full rounded-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(34,197,94,0.22)" }}
      >
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(34,197,94,0.09)" }}
        >
          <div className="flex items-center gap-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.65, type: "spring", stiffness: 320 }}
              className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center"
            >
              <span className="text-[10px] text-white font-bold">✓</span>
            </motion.div>
            <span className="text-[12px] font-bold text-green-400">New lead captured</span>
          </div>
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.28)" }}>just now</span>
        </div>

        <div className="px-4 py-4 space-y-3.5">
          {[
            { label: "Customer",           value: "Adaeze O.",              delay: 0.45 },
            { label: "Service interested", value: "Restyling (Curls)",      delay: 0.6  },
            { label: "Booking intent",     value: "HIGH 🔥",                delay: 0.75, highlight: true },
            { label: "From",               value: "Styled By Fortune bot",  delay: 0.9  },
          ].map((f) => (
            <motion.div key={f.label} {...fadeUp(f.delay)} className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.32)" }}>{f.label}</span>
              <span
                className={`text-[12px] font-semibold ${f.highlight ? "text-green-400" : ""}`}
                style={f.highlight ? {} : { color: "rgba(255,255,255,0.82)" }}
              >
                {f.value}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.p
        {...fadeUp(1.1)}
        className="relative z-10 text-center text-[13px] leading-relaxed mt-5"
        style={{ color: "rgba(255,255,255,0.38)" }}
      >
        No forms. No copy-pasting.<br />
        Automatically organised in your dashboard.
      </motion.p>
    </motion.div>
  );
}

// ── Scene 5 — Dashboard glimpse ───────────────────────────────────────────────

function useCountUp(target: number, durationSec: number, delaySec: number): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf: number;
    let startTs: number | null = null;
    const delayMs = delaySec * 1000;
    const durationMs = durationSec * 1000;
    const startAt = performance.now() + delayMs;

    const tick = (now: number) => {
      if (now < startAt) { raf = requestAnimationFrame(tick); return; }
      if (!startTs) startTs = now;
      const t = Math.min((now - startTs) / durationMs, 1);
      setVal(Math.round(target * t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationSec, delaySec]);
  return val;
}

const BUSINESSES = [
  { name: "Styled By Fortune",     type: "Wig salon", emoji: "💅", accent: ACCENT_PINK, leads: 29 },
  { name: "Rossy Cakes & Events",  type: "Bakery",    emoji: "🎂", accent: ACCENT_GOLD, leads: 18 },
];

function SceneDashboard() {
  const leads    = useCountUp(47,  1.2, 0.5);
  const messages = useCountUp(312, 1.4, 0.6);

  return (
    <motion.div {...sceneWrap} className="absolute inset-0 flex flex-col px-5 pt-10 pb-8">
      <motion.p
        {...fadeUp(0.05)}
        className="text-[11px] font-bold tracking-[0.18em] uppercase mb-1"
        style={{ color: "rgba(167,139,250,0.72)" }}
      >
        Your BotForge Dashboard
      </motion.p>

      <motion.h2
        {...fadeUp(0.18)}
        className="text-[24px] font-bold text-white mb-5"
        style={{ fontFamily: "Syne, sans-serif" }}
      >
        All businesses.<br />All leads. One place.
      </motion.h2>

      {/* Stats */}
      <motion.div {...fadeUp(0.3)} className="flex gap-3 mb-5">
        {[
          { label: "Leads this month", value: leads    },
          { label: "AI messages sent", value: messages },
        ].map((s) => (
          <div
            key={s.label}
            className="flex-1 rounded-2xl px-4 py-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <p className="text-[28px] font-bold text-white" style={{ fontFamily: "Syne, sans-serif" }}>
              {s.value}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.32)" }}>{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Business cards */}
      <div className="flex flex-col gap-3">
        {BUSINESSES.map((biz, i) => (
          <motion.div
            key={biz.name}
            initial={{ opacity: 0, x: -22 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.48 + i * 0.14, duration: 0.4, ease }}
            className="flex items-center gap-3 p-4 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: `${biz.accent}18`, border: `1px solid ${biz.accent}30` }}
            >
              {biz.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold leading-snug" style={{ color: "rgba(255,255,255,0.88)" }}>
                {biz.name}
              </p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.32)" }}>{biz.type}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[16px] font-bold text-white">{biz.leads}</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.28)" }}>leads</p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.p
        {...fadeUp(1.0)}
        className="mt-auto text-center text-[11px] pt-4"
        style={{ color: "rgba(255,255,255,0.25)" }}
      >
        Export CSV · Filter by intent · Contact leads directly
      </motion.p>
    </motion.div>
  );
}

// ── Scene 6 — CTA ─────────────────────────────────────────────────────────────

function SceneCTA() {
  return (
    <motion.div {...sceneWrap} className="absolute inset-0 flex flex-col items-center justify-center px-7 text-center">
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.45, 0.9, 0.45] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(124,58,237,0.26) 0%, rgba(181,81,122,0.16) 55%, transparent 82%)" }}
      />

      <div className="relative z-10 w-full flex flex-col items-center space-y-4">
        <motion.p
          {...fadeUp(0.1)}
          className="text-[12px] font-bold tracking-[0.15em] uppercase"
          style={{ color: "rgba(167,139,250,0.8)" }}
        >
          Ready?
        </motion.p>

        <motion.h1
          {...fadeUp(0.3)}
          className="text-[36px] font-bold text-white leading-tight"
          style={{ fontFamily: "Syne, sans-serif" }}
        >
          Your business<br />deserves this.
        </motion.h1>

        <motion.p
          {...fadeUp(0.55)}
          className="text-[15px] leading-relaxed"
          style={{ color: "rgba(255,255,255,0.48)" }}
        >
          BotForge — live in 24 hours.<br />
          Built for Nigerian businesses.
        </motion.p>

        <motion.div {...fadeUp(0.8)} className="w-full pt-3">
          <motion.a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-full text-[15px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}
            animate={{
              boxShadow: [
                "0 4px 24px rgba(124,58,237,0.38), 0 0 0 0px rgba(124,58,237,0.15)",
                "0 4px 32px rgba(124,58,237,0.52), 0 0 0 10px rgba(124,58,237,0)",
                "0 4px 24px rgba(124,58,237,0.38), 0 0 0 0px rgba(124,58,237,0.15)",
              ],
            }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          >
            💬 DM me to get started
          </motion.a>
        </motion.div>

        <motion.p {...fadeUp(1.1)} className="text-[11px] pt-2" style={{ color: "rgba(255,255,255,0.22)" }}>
          ⚡ Powered by BotForge
        </motion.p>
      </div>
    </motion.div>
  );
}

// ── ShowcasePage ──────────────────────────────────────────────────────────────

const SCENES = [SceneHook, SceneProblem, SceneIntro, SceneChat, SceneLead, SceneDashboard, SceneCTA];

// How long each scene stays before auto-advancing (milliseconds).
// Tuned to the animation completion time of each scene.
const SCENE_DURATIONS = [
  3500,  // 0 Hook       — simple text fades
  5500,  // 1 Problem    — 4 notifications stagger in over ~2.2s + reading time
  3500,  // 2 Intro      — logo + pills
  7500,  // 3 Chat       — full conversation finishes at ~6.4s
  5000,  // 4 Lead       — card + staggered fields
  5000,  // 5 Dashboard  — counters + business cards
  0,     // 6 CTA        — last scene, never auto-advance
] as const;

export default function ShowcasePage() {
  const [scene, setScene]           = useState(0);
  const [controlsOn, setControlsOn] = useState(false);
  const [hint, setHint]             = useState(true);
  const [autoOn, setAutoOn]         = useState(false);
  // "on" | "off" | "restart" | null — drives the brief auto-advance toggle toast
  const [autoToast, setAutoToast]   = useState<"on" | "off" | "restart" | null>(null);

  const total = SCENES.length;

  const goNext = useCallback(() => setScene((s) => Math.min(s + 1, total - 1)), [total]);
  const goPrev = useCallback(() => setScene((s) => Math.max(s - 1, 0)), []);

  // Show tap hint briefly on each scene change, then auto-hide
  useEffect(() => {
    setHint(true);
    const t = setTimeout(() => setHint(false), 2200);
    return () => clearTimeout(t);
  }, [scene]);

  // Auto-advance timer — resets whenever scene or autoOn changes
  useEffect(() => {
    if (!autoOn) return;
    const duration = SCENE_DURATIONS[scene];
    if (!duration) return; // 0 means last scene — stop
    const t = setTimeout(() => setScene((s) => Math.min(s + 1, total - 1)), duration);
    return () => clearTimeout(t);
  }, [autoOn, scene, total]);

  // Auto-toast: show briefly then clear
  useEffect(() => {
    if (!autoToast) return;
    const t = setTimeout(() => setAutoToast(null), 2000);
    return () => clearTimeout(t);
  }, [autoToast]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.shiftKey && e.key === "H") {
        setControlsOn((v) => !v);
      } else if (e.key === "a" || e.key === "A") {
        setAutoOn((v) => {
          const next = !v;
          setAutoToast(next ? "on" : "off");
          return next;
        });
      } else if (e.key === "l" || e.key === "L") {
        setScene(0);
        setAutoToast("restart");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  const SceneComponent = SCENES[scene];

  return (
    <div
      className="w-screen h-dvh bg-black overflow-hidden flex items-center justify-center cursor-pointer select-none"
      onClick={goNext}
    >
      {/* 9:16 frame — fills phone screen, centred on desktop */}
      <div
        className="relative overflow-hidden bg-[#0a0a0a]"
        style={{
          width: "min(390px, 100vw)",
          height: "min(693px, 100dvh)",
        }}
      >
        <AnimatePresence mode="wait">
          <SceneComponent key={scene} />
        </AnimatePresence>

        {/* ── Auto-advance toast — brief confirmation, auto-fades ── */}
        <AnimatePresence>
          {autoToast && (
            <motion.div
              key={autoToast}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full pointer-events-none"
              style={{
                background: autoToast === "on" ? "rgba(124,58,237,0.55)" : "rgba(60,60,60,0.6)",
                backdropFilter: "blur(12px)",
                border: autoToast === "on" ? "1px solid rgba(167,139,250,0.35)" : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <span className="text-[10px] font-semibold text-white/90 whitespace-nowrap">
                {autoToast === "on" ? "Auto-advance ON" : autoToast === "restart" ? "Restarted" : "Auto-advance OFF"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Progress dots — Shift+H to toggle, invisible during recording ── */}
        <AnimatePresence>
          {controlsOn && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
              className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {SCENES.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setScene(i); }}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: i === scene ? "18px" : "7px",
                    height: "7px",
                    background: i === scene ? "white" : "rgba(255,255,255,0.3)",
                  }}
                />
              ))}
              <span
                className="text-[9px] ml-1"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                {scene + 1}/{total}
              </span>
              {autoOn && (
                <span
                  className="text-[9px] ml-0.5"
                  style={{ color: "rgba(167,139,250,0.75)" }}
                >
                  ⏱
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tap hint — fades out automatically, invisible when stable ── */}
        <motion.p
          className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap pointer-events-none"
          style={{ color: "rgba(255,255,255,0.42)" }}
          animate={{ opacity: hint ? 1 : 0 }}
          transition={{ duration: 0.7 }}
        >
          {scene === total - 1 ? "← tap to go back" : "tap to advance →"}
        </motion.p>
      </div>
    </div>
  );
}
