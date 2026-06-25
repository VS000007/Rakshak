import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { randomBytes, createHash } from 'crypto';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function sendVerificationEmail(toEmail: string, token: string, appUrl: string) {
  const verifyUrl = `${appUrl}/verify-pin-change?token=${token}`;
  
  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  
  if (!host || !user || !pass || user.includes('your_app_email')) {
    console.log(`[DEV] Resend PIN verification: ${verifyUrl}`);
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Rakshak Safety" <onboarding@resend.dev>',
      to: toEmail,
      subject: '[Safety App] Confirm Your New Security PIN',
      html: `<p>Click <a href="${verifyUrl}">here</a> to confirm your new Security PIN. Expires in 15 minutes.</p>`,
    });
    return true;
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to resend email:', err);
    return false;
  }
}

// ─── POST /api/pin/resend ─────────────────────────────────────────────────────
// Re-generates a fresh token and sends a new email. Rate-limited to 3/hr.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // Rate limit: max 3 requests per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await serviceClient
      .from('pin_change_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);

    if ((count ?? 0) >= 3) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // Find the last pending token to get the stored new_pin_hash
    const { data: pending } = await serviceClient
      .from('pin_change_requests')
      .select('new_pin_hash')
      .eq('user_id', user.id)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!pending) {
      return NextResponse.json({ error: 'No pending PIN change found. Please start a new request.' }, { status: 404 });
    }

    // Invalidate all old pending tokens
    await serviceClient
      .from('pin_change_requests')
      .update({ used: true })
      .eq('user_id', user.id)
      .eq('used', false);

    // Create new token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const ip = req.headers.get('x-forwarded-for') ?? null;

    await serviceClient.from('pin_change_requests').insert({
      user_id: user.id,
      token,
      new_pin_hash: pending.new_pin_hash,
      expires_at: expiresAt,
      ip_address: ip,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    await sendVerificationEmail(user.email!, token, appUrl);

    const email = user.email!;
    const maskedEmail = email.slice(0, 2) + '****' + email.slice(email.indexOf('@'));

    return NextResponse.json({ success: true, maskedEmail, expiresAt });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
