/**
 * BotForge WhatsApp link utilities.
 * All WhatsApp URL construction goes through here — never hardcode wa.me links elsewhere.
 */

/**
 * Build a wa.me link for the given phone number.
 * @param phone   Raw digits only, e.g. "2348163716199"
 * @param message Optional prefill text; will be URI-encoded automatically.
 */
export function buildWhatsAppLink(phone: string, message?: string): string {
  const base = `https://wa.me/${phone.replace(/\D/g, "")}`;
  if (!message?.trim()) return base;
  return `${base}?text=${encodeURIComponent(message.trim())}`;
}
