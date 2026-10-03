module.exports = {
  preset: 'jest-expo',
  // @turf/turf es ESM-only: debe pasar por babel igual que los paquetes de Expo.
  // Se conserva el allowlist del preset y se agregan los paquetes turf.
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@turf|turf|@babel|rbush|quickselect|earcut|tinyqueue|robust-predicates))',
    'node_modules/react-native-reanimated/plugin/',
    'node_modules/@react-native/babel-preset/',
  ],
};
