"use client";

import { useRouter } from "next/navigation";
import { setAccount } from "@/lib/memory";
import type { Account } from "@/types";

interface AccountCardProps {
  account: Account;
  displayName: string;
}

export default function AccountCard({ account, displayName }: AccountCardProps) {
  const router = useRouter();

  const handleSelect = () => {
    setAccount(account);
    router.push("/chat");
  };

  return (
    <button
      onClick={handleSelect}
      className="group w-full max-w-sm p-8 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 border border-gray-200 hover:border-[#25D366] text-left"
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full whatsapp-green flex items-center justify-center text-white font-bold text-xl">
          {displayName[0]}
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-1">{displayName}</h2>
          <p className="text-gray-500 text-sm">User Account</p>
        </div>
      </div>
    </button>
  );
}

