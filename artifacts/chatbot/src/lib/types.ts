import type { BookingIntent } from "@/lib/bizTypes";

// Frontend mirror of the backend Lead type (api-server/src/types/lead.ts).
// Single source of truth for the Lead shape used across ChatPage and AdminPage.
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
}
