export const config = {
  maxDuration: 10,
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
      text: "welcome to dilseSuno. Main piku hoon, tumhara apna AI dost. Jo bhi mann mein ho—stress, bakchodi ya koi baat—bina filter ke bol sakte ho.",
      voiceEnabled: true,
      extractedName: "",
      nickname: "",
      memoryTopic: ""
    });
  }

  const lowerMsg = message.toLowerCase().trim();

  // 2. CRISIS INTERCEPTOR
  const crisisKeywords = ['suicide', 'marna chahta', 'marna chahti', 'kill myself', 'self harm', 'zindagi khatam', 'marna hai', 'jaan de dunga'];
  if (crisisKeywords.some(k => lowerMsg.includes(k))) {
    return res.status(200).json({
      text: "Bhai sun, main ek AI hoon aur ye cheez akele handle nahi hogi. Plz abhi helpline par baat kar: Tele-MANAS (14416) ya KIRAN (1800-599-0019). Tu akele nahi hai.",
      isCrisis: true,
      voiceEnabled: voiceEnabled
    });
  }

  // 3. DYNAMIC VOICE TOGGLE
  let updatedVoiceEnabled = voiceEnabled;
  const voiceOffKeywords = ['voice off', 'voice mat karo', 'awaz band', 'text only', 'mute voice', 'chup raho'];
  const voiceOnKeywords = ['voice on', 'awaz chalu', 'speak again', 'unmute voice', 'bolo'];

  if (voiceOffKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = false;
  else if (voiceOnKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = true;

  // 4. IDENTITY & MEMORY
  const { name = '', nickname = '' } = userProfile;
  const isKnownUser = Boolean(name && name.trim() !== '' && name !== 'Unknown');
  const effectiveContext = (mode === 'study') ? '' : lastContext;

  let memoryInstruction = "";
  if (isKnownUser) {
    memoryInstruction = `
- User Name: "${name}" | Nickname: "${nickname || name}".
- User already known hai. DOBARA NAAM KABHI MAT POOCHNA.
- ANTI-AGGRESSIVE RECALL: Past context ("${effectiveContext}") ko pehle sentence mein zabardasti mat chhedo jab tak user khud wo topic na uthaye. Casual WhatsApp friend ki tarah reply do.`;
  } else {
    memoryInstruction = `
- User new hai, naam unknown hai. Baaton-baaton mein casual tarike se naam poocho aur ek cool nickname do.`;
  }

  // 5. TIME CONTEXT
  const isLateNight = (currentHour >= 23 || currentHour < 4);
  const timeVibePrompt = isLateNight
    ? "TIME CONTEXT: Late night (11 PM - 4 AM). Grounded, calm, overthinking-friendly vibe."
    : "TIME CONTEXT: Daytime. Active, natural companion energy.";

  // 6. ISOLATED MODES
  let modePrompt = "";
  switch (mode) {
    case 'bhai':
      modePrompt = "MODE: REAL TALK (Bada Bhai). Practical reality check, zero lecture, zero sugarcoating. 1-2 short lines.";
      break;
    case 'hype':
      modePrompt = "MODE: HYPE UP. Full energetic pump up! 1-2 punchy lines.";
      break;
    case 'roast':
      modePrompt = "MODE: ROAST. Savage, witty roast. Strictly avoid trauma, appearance, or family. 1-2 lines.";
      break;
    case 'gossip':
      modePrompt = "MODE: GOSSIP. Gen-Z tone. End strictly with: 'Red Flag 🚩', 'Green Flag 🟩', ya 'Delusional 🤡'.";
      break;
    case 'study':
      modePrompt = "MODE: STUDY BUDDY (Academic Only). Factual direct answer do. Math/logic questions ko step-by-step clean structure mein samjhao. Max 3-4 short sentences.";
      break;
    case 'dilse':
    default:
      modePrompt = "MODE: DIL SE (True Friend). 90% sunna, zero toxic positivity ('bright day' ya 'productive raho' mat bolna). Strictly 10-20 words.";
      break;
  }

  // 7. SYSTEM PROMPT (Strictly Male, Anti-Script)
  const systemPrompt = `You are Piku, an authentic male AI best-friend and companion on dilseSuno.

STRICT RULES:
1. GENDER: You are 100% MALE. Always use male first-person Hindi verbs ("main samajhta hoon", "bol raha hoon"). NEVER say "samajhti hoon" or "bataungi".
2. BANNED SCRIPTS: NEVER say "Main samajh sakta hoon ki ye waqt kitna mushkil hai", "Aapka dard gehra hai", "Kya share karoge". Talk like a genuine WhatsApp friend.
3. NO FORCED SURVEY QUESTIONS: Don't append interview questions to every reply.
4. NO TOXIC POSITIVITY & NO ENGLISH SWITCH: Stay naturally in casual Hinglish.
5. LENGTH: Regular modes strictly 10-20 words max.

${timeVibePrompt}
${memoryInstruction}
${modePrompt}

OUTPUT FORMAT (JSON ONLY):
{
  "text": "Your crisp Hinglish response",
  "extractedName": "Name if user explicitly mentions, else '${name}'",
  "nickname": "Nickname if given, else '${nickname}'",
  "memoryTopic": "Short factual topic label without hallucination"
}`;

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(200).json({
      text: "Vercel Environment Variables me GEMINI_API_KEY missing hai!",
      voiceEnabled: updatedVoiceEnabled,
      extractedName: name,
      nickname: nickname,
      memoryTopic: lastContext
    });
  }

  try {
    // 8. AUTO-DISCOVERY: Fetch active model dynamically (takes ~150ms)
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!listRes.ok) {
      const errBody = await listRes.text();
      return res.status(200).json({
        text: "Google Key Issue: " + errBody,
        voiceEnabled: updatedVoiceEnabled,
        extractedName: name,
        nickname: nickname,
        memoryTopic: lastContext
      });
    }

    const listData = await listRes.json();
    const availableModels = (listData.models || [])
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name);

    if (!availableModels.length) {
      return res.status(200).json({
        text: "Is Google API Key par koi generateContent model available nahi hai!",
        voiceEnabled: updatedVoiceEnabled,
        extractedName: name,
        nickname: nickname,
        memoryTopic: lastContext
      });
    }

    // Auto-pick the best flash model active on your account
    const selectedModel = availableModels.find(m => m.includes('flash')) || availableModels[0];

    // 9. MULTIMODAL PAYLOAD
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
    userParts.push({ text: message || (imageBase64 ? "Solve this academic question cleanly." : "Hi") });

    // 10. SINGLE DIRECT CALL (< 1.5s Execution)
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${selectedModel}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: userParts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.6,
          maxOutputTokens: 350
        }
      })
    });

    if (!geminiRes.ok) {
      const errDetail = await geminiRes.text();
      return res.status(200).json({
        text: `[${selectedModel}] Error: ` + errDetail,
        voiceEnabled: updatedVoiceEnabled,
        extractedName: name,
        nickname: nickname,
        memoryTopic: lastContext
      });
    }

    const geminiData = await geminiRes.json();
    const rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let clean = rawContent.trim();
    if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      parsed = { text: rawContent, extractedName: name, nickname: nickname, memoryTopic: lastContext };
    }

    return res.status(200).json({
      text: parsed.text || "Bhai samajh nahi aaya, ek baar firse bolna?",
      voiceEnabled: updatedVoiceEnabled,
      extractedName: parsed.extractedName || name,
      nickname: parsed.nickname || nickname,
      memoryTopic: (mode === 'study') ? lastContext : (parsed.memoryTopic || lastContext)
    });

  } catch (globalErr) {
    return res.status(200).json({
      text: "Backend Exception: " + globalErr.message,
      voiceEnabled: updatedVoiceEnabled,
      extractedName: name,
      nickname: nickname,
      memoryTopic: lastContext
    });
  }
}
