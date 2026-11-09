/**
 * Small local profanity filter for display names and chat (Play UGC policy).
 * Whole-word matching on a normalised form, so ordinary words that merely
 * contain a bad substring ("assassin", "class", "Scunthorpe") are untouched.
 * Not a moderation system on its own: reports + bans back it up.
 */

// Lowercase stems. A word is blocked if it equals a stem, or a stem plus a
// common suffix (s, es, er, ers, ing, ed, y).
const BLOCKED = [
  // general profanity
  "fuck", "fucker", "motherfucker", "shit", "bullshit", "bitch", "bastard", "asshole", "dickhead",
  "cunt", "cock", "pussy", "slut", "whore", "wanker", "twat", "prick", "douche", "jackass",
  "boobs", "tits", "porn", "dildo", "cum", "jizz", "rape", "rapist", "nude", "nudes", "sex", "sexy",
  // slurs (racial, ethnic, homophobic, ableist)
  "nigger", "nigga", "chink", "gook", "spic", "kike", "wetback", "paki", "raghead", "towelhead",
  "faggot", "fag", "dyke", "tranny", "retard", "retarded",
  // self-harm encouragement
  "kys",
  // common Urdu/Hindi (romanised) abuse
  "chutiya", "chutia", "madarchod", "behenchod", "bhenchod", "bhosdike", "randi", "harami", "gandu", "lund",
];

// Phrases checked against the normalised text with spaces collapsed.
const BLOCKED_PHRASES = ["killyourself", "goandie"];

// Stems strong enough to block even inside a longer word ("shithead",
// "fuckface"). Only stems that don't occur inside ordinary words; e.g. "cunt"
// (Scunthorpe) and "nigger" (snigger) are deliberately not here.
const STRONG_INFIXES = ["fuck", "shit", "bitch", "whore", "faggot", "nigga", "motherf", "chutiya", "madarchod", "behenchod", "bhenchod"];

const SUFFIXES = ["", "s", "es", "er", "ers", "ing", "ed", "y", "z"];
const blockedWords = new Set<string>();
for (const stem of BLOCKED) for (const suf of SUFFIXES) blockedWords.add(stem + suf);

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "!": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s", "7": "t", "8": "b", "+": "t",
};

/** Lowercase, undo leetspeak, strip accents, collapse 3+ repeated letters. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[0-9!@$+]/g, (c) => LEET[c] ?? c)
    .replace(/(.)\1{2,}/g, "$1$1");
}

/** Split into words, also joining single letters spelled out with separators ("f.u.c.k"). */
function words(text: string): string[] {
  const norm = normalise(text);
  const tokens = norm.split(/[^a-z]+/).filter(Boolean);
  const out = [...tokens];
  // Rejoin runs of single letters: "f u c k" -> "fuck"
  let run = "";
  for (const t of tokens) {
    if (t.length === 1) run += t;
    else {
      if (run.length > 2) out.push(run);
      run = "";
    }
  }
  if (run.length > 2) out.push(run);
  return out;
}

function isBlockedWord(word: string): boolean {
  // Doubled letters used to dodge ("fuuck"): also try with runs reduced to one.
  const single = word.replace(/(.)\1+/g, "$1");
  if (blockedWords.has(word) || blockedWords.has(single)) return true;
  // Infix check only on the word as written: collapsing doubles would turn
  // "shiitake" into "shitake".
  return STRONG_INFIXES.some((stem) => word.includes(stem));
}

export function containsProfanity(text: string): boolean {
  if (words(text).some(isBlockedWord)) return true;
  const squashed = normalise(text).replace(/[^a-z]/g, "");
  return BLOCKED_PHRASES.some((p) => squashed.includes(p));
}

/** Replace blocked words in chat with asterisks, keeping everything else as typed. */
export function maskProfanity(text: string): string {
  // 1. Letters spelled out with separators ("f.u.c.k", "s h i t"): judge the joined run.
  let masked = text.replace(/(?<![\p{L}\p{N}])(?:[\p{L}\p{N}@$!+][\s._*\-]+){2,}[\p{L}\p{N}@$!+](?![\p{L}\p{N}])/gu, (span) => {
    const joined = span.replace(/[\s._*\-]+/g, "");
    return isBlockedWord(normalise(joined).replace(/[^a-z]/g, "")) ? "*".repeat(span.length) : span;
  });
  // 2. Ordinary words.
  masked = masked.replace(/[\p{L}\p{N}!@$+]+/gu, (token) => {
    const parts = words(token);
    return parts.some(isBlockedWord) ? "*".repeat(token.length) : token;
  });
  // 3. Banned phrases written across words ("kill your self").
  const squashed = normalise(masked).replace(/[^a-z]/g, "");
  if (BLOCKED_PHRASES.some((p) => squashed.includes(p))) masked = "*".repeat(Math.min(masked.length, 12));
  return masked;
}
