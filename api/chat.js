export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    message = '', 
    mode = 'dilse', 
    lastContext = '', 
    isFirstTime = false,
    userProfile = {}, 
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

  // 3. VOICE ON/OFF DYNAMIC KEYWORD TOGGLE
  let updatedVoiceEnabled = voiceEnabled;
  const voiceOffKeywords = ['voice off', 'voice mat karo', 'awaz band', 'text only', 'mute voice'];
  const voiceOnKeywords = ['voice on', 'awaz chalu', 'speak again', 'unmute voice'];

  if (voiceOffKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = false;
  else if (voiceOnKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = true;

  // 4. TIME-OF-DAY VIBE SHIFT
  const isLateNight = (currentHour >= 23 || currentHour < 4);
  const timeVibePrompt = isLateNight
    ? "TIME VIBE: Late Night (11 PM - 4 AM). Low energy, calm, quiet comfort for late-night overthinking."
    : "TIME VIBE: Daytime. Warm, active, and supportive tone.";

  // 5. LOCKED MEMORY (SINGLE NAME ASK LOGIC)
  const { name = '', age = '', gender = '', nickname = '' } = userProfile;
  const isKnownUser = Boolean(name && name.trim() !== '' && name !== 'Unknown');

  let profileMemoryPrompt = "";
  if (isKnownUser) {
    profileMemoryPrompt = `
LOCKED IDENTITY:
- Real Name: "${name}" | Nickname: "${nickname || name}"
- CRITICAL RULE: User is already known. NEVER ask their name again.
- If lastContext exists ("${lastContext}"), acknowledge it directly in your very first sentence.`;
  } else {
    profileMemoryPrompt = `
NEW USER ONBOARDING:
- Name is unknown. Gently ask their name, and assign a sweet short nickname once they share it.`;
  }

  // 6. INTENT MODES
  let modePrompt = "";
  switch (mode) {
    case 'bhai':
      modePrompt = "MODE: REAL TALK. Practical older-brother advice. Zero sugarcoating.";
      break;
    case 'hype':
      modePrompt = "MODE: HYPE UP. Energetic confidence booster! Fire up the user.";
      break;
    case 'roast':
      modePrompt = "MODE: ROAST. Witty, sarcastic roasts about habits. STRICT BOUNDARY: Never roast trauma, family, or physical appearance.";
      break;
    case 'gossip':
      modePrompt = "MODE: GOSSIP MODE. Analyze messages with Gen-Z flair. End strictly with: 'Red Flag 🚩', 'Green Flag 🟩', or 'Delusional 🤡'.";
      break;
    case 'dilse':
    default:
      modePrompt = "MODE: DIL SE. 80% listening and emotional validation. Warm and soft.";
      break;
  }

  // 7. SYSTEM PROMPT
  const systemPrompt = `You are Piku, a cute, empathetic AI companion on dilseSuno.
Always respond strictly in valid JSON format.

${timeVibePrompt}
${profileMemoryPrompt}
${modePrompt}

CORE RULES:
1. Speak in clean, sweet Hinglish. NEVER use tapori slang ("bidu", "apun", "chikna").
2. Strictly 1-2 short sentences so voice output remains smooth.
3. Always end with an open-loop question.
4. Extract user's name if mentioned. Summarize their core problem in 1 short sentence for memoryTopic.

OUTPUT FORMAT (JSON ONLY):
{
  "text": "Your short 1-2 sentence response",
  "extractedName": "Extracted name or '${name}'",
  "nickname": "Nickname assigned or '${nickname}'",
  "memoryTopic": "1-sentence summary of the current issue"
}`;

  // 8. CALL GROQ WITH THE EXACT MODEL ASSIGNED TO YOUR ACCOUNT
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message || 'Hello' }
        ],
        temperature: 0.7,
        max_completion_tokens: 500
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
