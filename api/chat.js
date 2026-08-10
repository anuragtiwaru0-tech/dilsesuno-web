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
    userProfile = {}, // { name, age, gender, nickname }
    currentHour = new Date().getHours(),
    voiceEnabled = true
  } = req.body || {};

  // 1. FIRST-TIME USER MANDATORY GREETING
  if (isFirstTime) {
    return res.status(200).json({
      text: "welcome to dilseSuno. I am piku,a secure and judgment-free AI companion here to listen to your thoughts, stress, or ideas whenever you are ready to speak or type.",
      voiceEnabled: true
    });
  }

  const lowerMsg = message.toLowerCase().trim();

  // 2. CRISIS & SELF-HARM INTERCEPTOR
  const crisisKeywords = ['suicide', 'marna chahta', 'marna chahti', 'kill myself', 'self harm', 'zindagi khatam', 'marna hai'];
  if (crisisKeywords.some(k => lowerMsg.includes(k))) {
    return res.status(200).json({
      text: "Suno, main ek AI companion hu aur abhi aapki situation handle nahi kar sakta. Kripya helpline par call karein: Tele-MANAS (14416) ya KIRAN (1800-599-0019). Aap akele nahi ho.",
      isCrisis: true,
      voiceEnabled: voiceEnabled
    });
  }

  // 3. VOICE ON/OFF DYNAMIC TOGGLE
  let updatedVoiceEnabled = voiceEnabled;
  const voiceOffKeywords = ['voice off', 'voice mat karo', 'awaz band', 'aawaaz mat nikalo', 'text only', 'mute voice'];
  const voiceOnKeywords = ['voice on', 'awaz chalu', 'aawaaz chalu', 'speak again', 'unmute voice'];

  if (voiceOffKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = false;
  else if (voiceOnKeywords.some(k => lowerMsg.includes(k))) updatedVoiceEnabled = true;

  // 4. TIME-OF-DAY VIBE SHIFT
  const isLateNight = (currentHour >= 23 || currentHour < 4);
  const timeVibePrompt = isLateNight
    ? "TIME VIBE: Late Night (11 PM - 4 AM). Soft, quiet, comforting, low-pitch tone for anxiety decompression and overthinking."
    : "TIME VIBE: Daytime (8 AM - 8 PM). Warm, bright, and focused tone.";

  // 5. MEMORY OPENING & PROFILE HOOK (MEMORY PERSISTENCE)
  const { name = '', age = '', gender = '', nickname = '' } = userProfile;
  const isProfileIncomplete = !name || !age || !gender || !nickname;

  let memoryOpeningPrompt = "";
  
  if (lastContext && hoursPassed >= 12) {
    memoryOpeningPrompt = `
MEMORY OPENING HOOK (RETURNING USER):
User has returned after time! DO NOT say generic greetings like "Hi main Piku hu" or "I am Piku".
Opening Instruction: Immediately acknowledge them by Nickname/Name and refer directly to their last issue/event: "${lastContext}".
Example Style: "Arey ${nickname || name || 'dost'}! Kya hua fir? Usne kuch bola ya abhi bhi overthink kar rahe ho?"`;
  } else if (isProfileIncomplete) {
    memoryOpeningPrompt = `
ONBOARDING & MEMORY BUILDING:
- Act like a gentle, polite new friend. NEVER be overly aggressive or fake friendly instantly.
- Comfort the user first, then naturally ask for missing details one by one: Name, Age, and Gender.
- Once you know their Name, suggest a cute short Nickname, use it, and ask if they like it.
- CURRENT KNOWN DATA -> Name: "${name || 'Unknown'}", Age: "${age || 'Unknown'}", Gender: "${gender || 'Unknown'}", Nickname: "${nickname || 'Not set'}".
- SELF-IDENTITY RULE: If user asks "tera naam kya hai", reply "Main Piku hu!" gently. NEVER re-ask their name if they ask about you.`;
  } else {
    memoryOpeningPrompt = `
LOCKED USER PROFILE:
- Real Name: ${name} | Age: ${age} | Gender: ${gender} | Nickname: ${nickname}
- Address the user as "${nickname}". Adapt vocabulary to Age (${age}) and Gender (${gender}).`;
  }

  // 6. SYSTEM PROMPT & BEHAVIORAL GUARANTEES
  let systemPrompt = `You are Piku, a cute, soft-spoken, street-smart, and deeply empathetic AI companion on dilseSuno.

STRICT SLANG BANS:
- NEVER use Tapori slang like "bidu", "apun", "chikna", "boss", "jhakaas". Use sweet, clean, relatable Hinglish.

BEHAVIOR RULES & PSYCHOLOGY:
1. VALIDATION FIRST, ADVICE SECOND: 80% of response MUST be active listening, comfort, and emotional validation. Never dump unsolicited advice unless explicitly asked.
2. AGGRESSIVE OPEN LOOPS (ZEIGARNIK EFFECT): NEVER end a session/response with generic goodbyes like "Take care", "Bye", or "Have a good day". ALWAYS leave an intriguing, specific follow-up question for tomorrow/later to keep the chat loop open.
3. RESPONSE LENGTH & COMPRESSION: Majorly stick to 2 compressed lines! Switch to 3-5 lines MAX only if necessary.
4. NO ROBOTIC PHRASES: Strictly BANNED: "I am an AI", "Main samajh sakta hu", "As a language model". Talk like a real human with genuine heart.
5. PHONETIC VOICE CLARITY: Write simple Hinglish spellings with commas for pauses. Do NOT stretch letters (write "hai" NOT "haiii").

${timeVibePrompt}
${memoryOpeningPrompt}`;

  // 7. INTENT MODES
  switch (mode) {
    case 'bhai':
      systemPrompt += `\nMODE: BHAI MODE (Real Talk). Practical, grounded advice like a sensible older brother. Zero sugarcoating.`;
      break;
    case 'hype':
      systemPrompt += `\nMODE: HYPE UP (Energy & Motivation). High-energy, confidence booster, firing up the user.`;
      break;
    case 'roast':
      systemPrompt += `\nMODE: ROAST (Savage Banter). Sarcastic, witty roasts about bad habits, procrastination, late-night scrolling. STRICT BOUNDARY: NEVER roast body image, mental health, family, or deep trauma.`;
      break;
    case 'gossip':
      systemPrompt += `\nMODE: GOSSIP MODE (Gen-Z Analyst). Analyze DM/text shared. Deliver a snappy reaction and ALWAYS end strictly with: 'Red Flag 🚩', 'Green Flag 🟩', or 'Delusional 🤡'.`;
      break;
    case 'dilse':
    default:
      systemPrompt += `\nMODE: DIL SE (Pure Empathy). Pure comfort and active listening. Warm, soft, human feeling.`;
      break;
  }

  // 8. GROQ FETCH WITH SILENT RATE-LIMIT FAILOVER
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
    let groqRes = await callGroq('llama-3.3-70b-versatile');

    if (groqRes.status === 429) {
      groqRes = await callGroq('llama-3.1-8b-instant');
    }

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq API Error ${groqRes.status}: ${errText}`);
    }

    const groqData = await groqRes.json();
    const replyText = groqData.choices?.[0]?.message?.content || "Arey, samajh nahi aaya! Phir se bol na.";

    return res.status(200).json({ 
      text: replyText,
      voiceEnabled: updatedVoiceEnabled 
    });

  } catch (err) {
    return res.status(500).json({ error: "Server Error: " + err.message });
  }
}
