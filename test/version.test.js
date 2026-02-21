import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/lib/version.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('version consistency', () => {
  it('VERSION should match package.json version', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    expect(VERSION).toBe(pkg.version);
  });
});
