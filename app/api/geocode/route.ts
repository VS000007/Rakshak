import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const text = url.searchParams.get('text');
  const biasLat = url.searchParams.get('lat');
  const biasLng = url.searchParams.get('lng');

  if (!text) {
    return NextResponse.json({ error: 'Text parameter is required' }, { status: 400 });
  }

  const GEOPIFY_KEY = process.env.GEOPIFY_API_KEY;

  try {
    // ─── Strategy: Use Geoapify if key is available (better bias/filter support) ───
    if (GEOPIFY_KEY) {
      let geoapifyUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(text)}&filter=countrycode:in&limit=5&apiKey=${GEOPIFY_KEY}`;

      // Add proximity bias using user's live GPS coordinates
      if (biasLat && biasLng) {
        geoapifyUrl += `&bias=proximity:${biasLng},${biasLat}`;
      }

      const res = await fetch(geoapifyUrl);
      if (!res.ok) throw new Error(`Geoapify responded with status ${res.status}`);
      const data = await res.json();

      if (data.features && data.features.length > 0) {
        // Convert Geoapify response format to match our expected format
        const results = data.features.map((f: any) => ({
          lat: String(f.properties.lat),
          lon: String(f.properties.lon),
          display_name: f.properties.formatted,
        }));
        return NextResponse.json(results);
      }

      return NextResponse.json([]);
    }

    // ─── Fallback: Nominatim (no bias support, but works without API key) ─────────
    let nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=5&countrycodes=in`;

    const res = await fetch(nominatimUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'RakshakSafetyApp/1.0',
        'From': 'ompoojhi@gmail.com'
      }
    });

    if (!res.ok) {
      throw new Error(`Nominatim API responded with status ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[geocode] Error:', error.message);
    return NextResponse.json({ error: 'Failed to geocode location' }, { status: 500 });
  }
}
