import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || 'mock-key';
const ai = new GoogleGenAI({ apiKey });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (apiKey === 'mock-key') {
       // Mock response if no key is set
       return NextResponse.json({ 
         response: "This is a mock AI response. Please set GEMINI_API_KEY in .env.local to use the real Gemini API. Remember to stay safe and stick to well-lit areas!" 
       });
    }

    // Call real Gemini API
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return NextResponse.json({ response: result.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: 'Failed to communicate with AI Assistant' }, { status: 500 });
  }
}
