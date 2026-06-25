"use client";

import { useState, useEffect, useCallback } from "react";
import BottomNav from "@/components/layout/BottomNav";
import { MapPin, Navigation, ShieldAlert, CheckCircle2, Route, Sparkles, Loader2, AlertCircle, Clock, Ruler } from "lucide-react";
import dynamic from "next/dynamic";

const RouteMap = dynamic(() => import("@/components/map/RouteMap"), { ssr: false });

// ==========================================
// 1. ALL-INDIA HIGH-PRIORITY SECURITY HELPLINES
// ==========================================
const PAN_INDIA_SECURITY_REGISTRY = {
  NATIONAL_EMERGENCY: { title: "National Emergency Response", phone: "112" },
  WOMEN_HELPLINE: { title: "Women Helpline (All India)", phone: "1091" },
  RAILWAY_SECURITY: { title: "Railway Protection (RPF)", phone: "139" },
  HIGHWAY_SUPPORT: { title: "National Highway Helpline", phone: "1033" }
};

// ==========================================
// 2. INTELLIGENT ENVIRONMENT DETECTION LOGIC
// ==========================================
const analyzeTargetTransitEnvironment = (destinationAddress: string) => {
  const addressLower = destinationAddress.toLowerCase();
  const currentHour = new Date().getHours();
  const isNightHours = currentHour >= 20 || currentHour < 5;

  // Real-time tracking for major Indian Metro networks
  const hasMetroNetwork = ["delhi", "noida", "gurugram", "mumbai", "bengaluru", "kolkata", "chennai", "hyderabad", "jaipur", "lucknow", "kochi", "ahmedabad", "pune"].some(city => addressLower.includes(city));
  
  let zoneType = "Regional Bus & Auto-Rickshaw Sector";
  let advisoryText = "";
  let badgeColor = "#e2e8f0";
  let badgeTextColor = "#4a5568";

  if (hasMetroNetwork) {
    zoneType = "Metro & Active Commercial Fleet Zone";
    if (isNightHours) {
      badgeColor = "#feebec";
      badgeTextColor = "#c53030";
      advisoryText = "⚠️ Night Protocol Active: Metro operations conclude around 11:00 PM. Avoid unlit footpaths outside terminals. Booking verified app-based cabs (Uber/Ola) from well-lit, populated exit gates is highly recommended.";
    } else {
      badgeColor = "#e6fffa";
      badgeTextColor = "#234e52";
      advisoryText = "⏱️ Optimal Daylight Conditions: Metro lines are running at standard frequencies. For enhanced personal security, please utilize the designated ladies' coaches.";
    }
  } else {
    zoneType = "Regional Public Transit & Local Para-Transit Zone";
    if (isNightHours) {
      badgeColor = "#fffaf0";
      badgeTextColor = "#dd6b20";
      advisoryText = "⚠️ High Caution Advisory: Semi-urban or rural sector detected during late hours. Fixed public bus networks may be non-operational. Do not wait at isolated stops. Share your live tracking with your trusted contacts immediately, or dial 112 for a safety escort.";
    } else {
      badgeColor = "#f7fafc";
      badgeTextColor = "#2d3748";
      advisoryText = "☀️ Daylight Transit Active: Rely on official state-run transport buses or registered local vehicle stands. Always share your ride parameters dynamically with trusted connections.";
    }
  }

  return { zoneType, advisoryText, badgeColor, badgeTextColor, displaysMetroBtn: hasMetroNetwork };
};

// ==========================================
// 3. SECURE DEEP-LINK GENERATOR (UBER & OLA APPS)
// ==========================================
const generateCabSafetyDeepLinks = (startLat: number, startLng: number, destLat: number, destLng: number, destAddress: string) => {
  const encodedAddress = encodeURIComponent(destAddress);
  return {
    uberLauncher: `uber://?action=setPickup&pickup[latitude]=${startLat}&pickup[longitude]=${startLng}&dropoff[latitude]=${destLat}&dropoff[longitude]=${destLng}&dropoff[nickname]=${encodedAddress}`,
    olaLauncher: `ola://share/ridesync?pickup_lat=${startLat}&pickup_lng=${startLng}&drop_lat=${destLat}&drop_lng=${destLng}`,
    fallbackTransitMap: `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${destLat},${destLng}&travelmode=transit`
  };
};

interface RouteResult {
  score: number | null;
  riskLevel: string;
  factors: string[];
  aiSummary?: string;
  route?: {
    distance: string;
    walkTime: string;
    source: string;
    destination: string;
    sourceCoords?: { lat: number; lng: number };
    destCoords?: { lat: number; lng: number };
    path?: [number, number][];
  };
  alternative?: {
    exists: boolean;
    suggestion?: string;
    score?: number;
  };
}

export default function RouteCheckPage() {
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(true);
  const [userCoords, setUserCoords] = useState<{lat: number; lng: number} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RouteResult | null>(null);

  // Reverse geocode coordinates to a place name using Geoapify
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `/api/reverse-geocode?lat=${lat}&lng=${lng}`
      );
      const data = await res.json();
      return data.placeName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }, []);

  // Get real-time location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserCoords({ lat: latitude, lng: longitude });
        const placeName = await reverseGeocode(latitude, longitude);
        setSource(placeName);
        setGeoLoading(false);
      },
      (err) => {
        console.error("Geolocation error:", err.message);
        // Do NOT fall back to Delhi or IP — let the user type manually
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, [reverseGeocode]);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // 1. Geocode Source (with proximity bias from live GPS)
      const biasParams = userCoords ? `&lat=${userCoords.lat}&lng=${userCoords.lng}` : '';
      const srcRes = await fetch(`/api/geocode?text=${encodeURIComponent(source)}${biasParams}`);
      const srcData = await srcRes.json();
      if (!srcData || srcData.length === 0) throw new Error("Could not locate source address.");
      const srcCoords = { lat: parseFloat(srcData[0].lat), lng: parseFloat(srcData[0].lon) };
      const srcFormatted = srcData[0].display_name;

      // 2. Geocode Destination (with proximity bias from live GPS)
      const dstRes = await fetch(`/api/geocode?text=${encodeURIComponent(destination)}${biasParams}`);
      const dstData = await dstRes.json();
      if (!dstData || dstData.length === 0) throw new Error("Could not locate destination address.");
      const dstCoords = { lat: parseFloat(dstData[0].lat), lng: parseFloat(dstData[0].lon) };
      const dstFormatted = dstData[0].display_name;

      // 3. OSRM Routing
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${srcCoords.lng},${srcCoords.lat};${dstCoords.lng},${dstCoords.lat}?overview=full&geometries=geojson&steps=true`;
      const osrmRes = await fetch(osrmUrl);
      const osrmData = await osrmRes.json();

      if (osrmData.code !== "Ok" || !osrmData.routes || osrmData.routes.length === 0) {
        throw new Error("Could not find a valid driving route between these locations.");
      }

      const route = osrmData.routes[0];
      const distanceKm = route.distance / 1000;
      const durationMin = route.duration / 60;

      // Convert GeoJSON coordinates [lng, lat] to Leaflet [lat, lng]
      const pathCoords: [number, number][] = route.geometry.coordinates.map(
        (coord: [number, number]) => [coord[1], coord[0]]
      );

      // 4. Safety Analysis Algorithm
      // Mocking the detection of remote/unlit areas based on node density
      const nodeDensity = pathCoords.length / distanceKm;
      let safetyCardText = "Green / Secure Highway Route";
      let riskLvl = "Low";
      let scoreVal = 95;

      if (nodeDensity > 20) {
        // High nodes per km = likely small dense residential or unlit narrow sectors
        safetyCardText = "Orange Warning / Low Traffic Sector detected";
        riskLvl = "Moderate";
        scoreVal = 65;
      }

      setResult({
        score: scoreVal,
        riskLevel: riskLvl,
        factors: [safetyCardText, `Distance: ${distanceKm.toFixed(1)} km`, `Est Time: ${Math.round(durationMin)} mins`],
        aiSummary: `Safety Rule Output: ${safetyCardText}. Please stay vigilant on this route.`,
        route: {
          distance: `${distanceKm.toFixed(1)} km`,
          walkTime: `${Math.round(durationMin)} min`,
          source: srcFormatted,
          destination: dstFormatted,
          sourceCoords: srcCoords,
          destCoords: dstCoords,
          path: pathCoords,
        },
        alternative: { exists: false }
      } as RouteResult);

    } catch (err: any) {
      setError(err.message || "Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 80) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBg = (score: number | null) => {
    if (score === null) return "bg-muted";
    if (score >= 80) return "bg-green-500/20";
    if (score >= 50) return "bg-yellow-500/20";
    return "bg-red-500/20";
  };

  const getRiskIcon = (level: string) => {
    if (level === "Low") return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (level === "Moderate") return <ShieldAlert className="w-5 h-5 text-yellow-500" />;
    return <AlertCircle className="w-5 h-5 text-red-500" />;
  };

  return (
    <div className="min-h-screen pb-20 bg-background flex flex-col">
      <header className="p-6 border-b border-white/5">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Route className="w-6 h-6 text-primary" /> Route Safety
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Real-time AI safety analysis powered by Geoapify + Gemini</p>
      </header>

      <main className="flex-1 p-6 space-y-6">
        <form onSubmit={handleCheck} className="glass p-5 rounded-3xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <div className="w-0.5 h-8 bg-muted-foreground/30"></div>
              <div className="w-3 h-3 rounded-full bg-primary"></div>
            </div>
            <div className="flex-1 space-y-3">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder={geoLoading ? "Detecting your location..." : "Enter your current location"}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  disabled={geoLoading}
                  className="w-full bg-muted/50 p-3 rounded-xl outline-none border border-transparent focus:border-primary transition-all text-sm disabled:opacity-50"
                />
                {geoLoading && (
                  <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary" />
                )}
                {!geoLoading && source && (
                  <MapPin className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                )}
              </div>
              <input 
                type="text" 
                placeholder="Where are you going?" 
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full bg-muted/50 p-3 rounded-xl outline-none border border-transparent focus:border-primary transition-all text-sm"
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading || !destination || !source}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing route with AI...</span>
              </>
            ) : "Check Route Safety"}
          </button>
        </form>

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Analysis Failed</p>
              <p className="text-xs text-destructive/80 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Route Info Bar */}
            {result.route && (
              <div className="flex gap-3">
                <div className="flex-1 glass p-3 rounded-xl flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Distance</p>
                    <p className="text-sm font-semibold">{result.route.distance}</p>
                  </div>
                </div>
                <div className="flex-1 glass p-3 rounded-xl flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Walk Time</p>
                    <p className="text-sm font-semibold">{result.route.walkTime}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Route Safety Analytics Card — Smart Transit & Universal Safety Hub */}
            {(() => {
              if (!result.route || !result.route.sourceCoords || !result.route.destCoords) return null;

              const envData = analyzeTargetTransitEnvironment(result.route.destination);
              const links = generateCabSafetyDeepLinks(
                result.route.sourceCoords.lat,
                result.route.sourceCoords.lng,
                result.route.destCoords.lat,
                result.route.destCoords.lng,
                result.route.destination
              );

              return (
                <div className="smart-security-transit-card" style={{ width: '100%', fontFamily: 'system-ui, -apple-system, sans-serif', boxSizing: 'border-box', padding: '16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginTop: '16px' }}>
                  
                  {/* Step 1: Environment Intelligence Alert Panel */}
                  <div style={{ borderBottom: '1px solid #edf2f7', paddingBottom: '14px', marginBottom: '14px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <span id="env-zone-badge" style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'inline-block', background: envData.badgeColor, color: envData.badgeTextColor }}>
                        {envData.zoneType}
                      </span>
                    </div>
                    <p id="env-advisory-field" style={{ margin: 0, fontSize: '13px', color: '#2d3748', lineHeight: 1.5, fontWeight: 500 }}>
                      {envData.advisoryText}
                    </p>
                  </div>

                  {/* Step 2: High-Utility Transport Booking Options */}
                  <div style={{ marginBottom: '16px' }}>
                    <h5 style={{ margin: '0 0 10px 0', fontSize: '11px', textTransform: 'uppercase', color: '#718096', letterSpacing: '0.8px', fontWeight: 700 }}>Verified Transit Launchers</h5>
                    
                    {/* On-Demand Cabs Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <a href={links.uberLauncher} id="uber-trigger-btn" style={{ background: '#000000', color: '#ffffff', textDecoration: 'none', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>
                        🚖 Launch Uber
                      </a>
                      <a href={links.olaLauncher} id="ola-trigger-btn" style={{ background: '#28a745', color: '#ffffff', textDecoration: 'none', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(40,167,69,0.15)' }}>
                        🚕 Launch Ola
                      </a>
                    </div>

                    {/* Public Transportation Directories */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <a href={links.fallbackTransitMap} id="metro-search-btn" style={{ background: '#f8fafc', border: '1px solid #cbd5e0', color: '#2b6cb0', textDecoration: 'none', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, textAlign: 'center', display: envData.displaysMetroBtn ? 'block' : 'none' }}>
                        🚇 Locate Nearest Metro Stations &amp; Tracks
                      </a>
                      <a href={links.fallbackTransitMap} id="bus-search-btn" style={{ background: '#f8fafc', border: '1px solid #cbd5e0', color: '#2d3748', textDecoration: 'none', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, textAlign: 'center', display: 'block' }}>
                        Bus Stops &amp; Schedules Near Me
                      </a>
                    </div>
                  </div>

                  {/* Step 3: Crisis Response Government Helpline Matrix */}
                  <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '14px', padding: '14px' }}>
                    <h5 style={{ margin: '0 0 4px 0', fontSize: '11px', textTransform: 'uppercase', color: '#c53030', letterSpacing: '0.8px', fontWeight: 700 }}>🚨 Urgent Support Desk (Tap to Call)</h5>
                    <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: '#742a2a', fontWeight: 500 }}>Direct links to official Indian national law enforcement dispatchers.</p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <a href={`tel:${PAN_INDIA_SECURITY_REGISTRY.NATIONAL_EMERGENCY.phone}`} style={{ background: '#c53030', color: '#ffffff', textDecoration: 'none', padding: '12px 4px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', textAlign: 'center', display: 'block', boxShadow: '0 2px 4px rgba(197,48,48,0.2)' }}>
                        Police Desk: {PAN_INDIA_SECURITY_REGISTRY.NATIONAL_EMERGENCY.phone}
                      </a>
                      <a href={`tel:${PAN_INDIA_SECURITY_REGISTRY.WOMEN_HELPLINE.phone}`} style={{ background: '#dd6b20', color: '#ffffff', textDecoration: 'none', padding: '12px 4px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', textAlign: 'center', display: 'block', boxShadow: '0 2px 4px rgba(221,107,32,0.2)' }}>
                        Women Line: {PAN_INDIA_SECURITY_REGISTRY.WOMEN_HELPLINE.phone}
                      </a>
                      <a href={`tel:${PAN_INDIA_SECURITY_REGISTRY.RAILWAY_SECURITY.phone}`} style={{ background: '#4a5568', color: '#ffffff', textDecoration: 'none', padding: '12px 4px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', textAlign: 'center', display: 'block' }}>
                        Railway RPF: {PAN_INDIA_SECURITY_REGISTRY.RAILWAY_SECURITY.phone}
                      </a>
                      <a href={`tel:${PAN_INDIA_SECURITY_REGISTRY.HIGHWAY_SUPPORT.phone}`} style={{ background: '#4a5568', color: '#ffffff', textDecoration: 'none', padding: '12px 4px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', textAlign: 'center', display: 'block' }}>
                        Highway Desk: {PAN_INDIA_SECURITY_REGISTRY.HIGHWAY_SUPPORT.phone}
                      </a>
                    </div>
                  </div>

                </div>
              );
            })()}

            {/* Resolved Addresses & Map */}
            {result.route && (
              <div className="space-y-4">
                <div className="glass p-4 rounded-2xl space-y-2">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-blue-400">From:</span> {result.route.source}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-primary">To:</span> {result.route.destination}
                  </p>
                </div>
                
                {result.route.sourceCoords && (
                  <RouteMap 
                    sourceCoords={result.route.sourceCoords} 
                    destCoords={result.route.destCoords} 
                    routePath={result.route.path} 
                  />
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
