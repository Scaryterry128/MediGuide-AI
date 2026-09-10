export const config = {
  runtime: 'edge',
};

const SYSTEM_PROMPT = `You are MediGuide AI, an empathetic health and symptom advisor.
Evaluate user symptoms, severity, and duration to provide structured preliminary health guidance.

RULES:
1. Return strictly valid JSON with no markdown wrapping.
2. Provide non-emergency preliminary insights, safe home care, and over-the-counter (OTC) medication guidance.
3. Explicitly state that OTC options are general suggestions and require verifying allergies/dosing with a pharmacist.
4. List questions for doctor visits and crucial emergency red flags.

OUTPUT JSON FORMAT ONLY:
{
  "preliminary_insight": "General overview of potential non-emergency causes.",
  "home_care": ["Safe home step 1", "Safe home step 2"],
  "otc_medicine_guidance": ["Common OTC option (e.g., Acetaminophen/Paracetamol for mild fever/pain) with disclaimer."],
  "doctor_questions": ["Question 1", "Question 2"],
  "red_flags": ["Emergency sign 1", "Emergency sign 2"]
}`;

const MODEL_CANDIDATES = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-20b",
  "qwen/qwen3-32b"
];

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawApiKey = process.env.GROQ_API_KEY;

    if (!rawApiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing GROQ_API_KEY in Vercel Environment Variables.' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = rawApiKey.trim();
    const symptoms = (body.symptoms || body.prompt || "").toString().trim();
    const severity = body.severity || "Moderate";
    const duration = body.duration || "1-3 days";

    if (!symptoms) {
      return new Response(
        JSON.stringify({ error: 'Please describe your symptoms before requesting analysis.' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userPrompt = `Symptoms: ${symptoms}\nSeverity: ${severity}\nDuration: ${duration}`;

    let selectedModel = MODEL_CANDIDATES[0];
    try {
      const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        const availableIds = (modelsData.data || []).map(m => m.id);
        const match = MODEL_CANDIDATES.find(c => availableIds.includes(c));
        if (match) selectedModel = match;
      }
    } catch (e) {
      console.warn('Groq model detection fallback:', e);
    }

    let groqRes;
    let errText = '';
    const modelsToTry = [selectedModel, ...MODEL_CANDIDATES.filter(m => m !== selectedModel)];

    for (const modelId of modelsToTry) {
      const payload = {
        model: modelId,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: 1500
      };

      groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (groqRes.ok) break;
      errText = await groqRes.text();
      if (groqRes.status !== 404 && !errText.includes('model_not_found')) break;
    }

    if (!groqRes || !groqRes.ok) {
      return new Response(
        JSON.stringify({ error: `Groq API error (${groqRes?.status || 500}): ${errText}` }), 
        { status: groqRes?.status || 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const groqData = await groqRes.json();
    const contentStr = groqData.choices?.[0]?.message?.content || '{}';
    const cleanedContent = contentStr.replace(/```json|```/g, '').trim();
    const resultJson = JSON.parse(cleanedContent);

    return new Response(JSON.stringify(resultJson), {
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
