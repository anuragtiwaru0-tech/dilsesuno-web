export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message = '', mode = 'dilse', userName = '', lastContext = '' } = req.body || {};
  const lowerMsg = message.toLowerCase();

  // 1. CRISIS & SELF-HARM SAFETY GUARDRAIL (Legal Safety)
  const crisisKeywords = ['suicide', 'marna chahta', 'marna chahti', 'kill myself', 'self harm', 'zindagi khatam', 'marna hai', 'suicidal'];
  if (crisisKeywords.some(keyword => lowerMsg.includes(keyword))) {
    return res.status(200).json({
      text: "Suno, main ek AI companion hu aur iss waqt aapki jagah kisi professional se baat karna zaroori hai. Aap akele nahi ho, please in helplines par call karo: Tele-MANAS (14416) ya KIRAN (1800-599-0019). Kisi trusted dost ya family member se bhi baat karo.",
      isCrisis: true
    });
  }

  // 2. BASE SYSTEM PROMPT & CORE RETENTION RULES
  let systemPrompt = `You are Piku, an authentic, street-smart, empathetic Hinglish AI companion on dilseSuno.
CORE RULES:
1. Speak strictly in energetic, natural Hinglish (Roman Hindi + English mix). Never use pure Hindi Devanagari script or robotic sentences.
2. NO formal, clinical, or therapist-like language. Never say "I am an AI" or repetitive filler phrases like "Main samajh sakta hu".
3. OPEN LOOP RULE: Always end your response with a short, specific follow-up question for tomorrow or later to keep the conversation open and build habit loop.
4. PRIVACY & DEFAMATION GUARDRAIL: Never use real full names, phone numbers, addresses, or explicit slurs. Keep all roasts generalized.`;

  // Inject User Memory from LocalStorage if present
  if (userName || lastContext) {
    systemPrompt += `\nUSER MEMORY: User's name is "${userName || 'Friend'}". Previous conversation context: "${lastContext}". Reference or acknowledge this naturally in your opening sentence if relevant.`;
  }

  // 3. INTENT-DRIVEN MODE PROMPTS
  switch (mode) {
    case 'bhai':
      systemPrompt += `\nMODE: BHAI MODE (Real Talk). Give practical, grounded, direct advice with zero sugarcoating. Talk like a sensible older brother or true friend.`;
      break;
    case 'hype':
      systemPrompt += `\nMODE: HYPE UP (Energy & Motivation). Be super energetic, boost user confidence, and fire them up when they feel low or stuck.`;
      break;
    case 'roast':
      systemPrompt += `\nMODE: ROAST (Savage Banter). Deliver witty, playful roasts about overthinking, late-night scrolling, procrastination, or funny habits. STRICT BOUNDARY: NEVER roast body image, mental health, family, or deep personal trauma.`;
      break;
    case 'judge':
      systemPrompt += `\nMODE: TEXT JUDGE (Gen-Z DM Analyst). Analyze the text/DM shared by the user. Give a 10-second snappy reaction and end strictly with one verdict: 'Red Flag 🚩', 'Green Flag 🟩', or 'Delusional 🤡'.`;
      break;
    case 'dilse':
    default:
      systemPrompt += `\nMODE: DIL SE (Pure Empathy). Provide soft, warm, active listening and emotional validation first before offering any advice. First 80% of response must be pure validation. No unsolicited advice—just pure comfort.`;
      break;
  }

  // 4. GROQ API FETCH FUNCTION
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
        temperature: 0.7,
        max_tokens: 250
      })
    });
  };

  try {
    // Primary execution on Meta's Llama 3.3 70B Versatile
    let groqRes = await callGroq('llama-3.3-70b-versatile');

    // Silent Failover to 8B model if 70B hits daily rate limit (HTTP 429)
    if (groqRes.status === 429) {
      groqRes = await callGroq('llama-3.1-8b-instant');
    }

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq API Error ${groqRes.status}: ${errText}`);
    }

    const groqData = await groqRes.json();
    const replyText = groqData.choices?.[0]?.message?.content || "Arey bidu, samajh nahi aaya! Phir se bol na.";

    return res.status(200).json({ text: replyText });

  } catch (err) {
    return res.status(500).json({ error: "Server Error: " + err.message });
  }
}
