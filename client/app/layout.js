import { Baloo_2, Inter } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import Footer from "@/components/layout/Footer";
import "./globals.css";

const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-baloo",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Dhaka Tesla Pool",
  description: "Your Tesla is waiting in Dhaka. Share a seat, split the fare.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${baloo.variable} ${inter.variable}`}>
      <body className="flex flex-col min-h-screen">
        <AuthProvider>
          <div className="flex-1">{children}</div>
        </AuthProvider>
        <Footer />
      </body>
    </html>
  );
}