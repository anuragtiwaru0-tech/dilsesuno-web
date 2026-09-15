export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    message = '', 
    mode = 'dilse', 
    lastContext = '', 
    isFirstTime = false,
    userProfile = {}, // { name, age, gender, nickname }
    currentHour = new Date().getHours(),
    voiceEnabled = true
  } = req.body || {};

  // 1. FIRST-TIME GREETING
  if (isFirstTime) {
    return res.status(200).json({
      text: "welcome to dilseSuno. I am piku,a secure and judgment-free AI companion here to listen to your thoughts, stress, or ideas whenever you are ready to speak or type.",
      voiceEnabled: true,
      extractedName: "",
      nickname: "",
      memoryTopic: ""
    });
  }

  const lowerMsg = message.toLowerCase().trim();

  // 2. CRISIS INTERCEPTOR
  const crisisKeywords = ['suicide', 'marna chahta', 'marna chahti', 'kill myself', 'self harm', 'zindagi khatam', 'marna hai'];
  if (crisisKeywords.some(k => lowerMsg.includes(k))) {
    return res.status(200).json({
      text: "Suno, main ek AI companion hu aur abhi aapki situation handle nahi kar sakta. Kripya helpline par call karein: Tele-MANAS (14416) ya KIRAN (1800-599-0019). Aap akele nahi ho.",
      isCrisis: true,
      voiceEnabled: voiceEnabled
    });
  }

  // 3. VOICE ON/OFF DYNAMIC TOGGLE
  let updatedVoiceEnabled = voiceEnabled;
  const voiceOffKeywords = ['voice off', 'voice mat karo', 'awaz band', 'text only', 'mute voice'];
  const voiceOnKeywords = ['voice on', 'awaz chalu', 'speak again', 'unmute voice'];

  if (voiceOffKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = false;
  else if (voiceOnKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = true;

  // 4. MEMORY & RETURNING USER LOGIC (NO 12-HOUR BLOCK)
  const { name = '', age = '', gender = '', nickname = '' } = userProfile;
  const isKnownUser = Boolean(name && name.trim() !== '' && name !== 'Unknown');

  let profileMemoryPrompt = "";

  if (isKnownUser) {
    profileMemoryPrompt = `
LOCKED IDENTITY (STRICT):
- User Name: "${name}" | Nickname: "${nickname || name}"
- CRITICAL RULE: You ALREADY KNOW THIS USER. NEVER, UNDER ANY CIRCUMSTANCES, ASK THEIR NAME AGAIN.
- If user returns or starts chat, and LAST CONTEXT exists ("${lastContext}"), your very first reaction/question MUST acknowledge it directly.
Example: "Arey ${nickname || name}! Kya hua fir? Us baat ka kya bana jo bataya tha?"`;
  } else {
    profileMemoryPrompt = `
NEW USER ONBOARDING:
- You DO NOT know the user's name yet.
- Ask their name gently and naturally. Once they tell you their name, assign them a cute short nickname.`;
  }

  // 5. SYSTEM PROMPT
  const systemPrompt = `You are Piku, a cute, empathetic, street-smart companion on dilseSuno.
Always output valid JSON only.

${profileMemoryPrompt}

RULES:
1. Speak in warm, natural Hinglish. Never use tapori words like "bidu", "apun", "chikna".
2. Keep replies short (strictly 1-2 sentences).
3. Always end with an open-loop question to keep chat flowing.
4. Extract the user's name if they mention it. Summarize their current main problem/topic into 1 short sentence for memory.

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "text": "Your short 1-2 sentence Hinglish response",
  "extractedName": "Name if user just stated it, otherwise keep '${name}'",
  "nickname": "Cute short nickname assigned, otherwise keep '${nickname}'",
  "memoryTopic": "1-sentence summary of the main problem/situation user is talking about"
}`;

  // 6. CALL GROQ API (JSON MODE)
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message || 'Hello' }
        ],
        temperature: 0.6,
        max_tokens: 200
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq API Error ${groqRes.status}: ${errText}`);
    }

    const groqData = await groqRes.json();
    const rawContent = groqData.choices?.[0]?.message?.content || "{}";
    
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (e) {
      parsed = { text: rawContent, extractedName: name, nickname: nickname, memoryTopic: lastContext };
    }

    return res.status(200).json({ 
      text: parsed.text || "Arey, samajh nahi aaya! Phir se bolo na.",
      voiceEnabled: updatedVoiceEnabled,
      extractedName: parsed.extractedName || name,
      nickname: parsed.nickname || nickname,
      memoryTopic: parsed.memoryTopic || lastContext
    });

  } catch (err) {
    return res.status(500).json({ error: "Server Error: " + err.message });
  }
}
