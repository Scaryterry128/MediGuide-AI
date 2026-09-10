export const config = {
  runtime: 'edge',
};

const SYSTEM_PROMPT = `You are an AI Recommendation Engine & Master Life Scheduler. User gives daily constraints, available hours, and goals.
RULES:
1. "time_management": Evaluate constraints vs free time. Output daily_schedule array breaking down hours for chores and exact hours per goal.
2. For each "goal":
- "analysis": Evaluate it independently.
- "daily_plan": Keep daily plan concise (maximum 10 key actionable days).
- "gadgets": Construct explicit search URLs (e.g. amazon.com/s?k=microphone).
- "learning": Provide specific Youtube Search URLs & websites.
- "post_mastery": Provide jobs, monetization tactics.
OUTPUT RAW JSON MATCHING:
{"time_management":{"evaluation":"...","daily_schedule":[{"activity":"...","hours":0}]},"goals":[{"goal_number":1,"goal_name":"...","analysis":{"verdict":"Good ✅","phase_duration":"X Days","explanation":"...","breakdown":["..."]},"guide":{"steps":["..."],"milestones":["..."]},"daily_plan":[{"day":"Day 1","action":"..."}],"gadgets":[{"name":"","price_guess":"","url":"","platform":"","reason":""}],"learning":{"channels":[{"name":"","url":"","description":""}],"videos":[{"title":"","url":""}],"websites":[{"name":"","url":""}]},"post_mastery":{"applications":[""],"monetization":[""],"next_steps":[""]}}]}`;

// List of supported Groq production models in order of priority
const MODEL_CANDIDATES = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "qwen/qwen3-32b",
  "meta-llama/llama-4-scout-17b-16e-instruct"
];

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { prompt } = await request.json();
    const rawApiKey = process.env.GROQ_API_KEY;

    if (!rawApiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing GROQ_API_KEY in Vercel Environment Variables.' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = rawApiKey.trim();

    // 1. Query Groq /v1/models endpoint to identify accessible models for this API Key
    let selectedModel = MODEL_CANDIDATES[0];
    try {
      const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        const availableIds = (modelsData.data || []).map(m => m.id);
        
        // Pick first model candidate present in account's accessible list
        const match = MODEL_CANDIDATES.find(c => availableIds.includes(c));
        if (match) {
          selectedModel = match;
        } else if (availableIds.length > 0) {
          const textModel = availableIds.find(id => !id.includes('whisper') && !id.includes('guard') && !id.includes('orpheus'));
          if (textModel) selectedModel = textModel;
        }
      }
    } catch (e) {
      console.warn('Could not auto-detect Groq models, using candidate fallback list.', e);
    }

    // 2. Loop through candidate models if model_not_found occurs
    let groqRes;
    let errText = '';
    const modelsToTry = [selectedModel, ...MODEL_CANDIDATES.filter(m => m !== selectedModel)];

    for (const modelId of modelsToTry) {
      const payload = {
        model: modelId,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2000
      };

      groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (groqRes.ok) {
        break; // Request succeeded
      }

      errText = await groqRes.text();
      
      // Stop looping on authorization/unrelated errors
      if (groqRes.status !== 404 && !errText.includes('model_not_found')) {
        break;
      }
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
    const scheduleData = JSON.parse(cleanedContent);

    return new Response(JSON.stringify(scheduleData), {
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
