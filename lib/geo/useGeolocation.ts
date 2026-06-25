import { useState, useEffect } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  precision: string | null;
  error: string | null;
  loading: boolean;
}

// ==========================================
// IP FALLBACK — ip-api.com (APAC optimized)
// ==========================================
const fallbackToIPLocation = (
  onSuccess: (coords: { lat: number; lng: number; precision: string }) => void
) => {
  // Utilizing highly optimized APAC regional network nodes for pinpoint country accuracy
  fetch('http://ip-api.com/json')
    .then(res => {
      if (!res.ok) throw new Error("Network response was not acceptable");
      return res.json();
    })
    .then(data => {
      if (data.status !== "success") throw new Error(data.message || "Query failed");

      console.log(`[Precision Fallback] Located via ${data.query} at ${data.city}, ${data.regionName}`);

      // Dispatch coordinates back into the mapping engine smoothly
      onSuccess({
        lat: data.lat,
        lng: data.lon,
        precision: `Network Locality: ${data.city}`,
      });
    })
    .catch(err => {
      console.error("Critical: Geolocation fallback stack depleted.", err);
      // Do NOT silently fall back to hardcoded coordinates — that causes wrong-location bugs
    });
};

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    precision: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    // Layer B: silent IP-based fallback
    const activateIPFallback = () => {
      fallbackToIPLocation(({ lat, lng, precision }) => {
        setState({
          latitude: lat,
          longitude: lng,
          accuracy: null,
          precision,
          error: null,
          loading: false,
        });
      });
    };

    // Layer A: native high-accuracy GPS
    if (!navigator.geolocation) {
      activateIPFallback();
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          precision: "GPS",
          error: null,
          loading: false,
        });
      },
      (error) => {
        // GPS denied or unavailable — silently switch to IP fallback
        console.warn("[useGeolocation] GPS unavailable:", error.message);
        activateIPFallback();
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const setManualOverride = (latitude: number, longitude: number) => {
    setState({
      latitude,
      longitude,
      accuracy: null,
      precision: "Manual",
      error: null,
      loading: false,
    });
  };

  return { ...state, setManualOverride };
}
