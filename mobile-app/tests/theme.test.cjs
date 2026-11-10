const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}, globals = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/theme', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, ...globals, require: name => {
    assert.ok(name in mocks, `Unexpected import: ${name}`);
    return mocks[name];
  } };
  vm.runInNewContext(compiled, context);
  return context.exports;
}

function storage(platform, secure = {}, web) {
  return load('themePreference.ts', { 'react-native': { Platform: { OS: platform } }, 'expo-secure-store': secure }, { localStorage: web });
}

test('web saves and restores the explicit choice without changing other stored data', async () => {
  const values = new Map([['other-setting', 'keep']]);
  const service = storage('web', {}, { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
  assert.equal(await service.readThemePreference(), null);
  await service.saveThemePreference('dark');
  assert.equal(await service.readThemePreference(), 'dark');
  await service.saveThemePreference('light');
  assert.equal(service.readWebThemePreference(), 'light');
  assert.equal(values.get('other-setting'), 'keep');
});

test('native saves and restores the theme with native storage', async () => {
  let stored = 'dark';
  const service = storage('android', {
    getItemAsync: async key => { assert.equal(key, 'bloodlink.color-scheme'); return stored; },
    setItemAsync: async (key, value) => { assert.equal(key, 'bloodlink.color-scheme'); stored = value; },
  }, { getItem: () => assert.fail('Native must not read browser storage') });
  assert.equal(await service.readThemePreference(), 'dark');
  await service.saveThemePreference('light');
  assert.equal(await service.readThemePreference(), 'light');
});

test('invalid or unavailable storage falls back safely and does not break switching', async () => {
  const web = storage('web', {}, { getItem: () => 'invalid', setItem: () => { throw new Error('Storage blocked'); } });
  assert.equal(await web.readThemePreference(), null);
  await assert.doesNotReject(web.saveThemePreference('dark'));
  const native = storage('ios', { getItemAsync: async () => { throw new Error('Unavailable'); }, setItemAsync: async () => { throw new Error('Unavailable'); } });
  assert.equal(await native.readThemePreference(), null);
  await assert.doesNotReject(native.saveThemePreference('light'));
});

function luminance(color) {
  const rgb = color.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) { const values = [luminance(a), luminance(b)].sort((a, b) => b - a); return (values[0] + 0.05) / (values[1] + 0.05); }
for (const mode of ['light', 'dark']) test(`${mode} theme has readable body, metadata, actions, and status text`, () => {
  const palette = load('palette.ts')[mode + 'Colors'];
  const pairs = [['text', 'card'], ['text', 'background'], ['textSecondary', 'card'], ['textMuted', 'card'], ['textMuted', 'background'], ['primary', 'primarySoft'], ['onPrimary', 'action'], ['onPrimary', 'successFill'], ['success', 'successSoft'], ['warning', 'warningSoft'], ['info', 'infoSoft'], ['danger', 'dangerSoft']];
  for (const [text, background] of pairs) assert.ok(contrast(palette[text], palette[background]) >= 4.5, `${text} on ${background} must reach 4.5:1`);
});
