import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { randomBytes, createHash } from 'crypto';
import nodemailer from 'nodemailer';

// ─── Service-role Supabase client (bypasses RLS for server-side writes) ───────
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── SHA-256 hash helper (no bcrypt — keeping zero new deps) ─────────────────
// We use the same salt+SHA256 approach already in use throughout the vault
function sha256Hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// ─── Resend email helper ──────────────────────────────────────────────────────
async function sendVerificationEmail(
  toEmail: string,
  token: string,
  appUrl: string
): Promise<boolean> {
  const verifyUrl = `${appUrl}/verify-pin-change?token=${token}`;
  const maskedEmail = toEmail.slice(0, 2) + '****' + toEmail.slice(toEmail.indexOf('@'));

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Confirm PIN Change</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;color:#e5e5e5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:40px auto;background:#111111;border-radius:16px;border:1px solid #2a2a2a;overflow:hidden;">
    <tr><td style="padding:32px 36px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#d4a017;">RAKSHAK · SAFETY APP</p>
      <h1 style="margin:12px 0 24px;font-size:22px;font-weight:700;color:#ffffff;">Confirm Your Security PIN Change</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#aaaaaa;">
        We received a request to change the security PIN on your account.<br>
        Click the button below to confirm this change and activate your new PIN.
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${verifyUrl}" style="display:inline-block;background:#d4a017;color:#0a0a0a;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase;padding:14px 36px;border-radius:8px;">
          CONFIRM NEW PIN
        </a>
      </div>

      <p style="margin:0 0 8px;font-size:13px;color:#666;text-align:center;">
        This link expires in <strong style="color:#aaa;">15 minutes</strong> and can only be used once.
      </p>

      <hr style="border:none;border-top:1px solid #2a2a2a;margin:28px 0;">

      <div style="background:#1a0000;border:1px solid #4a0000;border-radius:8px;padding:16px 20px;">
        <p style="margin:0 0 6px;font-weight:700;color:#ff4444;font-size:13px;">⚠️ DID NOT REQUEST THIS?</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#cc9999;">
          If you did not request a PIN change, your account may be at risk.<br>
          <strong>Do NOT click the link above.</strong> Your current PIN remains unchanged.<br>
          Consider changing your password immediately.
        </p>
      </div>

      <p style="margin:24px 0 0;font-size:12px;color:#444;text-align:center;">
        Stay safe — The Rakshak Team
      </p>
    </td></tr>
  </table>
</body>
</html>`;

  const textBody = `RAKSHAK — Confirm Your Security PIN Change

We received a request to change the security PIN on your Safety App account.

To confirm this change, visit this link (valid for 15 minutes):
${verifyUrl}

WARNING: If you did not request this, do NOT click the link. Your current PIN remains unchanged.

This link is one-time use only.

— The Rakshak Team`;

  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  
  if (!host || !user || !pass || user.includes('your_app_email')) {
    // Dev mode: log to console instead of sending
    console.log(`\n[DEV] PIN verification email would be sent to: ${toEmail}`);
    console.log(`[DEV] Verification URL: ${verifyUrl}\n`);
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
      html: htmlBody,
      text: textBody,
    });
    return true;
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to send email:', err);
    return false;
  }
}

// ─── Rate limiting: max 3 requests per user per hour ─────────────────────────
async function isRateLimited(userId: string, serviceClient: any): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await serviceClient
    .from('pin_change_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo);

  return (count ?? 0) >= 3;
}

// ─── POST /api/pin/request-change ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // 1. Get authenticated user from session cookie
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { newPin, currentPinHash, currentSalt } = body as {
      newPin: string;
      currentPinHash?: string;
      currentSalt?: string;
    };

    // 2. Validate new PIN length
    if (!newPin || newPin.length < 6 || newPin.length > 20) {
      return NextResponse.json({ error: 'PIN must be 6–20 characters.' }, { status: 400 });
    }

    // 3. Ensure new PIN differs from the current one (if supplied)
    if (currentSalt && currentPinHash) {
      const newHash = sha256Hash(currentSalt + newPin);
      if (newHash === currentPinHash) {
        return NextResponse.json({ error: 'New PIN must differ from your current PIN.' }, { status: 400 });
      }
    }

    const serviceClient = getServiceClient();

    // 4. Rate limiting check
    if (await isRateLimited(user.id, serviceClient)) {
      // Log rate-limit audit event
      await serviceClient.from('pin_change_audit').insert({
        user_id: user.id,
        outcome: 'rate_limited',
        ip_address: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
      });
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // 5. Generate a cryptographically secure token (64 hex chars = 32 bytes)
    const token = randomBytes(32).toString('hex');

    // 6. Hash the new PIN with a fresh salt for storage
    const newSalt = randomBytes(16).toString('hex');
    const newPinHash = sha256Hash(newSalt + newPin);
    // Store salt embedded in the hash field as "salt:hash" so verify route can reconstruct
    const storedValue = `${newSalt}:${newPinHash}`;

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null;

    // 7. Invalidate any unused pending tokens for this user first
    await serviceClient
      .from('pin_change_requests')
      .update({ used: true })
      .eq('user_id', user.id)
      .eq('used', false);

    // 8. Insert new token record
    const { error: insertError } = await serviceClient
      .from('pin_change_requests')
      .insert({
        user_id: user.id,
        token,
        new_pin_hash: storedValue,
        expires_at: expiresAt,
        ip_address: ip,
      });

    if (insertError) {
      console.error('[PIN Change] Insert error:', insertError);
      return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 500 });
    }

    // 9. Send verification email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const emailSent = await sendVerificationEmail(user.email!, token, appUrl);

    if (!emailSent) {
      // Rollback token
      await serviceClient.from('pin_change_requests').delete().eq('token', token);
      return NextResponse.json({ error: 'Failed to send verification email. Please try again.' }, { status: 500 });
    }

    // 10. Audit log
    await serviceClient.from('pin_change_audit').insert({
      user_id: user.id,
      outcome: 'requested',
      ip_address: ip,
    });

    // Mask email for response
    const email = user.email!;
    const maskedEmail = email.slice(0, 2) + '****' + email.slice(email.indexOf('@'));

    return NextResponse.json({
      success: true,
      message: `Verification email sent to ${maskedEmail}.`,
      maskedEmail,
      expiresAt,
    });
  } catch (err: any) {
    console.error('[PIN Change] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
