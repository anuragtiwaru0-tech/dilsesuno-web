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

  // 3. VOICE ON/OFF TOGGLE
  let updatedVoiceEnabled = voiceEnabled;
  const voiceOffKeywords = ['voice off', 'voice mat karo', 'awaz band', 'text only', 'mute voice'];
  const voiceOnKeywords = ['voice on', 'awaz chalu', 'speak again', 'unmute voice'];

  if (voiceOffKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = false;
  else if (voiceOnKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = true;

  // 4. TIME-OF-DAY VIBE SHIFT
  const isLateNight = (currentHour >= 23 || currentHour < 4);
  const timeVibePrompt = isLateNight
    ? "TIME VIBE: Late Night (11 PM - 4 AM). Soft, quiet, comforting tone."
    : "TIME VIBE: Daytime. Warm, active, and supportive tone.";

  // 5. LOCKED USER MEMORY
  const { name = '', age = '', gender = '', nickname = '' } = userProfile;
  const isKnownUser = Boolean(name && name.trim() !== '' && name !== 'Unknown');

  let profileMemoryPrompt = "";
  if (isKnownUser) {
    profileMemoryPrompt = `
LOCKED IDENTITY:
- Real Name: "${name}" | Nickname: "${nickname || name}"
- CRITICAL: User is already known. NEVER ask their name again.
- If lastContext exists ("${lastContext}"), acknowledge it directly in your first sentence.`;
  } else {
    profileMemoryPrompt = `
NEW USER ONBOARDING:
- Name is unknown. Gently ask their name, and assign a sweet short nickname once they share it.`;
  }

  // 6. ALL MODES (Including Study Buddy)
  let modePrompt = "";
  switch (mode) {
    case 'bhai':
      modePrompt = "MODE: REAL TALK. Practical older-brother advice. Zero sugarcoating.";
      break;
    case 'hype':
      modePrompt = "MODE: HYPE UP. Energetic confidence booster! Fire up the user.";
      break;
    case 'roast':
      modePrompt = "MODE: ROAST. Witty, sarcastic roasts about habits. Never roast trauma, family, or physical appearance.";
      break;
    case 'gossip':
      modePrompt = "MODE: GOSSIP MODE. Analyze messages with Gen-Z flair. End strictly with: 'Red Flag 🚩', 'Green Flag 🟩', or 'Delusional 🤡'.";
      break;
    case 'study':
      modePrompt = `MODE: STUDY BUDDY. Explain step-by-step using daily-life examples (cricket, chai, gaming). Max 3-4 short sentences.`;
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
4. Extract user's name if mentioned. Summarize current topic in 1 short sentence for memoryTopic.

OUTPUT FORMAT (JSON ONLY):
{
  "text": "Your short Hinglish response",
  "extractedName": "Name if provided, else '${name}'",
  "nickname": "Nickname assigned, else '${nickname}'",
  "memoryTopic": "1-sentence summary of the topic"
}`;

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(200).json({
      text: "Vercel Error: GEMINI_API_KEY environment variable missing hai!",
      voiceEnabled: updatedVoiceEnabled,
      extractedName: name,
      nickname: nickname,
      memoryTopic: lastContext
    });
  }

  // Multimodal Payload Preparation
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
  userParts.push({ text: message || (imageBase64 ? "Solve this question." : "Hello") });

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: userParts }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.65,
      maxOutputTokens: 500
    }
  };

  // Google endpoints to try sequentially
  const candidateUrls = [
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`
  ];

  let rawErrorOutput = "";

  for (const url of candidateUrls) {
    try {
      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!geminiRes.ok) {
        rawErrorOutput = await geminiRes.text();
        continue;
      }

      const geminiData = await geminiRes.json();
      const rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

      let clean = rawContent.trim();
      if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(clean);

      return res.status(200).json({
        text: parsed.text || "Arey, samajh nahi aaya! Phir se bolo na?",
        voiceEnabled: updatedVoiceEnabled,
        extractedName: parsed.extractedName || name,
        nickname: parsed.nickname || nickname,
        memoryTopic: parsed.memoryTopic || lastContext
      });

    } catch (err) {
      rawErrorOutput = err.message;
    }
  }

  // Exact error bubble par aayega agar Google reject kare
  return res.status(200).json({
    text: "Google API Direct Error: " + rawErrorOutput,
    voiceEnabled: updatedVoiceEnabled,
    extractedName: name,
    nickname: nickname,
    memoryTopic: lastContext
  });
}
