"use client";

import BottomNav from "@/components/layout/BottomNav";
import { User, Phone, LogOut, Settings, Bell, Shield, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface TrustedContact {
  id: string;
  name: string;
  phone: string;
  relation: string | null;
}

// ==========================================
// 1. INITIALIZE INTERNAL APP DATABASE (INDEXEDDB)
// ==========================================
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
// 3. PROFILE VAULT LOGIC ENGINE
// ==========================================
let profileSessionRecordsArray: any[] = [];

if (typeof window !== 'undefined') {
  (window as any).unlockMasterIncidentVault = async () => {
    const inputPassElement = document.getElementById("master-vault-unlock-pass") as HTMLInputElement;
    const inputPass = inputPassElement ? inputPassElement.value : "";
    const errorLabel = document.getElementById("global-vault-err");
    
    const db = await initInternalEvidenceDatabase();
    const store = db.transaction("evidence_vault", "readonly").objectStore("evidence_vault");
    
    store.getAll().onsuccess = (e) => {
      const records = (e.target as IDBRequest).result;
      profileSessionRecordsArray = records;
      
      // Fetch the active target key to compare passwords uniformly
      const activeSavedKey = localStorage.getItem("global_custom_security_pin") || "123456";
      
      if (inputPass.trim() === activeSavedKey.trim()) {
        if (errorLabel) errorLabel.style.display = "none";
        const gateBlock = document.getElementById("vault-one-time-gate-block");
        if (gateBlock) gateBlock.style.display = "none";
        const archiveBlock = document.getElementById("decrypted-archive-explorer-block");
        if (archiveBlock) archiveBlock.style.display = "block";
        
        // Render the compiled folder list
        (window as any).buildDecryptedIncidentListUI();
      } else {
        if (errorLabel) {
          errorLabel.textContent = "DECRYPTION ERROR: PIN INCORRECT.";
          errorLabel.style.display = "block";
        }
      }
    };
  };

  (window as any).buildDecryptedIncidentListUI = () => {
    const container = document.getElementById("global-profile-archive-list");
    if (!container) return;
    container.innerHTML = "";

    if (profileSessionRecordsArray.length === 0) {
      container.innerHTML = `<p style="color: #71717a; font-size: 11px; margin: 20px 0; text-align: center;">NO ARCHIVED ENTIRES SECURED YET.</p>`;
      return;
    }

    // Sort entries to show the latest recording files first
    profileSessionRecordsArray.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    profileSessionRecordsArray.forEach((record: any) => {
      const cardRow = document.createElement("div");
      cardRow.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #18181b; border: 1px solid #27272a; border-radius: 4px;";
      
      cardRow.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <span style="color: #ffffff; font-size: 11px; font-weight: 700;">📁 SECURE EVIDENCE ENTRY</span>
          <span style="color: #a1a1aa; font-size: 10px;">🕒 ${new Date(record.timestamp).toLocaleDateString()} | ${new Date(record.timestamp).toLocaleTimeString()}</span>
        </div>
        <button onclick="launchTargetMediaStream('${record.id}')" style="background: #27272a; color: #60a5fa; border: 1px solid #3f3f46; border-radius: 4px; padding: 8px 14px; font-size: 11px; font-weight: 700; cursor: pointer; font-family: monospace;">PLAY</button>
      `;
      container.appendChild(cardRow);
    });
  };

  (window as any).launchTargetMediaStream = async (recordId: string) => {
    console.log("[Media Hub] PLAY triggered for:", recordId);

    const videoPlayer = document.getElementById("global-vault-media-player") as HTMLVideoElement;
    const frameWrapper = document.getElementById("player-frame-wrapper");

    if (!videoPlayer || !frameWrapper) {
      console.error("[Media Hub] Player elements not found in DOM.");
      return;
    }

    try {
      // Always re-fetch directly from IndexedDB to guarantee fresh blob data
      const db = await initInternalEvidenceDatabase();
      const tx = db.transaction("evidence_vault", "readonly");
      const store = tx.objectStore("evidence_vault");
      const req = store.get(recordId);

      req.onsuccess = () => {
        const record = req.result;
        if (!record) {
          console.error("[Media Hub] Record not found in IndexedDB:", recordId);
          return;
        }

        // Support both new schema (mediaFile) and old schema (blob) for full backward compatibility
        const blob: Blob = record.mediaFile || record.blob;
        if (!blob || !(blob instanceof Blob) || blob.size === 0) {
          console.error(
            "[Media Hub] No valid blob found on record. Keys present:",
            Object.keys(record),
            "| mediaFile:", record.mediaFile,
            "| blob:", record.blob
          );
          return;
        }

        console.log("[Media Hub] Blob retrieved — type:", blob.type, "size:", blob.size);

        // Revoke any previous object URL to free memory
        if (videoPlayer.src && videoPlayer.src.startsWith("blob:")) {
          URL.revokeObjectURL(videoPlayer.src);
        }

        const mediaUrl = URL.createObjectURL(blob);
        frameWrapper.style.display = "block";

        // Scroll player into view
        frameWrapper.scrollIntoView({ behavior: "smooth", block: "nearest" });

        videoPlayer.src = mediaUrl;
        videoPlayer.load();
        videoPlayer.play().catch((playErr) => {
          // Autoplay may be blocked — player is still loaded and user can press play
          console.warn("[Media Hub] Autoplay blocked, user can press play manually:", playErr);
        });

        console.log("[Media Hub] Streaming started for:", recordId);
      };

      req.onerror = () => {
        console.error("[Media Hub] IndexedDB read error for record:", recordId, req.error);
      };
    } catch (err) {
      console.error("[Media Hub] Fatal error during playback:", err);
    }
  };
}

export default function ProfilePage() {
  const [userName, setUserName] = useState("Loading...");
  const [userEmail, setUserEmail] = useState("...");
  const [initials, setInitials] = useState("");
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRelation, setNewRelation] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", user.id)
          .single();

        const name = profile?.full_name || user.user_metadata?.full_name || "User";
        setUserName(name);
        setUserEmail(user.email || "");
        
        const inits = name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();
        setInitials(inits || "U");

        // Fetch real trusted contacts
        const { data: contactsData } = await supabase
          .from("trusted_contacts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });
        setContacts(contactsData || []);
        setContactsLoading(false);
      }
    };
    fetchUser();
  }, [supabase]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setAddLoading(true);
    setAddError(null);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      setAddError("Authentication required to save contacts.");
      setAddLoading(false);
      return;
    }

    if (contacts.length >= 5) {
      setAddError("Maximum 5 trusted contacts allowed.");
      setAddLoading(false);
      return;
    }

    // Ensure profile exists to prevent foreign key violation
    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
    }, { onConflict: "id", ignoreDuplicates: true });

    const { data, error } = await supabase.from("trusted_contacts").insert({
      user_id: user.id,
      name: newName.trim(),
      phone: newPhone.trim(),
      relation: newRelation.trim() || null,
    }).select().single();

    if (error) {
      setAddError(error.message);
    } else if (data) {
      setContacts(prev => [...prev, data]);
      setNewName("");
      setNewPhone("");
      setNewRelation("");
      setShowAddForm(false);
    }
    setAddLoading(false);
  };

  const handleDeleteContact = async (contactId: string) => {
    const { error } = await supabase.from("trusted_contacts").delete().eq("id", contactId);
    if (!error) {
      setContacts(prev => prev.filter(c => c.id !== contactId));
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen pb-20 bg-background flex flex-col">
      <header className="p-6 border-b border-white/5 flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="w-6 h-6 text-primary" /> Profile
        </h1>
        <button className="p-2 bg-muted rounded-full">
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 p-6 space-y-8">
        
        {/* User Info */}
        <div className="flex flex-col items-center space-y-3">
          <div className="w-24 h-24 bg-primary/20 rounded-full border-4 border-primary/30 flex items-center justify-center text-primary font-bold text-3xl">
            {initials}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold">{userName}</h2>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
          </div>
        </div>

        {/* Trusted Contacts — REAL CRUD */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Trusted Contacts ({contacts.length}/5)
            </h3>
            {contacts.length < 5 && (
              <button 
                onClick={() => setShowAddForm(prev => !prev)} 
                className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full font-medium flex items-center gap-1 hover:bg-primary/30 transition-colors"
              >
                {showAddForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                {showAddForm ? "Cancel" : "Add New"}
              </button>
            )}
          </div>

          {/* Add Contact Form */}
          {showAddForm && (
            <form onSubmit={handleAddContact} className="glass rounded-2xl p-4 space-y-3">
              <input
                type="text"
                placeholder="Contact Name *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="w-full p-3 rounded-xl bg-background border border-white/10 focus:border-primary outline-none transition-all text-sm"
              />
              <input
                type="tel"
                placeholder="Phone Number *"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                required
                className="w-full p-3 rounded-xl bg-background border border-white/10 focus:border-primary outline-none transition-all text-sm"
              />
              <input
                type="text"
                placeholder="Relation (e.g. Mother, Friend)"
                value={newRelation}
                onChange={(e) => setNewRelation(e.target.value)}
                className="w-full p-3 rounded-xl bg-background border border-white/10 focus:border-primary outline-none transition-all text-sm"
              />
              {addError && <p className="text-destructive text-xs">{addError}</p>}
              <button
                type="submit"
                disabled={addLoading || !newName || !newPhone}
                className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 text-sm"
              >
                {addLoading ? "Saving..." : "Save Contact"}
              </button>
            </form>
          )}
          
          {/* Contacts List */}
          {contactsLoading ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-sm text-muted-foreground animate-pulse">Loading contacts...</p>
            </div>
          ) : contacts.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center space-y-2">
              <User className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">No trusted contacts added yet.</p>
              <p className="text-xs text-muted-foreground">Add up to 5 contacts who will be alerted during emergencies.</p>
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
              {contacts.map((contact) => (
                <div key={contact.id} className="p-4 flex justify-between items-center hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                      {contact.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{contact.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {contact.phone}{contact.relation ? ` · ${contact.relation}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`tel:${contact.phone}`} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                      <Phone className="w-4 h-4" />
                    </a>
                    <button 
                      onClick={() => handleDeleteContact(contact.id)} 
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ==========================================
            2. PROFILE SECTION: UNIFIED "INCIDENT ARCHIVE" CODE
            ========================================== */}
        <div className="profile-incident-archive-panel" style={{ width: '100%', boxSizing: 'border-box', background: '#121214', border: '1px solid #27272a', borderRadius: '4px', padding: '16px', fontFamily: 'monospace', color: '#e4e4e7' }}>
          
          {/* Setup Header: Create Custom Password */}
          <div style={{ borderBottom: '1px solid #27272a', paddingBottom: '14px', marginBottom: '14px', textAlign: 'left' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '11px', textTransform: 'uppercase', color: '#a1a1aa', fontWeight: 700 }}>🔐 Set Personal Master Password</h4>
            <p style={{ margin: '0 0 10px 0', fontSize: '10px', color: '#71717a', lineHeight: 1.4 }}>Create a custom password below. All future background audio/video files will lock under this specific code.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="password" id="global-pin-config" placeholder="ENTER NEW PASSWORD" style={{ flex: 1, background: '#18181b', border: '1px solid #3f3f46', borderRadius: '4px', padding: '10px', color: '#ffffff', fontSize: '11px', fontFamily: 'monospace' }} />
              <button onClick={() => {
                if (typeof window !== 'undefined') {
                  const val = (document.getElementById('global-pin-config') as HTMLInputElement).value.trim();
                  localStorage.setItem('global_custom_security_pin', val);
                  alert('Master security decryption lock key successfully updated.');
                }
              }} style={{ background: '#27272a', color: '#60a5fa', border: '1px solid #3f3f46', borderRadius: '4px', padding: '10px 14px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>Save PIN</button>
            </div>
          </div>

          {/* Password Gate Lock Screen Layout (One-Time Verification Entry) */}
          <div id="vault-one-time-gate-block" style={{ background: '#1c1917', border: '1px solid #44403c', padding: '14px', borderRadius: '4px', marginBottom: '14px', display: 'block', textAlign: 'left' }}>
            <h5 style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#f59e0b', textTransform: 'uppercase' }}>🔒 Enter Password to Access Incident Archive</h5>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="password" id="master-vault-unlock-pass" placeholder="ENTER ACCESS PASSWORD" style={{ flex: 1, background: '#141416', border: '1px solid #57534e', borderRadius: '4px', padding: '10px', color: '#ffffff', fontSize: '11px', fontFamily: 'monospace' }} />
              <button onClick={() => { if (typeof window !== 'undefined') (window as any).unlockMasterIncidentVault() }} style={{ background: '#27272a', color: '#34d399', border: '1px solid #3f3f46', borderRadius: '4px', padding: '10px 16px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>UNLOCK</button>
            </div>
            <span id="global-vault-err" style={{ fontSize: '11px', color: '#ef4444', display: 'none', marginTop: '6px', fontWeight: 'bold' }}></span>
          </div>

          {/* Decrypted Master File Directory View (Hidden by default until PIN is entered) */}
          <div id="decrypted-archive-explorer-block" style={{ display: 'none', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderLeft: '3px solid #ef4444', paddingLeft: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '12px', textTransform: 'uppercase', color: '#ef4444', letterSpacing: '0.5px', fontWeight: 800 }}>📁 Incident Archive Directory</h4>
              <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: 'bold', background: '#14532d', padding: '2px 6px', borderRadius: '4px' }}>SECURED ACCESS</span>
            </div>
            
            {/* Dynamic Folder List Grid Container */}
            <div id="global-profile-archive-list" style={{ maxHeight: '240px', overflowY: 'auto', paddingRight: '2px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              {/* Compiled dynamically via buildDecryptedIncidentListUI() */}
            </div>

            {/* Video Playback Media Screen Container Frame */}
            <div id="player-frame-wrapper" style={{ display: 'none', borderTop: '1px solid #27272a', paddingTop: '12px', marginTop: '12px' }}>
              <span style={{ fontSize: '10px', color: '#a1a1aa', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>🖥️ PLAYING SECURE MEDIA STREAM:</span>
              <video id="global-vault-media-player" controls style={{ width: '100%', height: 'auto', background: '#000000', border: '1px solid #3f3f46', borderRadius: '4px' }}></video>
            </div>
          </div>

        </div>

        {/* Preferences */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Preferences</h3>
          <div className="glass rounded-2xl divide-y divide-white/5">
            <div className="p-4 flex justify-between items-center">
              <span className="text-sm font-medium flex items-center gap-2">
                <Bell className="w-4 h-4 text-muted-foreground" /> Push Notifications
              </span>
              <div className="w-10 h-6 bg-primary rounded-full relative">
                <div className="w-4 h-4 bg-white rounded-full absolute right-1 top-1 shadow-sm"></div>
              </div>
            </div>
            <div className="p-4 flex justify-between items-center">
              <span className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4 text-muted-foreground" /> Auto Deterrent Mode
              </span>
              <div className="w-10 h-6 bg-muted rounded-full relative">
                <div className="w-4 h-4 bg-muted-foreground rounded-full absolute left-1 top-1"></div>
              </div>
            </div>
          </div>
        </div>

        <button onClick={handleSignOut} className="w-full p-4 glass rounded-2xl flex items-center justify-center gap-2 text-destructive font-medium hover:bg-destructive/10 transition-colors">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>

      </main>

      <BottomNav />
    </div>
  );
}
