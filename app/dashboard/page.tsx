"use client";

import { Shield, Bell, Navigation, AlertTriangle, ArrowRight, Users } from "lucide-react";
import Link from "next/link";
import BottomNav from "@/components/layout/BottomNav";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface TrustedContact {
  id: string;
  name: string;
  phone: string;
  relation: string | null;
}

interface CommunityReport {
  id: string;
  tag: string;
  note: string | null;
  created_at: string;
}

export default function Dashboard() {
  const [userName, setUserName] = useState("Loading...");
  const [sosLoading, setSosLoading] = useState(false);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      setUserName((profile as any)?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || "User");

      // Fetch real trusted contacts
      const { data: contactsData } = await supabase
        .from("trusted_contacts")
        .select("id, name, phone, relation")
        .eq("user_id", user.id);
      setContacts(contactsData || []);

      // Fetch real community reports (most recent)
      const { data: reportsData } = await supabase
        .from("community_reports")
        .select("id, tag, note, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      setReports(reportsData || []);
    };
    fetchData();
  }, [supabase]);

  const handleSOSClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setSosLoading(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          router.push(`/sos?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
        },
        (err) => {
          console.error("Location permission denied or error:", err);
          router.push('/sos');
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      router.push('/sos');
    }
  };

  const contactColors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-pink-500"];

  return (
    <div className="min-h-screen pb-20 bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="p-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Hi, {userName}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Shield className="w-4 h-4 text-green-500" /> System Online
          </p>
        </div>
        <button className="p-2 rounded-full bg-muted/50 relative">
          <Bell className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 space-y-6">
        
        {/* Quick Safety Check Card */}
        <div className="glass p-5 rounded-3xl">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-primary" /> Route Checker
          </h2>
          <div className="flex bg-muted/50 rounded-xl p-2 items-center gap-2">
            <input 
              type="text" 
              placeholder="Where are you going?" 
              className="bg-transparent border-none outline-none flex-1 px-2 text-sm"
            />
            <Link href="/route-check" className="bg-primary text-primary-foreground p-2 rounded-lg">
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Big SOS Button */}
        <div className="flex flex-col items-center justify-center py-6">
          <button onClick={handleSOSClick} disabled={sosLoading} className="relative group outline-none">
            <div className={`absolute inset-0 bg-destructive/20 rounded-full blur-xl group-hover:bg-destructive/30 transition-all duration-500 ${sosLoading ? 'animate-none' : 'animate-pulse'}`}></div>
            <div className="w-48 h-48 bg-destructive rounded-full flex flex-col items-center justify-center text-white shadow-2xl shadow-destructive/50 border-8 border-background relative z-10 hover:scale-105 active:scale-95 transition-all">
              {sosLoading ? (
                <span className="text-xl font-bold tracking-widest animate-pulse">LOCATING...</span>
              ) : (
                <>
                  <AlertTriangle className="w-16 h-16 mb-2" />
                  <span className="text-3xl font-black tracking-widest">SOS</span>
                  <span className="text-xs uppercase tracking-widest mt-1 opacity-80">Tap to Trigger</span>
                </>
              )}
            </div>
          </button>
        </div>

        {/* Trusted Contacts & Local Safety — REAL DATA */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/profile" className="glass p-4 rounded-2xl flex flex-col justify-between hover:bg-white/5 transition-colors">
            <h3 className="font-medium text-sm text-muted-foreground mb-4 flex items-center gap-1">
              <Users className="w-3 h-3" /> Trusted Contacts
            </h3>
            {contacts.length > 0 ? (
              <div className="flex -space-x-2">
                {contacts.slice(0, 4).map((c, i) => (
                  <div key={c.id} className={`w-8 h-8 rounded-full ${contactColors[i % contactColors.length]} border-2 border-background flex items-center justify-center text-white text-xs font-bold`}>
                    {c.name[0]?.toUpperCase()}
                  </div>
                ))}
                {contacts.length > 4 && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border-2 border-background text-xs">
                    +{contacts.length - 4}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No contacts added yet. Tap to add.</p>
            )}
          </Link>

          <Link href="/community-report" className="glass p-4 rounded-2xl flex flex-col justify-between hover:bg-white/5 transition-colors">
            <h3 className="font-medium text-sm text-muted-foreground mb-4">Local Safety</h3>
            {reports.length > 0 ? (
              <div className="text-xs flex items-center gap-1 bg-yellow-500/10 text-yellow-500 p-2 rounded-lg">
                <AlertTriangle className="w-3 h-3" /> {reports.length} report{reports.length !== 1 ? 's' : ''} nearby
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No reports yet.</p>
            )}
          </Link>
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
