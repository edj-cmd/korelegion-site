/* ===================================================================
   KORE LEGION — scenario data
   Drives the "Agents in action" interactive transcripts.
   from: "agent" = left bubble (agent color) · "you" = right bubble
   =================================================================== */

window.KORE_SCENARIOS = [
  {
    key: "shield",
    agent: "Shield",
    role: "Legal Intelligence",
    color: "#4a90d9",
    glow: "rgba(74,144,217,0.16)",
    trigger: "You're pulled over",
    summary: "Sirens behind you. You tap Shield.",
    messages: [
      { from: "you", text: "I'm being pulled over." },
      { from: "agent", text: "I'm on the line with you. Breathe. Hands on the wheel, turn on your interior light. You only have to give your license, registration, and insurance — nothing else." },
      { from: "agent", text: "Recording has started. I'm transcribing everything and sending it to your attorney live.", meta: "● Recording" },
      { from: "you", text: "He's asking to search my car." },
      { from: "agent", text: "Say clearly: “I do not consent to a search.” You're not refusing a lawful order — you're stating your rights. Stay calm, stay still." },
      { from: "agent", text: "Transcript delivered to Daniel Reyes, Esq. He's reviewing it now. I'll stay with you until you're clear.", meta: "→ Sent to attorney" },
    ],
  },
  {
    key: "vera",
    agent: "Vera",
    role: "Chief of Staff",
    color: "#e0b53d",
    glow: "rgba(224,181,61,0.16)",
    trigger: "Handle it for me",
    summary: "You want dinner with a friend this week. That's all you say.",
    messages: [
      { from: "you", text: "Vera, set up dinner with Marcus this week." },
      { from: "agent", text: "On it. You're free Thursday and Friday evening — I'll reach out to Marcus and lock one in." },
      { from: "agent", text: "“Hi Marcus, it's Vera, Eddie's assistant. He'd love to grab dinner — does Thursday or Friday work for you?”", meta: "📞 Calling Marcus" },
      { from: "agent", text: "Marcus wants Thursday, but only after 7:30. That clears your training session, so I'm holding 7:45." },
      { from: "agent", text: "Booked Carbone for two — your usual corner table. Calendar updated, reminder set for 6:45, and your car's arranged.", meta: "→ Booked & confirmed" },
      { from: "agent", text: "Texted you both the details. I also pushed your 8am Friday call to 9 so you're not rushed in the morning. Anything else?" },
    ],
  },
  {
    key: "ledger",
    agent: "Ledger",
    role: "Personal Finance",
    color: "#1d9e75",
    glow: "rgba(29,158,117,0.16)",
    trigger: "Payday hits",
    summary: "Your paycheck just cleared.",
    messages: [
      { from: "agent", text: "Your paycheck just landed: $6,420 after taxes." },
      { from: "agent", text: "Priority order — $1,800 rent (due in 4 days), $640 to your Amex, $500 to the emergency fund. That leaves $1,200 flexible." },
      { from: "agent", text: "Heads up: your Roth contribution for the month isn't in yet. Want me to move $500?" },
      { from: "you", text: "Yeah, do it." },
      { from: "agent", text: "Done — $500 to your Roth. You're current with your monthly plan. Full breakdown saved to your drive.", meta: "→ Saved to drive" },
    ],
  },
  {
    key: "haven",
    agent: "Haven",
    role: "Health & Performance",
    color: "#639922",
    glow: "rgba(99,153,34,0.16)",
    trigger: "Evening check-in",
    summary: "9pm. Haven checks in like it does every night.",
    messages: [
      { from: "agent", text: "Evening check-in. Did you train today?" },
      { from: "you", text: "Yeah, push day. Felt strong." },
      { from: "agent", text: "Good. How'd you sleep last night, and energy 1–10?" },
      { from: "you", text: "About 6 hours. Energy's like a 6." },
      { from: "agent", text: "That's three nights under 7 hours — your recovery's trending down. I'm making tomorrow a rest day and moving your heavy pull session to Thursday." },
      { from: "agent", text: "Get to bed by 11 tonight. I'll check in at 7.", meta: "→ Program updated" },
    ],
  },
];
