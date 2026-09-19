import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, isFirebaseReady } from '../config/firebase';

export type LobbyRoom = {
  id: string;
  code: string;
  name: string;
  hostId: string;
  players: string[];
  maxPlayers: number;
  createdAt?: number;
};

const demoRooms: LobbyRoom[] = [
  { id: 'demo-room-1', code: 'MOB-2048', name: 'Downtown', hostId: 'host-1', players: ['Vera', 'Milo', 'June'], maxPlayers: 6 },
  { id: 'demo-room-2', code: 'MOB-3141', name: 'Back Alley', hostId: 'host-2', players: ['Dax', 'Nia'], maxPlayers: 6 },
];

export async function loadLobbyRooms(): Promise<LobbyRoom[]> {
  if (!isFirebaseReady || !db) {
    return demoRooms;
  }

  try {
    const snapshot = await getDocs(collection(db, 'lobbies'));
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      code: String(docSnap.data().code ?? 'ROOM'),
      name: String(docSnap.data().name ?? 'Lobby'),
      hostId: String(docSnap.data().hostId ?? 'host'),
      players: Array.isArray(docSnap.data().players) ? docSnap.data().players.map(String) : [],
      maxPlayers: Number(docSnap.data().maxPlayers ?? 6),
      createdAt: Number(docSnap.data().createdAt ?? Date.now()),
    }));
  } catch (error) {
    console.warn('Unable to load rooms from Firestore, using demo rooms.', error);
    return demoRooms;
  }
}

export async function createLobbyRoom(hostName: string): Promise<LobbyRoom> {
  const code = `MOB-${Math.floor(1000 + Math.random() * 9000)}`;

  if (!isFirebaseReady || !db) {
    return {
      id: `demo-${Date.now()}`,
      code,
      name: `${hostName}'s Lobby`,
      hostId: hostName,
      players: [hostName],
      maxPlayers: 6,
      createdAt: Date.now(),
    };
  }

  const roomRef = await addDoc(collection(db, 'lobbies'), {
    code,
    name: `${hostName}'s Lobby`,
    hostId: hostName,
    players: [hostName],
    maxPlayers: 6,
    createdAt: serverTimestamp(),
  });

  return {
    id: roomRef.id,
    code,
    name: `${hostName}'s Lobby`,
    hostId: hostName,
    players: [hostName],
    maxPlayers: 6,
    createdAt: Date.now(),
  };
}

export async function joinLobbyRoom(roomCode: string, playerName: string): Promise<LobbyRoom | null> {
  if (!isFirebaseReady || !db) {
    const room = demoRooms.find((entry) => entry.code.toLowerCase() === roomCode.trim().toLowerCase());
    if (!room) return null;
    return { ...room, players: [...room.players, playerName] };
  }

  try {
    const queryByCode = query(collection(db, 'lobbies'));
    const snapshot = await getDocs(queryByCode);
    const match = snapshot.docs.find((docSnap) => String(docSnap.data().code ?? '').toLowerCase() === roomCode.trim().toLowerCase());

    if (!match) {
      return null;
    }

    const data = match.data();
    const nextPlayers = Array.isArray(data.players) ? [...new Set([...(data.players as string[]), playerName])] : [playerName];

    await setDoc(doc(db, 'lobbies', match.id), {
      ...data,
      players: nextPlayers,
    });

    return {
      id: match.id,
      code: String(data.code ?? roomCode),
      name: String(data.name ?? 'Lobby'),
      hostId: String(data.hostId ?? 'host'),
      players: nextPlayers,
      maxPlayers: Number(data.maxPlayers ?? 6),
      createdAt: Number(data.createdAt ?? Date.now()),
    };
  } catch (error) {
    console.warn('Unable to join room in Firestore, using demo fallback.', error);
    const room = demoRooms.find((entry) => entry.code.toLowerCase() === roomCode.trim().toLowerCase());
    if (!room) return null;
    return { ...room, players: [...room.players, playerName] };
  }
}
