import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
export const signInModes = ['signin', 'signup'] as const;
export type AuthMode = (typeof signInModes)[number];

export type AuthFormValues = {
  mode: AuthMode;
  displayName: string;
  email: string;
  password: string;
  dob: string;
  acceptTerms: boolean;
};

type AuthScreenProps = {
  isSubmitting: boolean;
  errorMessage: string;
  onSubmit: (values: AuthFormValues) => Promise<void> | void;
};

export function AuthScreen({ isSubmitting, errorMessage, onSubmit }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('signup');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const subtitle = useMemo(() => {
    return mode === 'signup' ? 'Create a secure account to play.' : 'Welcome back to the town.';
  }, [mode]);

  const handleSubmit = () => {
    onSubmit({
      mode,
      displayName,
      email,
      password,
      dob,
      acceptTerms,
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.kicker}>Mafia Wars</Text>
          <Text style={styles.title}>The Town has a problem</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.segmentedControl}>
            {signInModes.map((value) => (
              <Pressable
                key={value}
                onPress={() => setMode(value)}
                style={[styles.segmentButton, mode === value && styles.segmentButtonActive]}
              >
                <Text style={[styles.segmentText, mode === value && styles.segmentTextActive]}>
                  {value === 'signin' ? 'Sign in' : 'Sign up'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.card}>
            {mode === 'signup' && (
              <>
                <Text style={styles.label}>Display name</Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Your in-game name"
                  placeholderTextColor="#8ea6bd"
                  style={styles.input}
                />
              </>
            )}

            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#8ea6bd"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={styles.input}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#8ea6bd"
              secureTextEntry
              style={styles.input}
            />

            {mode === 'signup' && (
              <>
                <Text style={styles.label}>Date of birth</Text>
                <TextInput
                  value={dob}
                  onChangeText={setDob}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#8ea6bd"
                  keyboardType="numbers-and-punctuation"
                  style={styles.input}
                />

                <View style={styles.termsRow}>
                  <Switch
                    value={acceptTerms}
                    onValueChange={setAcceptTerms}
                    thumbColor={acceptTerms ? '#f4f7fb' : '#dbe5f1'}
                    trackColor={{ false: '#1d3048', true: '#cf5c2c' }}
                  />
                  <Text style={styles.termsText}>I accept the privacy policy and terms</Text>
                </View>
              </>
            )}

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Pressable style={styles.primaryButton} onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.metaText}>Age gate and privacy policy are required for app store readiness.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080d17' },
  keyboardView: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  kicker: { color: '#b3c7db', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8, fontWeight: '700' },
  title: { color: '#f2f7ff', fontSize: Platform.OS === 'ios' ? 36 : 32, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#8ea6bd', fontSize: 15, lineHeight: 22, marginBottom: 22 },
  segmentedControl: { flexDirection: 'row', backgroundColor: '#111d2d', borderRadius: 14, padding: 5, marginBottom: 20 },
  segmentButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segmentButtonActive: { backgroundColor: '#7c2d12' },
  segmentText: { color: '#d9e7f5', fontWeight: '600' },
  segmentTextActive: { color: '#fff' },
  card: { backgroundColor: '#101b2b', borderColor: '#1d3048', borderWidth: 1, borderRadius: 18, padding: 18 },
  label: { color: '#d7e8ff', fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 8 },
  input: { backgroundColor: '#0d1725', borderColor: '#213549', borderWidth: 1, color: '#f2f7ff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 6 },
  termsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8 },
  termsText: { color: '#d8e8ff', marginLeft: 10, flex: 1, fontSize: 13 },
  errorText: { color: '#ffb4a0', fontSize: 12, marginTop: 8, marginBottom: 6 },
  primaryButton: { marginTop: 18, backgroundColor: '#cf5c2c', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  metaText: { color: '#7d97af', fontSize: 12, marginTop: 18, lineHeight: 18 },
});
