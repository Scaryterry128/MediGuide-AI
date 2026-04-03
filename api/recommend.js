/**
 * MediGuide AI - Backend Proxy (Vercel Serverless Function)
 * This handles the secure communication with the Groq API using 
 * the GROQ_API_KEY environment variable.
 */

export default async function handler(req, res) {
  // 1. Security: Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    let { symptoms } = req.body;

    // 2. Strict Input Validation & Sanitization
    if (!symptoms || typeof symptoms !== 'string' || symptoms.trim().length < 3) {
      return res.status(400).json({ error: 'Please provide valid symptoms description.' });
    }

    // Limit length to prevent massive payloads (Security Guard)
    symptoms = symptoms.trim().substring(0, 1000);

    // 3. Security: Get API Key from Environment Variable
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error('Server side error: Missing GROQ_API_KEY in environment.');
      return res.status(500).json({ error: 'System configuration error. Please try again later.' });
    }

    const systemPrompt = `You are a professional medical assistant focusing on the Indian pharmaceutical market.
Analyze the user's symptoms and provide a structured medical guide in JSON format.
Your response MUST be ONLY the JSON object, nothing else.

Rules:
1. Identify the likely condition/illness.
2. Recommend 1-3 common Indian medicines (generic and brand names).
3. Provide precise dosage, frequency, and timing.
4. Provide estimated price in INR.
5. Specify availability: "Common", "Rare", or "Prescription needed".
6. Add a professional substitution note.
7. Categorize the illness (e.g. Viral, Bacterial, Allergy) and determine severity.

JSON Schema:
{
  "condition": "Likely Illness Name",
  "description": "Brief explanation",
  "severity": "Mild | Moderate | Severe",
  "category": "Category",
  "substitution_note": "Medical advice on substitutions",
  "medicines": [
    {
      "generic_name": "Generic Name",
      "brand_name": "Brand",
      "action": "What it does",
      "dosage": "Dosage Info",
      "frequency": "Frequency",
      "timing": "Timing",
      "price_inr": "₹ Range",
      "availability": "Status"
    }
  ]
}`;

    // 4. Call Groq API with backend-side security
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2048,
        temperature: 0.2, // Lower temperature for more factual medical data
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: symptoms }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('AI API Error:', errorData);
      return res.status(response.status).json({ 
        error: 'The Medical AI is currently busy. Please try again shortly.' 
      });
    }

    const data = await response.json();
    const result = data.choices[0].message.content;

    // 5. Securely return JSON
    res.status(200).json(JSON.parse(result));

  } catch (error) {
    console.error('Fatal Server Side Error:', error);
    res.status(500).json({ error: 'Server Connection Error' });
  }
}
