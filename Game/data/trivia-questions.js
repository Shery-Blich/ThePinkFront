/**
 * Fallback trivia database, used only when the backend is unreachable.
 * Each entry is an array in the format:
 * [
 *   questionText (string),
 *   optionsArray (string[] - in order of א, ב, ג, ד),
 *   correctIndex (number - 0-3)
 * ]
 */
const LOCAL_FALLBACK_QUESTIONS = [
  [
    "אם המון אנשים הצביעו למפלגות שלא עברו את אחוז החסימה, איך זה משפיע על המפלגות שכן הצליחו להיכנס לכנסת?",
    [
      "יהיו פחות מ-120 חברים.",
      "זה לא משנה להן, הקולות האלה פשוט נעלמים.",
      "המפלגות שכן נכנסו מקבלות יותר כוח, כי הקולות שלהן שווים עכשיו יותר מנדטים.",
      "פוסלים את התוצאות ויוצאים לבחירות חוזרות."
    ],
    2
  ],
  [
    "לפעמים מפלגות חותמות ביניהן על \"הסכם עודפים\" לפני הבחירות. מה המטרה של ההסכם הזה?",
    [
      "להחליט שהן מתאחדות למפלגה אחת גדולה.",
      "לחבר יחד את הקולות ה\"מיותרים\" שנשארו להן, כדי לנסות להרוויח מהם עוד כיסא בכנסת.",
      "לחלוק ביניהן את כספי המיסים שהן מקבלות.",
      "לאפשר לחברי כנסת ממפלגה אחת לעבור למפלגה השנייה באמצע הקדנציה."
    ],
    1
  ],
  [
    "למה חשוב שיהיה ייצוג הולם בכנסת?",
    [
      "כי ככל שהכנסת מגוונת יותר ומייצגת את כלל הציבור, ככה היא יכולה לחוקק חוקים שטובים לכולם.",
      "כדי שיהיה יותר אקשן בוועדות.",
      "תנאי של האו\"ם, ומדינה שלא מקפידה על זה עלולה לחטוף סנקציות.",
      "כדי שכל חברי הכנסת ילבשו חליפות יפות ויתנהגו בצורה הולמת."
    ],
    0
  ],
  [
    "למה אחרי פרסום התוצאות כולם הולכים לשיחות עם הנשיא?",
    [
      "כי הם עושים על האש ביחד ושמחים שהבחירות נגמרו.",
      "לחתום על תעודת חבר הכנסת הרשמית שלהם ולקבל את המפתחות למשרד החדש.",
      "לעבור מבחן חוק ומשפט לפני שמותר להם להיכנס למשכן הכנסת.",
      "הנשיא בוחר בחבר הכנסת שקיבל את מספר ההמלצות הגבוה ביותר מנציגי המפלגות, ושיש לו את הסיכוי הכי טוב לגבש קואליציה (רוב) של חברי כנסת."
    ],
    3
  ],
  [
    "אז למה בכל זאת חשוב שנכיר את מצע המפלגה שאנחנו רוצים להצביע לה?",
    [
      "כדי שיהיה לבוחר תירוץ טוב להגיד \"אמרתי לכם!\" כששום דבר ממה שכתוב שם לא יקרה.",
      "כדי לבדוק איזו מפלגה השקיעה בעיצוב ובצבעים הכי יפים.",
      "כדי להבין מהם הערכים והשאיפות של המפלגה, ולבדוק אם הדרך שלהם בכלל מתאימה לי.",
      "כדי שנוכל לתבוע את המפלגה במקרה שתפר את הבטחותיה."
    ],
    2
  ]
];

// Normalized shape used by the rest of the game, regardless of source:
// { id: mongoId|null, text, options: string[], correctIndex: number|null }
// correctIndex is only known client-side for local-fallback questions —
// for API-sourced ones it stays null until the backend verifies an answer.
function normalizeLocal() {
  return LOCAL_FALLBACK_QUESTIONS.map(([text, options, correctIndex]) => ({
    id: null,
    text,
    options,
    correctIndex,
  }));
}

function normalizeApi(apiQuestions) {
  return apiQuestions.map((q) => ({
    id: q._id,
    text: q.text,
    options: q.answers.map((a) => a.text),
    correctIndex: null,
  }));
}

const API_BASE = import.meta.env?.VITE_API_URL ?? `${window.location.origin}/api`;

let _questions = normalizeLocal();
let _source = 'local';
let _loadPromise = null;

// Fetches questions from Mongo; falls back to the local set on any failure
// or empty response. Cached — safe to call repeatedly, only fetches once.
export function loadTriviaQuestions() {
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`${API_BASE}/game/questions`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('empty response');
      _questions = normalizeApi(data);
      _source = 'api';
    } catch (err) {
      console.warn('[Trivia] Backend unavailable, using local fallback questions:', err.message);
      _questions = normalizeLocal();
      _source = 'local';
    }
  })();

  return _loadPromise;
}

// Pre-trigger early load when module is imported
loadTriviaQuestions();

export function getTriviaQuestions() {
  return _questions;
}

export function getTriviaSource() {
  return _source;
}
