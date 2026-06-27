import type { BookingIntent } from "@/lib/bizTypes";

// Frontend mirror of the backend Business type (api-server/src/routes/businesses.ts).
// Single source of truth for the Business shape used in AdminPage.
export interface Business {
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
  slug?: string | null;
}

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
