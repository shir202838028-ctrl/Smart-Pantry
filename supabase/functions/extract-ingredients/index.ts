// Supabase Edge Function: extract-ingredients
//
// Receives recipe text and uses the OpenAI Chat Completions API to extract a
// list of ingredients, returned as a JSON array of Hebrew strings.
//
// Request:  POST { "recipe_text": "..." }
// Response: 200 ["2 עגבניות", "כוס קמח", ...]
//
// The OpenAI API key is read from the environment and never exposed to the
// client. Set it with:  supabase secrets set OPENAI_API_KEY=sk-...

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const OPENAI_MODEL = 'gpt-4o-mini'

const SYSTEM_PROMPT = `אתה עוזר שמחלץ מצרכים ממתכונים.
המשתמש יספק טקסט של מתכון (לרוב בעברית).
החזר אך ורק מערך JSON תקין של מחרוזות בעברית, כאשר כל מחרוזת היא מצרך אחד כולל הכמות אם צוינה.
לדוגמה: ["2 עגבניות", "כוס קמח", "קורט מלח"].
אל תוסיף טקסט, הסברים, או עיצוב Markdown — רק מערך ה-JSON עצמו.`

/**
 * The model may wrap the array in prose or a ```json fenced block. Pull the
 * first JSON array out of the content and parse it defensively.
 */
function parseIngredients(content: string): string[] {
  const cleaned = content
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('AI response did not contain a JSON array.')
    parsed = JSON.parse(match[0])
  }

  // Accept either a raw array or an object like { ingredients: [...] }.
  const arr = Array.isArray(parsed)
    ? parsed
    : (parsed as Record<string, unknown>)?.ingredients

  if (!Array.isArray(arr)) {
    throw new Error('AI response was not a JSON array of strings.')
  }

  return arr
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0)
}

Deno.serve(async (req: Request) => {
  // Preflight.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      throw new Error('Missing OPENAI_API_KEY environment variable.')
    }

    const { recipe_text } = await req.json().catch(() => ({}))
    if (!recipe_text || typeof recipe_text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid "recipe_text".' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const openaiResponse = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          temperature: 0.2,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: recipe_text },
          ],
        }),
      },
    )

    if (!openaiResponse.ok) {
      const detail = await openaiResponse.text()
      console.error('OpenAI API error:', openaiResponse.status, detail)
      throw new Error(`OpenAI API error (${openaiResponse.status}).`)
    }

    const completion = await openaiResponse.json()
    const content: string =
      completion?.choices?.[0]?.message?.content ?? ''

    const ingredients = parseIngredients(content)

    return new Response(JSON.stringify(ingredients), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error.'
    console.error('extract-ingredients failed:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
