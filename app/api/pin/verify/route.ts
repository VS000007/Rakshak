import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── GET /api/pin/verify?token=TOKEN ──────────────────────────────────────────
// Called when the user clicks the link in their email.
// Verifies the token, writes the new PIN to localStorage (client-side),
// and redirects to a success or error page.
//
// NOTE: Because the vault PIN is intentionally stored client-side only
// (localStorage) for offline privacy, the actual pin write happens
// client-side on the /verify-pin-change page after this route confirms the token.
// This route returns JSON; the redirect page does the localStorage write.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const serviceClient = getServiceClient();
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null;

  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token || token.length < 64) {
    return NextResponse.redirect(`${appUrl}/verify-pin-change?status=invalid`);
  }

  // 1. Look up token
  const { data: record, error } = await serviceClient
    .from('pin_change_requests')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !record) {
    return NextResponse.redirect(`${appUrl}/verify-pin-change?status=invalid`);
  }

  // 2. Check if already used
  if (record.used) {
    await serviceClient.from('pin_change_audit').insert({
      user_id: record.user_id,
      outcome: 'already_used',
      ip_address: ip,
    });
    return NextResponse.redirect(`${appUrl}/verify-pin-change?status=already_used`);
  }

  // 3. Check expiry — enforced on the server
  if (new Date(record.expires_at) < new Date()) {
    await serviceClient.from('pin_change_audit').insert({
      user_id: record.user_id,
      outcome: 'expired',
      ip_address: ip,
    });
    return NextResponse.redirect(`${appUrl}/verify-pin-change?status=expired`);
  }

  // 4. All checks passed — mark token as used immediately (one-time use)
  await serviceClient
    .from('pin_change_requests')
    .update({ used: true })
    .eq('id', record.id);

  // 5. Audit success
  await serviceClient.from('pin_change_audit').insert({
    user_id: record.user_id,
    outcome: 'success',
    ip_address: ip,
  });

  // 6. Redirect to client-side page with the hashed data embedded in URL
  //    The page reads this and writes to localStorage (vault stays client-side)
  //    new_pin_hash is "salt:hash" — safe to pass in URL (hash, not plaintext)
  const encoded = encodeURIComponent(record.new_pin_hash);
  return NextResponse.redirect(
    `${appUrl}/verify-pin-change?status=success&payload=${encoded}`
  );
}
