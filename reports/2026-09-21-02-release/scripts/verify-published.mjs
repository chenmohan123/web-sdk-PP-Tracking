import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const out = '.tmp/tracking-02-release/registry';
await mkdir(out, { recursive: true });
async function get(url) {
  const response = await fetch(url);
  assert(response.ok, `${response.status} ${url}`);
  return response;
}
const metadata = await (await get('https://registry.npmjs.org/web-sdk-pp-tracking')).json();
const version = metadata.versions['0.2.0-rc.0'];
assert(version, 'RC 尚未出现在 registry');
assert.equal(metadata['dist-tags'].next, '0.2.0-rc.0');
assert.equal(metadata['dist-tags'].latest, '0.1.0');
const expected = JSON.parse(await readFile('.tmp/tracking-02-release/package-check.json', 'utf8'));
assert.equal(version.dist.integrity, expected.integrity, '公开版本与最终候选完整性不一致');
const bytes = Buffer.from(await (await get(version.dist.tarball)).arrayBuffer());
assert.equal(bytes.length, expected.size);
assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256);
assert.equal(`sha512-${createHash('sha512').update(bytes).digest('base64')}`, expected.integrity);
await writeFile(`${out}/published.tgz`, bytes);
await writeFile(`${out}/version.json`, JSON.stringify({ observedAt: new Date().toISOString(),
  distTags: metadata['dist-tags'], version }, null, 2));
assert(version.dist.attestations?.url, '本次 OIDC 发布缺少 provenance attestation');
const attestations = await (await get(version.dist.attestations.url)).json();
await writeFile(`${out}/attestations.json`, JSON.stringify(attestations, null, 2));
console.log(JSON.stringify({ status: '公开包字节、双通道与attestation元数据通过', version: version.version,
  distTags: metadata['dist-tags'], bytes: bytes.length, sha256: expected.sha256,
  attestations: version.dist.attestations }, null, 2));
