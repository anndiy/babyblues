
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
  const [sleepEnd, setSleepEnd] = useState('');
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
        .select('id, event_type, logged_at, details')
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

     const sleepValue = sleepHours.trim() === ''
      ? null
      : Number(sleepHours);

    if (
      sleepValue !== null &&
      (!Number.isFinite(sleepValue) || sleepValue < 0 || sleepValue > 24)
    ) {
      Alert.alert(
        'Invalid sleep duration',
        'Enter sleep between 0 and 24 hours, or leave it blank if unknown.',
      );
      return;
    }

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
            Care for the baby. Don't forget the mother.
          </Text>
          <Text style={styles.heading}>
            {isSignUp ? 'Create account' : 'Welcome back'}
          </Text>

          {isSignUp && (
            <TextInput
              style={styles.input}
              placeholder="Your name"
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
            style={styles.button}
            disabled={authLoading}
            onPress={handleAuth}
          >
            <Text style={styles.buttonText}>
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

  const selectedBaby = babies.find(
    (baby) => baby.id === selectedBabyId
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>BabyBlues</Text>
          <Text style={styles.subtitle}>Care starts with noticing.</Text>
        </View>

        <TouchableOpacity onPress={signOut}>
          <Text style={styles.linkText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Baby profiles</Text>

      {loadingBabies ? (
        <ActivityIndicator color="#365B50" />
      ) : (
        <View style={styles.chipRow}>
          {babies.map((baby) => (
            <TouchableOpacity
              key={baby.id}
              style={[
                styles.chip,
                selectedBabyId === baby.id && styles.chipSelected,
              ]}
              onPress={() => {
                setSelectedBabyId(baby.id);
                setStatus('');
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedBabyId === baby.id && styles.chipTextSelected,
                ]}
              >
                {baby.display_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add a baby</Text>

        <TextInput
          style={styles.input}
          placeholder="Baby's name"
          value={babyName}
          onChangeText={setBabyName}
        />

        <TextInput
          style={styles.input}
          placeholder="Date of birth (YYYY-MM-DD, optional)"
          value={birthDate}
          onChangeText={setBirthDate}
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={styles.button}
          onPress={createBaby}
          disabled={saving}
        >
          <Text style={styles.buttonText}>Create baby profile</Text>
        </TouchableOpacity>
      </View>

      {!!selectedBaby && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Log care for {selectedBaby.display_name}
            </Text>

            <View style={styles.chipRow}>
              {EVENT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.chip,
                    eventType === type && styles.chipSelected,
                  ]}
                  onPress={() => setEventType(type)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      eventType === type && styles.chipTextSelected,
                    ]}
                  >
                    {type === 'feeding'
                      ? 'Feeding'
                      : type === 'sleep'
                        ? 'Sleep'
                        : 'Diaper'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

      {eventType === 'feeding' && (
        <>
          <Text style={styles.ratingTitle}>Feeding type</Text>
          <View style={styles.chipRow}>
            {[
              ['breastfeeding', 'Breastfeeding'],
              ['expressed_milk', 'Expressed milk'],
              ['formula', 'Formula'],
              ['solids', 'Solids'],
              ['other', 'Other'],
            ].map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.chip,
                  feedingType === value && styles.chipSelected,
                ]}
                onPress={() => setFeedingType(value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    feedingType === value && styles.chipTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {feedingType !== 'breastfeeding' && (
            <TextInput
              style={styles.input}
              placeholder="Amount in ml (optional)"
              value={amountMl}
              onChangeText={setAmountMl}
              keyboardType="decimal-pad"
            />
          )}
        </>
      )}

      {eventType === 'sleep' && (
        <TextInput
          style={styles.input}
          placeholder="Sleep duration in hours, e.g. 1.5"
          value={sleepStart}
          onChangeText={setSleepStart}
          keyboardType="decimal-pad"
        />
      )}

      {eventType === 'diaper' && (
        <>
          <Text style={styles.ratingTitle}>Diaper type</Text>
          <View style={styles.chipRow}>
            {[
              ['wet', 'Wet'],
              ['dirty', 'Dirty'],
              ['both', 'Both'],
            ].map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.chip,
                  diaperType === value && styles.chipSelected,
                ]}
                onPress={() => setDiaperType(value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    diaperType === value && styles.chipTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder={
                eventType === 'feeding'
                  ? 'Optional: milk type, amount, notes'
                  : eventType === 'sleep'
                    ? 'Optional: duration, notes'
                    : 'Optional: wet, dirty, notes'
              }
              value={eventDetails}
              onChangeText={setEventDetails}
              multiline
            />

            <TouchableOpacity
              style={styles.button}
              onPress={saveEvent}
              disabled={saving}
            >
              <Text style={styles.buttonText}>
                {saving ? 'Saving...' : 'Save care event'}
              </Text>
            </TouchableOpacity>
          </View>
                    
          <View style={styles.card}>
            <Text style={styles.cardTitle}>How are you doing?</Text>

            <Text style={styles.subtitle}>
              Your wellbeing matters too. These check-ins are voluntary.
            </Text>

            {(
              [
                {
                  key: 'mood',
                  title: 'Mood',
                  low: 'Very low',
                  high: 'Very good',
                  value: mood,
                  set: setMood,
                },
                {
                  key: 'stress',
                  title: 'Stress',
                  low: 'Very low',
                  high: 'Very high',
                  value: stress,
                  set: setStress,
                },
                {
                  key: 'energy',
                  title: 'Energy',
                  low: 'Exhausted',
                  high: 'Very energetic',
                  value: energy,
                  set: setEnergy,
                },
                {
                  key: 'appetite',
                  title: 'Appetite',
                  low: 'Very poor',
                  high: 'Very good',
                  value: appetite,
                  set: setAppetite,
                },
              ] as const
            ).map((item) => (
              <View key={item.key} style={styles.ratingSection}>
                <Text style={styles.ratingTitle}>{item.title}</Text>

                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <TouchableOpacity
                      key={value}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.title}, ${value} out of 5`}
                      accessibilityState={{ selected: item.value === value }}
                      style={[
                        styles.ratingButton,
                        item.value === value && styles.ratingSelected,
                      ]}
                      onPress={() => item.set(value)}
                    >
                      <Text
                        style={[
                          styles.ratingText,
                          item.value === value && styles.ratingTextSelected,
                        ]}
                      >
                        {value}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.scaleLabels}>
                  <Text style={styles.scaleLabel}>{item.low}</Text>
                  <Text style={styles.scaleLabel}>{item.high}</Text>
                </View>
              </View>
            ))}

            <Text style={styles.ratingTitle}>Sleep in the last 24 hours</Text>

            <TextInput
              style={styles.input}
              placeholder="Hours slept, e.g. 5.5 (optional)"
              value={sleepHours}
              onChangeText={setSleepHours}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity
              style={styles.button}
              onPress={saveCheckin}
              disabled={savingCheckin}
            >
              <Text style={styles.buttonText}>
                {savingCheckin ? 'Saving...' : 'Save wellbeing check-in'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Previous check-ins</Text>

          {checkins.length === 0 ? (
            <Text style={styles.empty}>
              No check-ins yet. You can record one whenever you choose.
            </Text>
          ) : (
            checkins.map((item) => (
              <View key={item.id} style={styles.eventCard}>
                <Text style={styles.eventTitle}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>

                <Text style={styles.eventNote}>
                  Mood: {item.mood}/5 · Stress: {item.stress}/5
                </Text>

                <Text style={styles.eventNote}>
                  Energy: {item.energy}/5 · Appetite:{' '}
                  {item.appetite == null ? 'Not recorded' : `${item.appetite}/5`}
                </Text>

                <Text style={styles.eventNote}>
                  Sleep:{' '}
                  {item.sleep_hours == null
                    ? 'Not recorded'
                    : `${item.sleep_hours} hours`}
                </Text>
              </View>
            ))
          )}


          <Text style={styles.sectionTitle}>Recent care history</Text>

          {events.length === 0 ? (
            <Text style={styles.empty}>
              No events yet. Record the first one above.
            </Text>
          ) : (
            events.map((event) => (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle}>
                    {event.event_type === 'feeding'
                      ? 'Feeding'
                      : event.event_type === 'sleep'
                        ? 'Sleep'
                        : 'Diaper change'}
                  </Text>
                  <Text style={styles.eventTime}>
                    {new Date(event.logged_at).toLocaleString()}
                  </Text>
                  {event.event_type === 'feeding' && (
                    <Text style={styles.eventNote}>
                      Type: {event.feeding_type ?? 'Not recorded'}
                      {event.amount_ml != null ? ` · ${event.amount_ml} ml` : ''}
                    </Text>
                  )}

                  {event.event_type === 'sleep' &&
                    event.sleep_started_at &&
                    event.sleep_ended_at && (
                      <Text style={styles.eventNote}>
                        Duration: {(
                          (new Date(event.sleep_ended_at).getTime() -
                            new Date(event.sleep_started_at).getTime()) /
                          3600000
                        ).toFixed(1)} hours
                      </Text>
                    )}

                  {event.event_type === 'diaper' && (
                    <Text style={styles.eventNote}>
                      Type: {event.diaper_type ?? 'Not recorded'}
                    </Text>
                  )}
                </View>

                {typeof event.details?.note === 'string' &&
                  event.details.note.length > 0 && (
                    <Text style={styles.eventNote}>
                      {event.details.note}
                    </Text>
                  )}
              </View>
            ))
          )}
        </>
      )}

      {!!status && <Text style={styles.status}>{status}</Text>}

      <Text style={styles.footer}>
        BabyBlues is an early-awareness prototype, not a diagnostic tool.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F5F0' },
  content: { padding: 22, paddingTop: 58, paddingBottom: 40 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F3F5F0',
  },
  authCard: { width: '100%', maxWidth: 440 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    gap: 12,
  },
  brand: {
    fontSize: 32,
    fontWeight: '800',
    color: '#365B50',
  },
  subtitle: { color: '#68766D', marginTop: 5, marginBottom: 22 },
  heading: {
    fontSize: 23,
    fontWeight: '700',
    color: '#263C33',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#263C33',
    marginTop: 10,
    marginBottom: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 17,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#E0E6DE',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#263C33',
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E0D8',
    borderRadius: 11,
    padding: 14,
    fontSize: 15,
    color: '#263C33',
    marginBottom: 12,
  },
  multiline: { minHeight: 76, textAlignVertical: 'top' },
  button: {
    backgroundColor: '#365B50',
    borderRadius: 11,
    padding: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  link: { alignItems: 'center', padding: 18 },
  linkText: { color: '#365B50', fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CAD7CD',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  chipSelected: { backgroundColor: '#365B50', borderColor: '#365B50' },
  chipText: { color: '#365B50', fontWeight: '600' },
  chipTextSelected: { color: '#FFFFFF' },
  eventCard: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E6DE',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  eventTitle: { fontWeight: '700', color: '#263C33', fontSize: 15 },
  eventTime: { color: '#68766D', fontSize: 12 },
  eventNote: { color: '#4C5C52', marginTop: 8, lineHeight: 20 },
  empty: { color: '#68766D', marginBottom: 20 },
  status: { color: '#365B50', marginVertical: 12, lineHeight: 20 },
  footer: {
    color: '#7A847D',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 25,
  },
  ratingSection: {
    marginBottom: 20,
  },
  ratingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#263C33',
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#CAD7CD',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingSelected: {
    backgroundColor: '#365B50',
    borderColor: '#365B50',
  },
  ratingText: {
    color: '#365B50',
    fontSize: 16,
    fontWeight: '700',
  },
  ratingTextSelected: {
    color: '#FFFFFF',
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
  },
  scaleLabel: {
    fontSize: 11,
    color: '#68766D',
  },

});
