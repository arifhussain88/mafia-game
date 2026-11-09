/**
 * Dynamic layer over app.json.
 *
 * The game URL is the single switch for where the app points. Android cleartext
 * (plain HTTP) is derived from it, so an HTTPS build can never silently allow
 * unencrypted traffic, and a LAN dev URL (http://192.168.x.x:5173 via
 * EXPO_PUBLIC_GAME_URL) still works in development builds.
 */
module.exports = ({ config }) => {
  const gameUrl = (process.env.EXPO_PUBLIC_GAME_URL || config.extra?.gameUrl || "").replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(gameUrl)) {
    throw new Error(`app.config.js: game URL must start with http:// or https:// (got "${gameUrl}")`);
  }
  const usesCleartextTraffic = /^http:\/\//i.test(gameUrl);

  return {
    ...config,
    extra: { ...config.extra, gameUrl },
    plugins: [
      ...(config.plugins ?? []).filter((p) => (Array.isArray(p) ? p[0] : p) !== "expo-build-properties"),
      ["expo-build-properties", { android: { usesCleartextTraffic } }],
    ],
  };
};
