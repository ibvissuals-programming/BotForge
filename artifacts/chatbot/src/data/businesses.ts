export interface BusinessConfig {
  id: string;
  bizName: string;
  bizType: string;
  phone?: string;
  services?: string;
  location?: string;
  howToOrder?: string;
  instagram?: string;
  personality?: string;
  welcomeMsg?: string;
  accentColor?: string;
}

const businesses: BusinessConfig[] = [
  {
    id: "styled-by-fortune",
    bizName: "Styled By Fortune",
    bizType: "wig",
    phone: "2348163716199",
    services: [
      "Washing & Deep Conditioning — ₦2,500",
      "Lace Cleaning — ₦1,500",
      "Restyling Straight — ₦2,500",
      "Restyling Waves — ₦2,500",
      "Restyling Curls — ₦3,000",
      "Ultimate Revamp All-in-One — ₦7,000",
      "Elastic Band Replacement — ₦800",
    ].join("\n"),
    location: "Port Harcourt, Rivers State",
    howToOrder: "Call or DM 08163716199",
    instagram: "@styled_by_fortune",
    personality:
      "Warm, glamorous, uses emojis, energetic and encouraging",
    welcomeMsg:
      "Got questions beyond what's above? Ask me anything about booking, timing, or your specific hair needs! 💕",
    accentColor: "#b5517a",
  },
  {
    id: "rossy-cakes-events-management",
    bizName: "Rossy Cakes & Events Management",
    bizType: "cake",
    phone: "2348066539706",
    services: [
      "Tagline: Making your moments sweeter and more memorable",
      "",
      "CAKE PRICE LIST (prices are per layer, in Naira):",
      "Bento Cake (4\") — ₦10,000",
      "Bento Cake (5\") — ₦12,000",
      "6\" Cake — ₦6,800",
      "7\" Cake — ₦7,500",
      "8\" Cake — ₦12,000",
      "10\" Cake — ₦27,500",
      "12\" Cake — ₦42,000",
      "14\" Cake — ₦55,000",
      "",
      "Custom designs are available. All cakes are freshly baked with quality ingredients. Orders should be placed in advance.",
    ].join("\n"),
    location: "33 Rumuchika Street, Mgbuakara, Off Elioparanwo Road",
    howToOrder: "Call or WhatsApp 08066539706 to place your order. Please order in advance and share your design ideas if you want a custom cake.",
    personality:
      "Warm, celebratory, and helpful. Excited about making special moments memorable. Uses friendly, encouraging language.",
    welcomeMsg:
      "Have a question about our cakes or events? Ask me anything — let's make your moment sweeter! 🎂",
    accentColor: "#e07a5f",
  },
];

export default businesses;
