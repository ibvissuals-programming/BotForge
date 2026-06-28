/**
 * Shared Lead type used by /api/chat/summarize and /api/leads.
 * Designed to slot into a database, admin dashboard, or analytics system later.
 */
export type BookingIntent = "low" | "medium" | "high";

export interface Lead {
  id: string;
  businessId: string;
  timestamp: string;
  customerName: string | null;
  servicesInterested: string[];
  bookingIntent: BookingIntent;
  questionsAsked: string[];
  conversationLength: number;
  summaryText: string;
  contacted: boolean;
  note: string | null;
}
