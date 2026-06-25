"use client";

import { Lock, ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";
import VaultGuard from "@/components/VaultGuard";

export default function EvidenceVaultView() {

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex flex-col p-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
        <Link href="/dashboard" className="text-gray-400 hover:text-white transition flex items-center gap-2 font-medium">
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </Link>
        <div className="flex items-center gap-2 text-red-500 font-bold uppercase tracking-widest text-sm">
          <ShieldAlert className="w-5 h-5" /> Highly Confidential
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2">
          <Lock className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h1 className="text-3xl font-black uppercase tracking-widest text-white">Evidence Vault</h1>
          <p className="text-gray-400 text-sm max-w-sm mx-auto leading-relaxed">
            This secure sector contains encrypted local evidence archives. Enter your 6-digit authorized PIN to decrypt folder contents.
          </p>
        </div>

        <div className="bg-[#111] p-8 rounded-2xl border border-white/5 w-full shadow-2xl">
          <VaultGuard />
        </div>
      </div>
    </div>
  );
}
