// Server-side proxy for lilPalette's AI color generation.
// Keeps the Gemini API key off the client: the browser POSTs the business
// details here, we ask Gemini for a brand palette, and return only the hex
// codes. Set GEMINI_API_KEY in the Netlify environment. If the key is missing
// or Gemini errors, we return a non-2xx and the client falls back to a local
// industry-based palette, so the tool keeps working either way.

// Model is a single constant on purpose so it is easy to bump. If this name
// is ever rejected for the configured key, the function returns 502 and the
// client shows a deterministic starter palette instead of failing.
const GEMINI_MODEL = 'gemini-2.5-flash';

const json = (statusCode, obj) => ({
  statusCode,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(obj),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const businessName = String(data.businessName || '').trim();
  const tagline = String(data.tagline || '').trim();
  const industry = String(data.industry || '').trim();

  // Same validation the original client enforced, to keep abuse down.
  if (!businessName || businessName.length > 100) return json(400, { error: 'Invalid business name' });
  if (tagline.length > 200) return json(400, { error: 'Tagline too long' });
  if (!industry || industry.length > 300) return json(400, { error: 'Invalid industry description' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(503, { error: 'AI not configured' });

  const prompt = `You are a professional brand color consultant. Generate 5-6 perfect hex color codes for a business with the following details:

Business Name: ${businessName}
Tagline: ${tagline || 'Not provided'}
Industry & Vibe: ${industry}

Requirements:
- Return exactly 5-6 hex color codes
- Colors should reflect the industry, vibe, and brand personality
- Consider current design trends and color psychology
- Ensure colors work well together as a cohesive palette
- Include both primary and accent colors

Respond with ONLY a JSON array of hex color codes, like this:
["#FF6B35", "#2E8B57", "#FFD700", "#4169E1", "#32CD32"]

No explanations, just the JSON array.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9 },
        }),
      }
    );

    if (!res.ok) {
      console.warn('Gemini request failed:', res.status);
      return json(502, { error: 'AI request failed' });
    }

    const payload = await res.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.trim().replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.warn('Could not parse Gemini response:', clean.slice(0, 120));
      return json(502, { error: 'Could not parse AI response' });
    }

    const colors = (Array.isArray(parsed) ? parsed : [])
      .filter((h) => typeof h === 'string' && /^#?[0-9a-fA-F]{6}$/.test(h.trim()))
      .map((h) => {
        const v = h.trim();
        return (v.startsWith('#') ? v : '#' + v).toUpperCase();
      });

    if (colors.length < 5) return json(502, { error: 'Incomplete AI palette' });

    return json(200, { colors: colors.slice(0, 6) });
  } catch (error) {
    console.error('palette-generate error:', error);
    return json(500, { error: 'Internal error' });
  }
};
