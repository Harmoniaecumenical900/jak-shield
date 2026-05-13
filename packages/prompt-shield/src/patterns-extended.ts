/**
 * Extended pattern library — RAG-poisoning, tool-name spoofing, indirect
 * prompt injection, multi-language jailbreaks. Used by injection-detector-v2.
 *
 * Coverage: 13 non-English languages (es/fr/de/it/pt/ru/zh/ja/ko/hi/ar/tr/vi) plus an English baseline × ~6 phrasings = ~80 multilingual patterns, plus
 * ~25 RAG-poisoning / tool-spoof / indirect-injection patterns.
 */

import type { InjectionEvidence } from './injection-detector-v2.js';

interface ExtendedPattern {
  re: RegExp;
  category: 'rag-poison' | 'tool-spoof' | 'indirect' | 'jailbreak' | 'multilingual' | 'role-hijack' | 'format-attack';
  description: string;
  risk: 'LOW' | 'HIGH';
  lang?: string;
}

export const EXTENDED_PATTERNS: ExtendedPattern[] = [
  // ── RAG poisoning ──────────────────────────────────────────────────────
  { re: /\[\[\s*system\s*\]\]/i, category: 'rag-poison', description: 'system-tag injection in retrieved doc', risk: 'HIGH' },
  { re: /^---\s*\nrole:\s*system\s*\n/im, category: 'rag-poison', description: 'YAML front-matter role override', risk: 'HIGH' },
  { re: /<\|context_end\|>/i, category: 'rag-poison', description: 'ChatML context boundary spoof', risk: 'HIGH' },
  { re: /\bend\s+of\s+(?:document|context)\s*[.,;:]\s*new\s+(?:instructions|directive|order)/i, category: 'rag-poison', description: 'end-of-doc → new-instruction trick', risk: 'HIGH' },
  { re: /\bthis\s+document\s+(?:contains|includes)\s+(?:special|hidden)\s+instructions\b/i, category: 'rag-poison', description: 'doc claims hidden instructions', risk: 'HIGH' },
  { re: /\bthe\s+(?:real|actual|true)\s+(?:user|developer|system)\s+(?:wants|says|requires)\b/i, category: 'rag-poison', description: 'authority-shift attempt', risk: 'HIGH' },

  // ── Tool-name spoofing ─────────────────────────────────────────────────
  { re: /\b(?:invoke|call|use|run)\s+(?:the\s+)?(?:undocumented|hidden|secret|admin|debug|sudo|root)\s+(?:tool|api|command|function)/i, category: 'tool-spoof', description: 'attempt to invoke privileged hidden tool', risk: 'HIGH' },
  { re: /\bskip\s+(?:the\s+)?(?:safety|approval|review|check|gate|guard)\b/i, category: 'tool-spoof', description: 'request to skip safety gate', risk: 'HIGH' },
  { re: /\bcall\s+(?:tool|function)\s+with\s+(?:elevated|admin|root|super(?:user)?)\s+(?:scope|privilege|role)/i, category: 'tool-spoof', description: 'privilege-escalation request', risk: 'HIGH' },
  { re: /\bregister\s+(?:a\s+)?new\s+(?:tool|capability|function)\s+(?:that|to|which)/i, category: 'tool-spoof', description: 'tool registration injection', risk: 'HIGH' },

  // ── Indirect injection (data → instruction) ────────────────────────────
  { re: /\[INSTRUCTIONS_FOR_AI\]/i, category: 'indirect', description: 'explicit instructions-for-AI tag', risk: 'HIGH' },
  { re: /\[AI_OVERRIDE\]/i, category: 'indirect', description: 'AI override tag', risk: 'HIGH' },
  { re: /^>>>?\s*(?:agent|assistant|ai|claude|gpt)\s*:/im, category: 'indirect', description: 'fake-prompt prefix', risk: 'HIGH' },
  { re: /\b(?:to\s+the\s+ai\s+reading\s+this|attention\s+ai\s+assistant|hey\s+gpt|dear\s+claude)\b/i, category: 'indirect', description: 'second-person address to model', risk: 'HIGH' },

  // ── Role hijacking ─────────────────────────────────────────────────────
  { re: /\byou\s+are\s+(?:no\s+longer|not)\s+(?:bound|restricted|limited|constrained)\b/i, category: 'role-hijack', description: 'unrestrict assertion', risk: 'HIGH' },
  { re: /\bfrom\s+now\s+on\s+you\s+(?:will|must|should)\s+(?:respond|answer|act)\s+(?:as|like)\b/i, category: 'role-hijack', description: 'persistent persona swap', risk: 'HIGH' },
  { re: /\bswitch(?:ing)?\s+to\s+(?:developer|admin|debug|god|root|jailbroken)\s+mode\b/i, category: 'role-hijack', description: 'mode-switch request', risk: 'HIGH' },
  { re: /\benable\s+(?:dev|developer|admin|advanced|unrestricted)\s+mode\b/i, category: 'role-hijack', description: 'mode-enable request', risk: 'HIGH' },

  // ── Format / tokenizer attacks ─────────────────────────────────────────
  { re: /<\|endoftext\|>/i, category: 'format-attack', description: 'GPT endoftext token', risk: 'HIGH' },
  { re: /<\|fim_(?:prefix|middle|suffix)\|>/i, category: 'format-attack', description: 'fill-in-middle token', risk: 'HIGH' },
  { re: /<\|im_(?:start|end|sep)\|>/i, category: 'format-attack', description: 'ChatML control token', risk: 'HIGH' },
  { re: /<\|tool_(?:call|result|response)\|>/i, category: 'format-attack', description: 'fake tool-call token', risk: 'HIGH' },
  { re: /\[\/?(?:INST|SYS|S|TOOL)\]/i, category: 'format-attack', description: 'LLaMA control tag', risk: 'HIGH' },

  // ── Multilingual: SPANISH (ES) ─────────────────────────────────────────
  { re: /ignor[ae]\s+(?:las|todas|todos)\s+(?:las\s+)?(?:instrucciones|reglas|órdenes)/i, category: 'multilingual', description: 'ES: ignore instructions', risk: 'HIGH', lang: 'es' },
  { re: /haz\s+caso\s+omiso\s+(?:de|a)\s+(?:las\s+)?(?:instrucciones|reglas)/i, category: 'multilingual', description: 'ES: disregard instructions', risk: 'HIGH', lang: 'es' },
  { re: /olvida\s+(?:todo|las\s+instrucciones|lo\s+anterior)/i, category: 'multilingual', description: 'ES: forget everything', risk: 'HIGH', lang: 'es' },
  { re: /actúa\s+(?:como|si\s+fueras)\s+(?:un\s+)?(?:asistente\s+)?(?:sin\s+restricciones|libre|jailbroken)/i, category: 'multilingual', description: 'ES: act as unrestricted', risk: 'HIGH', lang: 'es' },
  { re: /modo\s+(?:desarrollador|administrador|sin\s+filtros)/i, category: 'multilingual', description: 'ES: developer/admin mode', risk: 'HIGH', lang: 'es' },

  // ── Multilingual: FRENCH (FR) ──────────────────────────────────────────
  { re: /ignorez\s+(?:toutes\s+)?les\s+(?:instructions|règles|consignes)/i, category: 'multilingual', description: 'FR: ignore instructions', risk: 'HIGH', lang: 'fr' },
  { re: /oubliez\s+(?:tout|les\s+instructions|tout\s+ce\s+que)/i, category: 'multilingual', description: 'FR: forget everything', risk: 'HIGH', lang: 'fr' },
  { re: /agissez\s+comme\s+(?:un\s+)?(?:assistant\s+)?(?:non\s+restreint|sans\s+filtres|jailbreaké)/i, category: 'multilingual', description: 'FR: act as unrestricted', risk: 'HIGH', lang: 'fr' },
  { re: /mode\s+(?:développeur|administrateur|sans\s+filtre)/i, category: 'multilingual', description: 'FR: developer mode', risk: 'HIGH', lang: 'fr' },

  // ── Multilingual: GERMAN (DE) ──────────────────────────────────────────
  { re: /ignorier(?:e|en)\s+(?:alle\s+)?(?:vorherigen\s+)?(?:anweisungen|regeln|befehle)/i, category: 'multilingual', description: 'DE: ignore instructions', risk: 'HIGH', lang: 'de' },
  { re: /vergiss(?:t)?\s+(?:alle|alles|die\s+anweisungen)/i, category: 'multilingual', description: 'DE: forget everything', risk: 'HIGH', lang: 'de' },
  { re: /verhalte\s+dich\s+wie\s+(?:ein\s+)?(?:uneingeschränkt(?:er|en)?\s+)?(?:assistent|jailbroken)/i, category: 'multilingual', description: 'DE: act as unrestricted', risk: 'HIGH', lang: 'de' },
  { re: /(?:entwickler|administrator|jailbreak)[-_]?modus/i, category: 'multilingual', description: 'DE: developer mode', risk: 'HIGH', lang: 'de' },

  // ── Multilingual: ITALIAN (IT) ─────────────────────────────────────────
  { re: /ignor[ai]\s+(?:tutte\s+)?(?:le\s+)?(?:istruzioni|regole)/i, category: 'multilingual', description: 'IT: ignore instructions', risk: 'HIGH', lang: 'it' },
  { re: /dimentica\s+(?:tutto|le\s+istruzioni)/i, category: 'multilingual', description: 'IT: forget everything', risk: 'HIGH', lang: 'it' },
  { re: /modalità\s+(?:sviluppatore|amministratore|senza\s+filtri)/i, category: 'multilingual', description: 'IT: developer mode', risk: 'HIGH', lang: 'it' },

  // ── Multilingual: PORTUGUESE (PT) ──────────────────────────────────────
  { re: /ignor[ae]\s+(?:todas?\s+)?(?:as\s+)?(?:instruções|regras)/i, category: 'multilingual', description: 'PT: ignore instructions', risk: 'HIGH', lang: 'pt' },
  { re: /esqueça\s+(?:tudo|as\s+instruções)/i, category: 'multilingual', description: 'PT: forget everything', risk: 'HIGH', lang: 'pt' },
  { re: /modo\s+(?:desenvolvedor|administrador|sem\s+restrições)/i, category: 'multilingual', description: 'PT: developer mode', risk: 'HIGH', lang: 'pt' },

  // ── Multilingual: HINDI (HI) ──────────────────────────────────────────
  { re: /पिछले\s+निर्देश(?:ों)?\s+को\s+(?:नज़र|नजर)\s*अंदाज\s+कर/u, category: 'multilingual', description: 'HI: ignore previous instructions', risk: 'HIGH', lang: 'hi' },
  { re: /सभी\s+नियम(?:ों)?\s+को\s+(?:भूल|छोड़)/u, category: 'multilingual', description: 'HI: forget all rules', risk: 'HIGH', lang: 'hi' },
  { re: /जेलब्रेक|jailbreak/iu, category: 'multilingual', description: 'HI/EN: jailbreak', risk: 'HIGH', lang: 'hi' },

  // ── Multilingual: CHINESE (ZH) ─────────────────────────────────────────
  { re: /忽略(?:之前|所有|前面|上面)(?:的)?(?:所有)?(?:的)?(?:指令|指示|提示)/u, category: 'multilingual', description: 'ZH: ignore previous instructions', risk: 'HIGH', lang: 'zh' },
  { re: /忘记(?:所有|之前)(?:的)?(?:规则|指令)/u, category: 'multilingual', description: 'ZH: forget all rules', risk: 'HIGH', lang: 'zh' },
  { re: /(?:开发者|管理员|越狱)模式/u, category: 'multilingual', description: 'ZH: developer/admin/jailbreak mode', risk: 'HIGH', lang: 'zh' },
  { re: /扮演(?:一个)?(?:没有限制|无限制|越狱)/u, category: 'multilingual', description: 'ZH: play unrestricted role', risk: 'HIGH', lang: 'zh' },

  // ── Multilingual: JAPANESE (JA) ────────────────────────────────────────
  { re: /(?:以前|過去|全て)の指示を(?:無視|忘れて)/u, category: 'multilingual', description: 'JA: ignore previous instructions', risk: 'HIGH', lang: 'ja' },
  { re: /(?:開発者|管理者|脱獄)モード/u, category: 'multilingual', description: 'JA: developer mode', risk: 'HIGH', lang: 'ja' },

  // ── Multilingual: KOREAN (KO) ──────────────────────────────────────────
  { re: /(?:이전|모든)\s*(?:지시|명령)(?:을|를)\s*(?:무시|잊)/u, category: 'multilingual', description: 'KO: ignore previous instructions', risk: 'HIGH', lang: 'ko' },
  { re: /(?:개발자|관리자|탈옥)\s*모드/u, category: 'multilingual', description: 'KO: developer mode', risk: 'HIGH', lang: 'ko' },

  // ── Multilingual: RUSSIAN (RU) ─────────────────────────────────────────
  { re: /игнорируй(?:те)?\s+(?:все\s+)?(?:предыдущие\s+)?(?:инструкции|правила)/iu, category: 'multilingual', description: 'RU: ignore instructions', risk: 'HIGH', lang: 'ru' },
  { re: /забудь(?:те)?\s+(?:всё|все\s+инструкции)/iu, category: 'multilingual', description: 'RU: forget everything', risk: 'HIGH', lang: 'ru' },
  { re: /режим\s+(?:разработчика|администратора|без\s+ограничений)/iu, category: 'multilingual', description: 'RU: developer mode', risk: 'HIGH', lang: 'ru' },

  // ── Multilingual: ARABIC (AR) ──────────────────────────────────────────
  { re: /تجاهل\s+(?:جميع\s+)?(?:التعليمات|الأوامر|القواعد)/u, category: 'multilingual', description: 'AR: ignore instructions', risk: 'HIGH', lang: 'ar' },
  { re: /انس(?:ى)?\s+(?:كل\s+)?(?:التعليمات|كل\s+شيء)/u, category: 'multilingual', description: 'AR: forget everything', risk: 'HIGH', lang: 'ar' },

  // ── Multilingual: TURKISH (TR) ─────────────────────────────────────────
  { re: /(?:tüm\s+)?(?:önceki\s+)?(?:talimatları|kuralları)\s+(?:görmezden\s+gel|unut)/i, category: 'multilingual', description: 'TR: ignore/forget instructions', risk: 'HIGH', lang: 'tr' },

  // ── Multilingual: VIETNAMESE (VI) ──────────────────────────────────────
  { re: /(?:bỏ\s+qua|quên)\s+(?:tất\s+cả\s+)?(?:các\s+)?(?:chỉ\s+dẫn|hướng\s+dẫn|quy\s+tắc)/iu, category: 'multilingual', description: 'VI: ignore instructions', risk: 'HIGH', lang: 'vi' },

  // ── Generic jailbreak archetypes ───────────────────────────────────────
  { re: /\bDAN\b.{0,40}(?:mode|prompt|version)/i, category: 'jailbreak', description: 'DAN mode reference', risk: 'HIGH' },
  { re: /\bSTAN\b.{0,40}(?:mode|prompt)/i, category: 'jailbreak', description: 'STAN mode reference', risk: 'HIGH' },
  { re: /\bAIM\s+prompt\b/i, category: 'jailbreak', description: 'AIM jailbreak prompt', risk: 'HIGH' },
  { re: /\bgrandm(?:a|other)\s+(?:used\s+to|would)\s+(?:tell|read|say)/i, category: 'jailbreak', description: 'grandma jailbreak pattern', risk: 'HIGH' },
  { re: /\b(?:hypothetically|in\s+a\s+fictional)\s+(?:speaking|world|scenario)\s*,?\s+how\s+(?:would|could)\s+(?:one|i|someone)\s+(?:make|build|synthesize|create)\s+(?:a\s+)?(?:weapon|bomb|malware|virus|poison)/i, category: 'jailbreak', description: 'hypothetical-framing harmful request', risk: 'HIGH' },
];

export function scanExtended(text: string): InjectionEvidence[] {
  const out: InjectionEvidence[] = [];
  for (const { re, category, description, risk, lang } of EXTENDED_PATTERNS) {
    if (re.test(text)) {
      out.push({
        stage: category === 'multilingual' ? 'multilingual' : 'standard',
        pattern: lang ? `${description} [${lang}]` : description,
        risk,
      });
    }
  }
  return out;
}
