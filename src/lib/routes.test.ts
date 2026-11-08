import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { accountsHref, profileHref } from './routes.ts';

test('profile and accounts are stack routes, not hidden tabs', () => {
  assert.equal(profileHref, '/profile');
  assert.equal(accountsHref, '/accounts');
  const tabs = readFileSync(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../app/(tabs)/home.tsx', import.meta.url), 'utf8');
  const profile = readFileSync(new URL('../app/profile.tsx', import.meta.url), 'utf8');
  assert.equal(/href:\s*null/.test(tabs), false);
  assert.equal(tabs.includes("name: 'profile'"), false);
  assert.equal(tabs.includes("name: 'accounts'"), false);
  assert.match(home, /profileHref/);
  assert.match(profile, /accountsHref/);
});
