// ============================================================
// PARLOVA DESIGN SYSTEM — Tokens for React Native
// Source: Parlova Brand Book v1.0 (colors_and_type.css)
// ============================================================
//
// Agent rules (from brand book section 10):
//   1. Never use raw hex values in component code — import from this file.
//   2. Two-font system: FONTS.display for headings/CTAs, FONTS.sans for body/UI.
//      Never use Inter, Roboto, system defaults, etc.
//   3. All colours must map to a token here. Propose a new token rather than
//      silently using an unlisted hex.
//   4. No gradients, textures, or text shadows. SHADOWS.card is the only shadow.

export const COLORS = {
    // Brand palette
    primary:      "#dd4455", // Strawberry — CTA, logo, accents
    primaryDark:  "#993556", // Deep Rose — hover, emphasis
    primaryLight: "#f4c0d1", // Blush — secondary accents, badges
    primaryPale:  "#fbeaf0", // Cream — page bg, hover fills

    // Neutrals
    white:        "#ffffff",
    surface:      "#ffffff", // card / input backgrounds
    bg:           "#fbeaf0", // page background (cream blush)
    bgAlt:        "#faf8f9", // alternate white-gray bg

    // Text
    ink:          "#171717", // primary text
    inkMuted:     "#6b7280", // secondary text, labels
    inkSubtle:    "#9ca3af", // placeholders, captions, disabled

    // Borders
    border:       "#f3e2e8", // blush-tinted border
    borderInput:  "#d1d5db", // input borders (gray-300)

    // States
    error:        "#ef4444",
    errorBg:      "#fef2f2",
    focusRing:    "rgba(221, 68, 85, 0.2)", // primary/20

    // Chat bubble colors (map brand palette → iMessage-style bubbles)
    bubbleSent:   "#dd4455", // Strawberry (user messages)
    bubbleRecv:   "#fbeaf0", // Cream (AI messages)
    bubbleTextSent: "#ffffff",
    bubbleTextRecv: "#171717",
} as const;

// ─── TYPOGRAPHY ────────────────────────────────────────────
// Font family keys match the weight-specific exports from
// @expo-google-fonts/bricolage-grotesque and @expo-google-fonts/dm-sans.
// See App.tsx for the useFonts() registration.

export const FONTS = {
    // Display — Bricolage Grotesque — headings, hero, CTAs, logo
    display: "BricolageGrotesque_700Bold",
    displayBold: "BricolageGrotesque_800ExtraBold",
    displaySemi: "BricolageGrotesque_600SemiBold",
    displayMedium: "BricolageGrotesque_500Medium",
    displayRegular: "BricolageGrotesque_400Regular",

    // Sans — DM Sans — body, labels, UI copy
    sans: "DMSans_400Regular",
    sansMedium: "DMSans_500Medium",
    sansSemi: "DMSans_600SemiBold",
    sansBold: "DMSans_700Bold",
} as const;

// Back-compat for any old imports — body font.
export const FONT_FAMILY = FONTS.sans;

export const SIZES = {
    xs:   12,
    sm:   14,
    base: 16,
    lg:   18,
    xl:   20,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
    "5xl": 48,
} as const;

// 4px base spacing scale (brand book section 06)
export const SPACING = {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
    20: 80,
} as const;

export const RADIUS = {
    sm:   6,
    md:   8,   // buttons, inputs
    lg:   12,  // insets, pills
    xl:   16,  // cards
    pill: 999,
} as const;

// Card shadow — the ONE permitted shadow per rule #4.
// 0 20px 60px -10px rgba(153, 53, 86, 0.12)
export const SHADOWS = {
    card: {
        shadowColor: "#993556",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.12,
        shadowRadius: 30,
        elevation: 6,
    },
} as const;
