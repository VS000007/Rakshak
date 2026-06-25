import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { numbers, latitude, longitude, userName } = await req.json();

    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "Missing FAST2SMS_API_KEY" });
    }

    const message = `RAKSHAK ALERT: ${userName} needs immediate help! Current location: https://maps.google.com/?q=${latitude},${longitude} — Please call her immediately and alert authorities if needed. Sent by Rakshak Safety App.`;

    const body = new URLSearchParams({
      route: "q",
      message: message,
      language: "english",
      flash: "0",
      numbers: numbers.join(",")
    });

    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        "authorization": apiKey,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });

    const data = await response.json();

    if (!response.ok || data.return === false) {
      return NextResponse.json({ success: false, error: data.message || "Failed to send SMS" });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Internal server error" });
  }
}
