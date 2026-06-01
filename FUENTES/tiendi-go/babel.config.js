module.exports = function (api) {
  // api.env() must be the cache key when we branch on environment
  const isTest = api.env('test');
  api.cache.using(() => isTest);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', { alias: { '@': './src' } }],
      // react-native-reanimated/plugin requires native worklets — skip in Jest
      ...(isTest ? [] : ['react-native-reanimated/plugin']),
    ],
  };
};
