import { Alert, View } from 'react-native';
import { useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, isFirebaseReady } from './src/config/firebase';
import { sanitizeDisplayName, validateAgeGate, validateEmail } from './src/lib/auth';
import { createLobbyRoom, joinLobbyRoom, loadLobbyRooms, type LobbyRoom } from './src/lib/lobby';
import { AuthScreen, type AuthFormValues } from './src/screens/AuthScreen';
import { LobbyScreen } from './src/screens/LobbyScreen';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lobbyRooms, setLobbyRooms] = useState<LobbyRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<LobbyRoom | null>(null);

  const refreshRooms = async () => {
    const rooms = await loadLobbyRooms();
    setLobbyRooms(rooms);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    void refreshRooms();
  }, [isAuthenticated]);

  const handleAuthSubmit = async (values: AuthFormValues) => {
    const trimmedEmail = values.email.trim();
    const trimmedName = sanitizeDisplayName(values.displayName);
    const isSignup = values.mode === 'signup';

    if (!trimmedEmail || !values.password.trim()) {
      setErrorMessage('Email and password are required.');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (isSignup) {
      if (!trimmedName) {
        setErrorMessage('Please choose a display name.');
        return;
      }

      if (!values.dob) {
        setErrorMessage('Please enter your date of birth.');
        return;
      }

      if (!validateAgeGate(values.dob)) {
        setErrorMessage('You must be at least 13 years old to play.');
        return;
      }

      if (!values.acceptTerms) {
        setErrorMessage('You must accept the terms and privacy policy.');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      if (isFirebaseReady) {
        if (isSignup) {
          await createUserWithEmailAndPassword(auth, trimmedEmail, values.password);
        } else {
          await signInWithEmailAndPassword(auth, trimmedEmail, values.password);
        }
      } else {
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 700));
      }

      setDisplayName(trimmedName || trimmedEmail.split('@')[0]);
      setEmail(trimmedEmail);
      setIsAuthenticated(true);
      Alert.alert('Welcome', `You are ready to join the next round, ${trimmedName || trimmedEmail.split('@')[0]}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to continue right now.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRoom = async () => {
    const nextName = sanitizeDisplayName(displayName) || email.split('@')[0] || 'Detective';
    const room = await createLobbyRoom(nextName);
    setActiveRoom(room);
    setRoomCodeInput(room.code);
    await refreshRooms();
  };

  const handleJoinRoom = async () => {
    const nextName = sanitizeDisplayName(displayName) || email.split('@')[0] || 'Detective';
    const room = await joinLobbyRoom(roomCodeInput, nextName);

    if (!room) {
      setErrorMessage('Room code not found.');
      return;
    }

    setActiveRoom(room);
    setRoomCodeInput(room.code);
    await refreshRooms();
  };

  if (isAuthenticated) {
    return (
      <LobbyScreen
        displayName={displayName}
        email={email}
        roomCodeInput={roomCodeInput}
        onRoomCodeChange={setRoomCodeInput}
        lobbyRooms={lobbyRooms}
        activeRoom={activeRoom}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onSelectRoom={(room) => {
          setActiveRoom(room);
          setRoomCodeInput(room.code);
        }}
        errorMessage={errorMessage}
      />
    );
  }

  return <AuthScreen isSubmitting={isSubmitting} errorMessage={errorMessage} onSubmit={handleAuthSubmit} />;
}
