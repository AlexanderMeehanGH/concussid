// Governing-body concussion rules that ConcussID follows after a player is withdrawn.
// Day 0 = the day of the injury. Every profile shares the same non-negotiables:
//   • any suspected concussion → removed, no return that day (all bodies, CISG 2023);
//   • a pitchside screen can never clear a player — only a healthcare professional can
//     exclude concussion (UK 2024: "until an appropriate Healthcare Professional has
//     excluded concussion or the patient has completed a graduated return...").
// Numbers below were checked against each body's own published document on 17 Nov 2026.
// Where a figure could not be confirmed it is marked `verify` and the stricter value is used.

const DAY = 86400000;
export const CATEGORIES = {
  adult_male: 'Adult (male)',
  adult_female: 'Adult (female)',
  youth: 'Under 18',
};

export const BODIES = {
  uk: {
    name: 'UK grassroots guidelines',
    detail: 'UK Government / Sport and Recreation Alliance, Nov 2024. Used by The FA, RFU community game, ECB and other UK sports.',
    emergency: '999',
    source: { title: 'UK Concussion Guidelines for Non-Elite (Grassroots) Sport (Nov 2024)', url: 'https://sportandrecreation.org.uk/campaigns-and-policy/concussion/concussion-guidelines-for-grassroots-sport-html-version' },
    medical24h: 'Get assessed by an on-site healthcare professional or call NHS 111 within 24 hours.',
    clearance: 'Only a healthcare professional can rule out concussion. Otherwise the player completes the full graduated return. See NHS 111 if symptoms are not improving by day 14, or a GP if they last beyond 28 days.',
    plan: () => [
      { day: 0, label: 'Relative rest (24–48 h)', note: 'Walking and light reading are fine, in 10–15 minute slots. Minimise screens for 48 h.' },
      { day: 2, label: 'Gradually back to daily activities', note: 'Short walks and normal daily life outside school or work (guide: week 1).', approx: true },
      { day: 3, label: 'Build up mental work and light exercise', note: 'Homework in 20–30 minute blocks; light aerobic exercise (guide: weeks 1–2).', approx: true },
      { day: 8, label: 'Return to study or work, plus non-contact training', note: 'Only once symptom-free at rest. Avoid training with head impacts (guide: week 2).', approx: true },
      { day: 15, label: 'Full training', note: 'Not before day 15, and only after 14 days symptom-free at rest.' },
      { day: 21, label: 'Return to competition', note: 'Not before day 21, and only after 14 days symptom-free at rest.' },
    ],
    competitionDay: () => 21,
  },
  worldrugby: {
    name: 'World Rugby: community game',
    detail: 'World Rugby Regulation 10 and community concussion guidance (graduated return to play). Not the elite Head Injury Assessment (HIA) process.',
    emergency: '112',
    source: { title: 'World Rugby: How the concussion return-to-play protocol works', url: 'https://www.world.rugby/news/613856/how-world-rugbys-concussion-return-to-play-protocol-works' },
    medical24h: 'See a doctor or other healthcare professional as soon as possible, ideally the same day.',
    clearance: 'The return-to-play programme starts only after the rest period and once the player is symptom-free. Each stage lasts at least 24 h (many unions use 48 h for under-19s). Get medical clearance before full-contact training.',
    plan: (cat) => {
      const rest = cat === 'youth' ? 14 : 7;
      const step = cat === 'youth' ? 2 : 1;
      return [
        { day: 0, label: `Rest (${rest} days, and symptom-free)`, note: cat === 'youth' ? 'Children and adolescents rest for 14 days.' : 'Adults rest for 7 days.' },
        { day: rest, label: 'Light aerobic exercise', note: `At least ${step * 24} h per stage, and only if symptom-free.` },
        { day: rest + step, label: 'Sport-specific exercise', note: 'No head-impact activities.' },
        { day: rest + 2 * step, label: 'Non-contact training drills', note: 'Medical clearance required before the next stage.' },
        { day: rest + 3 * step, label: 'Full-contact practice', note: 'After medical clearance.' },
        { day: 21, label: 'Return to play', note: 'Minimum 21 days for all ages (Regulation 10).' },
      ];
    },
    competitionDay: () => 21,
  },
  gaa: {
    name: 'GAA, LGFA and Camogie',
    detail: 'Concussion Management Guidelines for Gaelic Games (Nov 2024).',
    emergency: '112',
    source: { title: 'GAA Concussion Management Guidelines for Gaelic Games (2024)', url: 'https://learning.gaa.ie/sites/default/files/2025-01/A4%20GAA_Concussion%20Guide_FOR%20SCREEN%20USE%20(4).pdf' },
    medical24h: 'Get the player assessed by a doctor.',
    clearance: 'Medical clearance is required before full-contact training. For adult men, a doctor experienced in concussion may allow return before day 15, but never within 7 days.',
    plan: (cat) => {
      const male = cat === 'adult_male';
      const rtp = male ? 15 : 21;
      return [
        { day: 0, label: 'Symptom-limited activity', note: 'Minimum 2 days (days 0–2).' },
        { day: 3, label: 'Light aerobic exercise', note: 'Minimum 2 days (days 3–4).' },
        { day: 5, label: 'Moderate aerobic exercise', note: 'Minimum 2 days (days 5–6).' },
        { day: 7, label: 'Individual sport-specific exercise', note: 'Minimum 2 days (days 7–8). No head-impact risk.' },
        { day: 9, label: 'Non-contact training', note: 'Minimum 3 days (days 9–11). Medical clearance required before contact training.' },
        { day: 12, label: 'Contact training', note: male ? 'Minimum 3 days (days 12–14).' : 'After medical clearance.' },
        { day: rtp, label: 'Return to play', note: male ? 'Day 15 for adult men.' : 'ConcussID applies day 21 for women and under-18s. Confirm the exact minimum in the GAA guide.', verify: !male },
      ];
    },
    competitionDay: (cat) => (cat === 'adult_male' ? 15 : 21),
  },
  afl: {
    name: 'AFL: community football',
    detail: 'AFL community concussion guidelines (2024). Not the elite AFL/AFLW 12-day rule.',
    emergency: '000',
    source: { title: 'AFL: Community football adopts minimum 21-day return to play', url: 'https://www.afl.com.au/news/1082723/community-football-to-adopt-minimum-21-day-return-to-play-protocols' },
    medical24h: 'See a doctor as soon as possible.',
    clearance: 'The earliest return is day 21, and only after completing every phase of the return-to-play programme. Follow AFL guidance on medical clearance.',
    plan: () => [
      { day: 0, label: 'Rest and recovery', note: 'Relative rest, then gradually back to daily activities, school and work.' },
      { day: 1, label: 'Work through each AFL return-to-play phase', note: 'One phase at a time, as set out in the AFL community guidelines.', approx: true },
      { day: 21, label: 'Return to play', note: 'Earliest possible day for all community players, adults and juniors.' },
    ],
    competitionDay: () => 21,
  },
  cisg: {
    name: 'International consensus (CISG 2023)',
    detail: 'Amsterdam 2022 consensus statement, SCAT6 and CRT6. Use when no national or sport body applies.',
    emergency: '112',
    source: { title: 'Patricios et al. Consensus statement on concussion in sport, Br J Sports Med 2023', url: 'https://bjsm.bmj.com/content/57/11/695' },
    medical24h: 'See a healthcare professional for diagnosis.',
    clearance: 'Each step lasts at least 24 hours, moving on only without new symptoms. A healthcare professional confirms readiness, in writing where local rules require, before return to sport.',
    plan: () => [
      { day: 0, label: 'Symptom-limited activity', note: 'Daily activities that don’t worsen symptoms.' },
      { day: 1, label: 'Aerobic exercise (light, then moderate)', note: 'At least 24 h per step.', approx: true },
      { day: 2, label: 'Individual sport-specific exercise', note: 'No head-impact activities.', approx: true },
      { day: 3, label: 'Non-contact training drills', note: 'Only once symptom-free.', approx: true },
      { day: 4, label: 'Full-contact practice', note: 'After medical clearance.', approx: true },
      { day: 5, label: 'Return to sport', note: 'Earliest if every step takes exactly 24 h. The consensus sets no fixed minimum; check your sport’s rules, as many set 21 days.', approx: true },
    ],
    competitionDay: () => null,
  },
};

const SETTINGS_KEY = 'concussid.settings';
export function getSettings() {
  try { return { body: null, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return { body: null }; }
}
export function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }
export const currentBody = () => BODIES[getSettings().body] || BODIES.cisg;

// Unknown category is treated as the most cautious (under 18).
export function returnPlan(bodyKey, category, injuryISO) {
  const body = BODIES[bodyKey] || BODIES.cisg;
  const cat = CATEGORIES[category] ? category : 'youth';
  const start = new Date(injuryISO); start.setHours(0, 0, 0, 0);
  const at = (d) => new Date(start.getTime() + d * DAY);
  return {
    body, cat,
    stages: body.plan(cat).map((s) => ({ ...s, date: at(s.day) })),
    competitionDay: body.competitionDay(cat),
    competitionDate: body.competitionDay(cat) != null ? at(body.competitionDay(cat)) : null,
  };
}

// Aftercare for the first 24–48 h, common to all bodies (UK 2024 wording, CRT6).
export function aftercare(body, isYouth) {
  return [
    body.medical24h,
    'Do not leave them alone for the first 24 hours. A responsible adult supervises for 24–48 hours.',
    'No alcohol, and no driving or cycling, for at least 24 hours.',
    'No sport, training or PE for at least 24 hours. Rest and sleep as needed, and minimise screens for 48 hours.',
    ...(isYouth ? ['Under 18: tell the parent or guardian now.'] : []),
    'Complete the club’s injury report form, and tell the player’s school, work and other clubs.',
    'Return to school or work comes before return to sport.',
  ];
}
