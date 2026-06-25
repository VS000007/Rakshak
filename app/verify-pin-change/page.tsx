"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";

type Status = "loading" | "success" | "expired" | "already_used" | "invalid" | "writing";

export default function VerifyPinChangePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <Loader2 className="w-14 h-14 text-amber-400 animate-spin" />
      </div>
    }>
      <VerifyPinChangeContent />
    </Suspense>
  );
}

function VerifyPinChangeContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const token = params.get("token");
    const urlStatus = params.get("status") as Status | null;
    const payload = params.get("payload");

    // If redirected back from /api/pin/verify with a status already set
    if (urlStatus && urlStatus !== "loading") {
      if (urlStatus === "success" && payload) {
        setStatus("writing");
        // payload is "salt:hash" — write it to localStorage to activate the new PIN
        try {
          const decoded = decodeURIComponent(payload);
          const [salt, hash] = decoded.split(":");
          if (salt && hash) {
            localStorage.setItem("rakshak_vault_hash", hash);
            localStorage.setItem("rakshak_vault_salt", salt);
            setStatus("success");
          } else {
            setStatus("invalid");
          }
        } catch {
          setStatus("invalid");
        }
        return;
      }
      setStatus(urlStatus);
      return;
    }

    // If page loaded with a raw token (user clicked the email link directly)
    if (token) {
      // Forward to API route which will redirect back with status
      window.location.href = `/api/pin/verify?token=${encodeURIComponent(token)}`;
      return;
    }

    // No token, no status — shouldn't happen
    setStatus("invalid");
  }, [params]);

  const renderContent = () => {
    switch (status) {
      case "loading":
      case "writing":
        return (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-14 h-14 text-amber-400 animate-spin" />
            <h1 className="text-2xl font-bold text-white">Verifying…</h1>
            <p className="text-gray-400 text-sm">Activating your new security PIN. Please wait.</p>
          </div>
        );

      case "success":
        return (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-green-900/40 border border-green-500/40 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">PIN Activated!</h1>
            <p className="text-gray-300 text-sm text-center leading-relaxed max-w-xs">
              ✅ Your new security PIN has been successfully activated.<br />
              Your incident archive is now protected with the new PIN.
            </p>
            <Link
              href="/vault"
              className="mt-4 px-8 py-3 bg-green-900/60 hover:bg-green-900 border border-green-500/40 text-green-200 font-bold rounded-xl transition-colors"
            >
              Go to Vault →
            </Link>
          </div>
        );

      case "expired":
        return (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-orange-900/40 border border-orange-500/40 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-orange-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Link Expired</h1>
            <p className="text-gray-300 text-sm text-center leading-relaxed max-w-xs">
              ⚠️ This confirmation link has expired (valid for 15 minutes only).<br />
              Your old PIN remains active. Please go back to the app and request a new PIN change.
            </p>
            <Link href="/vault" className="mt-4 px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors">
              ← Back to Vault
            </Link>
          </div>
        );

      case "already_used":
        return (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-red-900/40 border border-red-500/40 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Link Already Used</h1>
            <p className="text-gray-300 text-sm text-center leading-relaxed max-w-xs">
              ⚠️ This confirmation link has already been used and is no longer valid.<br />
              Each link can only be used once. Your current PIN is active.
            </p>
            <Link href="/vault" className="mt-4 px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors">
              ← Back to Vault
            </Link>
          </div>
        );

      case "invalid":
      default:
        return (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-red-900/40 border border-red-500/40 flex items-center justify-center">
              <ShieldAlert className="w-10 h-10 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Invalid Link</h1>
            <p className="text-gray-300 text-sm text-center leading-relaxed max-w-xs">
              This link is invalid or has already been used. Your current PIN remains unchanged.
            </p>
            <Link href="/vault" className="mt-4 px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors">
              ← Back to Vault
            </Link>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      <div className="bg-[#111] border border-white/10 rounded-2xl p-10 w-full max-w-md shadow-2xl text-center">
        <p className="text-xs tracking-widest uppercase text-amber-600 mb-6 font-semibold">
          Rakshak · Security Verification
        </p>
        {renderContent()}
      </div>
    </div>
  );
}
