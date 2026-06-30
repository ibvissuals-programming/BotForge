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
  ChevronDown,
  Phone,
  Calendar,
  HelpCircle,
  Search,
  Activity,
  Play,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { buildShareableUrl, buildSlugUrl } from "@/lib/configUrl";
import { BIZ_EMOJIS, BIZ_TYPE_OPTIONS, type BookingIntent } from "@/lib/bizTypes";
import type { Business, Lead } from "@/lib/types";
import { exportLeadsToCSV } from "@/lib/csvExport";
import { adminFetch, clearAdminToken } from "@/lib/adminFetch";
import { isLightColor } from "@/lib/colorUtils";
import type { BotConfig } from "@workspace/api-client-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function businessToConfig(b: Business): BotConfig {
  return {
    bizName: b.bizName,
    bizType: b.bizType,
    phone: b.phone ?? null,
    services: b.services ?? null,
    location: b.location ?? null,
    howToOrder: b.howToOrder ?? null,
    instagram: b.instagram ?? null,
    personality: b.personality ?? null,
    welcomeMsg: b.welcomeMsg ?? null,
    accentColor: b.accentColor ?? null,
    backgroundTheme: b.backgroundTheme ?? "dark",
    lightThemePalette: b.lightThemePalette ?? null,
    lightThemeStyle: b.lightThemeStyle ?? "plain",
  };
}

function handleSignOut() {
  localStorage.removeItem("botforge_admin_session");
  clearAdminToken();
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
  leadCount,
  lastLeadAt,
  onViewLeads,
  weeklyMessages,
  weeklyLeads,
  lastActive,
  uncontactedCount,
}: {
  business: Business;
  onDeleted: (id: string) => void;
  onEdit: (b: Business) => void;
  leadCount: number;
  lastLeadAt: Date | null;
  onViewLeads: () => void;
  weeklyMessages: number;
  weeklyLeads: number;
  lastActive: string | null;
  uncontactedCount: number;
}) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoCaption, setPromoCaption] = useState<string | null>(null);
  const [promoCopied, setPromoCopied] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [introCopied, setIntroCopied] = useState(false);

  const accent = business.accentColor ?? "#7c6af7";

  const chatUrl = business.slug
    ? buildSlugUrl(business.slug)
    : buildShareableUrl(businessToConfig(business));

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(chatUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [chatUrl]);

  const handleOpenBot = useCallback(() => {
    window.location.href = chatUrl;
  }, [chatUrl]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await adminFetch(`/api/businesses/${business.id}`, { method: "DELETE" });
      if (res.ok) onDeleted(business.id);
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  async function runPromoFetch() {
    setPromoLoading(true);
    setPromoError(null);
    try {
      const res = await adminFetch("/api/promo/generate", {
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

  async function handleGeneratePromo() {
    setPromoCaption(null);
    await runPromoFetch();
  }

  async function handleRegeneratePromo() {
    await runPromoFetch();
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
              {leadCount > 0 && (
                <>
                  <span className="ml-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full inline-block bg-[#1f1f1f] border border-[#2a2a2a] text-[#888]">
                    {leadCount} {leadCount === 1 ? "lead" : "leads"}
                  </span>
                  {lastLeadAt && (
                    <span className="ml-1.5 text-[11px] text-[#555]">· {timeAgo(lastLeadAt.toISOString())}</span>
                  )}
                </>
              )}
              {uncontactedCount > 0 && (
                <span
                  onClick={(e) => { e.stopPropagation(); onViewLeads(); }}
                  className="ml-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full inline-block bg-amber-500/20 border border-amber-500/30 text-amber-400 cursor-pointer hover:bg-amber-500/30 transition-colors"
                >
                  {uncontactedCount} pending
                </span>
              )}
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
        {!business.location && !business.instagram && <div className="mb-1" />}

        <p className="text-[12px] text-[#555] mb-1 flex items-center gap-1.5">
          <MessageSquare className="w-3 h-3 shrink-0" />
          <span>
            <span className="text-[#888] font-medium">{weeklyMessages}</span>
            {" "}{weeklyMessages === 1 ? "message" : "messages"}
            {" · "}
            <span className="text-[#888] font-medium">{weeklyLeads}</span>
            {" "}{weeklyLeads === 1 ? "lead" : "leads"}
            {" this week"}
          </span>
        </p>
        <p className="text-[12px] text-[#555] mb-2 flex items-center gap-1.5">
          <Activity className="w-3 h-3 shrink-0" />
          <span>
            {lastActive
              ? <><span className="text-[#888]">Last active</span>{" "}{timeAgo(lastActive)}</>
              : <span className="text-[#444]">No activity yet</span>}
          </span>
        </p>

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
            onClick={() => window.open(chatUrl, "_blank")}
            title="Test bot in new tab"
            className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-xl border border-[#2a2a2a] bg-[#1f1f1f] text-[#888] hover:text-[#f0f0f0] hover:border-[#3a3a3a] transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Test Bot
          </button>
          <button
            onClick={handleOpenBot}
            className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-xl transition-all flex-1 justify-center ${isLightColor(accent) ? "text-gray-900" : "text-white"}`}
            style={{ background: accent }}
          >
            Open Bot
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {leadCount > 0 && (
          <button
            onClick={onViewLeads}
            className="mt-2 w-full flex items-center justify-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-xl border border-dashed border-[#2a2a2a] text-[#666] hover:text-[#f0f0f0] hover:border-[#444] hover:bg-[#1f1f1f] transition-all"
          >
            <Inbox className="w-3.5 h-3.5" />
            View {leadCount} {leadCount === 1 ? "lead" : "leads"} →
          </button>
        )}

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
            <p className={`text-[12px] leading-relaxed whitespace-pre-wrap transition-opacity ${promoLoading ? "text-[#555] opacity-50" : "text-[#ccc]"}`}>
              {promoLoading ? (
                <span className="flex items-center gap-2 text-[#555]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                  Generating idea…
                </span>
              ) : promoCaption}
            </p>
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#1f1f1f]">
              <span className="text-[10px] text-[#444]">AI-generated caption</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPromoCaption(null)}
                  disabled={promoLoading}
                  className="text-[11px] text-[#555] hover:text-[#888] transition-colors disabled:opacity-40"
                >
                  Dismiss
                </button>
                <button
                  onClick={handleRegeneratePromo}
                  disabled={promoLoading}
                  className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#1f1f1f] text-[#777] hover:text-[#bbb] hover:bg-[#2a2a2a] transition-colors disabled:opacity-40"
                >
                  <Loader2 className={`w-3 h-3 ${promoLoading ? "animate-spin" : ""}`} />
                  Regenerate
                </button>
                <button
                  onClick={handleCopyCaption}
                  disabled={promoLoading}
                  className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 transition-colors disabled:opacity-40"
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
  backgroundTheme: "dark",
  lightThemePalette: "",
  lightThemeStyle: "plain",
  slug: "",
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
    backgroundTheme: b.backgroundTheme ?? "dark",
    lightThemePalette: b.lightThemePalette ?? "",
    lightThemeStyle: b.lightThemeStyle ?? "plain",
    slug: b.slug ?? "",
  };
}

// Client-side mirror of the backend validateSlugFormat — gives instant feedback
// before the form is submitted. Auto-lowercasing and space→hyphen replacement
// happen in the onChange handler, so only leading/trailing hyphens can still
// produce an error here.
function validateSlugClient(slug: string): string {
  if (!slug) return "";
  if (slug.startsWith("-") || slug.endsWith("-")) return "Slug must not start or end with a hyphen.";
  return "";
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
  const [slugError, setSlugError] = useState("");

  function set(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSlugError("");

    // Catch any remaining slug format errors before hitting the network.
    if (form.slug) {
      const clientSlugErr = validateSlugClient(form.slug);
      if (clientSlugErr) {
        setSlugError(clientSlugErr);
        return;
      }
    }

    setSaving(true);
    try {
      const url = isEdit ? `/api/businesses/${editBusiness!.id}` : "/api/businesses";
      const method = isEdit ? "PUT" : "POST";
      const res = await adminFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        const errMsg = data.error ?? "Failed to save.";
        // Route slug-specific errors (conflict or format) to the slug field.
        if (res.status === 409 || errMsg.toLowerCase().includes("slug")) {
          setSlugError(errMsg);
        } else {
          setError(errMsg);
        }
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

          {/* Chatbot URL Slug */}
          <div>
            <label className={labelCls}>
              Chatbot URL Slug
              {!isEdit && (
                <span className="ml-1.5 text-[#444] normal-case tracking-normal font-normal">— optional</span>
              )}
            </label>
            <div
              className={`flex items-center bg-[#111] rounded-xl overflow-hidden transition-colors ${
                slugError
                  ? "border border-red-500/50"
                  : "border border-[#2a2a2a] focus-within:border-[#555]"
              }`}
            >
              <span className="pl-3 pr-0.5 text-[12px] text-[#444] select-none shrink-0 whitespace-nowrap">
                site.com/
              </span>
              <input
                className="flex-1 bg-transparent text-[#f0f0f0] placeholder-[#444] px-2 py-2.5 text-[13px] focus:outline-none min-w-0"
                placeholder={isEdit ? "required" : "auto-generated"}
                value={form.slug}
                onChange={(e) => {
                  const v = e.target.value
                    .toLowerCase()
                    .replace(/\s+/g, "-")
                    .replace(/[^a-z0-9-]/g, "");
                  set("slug", v);
                  setSlugError(validateSlugClient(v));
                }}
              />
            </div>
            {slugError ? (
              <p className="mt-1.5 text-[11px] text-red-400">{slugError}</p>
            ) : isEdit ? (
              <p className="mt-1.5 text-[11px] text-[#555]">
                Old URLs keep working after a rename — existing links are never broken.
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-[#555]">
                Leave blank to auto-generate from business name.
              </p>
            )}
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

          <div>
            <label className={labelCls}>Chatbot Theme</label>
            <div className="flex gap-2">
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("backgroundTheme", t)}
                  className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
                    form.backgroundTheme === t
                      ? "bg-white text-black"
                      : "bg-[#1a1a1a] text-[#888] hover:text-[#ccc] border border-[#2a2a2a]"
                  }`}
                >
                  {t === "dark" ? "Dark" : "Light"}
                </button>
              ))}
            </div>
          </div>

          {form.backgroundTheme === "light" && (
            <div>
              <label className={labelCls}>Light Theme Style</label>
              <div className="flex gap-2">
                {(["plain", "branded"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("lightThemeStyle", s)}
                    className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
                      form.lightThemeStyle === s
                        ? "bg-white text-black"
                        : "bg-[#1a1a1a] text-[#888] hover:text-[#ccc] border border-[#2a2a2a]"
                    }`}
                  >
                    {s === "plain" ? "Plain White" : "Branded"}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-[#555] leading-snug">
                {form.lightThemeStyle === "branded"
                  ? "Applies the custom colour palette stored for this business."
                  : "Generic white background with dark text — no custom palette."}
              </p>
            </div>
          )}

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

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── Lead Card ─────────────────────────────────────────────────────────────────

function LeadCard({
  lead,
  biz,
  onContactedChange,
}: {
  lead: Lead;
  biz: Business | undefined;
  onContactedChange: (id: string, contacted: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [contactedLoading, setContactedLoading] = useState(false);
  const [introCopied, setIntroCopied] = useState(false);
  const [noteText, setNoteText] = useState(lead.note ?? "");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const savedNoteRef = useRef(lead.note ?? "");

  const intent = INTENT_STYLES[lead.bookingIntent] ?? INTENT_STYLES.low;

  function handleCopyIntro(e: React.MouseEvent) {
    e.stopPropagation();
    const name = lead.customerName ?? "there";
    const services =
      lead.servicesInterested.length > 0
        ? lead.servicesInterested.join(" & ")
        : "your enquiry";
    const bizPart = biz?.bizName ? ` at ${biz.bizName}` : "";
    const msg = `Hi ${name}! Just following up on your interest in ${services}${bizPart} — when would be a good time to connect?`;
    navigator.clipboard.writeText(msg).then(() => {
      setIntroCopied(true);
      setTimeout(() => setIntroCopied(false), 2000);
    });
  }
  async function handleNoteBlur() {
    if (noteText === savedNoteRef.current) return;
    setNoteSaving(true);
    try {
      const res = await adminFetch(`/api/leads/${lead.id}/note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText }),
      });
      if (res.ok) {
        savedNoteRef.current = noteText;
        setNoteSaved(true);
        setTimeout(() => setNoteSaved(false), 2000);
      }
    } finally {
      setNoteSaving(false);
    }
  }

  const waText = encodeURIComponent(
    `Hi! Following up from our chat — ${lead.summaryText || "you were interested in our services"}.`
  );
  const waUrl = biz?.phone ? `https://wa.me/${biz.phone}?text=${waText}` : null;

  async function handleContactedToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setContactedLoading(true);
    const next = !lead.contacted;
    try {
      const res = await adminFetch(`/api/leads/${lead.id}/contacted`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacted: next }),
      });
      if (res.ok) onContactedChange(lead.id, next);
    } finally {
      setContactedLoading(false);
    }
  }

  return (
    <div className={`rounded-2xl bg-[#111] border transition-colors ${lead.contacted ? "border-green-500/20" : "border-amber-500/25"}`}>
      {/* ── Collapsed header — always visible ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-4 flex flex-col gap-3"
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[13px] font-semibold text-[#f0f0f0] truncate">
                {biz?.bizName ?? lead.businessId}
              </p>
              {lead.contacted && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-green-500/10 text-green-400 border-green-500/20 flex-shrink-0">
                  Contacted ✓
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#555] mt-0.5">{timeAgo(lead.timestamp)}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${intent.cls}`}>
              {intent.label}
            </span>
            <ChevronDown className={`w-4 h-4 text-[#444] transition-transform ${expanded ? "rotate-180" : ""}`} />
          </div>
        </div>

        {/* Services tags (always visible) */}
        {lead.servicesInterested.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {lead.servicesInterested.map((s, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-[#1f1f1f] border border-[#2a2a2a] text-[#aaa]">
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Summary — truncated when collapsed */}
        {lead.summaryText && !expanded && (
          <p className="text-[12px] text-[#777] leading-relaxed line-clamp-2">
            {lead.summaryText}
          </p>
        )}
      </button>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-4 border-t border-[#1f1f1f] pt-4">

          {/* Exact timestamp */}
          <div className="flex items-start gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#555] mt-0.5 flex-shrink-0" />
            <p className="text-[12px] text-[#888]">{formatTimestamp(lead.timestamp)}</p>
          </div>

          {/* Full summary */}
          {lead.summaryText && (
            <div>
              <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-1.5">Conversation Summary</p>
              <p className="text-[12px] text-[#aaa] leading-relaxed">{lead.summaryText}</p>
            </div>
          )}

          {/* Questions asked */}
          {lead.questionsAsked.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <HelpCircle className="w-3 h-3" />
                Questions Asked
              </p>
              <ul className="flex flex-col gap-1.5">
                {lead.questionsAsked.map((q, i) => (
                  <li key={i} className="text-[12px] text-[#999] leading-snug flex gap-2">
                    <span className="text-[#444] mt-px">›</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Note / follow-up memo */}
          <div>
            <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Pencil className="w-3 h-3" />
              Note
              {noteSaving && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
              {noteSaved && (
                <span className="text-green-400 text-[10px] font-semibold normal-case tracking-normal ml-1">
                  Saved ✓
                </span>
              )}
            </p>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder="Add a follow-up note…"
              rows={2}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#ccc] placeholder-[#444] text-[12px] rounded-xl px-3 py-2.5 outline-none focus:border-[#555] resize-none transition-colors leading-relaxed"
            />
          </div>

          {/* Footer: messages + WhatsApp + contacted */}
          <div className="flex items-center justify-between pt-2 border-t border-[#1f1f1f] gap-2 flex-wrap">
            <span className="text-[11px] text-[#444]">
              {lead.conversationLength} {lead.conversationLength === 1 ? "message" : "messages"}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Copy intro message */}
              <button
                onClick={handleCopyIntro}
                className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  introCopied
                    ? "bg-[#1f1f1f] text-green-400 border-green-500/30"
                    : "bg-[#1f1f1f] text-[#666] border-[#2a2a2a] hover:text-[#ccc] hover:border-[#3a3a3a]"
                }`}
              >
                {introCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {introCopied ? "Copied!" : "Copy Intro"}
              </button>

              {/* Contacted toggle */}
              <button
                onClick={handleContactedToggle}
                disabled={contactedLoading}
                className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                  lead.contacted
                    ? "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25"
                    : "bg-[#1f1f1f] text-[#666] border-[#2a2a2a] hover:text-[#ccc] hover:border-[#3a3a3a]"
                }`}
              >
                {contactedLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className={`w-3 h-3 ${lead.contacted ? "" : "opacity-40"}`} />
                )}
                {lead.contacted ? "Contacted" : "Mark Contacted"}
              </button>

              {/* WhatsApp */}
              {waUrl ? (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Message on WhatsApp
                </a>
              ) : (
                <span className="text-[11px] text-[#444]">No phone on file</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LeadsInbox({ businesses, initialFilterBiz = "all" }: { businesses: Business[]; initialFilterBiz?: string }) {
  const [leads, setLeads]         = useState<Lead[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filterBiz, setFilterBiz] = useState<string>(initialFilterBiz);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");

  const bizMap = Object.fromEntries(businesses.map((b) => [b.id, b]));
  const searchTerm = leadSearch.trim().toLowerCase();
  const displayedLeads = leads
    .filter((l) => (pendingOnly ? !l.contacted : true))
    .filter((l) => searchTerm ? (l.customerName?.toLowerCase().includes(searchTerm) ?? false) : true)
    .sort((a, b) => {
      if (a.contacted !== b.contacted) return a.contacted ? 1 : -1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  function fetchLeads(biz: string) {
    const url = biz !== "all" ? `/api/leads?businessId=${biz}` : "/api/leads";
    setLoading(true);
    adminFetch(url)
      .then((r) => r.json())
      .then((data) => setLeads(data as Lead[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchLeads(filterBiz); }, [filterBiz]);

  function handleContactedChange(id: string, contacted: boolean) {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, contacted } : l));
  }

  async function handleJsonBackup() {
    try {
      const res = await adminFetch("/api/admin/export");
      if (!res.ok) return;
      const data = await res.json() as Record<string, unknown>;
      const date = new Date().toISOString().slice(0, 10);
      const filename = `botforge-backup-${date}.json`;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent — export is best-effort
    }
  }

  return (
    <div className="flex-1 px-4 pb-8 flex flex-col gap-3">
      {/* Name search */}
      <div className="relative mt-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#444] pointer-events-none" />
        <input
          type="text"
          placeholder="Search by customer name…"
          value={leadSearch}
          onChange={(e) => setLeadSearch(e.target.value)}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#ccc] placeholder-[#444] text-[13px] rounded-xl pl-8 pr-3 py-2.5 outline-none focus:border-[#555] transition-colors"
        />
        {leadSearch && (
          <button
            onClick={() => setLeadSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter bar + Export */}
      <div className="flex items-center gap-2 mb-1">
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
          onClick={() => exportLeadsToCSV(displayedLeads, bizMap)}
          disabled={displayedLeads.length === 0}
          title="Export CSV"
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-[#555] hover:text-[#ccc] hover:border-[#3a3a3a] transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-[12px] font-medium"
        >
          <Download className="w-4 h-4" />
          CSV{displayedLeads.length > 0 && <> · {displayedLeads.length}</>}
        </button>
        <button
          onClick={handleJsonBackup}
          title="Download full JSON backup"
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-[#555] hover:text-[#ccc] hover:border-[#3a3a3a] transition-colors text-[12px] font-medium"
        >
          <Download className="w-4 h-4" />
          Backup
        </button>
        <button
          onClick={() => setPendingOnly((v) => !v)}
          title={pendingOnly ? "Show all leads" : "Show pending only"}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-[12px] font-medium transition-colors ${
            pendingOnly
              ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
              : "bg-[#1a1a1a] border-[#2a2a2a] text-[#555] hover:text-[#ccc] hover:border-[#3a3a3a]"
          }`}
        >
          Pending{pendingOnly ? " ✓" : ""}
        </button>
        <button
          onClick={() => fetchLeads(filterBiz)}
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
      ) : displayedLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Inbox className="w-8 h-8 text-[#333]" />
          {searchTerm && leads.length > 0 ? (
            <>
              <p className="text-[13px] text-[#555]">No leads match "{leadSearch.trim()}"</p>
              <p className="text-[11px] text-[#444]">Try a different name</p>
            </>
          ) : pendingOnly && leads.length > 0 ? (
            <>
              <p className="text-[13px] text-[#555]">All leads contacted</p>
              <p className="text-[11px] text-[#444]">No pending follow-ups remaining</p>
            </>
          ) : (
            <>
              <p className="text-[13px] text-[#555]">No leads yet</p>
              <p className="text-[11px] text-[#444]">They'll appear here when customers use the WhatsApp handoff</p>
            </>
          )}
        </div>
      ) : (
        displayedLeads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            biz={bizMap[lead.businessId]}
            onContactedChange={handleContactedChange}
          />
        ))
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
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [leadsJumpBiz, setLeadsJumpBiz] = useState<string | undefined>(undefined);
  const [weeklyStats, setWeeklyStats] = useState<Record<string, { messages: number; leads: number; lastActive: string | null }>>({});
  const [healthStatus, setHealthStatus] = useState<{ db: "ok" | "error"; groq: "ok" | "error" } | null>(null);

  const filteredBusinesses = clientSearch.trim()
    ? businesses.filter((b) =>
        b.bizName.toLowerCase().includes(clientSearch.trim().toLowerCase())
      )
    : businesses;

  const pendingCount = allLeads.filter((l) => !l.contacted).length;

  useEffect(() => {
    fetch("/api/businesses")
      .then((r) => r.json())
      .then((data) => setBusinesses(data as Business[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function refreshLeads() {
      adminFetch("/api/leads")
        .then((r) => r.json())
        .then((data) => {
          const leads = data as Lead[];
          setAllLeads(leads);
          setNewLeadsCount(countNewLeads(leads));
        })
        .catch(() => {});
    }
    refreshLeads();
    const id = setInterval(refreshLeads, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function refreshStats() {
      adminFetch("/api/stats/weekly")
        .then((r) => r.json())
        .then((data) => setWeeklyStats(data as Record<string, { messages: number; leads: number; lastActive: string | null }>))
        .catch(() => {});
    }
    refreshStats();
    const id = setInterval(refreshStats, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function checkHealth() {
      adminFetch("/api/health/status")
        .then((r) => r.json())
        .then((data) => setHealthStatus(data as { db: "ok" | "error"; groq: "ok" | "error" }))
        .catch(() => {});
    }
    checkHealth();
    const id = setInterval(checkHealth, 60_000);
    return () => clearInterval(id);
  }, []);

  function handleLeadsTabClick() {
    setActiveTab("leads");
    setLeadsJumpBiz(undefined);
    localStorage.setItem(LEADS_VIEWED_KEY, Date.now().toString());
    setNewLeadsCount(0);
  }

  function handleViewLeads(bizId: string) {
    setActiveTab("leads");
    setLeadsJumpBiz(bizId);
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
              {healthStatus && (
                <p className="text-[11px] text-[#555] mt-1.5 flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      healthStatus.db === "ok" && healthStatus.groq === "ok"
                        ? "bg-green-500"
                        : healthStatus.db === "ok" || healthStatus.groq === "ok"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                  />
                  {healthStatus.db === "ok" && healthStatus.groq === "ok"
                    ? "DB · Groq healthy"
                    : [
                        healthStatus.db !== "ok" ? "DB error" : null,
                        healthStatus.groq !== "ok" ? "Groq unreachable" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 mt-1">
              <a
                href="/showcase"
                target="_blank"
                rel="noopener noreferrer"
                title="Open Showcase deck in a new tab"
                className="flex items-center gap-1.5 text-[12px] text-[#555] hover:text-[#7c6af7] transition-colors px-3 py-2 rounded-xl hover:bg-[#1f1f1f]"
              >
                <Play className="w-3.5 h-3.5" />
                Showcase
              </a>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="flex items-center gap-1.5 text-[12px] text-[#555] hover:text-[#f0f0f0] transition-colors px-3 py-2 rounded-xl hover:bg-[#1f1f1f]"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </header>

        {/* Stats row */}
        {!loading && (
          <div className="flex gap-2 px-4 mb-4">
            {[
              {
                label: "Businesses",
                value: businesses.length,
                sub: null,
              },
              {
                label: "Total Leads",
                value: allLeads.length,
                sub: null,
              },
              {
                label: "Contacted",
                value: allLeads.filter((l) => l.contacted).length,
                sub: `${allLeads.length - allLeads.filter((l) => l.contacted).length} pending`,
              },
            ].map(({ label, value, sub }) => (
              <div
                key={label}
                className="flex-1 rounded-xl bg-[#111] border border-[#1f1f1f] px-3 py-2.5 flex flex-col gap-0.5"
              >
                <span className="text-[22px] font-bold text-[#f0f0f0] leading-none" style={{ fontFamily: "Syne, sans-serif" }}>
                  {value}
                </span>
                <span className="text-[10px] font-semibold text-[#555] uppercase tracking-wider">
                  {label}
                </span>
                {sub && (
                  <span className="text-[10px] text-[#444] mt-0.5">{sub}</span>
                )}
              </div>
            ))}
          </div>
        )}

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
            {pendingCount > 0 && (
              <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-500 text-black text-[10px] font-bold px-1 leading-none">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "clients" ? (
          <div className="flex-1 px-4 pb-8 flex flex-col gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#444] pointer-events-none" />
              <input
                type="text"
                placeholder="Search clients…"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#ccc] placeholder-[#444] text-[13px] rounded-xl pl-8 pr-3 py-2.5 outline-none focus:border-[#555] transition-colors"
              />
              {clientSearch && (
                <button
                  onClick={() => setClientSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-[#444]" />
              </div>
            ) : filteredBusinesses.length === 0 && businesses.length > 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <Search className="w-8 h-8 text-[#333]" />
                <p className="text-[13px] text-[#555]">No businesses match</p>
                <p className="text-[11px] text-[#444]">Try a different name</p>
              </div>
            ) : (
              filteredBusinesses.map((b) => (
                <ClientCard
                  key={b.id}
                  business={b}
                  onDeleted={handleDeleted}
                  onEdit={openEdit}
                  leadCount={allLeads.filter((l) => l.businessId === b.id).length}
                  lastLeadAt={(() => {
                    const bLeads = allLeads.filter((l) => l.businessId === b.id);
                    if (!bLeads.length) return null;
                    return new Date(Math.max(...bLeads.map((l) => new Date(l.timestamp).getTime())));
                  })()}
                  onViewLeads={() => handleViewLeads(b.id)}
                  weeklyMessages={weeklyStats[b.id]?.messages ?? 0}
                  weeklyLeads={weeklyStats[b.id]?.leads ?? 0}
                  lastActive={weeklyStats[b.id]?.lastActive ?? null}
                  uncontactedCount={allLeads.filter((l) => l.businessId === b.id && !l.contacted).length}
                />
              ))
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
          <LeadsInbox
            key={leadsJumpBiz ?? "all"}
            businesses={businesses}
            initialFilterBiz={leadsJumpBiz}
          />
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
