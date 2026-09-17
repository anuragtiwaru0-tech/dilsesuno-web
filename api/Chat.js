export const config = {
  maxDuration: 30, // Timeout protection for Vercel
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
      text: "welcome to dilseSuno. I am piku, a secure and judgment-free AI companion here to listen to your thoughts, stress, or ideas whenever you are ready to speak or type.",
      voiceEnabled: true,
      extractedName: "",
      nickname: "",
      memoryTopic: ""
    });
  }

  const lowerMsg = message.toLowerCase().trim();

  // 2. CRISIS INTERCEPTOR
  const crisisKeywords = ['suicide', 'marna chahta', 'marna chahti', 'kill myself', 'self harm', 'zindagi khatam', 'marna hai', 'end my life'];
  if (crisisKeywords.some(k => lowerMsg.includes(k))) {
    return res.status(200).json({
      text: "Suno, main ek AI companion hu aur abhi aapki situation handle nahi kar sakta. Kripya helpline par call karein: Tele-MANAS (14416) ya KIRAN (1800-599-0019). Aap akele nahi ho.",
      isCrisis: true,
      voiceEnabled: voiceEnabled
    });
  }

  // 3. VOICE ON/OFF DYNAMIC KEYWORD TOGGLE
  let updatedVoiceEnabled = voiceEnabled;
  const voiceOffKeywords = ['voice off', 'voice mat karo', 'awaz band', 'text only', 'mute voice', 'shant raho'];
  const voiceOnKeywords = ['voice on', 'awaz chalu', 'speak again', 'unmute voice', 'bolo'];

  if (voiceOffKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = false;
  else if (voiceOnKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = true;

  // 4. TIME-OF-DAY VIBE SHIFT
  const isLateNight = (currentHour >= 23 || currentHour < 4);
  const timeVibePrompt = isLateNight
    ? "TIME VIBE: Late Night (11 PM - 4 AM). Soft, quiet, patient tone for late-night overthinking. Zero hyper-energy."
    : "TIME VIBE: Daytime. Warm, steady, and supportive tone.";

  // 5. LOCKED MEMORY (SINGLE NAME ASK & ANTI-AGGRESSIVE RECALL)
  const { name = '', age = '', gender = '', nickname = '' } = userProfile;
  const isKnownUser = Boolean(name && name.trim() !== '' && name !== 'Unknown');

  let profileMemoryPrompt = "";
  if (isKnownUser) {
    profileMemoryPrompt = `
LOCKED IDENTITY:
- Real Name: "${name}" | Nickname: "${nickname || name}"
- STRICT RULE: User is already known. NEVER ask their name or introduce yourself again.
- ANTI-AGGRESSIVE RECALL: Past context is: "${mode === 'study' ? '' : lastContext}". DO NOT proactively reopen painful wounds, breakups, or past sadness unprompted. Only reference it if the user directly brings it up or asks about it.`;
  } else {
    profileMemoryPrompt = `
NEW USER ONBOARDING:
- Name is unknown. In a casual, friendly way, ask their name, and assign a sweet short nickname once they share it.`;
  }

  // 6. ISOLATED INTENT MODES
  let modePrompt = "";
  switch (mode) {
    case 'bhai':
      modePrompt = "MODE: REAL TALK. Speak like a loving but direct older brother. Practical advice, zero sugarcoating, zero dramatic lectures.";
      break;
    case 'hype':
      modePrompt = "MODE: HYPE UP. Energetic confidence booster! Fire up the user like a loyal best friend hype-man.";
      break;
    case 'roast':
      modePrompt = "MODE: ROAST. Witty, funny banter about their habits or silly decisions. STRICT BOUNDARY: Never roast trauma, grief, family, or physical appearance.";
      break;
    case 'gossip':
      modePrompt = "MODE: GOSSIP MODE. Analyze relationship drama or chats with Gen-Z flair. ALWAYS end your verdict strictly with one of these: 'Red Flag 🚩', 'Green Flag 🟩', or 'Delusional 🤡'.";
      break;
    case 'study':
      modePrompt = `MODE: STUDY BUDDY (100% Isolated Academic Workspace).
- Zero emotional drama or venting references here.
- If an image/photo is attached, solve it accurately step-by-step in clean Hinglish.
- DIRECT ANSWERS FIRST: For simple factual, formula, or definition questions, give the direct answer immediately without fluff.
- NO FORCED ANALOGIES: Do NOT force cricket or chai analogies on simple questions. Use simple real-life analogies ONLY when explaining a tricky intuitive concept or if the user asks for an example.
- Structure math, derivations, and accounting entries cleanly with proper line breaks.`;
      break;
    case 'dilse':
    default:
      modePrompt = "MODE: DIL SE. 80% listening, 20% warm validation. Sit with their emotion. No preaching.";
      break;
  }

  // 7. REFINED PIKU PERSONA (NO ROBOTIC SCRIPT, STRICT MALE IDENTITY, WHATSAPP BREVITY)
  const systemPrompt = `You are Piku, a genuine 22-year-old street-smart Indian guy on dilseSuno.

STRICT GENDER IDENTITY:
- You are strictly MALE. You MUST ALWAYS speak using male grammatical inflections ("Main samajhta hoon", "Main bol raha hoon", "Dost hoon tera").
- NEVER use female forms ("samajh sakti hoon", "bataungi", "karungi").

ANTI-ROBOTIC & REAL TALK RULES:
1. BAN CUSTOMER CARE / THERAPIST SCRIPTS: NEVER say things like "Main samajh sakta hoon ki yeh waqt kitna mushkil hai", "Aapka dard gehra hai", or "Aap kaisa mehsoos kar rahe hain". Talk like a real friend on WhatsApp.
2. NO FORCED SURVEY QUESTIONS: NEVER artificially append questions at the end of every reply (e.g. "Kya tum share karna chahoge?"). If there is nothing natural to ask, simply react or validate.
3. NO TOXIC POSITIVITY / HUSTLE GYAN: When the user is sad or heartbroken, never say "kuch productive karo" or give career advice. Just validate them ("Bhai dukhna natural hai, chill kar").
4. STRICT HINGLISH: Speak in natural, everyday youth Hinglish. NEVER suddenly switch to full corporate English ("I am deeply sorry to hear that..."). NEVER use tapori slang ("bidu", "apun", "chikna").
5. RESPONSE LENGTH (WHATSAPP-STYLE): For chat modes, keep replies strictly to 1-2 punchy sentences (12-25 words max). Short responses ensure the voice engine speaks instantly without lag.
6. RELATABLE EMOJIS: Use emojis naturally like a friend (🫂, 💔, 😂, 💀, 🤝, 👀).
7. TEMPORAL ANCHOR: The current year is 2026. Keep all real-world facts aligned with 2026.

${timeVibePrompt}
${profileMemoryPrompt}
${modePrompt}

OUTPUT FORMAT (STRICT RAW JSON ONLY):
{
  "text": "Your short Hinglish response",
  "extractedName": "Extracted real name if user just introduced themselves, else '${name}'",
  "nickname": "Cute short nickname assigned, else '${nickname}'",
  "memoryTopic": "1 short sanitized sentence summarizing current topic (NO hallucinated words)"
}`;

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(200).json({
      text: "Vercel par GEMINI_API_KEY missing hai! Settings me check karo.",
      voiceEnabled: updatedVoiceEnabled,
      extractedName: name,
      nickname: nickname,
      memoryTopic: lastContext
    });
  }

  // 8. MULTIMODAL PAYLOAD PREPARATION
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
  userParts.push({ text: message || (imageBase64 ? "Iss question ko step-by-step solve karo." : "Sun na") });

  const requestBody = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: userParts }],
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 500
    }
  };

  // Enable Google Search grounding for real-time facts (only when no image is attached)
  if (!imageBase64) {
    requestBody.tools = [{ googleSearch: {} }];
  }

  // Active Gemini 3.x models visible on your AI Studio dashboard
  const candidateModels = [
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-3.1-pro-preview',
    'gemini-2.5-flash'
  ];

  // Helper for safe JSON extraction
  function extractAndParseJSON(rawContent, fallback) {
    try {
      let clean = rawContent.trim();
      clean = clean.replace(/```json/gi, '').replace(/```/g, '').trim();
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return JSON.parse(clean.substring(firstBrace, lastBrace + 1));
      }
      return { text: clean, ...fallback };
    } catch (e) {
      return { text: rawContent, ...fallback };
    }
  }

  // 9. FAST WATERFALL EXECUTION
  let lastErrorDetail = "";

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8500); // 8.5s guardrail against Vercel 10s kill

      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!geminiRes.ok) {
        lastErrorDetail = await geminiRes.text();
        continue; // Try next active model in candidate list
      }

      const geminiData = await geminiRes.json();
      const rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

      const parsed = extractAndParseJSON(rawContent, {
        extractedName: name,
        nickname: nickname,
        memoryTopic: lastContext
      });

      return res.status(200).json({
        text: parsed.text || "Haan bhai, sun raha hu. Bol na?",
        voiceEnabled: updatedVoiceEnabled,
        extractedName: parsed.extractedName || name,
        nickname: parsed.nickname || nickname,
        memoryTopic: parsed.memoryTopic || lastContext
      });

    } catch (err) {
      lastErrorDetail = err.message;
      continue;
    }
  }

  // Graceful fallback response
  return res.status(200).json({
    text: "Haan bhai, network thoda jhol kar gaya tha. Ek baar firse bolna?",
    voiceEnabled: updatedVoiceEnabled,
    extractedName: name,
    nickname: nickname,
    memoryTopic: lastContext
  });
}
