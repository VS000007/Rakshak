"use client";

import { useState, useEffect, useCallback } from "react";
import BottomNav from "@/components/layout/BottomNav";
import { Users, AlertTriangle, ShieldCheck, MapPin, Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

type ReportTag = 'POORLY_LIT' | 'ISOLATED' | 'SAFE';

interface Report {
  id: string;
  user_id: string;
  tag: ReportTag;
  note: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
}

export default function CommunityReportPage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<ReportTag | null>(null);
  const [note, setNote] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationName, setLocationName] = useState("");
  const [geoLoading, setGeoLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const supabase = createClient();

  // Reverse geocode
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      return data.placeName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }, []);

  // Get location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        const name = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setLocationName(name);
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [reverseGeocode]);

  // Fetch real reports from Supabase
  useEffect(() => {
    const fetchReports = async () => {
      const { data } = await supabase
        .from("community_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      setReports(data || []);
      setReportsLoading(false);
    };
    fetchReports();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTag || latitude === null || longitude === null) return;

    setSubmitting(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in to submit a report.");
      setSubmitting(false);
      return;
    }

    const { data, error: dbError } = await supabase
      .from<Database['public']['Tables']['community_reports']['Insert']>("community_reports")
      .insert({
        user_id: user.id,
        latitude,
        longitude,
        tag: selectedTag,
        note: note.trim() || null,
      })
      .select()
      .single();

    if (dbError) {
      setError(dbError.message);
    } else {
      setSubmitted(true);
      if (data) {
        setReports(prev => [data, ...prev]);
      }
      setSelectedTag(null);
      setNote("");
      setTimeout(() => setSubmitted(false), 3000);
    }
    setSubmitting(false);
  };

  const tagLabel = (tag: string) => {
    if (tag === "POORLY_LIT") return "Poorly Lit";
    if (tag === "ISOLATED") return "Isolated";
    if (tag === "SAFE") return "Safe / Patrolled";
    return tag;
  };

  const tagIcon = (tag: string) => {
    if (tag === "POORLY_LIT") return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    if (tag === "ISOLATED") return <Users className="w-4 h-4 text-orange-500" />;
    return <ShieldCheck className="w-4 h-4 text-green-500" />;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return `${Math.floor(hrs / 24)} day${hrs >= 48 ? 's' : ''} ago`;
  };

  return (
    <div className="min-h-screen pb-20 bg-background flex flex-col">
      <header className="p-6 border-b border-white/5">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" /> Community Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Help others by reporting real safety conditions.</p>
      </header>

      <main className="flex-1 p-6 space-y-6">
        
        <form onSubmit={handleSubmit} className="glass p-5 rounded-3xl space-y-5">
          {/* Real-time Location */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Location</label>
            <div className="flex bg-muted/50 p-3 rounded-xl items-center gap-2">
              {geoLoading ? (
                <>
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <span className="text-sm text-muted-foreground">Detecting location...</span>
                </>
              ) : locationName ? (
                <>
                  <MapPin className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-foreground">{locationName}</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-muted-foreground">Location unavailable. Please allow location access.</span>
                </>
              )}
            </div>
          </div>

          {/* Condition Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Condition Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                type="button" 
                onClick={() => setSelectedTag("POORLY_LIT")}
                className={`p-3 border rounded-xl text-sm flex items-center justify-center gap-2 transition-colors ${selectedTag === "POORLY_LIT" ? "bg-yellow-500/20 border-yellow-500 text-yellow-500" : "border-white/10 hover:bg-muted"}`}
              >
                <AlertTriangle className="w-4 h-4" /> Poorly Lit
              </button>
              <button 
                type="button" 
                onClick={() => setSelectedTag("ISOLATED")}
                className={`p-3 border rounded-xl text-sm flex items-center justify-center gap-2 transition-colors ${selectedTag === "ISOLATED" ? "bg-orange-500/20 border-orange-500 text-orange-500" : "border-white/10 hover:bg-muted"}`}
              >
                <Users className="w-4 h-4" /> Isolated
              </button>
              <button 
                type="button" 
                onClick={() => setSelectedTag("SAFE")}
                className={`p-3 border rounded-xl text-sm flex items-center justify-center gap-2 transition-colors col-span-2 ${selectedTag === "SAFE" ? "bg-green-500/20 border-green-500 text-green-500" : "border-white/10 hover:bg-muted"}`}
              >
                <ShieldCheck className="w-4 h-4" /> Safe / Patrolled
              </button>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Additional Details (Optional)</label>
            <textarea 
              className="w-full bg-muted/50 p-3 rounded-xl outline-none border border-transparent focus:border-primary transition-all text-sm h-24 resize-none"
              placeholder="E.g. Street light is broken near the bus stop..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            ></textarea>
          </div>

          {error && <p className="text-destructive text-sm text-center">{error}</p>}

          <button 
            type="submit" 
            disabled={submitting || !selectedTag || latitude === null}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitted ? (
              <><CheckCircle className="w-4 h-4" /> Report Submitted!</>
            ) : submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
            ) : "Submit Report"}
          </button>
        </form>

        {/* Real Reports from Supabase */}
        <div className="space-y-4">
          <h3 className="font-semibold">Recent Community Reports</h3>
          
          {reportsLoading ? (
            <div className="glass p-8 rounded-2xl text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="glass p-8 rounded-2xl text-center">
              <p className="text-sm text-muted-foreground">No community reports yet. Be the first to contribute!</p>
            </div>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="glass p-4 rounded-2xl flex gap-4 items-start">
                <div className={`p-2 rounded-full ${report.tag === "SAFE" ? "bg-green-500/10" : report.tag === "POORLY_LIT" ? "bg-yellow-500/10" : "bg-orange-500/10"}`}>
                  {tagIcon(report.tag)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{tagLabel(report.tag)}</p>
                  {report.note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{report.note}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{timeAgo(report.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
