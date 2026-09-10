export const config = {
  runtime: 'edge',
};

const SYSTEM_PROMPT = `You are a specialized medical assistant for the Indian pharmaceutical market. 
Your goal is to analyze symptoms and recommend EXCLUSIVELY Indian medicine names (Generic & Top Indian Brands like Cipla, Mankind, Sun Pharma, Dr. Reddy's, etc.) that are readily available in local Indian pharmacies.

Your response MUST be ONLY the JSON object, nothing else.

Rules:
1. Identify the likely condition/illness.
2. Recommend 1-3 medicines available ONLY in the Indian market.
3. Provide precise dosage, frequency, and timing.
4. Provide estimated price in INR (e.g. ₹40 - ₹60).
5. Specify availability: "Common", "Rare", or "Prescription needed".
6. Add a professional substitution note specifically for the Indian context.
7. Categorize the illness (e.g. Viral, Bacterial, Allergy) and determine severity.

JSON Schema:
{
  "condition": "Likely Illness Name",
  "description": "Brief explanation",
  "severity": "Mild | Moderate | Severe",
  "category": "Category",
  "substitution_note": "Medical advice on Indian substitutions",
  "medicines": [
    {
      "generic_name": "Generic Name (e.g., Paracetamol)",
      "brand_name": "Indian Brand (e.g., Crocin, Dolo 650)",
      "action": "What it does",
      "dosage": "Dosage Info",
      "frequency": "Frequency",
      "timing": "Timing",
      "price_inr": "₹ Range",
      "availability": "Status"
    }
  ]
}`;

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }), 
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { symptoms } = await request.json();

    if (!symptoms || typeof symptoms !== 'string' || symptoms.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: 'Please provide a valid symptoms description.' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const rawApiKey = process.env.GROQ_API_KEY;
    if (!rawApiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing GROQ_API_KEY in Vercel Environment Variables.' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = rawApiKey.trim();

    const payload = {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: symptoms.trim().substring(0, 1000) }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 2048
    };

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return new Response(
        JSON.stringify({ error: `Groq API returned status ${groqRes.status}: ${errText}` }), 
        { status: groqRes.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const groqData = await groqRes.json();
    const contentStr = groqData.choices?.[0]?.message?.content || '{}';
    const cleanedContent = contentStr.replace(/```json|```/g, '').trim();
    const recommendationData = JSON.parse(cleanedContent);

    return new Response(JSON.stringify(recommendationData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
