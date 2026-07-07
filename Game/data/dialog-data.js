/**
 * Dialogue transcript data for game scenes.
 */

export const SPEAKER_NAME = "אלה";
export const PLAYER_NAME = "רוי";

export const DAY_1_INTRO_DIALOG = [
  {
    speaker: SPEAKER_NAME,
    text: "רוי, אל תשכח שיש לך סידורים וקניות לעשות בדרך לקלפי!",
  },
  {
    speaker: PLAYER_NAME,
    text: "נכון, אבל הדרך מלאה ברחפנים שחייבים לחמוק מהם!",
  },
  {
    speaker: SPEAKER_NAME,
    text: "תיזהר מהם! בנוסף, על כל יעד או שלב שתשלים, השופט סולברג יציג שאלת טריוויה שתעניק לך נקודות אם תענה נכון.",
  },
  {
    speaker: PLAYER_NAME,
    text: "הבנתי, לחמוק מהרחפנים ולענות נכון בחידונים כדי לצבור נקודות. יוצאים לדרך!",
  },
];

// NOTE: currently unused — the live Day-1 ending shows the inline "great time for shopping!"
// dialog in day-1-scene.js. Kept (translated) in case it's re-enabled.
export const DAY_1_VICTORY_DIALOG = [
  {
    speaker: PLAYER_NAME,
    text: "אוף! זה היה קרוב. כל 10 הרחפנים כיוונו אליי — ומכולם חמקתי!",
  },
  { speaker: SPEAKER_NAME, text: "תנועה מדהימה! התחמקת מהם בצורה מושלמת." },
  {
    speaker: PLAYER_NAME,
    text: "מתקדם אני רואה את נקודת ההתכנסות בקריית שמונה ממש מקדימה. מתקדם.",
  },
  { speaker: SPEAKER_NAME, text: "מצוין. החזית הוורודה מאובטחת. התכונני לחילוץ." },
];

export const DAY_2_INTRO_DIALOG = [
  {
    speaker: SPEAKER_NAME,
    text: "רוי, מהר! אתה חייב לזוז מהר לפני שתפספס את האוטובוס!",
  },
  {
    speaker: PLAYER_NAME,
    text: "נכון! ואני חייב לבזבז את כל 67 השקלים שנשארו לי על מצרכים לפני שאגיע לקופה!",
  },
  {
    speaker: SPEAKER_NAME,
    text: "בדיוק. קפוץ כדי לאסוף מצרכים מהמדפים. אל תשאיר אפילו שקל אחד עודף!",
  },
];


export const DAY_3_INTRO_DIALOG = [
  { speaker: SPEAKER_NAME, text: "הגענו לעכו! רחפנים חגים מעלינו!" },
  {
    speaker: PLAYER_NAME,
    text: "אני רואה אותם. ואבני ירושלים העתיקות מתחת לרגליי מרגישות לא יציבות!",
  },
  {
    speaker: SPEAKER_NAME,
    text: "היזהר! אם תעמוד במקום אחד יותר מדי זמן, כביש האבן יתמוטט!",
  },
  { speaker: PLAYER_NAME, text: "הבנתי. להמשיך לזוז, לחמוק מרחפנים, ולא ליפול!" },
];

export const DAY_3_VICTORY_DIALOG = [
  { speaker: PLAYER_NAME, text: "הגעתי לקלפי!" },
  { speaker: SPEAKER_NAME, text: "מדהים! חמקת מהרחפנים ושרדת את האבנים המתמוטטות." },
  { speaker: PLAYER_NAME, text: "הכתובת עודכנה, הקול נמסר. החזית הוורודה ניצחה!" },
  { speaker: SPEAKER_NAME, text: "המשימה הושלמה. הניצחון שלנו!" },
];

export const DAY_5_INTRO_DIALOG = [
  { speaker: PLAYER_NAME, text: "ירושליםםםם אני מגיע" },
  { speaker: SPEAKER_NAME, text: "תבחר בחכמה את הא.נשים שאתה רוצה להכניס לרשימה" },
];

export const KOTEL_INTRO_DIALOG = [
  { speaker: SPEAKER_NAME, text: "הגענו לכותל המערבי! אבל רגע, תראה שם..." },
  { speaker: PLAYER_NAME, text: "זה הנשיא? הוא נראה ממש במצוקה ורץ במהירות!" },
  { speaker: SPEAKER_NAME, text: "מהר! רדוף אחריו ותן לו חיבוק. הוא ממש זקוק לזה!" },
];

export const KOTEL_VICTORY_DIALOG = [
  { speaker: SPEAKER_NAME, text: "תפסת את הנשיא לחיבוק — הוא היה זקוק לזה!" },
];
