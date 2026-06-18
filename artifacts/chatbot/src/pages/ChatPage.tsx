import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, Link, Check } from "lucide-react";
import { useSendChatMessage, type BotConfig, type ChatMessage } from "@workspace/api-client-react";
import { buildShareableUrl, hexToHsl } from "@/lib/configUrl";
import businesses from "@/data/businesses";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const WHATSAPP_URL = "https://wa.me/2348163716199";
const BOOKING_KEYWORDS = /\b(book|booking|bookings|appointment|appointments|schedule|scheduled|reserve|reservation)\b/i;
const FREE_MSG_LIMIT = 10;
const DEMO_DURATION_MS = 24 * 60 * 60 * 1000;
const DEMO_EXPIRY_KEY = "botDemoExpiry";

function mentionsBooking(text: string): boolean {
  return BOOKING_KEYWORDS.test(text);
}

type AccessTier = "free" | "trial-ended" | "demo" | "demo-ended";

const BIZ_EMOJIS: Record<string, string> = {
  "wig": "💇‍♀️",
  "fashion": "👗",
  "food": "🍽️",
  "beauty": "✨",
  "photography": "📸",
  "other": "💼"
};

const QUICK_REPLIES: Record<string, string[]> = {
  "wig": ["What are your prices?", "How do I book?", "Do you do installs?", "Where are you located?"],
  "fashion": ["See collections", "Pricing info", "Do you do custom?", "Delivery options"],
  "food": ["See menu", "Do you deliver?", "How to order?", "Pricing"],
  "beauty": ["Services & prices", "Book appointment", "Products available", "Location"],
  "photography": ["Packages & prices", "Book a shoot", "Turnaround time", "Location"],
  "other": ["What do you offer?", "Pricing info", "How to order?", "Contact details"]
};

function WhatsAppCTA({ message }: { message: string }) {
  return (
    <div className="mx-auto w-full max-w-[340px] mt-4 mb-2 flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
      <p className="text-[15px] text-foreground leading-relaxed">{message}</p>
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[14px] font-semibold text-white transition-opacity hover:opacity-90 active:opacity-75 w-full justify-center"
        style={{ backgroundColor: "#b5517a" }}
      >
        Chat on WhatsApp 💬
      </a>
    </div>
  );
}

export default function ChatPage() {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [accessTier, setAccessTier] = useState<AccessTier>("free");
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
        if (now >= expiry) {
          setAccessTier("demo-ended");
        } else {
          setAccessTier("demo");
        }
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

  // Load business config
  useEffect(() => {
    const defaultBiz = businesses[0];
    const defaultConfig: BotConfig = {
      bizName: defaultBiz.bizName,
      bizType: defaultBiz.bizType,
      services: defaultBiz.services,
      location: defaultBiz.location,
      howToOrder: defaultBiz.howToOrder,
      instagram: defaultBiz.instagram,
      personality: defaultBiz.personality,
      welcomeMsg: defaultBiz.welcomeMsg,
      accentColor: defaultBiz.accentColor,
    };
    setConfig(defaultConfig);
  }, []);

  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const isTrialEnded = accessTier === "free" && userMsgCount >= FREE_MSG_LIMIT;
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
    if (!text.trim() || !config || isLocked) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");

    sendMessageMutation.mutate({
      data: { messages: newMessages, config }
    }, {
      onSuccess: (data) => {
        setMessages([...newMessages, { role: "assistant", content: data.content }]);
      },
      onError: () => {
        setMessages([...newMessages, { role: "assistant", content: "Sorry, I had trouble connecting. Please try again." }]);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!config) return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      Loading...
    </div>
  );

  const accentHsl = config.accentColor ? hexToHsl(config.accentColor) : null;

  return (
    <div className="flex justify-center bg-black min-h-screen dark">
      {accentHsl && (
        <style>{`:root { --primary: ${accentHsl}; }`}</style>
      )}
      <div className="w-full max-w-[480px] h-[100dvh] flex flex-col bg-background relative shadow-2xl overflow-hidden border-x border-border">

        {/* Header */}
        <header className="flex-none h-16 border-b border-border flex items-center justify-between px-4 z-10 bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-syne font-bold text-lg">
              {config.bizName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-syne font-bold text-[17px] leading-tight text-foreground">{config.bizName}</h1>
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
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Link className="w-4 h-4" />}
            </Button>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar pb-24">
          {messages.length === 0 && (
            <div className="mt-8 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center text-3xl mb-4 shadow-sm">
                {BIZ_EMOJIS[config.bizType || "other"] || BIZ_EMOJIS["other"]}
              </div>
              <h2 className="font-syne text-xl font-bold mb-2 text-foreground text-center">{config.bizName}</h2>
              <p className="text-muted-foreground text-center mb-6 max-w-[280px] text-sm">
                {config.welcomeMsg || "Hi there! How can I help you today?"}
              </p>
              <div className="w-full flex flex-col gap-2">
                {(QUICK_REPLIES[config.bizType || "other"] || QUICK_REPLIES["other"]).map((reply, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="w-full justify-start h-auto py-3 px-4 text-left border-border bg-card hover:bg-muted hover:border-primary/50 transition-colors"
                    onClick={() => handleSend(reply)}
                    data-testid={`button-quick-reply-${i}`}
                  >
                    {reply}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
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
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold text-white transition-opacity hover:opacity-90 active:opacity-75"
                  style={{ backgroundColor: "#b5517a" }}
                >
                  Book on WhatsApp 💬
                </a>
              )}
            </div>
          ))}

          {sendMessageMutation.isPending && (
            <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="max-w-[85%] rounded-2xl px-4 py-3.5 bg-card border border-border rounded-bl-sm flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {isTrialEnded && (
            <WhatsAppCTA message={"Enjoying this? Get a full 24-hour demo for your business 💕\nContact us on WhatsApp to unlock 👇"} />
          )}

          {isDemoEnded && (
            <WhatsAppCTA message={"Your 24-hour demo has ended ✨\nReady to get this for your business?\nLet's talk 👇"} />
          )}
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
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--border));
          border-radius: 4px;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
