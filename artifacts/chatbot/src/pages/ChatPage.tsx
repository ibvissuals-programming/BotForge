import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, Link, Check } from "lucide-react";
import { useSendChatMessage, type BotConfig, type ChatMessage } from "@workspace/api-client-react";
import { buildShareableUrl, hexToHsl } from "@/lib/configUrl";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import businesses from "@/data/businesses";
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
  beauty: "✨",
  photography: "📸",
  other: "💼",
};

const QUICK_REPLIES: Record<string, string[]> = {
  wig: ["What are your prices?", "How do I book?", "Do you do installs?", "Where are you located?"],
  fashion: ["See collections", "Pricing info", "Do you do custom?", "Delivery options"],
  food: ["See menu", "Do you deliver?", "How to order?", "Pricing"],
  beauty: ["Services & prices", "Book appointment", "Products available", "Location"],
  photography: ["Packages & prices", "Book a shoot", "Turnaround time", "Location"],
  other: ["What do you offer?", "Pricing info", "How to order?", "Contact details"],
};

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
  const [bizPhone, setBizPhone] = useState("2348163716199");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [accessTier, setAccessTier] = useState<AccessTier>("free");
  const [sentCount, setSentCount] = useState(0);
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

  // Load business config from businesses.ts
  useEffect(() => {
    const biz = businesses[0];
    setBusinessId(biz.id);
    setBizPhone(biz.phone ?? "2348163716199");
    setConfig({
      bizName: biz.bizName,
      bizType: biz.bizType,
      services: biz.services,
      location: biz.location,
      howToOrder: biz.howToOrder,
      instagram: biz.instagram,
      personality: biz.personality,
      welcomeMsg: biz.welcomeMsg,
      accentColor: biz.accentColor,
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

  return (
    <div className="flex justify-center bg-black min-h-screen dark">
      {accentHsl && <style>{`:root { --primary: ${accentHsl}; }`}</style>}
      <div className="w-full max-w-[480px] h-[100dvh] flex flex-col bg-background relative shadow-2xl overflow-hidden border-x border-border">

        {/* Header */}
        <header className="flex-none h-16 border-b border-border flex items-center justify-between px-4 z-10 bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-syne font-bold text-lg">
              {config.bizName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-syne font-bold text-[17px] leading-tight text-foreground">
                {config.bizName}
              </h1>
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
          className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar pb-24"
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
              <span className="text-[10px] text-muted-foreground mt-1.5 px-1 font-medium opacity-70">
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              {msg.role === "assistant" && mentionsBooking(msg.content) && (
                <WhatsAppHandoffButton
                  messages={messages}
                  config={config}
                  businessId={businessId}
                  phone={bizPhone}
                  accentColor={accentColor}
                />
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
          <div className="flex-none p-3 border-t border-border bg-background absolute bottom-0 left-0 right-0 z-10">
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
        )}
      </div>

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
