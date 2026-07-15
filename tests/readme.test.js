// Tests for the README.md changes introduced in this PR: the new
// "Project paper" section that links to LITEPAPER.md.
//
// Uses Node's built-in test runner (`node:test`), matching
// tests/litepaper.test.js, since the repository has no other test
// framework configured.
//
// Run with: node --test tests/readme.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const README_PATH = path.join(REPO_ROOT, 'README.md');

function readReadme() {
  return fs.readFileSync(README_PATH, 'utf8');
}

test('README.md exists and is readable', () => {
  assert.equal(fs.existsSync(README_PATH), true);
  const content = readReadme();
  assert.ok(content.length > 0);
});

test('README.md contains a "Project paper" section', () => {
  const content = readReadme();
  const headings = content
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice('## '.length).trim());

  assert.ok(headings.includes('Project paper'));
});

test('README.md links to LITEPAPER.md using a relative markdown link', () => {
  const content = readReadme();
  assert.match(content, /\[LITEPAPER\.md\]\(\.\/LITEPAPER\.md\)/);
});

test('the "Project paper" section appears before the "Run Locally" section', () => {
  const content = readReadme();
  const projectPaperIndex = content.indexOf('## Project paper');
  const runLocallyIndex = content.indexOf('## Run Locally');

  assert.notEqual(projectPaperIndex, -1, '"Project paper" heading not found');
  assert.notEqual(runLocallyIndex, -1, '"Run Locally" heading not found');
  assert.ok(
    projectPaperIndex < runLocallyIndex,
    'expected "Project paper" section to precede "Run Locally" section',
  );
});

test('the LITEPAPER.md link target resolves to an existing file on disk', () => {
  const content = readReadme();
  const match = content.match(/\[LITEPAPER\.md\]\(([^)]+)\)/);

  assert.ok(match, 'expected to find a markdown link to LITEPAPER.md');

  const linkTarget = match[1];
  const resolvedPath = path.join(REPO_ROOT, linkTarget);

  assert.equal(
    fs.existsSync(resolvedPath),
    true,
    `linked file "${linkTarget}" does not exist at ${resolvedPath}`,
  );
});

test('README.md still describes the "Run Locally" setup steps unchanged by this PR', () => {
  const content = readReadme();
  assert.match(content, /## Run Locally/);
  assert.match(content, /npm install/);
  assert.match(content, /GEMINI_API_KEY/);
  assert.match(content, /npm run dev/);
<<<<<<< HEAD
});
=======
});
>>>>>>> origin/main
