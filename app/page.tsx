"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAccount } from "@/lib/memory";
import AccountCard from "@/components/AccountCard";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to chat if account is already selected
    const account = getAccount();
    if (account) {
      router.push("/chat");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-7xl mx-auto flex gap-6 items-center">
          <Link href="/" className="text-[#075E54] font-semibold text-lg">
            <span className="font-bold text-xl">Vida</span>
          </Link>
          <div className="flex gap-4 ml-auto">
            <Link href="/" className="text-[#075E54] font-semibold">
              Home
            </Link>
            <Link href="/chat" className="text-gray-600 hover:text-[#075E54] transition-colors">
              Chat
            </Link>
            <Link href="/restaurants" className="text-gray-600 hover:text-[#075E54] transition-colors">
              Restaurants
            </Link>
            <Link href="/insights" className="text-gray-600 hover:text-[#075E54] transition-colors">
              Insights
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full whatsapp-green flex items-center justify-center text-white font-bold text-3xl">
              V
            </div>
            <h1 className="text-5xl font-bold mb-4 text-gray-800">
              <span className="text-[#075E54]">Vida</span> AI Agent
            </h1>
            <p className="text-xl text-gray-600 mb-2">
              Intelligent Restaurant Concierge
            </p>
            <p className="text-sm text-gray-500">
              Powered by AI • WhatsApp Integration Ready
            </p>
          </div>
          
          <div className="mb-8 text-center">
            <p className="text-gray-600 text-lg mb-8">
              Choose an account to begin
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <AccountCard account="danny" displayName="Danny" />
            <AccountCard account="raphael" displayName="Raphael" />
          </div>
        </div>
      </main>
    </div>
  );
}
