/**
 * MediGuide AI - Backend Proxy (Vercel Serverless Function)
 * Route: /api/recommend
 */

export default async function handler(req, res) {
  // 1. Enable CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Method Validation
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // Safely destructure request body
    const body = req.body || {};
    let { symptoms } = body;

    // 3. Input Sanitization & Validation
    if (!symptoms || typeof symptoms !== 'string' || symptoms.trim().length < 3) {
      return res.status(400).json({ error: 'Please provide a valid symptoms description.' });
    }

    symptoms = symptoms.trim().substring(0, 1000);

    // 4. API Key Verification
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error('Missing GROQ_API_KEY in environment variables.');
      return res.status(500).json({ error: 'System configuration error. Missing API credentials.' });
    }

    const systemPrompt = `You are a specialized medical assistant for the Indian pharmaceutical market. 
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

    // 5. Call Groq API
    const response = await fetch('[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2048,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: symptoms }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Groq AI API Error:', errorData);
      return res.status(response.status).json({
        error: 'The Medical AI service is currently busy. Please try again shortly.'
      });
    }

    const data = await response.json();
    let rawContent = data.choices?.[0]?.message?.content || '{}';

    // Clean Markdown code blocks if model formats response as ```json ... ```
    rawContent = rawContent.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

    const parsedData = JSON.parse(rawContent);

    return res.status(200).json(parsedData);

  } catch (error) {
    console.error('Server Execution Error:', error);
    return res.status(500).json({ error: 'Failed to process medical recommendation request.' });
  }
}
