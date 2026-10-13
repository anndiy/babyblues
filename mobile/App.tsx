
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
      setStatus('Create or select a baby profile first.');
      return;
    }

    setSaving(true);
    setStatus('');

    const { data, error } = await supabase
      .from('care_logs')
      .insert({
        parent_id: session.user.id,
        baby_id: selectedBabyId,
        event_type: eventType,
        details: eventDetails.trim()
          ? { note: eventDetails.trim() }
          : {},
      })
      .select('id, event_type, logged_at, details')
      .single();

    setSaving(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setEvents((current) => [data as CareEvent, ...current].slice(0, 30));
    setEventDetails('');
    setStatus('Care event saved.');
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
});
