import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, Link, Check, ChevronDown } from "lucide-react";
import { useSendChatMessage, type BotConfig, type ChatMessage } from "@workspace/api-client-react";
import { buildShareableUrl, hexToHsl, getConfigFromUrl, decodeConfig } from "@/lib/configUrl";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ── Constants ────────────────────────────────────────────────────────────────

const DEVELOPER_WHATSAPP_URL = "https://wa.me/2348056683398";
const BOOKING_KEYWORDS =
  /\b(book|booking|bookings|appointment|appointments|schedule|scheduled|reserve|reservation|connect|contact|reach|whatsapp|link|number)\b/i;
const FREE_MSG_LIMIT = 5;
const DEMO_DURATION_MS = 24 * 60 * 60 * 1000;
const DEMO_EXPIRY_KEY = "botDemoExpiry";

function mentionsBooking(text: string): boolean {
  return BOOKING_KEYWORDS.test(text);
}

type AccessTier = "free" | "trial-ended" | "demo" | "demo-ended";

// ── Lead type (frontend mirror of backend Lead) ───────────────────────────────

type BookingIntent = "low" | "medium" | "high";

interface Lead {
  id: string;
  businessId: string;
  timestamp: string;
  customerName: string | null;
  servicesInterested: string[];
  bookingIntent: BookingIntent;
  questionsAsked: string[];
  conversationLength: number;
  summaryText: string;
}

// ── UI maps ──────────────────────────────────────────────────────────────────

const BIZ_EMOJIS: Record<string, string> = {
  wig: "💇‍♀️",
  fashion: "👗",
  food: "🍽️",
  cake: "🎂",
  beauty: "✨",
  photography: "📸",
  other: "💼",
};

const QUICK_REPLIES: Record<string, string[]> = {
  wig: ["Can I book for this weekend?", "How long does a session take?", "Can I combine two services?", "Do you handle damaged or thin hair?"],
  fashion: ["Can you make something custom for me?", "Do you have my size in stock?", "How long does an order take?", "Can I mix pieces from different collections?"],
  food: ["Can I pre-order for this weekend?", "Do you cater for large groups?", "Can I customise an item?", "How far do you deliver?"],
  cake: ["How much is a custom cake?", "Can I order a cake for this weekend?", "Do you make wedding cakes?", "How far in advance should I order?"],
  beauty: ["Can I book for this week?", "Do you work with sensitive skin?", "How long does a session take?", "Can I bundle two treatments?"],
  photography: ["Are you available on my date?", "Can I request a specific style or theme?", "How soon do I get my photos?", "Do you offer couple or group shoots?"],
  other: ["Are you available this week?", "Can you handle a custom request?", "How long does it usually take?", "Can I combine two services?"],
};

const BIZ_TYPE_LABELS: Record<string, string> = {
  wig: "Wig Revamping",
  fashion: "Fashion",
  food: "Food & Restaurant",
  cake: "Cakes & Events",
  beauty: "Beauty & Wellness",
  photography: "Photography",
  other: "Business",
};

// ── Service block parser ──────────────────────────────────────────────────────
//
// Classifies each non-empty line of config.services into one of four kinds:
//
//   "tagline"  starts with "Tagline:" — rendered as italic subtitle in header
//   "heading"  ALL-CAPS-heavy or ends with colon — rendered as section label
//   "priced"   "Name — ₦Price" pattern — rendered as a service card
//   "info"     everything else — rendered as a plain prose paragraph
//
// Fully generic. No business-type-specific logic anywhere.

type ServiceLine =
  | { kind: "tagline"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "priced"; name: string; price: string }
  | { kind: "info"; text: string };

function parseServicesBlock(raw: string): ServiceLine[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line): ServiceLine => {
      if (/^tagline:\s*/i.test(line)) {
        return { kind: "tagline", text: line.replace(/^tagline:\s*/i, "").trim() };
      }

      const dashMatch = line.match(/^(.+?)\s*[—–]\s*(.+)$/);
      if (dashMatch) {
        const [, name, price] = dashMatch;
        if (/[₦\d]/.test(price)) {
          return { kind: "priced", name: name.trim(), price: price.trim() };
        }
      }

      const letters = (line.match(/[a-zA-Z]/g) ?? []).length;
      const uppers = (line.match(/[A-Z]/g) ?? []).length;
      const isAllCapsHeavy = letters > 3 && uppers / letters > 0.6;
      const endsWithColon = line.endsWith(":");
      if ((isAllCapsHeavy || endsWithColon) && line.length < 80) {
        return { kind: "heading", text: endsWithColon ? line.slice(0, -1) : line };
      }

      return { kind: "info", text: line };
    });
}

// ── WhatsApp Handoff Button ───────────────────────────────────────────────────
//
// Data flow:
//   click → POST /api/chat/summarize (conversation → AI lead extraction)
//         → build Lead object (id, businessId, timestamp, …)
//         → buildWhatsAppLink(phone, summaryText) → window.open
//         → fire-and-forget POST /api/leads  (non-blocking, never delays UX)

interface WhatsAppHandoffProps {
  messages: ChatMessage[];
  config: BotConfig;
  businessId: string;
  phone: string;
  accentColor: string;
}

function WhatsAppHandoffButton({
  messages,
  config,
  businessId,
  phone,
  accentColor,
}: WhatsAppHandoffProps) {
  const [isSummarizing, setIsSummarizing] = useState(false);

  if (!phone) {
    return (
      <p className="mt-2 text-[13px] text-muted-foreground italic">
        WhatsApp contact is not available for this business yet.
      </p>
    );
  }

  const saveLead = (lead: Lead): void => {
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    }).catch(() => {});
  };

  const handleClick = async () => {
    if (isSummarizing) return;
    setIsSummarizing(true);

    const fallbackUrl = buildWhatsAppLink(phone);

    try {
      const res = await fetch("/api/chat/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, config }),
      });

      if (!res.ok) {
        window.open(fallbackUrl, "_blank", "noopener,noreferrer");
        return;
      }

      const data = (await res.json()) as Omit<Lead, "id" | "businessId">;

      const lead: Lead = {
        id: crypto.randomUUID(),
        businessId,
        ...data,
      };

      const url = buildWhatsAppLink(phone, lead.summaryText);
      window.open(url, "_blank", "noopener,noreferrer");

      saveLead(lead);
    } catch {
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isSummarizing}
      className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold text-white transition-all hover:opacity-90 active:opacity-75 disabled:opacity-60 cursor-pointer"
      style={{ backgroundColor: accentColor }}
    >
      {isSummarizing ? (
        <>
          <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" />
          Preparing your details…
        </>
      ) : (
        "💬 Continue on WhatsApp"
      )}
    </button>
  );
}

// ── Developer CTA ─────────────────────────────────────────────────────────────

function DeveloperCTA() {
  return (
    <div
      className="mx-auto w-full max-w-[340px] mt-4 mb-2 flex flex-col items-center gap-3 rounded-2xl p-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{
        background:
          "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(79,70,229,0.10) 100%)",
        border: "1px solid rgba(139,92,246,0.25)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow:
          "0 0 32px rgba(124,58,237,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <p
        className="font-syne font-bold text-[16px] leading-snug"
        style={{ color: "rgba(233,213,255,0.95)" }}
      >
        Your business deserves more than missed messages ✨
      </p>
      <p className="text-[13px]" style={{ color: "rgba(196,181,253,0.7)" }}>
        Let's build yours 👇
      </p>
      <a
        href={DEVELOPER_WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[14px] font-semibold text-white w-full justify-center mt-1 transition-all duration-200 hover:scale-[1.03] hover:shadow-lg active:scale-[0.97]"
        style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
          boxShadow:
            "0 4px 20px rgba(124,58,237,0.45), inset 0 1px 0 rgba(255,255,255,0.15)",
        }}
      >
        🚀 Get Your Own AI Assistant
      </a>
    </div>
  );
}

// ── Chat Page ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [businessId, setBusinessId] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [accessTier, setAccessTier] = useState<AccessTier>("free");
  const [sentCount, setSentCount] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const sentCountRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendMessageMutation = useSendChatMessage();

  // Determine access tier from URL and localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isDemo = params.get("demo") === "true";

    if (isDemo) {
      const stored = localStorage.getItem(DEMO_EXPIRY_KEY);
      const now = Date.now();
      if (stored) {
        const expiry = parseInt(stored, 10);
        setAccessTier(now >= expiry ? "demo-ended" : "demo");
      } else {
        localStorage.setItem(DEMO_EXPIRY_KEY, String(now + DEMO_DURATION_MS));
        setAccessTier("demo");
      }
    } else {
      setAccessTier("free");
    }
  }, []);

  // Re-check demo expiry periodically
  useEffect(() => {
    if (accessTier !== "demo") return;
    const interval = setInterval(() => {
      const stored = localStorage.getItem(DEMO_EXPIRY_KEY);
      if (stored && Date.now() >= parseInt(stored, 10)) {
        setAccessTier("demo-ended");
        clearInterval(interval);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [accessTier]);

  // Load business config.
  //
  // Priority order:
  //   1. URL hash  /#c=<encoded>  — shareable links, QR codes, WhatsApp intro
  //   2. Query string  ?c=<encoded>  — admin "Open Bot" button (wouter setLocation)
  //   3. API list[0] fallback — bare URL with no config (default landing page)
  //
  // The API is always fetched regardless so we can resolve the businessId
  // (needed for lead tracking) by matching bizName against the DB list.
  useEffect(() => {
    const hashConfig = getConfigFromUrl();
    const searchC = new URLSearchParams(window.location.search).get("c");
    const queryConfig = searchC ? decodeConfig(searchC) : null;
    const urlConfig = hashConfig ?? queryConfig;

    fetch("/api/businesses")
      .then((res) => {
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json() as Promise<Array<{
          id: string;
          bizName: string;
          bizType: string;
          phone?: string | null;
          services?: string | null;
          location?: string | null;
          howToOrder?: string | null;
          instagram?: string | null;
          personality?: string | null;
          welcomeMsg?: string | null;
          accentColor?: string | null;
        }>>;
      })
      .then((list) => {
        if (urlConfig) {
          const match = list.find((b) => b.bizName === urlConfig.bizName);
          setBusinessId(match?.id ?? "");
          setBizPhone(urlConfig.phone ?? match?.phone ?? "");
          setConfig(urlConfig);
          return;
        }
        const biz = list[0];
        if (!biz) return;
        setBusinessId(biz.id);
        setBizPhone(biz.phone ?? "");
        setConfig({
          bizName: biz.bizName,
          bizType: biz.bizType,
          services: biz.services ?? undefined,
          location: biz.location ?? undefined,
          howToOrder: biz.howToOrder ?? undefined,
          instagram: biz.instagram ?? undefined,
          personality: biz.personality ?? undefined,
          welcomeMsg: biz.welcomeMsg ?? undefined,
          accentColor: biz.accentColor ?? undefined,
        });
      })
      .catch((err) => {
        console.error("Failed to load business config from API:", err);
      });
  }, []);

  const isTrialEnded = accessTier === "free" && sentCount >= FREE_MSG_LIMIT;
  const isDemoEnded = accessTier === "demo-ended";
  const isLocked = isTrialEnded || isDemoEnded;

  const handleCopyLink = useCallback(() => {
    if (!config) return;
    const url = buildShareableUrl(config);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [config]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sendMessageMutation.isPending, isTrialEnded, isDemoEnded]);

  const handleSend = (text: string = input) => {
    if (!text.trim() || !config) return;
    if (isDemoEnded) return;
    if (accessTier === "free" && sentCountRef.current >= FREE_MSG_LIMIT) return;

    sentCountRef.current += 1;
    setSentCount(sentCountRef.current);

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");

    sendMessageMutation.mutate(
      { data: { messages: newMessages, config } },
      {
        onSuccess: (data) => {
          setMessages([...newMessages, { role: "assistant", content: data.content }]);
        },
        onError: () => {
          setMessages([
            ...newMessages,
            { role: "assistant", content: "Sorry, I had trouble connecting. Please try again." },
          ]);
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!config)
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        Loading...
      </div>
    );

  const accentColor = config.accentColor ?? "#b5517a";
  const accentHsl = hexToHsl(accentColor);

  const parsedLines = config.services ? parseServicesBlock(config.services) : [];
  const serviceTagline = parsedLines.find((l): l is { kind: "tagline"; text: string } => l.kind === "tagline");
  const serviceSections = parsedLines.filter((l) => l.kind === "heading" || l.kind === "priced");
  const pricedItems = parsedLines.filter((l): l is { kind: "priced"; name: string; price: string } => l.kind === "priced");
  const infoItems = parsedLines.filter((l): l is { kind: "info"; text: string } => l.kind === "info");

  return (
    <div className="flex justify-center bg-black dark">
      {accentHsl && <style>{`:root { --primary: ${accentHsl}; }`}</style>}
      <div className="w-full max-w-[480px] flex flex-col bg-background shadow-2xl border-x border-border">

        {/* ── Landing Section ────────────────────────────────────────────── */}
        <section className="relative flex-none px-5 pt-8 pb-6" style={{ borderBottom: `1px solid ${accentColor}33` }}>
          <a
            href={`https://wa.me/2348056683398?text=${encodeURIComponent(`Hi! I saw the BotForge-powered chatbot for ${config.bizName} and I'm interested in getting one for my own business too 🚀`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-4 right-5 text-[10px] italic font-medium text-violet-400/70 hover:text-violet-400 transition-colors flex items-center gap-0.5"
          >
            ⚡ Powered by BotForge
          </a>

          {/* Business Header */}
          <div className="flex items-start gap-4 mb-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}33` }}
            >
              {BIZ_EMOJIS[config.bizType || "other"]}
            </div>
            <div className="flex-1 min-w-0">
              <h1
                className={`font-syne font-bold leading-tight text-foreground break-words pr-14 ${
                  config.bizName.length > 28
                    ? "text-[16px]"
                    : config.bizName.length > 20
                    ? "text-[19px]"
                    : "text-[22px]"
                }`}
              >
                {config.bizName}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-2">
                <span
                  className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize"
                  style={{ background: `${accentColor}18`, color: accentColor }}
                >
                  {BIZ_TYPE_LABELS[config.bizType || "other"] ?? config.bizType}
                </span>
                {config.location && (
                  <span className="text-[12px] text-muted-foreground leading-snug">
                    📍 {config.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Business Description — tagline from services block, if present */}
          {serviceTagline && (
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-6 italic border-l-2 pl-3" style={{ borderColor: `${accentColor}55` }}>
              {serviceTagline.text}
            </p>
          )}

          {/* Services & Pricing — priced items only, headings as inline labels */}
          {pricedItems.length > 0 && (
            <div className="mb-6">
              <h2
                className="text-[11px] font-semibold tracking-widest uppercase mb-3"
                style={{ color: accentColor }}
              >
                Services &amp; Pricing
              </h2>
              <div className="flex flex-col gap-1.5">
                {serviceSections.map((item, i) =>
                  item.kind === "heading" ? (
                    <p
                      key={i}
                      className="text-[10px] font-semibold tracking-wider uppercase mt-4 mb-0.5 first:mt-0 px-1"
                      style={{ color: `${accentColor}99` }}
                    >
                      {item.text}
                    </p>
                  ) : item.kind === "priced" ? (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-card border border-border"
                    >
                      <span className="text-[13px] text-foreground leading-snug">{item.name}</span>
                      <span
                        className="text-[13px] font-semibold ml-3 flex-shrink-0"
                        style={{ color: accentColor }}
                      >
                        {item.price}
                      </span>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* Business Information — ordering instructions + informational paragraphs */}
          {(config.howToOrder || infoItems.length > 0) && (
            <div className="mb-6">
              <h2
                className="text-[11px] font-semibold tracking-widest uppercase mb-3"
                style={{ color: accentColor }}
              >
                Business Information
              </h2>
              <div className="flex flex-col gap-3">
                {config.howToOrder && (
                  <p className="text-[13px] text-foreground/85 leading-relaxed">
                    🛒 {config.howToOrder}
                  </p>
                )}
                {infoItems.map((item, i) => (
                  <p key={i} className="text-[13px] text-muted-foreground leading-relaxed">
                    {item.text}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Contact info */}
          {(bizPhone || config.instagram) && (
            <div className="mb-5">
              <h2
                className="text-[11px] font-semibold tracking-widest uppercase mb-3"
                style={{ color: accentColor }}
              >
                Contact
              </h2>
              <div className="flex flex-col gap-2">
                {bizPhone && (
                  <a
                    href={`https://wa.me/${bizPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-card border border-border hover:border-green-500/50 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center text-[15px]">
                      📱
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground leading-tight">WhatsApp</p>
                      <p className="text-[13px] text-foreground font-medium">+{bizPhone}</p>
                    </div>
                  </a>
                )}
                {config.instagram && (
                  <a
                    href={`https://instagram.com/${config.instagram.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-card border border-border hover:border-pink-500/50 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-pink-500/10 flex items-center justify-center text-[15px]">
                      📸
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground leading-tight">Instagram</p>
                      <p className="text-[13px] text-foreground font-medium">{config.instagram}</p>
                    </div>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Chat anchor */}
          <div className="flex items-center gap-2 pt-4 mt-1 border-t border-border">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
            <p className="text-[13px] font-medium text-foreground">Chat with us below</p>
            <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
          </div>
        </section>

        {/* ── Chat Section ───────────────────────────────────────────────── */}
        <div className="h-[100dvh] flex flex-col relative overflow-hidden">

        {/* Header */}
        <header className="flex-none h-16 border-b border-border flex items-center justify-between px-4 z-10 bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-black">
              <img src="/icon-192.png" alt="BotForge logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-syne font-bold text-[17px] leading-tight text-foreground">
                  {config.bizName}
                </h1>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-400 leading-none">
                  ⚡ AI
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Always online
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyLink}
              className="text-muted-foreground hover:text-foreground rounded-full transition-colors"
              title="Copy shareable link"
              data-testid="button-copy-link"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Link className="w-4 h-4" />
              )}
            </Button>
          </div>
        </header>


        {/* Messages */}
        <div
          ref={scrollRef}
          className={`flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar ${
            messages.length === 0
              ? "pb-28"
              : showSuggestions
              ? "pb-64"
              : "pb-36"
          }`}
        >
          {messages.length === 0 && (
            <div className="mt-8 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center text-3xl mb-4 shadow-sm">
                {BIZ_EMOJIS[config.bizType || "other"] || BIZ_EMOJIS["other"]}
              </div>
              <h2 className="font-syne text-xl font-bold mb-2 text-foreground text-center">
                {config.bizName}
              </h2>
              <p className="text-muted-foreground text-center mb-6 max-w-[280px] text-sm">
                {config.welcomeMsg || "Hi there! How can I help you today?"}
              </p>
              <div className="w-full flex flex-col gap-2">
                {(QUICK_REPLIES[config.bizType || "other"] || QUICK_REPLIES["other"]).map(
                  (reply, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="w-full justify-start h-auto py-3 px-4 text-left border-border bg-card hover:bg-muted hover:border-primary/50 transition-colors"
                      onClick={() => handleSend(reply)}
                      data-testid={`button-quick-reply-${i}`}
                    >
                      {reply}
                    </Button>
                  ),
                )}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card text-card-foreground border border-border rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 px-1 font-medium opacity-70">
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              {msg.role === "assistant" && mentionsBooking(msg.content) && (
                <div className="mt-2 mb-1">
                  <WhatsAppHandoffButton
                    messages={messages}
                    config={config}
                    businessId={businessId}
                    phone={bizPhone}
                    accentColor={accentColor}
                  />
                </div>
              )}
            </div>
          ))}

          {sendMessageMutation.isPending && (
            <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="max-w-[85%] rounded-2xl px-4 py-3.5 bg-card border border-border rounded-bl-sm flex gap-1">
                <div
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          )}

          {isTrialEnded && <DeveloperCTA />}
          {isDemoEnded && <DeveloperCTA />}
        </div>

        {/* Input Bar */}
        {!isLocked && (
          <div className="flex-none border-t border-border bg-background/95 backdrop-blur-sm absolute bottom-0 left-0 right-0 z-20">

            {/* Quick suggestions tray — accessible throughout the conversation */}
            {messages.length > 0 && (
              <div className="px-3 pt-2">
                <button
                  onClick={() => setShowSuggestions((s) => !s)}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold select-none transition-all active:scale-95"
                  style={{
                    background: `hsla(${accentHsl}, 0.15)`,
                    color: accentColor,
                    border: `1px solid hsla(${accentHsl}, 0.3)`,
                  }}
                >
                  <span>💬</span>
                  <span>Quick questions</span>
                  <span
                    className="inline-block transition-transform duration-200"
                    style={{ transform: showSuggestions ? "rotate(180deg)" : "rotate(0deg)" }}
                  >
                    ▾
                  </span>
                </button>
                {showSuggestions && (
                  <div className="flex flex-wrap gap-1.5 mt-2 pb-1 animate-in fade-in slide-in-from-bottom-1 duration-150">
                    {(QUICK_REPLIES[config.bizType || "other"] || QUICK_REPLIES["other"]).map(
                      (reply, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            handleSend(reply);
                            setShowSuggestions(false);
                          }}
                          className="text-[12px] px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted hover:border-primary/50 text-foreground transition-colors"
                        >
                          {reply}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Text input row */}
            <div className="p-3 pt-2">
              <div className="flex items-end gap-2 bg-card border border-border rounded-[24px] p-1.5 pr-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="min-h-[40px] max-h-[100px] bg-transparent border-0 focus-visible:ring-0 resize-none py-2.5 px-3 text-[15px] scrollbar-hide"
                  disabled={sendMessageMutation.isPending}
                  rows={1}
                  data-testid="input-message"
                />
                <Button
                  size="icon"
                  className="w-9 h-9 rounded-full shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || sendMessageMutation.isPending}
                  data-testid="button-send"
                >
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
        </div> {/* end chat section */}

      </div> {/* end column */}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 4px; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
