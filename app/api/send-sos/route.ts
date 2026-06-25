import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { numbers, message } = await req.json();

    if (!numbers || !numbers.length || !message) {
      return NextResponse.json(
        { success: false, error: "Missing numbers or message" },
        { status: 400 }
      );
    }

    let apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey || apiKey === "YOUR_KEY_HERE") {
      apiKey = process.env.NEXT_PUBLIC_FAST2SMS_KEY;
    }

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Missing API Key" },
        { status: 500 }
      );
    }

    // Join array of numbers into comma-separated string
    const numbersString = Array.isArray(numbers) ? numbers.join(",") : numbers;

    const requestBody = {
      route: "q",
      message: message,
      language: "english",
      flash: 0,
      numbers: numbersString,
    };

    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Fast2SMS proxy error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
