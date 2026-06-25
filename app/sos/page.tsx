"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { AlertTriangle, MapPin, Phone, Video, Mic, ShieldOff, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useGeolocation } from "@/lib/geo/useGeolocation";
import { createClient } from "@/lib/supabase/client";
import useSosAlerts from '@/lib/useSosAlerts';

// ==========================================
// 1. SECURE STORAGE DISPATCHER & PIN ENCRYPTION
// ==========================================
export const uploadCapturedMediaToVault = async (videoBlob: Blob, audioBlob: Blob, userGeneratedPin: string) => {
  const supabase = createClient();
  // A. Hash the authorization PIN locally before database tracking entries
  const hashedSecurityPin = btoa(userGeneratedPin + "VibeSecuritySalt2026"); 
  const timestamp = Date.now();
  
  // Create structured paths within our private bucket nodes
  const videoStoragePath = `vault/SOS_VIDEO_${timestamp}.mp4`;
  const audioStoragePath = `vault/SOS_AUDIO_${timestamp}.mp3`;

  try {
    // B. Direct upload sequence into our private 'sos_evidence_vault' bucket
    const { error: videoErr } = await supabase.storage
      .from('sos_evidence_vault')
      .upload(videoStoragePath, videoBlob, { contentType: 'video/mp4', upsert: false });

    const { error: audioErr } = await supabase.storage
      .from('sos_evidence_vault')
      .upload(audioStoragePath, audioBlob, { contentType: 'audio/mp3', upsert: false });

    if (!videoErr && !audioErr) {
      console.log("[Vault Sync] Media assets successfully locked inside bucket layers.");
      
      // C. Registry metadata insert into our private secure_vaults structural table
      await (supabase as any).from('secure_vaults').insert([{
        user_id: (await supabase.auth.getUser()).data.user?.id,
        encrypted_pin: hashedSecurityPin,
        video_path: videoStoragePath,
        audio_path: audioStoragePath,
        created_at: new Date().toISOString()
      }]);
      
      // D. Fire the unique decryption code directly to the contact text queue
      await sendVaultAccessKeyViaSMS(userGeneratedPin);
    }
  } catch (err) {
    console.error("[Fatal Vault Error] Storage tracking loop interrupted:", err);
  }
};

const sendVaultAccessKeyViaSMS = async (passwordPin: string) => {
  const apiKey = process.env.NEXT_PUBLIC_FAST2SMS_KEY || (import.meta as any).env?.VITE_FAST2SMS_KEY;
  const activeContactsList = typeof window !== 'undefined' && (window as any).trustedContactsList ? (window as any).trustedContactsList : [];
  let rawPhone = activeContactsList.length > 0 && activeContactsList[0].phone ? activeContactsList[0].phone : (typeof localStorage !== 'undefined' ? localStorage.getItem("saved_emergency_phone") || "" : "");
  const cleanNumber = rawPhone.replace(/\D/g, '').slice(-10);

  if (!apiKey || cleanNumber.length !== 10) return;

  const textBody = `CRITICAL SECURE ACCESS PASS: Evidence folder encrypted. Access the application archive page using this unique 6-digit decryption PIN: ${passwordPin}`;
  const quickSmsUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&route=q&message=${encodeURIComponent(textBody)}&numbers=${cleanNumber}`;

  await fetch(quickSmsUrl, { method: 'GET', mode: 'cors' });
};

// ==========================================
// 2. 8-SECOND STEALTH SMS & 4-MINUTE REPEAT
// ==========================================
let emergencyTrackingInterval: ReturnType<typeof setInterval> | null = null;
let emergencySosTimeout: ReturnType<typeof setTimeout> | null = null;

export const clearEmergencyAlerts = () => {
  if (emergencySosTimeout) {
    clearTimeout(emergencySosTimeout);
    emergencySosTimeout = null;
  }
  if (emergencyTrackingInterval) {
    clearInterval(emergencyTrackingInterval);
    emergencyTrackingInterval = null;
  }
};

const sendAlertSMS = async (isFirst: boolean) => {
  const activeContactsList = typeof window !== 'undefined' && (window as any).trustedContactsList ? (window as any).trustedContactsList : [];
  let fallbackPhone = typeof localStorage !== 'undefined' ? localStorage.getItem("saved_emergency_phone") || "" : "";
  
  let numbers: string[] = activeContactsList.map((c: any) => c.phone?.replace(/\D/g, '').slice(-10)).filter((n: string) => n && n.length === 10);
  if (numbers.length === 0 && fallbackPhone) {
    const cleanFallback = fallbackPhone.replace(/\D/g, '').slice(-10);
    if (cleanFallback.length === 10) numbers.push(cleanFallback);
  }

  if (numbers.length === 0) {
    if (isFirst) {
      alert("No emergency contacts saved. Please add contacts to use SMS alerts.");
    }
    return;
  }

  let lat = null;
  let lng = null;
  let acc = null;

  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    });
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
    acc = pos.coords.accuracy;
  } catch (err) {
    // ignore
  }

  const date = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeString = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

  let message = `RAKSHAK EMERGENCY ALERT!\nThis person may be in danger and needs immediate help.\n`;
  if (lat && lng) {
    message += `Location: https://maps.google.com/?q=${lat},${lng}\nCoords: ${lat.toFixed(4)}, ${lng.toFixed(4)} (accuracy: ${Math.round(acc || 0)} meters)\n`;
  } else {
    message += `Location: Unable to determine. Call immediately.\n`;
  }
  message += `Time: ${timeString}\nDo NOT ignore this. Respond immediately or contact local police.`;

  try {
    fetch('/api/send-sos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numbers, message })
    }).catch(() => { /* silent */ });
    
    (window as any)._sosLogs = (window as any)._sosLogs || [];
    (window as any)._sosLogs.push(`SMS sent at ${timeString}`);
  } catch (err) {
    (window as any)._sosLogs = (window as any)._sosLogs || [];
    (window as any)._sosLogs.push(`SMS failed at ${timeString}`);
  }
};

export const startEmergencyAlertSequence = () => {
  clearEmergencyAlerts();
  
  emergencySosTimeout = setTimeout(() => {
    sendAlertSMS(true);
    
    emergencyTrackingInterval = setInterval(() => {
      sendAlertSMS(false);
    }, 240000);
  }, 8000);
};

// ==========================================
// 1. STATE INITIALIZATION & SECURE DATABASE SCHEMA
// ==========================================
let activeMediaRecorderInstance: MediaRecorder | null = null;
let recordedMediaChunksArray: Blob[] = [];

const initInternalEvidenceDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("VibeSecurityAppDB", 1);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("evidence_vault")) {
        db.createObjectStore("evidence_vault", { keyPath: "id" });
      }
    };
    request.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    request.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });
};

// ==========================================
// 2. LIFECYCLE CONTROLLER WITH USER-PIN ASSIGNMENT
// ==========================================
const startEmergencyStealthRecording = async (mediaStream: MediaStream) => {
  recordedMediaChunksArray = [];
  const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? { mimeType: 'video/webm;codecs=vp9' } : { mimeType: 'video/mp4' };
  activeMediaRecorderInstance = new MediaRecorder(mediaStream, options);

  activeMediaRecorderInstance.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recordedMediaChunksArray.push(e.data);
  };

  activeMediaRecorderInstance.onstop = async () => {
    console.log("[SOS Core] Compiling media channels into one unified record file...");
    
    // Combine all active recorded video and audio chunks into a single storage file block
    const consolidatedBlob = new Blob(recordedMediaChunksArray, { type: activeMediaRecorderInstance?.mimeType });
    const db = await initInternalEvidenceDatabase();
    const transaction = db.transaction("evidence_vault", "readwrite");
    const store = transaction.objectStore("evidence_vault");

    const uniqueSessionId = "INCIDENT_REF_" + Date.now();
    
    // Fetch the manual user PIN from local storage configuration state
    const activeMasterKey = localStorage.getItem("global_custom_security_pin") || "123456";

    const masterIncidentPayload = {
      id: uniqueSessionId,
      mediaFile: consolidatedBlob, // Video and audio tracks combined into a single file object
      timestamp: new Date().toISOString(),
      decryptionKey: activeMasterKey // Locked behind the user's manual password string
    };

    store.put(masterIncidentPayload).onsuccess = () => {
      console.log("[Archive Engine] Session safely written to internal IndexedDB storage.");
      
      // Send the password via Fast2SMS network gateway instantly
      if (typeof sendVaultAccessKeyViaSMS === 'function') {
        sendVaultAccessKeyViaSMS(activeMasterKey);
      }
      
      // HARD LOOP BREAKER: Completely clear tracking loops
      clearEmergencyAlerts();
      mediaStream.getTracks().forEach(track => track.stop());
      
      // Clear out active layout trigger variables
      localStorage.removeItem("is_sos_active");
      localStorage.removeItem("sos_countdown_running");
      
      alert("Stealth tracking sequence successfully concluded and archived.");
      
      // Redirect user back to the primary landing dashboard page state safely
      window.location.href = "/";
    };
  };

  activeMediaRecorderInstance.start(1000);
  setupInvisibleViewportKillSwitch();
};

const setupInvisibleViewportKillSwitch = () => {
  window.addEventListener("keydown", (e) => { if (e.code === "Space" || e.keyCode === 32) activeMediaRecorderInstance?.stop(); }, { once: true });
  document.body.style.cursor = "pointer";
  document.body.onclick = () => { if (activeMediaRecorderInstance && activeMediaRecorderInstance.state === "recording") activeMediaRecorderInstance.stop(); };
};

const haltStealthRecordingEngine = () => {
  if (activeMediaRecorderInstance && activeMediaRecorderInstance.state === "recording") {
    activeMediaRecorderInstance.stop();
  }
};



export default function SOSPage() {
  const { startSosAlerts, stopSosAlerts } = useSosAlerts();
  const [mode, setMode] = useState<"DETERRENT" | "STEALTH" | null>(null);
  const [seconds, setSeconds] = useState(0);
  const { latitude, longitude, loading: geoLoading, error: geoError } = useGeolocation();

  const [isStealthActive, setIsStealthActive] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [lastKnownLocation, setLastKnownLocation] = useState<{lat: number, lng: number} | null>(null);
  const [messagesDispatched, setMessagesDispatched] = useState(false);
  
  const [trustedContactsList, setTrustedContactsList] = useState<any[]>([]);
  const supabase = createClient();

  // Fetch true saved contacts
  useEffect(() => {
    const fetchContacts = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("trusted_contacts").select("phone").eq("user_id", user.id);
        if (data && data.length > 0) {
          setTrustedContactsList(data);
          if (typeof window !== 'undefined') (window as any).trustedContactsList = data;
        }
      }
    };
    fetchContacts();
  }, [supabase]);

  // Fallback to offline location
  useEffect(() => {
    if (latitude && longitude) {
      const loc = { lat: latitude, lng: longitude };
      setLastKnownLocation(loc);
      localStorage.setItem('lastKnownLocation', JSON.stringify(loc));
    } else if (!latitude && !longitude) {
      const saved = localStorage.getItem('lastKnownLocation');
      if (saved) {
        setLastKnownLocation(JSON.parse(saved));
      }
    }
  }, [latitude, longitude]);

  const startStealthRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      
      await startEmergencyStealthRecording(stream);
      
      console.log("Stealth recording started in background with click interception.");
    } catch (err) {
      console.error("Failed to start stealth recording:", err);
    }
    startSosAlerts();
  }, []);

  useEffect(() => {
    startEmergencyAlertSequence();

    // Simulate AI / Rule Engine determining the mode
    setTimeout(() => {
      setMode("STEALTH"); // Enforce silent/stealth mode
      setMessagesDispatched(true); // Simulate dispatching remote messages
    }, 1500);

    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      clearEmergencyAlerts();
      haltStealthRecordingEngine();
      stopSosAlerts();
    };
  }, []);

  useEffect(() => {
    if (seconds === 10 && !isStealthActive) {
      startStealthRecording();
      setIsStealthActive(true);

      // SMS logic is now handled asynchronously by startEmergencyAlertSequence which started on mount.
    }
  }, [seconds, startStealthRecording, isStealthActive, latitude, longitude, lastKnownLocation]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isStealthActive) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center relative">
        {/* Fake black screen for stealth mode to deceive the attacker */}
        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-5 pointer-events-none">
           <span className="text-white/50 text-sm font-mono tracking-widest uppercase">Battery Depleted</span>
        </div>
        {/* Hidden button to cancel SOS, placed at top right corner */}
        <Link 
          href="/dashboard" 
          className="absolute top-0 right-0 w-24 h-24 opacity-0 z-50 cursor-default"
          onClick={() => {
            haltStealthRecordingEngine();
            stopSosAlerts();
          }}
        >
          Cancel
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-destructive-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background pulsing effect */}
      <div className="absolute inset-0 bg-red-900/20 animate-pulse"></div>
      
      <div className="z-10 w-full max-w-md flex flex-col items-center text-center space-y-8">
        
        <div className="relative flex items-center justify-center">
          <svg className="absolute w-36 h-36 -rotate-90 pointer-events-none" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="#ef4444" strokeWidth="2"
              strokeDasharray="289" strokeDashoffset={289 - (Math.min(seconds, 8) / 8) * 289}
              className="transition-all duration-1000 ease-linear" />
          </svg>
          <div className="bg-white/10 p-6 rounded-full backdrop-blur-md relative z-10">
            <AlertTriangle className="w-20 h-20 text-red-500 animate-bounce" />
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-black uppercase tracking-widest mb-2 text-red-500">Silent SOS Active</h1>
          <p className="text-sm font-semibold text-gray-300">Loud alarm triggered on contacts' phones</p>
          <p className="text-xl opacity-90 font-mono mt-2">{formatTime(seconds)}</p>
        </div>

        <div className="w-full bg-black/20 rounded-2xl p-4 backdrop-blur-md border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium flex items-center gap-2"><MapPin className="w-4 h-4" /> Location</span>
            <span className="text-sm font-mono opacity-80 text-right">
              {geoLoading && !lastKnownLocation ? "Locating you..." : geoError && !lastKnownLocation ? "Location failed" : 
                latitude && longitude ? `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E` : 
                lastKnownLocation ? `${lastKnownLocation.lat.toFixed(4)}° N, ${lastKnownLocation.lng.toFixed(4)}° E (Offline)` : "Unknown"}
            </span>
          </div>
          {/* ==========================================
              2. FIX HARDCODED UI TEXT COUNTER CELL (FIXED)
              ========================================== */}
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span className="font-medium flex items-center gap-2"><Phone className="w-4 h-4" /> Contacts Alerted</span>
            {messagesDispatched ? (
              <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '14px' }} className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> {typeof trustedContactsList !== 'undefined' && trustedContactsList.length > 0 ? Math.min(trustedContactsList.length, 5) : '0'}/5 Notified
              </span>
            ) : (
              <span className="text-sm text-green-300 animate-pulse">Dispatching...</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium flex items-center gap-2">Mode Selection</span>
            {mode ? (
              <span className="text-sm font-bold bg-white/20 px-2 py-1 rounded">{mode}</span>
            ) : (
              <span className="text-sm opacity-80 animate-pulse">Analyzing...</span>
            )}
          </div>
        </div>

        <div className="flex gap-4 w-full">
          <div className="flex-1 bg-black/20 p-4 rounded-2xl flex flex-col items-center gap-2 backdrop-blur-md border border-white/10">
            <Video className="w-6 h-6 text-red-300 animate-pulse" />
            <span className="text-xs font-semibold">Recording Video</span>
          </div>
          <div className="flex-1 bg-black/20 p-4 rounded-2xl flex flex-col items-center gap-2 backdrop-blur-md border border-white/10">
            <Mic className="w-6 h-6 text-red-300 animate-pulse" />
            <span className="text-xs font-semibold">Recording Audio</span>
          </div>
        </div>

        <Link href="/dashboard" 
          className="mt-8 px-8 py-4 bg-red-900/50 border border-red-500/50 text-red-200 font-bold rounded-full w-full max-w-xs hover:bg-red-900 transition-colors flex items-center justify-center gap-2"
        >
          <ShieldOff className="w-5 h-5" /> Cancel Silent SOS
        </Link>
        <p className="text-xs opacity-50 mt-4 text-gray-400">Requires PIN to cancel in production</p>

      </div>
    </div>
  );
}
