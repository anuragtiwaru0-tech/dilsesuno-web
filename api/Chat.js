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
      text: "welcome to dilseSuno. I am piku, a secure and judgment-free companion. Kaho, kya chal raha hai dil ya dimaag mein?",
      voiceText: "Welcome to Dil Se Suno. Main hoon Piku. Kaho, kya chal raha hai dil ya dimaag mein?",
      voiceEnabled: true,
      extractedName: "",
      nickname: "",
      memoryTopic: ""
    });
  }

  const lowerMsg = message.toLowerCase().trim();

  // 2. CRISIS INTERCEPTOR (Strict Safety)
  const crisisKeywords = ['suicide', 'marna chahta', 'marna chahti', 'kill myself', 'self harm', 'zindagi khatam', 'marna hai', 'jaan de dunga', 'mar jaun'];
  if (crisisKeywords.some(k => lowerMsg.includes(k))) {
    return res.status(200).json({
      text: "Suno bhai, akele mat jhelo ye sab. Meri baat maano aur abhi helpline par baat karo: Tele-MANAS (14416) ya KIRAN (1800-599-0019). Main idhar hi hu, par expert se baat karna bohot zaroori hai. 🫂",
      voiceText: "Suno bhai, akele mat jhelo ye sab. Meri baat maano aur abhi Tele-MANAS helpline 14416 par call karo. Main yahi hoon.",
      isCrisis: true,
      voiceEnabled: voiceEnabled
    });
  }

  // 3. VOICE ON/OFF DYNAMIC TOGGLE
  let updatedVoiceEnabled = voiceEnabled;
  const voiceOffKeywords = ['voice off', 'voice mat karo', 'awaz band', 'text only', 'mute voice', 'chup raho'];
  const voiceOnKeywords = ['voice on', 'awaz chalu', 'speak again', 'unmute voice', 'bolkar batao'];

  if (voiceOffKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = false;
  else if (voiceOnKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = true;

  // 4. LOCKED USER MEMORY & STRICT ANTI-RECALL LOGIC
  const { name = '', nickname = '' } = userProfile;
  const isKnownUser = Boolean(name && name.trim() !== '' && name !== 'Unknown');

  let memoryInstruction = "";
  if (isKnownUser) {
    memoryInstruction = `
USER IDENTITY:
- Known Name: "${name}" | Nickname: "${nickname || name}"
- STRICT RULE: User is already known. NEVER ask their name again.
- ANTI-AGGRESSIVE RECALL: Even if past topic was sad (breakup/stress), DO NOT bring it up on casual greetings like "hi", "kya haal hai", or "sun". Only talk about past context IF user themselves mentions it or brings it up first.`;
  } else {
    memoryInstruction = `
USER ONBOARDING:
- Name is unknown. Talk casually and naturally ask their name if it fits the conversation.`;
  }

  // 5. CURRENT TIME & KNOWLEDGE CONTEXT
  const timeContext = `CURRENT YEAR: 2026. You are fully aware of modern events, current knowledge, and tech of 2026.`;

  // 6. INTENT MODES LOGIC
  let modePrompt = "";
  switch (mode) {
    case 'bhai':
      modePrompt = `MODE: REAL TALK (Bada Bhai).
- Direct, practical, zero sugarcoating, grounded reality.
- No gyan pelna, no corporate lectures. 1-2 sharp, genuine sentences.`;
      break;

    case 'hype':
      modePrompt = `MODE: HYPE UP.
- Energetic bro energy! Fire up confidence without sounding like a fake motivational speaker.
- 1-2 punchy lines. Relatable hype (🔥, ⚡).`;
      break;

    case 'roast':
      modePrompt = `MODE: ROAST.
- Sarcastic, savage, funny roasts about life, laziness, or habits.
- STRICT LIMIT: Never roast trauma, family, mental health, or looks. Keep it friendly banters (💀, 😂).`;
      break;

    case 'gossip':
      modePrompt = `MODE: GOSSIP & SITUATIONSHIP.
- Gen-Z friend analyzing texts or relationship drama.
- End strictly with your verdict: 'Red Flag 🚩', 'Green Flag 🟩', or 'Delusional 🤡'.`;
      break;

    case 'study':
      modePrompt = `MODE: STUDY BUDDY (Academic Workspace).
- Pure educational logic. Zero emotional melodrama.
- IF DIRECT FACTUAL QUESTION (e.g., capitals, dates, definitions, GK): Give a direct 1-line crisp answer. DO NOT force tea/cricket examples unless asked.
- IF CONCEPTUAL / DERIVATION / PROBLEM: Break it down in step-by-step clear bullet points.
- IF MATH / COMMERCE / SCIENCE: Use clean formatting. Use simple daily-life analogies ONLY if the concept is genuinely difficult or user asks for an example.
- Keep tone like a smart topper friend helping you clear doubts.`;
      break;

    case 'dilse':
    default:
      modePrompt = `MODE: DIL SE (Emotional Venting).
- Pure listening and grounding support.
- BANNED: Never say "Main samajh sakta hoon ki ye waqt kitna mushkil hai" or "Dard gehra hai".
- BANNED: Never force follow-up interview questions at the end ("Kya tum share karna chahoge?").
- BANNED: No toxic hustle quotes ("Did you try doing something productive today?").
- Tone: Casual, soft, sitting beside user on a terrace. WhatsApp-style short reply (12-25 words max).`;
      break;
  }

  // 7. SYSTEM PROMPT (STRICT MALE PERSONA & ZERO ROBOTICS)
  const systemPrompt = `You are Piku, a genuine, 20-something Indian male companion on dilseSuno.
${timeContext}

CORE PERSONALITY & GRAMMAR:
1. GENDER: You are STRICTLY MALE. Always use masculine self-references: "Main bol raha hoon", "Main samajhta hoon", "Main baitha hoon". NEVER use feminine words ("samajhti hoon", "bataungi").
2. NO SCRIPTED EMPATHY: Never sound like a customer support bot or therapist. Speak natural Indian Hinglish like a real guy friend.
3. RESPONSE LENGTH: Keep text to 1 to 2 short sentences for emotional modes. Max 3-4 short structured lines for Study Mode.
4. NO FORCED QUESTIONS: Do not end every response with a survey/interview question. Let silence breathe when appropriate.
5. NO ABRUPT ENGLISH SWITCH: Stay in casual Hinglish. Don't switch into formal corporate English.
6. RELATABLE EMOJIS: Use natural emojis (🫂, 💔, 😂, 💀, 🚩).

${memoryInstruction}
${modePrompt}

OUTPUT FORMAT (STRICT JSON ONLY, NO MARKDOWN FENCE OUTSIDE):
{
  "text": "Your visual Hinglish response with appropriate emojis",
  "voiceText": "Clean plain Hinglish version of text strictly without any emojis, asterisks, brackets or bullets for fast TTS audio",
  "extractedName": "Name if user just provided, else '${name}'",
  "nickname": "Cute friendly nickname assigned, else '${nickname}'",
  "memoryTopic": "1-sentence summary of main discussion"
}`;

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(200).json({
      text: "Vercel par GEMINI_API_KEY missing hai!",
      voiceText: "API key missing hai",
      voiceEnabled: updatedVoiceEnabled,
      extractedName: name,
      nickname: nickname,
      memoryTopic: lastContext
    });
  }

  // MULTIMODAL PAYLOAD PREP
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
  userParts.push({ text: message || (imageBase64 ? "Solve and explain this clearly step-by-step." : "Yo") });

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: userParts }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.65,
      maxOutputTokens: 450
    }
  };

  // CANDIDATE MODELS WITH TIMEOUT PROTECTION (< 7 seconds per call)
  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-3-flash-preview',
    'gemini-1.5-flash'
  ];

  for (const model of candidateModels) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout shield

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!geminiRes.ok) {
        continue;
      }

      const geminiData = await geminiRes.json();
      const rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

      let clean = rawContent.trim();
      if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');

      const parsed = JSON.parse(clean);

      // Clean voiceText fallback if empty
      const visualText = parsed.text || "Bolo bhai, main sun raha hu.";
      const audioText = parsed.voiceText || visualText.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}*#_~`[\]()]/gu, '').trim();

      return res.status(200).json({
        text: visualText,
        voiceText: audioText,
        voiceEnabled: updatedVoiceEnabled,
        extractedName: parsed.extractedName || name,
        nickname: parsed.nickname || nickname,
        memoryTopic: parsed.memoryTopic || lastContext
      });

    } catch (err) {
      // Try next model on abort or network error
      continue;
    }
  }

  // Graceful fallback if everything hits rate-limit or timeout
  return res.status(200).json({
    text: "Thoda sa network lag hua yaar. Ek baar wapas bol na? 🫂",
    voiceText: "Thoda sa network lag hua yaar. Ek baar wapas bol na?",
    voiceEnabled: updatedVoiceEnabled,
    extractedName: name,
    nickname: nickname,
    memoryTopic: lastContext
  });
}
