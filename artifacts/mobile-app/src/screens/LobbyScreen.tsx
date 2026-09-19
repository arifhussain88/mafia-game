import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { type LobbyRoom } from '../lib/lobby';

type LobbyScreenProps = {
  displayName: string;
  email: string;
  roomCodeInput: string;
  onRoomCodeChange: (value: string) => void;
  lobbyRooms: LobbyRoom[];
  activeRoom: LobbyRoom | null;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onSelectRoom: (room: LobbyRoom) => void;
  errorMessage: string;
};

export function LobbyScreen({
  displayName,
  email,
  roomCodeInput,
  onRoomCodeChange,
  lobbyRooms,
  activeRoom,
  onCreateRoom,
  onJoinRoom,
  onSelectRoom,
  errorMessage,
}: LobbyScreenProps) {
  const playerName = displayName || email.split('@')[0] || 'Detective';

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.kicker}>Mafia Wars</Text>
        <Text style={styles.title}>The Town has a problem</Text>
        <Text style={styles.subtitle}>Lobby ready</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Player</Text>
          <Text style={styles.playerName}>{playerName}</Text>

          {activeRoom ? (
            <>
              <View style={styles.lobbyRow}>
                <Text style={styles.lobbyLabel}>Room</Text>
                <Text style={styles.roomCode}>{activeRoom.code}</Text>
              </View>

              <View style={styles.lobbyRow}>
                <Text style={styles.lobbyLabel}>Players</Text>
                <Text style={styles.lobbyValue}>{activeRoom.players.length}/{activeRoom.maxPlayers}</Text>
              </View>
            </>
          ) : (
            <View style={styles.lobbyRow}>
              <Text style={styles.lobbyLabel}>Room code</Text>
              <TextInput
                value={roomCodeInput}
                onChangeText={onRoomCodeChange}
                placeholder="MOB-2048"
                placeholderTextColor="#8ea6bd"
                autoCapitalize="characters"
                style={styles.roomInput}
              />
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Available rooms</Text>
        {lobbyRooms.length === 0 ? (
          <Text style={styles.emptyText}>No public rooms yet. Create one to start the next match.</Text>
        ) : (
          lobbyRooms.map((room) => (
            <Pressable
              key={room.id}
              onPress={() => onSelectRoom(room)}
              style={styles.roomListItem}
            >
              <Text style={styles.roomListCode}>{room.code}</Text>
              <Text style={styles.roomListMeta}>{room.name}</Text>
              <Text style={styles.roomListMeta}>{room.players.length}/{room.maxPlayers} players</Text>
            </Pressable>
          ))
        )}

        <Pressable style={styles.primaryButton} onPress={onCreateRoom}>
          <Text style={styles.primaryButtonText}>Create Room</Text>
        </Pressable>

        <Pressable style={[styles.secondaryButton, styles.mt12]} onPress={onJoinRoom}>
          <Text style={styles.secondaryButtonText}>Join Match</Text>
        </Pressable>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080d17' },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 48 },
  kicker: { color: '#b3c7db', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8, fontWeight: '700' },
  title: { color: '#f2f7ff', fontSize: 32, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#8ea6bd', fontSize: 15, lineHeight: 22, marginBottom: 22 },
  card: { backgroundColor: '#101b2b', borderColor: '#1d3048', borderWidth: 1, borderRadius: 18, padding: 18 },
  cardLabel: { color: '#b0c2d9', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 },
  playerName: { color: '#f2f7ff', fontSize: 28, fontWeight: '800', marginBottom: 18 },
  lobbyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomColor: '#1d3048', borderBottomWidth: 1 },
  lobbyLabel: { color: '#a6bfd7', fontSize: 14 },
  lobbyValue: { color: '#f2f7ff', fontWeight: '700' },
  roomCode: { color: '#f6a86f', fontWeight: '800', letterSpacing: 1.5 },
  roomInput: { backgroundColor: '#0d1725', borderColor: '#213549', borderWidth: 1, color: '#f2f7ff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minWidth: 120, textAlign: 'center' },
  sectionTitle: { color: '#edf5ff', fontSize: 16, fontWeight: '700', marginTop: 18, marginBottom: 10 },
  roomListItem: { backgroundColor: '#101b2b', borderColor: '#213549', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  roomListCode: { color: '#f6a86f', fontWeight: '800', fontSize: 16, marginBottom: 4 },
  roomListMeta: { color: '#a8c0d8', fontSize: 12 },
  emptyText: { color: '#97abc0', fontSize: 13, marginBottom: 12 },
  primaryButton: { marginTop: 18, backgroundColor: '#cf5c2c', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryButton: { marginTop: 12, borderColor: '#4d6480', borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#dfeaf9', fontSize: 16, fontWeight: '700' },
  mt12: { marginTop: 12 },
  errorText: { color: '#ffb4a0', fontSize: 12, marginTop: 8, marginBottom: 6 },
});
