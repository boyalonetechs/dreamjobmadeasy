import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import Chrome from "@/components/Chrome";

export const metadata: Metadata = {
  title: "Dream Job Made Easy — the audiobook for getting hired",
  description:
    "An 8-part audiobook on CVs, interviews and salary talk. Unlock every chapter with Paystack or PayPal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Chrome>{children}</Chrome>
        </AuthProvider>
      </body>
    </html>
  );
}
