export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const message = body.message || 'Hello';
    const mode = body.mode || 'wholesome';

    const groqKey = process.env.GROQ_API_KEY;
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.BUNTY_VOICE_ID;

    // Direct error check for keys
    if (!groqKey) return res.status(200).json({ text: "ERROR: GROQ_API_KEY Missing in Vercel!", audio: null });
    if (!elevenKey) return res.status(200).json({ text: "ERROR: ELEVENLABS_API_KEY Missing in Vercel!", audio: null });
    if (!voiceId) return res.status(200).json({ text: "ERROR: BUNTY_VOICE_ID Missing in Vercel!", audio: null });

    let systemPrompt = "You are Piku, a witty 20yo Indian guy for dilsesuno. Speak natural Hinglish under 10 words. No emojis.";

    // 1. Fetch Groq Text
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqKey.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }],
        max_tokens: 50
      })
    });

    const groqData = await groqRes.json();
    const replyText = groqData?.choices?.[0]?.message?.content || "Arre bhai!";

    // 2. Fetch ElevenLabs Audio
    const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId.trim()}`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenKey.trim(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: replyText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.4, similarity_boost: 0.85 }
      })
    });

    // IF ELEVENLABS FAILS: Print exact error on screen
    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      return res.status(200).json({
        text: replyText + ` [ELEVENLABS ERROR ${elevenRes.status}: ${errText}]`,
        audio: null
      });
    }

    const audioBuffer = await elevenRes.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return res.status(200).json({
      text: replyText,
      audio: `data:audio/mp3;base64,${base64Audio}`
    });

  } catch (err) {
    return res.status(200).json({ text: "Server Crash: " + err.message, audio: null });
  }
}
 // trigger vercel deploy
