import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const GEOPIFY_KEY = process.env.GEOPIFY_API_KEY!;
const GEMINI_KEY = process.env.GEMINI_API_KEY!;

async function geocode(text: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
  const res = await fetch(
    `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(text)}&limit=1&apiKey=${GEOPIFY_KEY}`
  );
  const data = await res.json();
  if (data.features && data.features.length > 0) {
    const props = data.features[0].properties;
    return { lat: props.lat, lng: props.lon, formatted: props.formatted };
  }
  return null;
}

async function getRoute(srcLat: number, srcLng: number, dstLat: number, dstLng: number) {
  const res = await fetch(
    `https://api.geoapify.com/v1/routing?waypoints=${srcLat},${srcLng}|${dstLat},${dstLng}&mode=walk&apiKey=${GEOPIFY_KEY}`
  );
  const data = await res.json();
  if (data.features && data.features.length > 0) {
    const leg = data.features[0].properties.legs?.[0];
    let pathCoords: [number, number][] = [];
    if (data.features[0].geometry && data.features[0].geometry.coordinates) {
      // Geoapify returns [lng, lat], Leaflet needs [lat, lng]
      const coords = data.features[0].geometry.coordinates;
      if (Array.isArray(coords)) {
        coords.forEach((segment: any) => {
          if (Array.isArray(segment)) {
            segment.forEach((pt: any) => {
              if (Array.isArray(pt) && pt.length >= 2) {
                pathCoords.push([pt[1], pt[0]]);
              }
            });
          }
        });
      }
    }

    return {
      distance_m: leg?.distance || 0,
      time_s: leg?.time || 0,
      path: pathCoords,
      steps: leg?.steps?.map((s: any) => ({
        instruction: s.instruction?.text || '',
        distance: s.distance,
        road: s.name || 'unnamed road',
      })) || [],
    };
  }
  return null;
}

async function analyzeWithGemini(
  source: string,
  destination: string,
  routeData: any,
  timeOfDay: string
) {
  const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

  const prompt = `You are a women's safety route analyst. Analyze this walking route for safety risks.

Source: ${source}
Destination: ${destination}
Distance: ${routeData.distance_m}m
Estimated walk time: ${Math.round(routeData.time_s / 60)} minutes
Time of day: ${timeOfDay}
Route steps: ${JSON.stringify(routeData.steps.slice(0, 10))}

Respond ONLY in valid JSON with this exact structure (no markdown, no code fences):
{
  "score": <integer 0-100 where 100 is safest>,
  "riskLevel": "<Low|Moderate|High|Critical>",
  "factors": ["<real risk factor 1>", "<real risk factor 2>"],
  "aiSummary": "<2-3 sentence extremely concise and specific safety assessment. DO NOT repeat yourself. DO NOT provide generic paragraphs. Give exact actionable tips based on distance and steps.>",
  "alternative": {
    "exists": <true or false>,
    "suggestion": "<if exists, describe a concise alternative>"
  }
}

Base your analysis on:
- Time of day (night is riskier)
- Distance and walk time (longer walks = more exposure)
- Whether the route uses main roads vs unnamed/residential streets
- General urban safety principles for women walking alone
Be honest and realistic. Do NOT invent fake data. DO NOT REPEAT PARAGRAPHS. Keep the aiSummary short and highly specific.`;

  const maxRetries = 3;
  let delay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      
      const text = response.text || '';
      // Strip markdown code fences if present
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err: any) {
      const isUnavailable = err.message?.includes('503') || err.message?.includes('UNAVAILABLE');
      if (attempt === maxRetries && isUnavailable) {
        // Fallback to gemini-1.5-flash
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: prompt,
          });
          const text = response.text || '';
          const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          return JSON.parse(cleaned);
        } catch {
          return null;
        }
      }
      if (isUnavailable && attempt < maxRetries) {
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      } else if (!isUnavailable) {
        return null;
      }
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { source, destination } = body;

    if (!source || !destination) {
      return NextResponse.json({ error: 'Source and destination are required' }, { status: 400 });
    }

    // Step 1: Geocode both locations
    const [srcGeo, dstGeo] = await Promise.all([geocode(source), geocode(destination)]);
    if (!srcGeo || !dstGeo) {
      return NextResponse.json({ error: 'Could not geocode one or both locations. Please enter valid place names.' }, { status: 400 });
    }

    // Step 2: Get real route from Geoapify
    const routeData = await getRoute(srcGeo.lat, srcGeo.lng, dstGeo.lat, dstGeo.lng);
    if (!routeData) {
      return NextResponse.json({ error: 'Could not calculate a walking route between these locations.' }, { status: 400 });
    }

    // Step 3: Determine time of day
    const hour = new Date().getHours();
    const timeOfDay = hour >= 6 && hour < 18 ? 'Daytime' : hour >= 18 && hour < 21 ? 'Evening/Dusk' : 'Night';

    // Step 4: Analyze with Gemini AI
    const analysis = await analyzeWithGemini(srcGeo.formatted, dstGeo.formatted, routeData, timeOfDay);

    if (!analysis) {
      // Fallback: return route data without AI analysis
      return NextResponse.json({
        score: null,
        riskLevel: 'Unknown',
        factors: ['AI analysis temporarily unavailable'],
        aiSummary: 'AI safety analysis is temporarily unavailable. Please exercise general caution.',
        route: {
          distance: `${(routeData.distance_m / 1000).toFixed(1)} km`,
          walkTime: `${Math.round(routeData.time_s / 60)} min`,
          source: srcGeo.formatted,
          destination: dstGeo.formatted,
          sourceCoords: { lat: srcGeo.lat, lng: srcGeo.lng },
          destCoords: { lat: dstGeo.lat, lng: dstGeo.lng },
          path: routeData.path || []
        },
        alternative: { exists: false },
      });
    }

    return NextResponse.json({
      ...analysis,
      route: {
        distance: `${(routeData.distance_m / 1000).toFixed(1)} km`,
        walkTime: `${Math.round(routeData.time_s / 60)} min`,
        source: srcGeo.formatted,
        destination: dstGeo.formatted,
        sourceCoords: { lat: srcGeo.lat, lng: srcGeo.lng },
        destCoords: { lat: dstGeo.lat, lng: dstGeo.lng },
        path: routeData.path || []
      },
    });
  } catch (error: any) {
    console.error('[route-risk] Error:', error.message);
    return NextResponse.json({ error: 'Failed to analyze route safety' }, { status: 500 });
  }
}
