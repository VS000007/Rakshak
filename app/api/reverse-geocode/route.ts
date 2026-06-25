import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const GEOPIFY_KEY = process.env.GEOPIFY_API_KEY;
  if (!GEOPIFY_KEY) {
    return NextResponse.json({ placeName: `${lat}, ${lng}` });
  }

  try {
    const res = await fetch(
      `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${GEOPIFY_KEY}`
    );
    const data = await res.json();

    if (data.features && data.features.length > 0) {
      const props = data.features[0].properties;
      // Build a readable place name from available parts
      const parts = [
        props.name,
        props.street,
        props.suburb,
        props.city || props.town || props.village,
        props.state,
      ].filter(Boolean);
      
      const placeName = parts.length > 0 
        ? [...new Set(parts)].join(', ')  // deduplicate parts
        : props.formatted || `${lat}, ${lng}`;
        
      return NextResponse.json({ 
        placeName,
        fullAddress: props.formatted,
        lat: props.lat,
        lng: props.lon,
      });
    }

    return NextResponse.json({ placeName: `${lat}, ${lng}` });
  } catch (error: any) {
    console.error('[reverse-geocode]', error.message);
    return NextResponse.json({ placeName: `${lat}, ${lng}` });
  }
}
