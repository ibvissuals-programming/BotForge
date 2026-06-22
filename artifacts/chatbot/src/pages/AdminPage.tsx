import { useState, useCallback, useEffect } from "react";
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
} from "lucide-react";
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

// ── Client Card ───────────────────────────────────────────────────────────────

function ClientCard({
  business,
  onDeleted,
}: {
  business: Business;
  onDeleted: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
          {/* Delete button */}
          <button
            onClick={() => setConfirming(true)}
            title="Delete client"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#444] hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
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
            onClick={handleOpenBot}
            className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-xl text-white transition-all flex-1 justify-center"
            style={{ background: accent }}
          >
            Open Bot
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

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

// ── Add Business Form ─────────────────────────────────────────────────────────

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

function AddBusinessModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (b: Business) => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
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
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to save.");
        return;
      }
      const created = (await res.json()) as Business;
      onAdded(created);
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
            Add New Business
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

// ── Admin Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch("/api/businesses")
      .then((r) => r.json())
      .then((data) => setBusinesses(data as Business[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleAdded(b: Business) {
    setBusinesses((prev) => [...prev, b]);
  }

  function handleDeleted(id: string) {
    setBusinesses((prev) => prev.filter((b) => b.id !== id));
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

        {/* Cards */}
        <div className="flex-1 px-4 pb-8 flex flex-col gap-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#444]" />
            </div>
          ) : (
            businesses.map((b) => <ClientCard key={b.id} business={b} onDeleted={handleDeleted} />)
          )}

          {/* Add new */}
          <button
            onClick={() => setShowForm(true)}
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
        <AddBusinessModal onClose={() => setShowForm(false)} onAdded={handleAdded} />
      )}
    </div>
  );
}
