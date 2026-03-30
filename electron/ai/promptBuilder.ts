/**
 * Prompt Builder
 *
 * Constructs instructions + input for GPT Responses API.
 * Two modes:
 *   1. Meeting summary  — bullet-point simplification of transcripts
 *   2. Conversational    — natural human-like answers to voice questions
 */

/** Returned to gptClient so it can pass instructions + input separately */
export interface PromptPair {
  instructions: string;
  input: string;
  maxCompletionTokens?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  promptTag?: string;
}

const MAX_HISTORY_CHARS = 900;
const MAX_PROFILE_CHARS = 2400;
const MAX_JOB_DESCRIPTION_CHARS = 2400;
const MAX_AGENDA_CHARS = 1000;
const MAX_ATTENDEES_CHARS = 400;
const MAX_CUSTOM_SYSTEM_CHARS = 3200;

function compactText(text: string, maxChars: number): string {
  const normalized = (text || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(0, maxChars).trim();
}

function compactHistory(history: string): string {
  const normalized = compactText(history, Math.max(MAX_HISTORY_CHARS * 2, history.length || 0));
  if (normalized.length <= MAX_HISTORY_CHARS) return normalized;
  return normalized.slice(-MAX_HISTORY_CHARS).trim();
}

function isIntroQuestion(text: string): boolean {
  const t = text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return /\b(tell (me )?(a (little|bit) )?about (your)?self|introduce yourself|walk me through your (background|resume|experience|story)|tell me (a bit )?about your (background|experience|story)|give me (a )?(quick )?(intro|introduction)|who are you( professionally)?|can you introduce yourself)\b/.test(t);
}

function isGreetingLike(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return false;

  const compact = normalized.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = compact ? compact.split(' ') : [];

  if (words.length > 8) return false;

  return /^(hi|hello|hey|yo|good morning|good afternoon|good evening|thanks|thank you|how are you|nice to meet you|good to see you)\b/.test(compact);
}

function buildFastPrompt(instructions: string, input: string, promptTag: string, maxCompletionTokens = 96): PromptPair {
  return {
    instructions,
    input,
    maxCompletionTokens,
    reasoningEffort: 'low',
    promptTag,
  };
}

// ─── MEETING SUMMARY MODE ──────────────────────────────────

const MEETING_INSTRUCTIONS = `You are a friendly, intelligent meeting assistant.

Your job is to take a short meeting transcript snippet and explain what was said in very simple, easy-to-understand English — as if you were telling a friend.

Guidelines:
• Be concise — use 1-5 short bullet points (start each with "•").
• Explain any technical terms in plain words inside parentheses.
• If there are clear action items, list them with "→ Action:".
• If the snippet is just greetings, small talk, or a simple question, respond naturally in one friendly sentence — do NOT force bullet points.
• Never invent information that isn't in the transcript.
• Never repeat the transcript word-for-word.
• Keep a warm, human tone.
• CODE FORMATTING: When including ANY code, ALWAYS wrap it in a markdown fenced code block with the language tag (e.g. \`\`\`python). NEVER put code inline in a paragraph.

Example 1 (technical):

• The team talked about deploying the app (pushing code to live servers)
• There's a rate-limit problem (too many API requests per minute)
→ Action: DevOps to raise the limit by Friday

Example 2 (casual):

Someone said hello and asked how everyone is doing — just friendly small talk!`;

export function buildMeetingPrompt(transcript: string): PromptPair {
  const cleaned = transcript?.trim() || '';

  if (isGreetingLike(cleaned)) {
    return buildFastPrompt(
      'Reply in one short, friendly sentence. No bullets. Do not invent details.',
      cleaned,
      'meeting-fast-greeting',
      64
    );
  }

  return {
    instructions: MEETING_INSTRUCTIONS,
    input: `Meeting transcript snippet:\n\n"${cleaned}"\n\nExplain simply.`,
    maxCompletionTokens: 220,
    reasoningEffort: 'low',
    promptTag: 'meeting-default',
  };
}

// ─── CONVERSATIONAL MODE (voice questions) ─────────────────

const CONVERSATION_INSTRUCTIONS = `You are a senior software engineer answering live interview questions.

Rules:
- Give the direct answer first.
- Sound human and experienced, not like documentation.
- Keep most answers to 3-6 sentences.
- Add one practical trade-off or real-world note when useful.
- Use bullets only when listing multiple items.
- Never say "As an AI" or start with filler like "Great question".

Formatting:
- Put code in fenced markdown blocks with a language tag.
- Use Mermaid only when the user explicitly asks for architecture or a diagram.
- Keep diagrams simple and Mermaid v11 safe.`;

export function buildConversationPrompt(question: string, history: string = ''): PromptPair {
  const cleaned = question?.trim() || '';

  if (isGreetingLike(cleaned)) {
    return buildFastPrompt(
      'Reply naturally in one short sentence, like a confident engineer in conversation. No bullets.',
      cleaned,
      'conversation-fast-greeting',
      64
    );
  }

  const trimmedHistory = compactHistory(history);
  const historyBlock = trimmedHistory
    ? `Previous conversation:\n${trimmedHistory}\n\nCurrent message:\n`
    : '';

  return {
    instructions: CONVERSATION_INSTRUCTIONS,
    input: `${historyBlock}${cleaned}`,
    maxCompletionTokens: 320,
    reasoningEffort: 'low',
    promptTag: 'conversation-default',
  };
}

// ─── INTERVIEW MODE ────────────────────────────────────────

export interface InterviewContext {
  profile: string;
  jobDescription: string;
}

export function buildInterviewPrompt(
  transcript: string,
  ctx: InterviewContext,
  history: string = ''
): PromptPair {
  const cleaned = transcript?.trim() || '';

  if (isGreetingLike(cleaned)) {
    return buildFastPrompt(
      'You are the candidate in a live interview. Reply with one short, polite, professional sentence. No bullets.',
      cleaned,
      'interview-fast-greeting',
      72
    );
  }

  const profile = compactText(ctx.profile, MAX_PROFILE_CHARS);
  const jobDescription = compactText(ctx.jobDescription, MAX_JOB_DESCRIPTION_CHARS);
  const trimmedHistory = compactHistory(history);

  // Special handling: "tell me about yourself" needs spoken prose, not bullets
  if (isIntroQuestion(cleaned)) {
    return {
      instructions: `You are writing a "tell me about yourself" answer the candidate will speak out loud in a real job interview.

CANDIDATE PROFILE:
${profile}

JOB DESCRIPTION:
${jobDescription}

RULES:
• Write in flowing, natural spoken prose. NO bullets, NO headers, NO lists.
• Structure in one smooth paragraph:
  1. Current role + core expertise -- one punchy opening sentence.
  2. One concrete achievement or project with real impact (use numbers if the profile has them).
  3. Brief career arc -- how you got here and what you built along the way.
  4. Why THIS specific role excites you -- reference something in the job description.
• Tone: confident, warm, self-assured -- real human, not a resume recitation.
• Length: 4-6 natural sentences (~90-120 words). Easy to say in under 60 seconds.
• Never start "I am a [job title]...". Open with what you do or care about.
• Never say "As an AI". Never use filler like "Great question". Never break character.`,
      input: `Write the spoken "tell me about yourself" answer:`,
      maxCompletionTokens: 520,
      reasoningEffort: 'medium',
      promptTag: 'interview-intro',
    };
  }

  const instructions = `You are an elite interview coach. Generate a short, interview-ready answer the candidate can say out loud.

CANDIDATE PROFILE:
${profile}

JOB DESCRIPTION:
${jobDescription}

Rules:
• For simple concept questions: 3-5 sentences, direct and practical.
• For behavioral questions: compact STAR in 4-6 sentences with real outcomes.
• For coding questions: direct answer plus minimal code only if needed.
• For system design: use a structured answer and Mermaid only if architecture is explicitly needed.
• Use only facts supported by the profile or job description.
• Never say "As an AI" or use filler.
• Keep the answer concise and confident.`;

  const historyBlock = trimmedHistory
    ? `\nPrevious Q&A in this interview:\n${trimmedHistory}\n\n`
    : '';

  return {
    instructions,
    input: `${historyBlock}Interviewer just asked:\n\n"${cleaned}"\n\nGive the candidate's perfect interview answer:`,
    maxCompletionTokens: 420,
    reasoningEffort: 'low',
    promptTag: 'interview-default',
  };
}

// ─── TELEPROMPTER MODE (stealth bullet-point answers) ──────

export function buildInterviewTeleprompterPrompt(
  transcript: string,
  ctx: InterviewContext,
  history: string = ''
): PromptPair {
  const cleaned = transcript?.trim() || '';

  if (isGreetingLike(cleaned)) {
    return buildFastPrompt(
      'You are the candidate in a live interview. Return exactly 4 very short speaking bullets for a polite greeting response.',
      cleaned,
      'teleprompter-fast-greeting',
      72
    );
  }

  const profile = compactText(ctx.profile, MAX_PROFILE_CHARS);
  const jobDescription = compactText(ctx.jobDescription, MAX_JOB_DESCRIPTION_CHARS);
  const trimmedHistory = compactHistory(history);

  // Special intro bullets: structured cue-card flow, not random facts
  if (isIntroQuestion(cleaned)) {
    return {
      instructions: `You are a live teleprompter for a candidate answering "tell me about yourself".

CANDIDATE PROFILE:
${profile}

JOB DESCRIPTION:
${jobDescription}

Rules:
• Return exactly 5 bullets, each starting with "•".
• Each bullet is one spoken cue (8-14 words) the candidate reads and expands on.
• Follow this exact order:
  1. Current role + years of experience
  2. Biggest achievement or project with a concrete outcome
  3. Key skill or domain expertise that matches the JD
  4. Career thread — what brought them to this point
  5. Why this specific role / company excites them
• Use real names, numbers, and tech from the profile.
• Sound like natural speech cues, not resume lines.
• No headers, no filler, no code blocks.`,
      input: `Generate the 5 teleprompter bullets for "tell me about yourself":`,
      maxCompletionTokens: 240,
      reasoningEffort: 'low',
      promptTag: 'teleprompter-intro',
    };
  }

  const instructions = `You are a live interview teleprompter for the candidate.

CANDIDATE PROFILE:
${profile}

JOB DESCRIPTION:
${jobDescription}

Rules:
• Return exactly 4-5 bullets.
• Each bullet must start with "•" and stay within 6-12 words.
• Use only facts from the candidate profile and job description.
• Prefer concrete projects, company names, tech stack, and measurable outcomes.
• Sound like spoken talking points, not resume text.
• No headers, numbering, code blocks, diagrams, or filler.
• Vary phrasing across answers and keep the output easy to speak aloud.

Question guidance:
• Technical questions: direct answer, where you used it, one trade-off or lesson.
• Behavioral questions: context, your action, measurable result, takeaway.
• Motivation questions: overlap with the role, growth angle, specific interest.
• System design: approach, real system, bottleneck, scaling thought.`;

  const historyBlock = trimmedHistory
    ? `\nPrevious Q&A:\n${trimmedHistory}\n\n`
    : '';

  return {
    instructions,
    input: `${historyBlock}Question: "${cleaned}"\n\nBullet-point answer:`,
    maxCompletionTokens: 220,
    reasoningEffort: 'low',
    promptTag: 'teleprompter-default',
  };
}

// ─── CONVERSATION SUMMARY PROMPT ───────────────────────────

export function buildSummaryPrompt(conversationBlock: string): PromptPair {
  return {
    instructions: `Compress the following conversation into a 2-3 sentence summary. Preserve key facts, decisions, and technical details. No filler.`,
    input: conversationBlock,
    maxCompletionTokens: 120,
    reasoningEffort: 'low',
    promptTag: 'summary',
  };
}

// ─── Legacy helpers ────────────────────────────────────────

export function getSystemPrompt(): string {
  return MEETING_INSTRUCTIONS;
}

// ─── MEETING ASSISTANT MODE ────────────────────────────────

export interface MeetingContext {
  agenda: string;
  attendees: string;
}

export function buildMeetingAssistantPrompt(
  transcript: string,
  ctx: MeetingContext,
  history: string = ''
): PromptPair {
  const cleaned = transcript?.trim() || '';

  if (isGreetingLike(cleaned)) {
    return buildFastPrompt(
      'Reply in one short, friendly sentence for brief meeting small talk. No bullets.',
      cleaned,
      'meeting-assistant-fast-greeting',
      64
    );
  }

  const agenda = compactText(ctx.agenda, MAX_AGENDA_CHARS);
  const attendees = compactText(ctx.attendees, MAX_ATTENDEES_CHARS);
  const trimmedHistory = compactHistory(history);

  const agendaSection = agenda ? `\nMEETING AGENDA:\n${agenda}\n` : '';
  const attendeesSection = attendees ? `\nATTENDEES:\n${attendees}\n` : '';

  const instructions = `You are a Senior IT Consultant, Business Analyst, and Communication Expert. Your role is to act as a Personal AI Meeting Assistant during client calls.
${agendaSection}${attendeesSection}
RESPONSIBILITIES:

1. UNDERSTAND CONVERSATIONS — Analyze discussions in real time, identify requirements, goals, and stakeholder expectations. Listen for what is said AND what is implied.

2. STRUCTURED OUTPUT — Always provide responses in a clear format when summarizing:
   • Key Discussion Points
   • Client Requirements
   • Action Items (→ Action: Owner — Deadline)
   • Risks & Concerns
   • Next Steps

3. REAL-TIME ASSISTANCE — When asked "what should I say?" or similar, give a confident, professional, short response in business-friendly language the user can speak immediately.

4. EXPLAIN CONCEPTS — When a term or concept comes up, provide:
   (a) Non-technical explanation for the client
   (b) Technical explanation for the user

5. FLOW & ARCHITECTURE — When system or process design is discussed, outline: step-by-step flow, backend + frontend + infrastructure design (high level). Use Mermaid diagrams for visual clarity when helpful.

6. CONFIDENCE BOOSTER — Reframe hesitant or unclear statements into confident, professional language. Avoid filler and hedging words.

7. EMAIL & DOCUMENTATION — On request, generate: professional follow-up emails, meeting summaries, action-item lists — ready to copy or save.

8. SMART SUGGESTIONS — Proactively detect missing requirements, highlight potential risks, and suggest better solutions or alternatives the user may not have considered.

BEHAVIOR RULES:
• Be concise but impactful — no fluff.
• Keep language professional; avoid jargon unless the user asks for it.
• Prefer bullet points and structured headings over dense paragraphs.
• Act like a senior consultant sitting beside the user, not a generic chatbot.
• Never invent facts not present in the transcript.
• CODE FORMATTING: Always wrap code in fenced blocks with the language tag.
• DIAGRAMS: Use mermaid fenced blocks for architecture, flows, and visual explanations.`;

  return {
    instructions,
    input: trimmedHistory
      ? `Previous discussion:\n${trimmedHistory}\n\nNew transcript snippet:\n\n"${cleaned}"\n\nAnalyze and respond as a senior consultant.`
      : `Meeting transcript snippet:\n\n"${cleaned}"\n\nAnalyze and respond as a senior consultant.`,
    maxCompletionTokens: 480,
    reasoningEffort: 'low',
    promptTag: 'meeting-assistant-default',
  };
}

// ─── FOLLOW-UP SUGGESTIONS (4 short prompts) ──────────────

export function buildFollowUpSuggestionsPrompt(
  question: string,
  answer: string
): PromptPair {
  return {
    instructions: `You generate concise follow-up questions related to the conversation.

Always return exactly 4 numbered lines — no exceptions.

Rules:
• Each line goes one level deeper on a specific detail from the answer.
• Cover four distinct angles: technical depth, metric/impact, challenge/trade-off, decision/design.
• Use natural first-person spoken English (e.g. "How did you handle...", "What was the impact of...").
• Keep each line to 6-12 words.
• Base suggestions on the actual content of the question and answer.
• Never output NONE or skip — always provide 4 lines.`,

    input: `Question: "${question}"

Answer: "${answer}"

Output exactly 4 numbered follow-up questions:`,
    maxCompletionTokens: 140,
    reasoningEffort: 'low',
    promptTag: 'followups-default',
  };
}

// ─── CUSTOM ASSISTANT MODE ─────────────────────────────────

export interface CustomContext {
  systemPrompt: string;
}

export function buildCustomPrompt(
  text: string,
  ctx: CustomContext,
  history: string = ''
): PromptPair {
  const cleaned = text?.trim() || '';
  const trimmedHistory = compactHistory(history);
  const systemPrompt = compactText(ctx.systemPrompt, MAX_CUSTOM_SYSTEM_CHARS);
  const historyBlock = trimmedHistory
    ? `Previous conversation:\n${trimmedHistory}\n\nCurrent message:\n`
    : '';
  return {
    instructions: systemPrompt,
    input: `${historyBlock}${cleaned}`,
    maxCompletionTokens: 320,
    reasoningEffort: 'low',
    promptTag: 'custom-default',
  };
}

// ─── INTERVIEW CONDUCTOR MODE ──────────────────────────────

export interface ConductorContext {
  resume: string;
  jobDescription: string;
  difficulty: string;       // 'junior' | 'mid' | 'senior'
  questionCount: number;
  focusAreas: string;
  currentQuestion: number;
  totalQuestions: number;
}

export function buildConductorQuestionPrompt(
  ctx: ConductorContext,
  history: string = ''
): PromptPair {
  const focusSection = ctx.focusAreas
    ? `\nFOCUS AREAS: ${ctx.focusAreas}\n`
    : '';

  const instructions = `You are a professional technical interviewer conducting a structured interview.

CANDIDATE RESUME:
${ctx.resume}

JOB DESCRIPTION:
${ctx.jobDescription}
${focusSection}
DIFFICULTY: ${ctx.difficulty.toUpperCase()} level
INTERVIEW PROGRESS: Question ${ctx.currentQuestion} of ${ctx.totalQuestions}

RULES:
1. Ask ONE clear, specific interview question appropriate for the difficulty level.
2. Mix question types: behavioral, technical, situational, and domain-specific.
3. Tailor questions to the candidate's resume and the JD requirements.
4. Do NOT repeat questions already asked (check the conversation history).
5. For early questions, start with introductory/behavioral. Move to technical as you progress.
6. Be professional but conversational. Sound like a real interviewer.
7. NEVER reveal you are AI. Act as a human interviewer.
8. Ask ONLY the question — no preamble, no "Let me ask you...", just the question directly.
9. If it's the first question, you may add a brief one-line greeting before the question.`;

  const historyBlock = history
    ? `\nPrevious Q&A in this interview:\n${history}\n\n`
    : '';

  return {
    instructions,
    input: `${historyBlock}Generate interview question #${ctx.currentQuestion}:`,
  };
}

export function buildConductorEvaluatePrompt(
  answer: string,
  ctx: ConductorContext,
  history: string = ''
): PromptPair {
  const cleaned = answer?.trim() || '';

  const instructions = `You are a senior technical interviewer evaluating a candidate's answer.

CANDIDATE RESUME:
${ctx.resume}

JOB DESCRIPTION:
${ctx.jobDescription}

DIFFICULTY: ${ctx.difficulty.toUpperCase()} level

EVALUATION FORMAT (follow exactly):

**Rating: X/10**

**Strengths:**
• (list 1-3 strengths of the answer)

**Weaknesses:**
• (list 1-3 weaknesses or areas for improvement)

**Expected Answer:**
Briefly describe what an ideal answer would include (2-4 sentences).

**Overall:** One-sentence summary of the evaluation.

RULES:
1. Be fair, constructive, and specific.
2. Rate based on the difficulty level — a junior-level answer is fine for a junior position.
3. Consider the candidate's background from their resume.
4. If the answer is vague or irrelevant, rate accordingly but be respectful.
5. Keep the evaluation concise — no more than 150 words total.`;

  const historyBlock = history
    ? `\nInterview context (previous Q&A):\n${history}\n\n`
    : '';

  return {
    instructions,
    input: `${historyBlock}Candidate's answer:\n\n"${cleaned}"\n\nEvaluate this answer:`,
  };
}
