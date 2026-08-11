import localFont from "next/font/local";

export const poppins = localFont({
  src: [
    {
      path: "../assets/fonts/poppins/poppins-400-latin.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/poppins/poppins-500-latin.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../assets/fonts/poppins/poppins-600-latin.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../assets/fonts/poppins/poppins-700-latin.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../assets/fonts/poppins/poppins-800-latin.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
  variable: "--font-poppins",
});

export const rubik = localFont({
  src: [
    {
      path: "../assets/fonts/rubik/rubik-700-latin.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../assets/fonts/rubik/rubik-800-latin.woff2",
      weight: "800",
      style: "normal",
    },
    {
      path: "../assets/fonts/rubik/rubik-900-latin.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
  variable: "--font-rubik",
});
