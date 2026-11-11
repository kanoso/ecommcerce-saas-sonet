import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { InvalidProofKeyError, ProofNotFoundError } from '../../domain';
import { LocalProofStorage } from './local-proof-storage';

describe('LocalProofStorage', () => {
  const content = Buffer.from('proof bytes');
  let sandbox: string;
  let root: string;
  let storage: LocalProofStorage;

  beforeEach(() => {
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'proof-storage-'));
    root = path.join(sandbox, 'proofs');
    storage = new LocalProofStorage(root);
  });

  afterEach(() => {
    fs.rmSync(sandbox, { recursive: true, force: true });
  });

  it('creates the directory and round-trips a file with its type', async () => {
    const key = await storage.save(content, 'image/png');

    await expect(storage.read(key)).resolves.toEqual({
      content,
      contentType: 'image/png',
    });
  });

  it('names files itself, with a uuid and the extension of the type', async () => {
    const key = await storage.save(content, 'application/pdf');

    expect(key).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(fs.readdirSync(root)).toEqual([key]);
  });

  it('gives each file its own name', async () => {
    const first = await storage.save(content, 'image/png');
    const second = await storage.save(content, 'image/png');

    expect(first).not.toBe(second);
  });

  it('deletes a file and tolerates deleting it again', async () => {
    const key = await storage.save(content, 'image/png');

    await storage.delete(key);
    await storage.delete(key);

    expect(fs.readdirSync(root)).toEqual([]);
  });

  it('reports a missing file', async () => {
    await expect(
      storage.read('00000000-0000-4000-8000-000000000000.png'),
    ).rejects.toThrow(ProofNotFoundError);
  });

  it.each([
    '../secret.png',
    '..\\secret.png',
    '/etc/passwd',
    'C:\\Windows\\win.ini',
    '00000000-0000-4000-8000-000000000000.png/../../secret.png',
    '00000000-0000-4000-8000-000000000000.exe',
    '.',
    '',
  ])('refuses the key %j on read and delete', async (key) => {
    const outside = path.join(sandbox, 'secret.png');
    fs.writeFileSync(outside, 'secret');
    fs.mkdirSync(root, { recursive: true });

    await expect(storage.read(key)).rejects.toThrow(InvalidProofKeyError);
    await expect(storage.delete(key)).rejects.toThrow(InvalidProofKeyError);

    expect(fs.existsSync(outside)).toBe(true);
  });

  it('requires a directory', () => {
    expect(() => new LocalProofStorage(' ')).toThrow();
  });
});
