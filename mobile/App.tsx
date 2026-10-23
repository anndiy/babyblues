
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

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
  sections: { heading: string; body: string[] }[];
  note?: string;
};

const EVENT_TYPES: EventType[] = ['feeding', 'sleep', 'diaper'];

const DISCOVER_ARTICLES: DiscoverArticle[] = [
  {
    id: 'overwhelmed', category: 'For you', emoji: '🫶', title: 'When everything feels like a lot',
    subtitle: 'A small plan for moments when you feel stretched thin.', color: '#F3EAF7', readTime: '3 min read',
    sections: [
      { heading: 'Make the next step smaller', body: [
        'You do not have to solve the whole day right now. Pick one immediate need: drink some water, eat something simple, use the bathroom, or sit somewhere comfortable.',
        'If the baby is in a safe place, it is okay to take a brief pause to collect yourself.'
      ]},
      { heading: 'Ask for a specific kind of help', body: [
        'Try a clear request such as: “Could you hold the baby for 20 minutes while I shower?” or “Could you bring me something to eat?” Specific requests can be easier for someone to act on.',
        'If help is available, you do not have to earn it by doing everything alone.'
      ]},
      { heading: 'Let “good enough” count', body: [
        'Some days, feeding everyone, keeping the baby safe, and getting through the next hour is enough. Non-urgent chores can wait.'
      ]}
    ],
    note: 'If feeling overwhelmed, anxious, low, or unlike yourself persists or interferes with daily life, contact a healthcare professional. If you think you may harm yourself or your baby, seek urgent help now and ask a trusted person to stay with you.'
  },
  {
    id: 'breathing', category: 'For you', emoji: '🌬️', title: 'A two-minute pause',
    subtitle: 'A gentle reset you can try without needing a perfect quiet moment.', color: '#EAF2E8', readTime: '2 min practice',
    sections: [
      { heading: 'Settle where you are', body: [
        'Sit or stand in a supported position. Let your shoulders drop if that feels comfortable, and loosen your jaw.',
        'You do not need to close your eyes. Keep them open if that feels better.'
      ]},
      { heading: 'Let your breathing be natural', body: [
        'Notice one ordinary breath coming in and going out. If it feels comfortable, allow the exhale to be a little slower without forcing or holding your breath.',
        'When your attention wanders, gently return it to the next breath. There is nothing to get right.'
      ]},
      { heading: 'Choose one next step', body: [
        'Before you continue, ask yourself: “What would help me in the next ten minutes?” It might be food, a message to someone, a stretch, or simply carrying on slowly.'
      ]}
    ],
    note: 'Stop the exercise if you feel dizzy, breathless, or uncomfortable. This is a brief coping practice, not a substitute for support when you need it.'
  },
  {
    id: 'newborn-cues', category: 'Baby care', emoji: '🍼', title: 'Learning your baby’s cues',
    subtitle: 'Look for patterns over time rather than expecting every moment to be predictable.', color: '#FBEDE2', readTime: '3 min read',
    sections: [
      { heading: 'Notice, respond, and learn', body: [
        'Babies communicate through sounds, movements, facial expressions, and changes in alertness. One cue can mean different things in different situations.',
        'You can pause to check common needs such as feeding, a nappy change, temperature, comfort, or tiredness. Over time, you may notice patterns that are particular to your baby.'
      ]},
      { heading: 'Keep notes simple', body: [
        'If it helps, log feeds, sleep, and nappies in BabyBlues. Use the record as a memory aid for yourself or for a conversation with your child’s healthcare professional—not as a test you need to pass.',
        'It is normal to need time and support while you learn what works for your family.'
      ]},
      { heading: 'When you are unsure', body: [
        'For questions about feeding, weight gain, hydration, or symptoms, ask your paediatrician or another qualified healthcare professional for guidance specific to your baby.'
      ]}
    ]
  },
  {
    id: 'rest', category: 'Recovery', emoji: '🌙', title: 'Rest when sleep comes in pieces',
    subtitle: 'Small ways to protect recovery when long stretches of sleep are hard to find.', color: '#EAEFF8', readTime: '3 min read',
    sections: [
      { heading: 'Think in opportunities, not perfect routines', body: [
        'If another trusted adult is available, discuss a practical handover or protected rest window. Even planning who is “on duty” can reduce the mental load.',
        'If you cannot sleep when the opportunity appears, quiet rest may still be a useful pause. Avoid judging yourself for how quickly you fall asleep.'
      ]},
      { heading: 'Reduce the decisions around you', body: [
        'Keep water, a snack, your charger, and other frequently used items where they are easy to reach. Prepare only what is safe to prepare ahead of time.',
        'Consider postponing non-urgent tasks and letting visitors help with food, dishes, laundry, or errands rather than expecting yourself to host.'
      ]},
      { heading: 'Keep baby sleep safety separate', body: [
        'When you are drowsy, put your baby in their own safe sleep space rather than risk falling asleep while holding them on a sofa or armchair. Follow current safe-sleep guidance from your healthcare provider or public-health authority.'
      ]}
    ],
    note: 'If exhaustion feels unmanageable or you are worried about your recovery, speak with your healthcare professional.'
  },
  {
    id: 'asking-help', category: 'Recovery', emoji: '🤲', title: 'Making a practical support plan',
    subtitle: 'Turn “let me know if you need anything” into help you can actually use.', color: '#F8EDE7', readTime: '2 min read',
    sections: [
      { heading: 'List the tasks that drain you', body: [
        'Think beyond baby care: meals, laundry, groceries, cleaning, transport, messages, and arranging appointments all take energy.'
      ]},
      { heading: 'Match a task to a person', body: [
        'Ask one person to bring dinner on a particular day, another to pick up supplies, or someone you trust to sit with you while you make a call. Give a time and a clear task where possible.',
        'If someone cannot help with one thing, you can ask whether another option would work.'
      ]},
      { heading: 'Include emotional support', body: [
        'You might say, “I do not need advice right now; could you listen for ten minutes?” or “Can you check in with me tomorrow?” You are allowed to say what kind of support would help.'
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
const [showCheckinForm, setShowCheckinForm] = useState(false);
const [aiSharingConsent, setAiSharingConsent] = useState(false);
const [aiConsentLoading, setAiConsentLoading] = useState(false);
const [aiConsentSetupReady, setAiConsentSetupReady] = useState(false);
const [aiAnalysis, setAiAnalysis] = useState<AIWellbeingAnalysis | null>(null);
const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
const [aiAnalysisError, setAiAnalysisError] = useState('');

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

  const renderSpace = () => (
    <>
      <View style={styles.greetingRow}>
        <View style={styles.greetingCopy}>
          <Text style={styles.eyebrow}>YOUR LITTLE SPACE</Text>
          <Text style={styles.greetingTitle}>Hi, {displayName} 🌿</Text>
          <Text style={styles.greetingSubtitle}>You’re caring for someone tiny. You matter, too.</Text>
        </View>
        <View style={styles.sunBadge}><Text style={styles.sunEmoji}>☀️</Text></View>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>A MOMENT FOR YOU</Text>
        <Text style={styles.heroTitle}>How are you feeling today?</Text>
        <Text style={styles.heroBody}>No right or wrong answer. Just check in with yourself, if you feel like it.</Text>
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
          <Text style={styles.featureTitle}>A tiny reminder</Text>
          <Text style={styles.bodyText}>Have you had a sip of water, a bite to eat, or a moment to sit down today?</Text>
          <Text style={styles.featureFootnote}>Small things count. You count, too.</Text>
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>What would help today?</Text>
      </View>
      <View style={styles.shortcutGrid}>
        <TouchableOpacity style={styles.shortcutCard} onPress={() => setActiveTab('baby')}>
          <Text style={styles.shortcutEmoji}>🧸</Text>
          <Text style={styles.shortcutTitle}>Baby care</Text>
          <Text style={styles.shortcutDescription}>Keep the little details in one place</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shortcutCard} onPress={() => setActiveTab('discover')}>
          <Text style={styles.shortcutEmoji}>🌱</Text>
          <Text style={styles.shortcutTitle}>Find a little help</Text>
          <Text style={styles.shortcutDescription}>Tips for rest, stress and new-parent life</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shortcutCard} onPress={() => setActiveTab('insights')}>
          <Text style={styles.shortcutEmoji}>💛</Text>
          <Text style={styles.shortcutTitle}>My reflections</Text>
          <Text style={styles.shortcutDescription}>Look back at your check-ins</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shortcutCard} onPress={() => setActiveTab('community')}>
          <Text style={styles.shortcutEmoji}>🤝</Text>
          <Text style={styles.shortcutTitle}>Parent corner</Text>
          <Text style={styles.shortcutDescription}>A space for shared experiences</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.closingNote}>You don’t have to do everything today. One moment at a time. 💜</Text>
    </>
  );

  const renderBaby = () => (
    <>
      <Text style={styles.eyebrow}>LITTLE ONE, BIG LOVE</Text>
      <Text style={styles.pageTitle}>My Baby 🧸</Text>
      <Text style={styles.pageSubtitle}>Keep the everyday details together, without needing to remember everything.</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Baby profiles</Text>
        {renderBabySelector()}
        <View style={styles.separator} />
        <TextInput style={styles.input} placeholder="Baby’s name" placeholderTextColor="#98938E" value={babyName} onChangeText={setBabyName} />
        <TextInput style={styles.input} placeholder="Date of birth (YYYY-MM-DD, optional)" placeholderTextColor="#98938E" value={birthDate} onChangeText={setBirthDate} autoCapitalize="none" />
        <TouchableOpacity style={styles.primaryButton} onPress={createBaby} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Add baby profile'}</Text>
        </TouchableOpacity>
      </View>

      {selectedBaby ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>A little note about {selectedBaby.display_name}</Text>
            <Text style={styles.mutedText}>Log feeding, sleep or diaper changes whenever it’s useful. You can keep it simple.</Text>
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
                {feedingType !== 'breastfeeding' && <TextInput style={styles.input} placeholder="Amount in ml (optional)" placeholderTextColor="#98938E" value={amountMl} onChangeText={setAmountMl} keyboardType="decimal-pad" />}
              </>
            )}
            {eventType === 'sleep' && <TextInput style={styles.input} placeholder="Sleep duration in hours, e.g. 1.5" placeholderTextColor="#98938E" value={sleepStart} onChangeText={setSleepStart} keyboardType="decimal-pad" />}
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
              placeholder="Anything else you’d like to remember? (optional)"
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
        <Text style={styles.pageTitle}>Discover 🌱</Text>
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
        <Text style={styles.pageTitle}>Parent Corner 🤝</Text>
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
          <Text style={styles.communityTitle}>You don’t have to have it all figured out.</Text>
          <Text style={styles.bodyText}>Posts are reviewed before they appear publicly. This is a peer-support space, not an emergency service or a source of personalised medical advice.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Share with the community</Text>
          <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
          <TextInput
            style={styles.input}
            value={communityNickname}
            onChangeText={setCommunityNickname}
            placeholder="e.g. QuietDaisy"
            placeholderTextColor="#A49A93"
            maxLength={24}
            autoCapitalize="words"
          />
          <Text style={styles.smallText}>Use a nickname, not your full name. Your email address is not shown on posts.</Text>
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>PICK A TOPIC</Text>
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
            placeholder="What would you like other parents to know?"
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
    { key: 'space' as const, label: 'My Space', emoji: '🌿' },
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
              onPress={() => setActiveTab(tab.key)}
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
  appShell: { flex: 1, backgroundColor: '#FBF8F4' },
  screen: { flex: 1, backgroundColor: '#FBF8F4' },
  content: { paddingHorizontal: 20, paddingTop: 58, paddingBottom: 28 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FBF8F4' },
  authCard: { width: '100%', maxWidth: 440, backgroundColor: '#FFFFFF', borderRadius: 26, padding: 25, borderWidth: 1, borderColor: '#EFE7E0' },
  brand: { fontSize: 30, fontWeight: '800', color: '#4E6655', letterSpacing: -1.2 },
  brandDot: { color: '#C98F83' },
  brandTagline: { color: '#92877F', fontSize: 12, marginTop: 1, letterSpacing: 0.3 },
  subtitle: { color: '#847B75', marginTop: 8, marginBottom: 22, lineHeight: 21 },
  heading: { fontSize: 25, fontWeight: '700', color: '#3E4C40', marginBottom: 18 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  signOutButton: { borderRadius: 18, backgroundColor: '#F0EBE5', paddingHorizontal: 13, paddingVertical: 9 },
  signOutText: { color: '#746C66', fontSize: 12, fontWeight: '600' },
  eyebrow: { color: '#A27C79', fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 8 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 22 },
  greetingCopy: { flex: 1 },
  greetingTitle: { fontSize: 29, lineHeight: 36, fontWeight: '800', color: '#3F4F42', letterSpacing: -0.8 },
  greetingSubtitle: { color: '#847B75', fontSize: 13, lineHeight: 20, marginTop: 7 },
  sunBadge: { width: 58, height: 58, borderRadius: 22, backgroundColor: '#F7E8CE', alignItems: 'center', justifyContent: 'center' },
  sunEmoji: { fontSize: 28 },
  heroCard: { backgroundColor: '#F0EAF5', borderRadius: 25, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#E9DFF0' },
  heroEyebrow: { color: '#8D779A', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 10 },
  heroTitle: { color: '#45394E', fontSize: 22, lineHeight: 29, fontWeight: '800', letterSpacing: -0.4 },
  heroBody: { color: '#766A7C', fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 17 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 },
  moodOption: { flexGrow: 1, flexBasis: '29%', minHeight: 82, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 10, borderRadius: 15, backgroundColor: '#FBF9FC', borderWidth: 1, borderColor: '#F3EDF6' },
  moodOptionSelected: { borderColor: '#A995BB', backgroundColor: '#E4D9EF' },
  moodEmoji: { fontSize: 25, marginBottom: 5 },
  moodLabel: { color: '#776C7D', fontSize: 10, textAlign: 'center', lineHeight: 14 },
  moodLabelSelected: { color: '#4E405C', fontWeight: '700' },
  checkinDetails: { borderTopWidth: 1, borderTopColor: '#DED3E7', paddingTop: 16, marginTop: 2 },
  selfCareCard: { flexDirection: 'row', gap: 13, backgroundColor: '#FFFFFF', borderRadius: 21, padding: 17, marginBottom: 27, borderWidth: 1, borderColor: '#EFE8E1' },
  sectionIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: '#F9EBDD', alignItems: 'center', justifyContent: 'center' },
  sectionEmoji: { fontSize: 22 },
  featureCopy: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '800', color: '#4B554A', marginBottom: 5 },
  featureFootnote: { color: '#9A7771', fontSize: 11, lineHeight: 17, marginTop: 7, fontWeight: '600' },
  sectionHeaderRow: { marginBottom: 13 },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: '#455345', letterSpacing: -0.3 },
  shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  shortcutCard: { width: '48%', flexGrow: 1, minHeight: 145, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#EFE8E1', padding: 15 },
  shortcutEmoji: { fontSize: 25, marginBottom: 12 },
  shortcutTitle: { color: '#4A554A', fontSize: 13, fontWeight: '800', marginBottom: 5 },
  shortcutDescription: { color: '#91877F', fontSize: 11, lineHeight: 16 },
  closingNote: { color: '#9B829A', textAlign: 'center', fontSize: 12, lineHeight: 19, marginTop: 24, marginBottom: 8 },
  pageTitle: { fontSize: 30, fontWeight: '800', color: '#3F4F42', letterSpacing: -0.7, marginBottom: 8 },
  pageSubtitle: { color: '#847B75', fontSize: 13, lineHeight: 21, marginBottom: 22 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 17, marginBottom: 15, borderWidth: 1, borderColor: '#EFE8E1' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#455345', marginBottom: 12 },
  bodyText: { color: '#756E68', fontSize: 13, lineHeight: 20, marginBottom: 7 },
  mutedText: { color: '#8C837D', fontSize: 12, lineHeight: 18 },
  smallText: { color: '#A49A93', fontSize: 10, lineHeight: 15, marginTop: 5 },
  input: { backgroundColor: '#FFFEFC', borderWidth: 1, borderColor: '#E8DED5', borderRadius: 12, padding: 13, fontSize: 14, color: '#455345', marginBottom: 11 },
  multiline: { minHeight: 76, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: '#6F8370', borderRadius: 13, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', marginTop: 6 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  quietButton: { alignItems: 'center', padding: 12, marginTop: 2 },
  quietButtonText: { color: '#82718D', fontSize: 12, fontWeight: '700' },
  link: { alignItems: 'center', padding: 16 },
  linkText: { color: '#718573', fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { borderRadius: 20, borderWidth: 1, borderColor: '#E4D8CD', paddingVertical: 9, paddingHorizontal: 12, backgroundColor: '#FFFEFC' },
  chipSelected: { backgroundColor: '#718573', borderColor: '#718573' },
  chipText: { color: '#687667', fontWeight: '600', fontSize: 12 },
  chipTextSelected: { color: '#FFFFFF' },
  fieldLabel: { fontSize: 12, color: '#6D7569', fontWeight: '800', marginBottom: 9 },
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
  discoverCard: { borderRadius: 22, padding: 19, marginBottom: 14 },
  categoryScroller: { flexGrow: 0, marginBottom: 13 },
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
  communityHero: { alignItems: 'center', backgroundColor: '#F6EDE7', borderRadius: 23, padding: 24, marginBottom: 15 },
  communityEmoji: { fontSize: 38, marginBottom: 13 },
  communityTitle: { textAlign: 'center', color: '#55484A', fontSize: 20, lineHeight: 27, fontWeight: '800', marginBottom: 10 },
  communityPostCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#EFE8E1' },
  communityPostHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  communityAvatar: { width: 39, height: 39, borderRadius: 14, backgroundColor: '#EAF2E8', alignItems: 'center', justifyContent: 'center' },
  communityAvatarText: { fontSize: 20 },
  communityPostAuthor: { color: '#4A554A', fontWeight: '800', fontSize: 13 },
  communityPostBody: { color: '#645D58', fontSize: 14, lineHeight: 22 },
  communityPostActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 13, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3EEE9' },
  communityActionText: { color: '#8D6A62', fontSize: 12, fontWeight: '800', padding: 4 },
  pendingBadge: { backgroundColor: '#FFF2DC', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5 },
  pendingBadgeText: { color: '#89663D', fontSize: 10, fontWeight: '800' },
  tabBar: { flexDirection: 'row', backgroundColor: '#FFFDFB', borderTopWidth: 1, borderTopColor: '#EEE6DE', paddingTop: 8, paddingBottom: 12, paddingHorizontal: 4 },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 51, gap: 3 },
  tabEmoji: { fontSize: 19, opacity: 0.75 },
  tabEmojiSelected: { opacity: 1, transform: [{ scale: 1.05 }] },
  tabLabel: { fontSize: 9, color: '#9B928A', fontWeight: '600' },
  tabLabelSelected: { color: '#607A63', fontWeight: '800' },
  tabIndicator: { width: 17, height: 3, borderRadius: 3, backgroundColor: '#91A58E', marginTop: 1 },
  ratingSection: { marginBottom: 17 },
  ratingTitle: { fontSize: 13, fontWeight: '800', color: '#5C6659', marginBottom: 9 },
  ratingRow: { flexDirection: 'row', gap: 7 },
  ratingButton: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: '#DED5E4', borderRadius: 11, backgroundColor: '#FFFEFC', alignItems: 'center', justifyContent: 'center' },
  ratingSelected: { backgroundColor: '#8A779D', borderColor: '#8A779D' },
  ratingText: { color: '#796A87', fontSize: 14, fontWeight: '800' },
  ratingTextSelected: { color: '#FFFFFF' },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  scaleLabel: { fontSize: 10, color: '#948A94' },
  status: { color: '#8D6A62', backgroundColor: '#F8EDE7', padding: 12, borderRadius: 11, marginVertical: 12, lineHeight: 19, fontSize: 12 },
  footer: { color: '#AAA098', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 22, marginBottom: 10 },

  aiConsentTitle: { color: '#4E6655', fontSize: 13, fontWeight: '700', marginTop: 10, marginBottom: 10 },
  aiLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10 },
  aiResultCard: { marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: '#F8F5F0', borderWidth: 1, borderColor: '#E7DED4' },
  aiSectionTitle: { marginTop: 12, marginBottom: 6, fontSize: 15, fontWeight: '700', color: '#536B55' },
  aiSignalRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDD7CE' },
  aiSignalTitle: { fontSize: 14, fontWeight: '700', color: '#4D5D4D', marginBottom: 3 },
  errorText: { color: '#A4473D', marginTop: 8, fontSize: 13, lineHeight: 18 },
});
