import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || '' } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { latitude, longitude, tag, note } = body;

    if (!latitude || !longitude || !tag) {
      return NextResponse.json({ error: 'latitude, longitude, and tag are required' }, { status: 400 });
    }

    const { data, error } = await supabase.from('community_reports').insert({
      user_id: user.id,
      latitude,
      longitude,
      tag,
      note: note || null,
    }).select().single();

    if (error) throw error;

    return NextResponse.json({ success: true, report: data });
  } catch (error: any) {
    console.error('[community-report POST]', error.message);
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('community_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({ reports: data || [] });
  } catch (error: any) {
    console.error('[community-report GET]', error.message);
    return NextResponse.json({ reports: [] });
  }
}
