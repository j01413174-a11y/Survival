// Tests for LITEPAPER.md, added in this PR.
//
// This repository has no existing test framework configured, so these tests
// use Node's built-in test runner (`node:test`) which ships with Node.js and
// requires no additional dependencies.
//
// Run with: node --test tests/litepaper.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LITEPAPER_PATH = path.join(__dirname, '..', 'LITEPAPER.md');

function readLitepaper() {
  return fs.readFileSync(LITEPAPER_PATH, 'utf8');
}

function getHeadings(content, level) {
  const marker = '#'.repeat(level) + ' ';
  return content
    .split('\n')
    .filter((line) => line.startsWith(marker))
    .map((line) => line.slice(marker.length).trim());
}

test('LITEPAPER.md exists at the repository root', () => {
  assert.equal(fs.existsSync(LITEPAPER_PATH), true);
});

test('LITEPAPER.md is a non-empty, readable UTF-8 text file', () => {
  const content = readLitepaper();
  assert.equal(typeof content, 'string');
  assert.ok(content.length > 0, 'LITEPAPER.md should not be empty');
});

test('LITEPAPER.md starts with the expected top-level title', () => {
  const content = readLitepaper();
  const firstLine = content.split('\n')[0];
  assert.equal(firstLine, '# Survivalist: Celestial Upgrade Litepaper');
});

test('LITEPAPER.md has exactly one top-level (H1) heading', () => {
  const content = readLitepaper();
  const h1s = getHeadings(content, 1);
  assert.deepEqual(h1s, ['Survivalist: Celestial Upgrade Litepaper']);
});

test('LITEPAPER.md contains all expected second-level (H2) sections in order', () => {
  const content = readLitepaper();
  const expectedSections = [
    'Version',
    'Overview',
    'Problem',
    'Vision',
    'Product Summary',
    'Gameplay Loop',
    'World Design',
    'AI Layer',
    'Progression Systems',
    'Economy Design',
    'Digital Asset Layer',
    'Current State vs. Future State',
    'Token and NFT Philosophy',
    'Technical Architecture',
    'Security and Trust Model',
    'Go-To-Market Direction',
    'Why This Project Can Matter',
    'Conclusion',
  ];

  const actualSections = getHeadings(content, 2);
  assert.deepEqual(actualSections, expectedSections);
});

test('LITEPAPER.md contains the expected third-level (H3) subsections', () => {
  const content = readLitepaper();
  const actualSubsections = getHeadings(content, 3);
  assert.deepEqual(actualSubsections, [
    'Implemented in the repository today',
    'Future expansion opportunities',
  ]);
});

test('the "Current State vs. Future State" H3 subsections are nested under that H2 section', () => {
  const content = readLitepaper();
  const lines = content.split('\n');

  const sectionStart = lines.findIndex((l) => l === '## Current State vs. Future State');
  const nextH2Index = lines.findIndex(
    (l, i) => i > sectionStart && l.startsWith('## '),
  );
  assert.notEqual(sectionStart, -1, 'expected section heading not found');

  const sectionBody = lines.slice(
    sectionStart,
    nextH2Index === -1 ? lines.length : nextH2Index,
  );

  assert.ok(sectionBody.includes('### Implemented in the repository today'));
  assert.ok(sectionBody.includes('### Future expansion opportunities'));
});

test('LITEPAPER.md documents the reference smart contracts by name', () => {
  const content = readLitepaper();
  assert.ok(content.includes('SurvivalNFT'), 'should mention the SurvivalNFT contract');
  assert.ok(content.includes('SurvivalGold'), 'should mention the SurvivalGold contract');
  assert.ok(content.includes('ERC-721'), 'should mention ERC-721');
  assert.ok(content.includes('ERC-20'), 'should mention ERC-20');
});

test('LITEPAPER.md references the deterministic 10,000 item collection', () => {
  const content = readLitepaper();
  assert.ok(content.includes('10,000 deterministic procedural items'));
  assert.ok(content.includes('10,000 collectible weapons and armor pieces'));
});

test('LITEPAPER.md does not contain unresolved placeholder markers', () => {
  const content = readLitepaper();
  const placeholderPatterns = [/\bTBD\b/i, /\bTODO\b/, /lorem ipsum/i, /\bFIXME\b/];

  for (const pattern of placeholderPatterns) {
    assert.equal(
      pattern.test(content),
      false,
      `unexpected placeholder marker matching ${pattern} found in LITEPAPER.md`,
    );
  }
});

test('LITEPAPER.md has no trailing whitespace on any line', () => {
  const content = readLitepaper();
  const offendingLines = content
    .split('\n')
    .map((line, i) => ({ line, number: i + 1 }))
    .filter(({ line }) => /[ \t]+$/.test(line));

  assert.deepEqual(
    offendingLines,
    [],
    `found trailing whitespace on line(s): ${offendingLines.map((l) => l.number).join(', ')}`,
  );
});

test('LITEPAPER.md numbered lists in "Vision" are sequential starting at 1', () => {
  const content = readLitepaper();
  const lines = content.split('\n');
  const start = lines.findIndex((l) => l === '## Vision');
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  const body = lines.slice(start, end === -1 ? lines.length : end);

  const numbered = body
    .filter((l) => /^\d+\.\s/.test(l))
    .map((l) => Number.parseInt(l, 10));

  assert.deepEqual(numbered, [1, 2, 3]);
});

test('LITEPAPER.md numbered lists in "Gameplay Loop" are sequential starting at 1', () => {
  const content = readLitepaper();
  const lines = content.split('\n');
  const start = lines.findIndex((l) => l === '## Gameplay Loop');
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  const body = lines.slice(start, end === -1 ? lines.length : end);

  const numbered = body
    .filter((l) => /^\d+\.\s/.test(l))
    .map((l) => Number.parseInt(l, 10));

  assert.deepEqual(numbered, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('LITEPAPER.md numbered lists in "Go-To-Market Direction" are sequential starting at 1', () => {
  const content = readLitepaper();
  const lines = content.split('\n');
  const start = lines.findIndex((l) => l === '## Go-To-Market Direction');
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  const body = lines.slice(start, end === -1 ? lines.length : end);

  const numbered = body
    .filter((l) => /^\d+\.\s/.test(l))
    .map((l) => Number.parseInt(l, 10));

  assert.deepEqual(numbered, [1, 2, 3, 4, 5]);
});

test('LITEPAPER.md contains no unresolved markdown link syntax pointing nowhere', () => {
  const content = readLitepaper();
  const linkPattern = /\[([^\]]+)\]\(([^)]*)\)/g;
  let match;
  const emptyTargets = [];

  while ((match = linkPattern.exec(content)) !== null) {
    if (match[2].trim() === '') {
      emptyTargets.push(match[1]);
    }
  }

  assert.deepEqual(emptyTargets, [], 'found markdown link(s) with empty targets');
});