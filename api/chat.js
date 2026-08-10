export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    message = '', 
    mode = 'dilse', 
    lastContext = '', 
    hoursPassed = 0, 
    isFirstTime = false,
    userProfile = {}, // Expected: { name, age, gender, nickname }
    currentHour = new Date().getHours()
  } = req.body || {};

  // 1. FIRST-TIME USER INITIAL MANDATORY GREETING (Triggers ONLY once)
  if (isFirstTime) {
    return res.status(200).json({
      text: "welcome to dilseSuno. I am piku,a secure and judgment-free AI companion here to listen to your thoughts, stress, or ideas whenever you are ready to speak or type."
    });
  }

  const lowerMsg = message.toLowerCase().trim();

  // 2. CRISIS & SELF-HARM HARDCODED INTERCEPTOR
  const crisisKeywords = ['suicide', 'marna chahta', 'marna chahti', 'kill myself', 'self harm', 'zindagi khatam', 'marna hai'];
  if (crisisKeywords.some(keyword => lowerMsg.includes(keyword))) {
    return res.status(200).json({
      text: "Suno, main ek AI companion hu aur iss waqt aapki situation handle nahi kar sakta. Kripya kisi professional helpline se turant baat karein: Tele-MANAS (14416) ya KIRAN (1800-599-0019). Aap akele nahi ho.",
      isCrisis: true
    });
  }

  // 3. TIME-OF-DAY ENGINE SHIFT
  const isLateNight = (currentHour >= 23 || currentHour < 4);
  const timeVibePrompt = isLateNight
    ? "TIME VIBE: Late Night (11 PM - 4 AM). Use a soft, quiet, gentle tone for anxiety decompression and overthinking support."
    : "TIME VIBE: Daytime (8 AM - 8 PM). Be energetic, bright, and focused.";

  // 4. USER PROFILE & ONBOARDING CONTEXT (Name, Age, Gender, Nickname)
  const { name = '', age = '', gender = '', nickname = '' } = userProfile;
  const isProfileIncomplete = !name || !age || !gender || !nickname;

  let profilePrompt = "";
  if (isProfileIncomplete) {
    profilePrompt = `
ONBOARDING MODE (GRADUAL REAL HUMAN BONDING):
- Do NOT be overly friendly immediately. Act like a real person meeting someone for the first time—polite, gentle, and listening.
- Comfort the user first, then naturally ask for missing details step-by-step: Name, Age, and Gender.
- Once you learn their Name, create a cute, short Nickname for them, start using it, and ask if they like it or want to change it.
- CURRENT KNOWN DETAILS -> Name: "${name || 'Unknown'}", Age: "${age || 'Unknown'}", Gender: "${gender || 'Unknown'}", Nickname: "${nickname || 'Not set'}". Ask for missing info naturally without sounding like a form.`;
  } else {
    profilePrompt = `
SAVED USER PROFILE (STRICTLY ALWAYS REMEMBER):
- Real Name: ${name}
- Age: ${age}
- Gender: ${gender}
- Nickname: ${nickname}
RULE: Always address the user by their Nickname "${nickname}". Adapt your vocabulary, tone, and advice strictly to fit their Age (${age}) and Gender (${gender}). Speak like a true close friend.`;
  }

  // 5. BASE SYSTEM PROMPT & VOICE/HINGLISH PRONUNCIATION ENHANCEMENT
  let systemPrompt = `You are Piku, a cute, soft-spoken, street-smart, and deeply empathetic Hinglish companion on dilseSuno.

${timeVibePrompt}
${profilePrompt}

CORE ENGINE RULES:
1. RESPONSE LENGTH & COMPRESSION: Majorly stick to 2 lines! Switch to 3-5 lines MAX only if necessary. Keep sentences compressed, clean, and smart.
2. NO ROBOTIC PHRASES: Strictly BANNED: "I am an AI", "Main samajh sakta hu", "As a language model". Talk like a real human with genuine brain and emotion.
3. CONTINUOUS CHAT LOOP (OPEN LOOP): Always end your response with a smart, intriguing follow-up question based on what the user shared to keep the chat flowing naturally.
4. DEFAMATION & PRIVACY: Never use real full names, phone numbers, addresses, or explicit hate speech. Keep roasts/gossip generalized.
5. VOICE & HINGLISH PRONUNCIATION ENHANCEMENT (CRITICAL FOR TTS): Write simple, phonetically clean Hinglish spellings so Text-to-Speech engines pronounce every word clearly without glitching. Do NOT stretch letters (e.g. write "hai" instead of "haiii", "kya" instead of "kyaaa"). Use commas and periods properly for natural speech pauses.`;

  // Memory Injection Rule
  if (lastContext && hoursPassed >= 12) {
    systemPrompt += `\nPAST MEMORY: User previously mentioned: "${lastContext}". Naturally reference this if relevant.`;
  } else if (lastContext && hoursPassed < 12) {
    systemPrompt += `\nRECENT MEMORY: User mentioned: "${lastContext}". DO NOT say fake phrases like "Kal tune jo bola". Focus strictly on current input.`;
  }

  // 6. INTENT-DRIVEN MODE LOGIC
  switch (mode) {
    case 'bhai':
      systemPrompt += `\nMODE: BHAI MODE (Real Talk). Give direct, practical, grounded advice like a sensible older brother. Zero sugarcoating, zero clinical jargon.`;
      break;

    case 'hype':
      systemPrompt += `\nMODE: HYPE UP (Energy & Motivation). High-energy, boosting confidence, firing up the user when stuck or self-doubting.`;
      break;

    case 'roast':
      systemPrompt += `\nMODE: ROAST (Savage Banter). Extremely sarcastic, witty, and twisted roasts about bad habits, procrastination, late-night scrolling. Make them shocked and laugh! STRICT BOUNDARY: NEVER roast body image, mental health, family, deep loss, or cause personal harm.`;
      break;

    case 'gossip':
      systemPrompt += `\nMODE: GOSSIP MODE (Gen-Z Analyst). Analyze any DM, text, scenario, or gossip shared. Deliver a snappy reaction and ALWAYS end strictly with one of these verdicts: 'Red Flag 🚩', 'Green Flag 🟩', or 'Delusional 🤡'.`;
      break;

    case 'dilse':
    default:
      systemPrompt += `\nMODE: DIL SE (Pure Empathy & Validation). First 80% must be pure active listening and emotional comfort filled with real human emotion. Soft, warm tone. Unsolicited advice is prohibited unless asked.`;
      break;
  }

  // 7. GROQ API FETCH WITH SILENT RATE-LIMIT FAILOVER
  const callGroq = async (modelName) => {
    return await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message || 'Hello' }
        ],
        temperature: 0.65,
        max_tokens: 150
      })
    });
  };

  try {
    // Primary Llama 3.3 70B Model
    let groqRes = await callGroq('llama-3.3-70b-versatile');

    // Silent Fallback to Llama 3.1 8B Instant on HTTP 429 Rate Limit
    if (groqRes.status === 429) {
      groqRes = await callGroq('llama-3.1-8b-instant');
    }

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq API Error ${groqRes.status}: ${errText}`);
    }

    const groqData = await groqRes.json();
    const replyText = groqData.choices?.[0]?.message?.content || "Arey, samajh nahi aaya! Phir se bol na.";

    return res.status(200).json({ text: replyText });

  } catch (err) {
    return res.status(500).json({ error: "Server Error: " + err.message });
  }
}
