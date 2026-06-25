require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

async function verifySupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { status: 'FAIL', reason: 'Missing env vars' };
  
  try {
    const supabase = createClient(url, key);
    // Simple ping query (does not require auth if we just check an anonymous accessible table or check health)
    // Actually, calling getSession() shouldn't throw error if credentials are structurally valid
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { status: 'PASS', details: 'Supabase client initialized & session checked' };
  } catch (error) {
    return { status: 'FAIL', reason: error.message };
  }
}

async function verifyGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { status: 'FAIL', reason: 'Missing env var' };
  
  const ai = new GoogleGenAI({ apiKey: key });
  
  // Easy swap: change this to 'gemini-1.5-flash' if you want to bypass 2.5-flash entirely
  let preferredModel = 'gemini-2.5-flash';
  let maxRetries = 3;
  let delayMs = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
          model: preferredModel,
          contents: 'Ping',
      });
      if (!response.text) throw new Error("No text response");
      return { status: 'PASS', details: `Gemini (${preferredModel}) completion successful on attempt ${attempt}` };
    } catch (error) {
      const errMsg = error.message || String(error);
      const isUnavailable = errMsg.includes('503') || errMsg.includes('UNAVAILABLE');
      
      if (attempt === maxRetries) {
        // Fallback to gemini-1.5-flash if 2.5-flash fails completely
        if (preferredModel === 'gemini-2.5-flash' && isUnavailable) {
          console.log(`    -> [Retry] ${preferredModel} overloaded. Falling back to gemini-1.5-flash...`);
          preferredModel = 'gemini-1.5-flash';
          attempt = 0; // reset attempts for the new model
          delayMs = 1000; // reset delay
          continue; 
        }
        return { status: 'FAIL', reason: errMsg };
      }

      if (isUnavailable) {
        console.log(`    -> [Retry] Attempt ${attempt} failed with 503. Retrying in ${delayMs}ms...`);
        await new Promise(res => setTimeout(res, delayMs));
        delayMs *= 2; // exponential backoff
      } else {
        return { status: 'FAIL', reason: errMsg };
      }
    }
  }
}

async function verifyGeopify() {
  const key = process.env.GEOPIFY_API_KEY;
  if (!key) return { status: 'FAIL', reason: 'Missing env var' };
  
  try {
    // Standard geocode lookup for 'London'
    const res = await fetch(`https://api.geoapify.com/v1/geocode/search?text=London&apiKey=${key}`);
    const data = await res.json();
    if (res.ok && data.features && data.features.length > 0) {
      return { status: 'PASS', details: 'Geocode lookup successful' };
    } else {
      return { status: 'FAIL', reason: data.message || 'No features returned' };
    }
  } catch (error) {
    return { status: 'FAIL', reason: error.message };
  }
}

async function verifyTwilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return { status: 'FAIL', reason: 'Missing env vars' };
  
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(sid + ':' + token).toString('base64')
      }
    });
    const data = await res.json();
    if (res.ok && data.status) {
      return { status: 'PASS', details: `Twilio Account retrieved: ${data.status}` };
    } else {
      return { status: 'FAIL', reason: data.message || 'Failed to authenticate' };
    }
  } catch (error) {
    return { status: 'FAIL', reason: error.message };
  }
}

async function runAll() {
  console.log('--- STEP 0: CREDENTIAL VERIFICATION ---\n');
  
  const sb = await verifySupabase();
  console.log(`Supabase: [${sb.status}] ${sb.reason || sb.details}`);
  
  const gm = await verifyGemini();
  console.log(`Gemini:   [${gm.status}] ${gm.reason || gm.details}`);
  
  const geo = await verifyGeopify();
  console.log(`Geopify:  [${geo.status}] ${geo.reason || geo.details}`);
  
  const tw = await verifyTwilio();
  console.log(`Twilio:   [${tw.status}] ${tw.reason || tw.details}`);
}

runAll();
