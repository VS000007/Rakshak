import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const text = url.searchParams.get('text');

  if (!text) {
    return NextResponse.json({ error: 'Text parameter is required' }, { status: 400 });
  }

  try {
    const fetchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=5`;
    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'VibeCodingSecurityApp/1.0',
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
