
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import {
  STATIC_CRISIS_RESOURCES_IN,
  fetchSupportLevel,
  levelCopy,
  phoneHref,
} from './lib/supportLevel';
import type { CrisisContact, SupportLevelResponse } from './lib/supportLevel';
import {
  PHQ9_ATTRIBUTION,
  PHQ9_DIFFICULTY_OPTIONS,
  PHQ9_DIFFICULTY_PROMPT,
  PHQ9_ITEMS,
  PHQ9_OPTIONS,
  PHQ9_PROMPT,
  phq9ResultCopy,
  scorePhq9,
} from './lib/phq9';
import type { Phq9Result } from './lib/phq9';

type Baby = {
  id: string;
  display_name: string;
  date_of_birth: string | null;
};

type CareEvent = {
  id: string;
  event_type: 'feeding' | 'sleep' | 'diaper';
  logged_at: string;
  details: Record<string, unknown>;
  feeding_type?: string | null;
  amount_ml?: number | null;
  sleep_started_at?: string | null;
  sleep_ended_at?: string | null;
  diaper_type?: string | null;
};

type EventType = CareEvent['event_type'];
type CommunityTopic = 'Daily life' | 'Postpartum' | 'Baby care' | 'Support';
type CommunityPost = {
  id: string;
  author_id: string;
  display_name: string;
  topic: CommunityTopic;
  body: string;
  moderation_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};
type CommunityReport = {
  id: string;
  post_id: string;
  reporter_id: string;
  reason: string;
  created_at: string;
  post?: { id: string; display_name: string; body: string; moderation_status: 'pending' | 'approved' | 'rejected' } | null;
};
const COMMUNITY_TOPICS: CommunityTopic[] = ['Daily life', 'Postpartum', 'Baby care', 'Support'];
type DiscoverCategory = 'All' | 'For you' | 'Baby care' | 'Recovery';
type DiscoverArticle = {
  id: string;
  category: Exclude<DiscoverCategory, 'All'>;
  emoji: string;
  title: string;
  subtitle: string;
  color: string;
  readTime: string;
  author: string;
  publishedAt: string;
  sections: { heading: string; body: string[] }[];
  note?: string;
};

const EVENT_TYPES: EventType[] = ['feeding', 'sleep', 'diaper'];

// Keep authorship and publication time in one place so every Discover article
// uses the same visible byline format. Update this timestamp when republishing.
const DISCOVER_ARTICLE_META = {
  author: '~team BabyBlues 💙',
  publishedAt: '2026-10-27T11:57:00+05:30',
};

const DISCOVER_ARTICLES: DiscoverArticle[] = [
  {
    ...DISCOVER_ARTICLE_META,
    id: 'overwhelmed', category: 'For you', emoji: '🫶', title: 'When everything feels like a lot',
    subtitle: 'A doable plan for the next ten minutes, not the whole day.', color: '#F3EAF7', readTime: '4 min read',
    sections: [
      { heading: 'Start with one immediate need', body: [
        'When every task feels urgent, pause the mental list and choose one basic need: drink water, eat something simple, use the bathroom, take prescribed medication, or sit somewhere supported. You do not need to earn these few minutes by finishing something first.',
        'If you need to step away, first place your baby in a safe sleep space or ask a trusted adult to take over. A short pause is a reasonable response to overload, not a failure.'
      ]},
      { heading: 'Ask for help someone can act on', body: [
        '“Let me know if you need anything” can be hard to answer when you are exhausted. Try one specific request: “Could you hold the baby from 2 to 2:30 while I shower?” or “Could you drop off dinner and leave it at the door?”',
        'Name the task, the time, and whether you want advice or simply company. People cannot always say yes, but a clear request gives them a real opportunity to help.'
      ]},
      { heading: 'Choose a good-enough standard', body: [
        'For today, define the essentials: everyone safe, basic care covered, and you fed and hydrated as best you can. Laundry, replying to messages, and having a tidy home can wait or be handed to someone else.',
        'You are adjusting to a major change. Progress may look like getting through the next feed or asking for a break, rather than completing a long list.'
      ]},
      { heading: 'Notice when you need more than a pause', body: [
        'Feeling overwhelmed can happen, but persistent or worsening anxiety, low mood, panic, numbness, or difficulty functioning deserves support from a doctor, midwife, counsellor, or another qualified professional. You do not need to wait until things feel unbearable to ask.'
      ]}
    ],
    note: 'If you think you may harm yourself or your baby, put the baby somewhere safe, contact local emergency or crisis support, and ask a trusted person to stay with you while help is arranged.'
  },
  {
    ...DISCOVER_ARTICLE_META,
    id: 'breathing', category: 'For you', emoji: '🌬️', title: 'A two-minute pause that needs no silence',
    subtitle: 'A small grounding practice for an ordinary, noisy day.', color: '#EAF2E8', readTime: '2 min practice',
    sections: [
      { heading: 'Settle without making it a performance', body: [
        'Sit or stand somewhere supported. Let your feet rest against the floor if that is comfortable. Unclench your jaw and drop your shoulders only if it feels natural. Keep your eyes open if closing them makes you feel less comfortable.',
        'There is no perfect posture to achieve. The point is to make the next moment a little easier, not to add another task to your day.'
      ]},
      { heading: 'Follow one ordinary breath', body: [
        'Notice the air moving in and out. If it feels comfortable, allow the out-breath to become a little slower. Do not force deep breaths, hold your breath, or try to reach a particular count.',
        'If your mind jumps to the next feed, chore, or worry, notice that it wandered and return to one breath. Wandering attention is normal; it does not mean you are doing it wrong.'
      ]},
      { heading: 'Come back to the room', body: [
        'Name three things you can see, two things you can feel, and one sound you can hear. Then ask: “What would help me in the next ten minutes?” Choose one small next step, or decide that a short rest is enough for now.'
      ]}
    ],
    note: 'Stop if the exercise makes you dizzy, breathless, panicky, or uncomfortable. Grounding can be a useful coping tool, but it is not a substitute for professional care when you need more support.'
  },
  {
    ...DISCOVER_ARTICLE_META,
    id: 'newborn-cues', category: 'Baby care', emoji: '🍼', title: 'Learning your baby’s cues, one day at a time',
    subtitle: 'Look for patterns without expecting every moment to be predictable.', color: '#FBEDE2', readTime: '4 min read',
    sections: [
      { heading: 'Look at the whole picture', body: [
        'Babies communicate through sounds, facial expressions, movements, sucking, and changes in alertness. A single cue does not always mean the same thing. Turning toward a feed, bringing hands to the mouth, fussing, or becoming quieter may be useful clues, depending on the baby and the situation.',
        'Check common needs one at a time: feeding, a nappy change, temperature, comfort, a change of position, or sleep. If one approach does not help, it is okay to pause and reassess rather than assume you have missed something obvious.'
      ]},
      { heading: 'Use notes as a memory aid', body: [
        'A simple record of feeds, sleep, nappies, and anything unusual can help you notice patterns and answer questions at appointments. BabyBlues can hold those notes so you do not have to rely on memory when you are tired.',
        'The log is not a scorecard. Babies vary, and their needs change with age and health. Do not use an app alone to decide whether your baby is getting enough milk or is medically well.'
      ]},
      { heading: 'When to get an individual answer', body: [
        'If feeding is difficult, your baby is unusually sleepy, weight gain is a concern, nappies are much less wet than usual, or something about their behaviour worries you, contact your paediatrician or another qualified healthcare professional. Seek urgent care for trouble breathing, difficulty waking, or other severe or rapidly worsening symptoms.'
      ]}
    ]
  },
  {
    ...DISCOVER_ARTICLE_META,
    id: 'rest', category: 'Recovery', emoji: '🌙', title: 'Rest in fragments, while keeping sleep safe',
    subtitle: 'Protect your recovery without relying on a perfect routine.', color: '#EAEFF8', readTime: '4 min read',
    sections: [
      { heading: 'Plan a handover, not a perfect schedule', body: [
        'If another trusted adult is available, agree on a specific rest window and who is responsible for the baby during it. Even a short, protected block can reduce the number of decisions you have to make. Be clear about when the handover starts and ends.',
        'If sleep does not come, quiet rest may still give you a pause. You do not need to judge yourself for being unable to fall asleep on demand.'
      ]},
      { heading: 'Make the next hour easier', body: [
        'Keep water, a snack, your phone charger, and essentials within reach. Ask visitors to help with food, dishes, laundry, or errands instead of expecting yourself to host them. Postpone non-urgent tasks when you can.',
        'If you are becoming drowsy while holding or feeding your baby, think ahead about how to put the baby down safely. Sofas and armchairs are especially risky places to fall asleep with a baby.'
      ]},
      { heading: 'Keep the baby’s sleep space simple', body: [
        'For every sleep, place your baby on their back on a firm, flat sleep surface designed for infants. Keep the sleep space clear of pillows, loose blankets, soft toys, and other soft objects. Follow the current guidance provided by your paediatrician or local public-health authority.',
        'If you feel yourself nodding off while holding your baby, place them in their own safe sleep space before you rest. Ask another adult to take over when one is available.'
      ]}
    ],
    note: 'If exhaustion feels unsafe or unmanageable, or you are worried about your physical recovery or mood, contact your healthcare professional rather than trying to push through alone.'
  },
  {
    ...DISCOVER_ARTICLE_META,
    id: 'asking-help', category: 'Recovery', emoji: '🤲', title: 'Build a support plan you can actually use',
    subtitle: 'Turn kind offers into practical help for real-life days.', color: '#F8EDE7', readTime: '3 min read',
    sections: [
      { heading: 'Write down the invisible tasks', body: [
        'Baby care is only one part of the work. Meals, laundry, groceries, cleaning, transport, appointments, paperwork, and answering messages all take energy. Choose the two tasks that are making today harder rather than trying to list everything.',
        'You do not have to coordinate every detail yourself. Asking someone to own a task from start to finish can be more useful than asking them to “help out” generally.'
      ]},
      { heading: 'Match each task to a person and a time', body: [
        'Try: “Could you bring lunch tomorrow around 1?” “Can you pick up these supplies on your way over?” or “Could you sit with me while I call the clinic?” A time and a clear task make it easier to answer.',
        'If someone cannot do the exact task, you can ask if another option works. If nobody is available, consider whether a healthcare professional, local parent group, community organisation, or social worker can point you toward support.'
      ]},
      { heading: 'Ask for the kind of emotional support you want', body: [
        'You might say, “I do not need solutions right now; could you listen for ten minutes?” or “Can you check in with me tomorrow?” You are allowed to ask for company without turning the conversation into a problem-solving session.',
        'Keep the plan flexible. Your needs may change from one day to the next, and accepting help does not mean you have to repay it immediately.'
      ]}
    ]
  },
  {
    ...DISCOVER_ARTICLE_META,
    id: 'crying', category: 'Baby care', emoji: '🧸', title: 'When the crying will not stop',
    subtitle: 'A calm checklist for your baby, and a safety plan for you.', color: '#F7E9E6', readTime: '4 min read',
    sections: [
      { heading: 'Check the basics, one by one', body: [
        'Check whether your baby may be hungry, needs a nappy change, feels too warm or cool, needs a burp, or wants to be held. A quieter room, a gentle voice, or slow rocking may help some babies. Not every method works every time, and crying can continue even when you are caring for your baby well.',
        'Notice what is different from your baby’s usual behaviour. If the cry sounds unusual, your baby seems in pain, is refusing feeds, is difficult to wake, has breathing trouble, or you are worried they may be unwell, seek medical advice promptly.'
      ]},
      { heading: 'If you are reaching your limit, pause safely', body: [
        'Place your baby on their back in a clear, safe cot or crib, then step into another room for a few minutes to calm down. Call someone you trust if you can. Return to check on your baby once you feel steadier, or arrange for another safe adult to take over.',
        'Never shake, hit, or handle a baby roughly. If you think you might lose control, put the baby down in a safe place and get immediate help from another adult or local emergency service.'
      ]},
      { heading: 'You can ask for help before it becomes a crisis', body: [
        'Persistent crying can be draining, especially with little sleep. If a baby under 3 months old cries nonstop for more than 2 hours and cannot be consoled, contact your paediatrician or seek care now, even if no other symptoms are present. For other persistent crying, tell your paediatrician or healthcare professional how long it happens, when it tends to start, how feeding is going, and what you have already tried. A short note can make the conversation easier.'
      ]}
    ],
    note: 'Seek urgent medical care for severe or rapidly worsening symptoms, breathing difficulty, a baby who is hard to wake, or any situation that feels like an emergency. This guide cannot determine why a baby is crying.'
  },
  {
    ...DISCOVER_ARTICLE_META,
    id: 'feeding', category: 'Baby care', emoji: '🥛', title: 'Feeding questions without the guilt spiral',
    subtitle: 'Use observations to guide a conversation, not to grade yourself.', color: '#F4EEDF', readTime: '4 min read',
    sections: [
      { heading: 'Watch your baby, not just the clock', body: [
        'Feeding patterns can vary by age, whether a baby is breastfed or formula-fed, and individual needs. Early hunger cues can include stirring, bringing hands to the mouth, or turning toward a feed. Crying can be a later cue, but cues are not a perfect checklist.',
        'Follow the feeding plan recommended for your baby. Do not force a feed or change a prescribed plan based only on an app or a general article. If you are unsure how often or how much your baby should feed, ask your paediatrician, midwife, or qualified lactation professional.'
      ]},
      { heading: 'Record the details that help', body: [
        'When useful, note the time, feeding type, amount if measured, and anything you noticed such as difficulty latching, repeated coughing, or unusual sleepiness. Keep the record simple enough that it does not become another source of pressure.',
        'A single feed may not tell the full story. A clinician can consider your baby’s age, weight trend, feeding behaviour, hydration, and overall health together.'
      ]},
      { heading: 'When to contact your care team', body: [
        'Reach out if feeding repeatedly hurts, your baby struggles to feed, seems unusually sleepy, is not waking for feeds as expected, has fewer wet nappies than usual, or you are concerned about growth. Difficulty breathing, marked unresponsiveness, or other severe symptoms need urgent care.'
      ]}
    ],
    note: 'This article is general information. Feeding advice should be tailored to your baby, especially for newborns, premature babies, or babies with medical conditions.'
  },
  {
    ...DISCOVER_ARTICLE_META,
    id: 'postpartum-feelings', category: 'Recovery', emoji: '💙', title: 'Your feelings deserve care after birth, too',
    subtitle: 'You can love your baby and still find this transition difficult.', color: '#EAF0F8', readTime: '4 min read',
    sections: [
      { heading: 'There is no single correct way to feel', body: [
        'You may feel joy, worry, grief for your old routine, irritability, numbness, or several of these at once. A difficult feeling does not make you a bad parent, and gratitude does not cancel out exhaustion or distress.',
        'Try describing the experience plainly to someone safe: “I feel on edge most of the day,” “I cannot switch off my worries,” or “I do not feel like myself.” Clear words can make it easier to explain what is happening.'
      ]},
      { heading: 'Notice changes that deserve support', body: [
        'If low mood, anxiety, panic, intrusive worries, hopelessness, or difficulty managing daily life persists, worsens, or feels frightening, contact your doctor, midwife, or a qualified mental-health professional. You do not need to diagnose yourself before asking for help.',
        'Tell the person you contact how long you have felt this way, whether you can rest when given the chance, and how the feelings affect your day. If speaking feels difficult, write it down or ask someone trusted to join you.'
      ]},
      { heading: 'Make one small connection today', body: [
        'Send a short message to someone you trust, ask for a check-in, or tell your healthcare team directly that you are struggling. You deserve support for your wellbeing, not only advice about caring for the baby.'
      ]}
    ],
    note: 'If you may harm yourself or your baby, feel unable to keep either of you safe, or experience a mental-health emergency, seek urgent local emergency or crisis support now and ask a trusted person to stay with you.'
  },
  {
    ...DISCOVER_ARTICLE_META,
    id: 'visitors', category: 'Recovery', emoji: '🚪', title: 'Visitors, boundaries, and the right to recover',
    subtitle: 'You can welcome people without becoming their host.', color: '#F8EDE7', readTime: '3 min read',
    sections: [
      { heading: 'Decide what a visit should look like', body: [
        'Before agreeing to a visit, ask yourself what would actually help: a short visit, a meal left at the door, practical chores, or no visitors today. Your answer can change from one day to another.',
        'You do not owe everyone a long explanation. A simple “We are keeping visits short while we settle in” is enough.'
      ]},
      { heading: 'Use a sentence you can repeat', body: [
        'Try: “Today is not a good day for visitors, but we will message when we are ready.” Or: “We would love the food drop-off, but we are not up for hosting.” If you want help, ask a partner or trusted relative to communicate the boundary for you.',
        'If someone visits, it is reasonable to ask them to wash their hands, stay away when unwell, and follow your preferences for holding or kissing the baby. You can change your mind at any time.'
      ]},
      { heading: 'Make visits useful, if you want them', body: [
        'A helpful visitor might prepare food, wash dishes, fold laundry, pick up groceries, or hold the baby while you take a shower, if you are comfortable with that. You do not need to tidy the house or serve refreshments first.',
        'Rest and privacy are valid reasons to say no. Protecting your recovery is not the same as rejecting the people who care about you.'
      ]}
    ]
  },
  {
    ...DISCOVER_ARTICLE_META,
    id: 'diaper-notes', category: 'Baby care', emoji: '🧷', title: 'What nappy notes can tell you, and what they cannot',
    subtitle: 'Patterns matter more than turning every change into a calculation.', color: '#F7EFE3', readTime: '3 min read',
    sections: [
      { heading: 'Use a log as a memory aid', body: [
        'Recording wet or dirty nappies can help you remember what happened between feeds and appointments, particularly when you are tired. If your care team has asked you to track changes, follow their instructions and bring the record to your next conversation.',
        'The number and pattern of nappies change as babies grow. A general app entry cannot tell you by itself whether your baby is hydrated, feeding enough, or unwell.'
      ]},
      { heading: 'Notice a change from your baby’s usual pattern', body: [
        'Contact your healthcare professional if nappies are much less wet than usual, you are worried about urine output, or there are concerns about feeding, vomiting, diarrhoea, or weight gain. Mention your baby’s age and when you last noticed a wet nappy.',
        'Seek prompt medical advice if your baby is unusually sleepy, difficult to wake, not feeding, has a dry mouth, or seems unwell. For severe symptoms or an emergency, use local emergency services.'
      ]},
      { heading: 'Keep the record simple', body: [
        'A time and a short note are usually easier to maintain than a long description. You can add details when something changes or when your clinician asks for them. The aim is to support a useful conversation, not to create another thing to get perfect.'
      ]}
    ],
    note: 'If you have been given a specific monitoring plan by your baby’s clinician, use that plan instead of general guidance in this article.'
  },
  {
    ...DISCOVER_ARTICLE_META,
    id: 'care-team', category: 'For you', emoji: '🩺', title: 'Make the next appointment easier to use',
    subtitle: 'You do not need to remember every question while you are in the room.', color: '#EAEFF0', readTime: '3 min read',
    sections: [
      { heading: 'Write the three questions that matter most', body: [
        'Before the appointment, write down the biggest concern, a change you have noticed, and one thing you want to understand before you leave. If there are several questions, start with the ones that affect safety, feeding, recovery, or your ability to cope day to day.',
        'Bring notes from BabyBlues if they help: care logs, feeding observations, sleep concerns, or a brief record of your mood. You do not need to collect data for its own sake; share only what is relevant and comfortable.'
      ]},
      { heading: 'Say what you are unsure about', body: [
        'It is fine to say, “I am not sure what is normal here,” or “Could you show me what you mean?” Ask what changes would warrant a call, how quickly you should seek help, and who to contact outside normal clinic hours.',
        'If an explanation feels unclear, ask the clinician to repeat it in plain language or write down the next steps. You are allowed to ask questions more than once.'
      ]},
      { heading: 'Include your own recovery', body: [
        'Mention your sleep, pain, mood, anxiety, feeding concerns, or practical barriers to getting care. Your wellbeing is part of the conversation too. If you are worried you may not remember everything, consider bringing a trusted person, if that is comfortable for you.'
      ]}
    ],
    note: 'For urgent or severe symptoms, do not wait for a routine appointment. Contact your healthcare team promptly or use local emergency services when appropriate.'
  },
  {
    ...DISCOVER_ARTICLE_META,
    id: 'shared-load', category: 'For you', emoji: '🧩', title: 'Make the mental load visible',
    subtitle: 'A fair handover covers remembering, planning, and finishing, not just doing.', color: '#F0EAF5', readTime: '3 min read',
    sections: [
      { heading: 'Name the whole task', body: [
        '“Can you help with the baby?” can leave one person still responsible for deciding what needs doing. Instead, hand over a complete task: check the supplies, make the list, buy what is missing, and put it away; or plan dinner, prepare it, and clean up afterward.',
        'Choose a handover that fits what each person can realistically do. The aim is to reduce the number of decisions one person carries, not to create a new scorecard.'
      ]},
      { heading: 'Agree on a clear starting point', body: [
        'Decide who is responsible, when the task will happen, and what “done” means. For baby care, make sure everyone knows the current care plan, safe-sleep routine, and how to get help if they are worried.',
        'A written shared list can prevent repeated conversations. Keep it short and review it together when the routine changes.'
      ]},
      { heading: 'Review without keeping score', body: [
        'Once a day or week, ask: “What has been hardest, and what can we simplify?” If a plan is not working, adjust it. Recovery, work, and baby needs can change quickly, so a fair arrangement may need to change too.'
      ]}
    ]
  }
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [babies, setBabies] = useState<Baby[]>([]);
  const [selectedBabyId, setSelectedBabyId] = useState('');
  const [loadingBabies, setLoadingBabies] = useState(false);
  const [babyName, setBabyName] = useState('');
  const [birthDate, setBirthDate] = useState('');

  const [eventType, setEventType] = useState<EventType>('feeding');
  const [eventDetails, setEventDetails] = useState('');
  const [events, setEvents] = useState<CareEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  
  const [feedingType, setFeedingType] = useState('breastfeeding');
  const [amountMl, setAmountMl] = useState('');
  const [sleepStart, setSleepStart] = useState('');
    const [diaperType, setDiaperType] = useState('wet');

type WellbeingCheckin = {
  id: string;
  mood: number;
  stress: number;
  energy: number;
  sleep_hours: number | null;
  appetite: number | null;
  created_at: string;
};

type AIObservation = {
  key: string;
  title: string;
  detail: string;
  direction: 'improving' | 'worsening' | 'stable' | 'insufficient_data' | 'context_only';
  currentAverage?: number | null;
  previousAverage?: number | null;
  change?: number | null;
  currentCount?: number;
  previousCount?: number;
};

type AIWellbeingAnalysis = {
  generatedAt: string;
  windowDays: number;
  features: {
    currentCheckinCount: number;
    previousCheckinCount: number;
    signals: AIObservation[];
  };
  interpretation: {
    summary: string;
    context: string;
    nextSteps: string[];
    disclaimer: string;
  };
  meta?: {
    provider?: string;
    providerError?: string | null;
    comparisonEligible?: boolean;
    notice?: string;
  };
};


const [mood, setMood] = useState(3);
const [stress, setStress] = useState(3);
const [energy, setEnergy] = useState(3);
const [appetite, setAppetite] = useState(3);
const [sleepHours, setSleepHours] = useState('');
const [checkins, setCheckins] = useState<WellbeingCheckin[]>([]);
const [savingCheckin, setSavingCheckin] = useState(false);
const [activeTab, setActiveTab] = useState<'space' | 'baby' | 'insights' | 'discover' | 'community'>('space');
const [spaceMode, setSpaceMode] = useState<'haven' | 'garden' | 'nest' | 'safe'>('haven');
const [hydrationCups, setHydrationCups] = useState(3);
const [bloomDew, setBloomDew] = useState(140);
const [gardenNurtured, setGardenNurtured] = useState(false);
const [activeNestTrack, setActiveNestTrack] = useState('Womb hum & soft rain');
const [nestSessionStarted, setNestSessionStarted] = useState(false);
const [breathingPhase, setBreathingPhase] = useState<'Inhale' | 'Hold' | 'Release'>('Inhale');
const [showCheckinForm, setShowCheckinForm] = useState(false);
const [aiSharingConsent, setAiSharingConsent] = useState(false);
const [aiConsentLoading, setAiConsentLoading] = useState(false);
const [aiConsentSetupReady, setAiConsentSetupReady] = useState(false);
const [aiAnalysis, setAiAnalysis] = useState<AIWellbeingAnalysis | null>(null);
const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
const [aiAnalysisError, setAiAnalysisError] = useState('');
const [supportData, setSupportData] = useState<SupportLevelResponse | null>(null);
const [supportLoading, setSupportLoading] = useState(false);
const [supportError, setSupportError] = useState('');
const [supportReloadKey, setSupportReloadKey] = useState(0);
const [screeningOpen, setScreeningOpen] = useState(false);
const [screeningAnswers, setScreeningAnswers] = useState<Array<number | null>>(Array(9).fill(null));
const [screeningDifficulty, setScreeningDifficulty] = useState<number | null>(null);
const [screeningSaving, setScreeningSaving] = useState(false);
const [screeningError, setScreeningError] = useState('');
const [screeningResult, setScreeningResult] = useState<Phq9Result | null>(null);

const [discoverCategory, setDiscoverCategory] = useState<DiscoverCategory>('All');
const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
const [communityLoading, setCommunityLoading] = useState(false);
const [isCommunityModerator, setIsCommunityModerator] = useState(false);
const [moderationReports, setModerationReports] = useState<CommunityReport[]>([]);
const [moderationBusyId, setModerationBusyId] = useState<string | null>(null);
const [communityTopic, setCommunityTopic] = useState<CommunityTopic>('Support');
const [communityDraft, setCommunityDraft] = useState('');
const [communityNickname, setCommunityNickname] = useState('');
const [communitySaving, setCommunitySaving] = useState(false);
const [communityStatus, setCommunityStatus] = useState('');


  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setMessage(error.message);
      setSession(data.session);
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);


  useEffect(() => {
    let alive = true;

    if (!session?.user.id) {
      setAiSharingConsent(false);
      setAiConsentSetupReady(false);
      setAiAnalysis(null);
      setAiAnalysisError('');
      return;
    }

    async function loadAISharingConsent() {
      setAiConsentLoading(true);
      const { data, error } = await supabase
        .from('wellbeing_analysis_preferences')
        .select('ai_sharing_enabled')
        .eq('user_id', session!.user.id)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        setAiSharingConsent(false);
        setAiConsentSetupReady(false);
        setAiAnalysisError('AI consent setup is not installed yet. Run the supplied BabyBlues AI consent SQL migration first.');
      } else {
        setAiSharingConsent(data?.ai_sharing_enabled === true);
        setAiConsentSetupReady(true);
        setAiAnalysisError('');
      }
      setAiConsentLoading(false);
    }

    loadAISharingConsent();
    return () => { alive = false; };
  }, [session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) {
      setBabies([]);
      setSelectedBabyId('');
      setEvents([]);
      return;
    }

    let alive = true;

    async function loadBabies() {
      setLoadingBabies(true);

      const { data, error } = await supabase
        .from('babies')
        .select('id, display_name, date_of_birth')
        .order('created_at', { ascending: false });

      if (!alive) return;

      if (error) {
        setStatus(error.message);
      } else {
        const rows = (data ?? []) as Baby[];
        setBabies(rows);

        setSelectedBabyId((current) =>
          rows.some((baby) => baby.id === current)
            ? current
            : rows[0]?.id ?? ''
        );
      }

      setLoadingBabies(false);
    }

    loadBabies();

    return () => {
      alive = false;
    };
  }, [session?.user.id]);

  useEffect(() => {
    if (!selectedBabyId || !session?.user.id) {
      setEvents([]);
      return;
    }

    let alive = true;

    async function loadEvents() {
      const { data, error } = await supabase
        .from('care_logs')
        .select('id, event_type, logged_at, details, feeding_type, amount_ml, sleep_started_at, sleep_ended_at, diaper_type')
        .eq('baby_id', selectedBabyId)
        .order('logged_at', { ascending: false })
        .limit(30);

      if (!alive) return;

      if (error) {
        setStatus(error.message);
      } else {
        setEvents((data ?? []) as CareEvent[]);
      }
    }

    loadEvents();

    return () => {
      alive = false;
    };
  }, [selectedBabyId, session?.user.id]);
  
  useEffect(() => {
    if (!session?.user.id) {
      setCheckins([]);
      return;
    }

    let alive = true;

    async function loadCheckins() {
      const { data, error } = await supabase
        .from('wellbeing_checkins')
        .select('id, mood, stress, energy, sleep_hours, appetite, created_at')
        .order('created_at', { ascending: false })
        .limit(14);

      if (!alive) return;

      if (error) {
        setStatus(error.message);
      } else {
        setCheckins((data ?? []) as WellbeingCheckin[]);
      }
    }

    loadCheckins();

    return () => {
      alive = false;
    };
  }, [session?.user.id]);

  // Support level: rule-based, no AI. Reloads when the Reflections tab opens or a new check-in arrives.
  useEffect(() => {
    if (!session?.access_token) {
      setSupportData(null);
      setSupportError('');
      return;
    }
    if (activeTab !== 'insights') return;

    const accessToken = session.access_token;
    let alive = true;

    async function loadSupportLevel() {
      setSupportLoading(true);
      setSupportError('');
      try {
        const result = await fetchSupportLevel({
          apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
          accessToken,
          region: 'IN',
        });
        if (alive) setSupportData(result);
      } catch (error) {
        if (alive) {
          setSupportData(null);
          setSupportError(error instanceof Error ? error.message : 'The support summary is unavailable.');
        }
      } finally {
        if (alive) setSupportLoading(false);
      }
    }

    void loadSupportLevel();

    return () => {
      alive = false;
    };
  }, [session?.access_token, activeTab, checkins[0]?.id, supportReloadKey]);

  useEffect(() => {
    if (!session?.user.id) {
      setCommunityPosts([]);
      setCommunityNickname('');
      setIsCommunityModerator(false);
      setModerationReports([]);
      return;
    }

    let alive = true;
    setCommunityNickname((current) => current || `Parent${session.user.id.slice(-4).toUpperCase()}`);

    async function loadCommunityData() {
      setCommunityLoading(true);
      const { data: moderatorRow, error: moderatorError } = await supabase
        .from('community_moderators')
        .select('user_id')
        .eq('user_id', session!.user.id)
        .maybeSingle();
      if (!alive) return;
      const moderator = !moderatorError && !!moderatorRow;
      setIsCommunityModerator(moderator);

      const { data, error } = await supabase
        .from('community_posts')
        .select('id, author_id, display_name, topic, body, moderation_status, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!alive) return;
      if (error) {
        setCommunityStatus('Community setup is not complete yet. Run the latest community SQL setup in Supabase, then reload this tab.');
      } else {
        setCommunityPosts((data ?? []) as CommunityPost[]);
      }

      if (moderator) {
        const { data: reports, error: reportsError } = await supabase
          .from('community_reports')
          .select('id, post_id, reporter_id, reason, created_at, post:community_posts(id, display_name, body, moderation_status)')
          .order('created_at', { ascending: true })
          .limit(100);
        if (!alive) return;
        if (!reportsError) setModerationReports((reports ?? []) as unknown as CommunityReport[]);
        else setCommunityStatus('Moderator access is active, but reports could not be loaded. Check the latest SQL policies.');
      } else {
        setModerationReports([]);
      }
      setCommunityLoading(false);
    }

    void loadCommunityData();
    return () => { alive = false; };
  }, [session?.user.id]);

  async function moderateCommunityPost(post: CommunityPost, nextStatus: 'approved' | 'rejected') {
    if (!isCommunityModerator) {
      setCommunityStatus('You do not have moderator access.');
      return;
    }
    setModerationBusyId(post.id);
    const { error } = await supabase
      .from('community_posts')
      .update({ moderation_status: nextStatus })
      .eq('id', post.id);
    setModerationBusyId(null);
    if (error) {
      setCommunityStatus('Could not update this post. Confirm the moderator SQL migration has been run.');
      return;
    }
    setCommunityPosts((current) => current.map((item) => item.id === post.id ? { ...item, moderation_status: nextStatus } : item));
    setModerationReports((current) => current.map((report) => report.post_id === post.id && report.post ? { ...report, post: { ...report.post, moderation_status: nextStatus } } : report));
    setCommunityStatus(nextStatus === 'approved' ? 'Post approved and visible to the community.' : 'Post rejected and hidden from the community.');
  }

  function confirmModerateCommunityPost(post: CommunityPost, nextStatus: 'approved' | 'rejected') {
    Alert.alert(
      nextStatus === 'approved' ? 'Approve this post?' : 'Reject this post?',
      nextStatus === 'approved' ? 'This post will become visible to all community members.' : 'This post will remain hidden from other community members.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: nextStatus === 'approved' ? 'Approve' : 'Reject', style: nextStatus === 'rejected' ? 'destructive' : 'default', onPress: () => { void moderateCommunityPost(post, nextStatus); } },
      ],
    );
  }

  async function submitCommunityPost() {
    if (!session?.user.id) return;
    const body = communityDraft.trim();
    const nickname = communityNickname.trim();
    if (!body) {
      setCommunityStatus('Write a little something before posting.');
      return;
    }
    if (body.length > 600) {
      setCommunityStatus('Keep posts to 600 characters or fewer.');
      return;
    }
    if (!nickname || nickname.length > 24) {
      setCommunityStatus('Choose a display name between 1 and 24 characters.');
      return;
    }

    setCommunitySaving(true);
    setCommunityStatus('');
    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        author_id: session.user.id,
        display_name: nickname,
        topic: communityTopic,
        body,
      })
      .select('id, author_id, display_name, topic, body, moderation_status, created_at')
      .single();
    setCommunitySaving(false);

    if (error) {
      setCommunityStatus('Could not submit your post. Check that the community SQL setup has been run, then try again.');
      return;
    }
    setCommunityDraft('');
    setCommunityPosts((current) => [data as CommunityPost, ...current.filter((post) => post.id !== data.id)]);
    setCommunityStatus('Your post was submitted for review. It will appear to everyone after it is approved.');
  }

  async function reportCommunityPost(post: CommunityPost, reason: string) {
    if (!session?.user.id) return;
    const { error } = await supabase.from('community_reports').insert({
      post_id: post.id,
      reporter_id: session.user.id,
      reason,
    });
    if (error) {
      setCommunityStatus('Could not send the report. Please try again later.');
    } else {
      setCommunityStatus('Report submitted. Thank you for helping keep this space respectful.');
    }
  }

  function confirmReportCommunityPost(post: CommunityPost) {
    Alert.alert('Report this post', 'Choose the reason that best fits your concern.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Harmful or abusive', onPress: () => { void reportCommunityPost(post, 'Harmful or abusive'); } },
      { text: 'Medical misinformation', onPress: () => { void reportCommunityPost(post, 'Medical misinformation'); } },
      { text: 'Privacy concern', onPress: () => { void reportCommunityPost(post, 'Privacy concern'); } },
    ]);
  }

  async function deleteCommunityPost(post: CommunityPost) {
    Alert.alert('Delete your post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('community_posts').delete().eq('id', post.id);
        if (error) {
          setCommunityStatus('Could not delete the post. Please try again.');
        } else {
          setCommunityPosts((current) => current.filter((item) => item.id !== post.id));
          setCommunityStatus('Your post was deleted.');
        }
      } },
    ]);
  }


  async function handleAuth() {
    setMessage('');

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setMessage('Enter your email and password.');
      return;
    }

    if (isSignUp && !name.trim()) {
      setMessage('Enter your name.');
      return;
    }

    if (isSignUp && password.length < 8) {
      setMessage('Use a password with at least 8 characters.');
      return;
    }

    setAuthLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { display_name: name.trim() },
          },
        });

        if (error) throw error;

        setMessage(
          data.session
            ? 'Account created.'
            : 'Check your email to confirm your account, then sign in.'
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Authentication failed.'
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function createBaby() {
    if (!session) return;

    const cleanName = babyName.trim();
    const cleanDate = birthDate.trim();

    if (!cleanName) {
      setStatus("Enter the baby's name.");
      return;
    }

    if (
      cleanDate &&
      !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)
    ) {
      setStatus('Use the date format YYYY-MM-DD.');
      return;
    }

    if (cleanDate) {
      const parsed = new Date(`${cleanDate}T00:00:00Z`);

      if (
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== cleanDate
      ) {
        setStatus('Enter a valid calendar date.');
        return;
      }

      if (cleanDate > new Date().toISOString().slice(0, 10)) {
        setStatus('Date of birth cannot be in the future.');
        return;
      }
    }

    setSaving(true);
    setStatus('');

    const { data, error } = await supabase
      .from('babies')
      .insert({
        parent_id: session.user.id,
        display_name: cleanName,
        date_of_birth: cleanDate || null,
      })
      .select('id, display_name, date_of_birth')
      .single();

    setSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setBabies((current) => [data as Baby, ...current]);
    setSelectedBabyId(data.id);
    setBabyName('');
    setBirthDate('');
    setStatus('Baby profile created.');
  }

  async function saveEvent() {
    if (!session || !selectedBabyId) {
      setStatus('Select a baby profile first.');
      return;
    }

    const amount = amountMl.trim() === '' ? null : Number(amountMl);
    const duration = sleepStart.trim() === '' ? null : Number(sleepStart);

    if (
      eventType === 'feeding' &&
      amount !== null &&
      (!Number.isFinite(amount) || amount <= 0 || amount > 10000)
    ) {
      setStatus('Enter a valid feeding amount in ml.');
      return;
    }

    if (
      eventType === 'sleep' &&
      (duration === null ||
        !Number.isFinite(duration) ||
        duration <= 0 ||
        duration > 24)
    ) {
      setStatus('Enter a sleep duration between 0 and 24 hours.');
      return;
    }

    const now = new Date();
    const sleepEnd = now.toISOString();
    const sleepStarted = duration === null
      ? null
      : new Date(now.getTime() - duration * 3600000).toISOString();

    setSaving(true);
    setStatus('');

    const payload = {
      parent_id: session.user.id,
      baby_id: selectedBabyId,
      event_type: eventType,
      details: eventDetails.trim()
        ? { note: eventDetails.trim() }
        : {},
      feeding_type: eventType === 'feeding' ? feedingType : null,
      amount_ml: eventType === 'feeding' ? amount : null,
      sleep_started_at: eventType === 'sleep' ? sleepStarted : null,
      sleep_ended_at: eventType === 'sleep' ? sleepEnd : null,
      diaper_type: eventType === 'diaper' ? diaperType : null,
    };

    const { data, error } = await supabase
      .from('care_logs')
      .insert(payload)
      .select('id, event_type, logged_at, details, feeding_type, amount_ml, sleep_started_at, sleep_ended_at, diaper_type')
      .single();

    setSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setEvents((current) => [data as CareEvent, ...current].slice(0, 30));
    setEventDetails('');
    setAmountMl('');
    setSleepStart('');
    setStatus('Care event saved.');
  }


  async function updateAISharingConsent(nextValue: boolean) {
    if (!session) return;
    setAiConsentLoading(true);
    setAiAnalysisError('');

    const { error } = await supabase
      .from('wellbeing_analysis_preferences')
      .upsert({
        user_id: session.user.id,
        ai_sharing_enabled: nextValue,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    setAiConsentLoading(false);
    if (error) {
      setAiAnalysisError(`Could not save the AI-sharing choice: ${error.message}. Confirm that the supplied AI consent SQL migration has been run.`);
      return;
    }

    setAiSharingConsent(nextValue);
    setAiConsentSetupReady(true);
    if (!nextValue) setAiAnalysis(null);
    setStatus(nextValue
      ? 'AI-assisted reflections enabled. You can request an analysis whenever you choose.'
      : 'AI-assisted reflections disabled; the displayed AI result has been cleared.');
  }

  function closeScreening() {
    setScreeningOpen(false);
    setScreeningAnswers(Array(9).fill(null));
    setScreeningDifficulty(null);
    setScreeningError('');
  }

  async function submitScreening() {
    if (!session) return;
    const result = scorePhq9(screeningAnswers);
    if (!result) {
      setScreeningError('Please answer all nine questions, or choose Not now.');
      return;
    }

    setScreeningSaving(true);
    setScreeningError('');
    const { error } = await supabase.from('screening_responses').insert({
      parent_id: session.user.id,
      instrument: 'phq9',
      answers: screeningAnswers,
      difficulty: screeningDifficulty,
    });
    setScreeningSaving(false);

    // Safety first: always show the result on screen, even if saving failed.
    setScreeningResult(result);
    setScreeningOpen(false);
    if (error) {
      setScreeningError(`Your answers could not be saved (${error.message}). If this keeps happening, run BabyBlues_Screening_Migration.sql in Supabase.`);
    } else {
      setSupportReloadKey((key) => key + 1);
    }
  }

  async function runAIAnalysis() {
    if (!session) return;
    if (!aiSharingConsent) {
      Alert.alert(
        'AI reflections are off',
        'Choose to enable AI-assisted reflections before sending aggregate features to the AI service.'
      );
      return;
    }

    const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
    if (!apiBaseUrl) {
      setAiAnalysisError('Backend URL is missing. Set EXPO_PUBLIC_API_BASE_URL in the mobile project environment, then restart Expo.');
      return;
    }

    setAiAnalysisLoading(true);
    setAiAnalysisError('');
    try {
      const response = await fetch(`${apiBaseUrl}/api/analysis/wellbeing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ windowDays: 28 }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || `Analysis request failed (${response.status}).`);
      }
      setAiAnalysis(payload as AIWellbeingAnalysis);
    } catch (error) {
      setAiAnalysisError(error instanceof Error ? error.message : 'Could not generate the reflection.');
    } finally {
      setAiAnalysisLoading(false);
    }
  }

  async function saveCheckin() {
    if (!session) return;

    const parsedSleep = sleepHours.trim() === ''
      ? null
      : Number(sleepHours);

    if (
      parsedSleep !== null &&
      (!Number.isFinite(parsedSleep) ||
        parsedSleep < 0 ||
        parsedSleep > 24)
    ) {
      setStatus('Sleep must be between 0 and 24 hours.');
      return;
    }

    setSavingCheckin(true);
    setStatus('');

    const { data, error } = await supabase
      .from('wellbeing_checkins')
      .insert({
        parent_id: session.user.id,
        mood,
        stress,
        energy,
        appetite,
        sleep_hours: parsedSleep,
      })
      .select(
        'id, mood, stress, energy, sleep_hours, appetite, created_at'
      )
      .single();

    setSavingCheckin(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setCheckins((current) =>
      [data as WellbeingCheckin, ...current].slice(0, 14)
    );

    setStatus('Your check-in has been saved.');
    setSleepHours('');
    setShowCheckinForm(false);
  }


  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) setStatus(error.message);
    else setStatus('');
  }

  if (checkingSession) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#365B50" />
        <Text>Loading BabyBlues...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <View style={styles.authCard}>
          <Text style={styles.brand}>BabyBlues</Text>
          <Text style={styles.subtitle}>
            A little space for you, too.
          </Text>
          <Text style={styles.heading}>
            {isSignUp ? 'Let’s make a little space for you' : 'Welcome back'}
          </Text>

          {isSignUp && (
            <TextInput
              style={styles.input}
              placeholder="What should we call you?"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {!!message && <Text style={styles.status}>{message}</Text>}

          <TouchableOpacity
            style={styles.primaryButton}
            disabled={authLoading}
            onPress={handleAuth}
          >
            <Text style={styles.primaryButtonText}>
              {authLoading
                ? 'Please wait...'
                : isSignUp
                  ? 'Create account'
                  : 'Sign in'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.link}
            onPress={() => {
              setIsSignUp(!isSignUp);
              setMessage('');
            }}
          >
            <Text style={styles.linkText}>
              {isSignUp
                ? 'Already registered? Sign in'
                : 'New here? Create an account'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const selectedBaby = babies.find((baby) => baby.id === selectedBabyId);
  const displayName = String(
    session.user.user_metadata?.display_name ??
    session.user.email?.split('@')[0] ??
    'there',
  ).split(/[ ._-]/)[0];

  const moodOptions = [
    { value: 1, emoji: '🌧️', label: 'Really hard' },
    { value: 2, emoji: '🌥️', label: 'A little low' },
    { value: 3, emoji: '🌤️', label: 'Somewhere in between' },
    { value: 4, emoji: '☀️', label: 'Pretty good' },
    { value: 5, emoji: '🌈', label: 'Feeling good' },
  ];

  const renderScale = (
    title: string,
    lowLabel: string,
    highLabel: string,
    value: number,
    setValue: (value: number) => void,
  ) => (
    <View style={styles.ratingSection}>
      <Text style={styles.ratingTitle}>{title}</Text>
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((option) => (
          <TouchableOpacity
            key={option}
            accessibilityRole="button"
            accessibilityLabel={`${title}: ${option} out of 5`}
            accessibilityState={{ selected: value === option }}
            style={[styles.ratingButton, value === option && styles.ratingSelected]}
            onPress={() => setValue(option)}
          >
            <Text style={[styles.ratingText, value === option && styles.ratingTextSelected]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleLabel}>{lowLabel}</Text>
        <Text style={styles.scaleLabel}>{highLabel}</Text>
      </View>
    </View>
  );

  const renderBabySelector = () => (
    <>
      {loadingBabies ? (
        <ActivityIndicator color="#6D7F69" />
      ) : babies.length > 0 ? (
        <View style={styles.chipRow}>
          {babies.map((baby) => (
            <TouchableOpacity
              key={baby.id}
              style={[styles.chip, selectedBabyId === baby.id && styles.chipSelected]}
              onPress={() => { setSelectedBabyId(baby.id); setStatus(''); }}
            >
              <Text style={[styles.chipText, selectedBabyId === baby.id && styles.chipTextSelected]}>
                {baby.display_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={styles.bodyText}>Add your little one’s profile to start keeping care notes.</Text>
      )}
    </>
  );

  const renderCareHistory = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Recent little moments</Text>
      {events.length === 0 ? (
        <Text style={styles.mutedText}>Nothing logged yet. That’s okay. You can add a note whenever it’s useful.</Text>
      ) : events.slice(0, 8).map((event) => {
        const eventLabel = event.event_type === 'feeding' ? 'Feeding' : event.event_type === 'sleep' ? 'Sleep' : 'Diaper change';
        let detail = '';
        if (event.event_type === 'feeding') {
          detail = [event.feeding_type?.replace(/_/g, ' '), event.amount_ml != null ? `${event.amount_ml} ml` : ''].filter(Boolean).join(' · ');
        } else if (event.event_type === 'sleep' && event.sleep_started_at && event.sleep_ended_at) {
          const hours = (new Date(event.sleep_ended_at).getTime() - new Date(event.sleep_started_at).getTime()) / 3600000;
          detail = hours > 0 ? `${hours.toFixed(1)} hours` : '';
        } else if (event.event_type === 'diaper') {
          detail = event.diaper_type ? `${event.diaper_type} diaper` : '';
        }
        const note = typeof event.details?.note === 'string' ? event.details.note : '';
        return (
          <View key={event.id} style={styles.historyRow}>
            <View style={styles.historyIcon}><Text style={styles.historyEmoji}>{event.event_type === 'feeding' ? '🍼' : event.event_type === 'sleep' ? '🌙' : '🧷'}</Text></View>
            <View style={styles.historyCopy}>
              <Text style={styles.historyTitle}>{eventLabel}</Text>
              {!!detail && <Text style={styles.mutedText}>{detail}</Text>}
              {!!note && <Text style={styles.mutedText}>{note}</Text>}
              <Text style={styles.smallText}>{new Date(event.logged_at).toLocaleString()}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderSpace = () => {
    const nestTracks = [
      { title: 'Womb hum & soft rain', duration: '15 min', tag: 'Rain ambience', emoji: '🌧️' },
      { title: 'Mother’s chest heartbeat', duration: '20 min', tag: 'Soft, steady rhythm', emoji: '💗' },
      { title: 'Twilight lavender breath', duration: '5 min', tag: 'A short exhale practice', emoji: '🪻' },
    ];

    if (spaceMode === 'garden') {
      const flowers = [
        { name: 'Chamomile of Stillness', stage: 'Full bloom', age: 'A reminder to pause', emoji: '🌼', background: '#FFF4D5' },
        { name: 'Sweet Lavender', stage: 'Budding', age: 'Growing at your pace', emoji: '🪻', background: '#F0E8FA' },
        { name: 'Sage of Self-Kindness', stage: 'Sprout', age: 'Small care still counts', emoji: '🌱', background: '#E8F3E9' },
      ];
      return (
        <>
          <TouchableOpacity style={styles.backButton} onPress={() => setSpaceMode('haven')}>
            <Text style={styles.backButtonText}>‹  Back to Haven</Text>
          </TouchableOpacity>
          <Text style={styles.eyebrow}>THE BLOOM SANCTUARY</Text>
          <Text style={styles.pageTitle}>Your recovery meadow 🌿</Text>
          <Text style={styles.pageSubtitle}>This is a little place to notice your care, not to measure your worth. Nothing withers if you need to rest.</Text>

          <View style={styles.gardenHero}>
            <View style={styles.gardenHeroTop}>
              <Text style={styles.gardenEyebrow}>A GARDEN WITH GRACE</Text>
              <View style={styles.dewBadge}><Text style={styles.dewBadgeText}>💧 {bloomDew} dew</Text></View>
            </View>
            <Text style={styles.gardenTitle}>Things can grow slowly.</Text>
            <Text style={styles.bodyText}>A sip of water, a nap, asking someone to take over, or simply getting through a difficult hour can count as care.</Text>
            <TouchableOpacity
              style={[styles.gardenAction, gardenNurtured && styles.gardenActionDone]}
              disabled={gardenNurtured}
              onPress={() => { setBloomDew((value) => value + 25); setGardenNurtured(true); }}
            >
              <Text style={[styles.gardenActionText, gardenNurtured && styles.gardenActionTextDone]}>{gardenNurtured ? '✓ Meadow nurtured this visit' : '☁️  Nurture your meadow  ·  +25 dew'}</Text>
            </TouchableOpacity>
            <Text style={styles.smallText}>Garden points are just for play. They do not measure recovery or mental health.</Text>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Grown through self-kindness</Text>
            <Text style={styles.mutedText}>3 blooms</Text>
          </View>
          {flowers.map((flower, index) => (
            <View key={flower.name} style={styles.flowerCard}>
              <View style={[styles.flowerIcon, { backgroundColor: flower.background }]}><Text style={styles.flowerEmoji}>{flower.emoji}</Text></View>
              <View style={styles.flowerCopy}>
                <Text style={styles.flowerName}>{flower.name}</Text>
                <Text style={styles.smallText}>{flower.age}</Text>
                <View style={styles.flowerStage}><Text style={styles.flowerStageText}>{flower.stage}</Text></View>
              </View>
              <Text style={styles.flowerTier}>Tier {index + 1}</Text>
            </View>
          ))}

          <View style={styles.graceCard}>
            <Text style={styles.featureTitle}>🫖  Grace Day rule</Text>
            <Text style={styles.bodyText}>There are no broken streaks here. If today is a day for feeding, resting, or asking for help, your meadow can wait. Rest counts as progress.</Text>
          </View>
        </>
      );
    }

    if (spaceMode === 'nest') {
      return (
        <>
          <TouchableOpacity style={styles.backButton} onPress={() => setSpaceMode('haven')}>
            <Text style={styles.backButtonText}>‹  Back to Haven</Text>
          </TouchableOpacity>
          <Text style={styles.eyebrow}>A QUIETER CORNER</Text>
          <Text style={styles.pageTitle}>Audio Nest 🎧</Text>
          <Text style={styles.pageSubtitle}>A small pause for your body. Keep your eyes open, change position, or stop whenever you need to.</Text>

          <View style={styles.nestHero}>
            <Text style={styles.nestEyebrow}>GENTLE RESET · 3 MINUTES</Text>
            <View style={styles.nestOrb}><Text style={styles.nestOrbEmoji}>{nestSessionStarted ? '🌬️' : '🌊'}</Text></View>
            <Text style={styles.nestTitle}>{activeNestTrack}</Text>
            <Text style={styles.nestDescription}>{nestSessionStarted ? `Try a comfortable breath. The current cue is: ${breathingPhase.toLowerCase()}.` : 'Unclench your jaw if you want to. Let your shoulders settle only if it feels comfortable.'}</Text>
            <TouchableOpacity style={styles.nestPlayButton} onPress={() => setNestSessionStarted((value) => !value)}>
              <Text style={styles.nestPlayButtonText}>{nestSessionStarted ? 'Pause breathing practice' : 'Begin breathing practice'}</Text>
            </TouchableOpacity>
            {nestSessionStarted && (
              <View style={styles.breathingSteps}>
                {(['Inhale', 'Hold', 'Release'] as const).map((phase) => (
                  <TouchableOpacity key={phase} style={[styles.breathingStep, breathingPhase === phase && styles.breathingStepActive]} onPress={() => setBreathingPhase(phase)}>
                    <Text style={[styles.breathingStepText, breathingPhase === phase && styles.breathingStepTextActive]}>{phase}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Choose a soundscape</Text>
            {nestTracks.map((track) => (
              <TouchableOpacity key={track.title} style={[styles.trackRow, activeNestTrack === track.title && styles.trackRowSelected]} onPress={() => { setActiveNestTrack(track.title); setNestSessionStarted(false); }}>
                <View style={styles.trackEmojiBox}><Text style={styles.trackEmoji}>{track.emoji}</Text></View>
                <View style={styles.trackCopy}>
                  <Text style={styles.trackTitle}>{track.title}</Text>
                  <Text style={styles.mutedText}>{track.tag} · {track.duration}</Text>
                </View>
                <Text style={styles.trackSelect}>{activeNestTrack === track.title ? 'Selected' : 'Choose'}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.smallText}>Audio playback is not connected in this build. The soundscape list is a UI preview; the guided breathing controls work without audio.</Text>
          </View>
        </>
      );
    }

    if (spaceMode === 'safe') {
      return (
        <>
          <TouchableOpacity style={styles.backButton} onPress={() => setSpaceMode('haven')}>
            <Text style={styles.backButtonText}>‹  Back to Haven</Text>
          </TouchableOpacity>
          <Text style={styles.eyebrow}>SUPPORT WITHOUT JUDGEMENT</Text>
          <Text style={styles.pageTitle}>Safe Harbor 🛟</Text>
          <Text style={styles.pageSubtitle}>You deserve human support, whether this is a hard hour or something more urgent.</Text>

          <View style={styles.safeIntroCard}>
            <Text style={styles.safeIntroTitle}>You do not have to handle this alone.</Text>
            <Text style={styles.bodyText}>Unexpected tears, anxiety, numbness, or intrusive thoughts can be frightening. You are not a bad parent for needing help. A qualified professional can help you work out what is happening.</Text>
          </View>

          <View style={[styles.card, styles.crisisCard]}>
            <Text style={styles.cardTitle}>Immediate human support · India</Text>
            <Text style={styles.bodyText}>BabyBlues is not monitored in real time. If you or your baby may be in immediate danger, call emergency services now.</Text>
            {renderCrisisContacts([STATIC_CRISIS_RESOURCES_IN.emergency, ...STATIC_CRISIS_RESOURCES_IN.support])}
          </View>

          <View style={styles.groundingCard}>
            <Text style={styles.groundingEyebrow}>A SMALL GROUNDING PAUSE</Text>
            <View style={styles.groundingOrb}><Text style={styles.groundingPhase}>{breathingPhase}</Text></View>
            <Text style={styles.bodyText}>Choose a gentle cue at your own pace. Do not force deep breaths or hold your breath if it feels uncomfortable.</Text>
            <View style={styles.breathingSteps}>
              {(['Inhale', 'Hold', 'Release'] as const).map((phase) => (
                <TouchableOpacity key={phase} style={[styles.breathingStep, breathingPhase === phase && styles.breathingStepActive]} onPress={() => setBreathingPhase(phase)}>
                  <Text style={[styles.breathingStepText, breathingPhase === phase && styles.breathingStepTextActive]}>{phase}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Text style={styles.smallText}>This page is a support guide, not emergency monitoring or a substitute for clinical care.</Text>
        </>
      );
    }

    return (
      <>
        <View style={styles.greetingRow}>
          <View style={styles.greetingCopy}>
            <Text style={styles.eyebrow}>YOUR LITTLE SPACE</Text>
            <Text style={styles.greetingTitle}>Hi, {displayName} 🌿</Text>
            <Text style={styles.greetingSubtitle}>You’re caring for someone new. Your care matters, too.</Text>
          </View>
          <View style={styles.sunBadge}><Text style={styles.sunEmoji}>☀️</Text></View>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>A MOMENT FOR YOU</Text>
          <Text style={styles.heroTitle}>How does your body feel right now?</Text>
          <Text style={styles.heroBody}>No right answers. Heavy or light, all of it is welcome.</Text>
          <View style={styles.moodGrid}>
            {moodOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.moodOption, mood === option.value && styles.moodOptionSelected]}
                onPress={() => { setMood(option.value); setShowCheckinForm(true); }}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: mood === option.value }}
              >
                <Text style={styles.moodEmoji}>{option.emoji}</Text>
                <Text style={[styles.moodLabel, mood === option.value && styles.moodLabelSelected]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {showCheckinForm ? (
            <View style={styles.checkinDetails}>
              <Text style={styles.cardTitle}>A little more, only if you want</Text>
              {renderScale('How stressful has today felt?', 'Not much', 'A lot', stress, setStress)}
              {renderScale('How’s your energy?', 'Running low', 'Full of energy', energy, setEnergy)}
              {renderScale('How’s eating been?', 'Hard today', 'Going okay', appetite, setAppetite)}
              <TextInput
                style={styles.input}
                placeholder="Hours of sleep in the last 24 hours (optional)"
                placeholderTextColor="#98938E"
                value={sleepHours}
                onChangeText={setSleepHours}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity style={styles.primaryButton} onPress={saveCheckin} disabled={savingCheckin}>
                <Text style={styles.primaryButtonText}>{savingCheckin ? 'Saving…' : 'Save my check-in'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quietButton} onPress={() => setShowCheckinForm(false)}>
                <Text style={styles.quietButtonText}>Maybe later</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={() => setShowCheckinForm(true)}>
              <Text style={styles.primaryButtonText}>Take a moment for myself</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.selfCareCard}>
          <View style={styles.sectionIcon}><Text style={styles.sectionEmoji}>☕</Text></View>
          <View style={styles.featureCopy}>
            <Text style={styles.featureTitle}>Grace Day rule is active</Text>
            <Text style={styles.bodyText}>If today is hard, your progress does not disappear. Rest, feeding on demand, and asking someone to take over count as real work.</Text>
            <Text style={styles.featureFootnote}>You do not have to earn a break.</Text>
          </View>
        </View>

        <View style={styles.questSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Soft quests</Text>
            <Text style={styles.questDewPill}>+40 Bloom Dew</Text>
          </View>
          <View style={styles.questRow}>
            <View style={[styles.questIcon, { backgroundColor: '#EAF2F8' }]}><Text style={styles.questEmoji}>💧</Text></View>
            <View style={styles.questCopy}>
              <Text style={styles.questTitle}>Sip water or tea</Text>
              <Text style={styles.questSubtitle}>{Math.min(hydrationCups, 6)} of 6 cups noted · just a gentle reminder</Text>
            </View>
            <TouchableOpacity style={styles.questButton} disabled={hydrationCups >= 6} onPress={() => setHydrationCups((value) => Math.min(value + 1, 6))}>
              <Text style={styles.questButtonText}>{hydrationCups >= 6 ? 'Done' : '+1 cup'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.questRow} onPress={() => setSpaceMode('nest')}>
            <View style={[styles.questIcon, { backgroundColor: '#EAF3EB' }]}><Text style={styles.questEmoji}>🎧</Text></View>
            <View style={styles.questCopy}>
              <Text style={styles.questTitle}>Take a two-minute pause</Text>
              <Text style={styles.questSubtitle}>Breathing practice, no perfect silence needed</Text>
            </View>
            <Text style={styles.questChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.questRow, styles.questRowHighlighted]} onPress={() => { setActiveTab('insights'); setScreeningResult(null); setScreeningOpen(true); }}>
            <View style={[styles.questIcon, { backgroundColor: '#E07A5F' }]}><Text style={styles.questEmoji}>✨</Text></View>
            <View style={styles.questCopy}>
              <Text style={styles.questTitle}>Gentle wellbeing screen</Text>
              <Text style={styles.questSubtitle}>Optional PHQ-9 · about two minutes · not a diagnosis</Text>
            </View>
            <Text style={styles.questButtonText}>Start</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your small-care corner</Text>
        </View>
        <View style={styles.shortcutGrid}>
          <TouchableOpacity style={styles.shortcutCard} onPress={() => setSpaceMode('garden')}>
            <Text style={styles.shortcutEmoji}>🌼</Text>
            <Text style={styles.shortcutTitle}>Bloom Garden</Text>
            <Text style={styles.shortcutDescription}>Nurture a meadow, never a streak.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shortcutCard} onPress={() => setSpaceMode('nest')}>
            <Text style={styles.shortcutEmoji}>🎧</Text>
            <Text style={styles.shortcutTitle}>Audio Nest</Text>
            <Text style={styles.shortcutDescription}>Find a slower moment for yourself.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shortcutCard} onPress={() => setSpaceMode('safe')}>
            <Text style={styles.shortcutEmoji}>🛟</Text>
            <Text style={styles.shortcutTitle}>Safe Harbor</Text>
            <Text style={styles.shortcutDescription}>Trusted support when things feel heavy.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shortcutCard} onPress={() => setActiveTab('baby')}>
            <Text style={styles.shortcutEmoji}>🧸</Text>
            <Text style={styles.shortcutTitle}>Baby care</Text>
            <Text style={styles.shortcutDescription}>Keep feeding, sleep and diaper notes together.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shortcutCard} onPress={() => setActiveTab('discover')}>
            <Text style={styles.shortcutEmoji}>📖</Text>
            <Text style={styles.shortcutTitle}>Discover</Text>
            <Text style={styles.shortcutDescription}>Practical reads for rest and new-parent life.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shortcutCard} onPress={() => setActiveTab('community')}>
            <Text style={styles.shortcutEmoji}>🤝</Text>
            <Text style={styles.shortcutTitle}>Parent corner</Text>
            <Text style={styles.shortcutDescription}>Read and share reviewed community posts.</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeadingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.progressEyebrow}>YOUR PACE, YOUR WAY</Text>
              <Text style={styles.progressTitle}>Moments you’ve made space for</Text>
            </View>
          </View>
          <View style={styles.progressMetrics}>
            <View style={styles.progressMetric}>
              <Text style={styles.progressNumber}>{checkins.length}</Text>
              <Text style={styles.progressLabel}>recent check-ins</Text>
            </View>
            <View style={styles.progressDivider} />
            <View style={styles.progressMetric}>
              <Text style={styles.progressNumber}>{events.length}</Text>
              <Text style={styles.progressLabel}>recent care notes</Text>
            </View>
            <Text style={styles.progressNote}>Every entry is optional.</Text>
          </View>
        </View>
        <Text style={styles.closingNote}>You don’t have to do everything today. One moment at a time. 💙</Text>
      </>
    );
  };

  const renderBaby = () => (
    <>
      <Text style={styles.eyebrow}>LITTLE ONE, BIG LOVE</Text>
      <Text style={styles.pageTitle}>My Baby</Text>
      <Text style={styles.pageSubtitle}>Keep the everyday details together, without needing to remember everything.</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Baby profiles</Text>
        {renderBabySelector()}
        <View style={styles.separator} />
        <Text style={styles.fieldLabel}>BABY’S NAME</Text>
        <TextInput style={styles.input} placeholder="Add a name" placeholderTextColor="#98938E" value={babyName} onChangeText={setBabyName} returnKeyType="next" />
        <Text style={styles.fieldLabel}>DATE OF BIRTH <Text style={styles.optionalLabel}>OPTIONAL</Text></Text>
        <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#98938E" value={birthDate} onChangeText={setBirthDate} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
        <TouchableOpacity style={styles.primaryButton} onPress={createBaby} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Add baby profile'}</Text>
        </TouchableOpacity>
      </View>

      {selectedBaby ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>A little note about {selectedBaby.display_name}</Text>
            <Text style={styles.mutedText}>Choose a moment to record. You can leave the extra details blank.</Text>
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>WHAT WOULD YOU LIKE TO LOG?</Text>
            <View style={styles.chipRow}>
              {EVENT_TYPES.map((type) => (
                <TouchableOpacity key={type} style={[styles.chip, eventType === type && styles.chipSelected]} onPress={() => setEventType(type)}>
                  <Text style={[styles.chipText, eventType === type && styles.chipTextSelected]}>{type === 'feeding' ? '🍼 Feeding' : type === 'sleep' ? '🌙 Sleep' : '🧷 Diaper'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {eventType === 'feeding' && (
              <>
                <Text style={styles.fieldLabel}>What kind of feeding?</Text>
                <View style={styles.chipRow}>
                  {[
                    ['breastfeeding', 'Breastfeeding'], ['expressed_milk', 'Expressed milk'], ['formula', 'Formula'], ['solids', 'Solids'], ['other', 'Other'],
                  ].map(([value, label]) => (
                    <TouchableOpacity key={value} style={[styles.chip, feedingType === value && styles.chipSelected]} onPress={() => setFeedingType(value)}>
                      <Text style={[styles.chipText, feedingType === value && styles.chipTextSelected]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {feedingType !== 'breastfeeding' && <><Text style={styles.fieldLabel}>AMOUNT <Text style={styles.optionalLabel}>OPTIONAL · ML</Text></Text><TextInput style={styles.input} placeholder="For example, 90" placeholderTextColor="#98938E" value={amountMl} onChangeText={setAmountMl} keyboardType="decimal-pad" /></>}
              </>
            )}
            {eventType === 'sleep' && <><Text style={styles.fieldLabel}>HOW LONG DID YOUR BABY SLEEP?</Text><TextInput style={styles.input} placeholder="Hours, for example 1.5" placeholderTextColor="#98938E" value={sleepStart} onChangeText={setSleepStart} keyboardType="decimal-pad" /></>}
            {eventType === 'diaper' && (
              <>
                <Text style={styles.fieldLabel}>Diaper change</Text>
                <View style={styles.chipRow}>
                  {[
                    ['wet', 'Wet'], ['dirty', 'Dirty'], ['both', 'Both'],
                  ].map(([value, label]) => (
                    <TouchableOpacity key={value} style={[styles.chip, diaperType === value && styles.chipSelected]} onPress={() => setDiaperType(value)}>
                      <Text style={[styles.chipText, diaperType === value && styles.chipTextSelected]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Add a detail to remember (optional)"
              placeholderTextColor="#98938E"
              value={eventDetails}
              onChangeText={setEventDetails}
              multiline
            />
            <TouchableOpacity style={styles.primaryButton} onPress={saveEvent} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save this little note'}</Text>
            </TouchableOpacity>
          </View>
          {renderCareHistory()}
        </>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🌼</Text>
          <Text style={styles.cardTitle}>Start with a little profile</Text>
          <Text style={styles.mutedText}>Add your baby’s name above. You can add care notes whenever you’re ready.</Text>
        </View>
      )}
    </>
  );

  const renderCrisisContacts = (contacts: CrisisContact[]) =>
    contacts.map((contact) => {
      const href = phoneHref(contact.number);
      return (
        <TouchableOpacity
          key={contact.label}
          style={styles.crisisRow}
          disabled={!href}
          accessibilityRole="button"
          accessibilityLabel={href ? `Call ${contact.label}, ${contact.number}` : contact.label}
          onPress={() => { if (href) void Linking.openURL(href); }}
        >
          <Text style={styles.crisisLabel}>{contact.label}</Text>
          <Text style={styles.crisisNumber}>{contact.number ?? 'Contact your local service'}</Text>
          {!!contact.note && <Text style={styles.smallText}>{contact.note}</Text>}
        </TouchableOpacity>
      );
    });

  const renderScreening = () => {
    if (screeningResult) {
      const copy = phq9ResultCopy(screeningResult);
      return (
        <View style={[styles.card, copy.showCrisis && styles.crisisCard]}>
          <Text style={styles.supportHeadline}>{copy.headline}</Text>
          <Text style={styles.bodyText}>{copy.body}</Text>
          {!!screeningError && <Text style={styles.errorText}>{screeningError}</Text>}
          {copy.showCrisis && renderCrisisContacts([STATIC_CRISIS_RESOURCES_IN.emergency, ...STATIC_CRISIS_RESOURCES_IN.support])}
          <TouchableOpacity style={styles.quietButton} onPress={() => { setScreeningResult(null); setScreeningError(''); }}>
            <Text style={styles.mutedText}>Done</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!screeningOpen) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>A short questionnaire (optional)</Text>
          <Text style={styles.bodyText}>Nine questions about the last two weeks, from the PHQ-9, a widely used and freely available questionnaire. It takes about two minutes. You can stop at any time, and your answers stay in your account.</Text>
          <Text style={styles.smallText}>This is not a diagnosis. Questions about sleep, tiredness and appetite are also affected by looking after a newborn, so a high score can have several explanations. If you would rather talk to someone now, the contacts above are always available.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => { setScreeningResult(null); setScreeningOpen(true); }}>
            <Text style={styles.primaryButtonText}>Answer the questions</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>The last two weeks</Text>
        <Text style={styles.bodyText}>{PHQ9_PROMPT}</Text>
        {PHQ9_ITEMS.map((item, index) => (
          <View key={item}>
            <Text style={styles.screeningItemText}>{index + 1}. {item}</Text>
            <View style={styles.chipRow}>
              {PHQ9_OPTIONS.map((label, value) => {
                const selected = screeningAnswers[index] === value;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.chip, selected && styles.chipSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setScreeningAnswers((current) => current.map((answer, i) => (i === index ? value : answer)))}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
        <Text style={styles.screeningItemText}>{PHQ9_DIFFICULTY_PROMPT} (optional)</Text>
        <View style={styles.chipRow}>
          {PHQ9_DIFFICULTY_OPTIONS.map((label, value) => {
            const selected = screeningDifficulty === value;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setScreeningDifficulty(value)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {!!screeningError && <Text style={styles.errorText}>{screeningError}</Text>}
        <Text style={styles.smallText}>{screeningAnswers.filter((answer) => answer !== null).length} of 9 answered</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={submitScreening} disabled={screeningSaving}>
          <Text style={styles.primaryButtonText}>{screeningSaving ? 'Saving…' : 'Save my answers'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quietButton} onPress={closeScreening} disabled={screeningSaving}>
          <Text style={styles.mutedText}>Not now</Text>
        </TouchableOpacity>
        <Text style={styles.smallText}>{PHQ9_ATTRIBUTION}</Text>
      </View>
    );
  };

  const renderSupportLevel = () => {
    const copy = levelCopy(supportData?.supportLevel.level);
    const resources = supportData?.crisisResources ?? STATIC_CRISIS_RESOURCES_IN;
    const contacts = [resources.emergency, ...resources.support];
    const toneStyle = copy.tone === 'gentle'
      ? styles.supportToneGentle
      : copy.tone === 'caring' || copy.tone === 'priority'
        ? styles.supportToneCaring
        : styles.supportToneCalm;
    return (
      <>
        <View style={[styles.card, styles.supportCard, toneStyle]}>
          <Text style={styles.cardTitle}>How things look lately</Text>
          {supportLoading ? (
            <View style={styles.aiLoadingRow}>
              <ActivityIndicator size="small" color="#4E6655" />
              <Text style={styles.mutedText}>Looking at your recent weeks…</Text>
            </View>
          ) : supportData ? (
            <>
              <Text style={styles.supportHeadline}>{copy.title}</Text>
              <Text style={styles.bodyText}>{supportData.supportLevel.message}</Text>
              {supportData.supportLevel.reasons.length > 0 && (
                <>
                  <Text style={styles.aiSectionTitle}>What this is based on</Text>
                  {supportData.supportLevel.reasons.map((reason) => (
                    <Text key={reason} style={styles.bodyText}>• {reason}</Text>
                  ))}
                </>
              )}
              <Text style={styles.aiSectionTitle}>Your logging pattern vs. your own earlier weeks</Text>
              {supportData.usage.measures.map((measure) => (
                <View key={measure.key} style={styles.aiSignalRow}>
                  <Text style={styles.aiSignalTitle}>{measure.title}</Text>
                  <Text style={styles.bodyText}>{measure.detail}</Text>
                </View>
              ))}
              <Text style={styles.smallText}>Logging often changes for ordinary reasons: {supportData.usage.ordinaryExplanations.join(' ')}</Text>
              <Text style={styles.smallText}>{supportData.meta.notice} No AI is used for this card. Changes in logging alone are never treated as a sign of a mental-health condition.</Text>
            </>
          ) : (
            <Text style={styles.bodyText}>{supportError || 'The support summary is unavailable right now.'} Your data is safe, and the contacts below are always available.</Text>
          )}
        </View>

        <View style={[styles.card, styles.crisisCard]}>
          <Text style={styles.cardTitle}>If you need to talk to someone now</Text>
          <Text style={styles.bodyText}>You do not have to wait for a pattern or a score. Reaching out is always okay.</Text>
          {renderCrisisContacts(contacts)}
        </View>
      </>
    );
  };

  const renderInsights = () => {
    const latest = checkins[0];
    const previous = checkins[1];
    const recent = checkins.slice(0, 7);
    const moodWord = (value: number) => moodOptions.find((option) => option.value === value)?.label ?? 'Not recorded';
    const average = (values: Array<number | null | undefined>) => {
      const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      return valid.length ? (valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(1) : '—';
    };
    const avgMood = average(recent.map((item) => item.mood));
    const avgStress = average(recent.map((item) => item.stress));
    const avgEnergy = average(recent.map((item) => item.energy));
    const moodDirection = recent.length >= 4
      ? (recent.slice(0, 3).reduce((sum, item) => sum + item.mood, 0) / 3) - (recent.slice(3).reduce((sum, item) => sum + item.mood, 0) / recent.slice(3).length)
      : 0;
    return (
      <>
        <Text style={styles.eyebrow}>YOUR JOURNEY, YOUR PACE</Text>
        <Text style={styles.pageTitle}>My Insights 💛</Text>
        <Text style={styles.pageSubtitle}>A gentle look at the check-ins you chose to share. These patterns are for reflection—not diagnosis, prediction, or a score of how you are doing.</Text>

        {renderSupportLevel()}

        {renderScreening()}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI-assisted reflection (optional)</Text>
          <Text style={styles.bodyText}>BabyBlues can compare aggregate patterns in your wellbeing check-ins over two 28-day periods, then ask an AI service to explain those observations. This is separate from the reflections already shown on this page.</Text>
          <Text style={styles.smallText}>If enabled, aggregate features derived from your check-ins and app activity are sent to the BabyBlues backend and then to Google Gemini. Your name, email, private notes, and raw event history are not sent to Gemini. The output is experimental and is not a diagnosis, screening result, or validated prediction.</Text>
          {aiConsentLoading ? (
            <View style={styles.aiLoadingRow}>
              <ActivityIndicator size="small" color="#4E6655" />
              <Text style={styles.mutedText}>Loading your AI-sharing choice…</Text>
            </View>
          ) : !aiConsentSetupReady ? (
            <Text style={styles.aiConsentTitle}>AI analysis is not configured yet. Run the supplied SQL migration before enabling external AI processing.</Text>
          ) : !aiSharingConsent ? (
            <>
              <Text style={styles.aiConsentTitle}>External AI processing is currently off.</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => updateAISharingConsent(true)}>
                <Text style={styles.primaryButtonText}>I agree — enable AI reflections</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.aiConsentTitle}>AI-sharing is enabled. You can turn it off at any time.</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={runAIAnalysis} disabled={aiAnalysisLoading}>
                <Text style={styles.primaryButtonText}>{aiAnalysisLoading ? 'Preparing your reflection…' : 'Generate AI-assisted reflection'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quietButton} onPress={() => updateAISharingConsent(false)} disabled={aiAnalysisLoading}>
                <Text style={styles.quietButtonText}>Turn off AI reflections and clear this result</Text>
              </TouchableOpacity>
            </>
          )}
          {!!aiAnalysisError && <Text style={styles.errorText}>{aiAnalysisError}</Text>}
          {aiAnalysis && (
            <View style={styles.aiResultCard}>
              <Text style={styles.cardTitle}>Your AI-assisted reflection</Text>
              <Text style={styles.bodyText}>{aiAnalysis.interpretation.summary}</Text>
              {!!aiAnalysis.interpretation.context && <Text style={styles.bodyText}>{aiAnalysis.interpretation.context}</Text>}
              <Text style={styles.aiSectionTitle}>Observed signals</Text>
              {aiAnalysis.features.signals.map((signal) => (
                <View key={signal.key} style={styles.aiSignalRow}>
                  <Text style={styles.aiSignalTitle}>{signal.title}</Text>
                  <Text style={styles.bodyText}>{signal.detail}</Text>
                </View>
              ))}
              {aiAnalysis.interpretation.nextSteps?.length > 0 && (
                <>
                  <Text style={styles.aiSectionTitle}>Possible next steps</Text>
                  {aiAnalysis.interpretation.nextSteps.map((step, index) => (
                    <Text key={`${index}-${step}`} style={styles.bodyText}>• {step}</Text>
                  ))}
                </>
              )}
              <Text style={styles.smallText}>{aiAnalysis.interpretation.disclaimer}</Text>
              <Text style={styles.smallText}>Generated {new Date(aiAnalysis.generatedAt).toLocaleString()} · {aiAnalysis.windowDays}-day comparison windows</Text>
              {!!aiAnalysis.meta?.provider && <Text style={styles.smallText}>Analysis mode: {aiAnalysis.meta.provider}</Text>}
            </View>
          )}
        </View>

        <View style={styles.insightHero}>
          <Text style={styles.heroEyebrow}>YOUR LATEST CHECK-IN</Text>
          {latest ? (
            <>
              <Text style={styles.insightMood}>{moodOptions.find((option) => option.value === latest.mood)?.emoji ?? '🌿'} {moodWord(latest.mood)}</Text>
              <Text style={styles.heroBody}>Recorded {new Date(latest.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}. Thank you for taking a moment for yourself.</Text>
              <View style={styles.insightStats}>
                <View style={styles.insightStat}><Text style={styles.insightStatLabel}>Stress</Text><Text style={styles.insightStatValue}>{latest.stress}/5</Text></View>
                <View style={styles.insightStat}><Text style={styles.insightStatLabel}>Energy</Text><Text style={styles.insightStatValue}>{latest.energy}/5</Text></View>
                <View style={styles.insightStat}><Text style={styles.insightStatLabel}>Appetite</Text><Text style={styles.insightStatValue}>{latest.appetite == null ? '—' : `${latest.appetite}/5`}</Text></View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.insightMood}>Your story starts whenever you’re ready.</Text>
              <Text style={styles.heroBody}>Your check-ins will appear here so you can reflect on them over time. There’s no need to check in every day.</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => { setActiveTab('space'); setShowCheckinForm(true); }}>
                <Text style={styles.primaryButtonText}>Take a moment</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        {recent.length > 0 && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your recent snapshot</Text>
              <Text style={styles.mutedText}>Based on your latest {recent.length} check-in{recent.length === 1 ? '' : 's'}; this is a simple average, not a clinical measure.</Text>
              <View style={styles.snapshotGrid}>
                <View style={styles.snapshotTile}><Text style={styles.snapshotLabel}>Mood</Text><Text style={styles.snapshotValue}>{avgMood}<Text style={styles.snapshotDenom}> / 5</Text></Text></View>
                <View style={styles.snapshotTile}><Text style={styles.snapshotLabel}>Stress</Text><Text style={styles.snapshotValue}>{avgStress}<Text style={styles.snapshotDenom}> / 5</Text></Text></View>
                <View style={styles.snapshotTile}><Text style={styles.snapshotLabel}>Energy</Text><Text style={styles.snapshotValue}>{avgEnergy}<Text style={styles.snapshotDenom}> / 5</Text></Text></View>
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Mood across recent check-ins</Text>
              <Text style={styles.mutedText}>Each bar represents one check-in, shown from newest to oldest.</Text>
              <View style={styles.trendChart}>
                {recent.slice().reverse().map((item) => (
                  <View key={item.id} style={styles.trendColumn}>
                    <Text style={styles.trendValue}>{item.mood}/5</Text>
                    <View style={styles.trendTrack}><View style={[styles.trendBar, { height: `${Math.max(12, (item.mood / 5) * 100)}%` }]} /></View>
                    <Text style={styles.trendDate}>{new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Text>
                  </View>
                ))}
              </View>
            </View>
            {latest && previous && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Since your previous check-in</Text>
                <Text style={styles.bodyText}>Mood: {latest.mood === previous.mood ? 'about the same' : latest.mood > previous.mood ? 'you rated it a little better' : 'you rated it a little harder'}.</Text>
                <Text style={styles.bodyText}>Stress: {latest.stress === previous.stress ? 'about the same' : latest.stress > previous.stress ? 'you reported more stress' : 'you reported less stress'}.</Text>
                <Text style={styles.smallText}>This compares two moments only. It does not explain why they changed.</Text>
              </View>
            )}
            {recent.length >= 4 && (
              <View style={styles.patternCard}>
                <Text style={styles.patternTitle}>A gentle pattern to notice</Text>
                <Text style={styles.bodyText}>{moodDirection > 0.35 ? 'Your three most recent mood ratings are higher on average than your older ratings in this small sample.' : moodDirection < -0.35 ? 'Your three most recent mood ratings are lower on average than your older ratings in this small sample.' : 'Your recent mood ratings are fairly similar across this small sample.'}</Text>
                <Text style={styles.smallText}>Check-ins can be affected by sleep, support, health, and many other things. If you feel persistently low, overwhelmed, or worried, consider talking with a trusted person or healthcare professional—regardless of these numbers.</Text>
              </View>
            )}
          </>
        )}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your recent check-ins</Text>
          {checkins.length === 0 ? <Text style={styles.mutedText}>Your reflections will live here whenever you choose to add them.</Text> : checkins.map((item) => (
            <View key={item.id} style={styles.historyRow}>
              <View style={styles.historyIcon}><Text style={styles.historyEmoji}>{moodOptions.find((option) => option.value === item.mood)?.emoji ?? '🌿'}</Text></View>
              <View style={styles.historyCopy}>
                <Text style={styles.historyTitle}>{moodWord(item.mood)}</Text>
                <Text style={styles.mutedText}>Stress {item.stress}/5 · Energy {item.energy}/5</Text>
                <Text style={styles.smallText}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </View>
      </>
    );
  };

  const renderDiscover = () => {
    const selectedArticle = DISCOVER_ARTICLES.find((article) => article.id === selectedArticleId);
    const visibleArticles = discoverCategory === 'All'
      ? DISCOVER_ARTICLES
      : DISCOVER_ARTICLES.filter((article) => article.category === discoverCategory);

    if (selectedArticle) {
      return (
        <>
          <TouchableOpacity style={styles.articleBackButton} onPress={() => setSelectedArticleId(null)}>
            <Text style={styles.articleBackText}>‹  Back to Discover</Text>
          </TouchableOpacity>
          <View style={[styles.articleHero, { backgroundColor: selectedArticle.color }]}>
            <Text style={styles.discoverEmoji}>{selectedArticle.emoji}</Text>
            <Text style={styles.discoverCategory}>{selectedArticle.category.toUpperCase()} · {selectedArticle.readTime.toUpperCase()}</Text>
            <Text style={styles.articleTitle}>{selectedArticle.title}</Text>
            <Text style={styles.bodyText}>{selectedArticle.subtitle}</Text>
            <Text style={styles.articleMeta}>
              By {selectedArticle.author} · Published {new Date(selectedArticle.publishedAt).toLocaleString(undefined, {
                day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </Text>
          </View>
          {selectedArticle.sections.map((section, index) => (
            <View key={`${selectedArticle.id}-${index}`} style={styles.card}>
              <Text style={styles.cardTitle}>{section.heading}</Text>
              {section.body.map((paragraph, paragraphIndex) => (
                <Text key={`${selectedArticle.id}-${index}-${paragraphIndex}`} style={styles.bodyText}>{paragraph}</Text>
              ))}
            </View>
          ))}
          {selectedArticle.note && (
            <View style={styles.supportNote}>
              <Text style={styles.supportNoteTitle}>A note on getting support</Text>
              <Text style={styles.bodyText}>{selectedArticle.note}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.primaryButton} onPress={() => setSelectedArticleId(null)}>
            <Text style={styles.primaryButtonText}>Back to all reads</Text>
          </TouchableOpacity>
          <Text style={styles.footer}>BabyBlues offers general information, not a diagnosis or a replacement for personalised medical advice.</Text>
        </>
      );
    }

    return (
      <>
        <Text style={styles.eyebrow}>A LITTLE KNOWLEDGE, A LITTLE COMFORT</Text>
        <Text style={styles.pageTitle}>Discover</Text>
        <Text style={styles.pageSubtitle}>Practical reads for the big changes that come with a new little person. Open any guide to read at your own pace.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroller} contentContainerStyle={styles.chipRow}>
          {(['All', 'For you', 'Baby care', 'Recovery'] as DiscoverCategory[]).map((category) => (
            <TouchableOpacity key={category} style={[styles.chip, discoverCategory === category && styles.chipSelected]} onPress={() => setDiscoverCategory(category)}>
              <Text style={[styles.chipText, discoverCategory === category && styles.chipTextSelected]}>{category}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {visibleArticles.map((article) => (
          <TouchableOpacity key={article.id} activeOpacity={0.82} style={[styles.discoverCard, { backgroundColor: article.color }]} onPress={() => setSelectedArticleId(article.id)}>
            <Text style={styles.discoverEmoji}>{article.emoji}</Text>
            <Text style={styles.discoverCategory}>{article.category.toUpperCase()} · {article.readTime.toUpperCase()}</Text>
            <Text style={styles.discoverTitle}>{article.title}</Text>
            <Text style={styles.bodyText}>{article.subtitle}</Text>
            <Text style={styles.articleMeta}>
              By {article.author} · Published {new Date(article.publishedAt).toLocaleString(undefined, {
                day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </Text>
            <Text style={styles.articleReadLink}>Read guide  →</Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.footer}>These short guides are general information, not a diagnosis or a replacement for personalised medical advice. For concerns about you or your baby, contact a qualified healthcare professional.</Text>
      </>
    );
  };

  const renderCommunity = () => {
    const visiblePosts = communityPosts.filter((post) => isCommunityModerator || post.moderation_status === 'approved' || post.author_id === session?.user.id);
    const pendingPosts = communityPosts.filter((post) => post.moderation_status === 'pending');
    return (
      <>
        <Text style={styles.eyebrow}>A SPACE TO BE HUMAN</Text>
        <Text style={styles.pageTitle}>Community</Text>
        <Text style={styles.pageSubtitle}>Small wins, hard days, and honest questions. Share only what you feel comfortable sharing.</Text>

        {isCommunityModerator && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Moderator workspace</Text>
            <Text style={styles.smallText}>Moderator access is enabled for this account. Review pending posts and reported content. Approvals are visible to community members.</Text>
            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Pending posts ({pendingPosts.length})</Text>
            {pendingPosts.length === 0 ? (
              <Text style={styles.mutedText}>No posts are waiting for approval.</Text>
            ) : pendingPosts.map((post) => (
              <View key={`pending-${post.id}`} style={styles.moderationItem}>
                <Text style={styles.communityPostAuthor}>{post.display_name} · {post.topic}</Text>
                <Text style={styles.communityPostBody}>{post.body}</Text>
                <View style={styles.moderationActions}>
                  <TouchableOpacity style={styles.moderationApprove} disabled={moderationBusyId === post.id} onPress={() => confirmModerateCommunityPost(post, 'approved')}>
                    <Text style={styles.moderationApproveText}>{moderationBusyId === post.id ? 'Saving…' : 'Approve'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.moderationReject} disabled={moderationBusyId === post.id} onPress={() => confirmModerateCommunityPost(post, 'rejected')}>
                    <Text style={styles.moderationRejectText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Reported posts ({moderationReports.length})</Text>
            {moderationReports.length === 0 ? (
              <Text style={styles.mutedText}>No reports have been submitted.</Text>
            ) : moderationReports.map((report) => (
              <View key={`report-${report.id}`} style={styles.moderationItem}>
                <Text style={styles.communityPostAuthor}>{report.reason}</Text>
                <Text style={styles.smallText}>Reported {new Date(report.created_at).toLocaleDateString()} · Post status: {report.post?.moderation_status ?? 'post unavailable'}</Text>
                <Text style={styles.communityPostBody}>{report.post?.body ?? 'The reported post is no longer available.'}</Text>
                {report.post && report.post.moderation_status !== 'rejected' && (
                  <View style={styles.moderationActions}>
                    {report.post.moderation_status !== 'approved' && <TouchableOpacity style={styles.moderationApprove} disabled={moderationBusyId === report.post_id} onPress={() => { const post = communityPosts.find((item) => item.id === report.post_id); if (post) confirmModerateCommunityPost(post, 'approved'); }}><Text style={styles.moderationApproveText}>Approve post</Text></TouchableOpacity>}
                    <TouchableOpacity style={styles.moderationReject} disabled={moderationBusyId === report.post_id} onPress={() => { const post = communityPosts.find((item) => item.id === report.post_id); if (post) confirmModerateCommunityPost(post, 'rejected'); }}><Text style={styles.moderationRejectText}>Reject post</Text></TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.communityHero}>
          <Text style={styles.communityEmoji}>🌷</Text>
          <Text style={styles.communityTitle}>A place to feel understood</Text>
          <Text style={styles.bodyText}>Share what this season is like for you, read other parents’ experiences, and take what feels helpful. Posts are reviewed before they appear publicly.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Share with the community</Text>
          <Text style={styles.fieldLabel}>CHOOSE A NICKNAME</Text>
          <TextInput
            style={styles.input}
            value={communityNickname}
            onChangeText={setCommunityNickname}
            placeholder="A name you feel comfortable sharing"
            placeholderTextColor="#A49A93"
            maxLength={24}
            autoCapitalize="words"
          />
          <Text style={styles.smallText}>Use a nickname, not your full name. Your email address is not shown on posts.</Text>
          <Text style={[styles.fieldLabel, { marginTop: 18 }]}>WHAT’S ON YOUR MIND?</Text>
          <View style={styles.chipRow}>
            {COMMUNITY_TOPICS.map((topic) => (
              <TouchableOpacity key={topic} style={[styles.chip, communityTopic === topic && styles.chipSelected]} onPress={() => setCommunityTopic(topic)}>
                <Text style={[styles.chipText, communityTopic === topic && styles.chipTextSelected]}>{topic}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, styles.multiline, { minHeight: 120 }]}
            value={communityDraft}
            onChangeText={setCommunityDraft}
            placeholder="Write a little about what you’re experiencing. Share only what feels right."
            placeholderTextColor="#A49A93"
            multiline
            maxLength={600}
            textAlignVertical="top"
          />
          <Text style={styles.smallText}>{communityDraft.length}/600 characters · Avoid sharing phone numbers, addresses, or identifying details about your child.</Text>
          <TouchableOpacity style={[styles.primaryButton, communitySaving && { opacity: 0.65 }]} onPress={() => { void submitCommunityPost(); }} disabled={communitySaving}>
            <Text style={styles.primaryButtonText}>{communitySaving ? 'Submitting…' : 'Submit for review'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Community conversations</Text>
          <Text style={styles.mutedText}>Recently shared</Text>
        </View>
        {communityLoading ? (
          <View style={styles.emptyCard}><ActivityIndicator color="#718573" /><Text style={[styles.mutedText, { marginTop: 10 }]}>Loading conversations…</Text></View>
        ) : visiblePosts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.cardTitle}>A quiet start</Text>
            <Text style={styles.mutedText}>Approved conversations will appear here. You can submit a post above; it will stay private to you until it has been reviewed.</Text>
          </View>
        ) : visiblePosts.map((post) => (
          <View key={post.id} style={styles.communityPostCard}>
            <View style={styles.communityPostHeader}>
              <View style={styles.communityAvatar}><Text style={styles.communityAvatarText}>🌿</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.communityPostAuthor}>{post.display_name}</Text>
                <Text style={styles.smallText}>{post.topic} · {new Date(post.created_at).toLocaleDateString()}</Text>
              </View>
              {post.moderation_status === 'pending' && post.author_id === session?.user.id && <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>In review</Text></View>}
            </View>
            <Text style={styles.communityPostBody}>{post.body}</Text>
            <View style={styles.communityPostActions}>
              {post.author_id === session?.user.id ? (
                <TouchableOpacity onPress={() => deleteCommunityPost(post)}><Text style={styles.communityActionText}>Delete post</Text></TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => confirmReportCommunityPost(post)}><Text style={styles.communityActionText}>Report</Text></TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>A few safety boundaries</Text>
          <Text style={styles.bodyText}>• Share experiences, not diagnoses or instructions to change treatment.</Text>
          <Text style={styles.bodyText}>• Don’t post personal contact details or identifying information about children.</Text>
          <Text style={styles.bodyText}>• If you or your baby may be in immediate danger, contact local emergency services or a qualified professional rather than waiting for a community reply.</Text>
        </View>
        {!!communityStatus && <Text style={styles.status}>{communityStatus}</Text>}
        <Text style={styles.footer}>Community posts require review before public display. Reports are recorded for review; a human moderation workflow must be maintained before this feature is opened to a wider audience.</Text>
      </>
    );
  };

  const tabItems = [
    { key: 'space' as const, label: 'Haven', emoji: '🌿' },
    { key: 'baby' as const, label: 'My Baby', emoji: '🧸' },
    { key: 'discover' as const, label: 'Discover', emoji: '🌱' },
    { key: 'insights' as const, label: 'Reflections', emoji: '💛' },
    { key: 'community' as const, label: 'Community', emoji: '🤝' },
  ];

  return (
    <View style={styles.appShell}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brand}>babyblues<Text style={styles.brandDot}>.</Text></Text>
            <Text style={styles.brandTagline}>a little space for you</Text>
          </View>
          <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'space' && renderSpace()}
        {activeTab === 'baby' && renderBaby()}
        {activeTab === 'insights' && renderInsights()}
        {activeTab === 'discover' && renderDiscover()}
        {activeTab === 'community' && renderCommunity()}

        {!!status && <Text style={styles.status}>{status}</Text>}
        <Text style={styles.footer}>Your wellbeing matters. BabyBlues offers supportive tools, not a diagnosis.</Text>
      </ScrollView>

      <View style={styles.tabBar}>
        {tabItems.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabButton}
              onPress={() => { setActiveTab(tab.key); if (tab.key === 'space') setSpaceMode('haven'); }}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected }}
            >
              <Text style={[styles.tabEmoji, selected && styles.tabEmojiSelected]}>{tab.emoji}</Text>
              <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{tab.label}</Text>
              {selected && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: { flex: 1, backgroundColor: '#FAF5EE' },
  screen: { flex: 1, backgroundColor: '#FAF5EE' },
  content: { paddingHorizontal: 20, paddingTop: 58, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FAF5EE' },
  authCard: { width: '100%', maxWidth: 440, backgroundColor: '#FFFCF7', borderRadius: 28, padding: 25, borderWidth: 1, borderColor: '#EDE0D2', shadowColor: '#795B45', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  brand: { fontSize: 30, fontWeight: '800', color: '#526B53', letterSpacing: -1.2 },
  brandDot: { color: '#C17E67' },
  brandTagline: { color: '#92877F', fontSize: 12, marginTop: 1, letterSpacing: 0.3 },
  subtitle: { color: '#847B75', marginTop: 8, marginBottom: 22, lineHeight: 21 },
  heading: { fontSize: 25, fontWeight: '700', color: '#493E35', marginBottom: 18 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  signOutButton: { borderRadius: 18, backgroundColor: '#F0EBE5', paddingHorizontal: 13, paddingVertical: 9 },
  signOutText: { color: '#746C66', fontSize: 12, fontWeight: '600' },
  eyebrow: { color: '#A27C79', fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 8 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 22 },
  greetingCopy: { flex: 1 },
  greetingTitle: { fontSize: 29, lineHeight: 36, fontWeight: '800', color: '#493D34', letterSpacing: -0.8 },
  greetingSubtitle: { color: '#847B75', fontSize: 13, lineHeight: 20, marginTop: 7 },
  sunBadge: { width: 58, height: 58, borderRadius: 22, backgroundColor: '#F7DEB9', alignItems: 'center', justifyContent: 'center' },
  sunEmoji: { fontSize: 28 },
  heroCard: { backgroundColor: '#F7E9D9', borderRadius: 26, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#EED9C5' },
  heroEyebrow: { color: '#9A654E', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 10 },
  heroTitle: { color: '#493C33', fontSize: 22, lineHeight: 29, fontWeight: '800', letterSpacing: -0.4 },
  heroBody: { color: '#75645A', fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 17 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 },
  moodOption: { flexGrow: 1, flexBasis: '29%', minHeight: 82, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 10, borderRadius: 17, backgroundColor: '#FFFAF4', borderWidth: 1, borderColor: '#F0E3D6' },
  moodOptionSelected: { borderColor: '#C17E67', backgroundColor: '#F2D7C6' },
  moodEmoji: { fontSize: 25, marginBottom: 5 },
  moodLabel: { color: '#76695F', fontSize: 10, textAlign: 'center', lineHeight: 14 },
  moodLabelSelected: { color: '#543F35', fontWeight: '700' },
  checkinDetails: { borderTopWidth: 1, borderTopColor: '#E5CDBA', paddingTop: 18, marginTop: 4 },
  selfCareCard: { flexDirection: 'row', gap: 13, backgroundColor: '#FFFCF7', borderRadius: 22, padding: 17, marginBottom: 16, borderWidth: 1, borderColor: '#EDE0D2' },
  sectionIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: '#F7E4CB', alignItems: 'center', justifyContent: 'center' },
  sectionEmoji: { fontSize: 22 },
  featureCopy: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '800', color: '#4B554A', marginBottom: 5 },
  featureFootnote: { color: '#9A7771', fontSize: 11, lineHeight: 17, marginTop: 7, fontWeight: '600' },
  sectionHeaderRow: { marginBottom: 13 },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: '#455345', letterSpacing: -0.3 },
  shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  shortcutCard: { width: '48%', flexGrow: 1, minHeight: 145, backgroundColor: '#FFFCF7', borderRadius: 21, borderWidth: 1, borderColor: '#EDE0D2', padding: 16, shadowColor: '#795B45', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  shortcutEmoji: { fontSize: 25, marginBottom: 12 },
  shortcutTitle: { color: '#4A554A', fontSize: 13, fontWeight: '800', marginBottom: 5 },
  shortcutDescription: { color: '#91877F', fontSize: 11, lineHeight: 16 },
  closingNote: { color: '#9B829A', textAlign: 'center', fontSize: 12, lineHeight: 19, marginTop: 24, marginBottom: 8 },
  pageTitle: { fontSize: 30, fontWeight: '800', color: '#3F4F42', letterSpacing: -0.7, marginBottom: 8 },
  pageSubtitle: { color: '#847B75', fontSize: 13, lineHeight: 21, marginBottom: 22 },
  card: { backgroundColor: '#FFFCF7', borderRadius: 22, padding: 18, marginBottom: 15, borderWidth: 1, borderColor: '#EDE0D2', shadowColor: '#795B45', shadowOpacity: 0.035, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#455345', marginBottom: 12 },
  bodyText: { color: '#756E68', fontSize: 13, lineHeight: 20, marginBottom: 7 },
  mutedText: { color: '#8C837D', fontSize: 12, lineHeight: 18 },
  smallText: { color: '#A49A93', fontSize: 10, lineHeight: 15, marginTop: 5 },
  input: { backgroundColor: '#FFFEFC', borderWidth: 1, borderColor: '#E3D4C5', borderRadius: 15, paddingHorizontal: 15, paddingVertical: 15, minHeight: 52, fontSize: 15, color: '#493F37', marginBottom: 14 },
  multiline: { minHeight: 94, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: '#657D5E', borderRadius: 16, paddingVertical: 15, paddingHorizontal: 18, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 7 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  quietButton: { alignItems: 'center', padding: 12, marginTop: 2 },
  quietButtonText: { color: '#82718D', fontSize: 12, fontWeight: '700' },
  link: { alignItems: 'center', padding: 16 },
  linkText: { color: '#718573', fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { borderRadius: 20, borderWidth: 1, borderColor: '#E5D6C7', paddingVertical: 11, paddingHorizontal: 14, backgroundColor: '#FFFEFC', minHeight: 42, justifyContent: 'center' },
  chipSelected: { backgroundColor: '#657D5E', borderColor: '#657D5E' },
  chipText: { color: '#665D54', fontWeight: '600', fontSize: 12 },
  chipTextSelected: { color: '#FFFFFF' },
  fieldLabel: { fontSize: 11, color: '#725E4E', fontWeight: '800', letterSpacing: 0.65, marginBottom: 8 },
  optionalLabel: { color: '#A19487', fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  separator: { height: 1, backgroundColor: '#F0E9E2', marginVertical: 15 },
  historyRow: { flexDirection: 'row', gap: 11, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3EEE9' },
  historyIcon: { width: 39, height: 39, borderRadius: 14, backgroundColor: '#F6F0E9', alignItems: 'center', justifyContent: 'center' },
  historyEmoji: { fontSize: 19 },
  historyCopy: { flex: 1 },
  historyTitle: { color: '#4A554A', fontWeight: '800', fontSize: 13, marginBottom: 3 },
  emptyCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#EFE8E1' },
  emptyEmoji: { fontSize: 32, marginBottom: 10 },
  insightHero: { backgroundColor: '#F0EAF5', borderRadius: 23, padding: 20, marginBottom: 15 },
  insightMood: { fontSize: 21, fontWeight: '800', color: '#4A3E53', lineHeight: 29 },
  insightStats: { flexDirection: 'row', gap: 9, marginTop: 10 },
  insightStat: { flex: 1, backgroundColor: '#FBF8FC', borderRadius: 12, padding: 11 },
  insightStatLabel: { color: '#887A90', fontSize: 10, marginBottom: 5 },
  insightStatValue: { color: '#4F4358', fontSize: 15, fontWeight: '800' },
  snapshotGrid: { flexDirection: 'row', gap: 8, marginTop: 14 },
  snapshotTile: { flex: 1, backgroundColor: '#F7F4F0', borderRadius: 13, padding: 12 },
  snapshotLabel: { color: '#8B8178', fontSize: 10, fontWeight: '700', marginBottom: 6 },
  snapshotValue: { color: '#4A554A', fontSize: 21, fontWeight: '800' },
  snapshotDenom: { color: '#9A9188', fontSize: 11, fontWeight: '600' },
  trendChart: { height: 155, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 6, marginTop: 18 },
  trendColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  trendValue: { color: '#81788A', fontSize: 9, marginBottom: 5, fontWeight: '700' },
  trendTrack: { height: 95, width: '72%', backgroundColor: '#F1EBF4', borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  trendBar: { width: '100%', backgroundColor: '#A995BB', borderRadius: 7 },
  trendDate: { color: '#9A9188', fontSize: 8, marginTop: 7, textAlign: 'center' },
  patternCard: { backgroundColor: '#EEF3EA', borderRadius: 20, padding: 17, marginBottom: 15, borderWidth: 1, borderColor: '#E0E9DB' },
  patternTitle: { color: '#4D654E', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  discoverCard: { borderRadius: 24, padding: 21, marginBottom: 15, borderWidth: 1, borderColor: '#FFFFFF90' },
  categoryScroller: { flexGrow: 0, marginBottom: 13 },
  articleMeta: { color: '#827A84', fontSize: 10, fontWeight: '600', lineHeight: 15, marginTop: 9 },
  articleReadLink: { color: '#6F8370', fontSize: 12, fontWeight: '800', marginTop: 7 },
  articleBackButton: { alignSelf: 'flex-start', paddingVertical: 9, paddingRight: 12, marginBottom: 10 },
  articleBackText: { color: '#6F8370', fontWeight: '800', fontSize: 13 },
  articleHero: { borderRadius: 22, padding: 20, marginBottom: 15 },
  articleTitle: { color: '#49434D', fontSize: 24, fontWeight: '800', lineHeight: 30, marginBottom: 8 },
  supportNote: { backgroundColor: '#FFF7EC', borderRadius: 18, borderWidth: 1, borderColor: '#F0DDC6', padding: 16, marginBottom: 14 },
  supportNoteTitle: { color: '#785C43', fontWeight: '800', fontSize: 14, marginBottom: 8 },
  discoverEmoji: { fontSize: 28, marginBottom: 13 },
  discoverCategory: { color: '#8D779A', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 },
  discoverTitle: { color: '#49434D', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  comingSoon: { color: '#8B7D86', fontSize: 10, marginTop: 8, fontStyle: 'italic' },
  moderationItem: { backgroundColor: '#FAF7F3', borderRadius: 13, padding: 12, marginTop: 9, borderWidth: 1, borderColor: '#EEE5DC' },
  moderationActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  moderationApprove: { backgroundColor: '#EAF2E8', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 },
  moderationApproveText: { color: '#4D6A50', fontWeight: '800', fontSize: 12 },
  moderationReject: { backgroundColor: '#F9E9E6', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 },
  moderationRejectText: { color: '#9A514A', fontWeight: '800', fontSize: 12 },
  communityHero: { alignItems: 'center', backgroundColor: '#F2E4D8', borderRadius: 27, padding: 26, marginBottom: 16, borderWidth: 1, borderColor: '#E8D1BE' },
  communityEmoji: { fontSize: 38, marginBottom: 13 },
  communityTitle: { textAlign: 'center', color: '#55484A', fontSize: 20, lineHeight: 27, fontWeight: '800', marginBottom: 10 },
  communityPostCard: { backgroundColor: '#FFFCF7', borderRadius: 22, padding: 18, marginBottom: 13, borderWidth: 1, borderColor: '#EDE0D2' },
  communityPostHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  communityAvatar: { width: 39, height: 39, borderRadius: 14, backgroundColor: '#EAF2E8', alignItems: 'center', justifyContent: 'center' },
  communityAvatarText: { fontSize: 20 },
  communityPostAuthor: { color: '#4A554A', fontWeight: '800', fontSize: 13 },
  communityPostBody: { color: '#645D58', fontSize: 14, lineHeight: 22 },
  communityPostActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 13, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3EEE9' },
  communityActionText: { color: '#8D6A62', fontSize: 12, fontWeight: '800', padding: 4 },
  pendingBadge: { backgroundColor: '#FFF2DC', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5 },
  pendingBadgeText: { color: '#89663D', fontSize: 10, fontWeight: '800' },
  tabBar: { flexDirection: 'row', backgroundColor: '#FFFCF7', borderTopWidth: 1, borderTopColor: '#E8DCCF', paddingTop: 8, paddingBottom: 12, paddingHorizontal: 4 },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 55, gap: 3 },
  tabEmoji: { fontSize: 19, opacity: 0.75 },
  tabEmojiSelected: { opacity: 1, transform: [{ scale: 1.05 }] },
  tabLabel: { fontSize: 9, color: '#9B928A', fontWeight: '600' },
  tabLabelSelected: { color: '#526B53', fontWeight: '800' },
  tabIndicator: { width: 22, height: 3, borderRadius: 3, backgroundColor: '#C17E67', marginTop: 1 },
  ratingSection: { marginBottom: 17 },
  ratingTitle: { fontSize: 13, fontWeight: '800', color: '#5C6659', marginBottom: 9 },
  ratingRow: { flexDirection: 'row', gap: 7 },
  ratingButton: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: '#E5D6C7', borderRadius: 14, backgroundColor: '#FFFEFC', alignItems: 'center', justifyContent: 'center' },
  ratingSelected: { backgroundColor: '#657D5E', borderColor: '#657D5E' },
  ratingText: { color: '#716357', fontSize: 14, fontWeight: '800' },
  ratingTextSelected: { color: '#FFFFFF' },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  scaleLabel: { fontSize: 10, color: '#948A94' },
  status: { color: '#8D6A62', backgroundColor: '#F8EDE7', padding: 12, borderRadius: 11, marginVertical: 12, lineHeight: 19, fontSize: 12 },
  footer: { color: '#AAA098', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 22, marginBottom: 10 },

  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 14, marginBottom: 9 },
  backButtonText: { color: '#C06248', fontSize: 13, fontWeight: '800' },
  questSection: { marginBottom: 22 },
  questDewPill: { color: '#3D7254', backgroundColor: '#E8F2EC', overflow: 'hidden', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, fontSize: 10, fontWeight: '800' },
  questRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#EDE0D2', borderRadius: 19, padding: 12, marginBottom: 9, minHeight: 76 },
  questRowHighlighted: { backgroundColor: '#FDF0E9', borderColor: '#F0D5C7' },
  questIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  questEmoji: { fontSize: 20 },
  questCopy: { flex: 1 },
  questTitle: { color: '#453B35', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  questSubtitle: { color: '#897D74', fontSize: 10, lineHeight: 15 },
  questButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 11, backgroundColor: '#FAF0E9', borderWidth: 1, borderColor: '#E8D4C8' },
  questButtonText: { color: '#A64E35', fontSize: 11, fontWeight: '800' },
  questChevron: { color: '#C4B7AF', fontSize: 24, paddingHorizontal: 4 },
  gardenHero: { backgroundColor: '#EDF5EF', borderColor: '#D5EADB', borderWidth: 1, borderRadius: 26, padding: 19, marginBottom: 22 },
  gardenHeroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8 },
  gardenEyebrow: { color: '#396B4D', fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  dewBadge: { backgroundColor: '#FFFFFF', borderColor: '#D0E5D7', borderWidth: 1, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6 },
  dewBadgeText: { color: '#2A5C3D', fontSize: 11, fontWeight: '800' },
  gardenTitle: { color: '#264432', fontSize: 22, lineHeight: 28, fontWeight: '800', marginBottom: 8 },
  gardenAction: { backgroundColor: '#3D7254', borderRadius: 15, paddingVertical: 13, paddingHorizontal: 12, alignItems: 'center', marginTop: 7 },
  gardenActionDone: { backgroundColor: '#DDEBE1' },
  gardenActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  gardenActionTextDone: { color: '#4D755C' },
  flowerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#EBE1D8', borderRadius: 20, padding: 13, marginBottom: 10, gap: 12 },
  flowerIcon: { width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  flowerEmoji: { fontSize: 27 },
  flowerCopy: { flex: 1 },
  flowerName: { color: '#35312E', fontSize: 12, fontWeight: '800', marginBottom: 2 },
  flowerStage: { alignSelf: 'flex-start', backgroundColor: '#F5ECE5', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4, marginTop: 5 },
  flowerStageText: { color: '#93523B', fontSize: 9, fontWeight: '800' },
  flowerTier: { color: '#7C7068', fontSize: 10, fontWeight: '700' },
  graceCard: { backgroundColor: '#FCF9F5', borderWidth: 1, borderColor: '#ECE2D8', borderRadius: 20, padding: 16, marginTop: 8, marginBottom: 12 },
  nestHero: { backgroundColor: '#1C2C36', borderColor: '#34444D', borderWidth: 1, borderRadius: 27, padding: 22, marginBottom: 18, alignItems: 'center' },
  nestEyebrow: { color: '#A2D2FF', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, alignSelf: 'flex-start' },
  nestOrb: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#35515C', borderWidth: 1, borderColor: '#71909A', alignItems: 'center', justifyContent: 'center', marginTop: 22, marginBottom: 18 },
  nestOrbEmoji: { fontSize: 43 },
  nestTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 7 },
  nestDescription: { color: '#CFD8DC', fontSize: 12, lineHeight: 19, textAlign: 'center', marginBottom: 17 },
  nestPlayButton: { backgroundColor: '#E07A5F', borderRadius: 17, paddingHorizontal: 18, paddingVertical: 13, minWidth: '75%', alignItems: 'center' },
  nestPlayButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  breathingSteps: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 15 },
  breathingStep: { backgroundColor: '#FFFFFF', borderColor: '#E6DCD1', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 20 },
  breathingStepActive: { backgroundColor: '#3D5A46', borderColor: '#3D5A46' },
  breathingStepText: { color: '#736358', fontSize: 11, fontWeight: '700' },
  breathingStepTextActive: { color: '#FFFFFF' },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#F3EEE9' },
  trackRowSelected: { backgroundColor: '#F2F8F5', borderRadius: 14, paddingHorizontal: 8, borderTopColor: '#DCEBE0' },
  trackEmojiBox: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F1ECE5', alignItems: 'center', justifyContent: 'center' },
  trackEmoji: { fontSize: 21 },
  trackCopy: { flex: 1 },
  trackTitle: { color: '#35312E', fontSize: 12, fontWeight: '800', marginBottom: 3 },
  trackSelect: { color: '#4B8060', fontSize: 10, fontWeight: '800' },
  safeIntroCard: { backgroundColor: '#FFF4F2', borderColor: '#FADCD7', borderWidth: 1, padding: 18, borderRadius: 22, marginBottom: 15 },
  safeIntroTitle: { color: '#B83E2D', fontSize: 16, lineHeight: 23, fontWeight: '800', marginBottom: 9 },
  groundingCard: { backgroundColor: '#FAF7F2', borderColor: '#EBE3D7', borderWidth: 1, borderRadius: 24, padding: 19, alignItems: 'center', marginBottom: 13 },
  groundingEyebrow: { color: '#8C7B71', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginBottom: 16 },
  groundingOrb: { width: 108, height: 108, borderRadius: 54, backgroundColor: '#F4DFC8', borderWidth: 2, borderColor: '#DDB99D', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  groundingPhase: { color: '#6D5443', fontSize: 14, fontWeight: '800' },
  aiConsentTitle: { color: '#4E6655', fontSize: 13, fontWeight: '700', marginTop: 10, marginBottom: 10 },
  aiLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10 },
  aiResultCard: { marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: '#F8F5F0', borderWidth: 1, borderColor: '#E7DED4' },
  aiSectionTitle: { marginTop: 12, marginBottom: 6, fontSize: 15, fontWeight: '700', color: '#536B55' },
  aiSignalRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDD7CE' },
  aiSignalTitle: { fontSize: 14, fontWeight: '700', color: '#4D5D4D', marginBottom: 3 },
  errorText: { color: '#A4473D', marginTop: 8, fontSize: 13, lineHeight: 18 },
  supportCard: { borderLeftWidth: 4 },
  supportToneCalm: { borderLeftColor: '#8FAE90' },
  supportToneGentle: { borderLeftColor: '#7FA8B3' },
  supportToneCaring: { borderLeftColor: '#D9A77E' },
  supportHeadline: { fontSize: 15, fontWeight: '800', color: '#455345', marginBottom: 6 },
  crisisCard: { backgroundColor: '#F1F5EE', borderColor: '#C9D9C4' },
  crisisRow: { paddingVertical: 10, minHeight: 48, justifyContent: 'center' },
  screeningItemText: { color: '#4D5D4D', fontSize: 13, fontWeight: '600', lineHeight: 19, marginTop: 12, marginBottom: 8 },
  crisisLabel: { color: '#455345', fontSize: 13, fontWeight: '600' },
  crisisNumber: { color: '#2F4A36', fontSize: 20, fontWeight: '800', marginTop: 2 },
  progressCard: { backgroundColor: '#E9EFE2', borderRadius: 23, borderWidth: 1, borderColor: '#D9E3CF', padding: 17, marginBottom: 26 },
  progressHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressEyebrow: { color: '#718366', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 },
  progressTitle: { color: '#43563F', fontSize: 15, fontWeight: '800', lineHeight: 21 },
  progressMetrics: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#D4DFC9' },
  progressMetric: { alignItems: 'center', minWidth: 67 },
  progressNumber: { color: '#43563F', fontSize: 21, fontWeight: '800' },
  progressLabel: { color: '#75806D', fontSize: 10, fontWeight: '700', marginTop: 2 },
  progressDivider: { height: 31, width: 1, backgroundColor: '#D0DCC5', marginHorizontal: 13 },
  progressNote: { flex: 1, color: '#75806D', fontSize: 10, lineHeight: 15, textAlign: 'right', marginLeft: 8 },
});
