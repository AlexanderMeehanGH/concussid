// ConcussID — assessment content and evidence base.
// Core items follow the structure of the Concussion in Sport Group (CISG) 6th consensus
// and SCAT6. Wording is paraphrased; word lists are original to ConcussID.
// Clinicians should use the official SCAT6 / CRT6 forms for formal assessment.

export const REFS = {
  cisg2023: {
    short: 'Patricios et al., 2023',
    full: 'Patricios JS, Schneider KJ, Dvorak J, et al. Consensus statement on concussion in sport: the 6th International Conference on Concussion in Sport–Amsterdam, October 2022. Br J Sports Med. 2023;57(11):695–711.',
  },
  scat6: {
    short: 'Echemendia et al., 2023',
    full: 'Echemendia RJ, Brett BL, Broglio S, et al. Sport Concussion Assessment Tool – 6 (SCAT6). Br J Sports Med. 2023;57(11):622–631.',
  },
  maddocks1995: {
    short: 'Maddocks et al., 1995',
    full: 'Maddocks DL, Dicker GD, Saling MM. The assessment of orientation following concussion in athletes. Clin J Sport Med. 1995;5(1):32–35.',
  },
  mccrea1998: {
    short: 'McCrea et al., 1998',
    full: 'McCrea M, Kelly JP, Randolph C, et al. Standardized assessment of concussion (SAC): on-site mental status evaluation of the athlete. J Head Trauma Rehabil. 1998;13(2):27–35.',
  },
  teasdale1974: {
    short: 'Teasdale & Jennett, 1974',
    full: 'Teasdale G, Jennett B. Assessment of coma and impaired consciousness: a practical scale. Lancet. 1974;2(7872):81–84.',
  },
  riemann2000: {
    short: 'Riemann & Guskiewicz, 2000',
    full: 'Riemann BL, Guskiewicz KM. Effects of mild head injury on postural stability as measured through clinical balance testing. J Athl Train. 2000;35(1):19–25.',
  },
  davis2019: {
    short: 'Davis et al., 2019',
    full: 'Davis GA, Makdissi M, Bloomfield P, et al. International consensus definitions of video signs of concussion in professional sports. Br J Sports Med. 2019;53(20):1264–1267.',
  },
  mucha2014: {
    short: 'Mucha et al., 2014',
    full: 'Mucha A, Collins MW, Elbin RJ, et al. A brief vestibular/ocular motor screening (VOMS) assessment to evaluate concussions: preliminary findings. Am J Sports Med. 2014;42(10):2479–2486.',
  },
  galetta2011: {
    short: 'Galetta et al., 2011',
    full: 'Galetta KM, Barrett J, Allen M, et al. The King-Devick test as a determinant of head trauma and concussion in boxers and MMA fighters. Neurology. 2011;76(17):1456–1462.',
  },
  maruta2014: {
    short: 'Maruta & Ghajar, 2014',
    full: 'Maruta J, Ghajar J. Detecting eye movement abnormalities from concussion. Prog Neurol Surg. 2014;28:226–233.',
  },
  mariakakis2017: {
    short: 'Mariakakis et al., 2017',
    full: 'Mariakakis A, Baudin J, Whitmire E, et al. PupilScreen: using smartphones to assess traumatic brain injury. Proc ACM Interact Mob Wearable Ubiquitous Technol. 2017;1(3).',
  },
  falcone2013: {
    short: 'Falcone et al., 2013',
    full: 'Falcone M, Yadav N, Poellabauer C, Flynn P. Using isolated vowel sounds for classification of mild traumatic brain injury. Proc IEEE Int Conf Acoustics, Speech and Signal Processing (ICASSP). 2013.',
  },
  daudet2017: {
    short: 'Daudet et al., 2017',
    full: 'Daudet L, Yadav N, Perez M, Poellabauer C, Schneider S, Huebner A. Portable mTBI assessment using temporal and frequency analysis of speech. IEEE J Biomed Health Inform. 2017;21(2):496–506.',
  },
  talkar2020: {
    short: 'Talkar et al., 2020',
    full: 'Talkar T, Yuditskaya S, Williamson JR, et al. Detection of subclinical mild traumatic brain injury (mTBI) through speech and gait. Proc Interspeech. 2020.',
  },
  dejong2009: {
    short: 'de Jong & Wempe, 2009',
    full: 'de Jong NH, Wempe T. Praat script to detect syllable nuclei and measure speech rate automatically. Behav Res Methods. 2009;41(2):385–390.',
  },
  kartynnik2019: {
    short: 'Kartynnik et al., 2019',
    full: 'Kartynnik Y, Ablavatski A, Grishchenko I, Grundmann M. Real-time facial surface geometry from monocular video on mobile GPUs. CVPR Workshop on Computer Vision for AR/VR. 2019.',
  },
};

// Immediate-removal / emergency signs (CISG 2023, SCAT6, CRT6).
export const RED_FLAGS = [
  'Neck pain or tenderness',
  'Seizure, fit or convulsion',
  'Double vision',
  'Loss of consciousness',
  'Weakness, tingling or burning in more than one arm or leg',
  'Deteriorating conscious state',
  'Vomiting',
  'Severe or increasing headache',
  'Increasingly restless, agitated or combative',
  'Visible deformity of the skull',
];

export const GCS = {
  e: { label: 'Eye opening', options: ['Spontaneous', 'To sound', 'To pressure', 'None'] },
  v: { label: 'Verbal response', options: ['Oriented', 'Confused', 'Words', 'Sounds', 'None'] },
  m: { label: 'Motor response', options: ['Obeys commands', 'Localising', 'Normal flexion', 'Abnormal flexion', 'Extension', 'None'] },
};

// Observable signs (SCAT6; video-sign definitions per Davis et al., 2019).
export const OBSERVABLE_SIGNS = [
  'Lying motionless on the playing surface',
  'Falling unprotected to the playing surface',
  'Balance / gait difficulty, motor incoordination, stumbling or slow laboured movement',
  'Disorientation or confusion, staring, limited responsiveness or inappropriate answers',
  'Blank or vacant look',
  'Facial injury after head trauma',
  'Impact seizure',
  'Tonic posturing',
];

// Maddocks questions (Maddocks et al., 1995), generic wording for any team sport.
export const MADDOCKS = [
  'What venue are we at today?',
  'Which half / period is it now?',
  'Who scored last in this match?',
  'What team did you play last week / last game?',
  'Did your team win the last game?',
];

// SCAT symptom evaluation — 22 items rated 0 (none) to 6 (severe).
export const SYMPTOMS = [
  'Headache', 'Pressure in head', 'Neck pain', 'Nausea or vomiting', 'Dizziness',
  'Blurred vision', 'Balance problems', 'Sensitivity to light', 'Sensitivity to noise',
  'Feeling slowed down', 'Feeling like "in a fog"', '"Don\'t feel right"',
  'Difficulty concentrating', 'Difficulty remembering', 'Fatigue or low energy',
  'Confusion', 'Drowsiness', 'More emotional', 'Irritability', 'Sadness',
  'Nervous or anxious', 'Trouble falling asleep (if applicable)',
];

export const ORIENTATION = [
  'What month is it?',
  'What is the date today?',
  'What is the day of the week?',
  'What year is it?',
  'What time is it right now? (within 1 hour)',
];

// Original 10-word lists (concrete, two-syllable nouns). Alternate lists between sessions.
export const WORD_LISTS = [
  ['candle', 'river', 'button', 'tiger', 'pencil', 'garden', 'rocket', 'violin', 'blanket', 'harbour'],
  ['lemon', 'castle', 'ladder', 'falcon', 'carpet', 'island', 'wagon', 'needle', 'thunder', 'bottle'],
  ['orchard', 'helmet', 'parrot', 'kettle', 'canyon', 'marble', 'tunnel', 'feather', 'compass', 'ribbon'],
];

// Modified Balance Error Scoring System (Riemann & Guskiewicz, 2000; used in SCAT6).
export const BALANCE_STANCES = [
  { name: 'Double-leg stance', how: 'Feet together, hands on hips, eyes closed.' },
  { name: 'Single-leg stance', how: 'Stand on non-dominant foot, hands on hips, eyes closed.' },
  { name: 'Tandem stance', how: 'Heel-to-toe, non-dominant foot at the back, hands on hips, eyes closed.' },
];
export const BALANCE_ERRORS = 'Errors: hands off hips · opening eyes · step, stumble or fall · hip abducted >30° · lifting forefoot or heel · out of position >5 s (max 10 per stance).';

export const READING_PASSAGE =
  'The match started under grey skies. Our captain won the toss and chose to play with the wind. ' +
  'Early on, a quick pass found the winger, who sprinted down the line and crossed into the box. ' +
  'The crowd rose to its feet as the ball struck the post and bounced clear.';

// Prototype decision thresholds. These are CONSERVATIVE PLACEHOLDERS chosen for a
// research prototype — they are NOT validated cut-offs and must be calibrated
// against a properly powered clinical dataset before any real-world use.
export const THRESHOLDS = {
  orientationDrop: 1,
  immediateDrop: 3,
  concentrationDrop: 1,
  delayedDrop: 2,
  balanceIncrease: 3,
  speech: {
    ddkRate: { dir: 'down', rel: 0.15 },
    ddkCv: { dir: 'up', rel: 0.5 },
    speechRate: { dir: 'down', rel: 0.15 },
    articulationRate: { dir: 'down', rel: 0.15 },
    pauseRatio: { dir: 'up', abs: 0.1 },
    f0SdSt: { dir: 'both', rel: 0.4 },
    jitter: { dir: 'up', rel: 0.5 },
    ampVar: { dir: 'up', rel: 0.5 },
  },
  face: {
    fixationDisp: { dir: 'up', rel: 0.5 },
    pursuitR: { dir: 'down', abs: 0.15 },
    pursuitResid: { dir: 'up', rel: 0.5 },
    saccadeLatency: { dir: 'up', abs: 50 },
  },
  smileAsymUrgent: 0.4,
};

export const SPEECH_TASKS = [
  { k: 'vowel', title: 'Sustained vowel', secs: 6, prompt: 'Take a breath and say “aaah” steadily, at a comfortable pitch and loudness, until the timer ends.' },
  { k: 'ddk', title: 'Rapid syllables (DDK)', secs: 7, prompt: 'Repeat “pa-ta-ka” as quickly and clearly as you can until the timer ends.' },
  { k: 'reading', title: 'Read aloud', secs: 16, prompt: READING_PASSAGE },
];

export const SPEECH_LABELS = {
  vowel: { phonation: 'Longest phonation (s)', f0Median: 'Median pitch (Hz)', f0SdSt: 'Pitch variability (semitones)', jitter: 'Period perturbation (frame-level jitter)', ampVar: 'Amplitude variability' },
  ddk: { ddkRate: 'DDK rate (syllables/s)', ddkCv: 'DDK rhythm irregularity (CV)' },
  reading: { speechRate: 'Speech rate (syllables/s)', articulationRate: 'Articulation rate (syllables/s)', pauseRatio: 'Pause-time ratio', pauseCount: 'Pauses > 250 ms', f0SdSt: 'Pitch variability (semitones)' },
};

export const FACE_LABELS = {
  fixationDisp: 'Fixation instability (% eye width)',
  pursuitR: 'Smooth-pursuit tracking (r)',
  pursuitResid: 'Pursuit error (% eye width)',
  saccadeLatency: 'Saccade latency, median (ms)',
  saccadeMiss: 'Missed saccades',
  blinkRate: 'Blink rate (/min)',
  smileAsym: 'Smile asymmetry index',
  headMotion: 'Head movement (% frame)',
};
