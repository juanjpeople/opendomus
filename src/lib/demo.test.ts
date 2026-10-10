import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

for (const house of ['demo', 'tests']) {
  test(`${house}: bloquea API y vínculo cloud aunque la casa habitual tenga sesión`, () => {
    const script = `
      import assert from 'node:assert/strict';
      const storage = new Map();
      globalThis.window = { location: { search: '?house=${house}' }, addEventListener() {} };
      globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,value) };
      Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => JSON.stringify({ householdId:'real', userId:'real', deviceId:'real' }) } });
      let requests=0; globalThis.fetch = () => { requests++; throw new Error('Unexpected network'); };
      const mode = await import('@/lib/demo');
      const { api, apiBytes, CLOUD_ENABLED } = await import('@/lib/cloud/api');
      const { getSyncLink, setSyncLink } = await import('@/lib/sync/middleware');
      assert.equal(mode.SAMPLE_HOUSE, '${house}');
      assert.notEqual(mode.HOUSE_DB, 'RefugiarDB');
      assert.notEqual(mode.houseStorageKey('refugiar-session'), 'refugiar-session');
      assert.equal(CLOUD_ENABLED, false);
      setSyncLink({householdId:'other',userId:'other',deviceId:'other'});
      assert.equal(getSyncLink(), null);
      await assert.rejects(api('POST','/households',{}));
      await assert.rejects(apiBytes('PUT','/photos',new Uint8Array()));
      assert.equal(requests,0);
    `;
    const result=spawnSync(process.execPath,['--import','./scripts/test-hooks.mjs','--input-type=module','-e',script],{encoding:'utf8',env:{...process.env,NEXT_PUBLIC_CLOUD:'1',NEXT_PUBLIC_DEMO:'0'}});
    assert.equal(result.status,0,result.stderr);
  });
}
