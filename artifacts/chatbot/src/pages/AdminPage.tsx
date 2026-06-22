import { useState, useCallback } from "react";
import { Link as LinkIcon, Check, ArrowRight, ExternalLink, Instagram, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import businesses, { type BusinessConfig } from "@/data/businesses";
import { encodeConfig } from "@/lib/configUrl";
import type { BotConfig } from "@workspace/api-client-react";

const BIZ_EMOJIS: Record<string, string> = {
  wig: "💇‍♀️",
  fashion: "👗",
  food: "🍽️",
  beauty: "✨",
  photography: "📸",
  other: "💼",
};

function businessToConfig(b: BusinessConfig): BotConfig {
  return {
    bizName: b.bizName,
    bizType: b.bizType,
    services: b.services ?? null,
    location: b.location ?? null,
    howToOrder: b.howToOrder ?? null,
    instagram: b.instagram ?? null,
    personality: b.personality ?? null,
    welcomeMsg: b.welcomeMsg ?? null,
    accentColor: b.accentColor ?? null,
  };
}

function ClientCard({ business }: { business: BusinessConfig }) {
  const [copied, setCopied] = useState(false);
  const [, setLocation] = useLocation();

  const accent = business.accentColor ?? "#7c6af7";

  const handleCopyLink = useCallback(() => {
    const cfg = businessToConfig(business);
    const url = `${window.location.origin}/#c=${encodeConfig(cfg)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [business]);

  const handleOpenBot = useCallback(() => {
    const cfg = businessToConfig(business);
    localStorage.setItem("botConfig", JSON.stringify(cfg));
    setLocation(`/?c=${encodeConfig(cfg)}`);
  }, [business, setLocation]);

  return (
    <div
      className="relative rounded-2xl bg-[#161616] border border-[#2a2a2a] overflow-hidden transition-all hover:border-[#3a3a3a]"
      style={{ borderLeftColor: accent, borderLeftWidth: 4 }}
      data-testid={`card-client-${business.id}`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0"
              style={{ background: `${accent}22` }}
            >
              {BIZ_EMOJIS[business.bizType] ?? BIZ_EMOJIS.other}
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-[#f0f0f0] leading-tight" style={{ fontFamily: "Syne, sans-serif" }}>
                {business.bizName}
              </h3>
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-full mt-1 inline-block capitalize"
                style={{ background: `${accent}22`, color: accent }}
              >
                {business.bizType}
              </span>
            </div>
          </div>
          <div
            className="w-3 h-3 rounded-full shrink-0 mt-1"
            style={{ background: accent }}
          />
        </div>

        {business.location && (
          <p className="text-[12px] text-[#888] mb-1 truncate">
            {business.location}
          </p>
        )}
        {business.instagram && (
          <p className="text-[12px] text-[#888] flex items-center gap-1 mb-3">
            <Instagram className="w-3 h-3" />
            {business.instagram}
          </p>
        )}
        {!business.location && !business.instagram && <div className="mb-3" />}

        <div className="flex gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-xl border border-[#2a2a2a] bg-[#1f1f1f] text-[#888] hover:text-[#f0f0f0] hover:border-[#3a3a3a] transition-all"
            data-testid={`button-copy-link-${business.id}`}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <LinkIcon className="w-3.5 h-3.5" />
            )}
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button
            onClick={handleOpenBot}
            className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-xl text-white transition-all flex-1 justify-center"
            style={{ background: accent }}
            data-testid={`button-open-bot-${business.id}`}
          >
            Open Bot
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function handleSignOut() {
  localStorage.removeItem("botforge_admin_session");
  window.location.reload();
}

export default function AdminPage() {
  return (
    <div className="flex justify-center bg-black min-h-screen dark">
      <div className="w-full max-w-[480px] min-h-[100dvh] flex flex-col bg-[#0d0d0d]">
        <header className="px-5 pt-10 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-widest text-[#7c6af7] uppercase mb-2">
                Admin
              </p>
              <h1 className="text-2xl font-bold text-[#f0f0f0]" style={{ fontFamily: "Syne, sans-serif" }}>
                Client Bots
              </h1>
              <p className="text-[13px] text-[#888] mt-1">
                {businesses.length} {businesses.length === 1 ? "client" : "clients"} configured
              </p>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="flex items-center gap-1.5 text-[12px] text-[#555] hover:text-[#f0f0f0] transition-colors mt-1 px-3 py-2 rounded-xl hover:bg-[#1f1f1f]"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </header>

        <div className="flex-1 px-4 pb-8 flex flex-col gap-3">
          {businesses.map((b) => (
            <ClientCard key={b.id} business={b} />
          ))}

          <div className="rounded-2xl border border-dashed border-[#2a2a2a] p-5 flex items-center gap-4 mt-2">
            <div className="w-11 h-11 rounded-full bg-[#1f1f1f] border border-[#2a2a2a] flex items-center justify-center text-[#555] text-xl">
              +
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#888]">Add a new client</p>
              <p className="text-[11px] text-[#555] mt-0.5 font-mono">
                Edit src/data/businesses.ts
              </p>
            </div>
          </div>
        </div>

        <footer className="px-5 py-4 border-t border-[#1f1f1f]">
          <a
            href="/"
            className="flex items-center gap-1.5 text-[12px] text-[#555] hover:text-[#888] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Back to chat
          </a>
        </footer>
      </div>
    </div>
  );
}
