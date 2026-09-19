import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Icon Imports & Undefined Identifiers Regression Suite', async (t) => {
  const sessionReportPath = path.resolve(__dirname, '../../src/pages/SessionReportPage.jsx');
  const calendarPagePath = path.resolve(__dirname, '../../src/pages/CalendarPage.jsx');

  await t.test('1. SessionReportPage.jsx explicitly imports BookMarked and Check from lucide-react', () => {
    const code = fs.readFileSync(sessionReportPath, 'utf8');
    assert.ok(code.includes('BookMarked,'), 'SessionReportPage must import BookMarked from lucide-react');
    assert.ok(code.includes('Check,'), 'SessionReportPage must import Check from lucide-react');
    assert.ok(code.includes("from 'lucide-react'"), 'Must import from lucide-react');
  });

  await t.test('2. CalendarPage.jsx explicitly imports BookMarked from lucide-react', () => {
    const code = fs.readFileSync(calendarPagePath, 'utf8');
    assert.ok(code.includes('BookMarked,'), 'CalendarPage must import BookMarked from lucide-react');
    assert.ok(code.includes("from 'lucide-react'"), 'Must import from lucide-react');
  });

  await t.test('3. SessionReportPage.jsx has 0 unresolved identifiers (AST scope analysis)', () => {
    const code = fs.readFileSync(sessionReportPath, 'utf8');
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx'],
    });

    const standardGlobals = new Set([
      'window', 'document', 'console', 'Math', 'Date', 'setTimeout', 'clearTimeout',
      'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
      'fetch', 'Promise', 'Set', 'Map', 'WeakMap', 'WeakSet', 'Array', 'Object',
      'String', 'Number', 'Boolean', 'RegExp', 'Error', 'TypeError', 'RangeError',
      'JSON', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'FormData',
      'performance', 'navigator', 'localStorage', 'sessionStorage', 'alert', 'confirm',
      'location', 'history', 'customElements', 'AbortController', 'IntersectionObserver',
      'ResizeObserver', 'MutationObserver', 'HTMLElement', 'Element', 'Node', 'Event',
      'CustomEvent', 'Audio', 'Image', 'process', 'global', 'globalThis', 'Infinity',
      'NaN', 'undefined', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI',
      'encodeURIComponent', 'decodeURI', 'decodeURIComponent', 'btoa', 'atob',
      'crypto', 'Intl'
    ]);

    const undeclared = [];
    traverse(ast, {
      Program(programPath) {
        programPath.traverse({
          ReferencedIdentifier(identPath) {
            const name = identPath.node.name;
            if (standardGlobals.has(name)) return;
            if (!identPath.scope.hasBinding(name)) {
              undeclared.push({ name, line: identPath.node.loc?.start.line });
            }
          }
        });
      }
    });

    assert.equal(undeclared.length, 0, `Expected 0 undeclared identifiers in SessionReportPage, but found: ${JSON.stringify(undeclared)}`);
  });

  await t.test('4. CalendarPage.jsx has 0 unresolved identifiers (AST scope analysis)', () => {
    const code = fs.readFileSync(calendarPagePath, 'utf8');
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx'],
    });

    const standardGlobals = new Set([
      'window', 'document', 'console', 'Math', 'Date', 'setTimeout', 'clearTimeout',
      'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
      'fetch', 'Promise', 'Set', 'Map', 'WeakMap', 'WeakSet', 'Array', 'Object',
      'String', 'Number', 'Boolean', 'RegExp', 'Error', 'TypeError', 'RangeError',
      'JSON', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'FormData',
      'performance', 'navigator', 'localStorage', 'sessionStorage', 'alert', 'confirm',
      'location', 'history', 'customElements', 'AbortController', 'IntersectionObserver',
      'ResizeObserver', 'MutationObserver', 'HTMLElement', 'Element', 'Node', 'Event',
      'CustomEvent', 'Audio', 'Image', 'process', 'global', 'globalThis', 'Infinity',
      'NaN', 'undefined', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI',
      'encodeURIComponent', 'decodeURI', 'decodeURIComponent', 'btoa', 'atob',
      'crypto', 'Intl'
    ]);

    const undeclared = [];
    traverse(ast, {
      Program(programPath) {
        programPath.traverse({
          ReferencedIdentifier(identPath) {
            const name = identPath.node.name;
            if (standardGlobals.has(name)) return;
            if (!identPath.scope.hasBinding(name)) {
              undeclared.push({ name, line: identPath.node.loc?.start.line });
            }
          }
        });
      }
    });

    assert.equal(undeclared.length, 0, `Expected 0 undeclared identifiers in CalendarPage, but found: ${JSON.stringify(undeclared)}`);
  });
});
