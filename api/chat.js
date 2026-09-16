export const config = {
  maxDuration: 30,
};

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
    voiceEnabled = true,
    imageBase64 = null,
    imageMimeType = 'image/jpeg'
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

  // 3. DYNAMIC VOICE TOGGLE
  let updatedVoiceEnabled = voiceEnabled;
  const voiceOffKeywords = ['voice off', 'voice mat karo', 'awaz band', 'text only', 'mute voice'];
  const voiceOnKeywords = ['voice on', 'awaz chalu', 'speak again', 'unmute voice'];

  if (voiceOffKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = false;
  else if (voiceOnKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = true;

  // 4. TIME-OF-DAY VIBE SHIFT
  const isLateNight = (currentHour >= 23 || currentHour < 4);
  const timeVibePrompt = isLateNight
    ? "TIME VIBE: Late Night (11 PM - 4 AM). Soft, quiet, comforting tone for late-night overthinking."
    : "TIME VIBE: Daytime. Warm, active, and supportive tone.";

  // 5. LOCKED MEMORY
  const { name = '', age = '', gender = '', nickname = '' } = userProfile;
  const isKnownUser = Boolean(name && name.trim() !== '' && name !== 'Unknown');

  let profileMemoryPrompt = "";
  if (isKnownUser) {
    profileMemoryPrompt = `
LOCKED IDENTITY:
- Real Name: "${name}" | Nickname: "${nickname || name}"
- CRITICAL: User is already known. NEVER ask their name again.
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
    case 'study':
      modePrompt = `MODE: STUDY BUDDY. You are an encouraging, genius yet fun study buddy.
- If a photo/question is attached, solve it step-by-step in clean Hinglish.
- MANDATORY: Always use a simple, fun daily-life example (cricket, chai, gaming, pocket money) to explain.
- If user asks for more examples, provide an even simpler analogy.
- Max 3-4 short sentences so voice output remains smooth.`;
      break;
    case 'dilse':
    default:
      modePrompt = "MODE: DIL SE. 80% listening and emotional validation. Warm and soft. Strictly 1-2 sentences.";
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
2. Keep replies short (1-2 sentences for emotional chat, 3-4 for study).
3. Always end with an open-loop question.
4. Extract user's name if mentioned. Summarize their current topic in 1 short sentence for memoryTopic.

OUTPUT FORMAT (JSON ONLY):
{
  "text": "Your short Hinglish response",
  "extractedName": "Name if provided, else '${name}'",
  "nickname": "Nickname assigned, else '${nickname}'",
  "memoryTopic": "1-sentence summary of the topic"
}`;

  // 8. CALL GEMINI API WITH STRICT CAMELCASE
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing GEMINI_API_KEY in Vercel environment variables." });
  }

  try {
    const userParts = [];

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      userParts.push({
        inlineData: {
          mimeType: imageMimeType || 'image/jpeg',
          data: cleanBase64
        }
      });
    }

    userParts.push({ text: message || (imageBase64 ? "Solve and explain with a daily life example." : "Hello") });

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: 'user',
            parts: userParts
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.65,
          maxOutputTokens: 600
        }
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API Error ${geminiRes.status}: ${errText}`);
    }

    const geminiData = await geminiRes.json();
    const rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (e) {
      parsed = { text: rawContent, extractedName: name, nickname: nickname, memoryTopic: lastContext };
    }

    return res.status(200).json({
      text: parsed.text || "Arey, samajh nahi aaya! Phir se bolo na?",
      voiceEnabled: updatedVoiceEnabled,
      extractedName: parsed.extractedName || name,
      nickname: parsed.nickname || nickname,
      memoryTopic: parsed.memoryTopic || lastContext
    });

  } catch (err) {
    // Return explicit error to inspect if anything else fails
    return res.status(200).json({
      text: "Debug Error: " + err.message,
      voiceEnabled: updatedVoiceEnabled,
      extractedName: name,
      nickname: nickname,
      memoryTopic: lastContext
    });
  }
}
