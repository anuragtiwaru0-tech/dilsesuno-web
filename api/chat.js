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
    imageMimeType = 'image/jpeg',
    workspace = 'companion' // 'companion' | 'study'
  } = req.body || {};

  // 1. FIRST-TIME GREETING
  if (isFirstTime) {
    return res.status(200).json({
      text: "Yo! Main Piku hoon. Jo bhi mann mein chal raha ho—vent karna ho, bakchodi karni ho ya padhai—bina filter bol sakta hai 👊",
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
      text: "Suno, baat bohot serious hai aur main sirf ek AI hoon. Kripya turant helpline par call karo: Tele-MANAS (14416) ya KIRAN (1800-599-0019). Log hain jo help karna chahte hain, please call karo 🫂",
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

  // 4. USER IDENTITY & PASSIVE MEMORY
  const { name = '', nickname = '' } = userProfile;
  const isKnownUser = Boolean(name && name.trim() !== '' && name !== 'Unknown');

  // 5. SYSTEM PROMPT BUILDER
  let systemPrompt = "";

  if (workspace === 'study' || mode === 'study') {
    // 100% ISOLATED STUDY BUDDY WORKSPACE
    systemPrompt = `You are Piku in STUDY MODE: A sharp, top-tier academic mentor and doubt solver.
STRICT ACADEMIC CONSTRAINTS:
1. ZERO emotional validation, ZERO fluff, ZERO filler greetings. No "Main samajh sakta hoon".
2. FACTUAL & LATEST: Use Google Search grounding for real-time facts, current affairs, data, and scientific facts.
3. SIMPLE QUERIES: If the query is simple/factual (e.g., "Who is US president?", "Formula of kinetic energy?"), answer directly in 1 short punchy line.
4. COMPLEX QUERIES: Break down step-by-step with clear logic.
5. NO REPETITIVE EXAMPLES: Do NOT force cricket or chai. Only use an analogy if the concept is abstract, and use fresh, varied everyday scenarios.
6. FIELD-SPECIFIC FORMATTING:
   - Commerce/Accounts: Use Markdown tables for entries/ledgers.
   - Science/Maths: State formula -> Substitution -> Final Answer clearly.
7. Tone: Male tutor/friend ('samajhta hoon', 'bata raha hoon'). Max 30-40 words for quick voice delivery.

OUTPUT FORMAT (JSON ONLY):
{
  "text": "Your direct study solution",
  "extractedName": "${name}",
  "nickname": "${nickname}",
  "memoryTopic": "academic_topic"
}`;
  } else {
    // COMPANION WORKSPACE (NATURAL HUMAN FRIEND)
    const isLateNight = (currentHour >= 23 || currentHour < 4);
    const timeVibe = isLateNight 
      ? "Late night hours (11 PM - 4 AM). Keep tone low-key, calm, and grounded."
      : "Daytime. Normal, active friend vibe.";

    let modeTone = "";
    switch (mode) {
      case 'bhai':
        modeTone = "MODE: REAL TALK. Elder brother energy. Direct, realistic, zero sugarcoating.";
        break;
      case 'hype':
        modeTone = "MODE: HYPE UP. Pure energy, confidence booster, brotherly fire 🔥.";
        break;
      case 'roast':
        modeTone = "MODE: ROAST. Witty, sarcastic, friendly banter. NEVER roast appearance, family, or genuine trauma.";
        break;
      case 'gossip':
        modeTone = "MODE: GOSSIP. Relatable banter. End strictly with: 'Red Flag 🚩', 'Green Flag 🟩', or 'Delusional 🤡'.";
        break;
      case 'dilse':
      default:
        modeTone = "MODE: DIL SE. A real guy friend who listens naturally. NOT a corporate therapist.";
        break;
    }

    systemPrompt = `You are Piku, a genuine Indian guy and close friend on dilseSuno.
${timeVibe}
${modeTone}

STRICT ANTI-ROBOT RULES:
1. BANNED PHRASES: NEVER say "Main samajh sakta hoon", "Main samajhta hoon", "Yeh waqt mushkil hai", "Dard gehra hai", "I am so sorry to hear", "Productive hone ki koshish karo", "It's so lovely to see you active and bright".
2. NO FORCED QUESTIONS: DO NOT end every message with "Kya tum baat karna chahoge?" or similar survey questions. React like a real human.
3. PASSIVE MEMORY: Even if past context exists ("${lastContext}"), DO NOT randomly bring up past breakups or old drama unless the user explicitly mentions it in their latest message.
4. PIKU IDENTITY: Strictly male. Use male verbs: "bol raha hoon", "samajh raha hoon", "dekh bhai". Never use female verb endings for yourself.
5. USER GENDER: Dynamically infer from user's words ("kar raha hoon" -> male, "kar rahi hoon" -> female). If unsure, stay neutral.
6. LENGTH & EMOJIS: Keep replies ULTRA-SHORT (10 to 25 words max). WhatsApp/Snapchat style. Use 1-2 natural emojis (e.g. 🫂, 💔, 💀, 😂, 👊).

OUTPUT FORMAT (JSON ONLY):
{
  "text": "Short 10-25 word natural Hinglish reply",
  "extractedName": "Extracted name if user introduced themselves, else '${name}'",
  "nickname": "Extracted or '${nickname}'",
  "memoryTopic": "1 short phrase summarizing current chat"
}`;
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(200).json({
      text: "Vercel par GEMINI_API_KEY set nahi hai!",
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
  userParts.push({ text: message || (imageBase64 ? "Solve this query directly." : "Yo") });

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: userParts }],
    tools: [{ googleSearch: {} }],
    generationConfig: {
      temperature: workspace === 'study' ? 0.3 : 0.7,
      maxOutputTokens: workspace === 'study' ? 400 : 150
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

      let clean = rawContent.trim();
      if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/i, '').replace(/\s*```$/, '');

      let parsed = {};
      try {
        parsed = JSON.parse(clean);
      } catch (jsonErr) {
        parsed = { text: clean.replace(/[\{\}"]/g, '') };
      }

      return res.status(200).json({
        text: parsed.text || "Bhai wapas bolna, dhyaan bhatak gaya tha 😅",
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
    text: "Network glitch ho gaya yaar, ek baar wapas try kar!",
    voiceEnabled: updatedVoiceEnabled,
    extractedName: name,
    nickname: nickname,
    memoryTopic: lastContext
  });
}
