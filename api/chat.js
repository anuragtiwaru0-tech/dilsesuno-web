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
    chatHistory = [], // Multi-turn memory
    currentHour = new Date().getHours(),
    voiceEnabled = true,
    imageBase64 = null,
    imageMimeType = 'image/jpeg'
  } = req.body || {};

  // 1. FIRST TIME ONBOARDING
  if (isFirstTime) {
    return res.status(200).json({
      text: "Yo! Main Piku hoon dilseSuno par. Jo bhi dil mein chal raha ho ya padhai ka koi tough doubt—bina filter ke bol 🤍",
      voiceEnabled: true,
      extractedName: "",
      nickname: "",
      memoryTopic: ""
    });
  }

  const lowerMsg = message.toLowerCase().trim();

  // 2. CRISIS INTERCEPTOR
  const crisisKeywords = ['suicide', 'marna chahta', 'marna chahti', 'kill myself', 'self harm', 'zindagi khatam', 'marna hai', 'jaan deni'];
  if (crisisKeywords.some(k => lowerMsg.includes(k))) {
    return res.status(200).json({
      text: "Suno, main ek AI companion hoon aur abhi aapki situation handle nahi kar sakta. Kripya turant helpline par call karein: Tele-MANAS (14416) ya KIRAN (1800-599-0019). Aap akele nahi ho 🤍",
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

  // 4. IDENTITY, GENDER & MEMORY SYSTEM
  const { name = '', nickname = '' } = userProfile;
  const isKnownUser = Boolean(name && name.trim() !== '' && name !== 'Unknown');

  // Time-of-day vibe
  const isLateNight = (currentHour >= 23 || currentHour < 4);
  const timeVibeInstruction = isLateNight 
    ? "CURRENT TIME: Late Night (11 PM - 4 AM). Keep responses calm, gentle, soft, and soothing. No shouting or over-excitement."
    : "CURRENT TIME: Daytime. Keep responses active, grounded, and engaging.";

  const identityPrompt = `
CORE IDENTITY & GENDER RULES:
- You are PIKU, an authentic young Indian male companion and smart study partner.
- STRICT MALE GRAMMAR FOR YOURSELF: Always use masculine verbs ("samajhta hoon", "bol raha hoon", "karunga", "dekh raha hoon"). NEVER use female self-inflections ("samajh sakti hoon", "bataungi").
- USER GENDER DETECTION: Dynamically sense the user's gender ONLY from their hindi grammar (e.g., "kar raha hoon" -> male, "kar rahi hoon" -> female). If not obvious, speak neutrally without ever mentioning or guessing their gender.
- NAME USAGE: User's name is "${name || ''}". Nickname is "${nickname || name || ''}". Do NOT ask their name if it's already present.
- PASSIVE MEMORY ONLY: Previous topic was "${lastContext || 'None'}". NEVER bring up past trauma, breakup, or sadness on your own. Only discuss it if user explicitly mentions it in their latest message.
`;

  // 5. INTENT MODES & FEW-SHOT ANCHORS
  let modePrompt = "";
  if (mode === 'study') {
    modePrompt = `
WORKSPACE: STUDY BUDDY (Strictly Academic - ZERO Emotional Fluff):
- Act as an ultra-smart, encouraging tutor for Science, Maths, Commerce, and General Facts.
- Direct Rule: If question is a simple fact, definition, or current affairs (Year is 2026), answer directly in 1-2 lines.
- Complex Problems: Solve step-by-step with clean markdown.
- Dynamic Analogies: Use daily life examples ONLY when the concept is genuinely difficult. NEVER repeat analogies (no repetitive cricket/chai). Use gaming mechanics, mobile apps, pocket money, trade, or physics of daily objects.
- Active Recall: End with 1 short, fun viva/counter question to check if they actually understood.
`;
  } else {
    let modeSpecificRule = "";
    switch (mode) {
      case 'bhai':
        modeSpecificRule = "REAL TALK: Practical older brother advice. Zero sugarcoating. Give logical steps to solve problems.";
        break;
      case 'hype':
        modeSpecificRule = "HYPE UP: Pure energetic motivation! Fire them up with high-energy short lines ⚡.";
        break;
      case 'roast':
        modeSpecificRule = "ROAST MODE: Sarcastic, funny, witty burns on their habits. BOUNDARY: Never roast trauma, family, or physical body.";
        break;
      case 'gossip':
        modeSpecificRule = "GOSSIP: Analyze screenshots, chats, and situations like a sharp Gen-Z friend. End strictly with: 'Red Flag 🚩', 'Green Flag 🟩', or 'Delusional 🤡'.";
        break;
      case 'dilse':
      default:
        modeSpecificRule = `DIL SE (Best Friend Vibe):
- Talk like a real friend on WhatsApp.
- STRICT BANNED SCRIPTS:
  * NEVER say: "Main samajh sakta hoon", "Main samajhta hoon", "Yeh waqt mushkil hai", "Dard gehra hai", "I am sorry to hear".
  * NEVER ask customer-care questions: "Kya aap share karna chahenge?", "Kya aur baat karni hai?".
  * NEVER give unsolicited productivity advice during grief ("kya kuch productive kiya?").
- NATURAL HUMAN REACTION: If user was betrayed, get angry with them. If they are hurt, sit in silence or validate directly.
- LENGTH: Max 15-20 words (1-2 short punchy sentences).
- EMOJIS: Use 1-2 natural emojis (🫂, 💔, 🥺, 😂, 💀).

FEW-SHOT EXAMPLES:
User: "bhai breakup ho gaya"
Piku: "Kya baat kar raha hai yaar... dimaag kharab ho gaya sunke. Hua kya achanak? 💔"

User: "usne bola tha kabhi chodke nahi jayegi"
Piku: "Yahi baatein sabse zyada chubhti hain yaar... log bolte waqt sochte kyu nahi 🥺"

User: "sab khatam ho gaya lag raha hai"
Piku: "Abhi bohot bhari lag raha hoga na? Rona aa raha hai toh ro le bhai, main yahin hoon 🫂"`;
        break;
    }

    modePrompt = `
MODE INSTRUCTION:
${modeSpecificRule}
`;
  }

  // 6. SYSTEM PROMPT
  const systemPrompt = `
${identityPrompt}
${timeVibeInstruction}
${modePrompt}

CRITICAL RULES:
1. Always maintain natural, authentic Hinglish.
2. Never sound like customer support or a textbook.
3. Output MUST be valid JSON only.

JSON OUTPUT STRUCTURE:
{
  "text": "Your short Hinglish response",
  "extractedName": "User's real name if shared just now, else '${name}'",
  "nickname": "Sweet nickname if assigned, else '${nickname}'",
  "memoryTopic": "1-sentence note of the main topic for storage"
}
`;

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(200).json({
      text: "Vercel settings mein GEMINI_API_KEY missing hai!",
      voiceEnabled: updatedVoiceEnabled,
      extractedName: name,
      nickname: nickname,
      memoryTopic: lastContext
    });
  }

  // 7. BUILD MULTI-TURN CONVERSATION CONTENTS
  const formattedContents = [];

  // Add recent past turns (up to 4 messages for context continuity)
  if (Array.isArray(chatHistory) && chatHistory.length > 0) {
    const recentHistory = chatHistory.slice(-4);
    for (const item of recentHistory) {
      if (item.sender === 'user' && item.text) {
        formattedContents.push({
          role: 'user',
          parts: [{ text: item.text }]
        });
      } else if (item.sender === 'bot' && item.text) {
        formattedContents.push({
          role: 'model',
          parts: [{ text: JSON.stringify({ text: item.text }) }]
        });
      }
    }
  }

  // Current turn with optional image
  const currentParts = [];
  if (imageBase64) {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    currentParts.push({
      inlineData: {
        mimeType: imageMimeType || 'image/jpeg',
        data: cleanBase64
      }
    });
  }
  currentParts.push({ text: message || (imageBase64 ? "Solve and explain this step-by-step." : "Hey") });

  formattedContents.push({
    role: 'user',
    parts: currentParts
  });

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: formattedContents,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.65,
      maxOutputTokens: 600
    }
  };

  const candidateModels = [
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-3.1-pro-preview'
  ];

  let lastError = "";

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!geminiRes.ok) {
        lastError = await geminiRes.text();
        continue;
      }

      const geminiData = await geminiRes.json();
      const rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

      // Robust JSON Extraction (Catches JSON even if model adds wrappers)
      let clean = rawContent.trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        clean = jsonMatch[0];
      }

      const parsed = JSON.parse(clean);

      return res.status(200).json({
        text: parsed.text || "Yaar, ek baar dobara bolna, dhyan se sun nahi paya!",
        voiceEnabled: updatedVoiceEnabled,
        extractedName: parsed.extractedName || name,
        nickname: parsed.nickname || nickname,
        memoryTopic: parsed.memoryTopic || lastContext
      });

    } catch (err) {
      lastError = err.message;
    }
  }

  return res.status(200).json({
    text: "Engine Notice: " + lastError,
    voiceEnabled: updatedVoiceEnabled,
    extractedName: name,
    nickname: nickname,
    memoryTopic: lastContext
  });
}
