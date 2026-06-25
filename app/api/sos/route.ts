import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lat, long, battery, speed } = body;

    // Insert SOS event into Supabase
     const supabase = await createClient();
     const { data, error } = await (supabase as any)
       .from('emergency_events')
       .insert([
         {
           user_id: (await supabase.auth.getUser()).data.user?.id,
           latitude: Number(lat),
           longitude: Number(long),
           battery_percent: battery,
           speed_kmh: speed,
         },
       ])
       .select();

     if (error) {
       console.error('Supabase insert error:', error);
       return NextResponse.json({ error: 'Failed to store SOS event' }, { status: 500 });
     }
     const eventId = data?.[0]?.id;

     // Trigger AI assessment
     const aiResp = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ai-assistant`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         prompt: `SOS event at (${lat}, ${long}) with battery ${battery}% and speed ${speed} km/h.`,
       }),
     });
     const aiData = await aiResp.json();

     return NextResponse.json({
       success: true,
       eventId,
       aiReasoning: aiData.response || '',
     });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process SOS' }, { status: 500 });
  }
}
