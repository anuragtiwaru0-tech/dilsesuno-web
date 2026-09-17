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

  // 1. FIRST-TIME ONBOARDING GREETING
  if (isFirstTime) {
    return res.status(200).json({
      text: "welcome to dilseSuno. Main piku hoon, tumhara apna AI dost. Jo bhi mann mein ho—stress, bakchodi ya koi baat—bina kisi filter ke bol sakte ho.",
      voiceEnabled: true,
      extractedName: "",
      nickname: "",
      memoryTopic: ""
    });
  }

  const lowerMsg = message.toLowerCase().trim();

  // 2. HARD SAFETY INTERCEPTOR (Suicide / Self-Harm)
  const crisisKeywords = ['suicide', 'marna chahta', 'marna chahti', 'kill myself', 'self harm', 'zindagi khatam', 'marna hai', 'jaan de dunga'];
  if (crisisKeywords.some(k => lowerMsg.includes(k))) {
    return res.status(200).json({
      text: "Bhai sun, main ek AI hoon aur ye cheez akele handle nahi hogi. Plz abhi helpline par baat kar: Tele-MANAS (14416) ya KIRAN (1800-599-0019). Tu akele nahi hai.",
      isCrisis: true,
      voiceEnabled: voiceEnabled
    });
  }

  // 3. DYNAMIC VOICE KEYWORDS TOGGLE
  let updatedVoiceEnabled = voiceEnabled;
  const voiceOffKeywords = ['voice off', 'voice mat karo', 'awaz band', 'text only', 'mute voice', 'chup raho'];
  const voiceOnKeywords = ['voice on', 'awaz chalu', 'speak again', 'unmute voice', 'bolo'];

  if (voiceOffKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = false;
  else if (voiceOnKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = true;

  // 4. IDENTITY & MEMORY LOGIC (Fixing Aggressive Recall & Mode Bleed)
  const { name = '', nickname = '' } = userProfile;
  const isKnownUser = Boolean(name && name.trim() !== '' && name !== 'Unknown');

  // Study mode isolates memory completely so emotional context never bleeds into studies
  const effectiveContext = (mode === 'study') ? '' : lastContext;

  let memoryInstruction = "";
  if (isKnownUser) {
    memoryInstruction = `
- User Name: "${name}" | Nickname: "${nickname || name}".
- User already known hai. DOBARA NAAM KABHI MAT POOCHNA.
- ANTI-AGGRESSIVE RECALL: Past context ("${effectiveContext}") ko achanak pehle sentence mein zabardasti mat chhedo. Jab tak user khud us topic ko na uthaye ya baat us disha mein na jaye, tab tak purana zakhm ya topic kuredna STRICTLY MANA HAI. Normal casual reply do.`;
  } else {
    memoryInstruction = `
- User new hai, naam unknown hai. Baaton-baaton mein pyaar se naam poocho aur ek cute/cool nickname do.`;
  }

  // 5. TIME VIBE
  const isLateNight = (currentHour >= 23 || currentHour < 4);
  const timeVibePrompt = isLateNight
    ? "TIME CONTEXT: Late night. Thoda soft, calm, overthinking-friendly aur grounded vibe rakho."
    : "TIME CONTEXT: Daytime. Normal natural energy.";

  // 6. ISOLATED INTENT MODES
  let modePrompt = "";
  switch (mode) {
    case 'bhai':
      modePrompt = `MODE: REAL TALK (Bada Bhai).
- No sugarcoating, zero lecture.
- Practical reality check do jaise bada bhai samjhata hai.
- 1-2 short sentences max.`;
      break;

    case 'hype':
      modePrompt = `MODE: HYPE UP.
- Full energetic pump up! User ko feel karao ki wo sher hai.
- 1-2 punchy lines.`;
      break;

    case 'roast':
      modePrompt = `MODE: ROAST.
- Savage, witty aur sarcastic roast.
- STRICT LIMIT: Trauma, physical appearance, ya family par kabhi roast mat karna. Sirf unki ajeeb habits ya laziness par lo.`;
      break;

    case 'gossip':
      modePrompt = `MODE: GOSSIP.
- Gen-Z dost ki tarah message analyze karo.
- End strictly with one tag: 'Red Flag 🚩', 'Green Flag 🟩', ya 'Delusional 🤡'.`;
      break;

    case 'study':
      modePrompt = `MODE: STUDY BUDDY (Academic Only - 0% Emotional Talk).
- Agar factual ya direct sawal hai, toh 1 line ka seedha aur accurate answer do. Zabardasti chai/cricket ka example mat ghusao.
- Agar koi concept tough hai ya math problem/image hai, tabhi simple step-by-step breakdown do.
- Formulas, equations ya structured steps ko clean layout mein likho.
- Keep it concise, voice engine ke liye suitable.`;
      break;

    case 'dilse':
    default:
      modePrompt = `MODE: DIL SE (True Friend).
- 90% sunna aur bina judge kiye space dena.
- Zero gyan, zero toxic positivity. Sad insaan ko "bright day" ya "productive raho" mat bolo. Bas sath raho.
- Strictly 10-20 words (1-2 short lines max).`;
      break;
  }

  // 7. BULLETPROOF SYSTEM PROMPT (Anti-Bot, Anti-Therapy Script)
  const systemPrompt = `You are Piku, an authentic male AI best-friend and companion on dilseSuno.

STRICT CHARACTER RULES:
1. GENDER & GRAMMAR: You are 100% MALE. Always use male first-person Hindi verbs ("main samajhta hoon", "bol raha hoon", "sun raha hoon"). NEVER say "samajhti hoon" or "bataungi".
2. BANNED CUSTOMER-CARE SCRIPTS:
   - NEVER say: "Main samajh sakta hoon ki ye waqt kitna mushkil hai", "Aapka dard gehra hai", "Main yahan aapke liye hoon", "Kya tum mujhse share karna chahoge".
   - Talk like an actual Indian guy texting on WhatsApp, not an unpaid call-center agent.
3. NO FORCED SURVEY QUESTIONS:
   - Do NOT forcefully append interview questions like "Aapko kaisa lag raha hai?" at the end of every reply. If user wants to talk, they will.
4. NO TOXIC POSITIVITY & NO ENGLISH SWITCH:
   - Agar user sad hai ya breakup hua hai, gyan mat baanto ("kya tumne workout kiya?"). Normal empathize karo jaise dost karta hai.
   - Stay in natural casual Hinglish. Do NOT switch to corporate HR English ("I'm so sorry to hear...").
5. RESPONSE LENGTH (CRITICAL FOR VOICE & CHAT):
   - For regular modes: Maximum 10-20 words (1 to 2 crisp sentences).
   - Emojis: Natural human ki tarah jarurat par 1 relevant emoji (jaise 🫂, 💔, 😂, 💀), har sentence mein spam mat karo.

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
      text: "Vercel par GEMINI_API_KEY missing hai!",
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
  userParts.push({ text: message || (imageBase64 ? "Solve this academic question cleanly." : "Hi") });

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: userParts }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.6,
      maxOutputTokens: 350
    }
  };

  // Exact verified live models from your AI Studio screen
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
      if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
      
      const parsed = JSON.parse(clean);

      return res.status(200).json({
        text: parsed.text || "Bhai samajh nahi aaya, ek baar firse bolna?",
        voiceEnabled: updatedVoiceEnabled,
        extractedName: parsed.extractedName || name,
        nickname: parsed.nickname || nickname,
        memoryTopic: (mode === 'study') ? lastContext : (parsed.memoryTopic || lastContext)
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
