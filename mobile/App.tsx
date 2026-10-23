
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

const EVENT_TYPES: EventType[] = ['feeding', 'sleep', 'diaper'];

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

const [mood, setMood] = useState(3);
const [stress, setStress] = useState(3);
const [energy, setEnergy] = useState(3);
const [appetite, setAppetite] = useState(3);
const [sleepHours, setSleepHours] = useState('');
const [checkins, setCheckins] = useState<WellbeingCheckin[]>([]);
const [savingCheckin, setSavingCheckin] = useState(false);
const [activeTab, setActiveTab] = useState<'space' | 'baby' | 'insights' | 'discover' | 'community'>('space');
const [showCheckinForm, setShowCheckinForm] = useState(false);


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
    const moodWord = (value: number) => moodOptions.find((option) => option.value === value)?.label ?? 'Not recorded';
    return (
      <>
        <Text style={styles.eyebrow}>YOUR JOURNEY, YOUR PACE</Text>
        <Text style={styles.pageTitle}>My Reflections 💛</Text>
        <Text style={styles.pageSubtitle}>A gentle look back at what you’ve shared with yourself. These are reflections, not grades.</Text>
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
        {latest && previous && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Since your previous check-in</Text>
            <Text style={styles.bodyText}>Mood: {latest.mood === previous.mood ? 'about the same' : latest.mood > previous.mood ? 'you rated it a little better' : 'you rated it a little harder'}.</Text>
            <Text style={styles.bodyText}>Stress: {latest.stress === previous.stress ? 'about the same' : latest.stress > previous.stress ? 'you reported more stress' : 'you reported less stress'}.</Text>
            <Text style={styles.smallText}>A small comparison between two moments, not a measure of your overall wellbeing.</Text>
          </View>
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

  const renderDiscover = () => (
    <>
      <Text style={styles.eyebrow}>A LITTLE KNOWLEDGE, A LITTLE COMFORT</Text>
      <Text style={styles.pageTitle}>Discover 🌱</Text>
      <Text style={styles.pageSubtitle}>Small, practical reads for the big changes that come with a new little person.</Text>
      <View style={[styles.discoverCard, { backgroundColor: '#F3EAF7' }]}>
        <Text style={styles.discoverEmoji}>🫶</Text>
        <Text style={styles.discoverCategory}>FOR THE PARENT</Text>
        <Text style={styles.discoverTitle}>When everything feels like a lot</Text>
        <Text style={styles.bodyText}>A gentle reminder that asking for help is part of caring, too.</Text>
        <Text style={styles.comingSoon}>Guides are coming in a future update</Text>
      </View>
      <View style={[styles.discoverCard, { backgroundColor: '#EAF2E8' }]}>
        <Text style={styles.discoverEmoji}>🌬️</Text>
        <Text style={styles.discoverCategory}>A TWO-MINUTE PAUSE</Text>
        <Text style={styles.discoverTitle}>A simple breathing break</Text>
        <Text style={styles.bodyText}>Find a comfortable position, relax your shoulders, and breathe gently at a pace that feels natural. Stop if it feels uncomfortable.</Text>
        <Text style={styles.comingSoon}>More stress-management ideas coming soon</Text>
      </View>
      <View style={[styles.discoverCard, { backgroundColor: '#FBEDE2' }]}>
        <Text style={styles.discoverEmoji}>🍼</Text>
        <Text style={styles.discoverCategory}>NEW-PARENT NOTES</Text>
        <Text style={styles.discoverTitle}>You’re learning as you go</Text>
        <Text style={styles.bodyText}>There is no single perfect way to be a parent. Reliable, age-appropriate guidance can help you make decisions one step at a time.</Text>
        <Text style={styles.comingSoon}>Parenting articles coming soon</Text>
      </View>
    </>
  );

  const renderCommunity = () => (
    <>
      <Text style={styles.eyebrow}>YOU’RE NOT THE ONLY ONE</Text>
      <Text style={styles.pageTitle}>Parent Corner 🤝</Text>
      <Text style={styles.pageSubtitle}>A future space to share the small wins, the hard bits, and the things you wish someone had told you.</Text>
      <View style={styles.communityHero}>
        <Text style={styles.communityEmoji}>🌷</Text>
        <Text style={styles.communityTitle}>A little more understanding, together.</Text>
        <Text style={styles.bodyText}>Community features are still being built. When they arrive, they’ll be designed around respect, privacy and supportive conversations.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What we want this space to be</Text>
        <Text style={styles.bodyText}>• A place to ask questions without shame.</Text>
        <Text style={styles.bodyText}>• A place to share experiences, not compare journeys.</Text>
        <Text style={styles.bodyText}>• A place with reporting and moderation to help keep people safe.</Text>
      </View>
    </>
  );

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
  discoverCard: { borderRadius: 22, padding: 19, marginBottom: 14 },
  discoverEmoji: { fontSize: 28, marginBottom: 13 },
  discoverCategory: { color: '#8D779A', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 },
  discoverTitle: { color: '#49434D', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  comingSoon: { color: '#8B7D86', fontSize: 10, marginTop: 8, fontStyle: 'italic' },
  communityHero: { alignItems: 'center', backgroundColor: '#F6EDE7', borderRadius: 23, padding: 24, marginBottom: 15 },
  communityEmoji: { fontSize: 38, marginBottom: 13 },
  communityTitle: { textAlign: 'center', color: '#55484A', fontSize: 20, lineHeight: 27, fontWeight: '800', marginBottom: 10 },
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
});
