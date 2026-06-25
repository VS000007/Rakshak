"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Eye, EyeOff, Lock, Unlock, FileVideo, FileAudio, Play, Download, AlertTriangle, KeyRound, Mail, CheckCircle2, Loader2, Timer } from "lucide-react";
import { useVault } from "@/hooks/useVault";

interface VaultRecord {
  id: string;
  mediaFile: Blob;
  timestamp: string;
  decryptionKey?: string;
  securedPin?: string;
}

export default function VaultGuard() {
  const {
    hasMasterPassword,
    isLocked,
    lockoutTimer,
    registeredEmail,
    setupMasterPassword,
    unlockVault,
    changePassword,
    resetVault,
    generateOtp,
    verifyOtp,
    resetPasswordWithoutDataLoss
  } = useVault();

  // Inputs
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Change Password Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"CHANGE" | "FORGOT" | "OTP">("CHANGE");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");
  const [changeAttempts, setChangeAttempts] = useState(0);

  // OTP State
  const [otpInputs, setOtpInputs] = useState<string[]>(Array(6).fill(""));
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpAttempts, setOtpAttempts] = useState(0);

  // Pending email state
  type EmailPendingState = {
    maskedEmail: string;
    expiresAt: string;
  } | null;
  const [emailPending, setEmailPending] = useState<EmailPendingState>(null);
  const [resendCooldown, setResendCooldown] = useState(0); // seconds until resend is allowed
  const [countdownSecs, setCountdownSecs] = useState(0); // seconds until link expires

  // Files State
  const [records, setRecords] = useState<VaultRecord[]>([]);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

  // Debounce handler helper
  const handleAction = async (action: () => Promise<void>) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");
    await action();
    setTimeout(() => setIsSubmitting(false), 1000);
  };

  // Countdown timer for email expiry and resend cooldown
  useEffect(() => {
    if (!emailPending) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(emailPending.expiresAt).getTime() - Date.now()) / 1000));
      setCountdownSecs(remaining);
      setResendCooldown(prev => Math.max(0, prev - 1));
      if (remaining === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [emailPending]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };


  const handleSetup = async () => {
    if (password.length < 6 || password.length > 20) {
      setErrorMsg("Password must be 6-20 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    const currentPinHash = typeof window !== 'undefined' ? localStorage.getItem('rakshak_vault_hash') ?? undefined : undefined;
    const currentSalt = typeof window !== 'undefined' ? localStorage.getItem('rakshak_vault_salt') ?? undefined : undefined;
    await handleAction(async () => {
      const res = await fetch('/api/pin/request-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPin: password, currentPinHash, currentSalt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to send verification email.');
        return;
      }
      setEmailPending({ maskedEmail: data.maskedEmail, expiresAt: data.expiresAt });
      setCountdownSecs(15 * 60);
      setResendCooldown(60);
      setPassword("");
      setConfirmPassword("");
    });
  };

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/pin/resend', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setEmailPending({ maskedEmail: data.maskedEmail, expiresAt: data.expiresAt });
        setCountdownSecs(15 * 60);
        setResendCooldown(60);
        setSuccessMsg('Email resent successfully.');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg(data.error || 'Failed to resend email.');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    }
    setIsSubmitting(false);
  };

  const handleUnlock = async () => {
    if (password.length < 4) {
      setErrorMsg("Invalid password.");
      return;
    }
    await handleAction(async () => {
      const success = await unlockVault(password);
      if (success) {
        setPassword(""); // Clear input on success
        fetchRecords();
      } else {
        setErrorMsg("Incorrect password.");
      }
    });
  };

  const handleChangePassword = async () => {
    setModalError("");
    if (newPassword.length < 4 || newPassword !== confirmNewPassword) {
      setModalError("New passwords must match and be 4-20 chars.");
      return;
    }
    if (changeAttempts >= 3) {
      setModalError("Too many failed attempts. Try again later.");
      return;
    }
    setIsSubmitting(true);
    const success = await changePassword(oldPassword, newPassword);
    if (success) {
      setModalSuccess("Password changed successfully.");
      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setTimeout(() => {
        setIsModalOpen(false);
        setModalSuccess("");
      }, 2000);
    } else {
      setModalError("Current password is incorrect.");
      setChangeAttempts(prev => prev + 1);
    }
    setIsSubmitting(false);
  };

  const handleResetVault = async () => {
    setIsSubmitting(true);
    await resetVault();
    setIsModalOpen(false);
    setModalMode("CHANGE");
    setIsSubmitting(false);
  };

  const handleOtpChange = (index: number, value: string) => {
    const val = value.replace(/\D/g, "").slice(-1);
    if (val) {
      const newOtp = [...otpInputs];
      newOtp[index] = val;
      setOtpInputs(newOtp);
      if (index < 5) otpRefs.current[index + 1]?.focus();
    } else {
      const newOtp = [...otpInputs];
      newOtp[index] = "";
      setOtpInputs(newOtp);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpInputs[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData) {
      const newOtp = [...otpInputs];
      for (let i = 0; i < pastedData.length; i++) {
        newOtp[i] = pastedData[i];
      }
      setOtpInputs(newOtp);
      const nextFocus = Math.min(pastedData.length, 5);
      otpRefs.current[nextFocus]?.focus();
    }
  };

  const submitOtp = async () => {
    const code = otpInputs.join("");
    if (code.length < 6) return;
    
    if (otpAttempts >= 5) {
      setModalError("Maximum OTP attempts reached.");
      return;
    }

    const { success, expired } = verifyOtp(code);
    if (expired) {
      setModalError("Code expired, request again.");
    } else if (success) {
      // Allow password reset without data loss
      if (newPassword.length >= 4 && newPassword === confirmNewPassword) {
        await resetPasswordWithoutDataLoss(newPassword);
        setModalSuccess("Password has been reset successfully!");
        setTimeout(() => {
          setIsModalOpen(false);
          setModalSuccess("");
        }, 2000);
      } else {
        setModalError("Enter valid new password before verifying OTP.");
      }
    } else {
      setModalError("Incorrect code.");
      setOtpAttempts(prev => prev + 1);
    }
  };

  // Fetch indexeddb files
  const fetchRecords = () => {
    const request = indexedDB.open("VibeSecurityAppDB", 1);
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (db.objectStoreNames.contains("evidence_vault")) {
        const transaction = db.transaction("evidence_vault", "readonly");
        const store = transaction.objectStore("evidence_vault");
        const getReq = store.getAll();
        getReq.onsuccess = () => {
          const result = getReq.result as VaultRecord[];
          // Sort by newest first
          result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setRecords(result);
        };
      }
    };
  };

  // Helper to format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handlePlayMedia = (record: VaultRecord) => {
    const url = URL.createObjectURL(record.mediaFile);
    setActiveVideoUrl(url);
  };

  return (
    <div className="w-full relative min-h-[300px] flex flex-col transition-all duration-300">
      
      {/* 1. SETUP VIEW */}
      {!hasMasterPassword && !emailPending && (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center mb-2">
            <h2 className="text-xl font-bold uppercase tracking-widest text-white">Set Personal Master Password</h2>
            <p className="text-sm text-gray-400 mt-1">A verification link will be sent to your registered email before your PIN is saved.</p>
          </div>
          <PasswordInput value={password} onChange={setPassword} placeholder="Enter New Password (6-20 chars)" showPassword={showPassword} setShowPassword={setShowPassword} />
          <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm Password" showPassword={showPassword} setShowPassword={setShowPassword} />
          {errorMsg && <p className="text-red-400 text-sm font-semibold">{errorMsg}</p>}
          {successMsg && <p className="text-green-400 text-sm font-semibold flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> {successMsg}</p>}
          <button
            onClick={handleSetup}
            disabled={isSubmitting || password.length < 6}
            className="mt-2 w-full bg-red-900/80 hover:bg-red-800 disabled:opacity-50 text-white font-bold uppercase tracking-wider py-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
            {isSubmitting ? 'Sending…' : 'Save PIN via Email'}
          </button>
        </div>
      )}

      {/* 1b. EMAIL PENDING STATE */}
      {!hasMasterPassword && emailPending && (
        <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Mail className="w-6 h-6 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-amber-200 text-sm">Verification email sent!</p>
                <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">
                  A confirmation link has been sent to <strong>{emailPending.maskedEmail}</strong>.<br />
                  Please check your inbox and click the link to activate your new PIN.
                </p>
              </div>
            </div>

            {countdownSecs > 0 && (
              <div className="flex items-center gap-2 bg-black/30 rounded-lg px-4 py-2">
                <Timer className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-gray-400">Link expires in</span>
                <span className="font-mono font-bold text-amber-400 text-sm">{formatCountdown(countdownSecs)}</span>
              </div>
            )}
            {countdownSecs === 0 && (
              <p className="text-xs text-red-400 font-semibold text-center">⚠️ Link expired. Please resend.</p>
            )}
          </div>

          {errorMsg && <p className="text-red-400 text-sm font-semibold">{errorMsg}</p>}
          {successMsg && <p className="text-green-400 text-sm font-semibold flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> {successMsg}</p>}

          <div className="flex flex-col gap-2">
            <button
              onClick={handleResendEmail}
              disabled={resendCooldown > 0 || isSubmitting}
              className="w-full bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 text-white text-sm font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend Email'}
            </button>
            <button
              onClick={() => setEmailPending(null)}
              className="text-xs text-gray-500 hover:text-white underline underline-offset-4 self-center"
            >
              Cancel &amp; try a different password
            </button>
          </div>
        </div>
      )}

      {/* 2. LOCKED VIEW */}
      {hasMasterPassword && isLocked && (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center mb-2">
            <h2 className="text-xl font-bold uppercase tracking-widest text-white">Access Incident Archive</h2>
            <p className="text-sm text-gray-400 mt-1">Enter your master password to unlock all recordings.</p>
          </div>
          
          <PasswordInput value={password} onChange={setPassword} placeholder="Master Password" showPassword={showPassword} setShowPassword={setShowPassword} disabled={lockoutTimer > 0} />
          
          {errorMsg && <p className="text-red-400 text-sm font-semibold">{errorMsg}</p>}
          
          <button 
            onClick={handleUnlock} 
            disabled={isSubmitting || password.length < 4 || lockoutTimer > 0} 
            className="w-full bg-red-900/80 hover:bg-red-800 disabled:opacity-50 text-white font-bold uppercase tracking-wider py-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {lockoutTimer > 0 ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            {lockoutTimer > 0 ? `Locked (${lockoutTimer}s)` : "Unlock Vault"}
          </button>

          <button 
            onClick={() => { setModalMode("CHANGE"); setIsModalOpen(true); }}
            className="text-xs text-gray-400 hover:text-white underline underline-offset-4 self-center mt-2"
          >
            Change or Reset Password
          </button>
        </div>
      )}

      {/* 3. UNLOCKED VIEW (FILE LIST) */}
      {!isLocked && (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between bg-green-900/20 border border-green-500/30 p-4 rounded-xl mb-4">
            <div className="flex items-center gap-2">
              <Unlock className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-bold tracking-widest uppercase">Vault Unlocked</span>
            </div>
          </div>

          {records.length === 0 ? (
            <div className="text-center p-8 bg-black/40 rounded-xl border border-white/5">
              <p className="text-gray-400">No recordings saved yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {records.map((record) => (
                <div key={record.id} className="bg-black/60 border border-white/10 rounded-xl p-4 flex flex-col gap-3 hover:border-white/20 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      {record.mediaFile.type.includes("video") ? <FileVideo className="w-8 h-8 text-blue-400" /> : <FileAudio className="w-8 h-8 text-orange-400" />}
                      <div>
                        <p className="font-mono text-sm text-gray-200">{record.id}</p>
                        <p className="text-xs text-gray-500">{new Date(record.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-gray-500 bg-white/5 px-2 py-1 rounded">{formatBytes(record.mediaFile.size)}</span>
                  </div>
                  <div className="flex gap-2 w-full mt-2">
                    <button onClick={() => handlePlayMedia(record)} className="flex-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
                      <Play className="w-4 h-4" /> Play
                    </button>
                    <a 
                      href={URL.createObjectURL(record.mediaFile)} 
                      download={`${record.id}.${record.mediaFile.type.includes("video") ? 'mp4' : 'webm'}`}
                      className="flex-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <Download className="w-4 h-4" /> Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeVideoUrl && (
            <div className="mt-4 p-2 bg-black/80 border border-white/10 rounded-xl">
              <video src={activeVideoUrl} controls autoPlay className="w-full rounded-lg" />
            </div>
          )}
        </div>
      )}

      {/* CHANGE / RESET PASSWORD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#111] border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl flex flex-col gap-4 relative">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">✕</button>
            
            <h3 className="text-xl font-bold uppercase tracking-widest text-white mb-2">
              {modalMode === "CHANGE" ? "Change Password" : modalMode === "FORGOT" ? "Reset Vault" : "Verify Email OTP"}
            </h3>

            {/* SCENARIO A: Change Password */}
            {modalMode === "CHANGE" && (
              <div className="flex flex-col gap-4">
                <PasswordInput value={oldPassword} onChange={setOldPassword} placeholder="Current Password" showPassword={showPassword} setShowPassword={setShowPassword} />
                <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="New Password" showPassword={showPassword} setShowPassword={setShowPassword} />
                <PasswordInput value={confirmNewPassword} onChange={setConfirmNewPassword} placeholder="Confirm New Password" showPassword={showPassword} setShowPassword={setShowPassword} />
                
                {modalError && <p className="text-red-400 text-sm">{modalError}</p>}
                {modalSuccess && <p className="text-green-400 text-sm flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/>{modalSuccess}</p>}
                
                <button onClick={handleChangePassword} disabled={isSubmitting} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-all mt-2">
                  Update Password
                </button>

                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-white/10">
                  <button onClick={() => setModalMode("FORGOT")} className="text-sm text-red-400 hover:text-red-300 self-center underline underline-offset-4">
                    Forgot Password?
                  </button>
                </div>
              </div>
            )}

            {/* SCENARIO B: Forgot -> Wipe Everything */}
            {modalMode === "FORGOT" && (
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-red-950/50 border border-red-500/50 p-4 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-red-500 font-bold"><AlertTriangle className="w-5 h-5"/> WARNING</div>
                  <p className="text-sm text-red-200 leading-relaxed font-semibold">
                    Resetting your password will permanently delete ALL saved incident recordings (audio and video). This action cannot be undone. Your emergency contacts and settings will NOT be affected.
                  </p>
                </div>
                
                <div className="flex flex-col gap-3 mt-2">
                  <button onClick={() => setModalMode("CHANGE")} className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-all">
                    CANCEL
                  </button>
                  <button onClick={handleResetVault} disabled={isSubmitting} className="w-full text-red-500/70 hover:text-red-500 text-xs font-black tracking-widest uppercase py-2">
                    I UNDERSTAND, RESET EVERYTHING
                  </button>
                </div>

                {/* SCENARIO C: Verify via Email (if exists) */}
                {registeredEmail && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <button onClick={() => { generateOtp(); setModalMode("OTP"); }} className="w-full bg-blue-900/30 hover:bg-blue-900/50 border border-blue-500/30 text-blue-300 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                      <Mail className="w-4 h-4" /> Verify via {registeredEmail}
                    </button>
                    <p className="text-xs text-gray-500 text-center mt-2">Allows password reset without deleting files.</p>
                  </div>
                )}
              </div>
            )}

            {/* SCENARIO C: OTP Input */}
            {modalMode === "OTP" && (
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <p className="text-sm text-gray-400 text-center">Enter the 6-digit code sent to your email.</p>
                <div className="flex justify-between gap-2 my-2">
                  {otpInputs.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el; }}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      onPaste={handleOtpPaste}
                      className="w-12 h-14 bg-black/80 border border-white/10 rounded-xl text-center text-xl font-bold text-white focus:border-blue-500 outline-none"
                    />
                  ))}
                </div>
                
                <div className="pt-2 border-t border-white/10">
                  <p className="text-xs text-gray-500 mb-2">Enter new password to set upon verification:</p>
                  <div className="flex flex-col gap-2">
                    <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="New Password" showPassword={showPassword} setShowPassword={setShowPassword} />
                    <PasswordInput value={confirmNewPassword} onChange={setConfirmNewPassword} placeholder="Confirm New Password" showPassword={showPassword} setShowPassword={setShowPassword} />
                  </div>
                </div>

                {modalError && <p className="text-red-400 text-sm text-center">{modalError}</p>}
                {modalSuccess && <p className="text-green-400 text-sm flex items-center justify-center gap-1"><CheckCircle2 className="w-4 h-4"/>{modalSuccess}</p>}

                <button onClick={submitOtp} disabled={otpInputs.join("").length < 6 || newPassword.length < 4 || newPassword !== confirmNewPassword} className="w-full bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all mt-2">
                  Verify & Reset Password
                </button>
                <button onClick={() => setModalMode("FORGOT")} className="text-sm text-gray-500 hover:text-white self-center underline underline-offset-4">Back</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global styles for custom scrollbar if needed */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}} />
    </div>
  );
}

// Reusable Password Input Component
function PasswordInput({ value, onChange, placeholder, showPassword, setShowPassword, disabled = false }: any) {
  return (
    <div className="relative w-full">
      <input 
        type={showPassword ? "text" : "password"}
        maxLength={20}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-black/80 border border-white/10 rounded-xl pl-4 pr-12 py-4 font-mono tracking-widest text-white placeholder-gray-700 outline-none focus:border-red-500 transition-colors disabled:opacity-50"
      />
      <button 
        type="button"
        tabIndex={-1}
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
      >
        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
}
