import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView as RNWebView, type WebViewNavigation } from 'react-native-webview';
import type {
  ShouldStartLoadRequest,
  WebViewErrorEvent,
  WebViewHttpErrorEvent,
} from 'react-native-webview/lib/WebViewTypes';

// react-native-webview declares `class WebView<P = undefined>` and its props as
// `WebViewProps & P`; with P = undefined that collapses to `never` under the
// strict TS API in RN 0.88. Instantiate it with an empty extra-props type.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const WebView = RNWebView<{}>;
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type WebViewRef = RNWebView<{}>;

/**
 * Mafia Wars mobile shell.
 *
 * The game itself is the React web app served by the API server (artifacts/game-lobby).
 * This app loads it in a full-screen WebView so the same build runs in Expo Go for
 * testing and becomes the Play Store app through EAS Build — one codebase to maintain.
 *
 * Game URL priority:
 *   1. EXPO_PUBLIC_GAME_URL (e.g. your LAN Vite server: http://192.168.1.42:5173)
 *   2. app.json -> expo.extra.gameUrl (the live server)
 */
const GAME_URL = (
  process.env.EXPO_PUBLIC_GAME_URL ||
  (Constants.expoConfig?.extra?.gameUrl as string | undefined) ||
  'http://141.148.204.30'
).replace(/\/+$/, '');

const GAME_ORIGIN = (() => {
  const match = GAME_URL.match(/^(https?:\/\/[^/]+)/i);
  return match ? match[1].toLowerCase() : GAME_URL.toLowerCase();
})();

const BG = '#0b0b0f';
const ACCENT = '#d97706';

function isGameUrl(url: string) {
  return url.toLowerCase().startsWith(GAME_ORIGIN);
}

export default function App() {
  const webRef = useRef<WebViewRef>(null);
  const canGoBackRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Android hardware back: go back inside the game (e.g. from Privacy page) instead of closing the app.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBackRef.current) {
        webRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const onNavChange = useCallback((nav: WebViewNavigation) => {
    canGoBackRef.current = nav.canGoBack;
  }, []);

  // Keep the game inside the app; send mailto:, tel: and other sites to the system.
  const onShouldStart = useCallback((req: ShouldStartLoadRequest) => {
    const { url } = req;
    if (url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:')) return true;
    if (isGameUrl(url)) return true;
    void Linking.openURL(url).catch(() => {});
    return false;
  }, []);

  const retry = useCallback(() => {
    setFailed(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="light" />

        {failed ? (
          <View style={styles.center}>
            <Text style={styles.title}>Can't reach the town</Text>
            <Text style={styles.body}>
              Check your internet connection and try again.
            </Text>
            <Pressable style={styles.button} onPress={retry} accessibilityRole="button">
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
            {__DEV__ ? <Text style={styles.debug}>{GAME_URL}{'\n'}{failed}</Text> : null}
          </View>
        ) : (
          <WebView
            key={reloadKey}
            ref={webRef}
            source={{ uri: GAME_URL }}
            style={styles.web}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            // Login token is kept in localStorage; keep it across launches.
            incognito={false}
            cacheEnabled
            // Game sounds/music start after a tap; allow autoplay of follow-up sounds.
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            // target="_blank" links (Privacy/Terms) open in the same view; back button returns.
            setSupportMultipleWindows={false}
            mixedContentMode="never"
            overScrollMode="never"
            pullToRefreshEnabled={false}
            bounces={false}
            textZoom={100}
            applicationNameForUserAgent="MafiaWarsApp/1.0"
            onShouldStartLoadWithRequest={onShouldStart}
            onNavigationStateChange={onNavChange}
            onLoadEnd={() => setLoading(false)}
            onError={(e: WebViewErrorEvent) => setFailed(e.nativeEvent.description || 'Network error')}
            onHttpError={(e: WebViewHttpErrorEvent) => {
              if (e.nativeEvent.statusCode >= 500 && isGameUrl(e.nativeEvent.url)) {
                setFailed(`Server error ${e.nativeEvent.statusCode}`);
              }
            }}
            // Android may kill the WebView renderer in the background; recover instead of a blank screen.
            onRenderProcessGone={() => retry()}
            onContentProcessDidTerminate={() => webRef.current?.reload()}
          />
        )}

        {loading && !failed ? (
          <View style={styles.loader} pointerEvents="none">
            <Text style={styles.brand}>MAFIA WARS</Text>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  web: { flex: 1, backgroundColor: BG },
  loader: {
    ...StyleSheet.absoluteFill,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  brand: { color: '#fbbf24', fontSize: 32, fontWeight: '800', letterSpacing: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  body: { color: '#9ca3af', fontSize: 15, textAlign: 'center' },
  button: {
    marginTop: 12,
    backgroundColor: ACCENT,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 180,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  debug: { marginTop: 16, color: '#6b7280', fontSize: 12, textAlign: 'center' },
});
