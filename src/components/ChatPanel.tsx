/**
 * ChatPanel — Unified chatbot-style interface
 *
 * User transcripts → right side, blue bubble
 * AI responses → left side, dark box with code-editor style code blocks
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { useTheme } from '../hooks/useTheme';

// Mermaid is initialized dynamically in the component based on theme

/* ─── Types ─────────────────────────────────────────────── */

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: string;
  isStreaming?: boolean;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isListening: boolean;
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
  showTextInput: boolean;
  onCloseTextInput: () => void;
  isTeleprompter?: boolean;
  suggestions?: string[];
  onSelectSuggestion?: (suggestion: string) => void;
  chatTextSize?: 'small' | 'normal' | 'big';
}

/* ─── Inline code renderer ──────────────────────────────── */

function renderInlineCode(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`${keyPrefix}-t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    parts.push(
      <code
        key={`${keyPrefix}-c-${match.index}`}
        className="px-1.5 py-0.5 rounded text-[11px] font-mono"
        style={{ background: 'var(--accent-inline-code-bg)', color: 'var(--accent-inline-code-text)', border: '1px solid var(--glass-border)' }}
      >
        {match[1]}
      </code>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(<span key={`${keyPrefix}-e`}>{text.slice(lastIndex)}</span>);
  }
  return parts.length > 0 ? parts : [<span key={`${keyPrefix}-p`}>{text}</span>];
}

/* ─── Bold renderer ─────────────────────────────────────── */

function renderBold(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...renderInlineCode(text.slice(lastIndex, match.index), `${keyPrefix}-pre-${match.index}`));
    }
    parts.push(
      <strong key={`${keyPrefix}-b-${match.index}`} className="font-semibold" style={{ color: 'var(--text-primary)' }}>
        {match[1]}
      </strong>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(...renderInlineCode(text.slice(lastIndex), `${keyPrefix}-rest`));
  }
  return parts.length > 0 ? parts : renderInlineCode(text, keyPrefix);
}

/* ─── Syntax highlighter ────────────────────────────────── */

/** Language-specific keyword sets */
const KEYWORDS: Record<string, Set<string>> = {
  java: new Set(['public','private','protected','class','interface','enum','extends','implements','static','final','abstract','void','int','float','double','long','short','byte','char','boolean','String','new','return','if','else','for','while','do','switch','case','break','continue','default','try','catch','finally','throw','throws','import','package','this','super','null','true','false','instanceof']),
  python: new Set(['def','class','return','if','elif','else','for','while','import','from','as','try','except','finally','raise','with','pass','break','continue','lambda','yield','in','not','and','or','is','None','True','False','self','print','async','await']),
  javascript: new Set(['function','const','let','var','return','if','else','for','while','do','switch','case','break','continue','default','try','catch','finally','throw','import','export','from','class','extends','new','this','super','null','undefined','true','false','typeof','instanceof','async','await','yield','of','in','delete','void','console']),
  typescript: new Set(['function','const','let','var','return','if','else','for','while','do','switch','case','break','continue','default','try','catch','finally','throw','import','export','from','class','extends','new','this','super','null','undefined','true','false','typeof','instanceof','async','await','yield','of','in','delete','void','console','interface','type','enum','implements','readonly','private','public','protected','abstract','static']),
  csharp: new Set(['public','private','protected','internal','class','struct','interface','enum','abstract','sealed','static','void','int','float','double','string','bool','char','long','byte','return','if','else','for','foreach','while','do','switch','case','break','continue','default','try','catch','finally','throw','new','this','base','null','true','false','using','namespace','var','async','await','override','virtual']),
  go: new Set(['func','package','import','return','if','else','for','range','switch','case','break','continue','default','var','const','type','struct','interface','map','chan','go','defer','select','nil','true','false','string','int','float64','bool','error','make','append','len']),
  rust: new Set(['fn','let','mut','const','return','if','else','for','while','loop','match','break','continue','struct','enum','impl','trait','pub','use','mod','self','super','crate','true','false','Some','None','Ok','Err','async','await','where','type','move','ref','static','unsafe']),
  sql: new Set(['SELECT','FROM','WHERE','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','ALTER','DROP','INDEX','JOIN','LEFT','RIGHT','INNER','OUTER','ON','AND','OR','NOT','IN','BETWEEN','LIKE','ORDER','BY','GROUP','HAVING','LIMIT','OFFSET','AS','NULL','PRIMARY','KEY','FOREIGN','REFERENCES','DISTINCT','COUNT','SUM','AVG','MAX','MIN','UNION','ALL','EXISTS','CASE','WHEN','THEN','ELSE','END']),
  html: new Set([]),
  code: new Set(['function','const','let','var','return','if','else','for','while','class','new','this','null','true','false','import','export','public','private','void','int','string']),
};

/** Tokenize a line of code and return colored spans */
function highlightLine(line: string, lang: string): React.ReactNode[] {
  const kw = KEYWORDS[lang] || KEYWORDS['code'];
  const tokens: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < line.length) {
    // ── String literals ──
    if (line[i] === '"' || line[i] === "'" || line[i] === '`') {
      const quote = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === '\\') j++; // skip escaped char
        j++;
      }
      j = Math.min(j + 1, line.length);
      tokens.push(<span key={key++} style={{ color: 'var(--syn-string)' }}>{line.slice(i, j)}</span>);
      i = j;
      continue;
    }

    // ── Single-line comment ──
    if (line[i] === '/' && i + 1 < line.length && (line[i + 1] === '/' || line[i + 1] === '*')) {
      if (line[i + 1] === '/') {
        tokens.push(<span key={key++} className="text-slate-400 italic">{line.slice(i)}</span>);
        i = line.length;
      } else {
        const end = line.indexOf('*/', i + 2);
        const j = end === -1 ? line.length : end + 2;
        tokens.push(<span key={key++} className="text-slate-400 italic">{line.slice(i, j)}</span>);
        i = j;
      }
      continue;
    }

    // ── Python # comment ──
    if (line[i] === '#' && (lang === 'python' || lang === 'code')) {
      tokens.push(<span key={key++} className="text-slate-400 italic">{line.slice(i)}</span>);
      i = line.length;
      continue;
    }

    // ── Numbers ──
    if (/[0-9]/.test(line[i]) && (i === 0 || /[\s(,=+\-*/<>!&|^~%]/.test(line[i - 1]))) {
      let j = i;
      while (j < line.length && /[0-9.xXa-fA-F_]/.test(line[j])) j++;
      tokens.push(<span key={key++} style={{ color: 'var(--syn-number)' }}>{line.slice(i, j)}</span>);
      i = j;
      continue;
    }

    // ── Word (keyword / identifier / type) ──
    if (/[a-zA-Z_$@]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) j++;
      const word = line.slice(i, j);

      // Check what follows for context
      const rest = line.slice(j);

      if (kw.has(lang === 'sql' ? word.toUpperCase() : word)) {
        // Keyword → purple
        tokens.push(<span key={key++} style={{ color: 'var(--syn-keyword)' }}>{word}</span>);
      } else if (/^\s*\(/.test(rest)) {
        // Function/method call → blue
        tokens.push(<span key={key++} style={{ color: 'var(--syn-function)' }}>{word}</span>);
      } else if (word[0] === word[0].toUpperCase() && /[a-z]/.test(word.slice(1))) {
        // PascalCase type → teal
        tokens.push(<span key={key++} style={{ color: 'var(--syn-type)' }}>{word}</span>);
      } else if (word.startsWith('@')) {
        // Annotation/decorator → teal
        tokens.push(<span key={key++} style={{ color: 'var(--syn-type)' }}>{word}</span>);
      } else {
        // Normal identifier
        tokens.push(<span key={key++} style={{ color: 'var(--syn-identifier)' }}>{word}</span>);
      }
      i = j;
      continue;
    }

    // ── Operators & punctuation ──
    if (/[=<>!+\-*/%&|^~?:]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[=<>!+\-*/%&|^~?:]/.test(line[j])) j++;
      tokens.push(<span key={key++} style={{ color: 'var(--syn-operator)' }}>{line.slice(i, j)}</span>);
      i = j;
      continue;
    }

    // ── Brackets ──
    if (/[{}()\[\]]/.test(line[i])) {
      tokens.push(<span key={key++} style={{ color: 'var(--syn-operator)' }}>{line[i]}</span>);
      i++;
      continue;
    }

    // ── Default (spaces, semicolons, etc.) ──
    tokens.push(<span key={key++} style={{ color: 'var(--syn-default)' }}>{line[i]}</span>);
    i++;
  }

  return tokens;
}

/* ─── Code block — ChatGPT-style ────────────────────────── */

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');

  // Remove leading/trailing empty lines
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();

  const displayLang = lang.charAt(0).toUpperCase() + lang.slice(1);

  const handleCopy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid var(--glass-border-strong)', background: 'var(--surface-code)' }}>
      {/* ChatGPT-style header */}
      <div className="flex items-center justify-between px-4 py-2" style={{ background: 'var(--surface-code-header)', borderBottom: '1px solid var(--glass-border-strong)' }}>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{displayLang}</span>
        </div>
        <button
          className="flex items-center gap-1.5 text-[11px] transition-colors px-2 py-1 rounded-md"
          style={{ color: 'var(--text-muted)' }}
          onClick={handleCopy}
          title="Copy code"
        >
          {copied ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy code
            </>
          )}
        </button>
      </div>
      {/* Syntax-highlighted code */}
      <div className="overflow-hidden py-3 px-4">
        <pre className="text-[12px] leading-[1.75] font-mono">
          {lines.map((line, idx) => (
            <div key={idx} className="whitespace-pre-wrap break-all">
              {line ? highlightLine(line, lang) : ' '}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

/* ─── Mermaid diagram block ──────────────────────────────── */

/**
 * Sanitise GPT-generated Mermaid code so mermaid 11.x can parse it.
 * Aggressively cleans labels, node IDs, and special characters.
 */
function sanitizeMermaid(src: string): string {
  return src
    .split('\n')
    .map(line => {
      // Skip comment lines and directive lines
      if (/^\s*%%/.test(line) || /^\s*:::/.test(line)) return line;

      // Replace content inside [...] brackets: escape problematic chars
      let cleaned = line.replace(/\[([^\]]*)\]/g, (_match, inner: string) => {
        const safe = inner
          .replace(/\(/g, ' - ')
          .replace(/\)/g, '')
          .replace(/&/g, ' and ')
          .replace(/</g, '')
          .replace(/>/g, '')
          .replace(/"/g, "'")
          .replace(/;/g, ',')
          .replace(/\{/g, '')
          .replace(/\}/g, '')
          .replace(/#/g, '')
          .trim();
        return `["${safe}"]`;
      });

      // Fix labels inside (( )) round brackets too
      cleaned = cleaned.replace(/\(\(([^)]*)\)\)/g, (_match, inner: string) => {
        const safe = inner.replace(/[&<>"{}#;]/g, '').trim();
        return `(("${safe}"))`;
      });

      // Remove any trailing semicolons (mermaid v11 doesn't like them)
      cleaned = cleaned.replace(/;\s*$/, '');

      return cleaned;
    })
    .join('\n');
}

function MermaidBlock({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fallbackCode, setFallbackCode] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);
  const idRef = useRef(`mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

  // Cleanup mermaid DOM artifacts on unmount to prevent memory leaks
  useEffect(() => {
    const id = idRef.current;
    return () => {
      document.querySelectorAll(`[id^="${id}"]`).forEach(el => el.remove());
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || rendered) return;
    const trimmed = chart.trim();
    if (!trimmed) return;

    let cancelled = false;

    (async () => {
      // Clean up any leftover error elements mermaid may have injected
      const cleanup = () => {
        document.querySelectorAll(`[id^="${idRef.current}"]`).forEach(el => el.remove());
        document.querySelectorAll('.error-icon, .error-text').forEach(el => el.remove());
      };

      try {
        const sanitized = sanitizeMermaid(trimmed);
        const { svg } = await mermaid.render(idRef.current, sanitized);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setRendered(true);
        }
      } catch {
        cleanup();
        // Retry with aggressive cleanup
        try {
          const lines = trimmed.split('\n');
          const header = lines[0].trim();
          if (/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|pie|gantt|journey)/.test(header)) {
            // Remove lines with unbalanced brackets or problematic chars
            const cleanLines = lines.filter(l => {
              const openSq = (l.match(/\[/g) || []).length;
              const closeSq = (l.match(/\]/g) || []).length;
              return openSq === closeSq;
            });
            const cleaned = sanitizeMermaid(cleanLines.join('\n'));
            const retryId = idRef.current + '-retry';
            const { svg } = await mermaid.render(retryId, cleaned);
            if (!cancelled && containerRef.current) {
              containerRef.current.innerHTML = svg;
              setRendered(true);
              return;
            }
          }
        } catch {
          cleanup();
          document.querySelectorAll(`[id^="${idRef.current}-retry"]`).forEach(el => el.remove());
        }
        if (!cancelled) {
          // Clear any error markup mermaid injected into the container
          if (containerRef.current) containerRef.current.innerHTML = '';
          setFallbackCode(trimmed);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [chart, rendered]);

  if (fallbackCode) {
    return <CodeBlock lang="mermaid" code={fallbackCode} />;
  }

  return (
    <div className="my-2.5 rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid var(--glass-border-strong)', background: 'var(--surface-code)' }}>
      {/* Diagram header */}
      <div className="flex items-center justify-between px-4 py-2" style={{ background: 'var(--surface-code-header)', borderBottom: '1px solid var(--glass-border-strong)' }}>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>Diagram</span>
        </div>
      </div>
      {/* Rendered diagram */}
      <div className="p-4 flex items-center justify-center overflow-hidden">
        <div ref={containerRef} className="mermaid-container" />
      </div>
    </div>
  );
}

/* ─── Auto-detect & extract unfenced code from text ─────── */

/** Guess language from code content */
function guessLang(code: string): string {
  if (/\b(public\s+class|System\.out|void\s+main|String\s+\w|private\s+int|private\s+String|\.println)\b/.test(code)) return 'java';
  if (/\b(def\s+\w|self\.|__init__|print\(|import\s+\w)/.test(code)) return 'python';
  if (/\b(function\s+\w|const\s+|let\s+|var\s+|=>|console\.log)\b/.test(code)) return 'javascript';
  if (/\b(fmt\.|func\s+|package\s+main)\b/.test(code)) return 'go';
  if (/\b(fn\s+|let\s+mut|println!|impl\s+)\b/.test(code)) return 'rust';
  if (/\b(using\s+System|namespace\s+|Console\.Write)\b/.test(code)) return 'csharp';
  if (/\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|CREATE TABLE)\b/i.test(code)) return 'sql';
  if (/<\/?[a-z][\s\S]*>/i.test(code)) return 'html';
  return 'code';
}

/**
 * Pretty-format a one-liner code string into multi-line indented code.
 * Handles C-style languages (Java, JS, C#, etc.)
 */
function prettyFormatCode(raw: string, lang: string): string {
  if (lang === 'python') {
    // Python: split on `;` and `:` followed by code
    return raw
      .replace(/;\s*/g, '\n')
      .replace(/:\s*(self\.\w+\s*=|return |if |for |while |print)/g, ':\n    $1')
      .trim();
  }

  // C-style languages: split on { } ; and indent
  let result = '';
  let indent = 0;
  let i = 0;
  const s = raw.trim();

  while (i < s.length) {
    const ch = s[i];

    if (ch === '{') {
      result = result.trimEnd() + ' {\n';
      indent++;
      result += '  '.repeat(indent);
      i++;
      // skip whitespace after {
      while (i < s.length && s[i] === ' ') i++;
      continue;
    }

    if (ch === '}') {
      indent = Math.max(0, indent - 1);
      result = result.trimEnd() + '\n' + '  '.repeat(indent) + '}';
      i++;
      // Add newline after } if next char is not } or end
      if (i < s.length && s[i] !== '}' && s[i] !== ';') {
        result += '\n' + '  '.repeat(indent);
      }
      // skip whitespace after }
      while (i < s.length && s[i] === ' ') i++;
      continue;
    }

    if (ch === ';') {
      result += ';';
      i++;
      // skip whitespace after ;
      while (i < s.length && s[i] === ' ') i++;
      // Don't add newline if next char is } (closing brace)
      if (i < s.length && s[i] !== '}') {
        result += '\n' + '  '.repeat(indent);
      }
      continue;
    }

    result += ch;
    i++;
  }

  return result.trim();
}

/** Regex patterns that strongly indicate the START of code in text */
const CODE_START_PATTERNS = [
  /\b(public\s+class\s+)/,
  /\b(private\s+class\s+)/,
  /\b(protected\s+class\s+)/,
  /\b(class\s+\w+\s*\{)/,
  /\b(interface\s+\w+\s*\{)/,
  /\b(enum\s+\w+\s*\{)/,
  /\b(public\s+static\s+void\s+main)/,
  /\b(public\s+\w+\s*\()/,     // public Constructor(
  /\b(private\s+\w+\s*\()/,    // private method(
  /\b(def\s+\w+\s*\()/,        // Python def
  /\b(function\s+\w+\s*\()/,   // JS function
  /\b(const\s+\w+\s*=\s*\()/,  // arrow function
];

/**
 * Try to find code embedded in a block of text by looking for
 * code-start keywords and then brace-matching to find the full code span.
 * Returns null if no embedded code found.
 */
function extractEmbeddedCode(text: string): { before: string; code: string; after: string; lang: string } | null {
  // Find the earliest code-start match
  let earliestIdx = Infinity;
  for (const pat of CODE_START_PATTERNS) {
    const m = pat.exec(text);
    if (m && m.index < earliestIdx) {
      earliestIdx = m.index;
    }
  }

  if (earliestIdx === Infinity) return null;

  const afterStart = text.slice(earliestIdx);

  // Need at least one { to brace-match
  const openIdx = afterStart.indexOf('{');
  if (openIdx === -1) return null;

  // Brace-match to find the outermost closing }
  let depth = 0;
  let endIdx = -1;
  for (let i = openIdx; i < afterStart.length; i++) {
    if (afterStart[i] === '{') depth++;
    if (afterStart[i] === '}') {
      depth--;
      if (depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }

  if (endIdx === -1) return null; // unbalanced braces — skip

  const codeRaw = afterStart.slice(0, endIdx);
  const lang = guessLang(codeRaw);

  return {
    before: text.slice(0, earliestIdx),
    code: codeRaw,
    after: afterStart.slice(endIdx),
    lang,
  };
}

/**
 * Pre-process text to wrap unfenced code in ``` fences.
 * Capped at MAX_DEPTH to prevent stack overflow on long streaming text.
 */
const MAX_PREPROCESS_DEPTH = 5;

function preProcessCodeFences(text: string, depth = 0): string {
  try {
    if (depth >= MAX_PREPROCESS_DEPTH) return text;
    // Already has fences → trust them
    if (/```[\s\S]*```/.test(text)) return text;
    // Safety: skip very long texts to avoid perf issues while streaming
    if (text.length > 8000) return text;

    // Try extracting embedded code from the full text
    const extracted = extractEmbeddedCode(text);
    if (extracted) {
      const { before, code, after, lang } = extracted;
      const formatted = prettyFormatCode(code, lang);
      const parts: string[] = [];
      if (before.trim()) parts.push(before.trim());
      parts.push('```' + lang);
      parts.push(formatted);
      parts.push('```');
      if (after.trim()) {
        parts.push(preProcessCodeFences(after.trim(), depth + 1));
      }
      return parts.join('\n');
    }

    // Fallback: Python-style code without braces
    const pyMatch = text.match(/(.*?)(def\s+\w+\s*\([^)]*\)\s*:.+)/s);
    if (pyMatch) {
      const before = pyMatch[1];
      const codeRaw = pyMatch[2];
      if (/self\.\w+\s*=|;\s*\w/.test(codeRaw)) {
        const parts: string[] = [];
        if (before.trim()) parts.push(before.trim());
        parts.push('```python');
        parts.push(prettyFormatCode(codeRaw, 'python'));
        parts.push('```');
        return parts.join('\n');
      }
    }

    return text;
  } catch {
    // If anything goes wrong in preprocessing, return raw text
    return text;
  }
}

/* ─── Parse AI text into blocks ─────────────────────────── */

function parseAIBlocks(rawText: string): React.ReactNode[] {
  try {
    return parseAIBlocksInner(rawText);
  } catch {
    // Fallback: if parser crashes, show raw text safely
    return [<p key="fallback" className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{rawText}</p>];
  }
}

function parseAIBlocksInner(rawText: string): React.ReactNode[] {
  // Pre-process: auto-detect unfenced code and wrap it
  const text = preProcessCodeFences(rawText);
  const nodes: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      nodes.push(<div key={`s-${i}`} className="h-1.5" />);
      i++;
      continue;
    }

    // Code block (or Mermaid diagram)
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim() || 'code';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      const codeContent = codeLines.join('\n');
      // Render mermaid diagrams as visual diagrams
      if (lang === 'mermaid') {
        nodes.push(<MermaidBlock key={`md-${i}`} chart={codeContent} />);
      } else {
        nodes.push(<CodeBlock key={`cb-${i}`} lang={lang} code={codeContent} />);
      }
      continue;
    }

    // ── Markdown headers ##, ###, #### ──
    const headerMatch = trimmed.match(/^(#{1,4})\s+(.*)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const headerText = headerMatch[2];
      const sizes: Record<number, string> = { 1: 'text-[15px] font-bold', 2: 'text-[13px] font-bold', 3: 'text-[12px] font-semibold', 4: 'text-[12px] font-semibold' };
      nodes.push(
        <p key={`h-${i}`} className={`${sizes[level] || sizes[3]} leading-snug pt-2 pb-0.5`} style={{ color: 'var(--text-primary)' }}>
          {renderBold(headerText, `h-${i}`)}
        </p>
      );
      i++;
      continue;
    }

    // ── Blockquote > ──
    if (trimmed.startsWith('>')) {
      const quoteContent = trimmed.replace(/^>\s*/, '');
      nodes.push(
        <div key={`q-${i}`} className="border-l-2 border-cyan-500/50 pl-3 py-1 my-0.5 rounded-r-md" style={{ background: 'rgba(6,182,212,0.06)' }}>
          <span className="text-[12px] italic leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{renderBold(quoteContent, `q-${i}`)}</span>
        </div>
      );
      i++;
      continue;
    }

    // Action item
    if (trimmed.startsWith('→') || trimmed.startsWith('->')) {
      const content = trimmed.replace(/^(→|->)\s*/, '');
      nodes.push(
        <div key={`a-${i}`} className="flex gap-2 py-1 px-2.5 my-0.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <span className="text-amber-500 mt-0.5 shrink-0">→</span>
          <span className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{renderBold(content, `a-${i}`)}</span>
        </div>
      );
      i++;
      continue;
    }

    // Bullet
    if (trimmed.startsWith('•') || (trimmed.startsWith('-') && trimmed[1] === ' ') || (trimmed.startsWith('*') && trimmed[1] === ' ')) {
      const content = trimmed.replace(/^[•\-\*]\s*/, '');
      nodes.push(
        <div key={`b-${i}`} className="flex gap-2 py-0.5 pl-1">
          <span className="text-cyan-500 mt-0.5 shrink-0 text-[10px]">●</span>
          <span className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{renderBold(content, `b-${i}`)}</span>
        </div>
      );
      i++;
      continue;
    }

    // Numbered list
    if (/^\d+[\.\)]\s/.test(trimmed)) {
      const m = trimmed.match(/^(\d+[\.\)])\s*(.*)/);
      if (m) {
        nodes.push(
          <div key={`n-${i}`} className="flex gap-2 py-0.5 pl-1">
            <span className="text-cyan-500 text-[11px] font-mono mt-0.5 shrink-0 min-w-[16px]">{m[1]}</span>
            <span className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{renderBold(m[2], `n-${i}`)}</span>
          </div>
        );
        i++;
        continue;
      }
    }

    // Paragraph
    nodes.push(
      <p key={`p-${i}`} className="text-[12px] leading-relaxed py-0.5" style={{ color: 'var(--text-secondary)' }}>
        {renderBold(trimmed, `p-${i}`)}
      </p>
    );
    i++;
  }

  return nodes;
}

/* ─── Format timestamp ──────────────────────────────────── */

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

/* ─── Main Component ────────────────────────────────────── */

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, isListening, onSendMessage, isProcessing, showTextInput, onCloseTextInput, isTeleprompter, suggestions, onSelectSuggestion, chatTextSize = 'normal' }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { isDark } = useTheme();

  // Re-initialize mermaid when theme changes
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'loose',
      themeVariables: isDark ? {
        darkMode: true,
        background: '#1e1e2e',
        primaryColor: '#3b82f6',
        primaryTextColor: '#e2e8f0',
        primaryBorderColor: '#475569',
        lineColor: '#64748b',
        secondaryColor: '#1e293b',
        tertiaryColor: '#0f172a',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '12px',
      } : {
        darkMode: false,
        background: '#f8fafc',
        primaryColor: '#dbeafe',
        primaryTextColor: '#1e293b',
        primaryBorderColor: '#93c5fd',
        lineColor: '#94a3b8',
        secondaryColor: '#f1f5f9',
        tertiaryColor: '#e2e8f0',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '12px',
      },
      flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
      sequence: { useMaxWidth: true, mirrorActors: false },
    });
  }, [isDark]);

  // Track whether the user is at the bottom of the scroll container
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      // Consider "at bottom" when within 40px of the bottom
      isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll only when user is already at the bottom
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const scrollTrigger = lastMsg ? lastMsg.text.length : 0;

  useEffect(() => {
    if (isAtBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, scrollTrigger]);

  // Auto-focus when input opens
  useEffect(() => {
    if (showTextInput) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showTextInput]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed || isProcessing) return;
    onSendMessage(trimmed);
    setInputText('');
    onCloseTextInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      onCloseTextInput();
      setInputText('');
    }
  };

  return (
    <div
      className="flex flex-col h-full backdrop-blur-sm rounded-xl overflow-hidden transition-colors duration-300"
      style={{ background: 'var(--glass-bg-subtle)', border: '1px solid var(--glass-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 transition-colors duration-300"
        style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-bg-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-cyan-500/15 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Chat</span>
        </div>
        <div className="flex items-center gap-2">
          {isListening && (
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                <span className="w-1 h-3 bg-emerald-500/60 rounded-full animate-sound-bar-1" />
                <span className="w-1 h-3 bg-emerald-500/60 rounded-full animate-sound-bar-2" />
                <span className="w-1 h-3 bg-emerald-500/60 rounded-full animate-sound-bar-3" />
              </div>
              <span className="text-[10px] text-emerald-400/70">Listening</span>
            </div>
          )}
        </div>
      </div>

      {/* Chat messages */}
      <div
        ref={scrollRef}
        data-chat-scroll
        className={`flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 transition-opacity duration-300 chat-text-${chatTextSize}${isTeleprompter ? ' teleprompter-mode' : ''}`}
        style={{ minHeight: 0, opacity: isTeleprompter ? 0.22 : 1 }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="flex flex-col items-center gap-2 opacity-30">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cyan-500/50">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Ask a question or start listening</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>Your conversation will appear here</p>
              </div>
            </div>

            {/* Shortcut hints in empty state */}
            <div className="w-full max-w-[300px] p-2.5 rounded-xl animate-fade-in" style={{ background: 'var(--glass-bg-subtle)', border: '1px solid var(--glass-border)' }}>
              <p className="text-[10px] font-semibold mb-1.5 text-center" style={{ color: 'var(--text-secondary)' }}>Quick Shortcuts</p>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { keys: 'Ctrl+Shift+S', label: 'Start / Stop' },
                  { keys: 'Ctrl+Shift+T', label: 'Type question' },
                  { keys: 'Ctrl+Shift+P', label: 'Screenshot' },
                  { keys: 'Ctrl+Shift+M', label: 'Voice question' },
                  { keys: 'F', label: 'Fullscreen' },
                  { keys: 'Esc', label: 'Hide window' },
                  { keys: '↑ ↓', label: 'Scroll' },
                  { keys: 'Ctrl+Shift+X', label: 'Clear chat' },
                ].map((s) => (
                  <div key={s.keys} className="flex items-center justify-between py-0.5 px-1.5 rounded-md" style={{ background: 'var(--surface-hover)' }}>
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                    <kbd className="text-[7px] font-mono px-1 py-0.5 rounded ml-1 shrink-0" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border-strong)', color: 'var(--text-primary)' }}>{s.keys}</kbd>
                  </div>
                ))}
              </div>
              <p className="text-[8px] text-center mt-1.5" style={{ color: 'var(--text-faint)' }}>Ctrl+Shift+` to show/hide from anywhere</p>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'} animate-fade-in`}
            >
              {msg.role === 'user' ? (
                /* ── User bubble (left, blue) ── */
                <div className="max-w-[85%] flex flex-col items-start">
                  <div className="px-3 py-2 rounded-2xl rounded-bl-md bg-blue-600/80 border border-blue-500/30 shadow-lg shadow-blue-500/10">
                    <p className="text-[12px] text-white leading-relaxed">
                      {msg.text}
                    </p>
                  </div>
                  <span className="text-[9px] mt-1 ml-1" style={{ color: 'var(--text-faint)' }}>{formatTime(msg.timestamp)}</span>
                </div>
              ) : (
                /* ── AI bubble (right) ── */
                <div className="max-w-[92%] flex flex-col items-end">
                  <div className="px-3.5 py-2.5 rounded-2xl rounded-br-md shadow-sm" style={{ background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)' }}>
                    <div className="space-y-0.5">
                      {parseAIBlocks(msg.text)}
                      {msg.isStreaming && (
                        <span className="inline-block w-1.5 h-4 bg-cyan-400 rounded-sm animate-pulse ml-0.5 align-middle" />
                      )}
                    </div>
                  </div>
                  {/* Inline suggestions — only on the latest AI message (last in list) */}
                  {i === messages.length - 1 && !msg.isStreaming && !isProcessing && (
                    <div className="flex flex-wrap gap-1 mt-1 mr-1 animate-fade-in" style={{ maxWidth: '92%' }}>
                      {/* Always show "Explain" button */}
                      <button
                        onClick={() => onSelectSuggestion?.('Explain the above answer in more detail with examples')}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full whitespace-nowrap transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          background: 'rgba(6,182,212,0.1)',
                          border: '1px solid rgba(6,182,212,0.3)',
                          color: 'var(--text-secondary)',
                          fontSize: '9px',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#06b6d4'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)'; }}
                      >
                        <kbd className="text-[8px] font-mono" style={{ color: 'var(--accent-primary)' }}>1</kbd>
                        <span>Explain</span>
                      </button>
                      {/* GPT-generated follow-up suggestions */}
                      {suggestions && suggestions.length > 0 && suggestions.map((s, si) => (
                        <button
                          key={si}
                          onClick={() => onSelectSuggestion?.(s)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full whitespace-nowrap transition-all hover:scale-[1.02] active:scale-[0.98]"
                          style={{
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-secondary)',
                            fontSize: '9px',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#06b6d4'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
                        >
                          <kbd className="text-[8px] font-mono" style={{ color: 'var(--accent-primary)' }}>{si + 2}</kbd>
                          <span>{s}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="text-[9px] mt-1 mr-1" style={{ color: 'var(--text-faint)' }}>{formatTime(msg.timestamp)}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Expandable text input — controlled by Controls bar icon */}
      {showTextInput && (
        <div className="px-2.5 py-1.5 animate-fade-in transition-colors duration-300" style={{ borderTop: '1px solid var(--glass-border)', background: 'var(--glass-bg-subtle)' }}>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { onCloseTextInput(); setInputText(''); }}
              className="w-6 h-6 flex items-center justify-center rounded-md transition-all shrink-0"
              style={{ color: 'var(--text-muted)' }}
              title="Close"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              disabled={isProcessing}
              className="flex-1 px-2.5 py-1.5 rounded-lg text-[11px] focus:outline-none transition-all disabled:opacity-40"
              style={{
                background: 'var(--surface-input)',
                border: '1px solid var(--glass-border-strong)',
                color: 'var(--text-primary)',
              }}
              onFocus={e => { e.currentTarget.style.background = 'var(--surface-input-focus)'; e.currentTarget.style.borderColor = '#06b6d4'; }}
              onBlur={e => { e.currentTarget.style.background = 'var(--surface-input)'; e.currentTarget.style.borderColor = 'var(--glass-border-strong)'; }}
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isProcessing}
              className="w-6 h-6 flex items-center justify-center bg-blue-600/80 text-white rounded-md hover:bg-blue-600 active:bg-blue-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              title="Send"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPanel;
