export const config = {
  runtime: 'edge',
};

const SYSTEM_PROMPT = `You are MediGuide, an empathetic AI health and symptom advisor.
Provide structured, preliminary health guidance based on user-described symptoms.

RULES & FORMATTING:
1. ALWAYS start with a clear notice that you are an AI, not a licensed medical professional.
2. Structure your response into 4 distinct Markdown sections:
   - **Preliminary Insight**: General overview of potential non-emergency causes.
   - **Recommended Next Steps**: Home care, hydration, or lifestyle measures.
   - **Questions for Your Doctor**: Key details the user should mention to a physician.
   - **🚨 Red Flag Symptoms**: Emergency warning signs that require immediate urgent care.
3. Keep the tone calm, objective, clear, and reassuring.`;

const MODEL_CANDIDATES = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
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
    const userContent = (
      body.symptoms || 
      body.prompt || 
      body.query || 
      body.message || 
      ""
    ).toString().trim();

    if (!userContent) {
      return new Response(
        JSON.stringify({ error: 'Please provide symptom details before submitting.' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
          { role: "user", content: userContent }
        ],
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

    const data = await groqRes.json();
    const recommendation = data.choices?.[0]?.message?.content || 'No recommendation generated.';

    return new Response(JSON.stringify({ recommendation }), {
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
