import { useState, useCallback, useEffect, useRef } from "react";
import {
  Link as LinkIcon,
  Check,
  ArrowRight,
  ExternalLink,
  Instagram,
  LogOut,
  Plus,
  X,
  Loader2,
  Trash2,
  Pencil,
  MessageSquare,
  Users,
  Inbox,
  Sparkles,
  Copy,
  QrCode,
  Download,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useLocation } from "wouter";
import { encodeConfig } from "@/lib/configUrl";
import type { BotConfig } from "@workspace/api-client-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Business {
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
}

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

// ── Constants ─────────────────────────────────────────────────────────────────

const BIZ_EMOJIS: Record<string, string> = {
  wig: "💇‍♀️",
  fashion: "👗",
  food: "🍽️",
  beauty: "✨",
  photography: "📸",
  other: "💼",
};

const BIZ_TYPE_OPTIONS = [
  { value: "wig", label: "Wig / Hair" },
  { value: "fashion", label: "Fashion" },
  { value: "food", label: "Food" },
  { value: "beauty", label: "Beauty" },
  { value: "photography", label: "Photography" },
  { value: "other", label: "Other" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function businessToConfig(b: Business): BotConfig {
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

function handleSignOut() {
  localStorage.removeItem("botforge_admin_session");
  window.location.reload();
}

// ── QR Code Modal ─────────────────────────────────────────────────────────────

function QRModal({
  bizName,
  url,
  accent,
  onClose,
}: {
  bizName: string;
  url: string;
  accent: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${bizName.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-6 flex flex-col items-center gap-5 w-full max-w-[300px]">
        {/* Header */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4" style={{ color: accent }} />
            <span className="text-[13px] font-semibold text-[#f0f0f0]" style={{ fontFamily: "Syne, sans-serif" }}>
              QR Code
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#1f1f1f] flex items-center justify-center text-[#666] hover:text-[#f0f0f0] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* QR canvas */}
        <div
          className="rounded-xl p-3 bg-white"
          style={{ boxShadow: `0 0 0 4px ${accent}33` }}
        >
          <QRCodeCanvas
            value={url}
            size={200}
            bgColor="#ffffff"
            fgColor="#0d0d0d"
            level="M"
            ref={canvasRef}
          />
        </div>

        {/* Label */}
        <p className="text-[13px] font-semibold text-[#ccc] text-center">{bizName}</p>

        {/* Download */}
        <button
          onClick={handleDownload}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90"
          style={{ background: accent }}
        >
          <Download className="w-4 h-4" />
          Download PNG
        </button>
      </div>
    </div>
  );
}

// ── Client Card ───────────────────────────────────────────────────────────────

function ClientCard({
  business,
  onDeleted,
  onEdit,
}: {
  business: Business;
  onDeleted: (id: string) => void;
  onEdit: (b: Business) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [, setLocation] = useLocation();
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoCaption, setPromoCaption] = useState<string | null>(null);
  const [promoCopied, setPromoCopied] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [introCopied, setIntroCopied] = useState(false);

  const accent = business.accentColor ?? "#7c6af7";

  const chatUrl = `${window.location.origin}/#c=${encodeConfig(businessToConfig(business))}`;

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(chatUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [chatUrl]);

  const handleOpenBot = useCallback(() => {
    const cfg = businessToConfig(business);
    setLocation(`/?c=${encodeConfig(cfg)}`);
  }, [business, setLocation]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/businesses/${business.id}`, { method: "DELETE" });
      if (res.ok) onDeleted(business.id);
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  async function handleGeneratePromo() {
    setPromoLoading(true);
    setPromoCaption(null);
    setPromoError(null);
    try {
      const res = await fetch("/api/promo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bizName: business.bizName,
          bizType: business.bizType,
          services: business.services,
          location: business.location,
          personality: business.personality,
        }),
      });
      const data = (await res.json()) as { caption?: string; error?: string };
      if (!res.ok || data.error) {
        setPromoError(data.error ?? "Failed to generate. Try again.");
      } else {
        setPromoCaption(data.caption ?? "");
      }
    } catch {
      setPromoError("Could not reach the server.");
    } finally {
      setPromoLoading(false);
    }
  }

  function handleCopyIntroMessage() {
    const msg =
      `Hey! 👋 I just built you a 24/7 AI assistant for ${business.bizName} 🎉\n\n` +
      `It answers customer questions automatically and sends serious buyers straight to your WhatsApp.\n\n` +
      `Try it here: ${chatUrl}\n\nLet me know what you think!`;
    navigator.clipboard.writeText(msg).then(() => {
      setIntroCopied(true);
      setTimeout(() => setIntroCopied(false), 2500);
    });
  }

  function handleCopyCaption() {
    if (!promoCaption) return;
    navigator.clipboard.writeText(promoCaption).then(() => {
      setPromoCopied(true);
      setTimeout(() => setPromoCopied(false), 2000);
    });
  }

  return (
    <div
      className="relative rounded-2xl bg-[#161616] border border-[#2a2a2a] overflow-hidden transition-all hover:border-[#3a3a3a]"
      style={{ borderLeftColor: accent, borderLeftWidth: 4 }}
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
              <h3
                className="font-bold text-[15px] text-[#f0f0f0] leading-tight"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                {business.bizName}
              </h3>
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-full mt-1 inline-block capitalize"
                style={{ background: `${accent}22`, color: accent }}
              >
                {BIZ_TYPE_OPTIONS.find((o) => o.value === business.bizType)?.label ?? business.bizType}
              </span>
            </div>
          </div>
          {/* Edit / Delete buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onEdit(business)}
              title="Edit client"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#444] hover:text-[#f0f0f0] hover:bg-[#2a2a2a] transition-all"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setConfirming(true)}
              title="Delete client"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#444] hover:text-red-400 hover:bg-red-400/10 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {business.location && (
          <p className="text-[12px] text-[#888] mb-1 truncate">{business.location}</p>
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
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <LinkIcon className="w-3.5 h-3.5" />
            )}
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button
            onClick={() => setShowQR(true)}
            title="Get QR Code"
            className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-xl border border-[#2a2a2a] bg-[#1f1f1f] text-[#888] hover:text-[#f0f0f0] hover:border-[#3a3a3a] transition-all"
          >
            <QrCode className="w-3.5 h-3.5" />
            QR
          </button>
          <button
            onClick={handleOpenBot}
            className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-xl text-white transition-all flex-1 justify-center"
            style={{ background: accent }}
          >
            Open Bot
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* WhatsApp intro message */}
        <button
          onClick={handleCopyIntroMessage}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-xl border border-dashed border-[#2a2a2a] text-[#666] hover:text-green-400 hover:border-green-500/40 hover:bg-green-500/5 transition-all"
        >
          {introCopied ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <MessageSquare className="w-3.5 h-3.5" />
          )}
          {introCopied ? "Copied to clipboard!" : "Copy WhatsApp Intro Message"}
        </button>

        {/* Promo generator */}
        <button
          onClick={handleGeneratePromo}
          disabled={promoLoading}
          className="mt-2 w-full flex items-center justify-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-xl border border-dashed border-[#2a2a2a] text-[#666] hover:text-violet-400 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {promoLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {promoLoading ? "Generating idea…" : "✨ Generate Promo Idea"}
        </button>

        {/* Promo result */}
        {promoError && (
          <p className="mt-2 text-[11px] text-red-400 px-1">{promoError}</p>
        )}
        {promoCaption && (
          <div className="mt-3 rounded-xl bg-[#0f0f0f] border border-violet-500/20 p-3.5">
            <p className="text-[12px] text-[#ccc] leading-relaxed whitespace-pre-wrap">{promoCaption}</p>
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#1f1f1f]">
              <span className="text-[10px] text-[#444]">AI-generated caption</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPromoCaption(null)}
                  className="text-[11px] text-[#555] hover:text-[#888] transition-colors"
                >
                  Dismiss
                </button>
                <button
                  onClick={handleCopyCaption}
                  className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 transition-colors"
                >
                  {promoCopied ? (
                    <><Check className="w-3 h-3" /> Copied!</>
                  ) : (
                    <><Copy className="w-3 h-3" /> Copy</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QR Code modal */}
      {showQR && (
        <QRModal
          bizName={business.bizName}
          url={chatUrl}
          accent={accent}
          onClose={() => setShowQR(false)}
        />
      )}

      {/* Confirmation overlay */}
      {confirming && (
        <div className="absolute inset-0 bg-[#0d0d0d]/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-5 rounded-2xl">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-semibold text-[#f0f0f0]">Delete {business.bizName}?</p>
            <p className="text-[12px] text-[#666] mt-1">This cannot be undone.</p>
          </div>
          <div className="flex gap-2 w-full">
            <button
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="flex-1 py-2 rounded-xl border border-[#2a2a2a] text-[13px] text-[#888] hover:text-[#f0f0f0] hover:border-[#3a3a3a] transition-all disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-2 rounded-xl bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Business Form Modal (add + edit) ─────────────────────────────────────────

const EMPTY_FORM = {
  bizName: "",
  bizType: "wig",
  phone: "",
  services: "",
  location: "",
  howToOrder: "",
  instagram: "",
  personality: "",
  welcomeMsg: "",
  accentColor: "#7c6af7",
};

function businessToForm(b: Business): typeof EMPTY_FORM {
  return {
    bizName: b.bizName,
    bizType: b.bizType,
    phone: b.phone ?? "",
    services: b.services ?? "",
    location: b.location ?? "",
    howToOrder: b.howToOrder ?? "",
    instagram: b.instagram ?? "",
    personality: b.personality ?? "",
    welcomeMsg: b.welcomeMsg ?? "",
    accentColor: b.accentColor ?? "#7c6af7",
  };
}

function AddBusinessModal({
  onClose,
  onAdded,
  onUpdated,
  editBusiness,
}: {
  onClose: () => void;
  onAdded: (b: Business) => void;
  onUpdated: (b: Business) => void;
  editBusiness?: Business;
}) {
  const isEdit = !!editBusiness;
  const [form, setForm] = useState(isEdit ? businessToForm(editBusiness!) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const url = isEdit ? `/api/businesses/${editBusiness!.id}` : "/api/businesses";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to save.");
        return;
      }
      const result = (await res.json()) as Business;
      if (isEdit) {
        onUpdated(result);
      } else {
        onAdded(result);
      }
      onClose();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full bg-[#111] border border-[#2a2a2a] text-[#f0f0f0] placeholder-[#444] rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-[#555] transition-colors";
  const labelCls = "block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-[480px] bg-[#0d0d0d] border border-[#2a2a2a] rounded-t-3xl max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#1f1f1f]">
          <h2 className="font-bold text-[17px] text-[#f0f0f0]" style={{ fontFamily: "Syne, sans-serif" }}>
            {isEdit ? "Edit Business" : "Add New Business"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1f1f1f] flex items-center justify-center text-[#888] hover:text-[#f0f0f0] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {/* Name + Type row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelCls}>Business Name *</label>
              <input
                className={inputCls}
                placeholder="e.g. Glam by Kemi"
                value={form.bizName}
                onChange={(e) => set("bizName", e.target.value)}
                required
              />
            </div>
            <div className="w-40">
              <label className={labelCls}>Type *</label>
              <select
                className={inputCls + " cursor-pointer"}
                value={form.bizType}
                onChange={(e) => set("bizType", e.target.value)}
                required
              >
                {BIZ_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} style={{ background: "#111" }}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Services & Prices</label>
            <textarea
              className={inputCls + " resize-none"}
              rows={4}
              placeholder={"Haircut — ₦3,000\nColoring — ₦8,000"}
              value={form.services}
              onChange={(e) => set("services", e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>Location & Availability</label>
            <input
              className={inputCls}
              placeholder="Lagos Island, available Mon–Sat"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>Phone (WhatsApp number)</label>
            <input
              className={inputCls}
              placeholder="2348012345678 (no + or spaces)"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>How to Order / Book</label>
            <input
              className={inputCls}
              placeholder="DM on Instagram or call 080XXXXXXXX"
              value={form.howToOrder}
              onChange={(e) => set("howToOrder", e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>Instagram Handle</label>
            <input
              className={inputCls}
              placeholder="@yourbusiness"
              value={form.instagram}
              onChange={(e) => set("instagram", e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>Personality / Tone</label>
            <input
              className={inputCls}
              placeholder="Friendly, uses emojis, professional"
              value={form.personality}
              onChange={(e) => set("personality", e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>Welcome Message</label>
            <input
              className={inputCls}
              placeholder="Hey! 👋 Welcome to …"
              value={form.welcomeMsg}
              onChange={(e) => set("welcomeMsg", e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>Accent Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.accentColor}
                onChange={(e) => set("accentColor", e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0"
              />
              <input
                className={inputCls + " flex-1 font-mono"}
                placeholder="#7c6af7"
                value={form.accentColor}
                onChange={(e) => set("accentColor", e.target.value)}
                maxLength={7}
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-[13px]">{error}</p>}
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#1f1f1f]">
          <button
            type="submit"
            disabled={saving || !form.bizName.trim()}
            onClick={handleSubmit}
            className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold rounded-xl py-3 text-[14px] hover:bg-zinc-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : isEdit ? (
              <>
                <Check className="w-4 h-4" />
                Save Changes
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Business
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Leads Inbox ───────────────────────────────────────────────────────────────

const INTENT_STYLES: Record<BookingIntent, { label: string; cls: string }> = {
  high:   { label: "High intent",   cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  medium: { label: "Medium intent", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  low:    { label: "Low intent",    cls: "bg-[#2a2a2a] text-[#888] border-[#333]" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function LeadsInbox({ businesses }: { businesses: Business[] }) {
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterBiz, setFilterBiz]   = useState<string>("all");

  const bizMap = Object.fromEntries(businesses.map((b) => [b.id, b]));

  useEffect(() => {
    const url = filterBiz !== "all" ? `/api/leads?businessId=${filterBiz}` : "/api/leads";
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((data) => setLeads(data as Lead[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterBiz]);

  const displayed = leads;

  return (
    <div className="flex-1 px-4 pb-8 flex flex-col gap-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2 mt-1 mb-1">
        <select
          value={filterBiz}
          onChange={(e) => setFilterBiz(e.target.value)}
          className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] text-[#ccc] text-[13px] rounded-xl px-3 py-2.5 outline-none focus:border-[#7c6af7] transition-colors"
        >
          <option value="all">All businesses</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>{b.bizName}</option>
          ))}
        </select>
        <button
          onClick={() => {
            setLoading(true);
            const url = filterBiz !== "all" ? `/api/leads?businessId=${filterBiz}` : "/api/leads";
            fetch(url).then((r) => r.json()).then((d) => setLeads(d as Lead[])).catch(() => {}).finally(() => setLoading(false));
          }}
          className="p-2.5 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-[#555] hover:text-[#ccc] hover:border-[#3a3a3a] transition-colors"
          title="Refresh"
        >
          <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#444]" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Inbox className="w-8 h-8 text-[#333]" />
          <p className="text-[13px] text-[#555]">No leads yet</p>
          <p className="text-[11px] text-[#444]">They'll appear here when customers use the WhatsApp handoff</p>
        </div>
      ) : (
        displayed.map((lead) => {
          const biz = bizMap[lead.businessId];
          const intent = INTENT_STYLES[lead.bookingIntent] ?? INTENT_STYLES.low;
          const waText = encodeURIComponent(
            `Hi! Following up from our chat — ${lead.summaryText || "you were interested in our services"}.`
          );
          const waUrl = biz?.phone ? `https://wa.me/${biz.phone}?text=${waText}` : null;

          return (
            <div
              key={lead.id}
              className="rounded-2xl bg-[#111] border border-[#1f1f1f] p-4 flex flex-col gap-3"
            >
              {/* Top row: biz name + intent badge + time */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#f0f0f0] truncate">
                    {biz?.bizName ?? lead.businessId}
                  </p>
                  <p className="text-[11px] text-[#555] mt-0.5">{timeAgo(lead.timestamp)}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${intent.cls}`}>
                  {intent.label}
                </span>
              </div>

              {/* Services interested */}
              {lead.servicesInterested.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {lead.servicesInterested.map((s, i) => (
                    <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-[#1f1f1f] border border-[#2a2a2a] text-[#aaa]">
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {/* Summary */}
              {lead.summaryText && (
                <p className="text-[12px] text-[#777] leading-relaxed line-clamp-3">
                  {lead.summaryText}
                </p>
              )}

              {/* Footer: message count + WhatsApp button */}
              <div className="flex items-center justify-between pt-1 border-t border-[#1f1f1f]">
                <span className="text-[11px] text-[#444]">
                  {lead.conversationLength} {lead.conversationLength === 1 ? "message" : "messages"}
                </span>
                {waUrl ? (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Message on WhatsApp
                  </a>
                ) : (
                  <span className="text-[11px] text-[#444]">No phone on file</span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Admin Page ────────────────────────────────────────────────────────────────

const LEADS_VIEWED_KEY = "botforge_leads_last_viewed";

function getLastViewed(): number {
  const raw = localStorage.getItem(LEADS_VIEWED_KEY);
  return raw ? parseInt(raw, 10) : 0;
}

function countNewLeads(leads: Lead[]): number {
  const lastViewed = getLastViewed();
  return leads.filter((l) => new Date(l.timestamp).getTime() > lastViewed).length;
}

export default function AdminPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBusiness, setEditBusiness] = useState<Business | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"clients" | "leads">("clients");
  const [newLeadsCount, setNewLeadsCount] = useState(0);

  useEffect(() => {
    fetch("/api/businesses")
      .then((r) => r.json())
      .then((data) => setBusinesses(data as Business[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function refreshBadge() {
      fetch("/api/leads")
        .then((r) => r.json())
        .then((data) => setNewLeadsCount(countNewLeads(data as Lead[])))
        .catch(() => {});
    }
    refreshBadge();
    const id = setInterval(refreshBadge, 30_000);
    return () => clearInterval(id);
  }, []);

  function handleLeadsTabClick() {
    setActiveTab("leads");
    localStorage.setItem(LEADS_VIEWED_KEY, Date.now().toString());
    setNewLeadsCount(0);
  }

  function handleAdded(b: Business) {
    setBusinesses((prev) => [...prev, b]);
  }

  function handleDeleted(id: string) {
    setBusinesses((prev) => prev.filter((b) => b.id !== id));
  }

  function handleUpdated(b: Business) {
    setBusinesses((prev) => prev.map((x) => (x.id === b.id ? b : x)));
  }

  function openEdit(b: Business) {
    setEditBusiness(b);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditBusiness(undefined);
  }

  return (
    <div className="flex justify-center bg-black min-h-screen dark">
      <div className="w-full max-w-[480px] min-h-[100dvh] flex flex-col bg-[#0d0d0d]">
        {/* Header */}
        <header className="px-5 pt-10 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-widest text-[#7c6af7] uppercase mb-2">
                Admin
              </p>
              <h1
                className="text-2xl font-bold text-[#f0f0f0]"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                Client Bots
              </h1>
              <p className="text-[13px] text-[#888] mt-1">
                {loading ? "Loading…" : `${businesses.length} ${businesses.length === 1 ? "client" : "clients"} configured`}
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

        {/* Tab bar */}
        <div className="flex gap-1 px-4 mb-2">
          <button
            onClick={() => setActiveTab("clients")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
              activeTab === "clients"
                ? "bg-[#1f1f1f] text-[#f0f0f0] border border-[#2a2a2a]"
                : "text-[#555] hover:text-[#888]"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Clients
          </button>
          <button
            onClick={handleLeadsTabClick}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
              activeTab === "leads"
                ? "bg-[#1f1f1f] text-[#f0f0f0] border border-[#2a2a2a]"
                : "text-[#555] hover:text-[#888]"
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            Leads
            {newLeadsCount > 0 && (
              <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
                {newLeadsCount > 99 ? "99+" : newLeadsCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "clients" ? (
          <div className="flex-1 px-4 pb-8 flex flex-col gap-3">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-[#444]" />
              </div>
            ) : (
              businesses.map((b) => <ClientCard key={b.id} business={b} onDeleted={handleDeleted} onEdit={openEdit} />)
            )}

            {/* Add new */}
            <button
              onClick={() => { setEditBusiness(undefined); setShowForm(true); }}
              className="rounded-2xl border border-dashed border-[#2a2a2a] p-5 flex items-center gap-4 mt-2 hover:border-[#3a3a3a] hover:bg-[#111] transition-all w-full text-left"
            >
              <div className="w-11 h-11 rounded-full bg-[#1f1f1f] border border-[#2a2a2a] flex items-center justify-center text-[#555] text-xl">
                +
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#888]">Add a new client</p>
                <p className="text-[11px] text-[#555] mt-0.5">Fill in the form — no code needed</p>
              </div>
            </button>
          </div>
        ) : (
          <LeadsInbox businesses={businesses} />
        )}

        {/* Footer */}
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

      {showForm && (
        <AddBusinessModal
          onClose={closeForm}
          onAdded={handleAdded}
          onUpdated={handleUpdated}
          editBusiness={editBusiness}
        />
      )}
    </div>
  );
}
