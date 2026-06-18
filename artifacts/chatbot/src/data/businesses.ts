export interface BusinessConfig {
  id: string;
  bizName: string;
  bizType: string;
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
      "Hey love! 💕 Welcome to Styled By Fortune — where tired wigs come back to life! ✨",
    accentColor: "#b5517a",
  },
];

export default businesses;
