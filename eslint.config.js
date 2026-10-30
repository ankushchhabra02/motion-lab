// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'scripts/*'],
  },
  {
    rules: {
      // Reanimated shared values are mutated by design (`sv.value = ...` inside
      // worklets and handlers). The React Compiler immutability rule reads those
      // writes as prop/hook mutations, so it is disabled for this project.
      'react-hooks/immutability': 'off',
    },
  },
]);
