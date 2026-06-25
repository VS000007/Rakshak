"use client";

import { useState, useEffect, useCallback } from "react";
import { generateSalt, hashPassword, timingSafeEqual } from "@/utils/vaultSecurity";
import { createClient } from "@/lib/supabase/client";

const HASH_KEY = "rakshak_vault_hash";
const SALT_KEY = "rakshak_vault_salt";
const LOCKOUT_END_KEY = "rakshak_vault_lockout_end";

export function useVault() {
  const [hasMasterPassword, setHasMasterPassword] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0); // seconds remaining
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  // OTP state (in memory only, per requirements)
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [otpExpiry, setOtpExpiry] = useState<number>(0);

  // Initialize state from local storage on mount
  useEffect(() => {
    const hash = localStorage.getItem(HASH_KEY);
    const salt = localStorage.getItem(SALT_KEY);
    if (hash && salt) {
      setHasMasterPassword(true);
    }

    const lockoutEnd = localStorage.getItem(LOCKOUT_END_KEY);
    if (lockoutEnd) {
      const remaining = Math.floor((parseInt(lockoutEnd) - Date.now()) / 1000);
      if (remaining > 0) {
        setLockoutTimer(remaining);
      } else {
        localStorage.removeItem(LOCKOUT_END_KEY);
      }
    }

    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setRegisteredEmail(user.email);
      }
    };
    fetchUser();
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer((prev) => {
          if (prev <= 1) {
            localStorage.removeItem(LOCKOUT_END_KEY);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const setupMasterPassword = async (password: string) => {
    const salt = generateSalt();
    const hash = await hashPassword(password, salt);
    localStorage.setItem(HASH_KEY, hash);
    localStorage.setItem(SALT_KEY, salt);
    setHasMasterPassword(true);
    setIsLocked(true); // By default, let's keep it locked or unlock it. Requirements say: "After saving, hide the SET PASSWORD section and show only UNLOCK section"
  };

  const unlockVault = async (password: string): Promise<boolean> => {
    if (lockoutTimer > 0) return false;

    const storedHash = localStorage.getItem(HASH_KEY);
    const storedSalt = localStorage.getItem(SALT_KEY);

    if (!storedHash || !storedSalt) return false;

    const computedHash = await hashPassword(password, storedSalt);
    const isValid = timingSafeEqual(computedHash, storedHash);

    if (isValid) {
      setIsLocked(false);
      setFailedAttempts(0);
      return true;
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 5) {
        const lockoutEndTime = Date.now() + 60000; // 60 seconds
        localStorage.setItem(LOCKOUT_END_KEY, lockoutEndTime.toString());
        setLockoutTimer(60);
        setFailedAttempts(0);
      }
      return false;
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string): Promise<boolean> => {
    const storedHash = localStorage.getItem(HASH_KEY);
    const storedSalt = localStorage.getItem(SALT_KEY);
    if (!storedHash || !storedSalt) return false;

    const computedHash = await hashPassword(oldPassword, storedSalt);
    if (timingSafeEqual(computedHash, storedHash)) {
      const newSalt = generateSalt();
      const newHash = await hashPassword(newPassword, newSalt);
      localStorage.setItem(HASH_KEY, newHash);
      localStorage.setItem(SALT_KEY, newSalt);
      return true;
    }
    return false;
  };

  const initEvidenceDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("VibeSecurityAppDB", 1);
      request.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
      request.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
    });
  };

  const resetVault = async () => {
    // 1. Delete from indexedDB
    try {
      const db = await initEvidenceDB();
      if (db.objectStoreNames.contains("evidence_vault")) {
        const transaction = db.transaction("evidence_vault", "readwrite");
        const store = transaction.objectStore("evidence_vault");
        store.clear();
      }
    } catch (err) {
      console.error("Failed to clear evidence_vault IndexedDB", err);
    }

    // 2. Clear vault related localStorage keys
    localStorage.removeItem(HASH_KEY);
    localStorage.removeItem(SALT_KEY);
    localStorage.removeItem(LOCKOUT_END_KEY);
    
    // Also clear any legacy recording items just in case
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('rakshak_recording_')) {
        localStorage.removeItem(key);
      }
    });

    setHasMasterPassword(false);
    setIsLocked(true);
  };

  const generateOtp = () => {
    // Generate 6 digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setOtpCode(code);
    setOtpExpiry(Date.now() + 3 * 60 * 1000); // 3 minutes

    // TODO: Replace with actual email send API call
    console.log(`[VAULT OTP] Your verification code is: ${code}`);
    return code;
  };

  const verifyOtp = (code: string): { success: boolean, expired: boolean } => {
    if (Date.now() > otpExpiry) {
      return { success: false, expired: true };
    }
    if (otpCode && timingSafeEqual(otpCode, code)) {
      setOtpCode(null);
      setOtpExpiry(0);
      return { success: true, expired: false };
    }
    return { success: false, expired: false };
  };

  const resetPasswordWithoutDataLoss = async (newPassword: string) => {
    const newSalt = generateSalt();
    const newHash = await hashPassword(newPassword, newSalt);
    localStorage.setItem(HASH_KEY, newHash);
    localStorage.setItem(SALT_KEY, newSalt);
    setIsLocked(true);
  };

  return {
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
  };
}
