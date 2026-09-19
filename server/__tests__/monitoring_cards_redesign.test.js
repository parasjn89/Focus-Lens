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

test('Premium Glass Cards UI Redesign - Monitoring Cards Test Suite', async (t) => {
  const cameraPath = path.resolve(__dirname, '../../src/components/CameraMonitoringCard.jsx');
  const screenPath = path.resolve(__dirname, '../../src/components/ScreenMonitorCard.jsx');
  const aiPath = path.resolve(__dirname, '../../src/components/AIMonitoringCard.jsx');

  const cameraCode = fs.readFileSync(cameraPath, 'utf8');
  const screenCode = fs.readFileSync(screenPath, 'utf8');
  const aiCode = fs.readFileSync(aiPath, 'utf8');

  await t.test('1. CameraMonitoringCard matches Premium Glass Cards specifications', () => {
    // Header & Subtitle
    assert.ok(cameraCode.includes('Camera Monitoring'), 'Must contain Camera Monitoring title');
    assert.ok(cameraCode.includes('On-Device Signal Observation'), 'Must contain On-Device Signal Observation subtitle');
    assert.ok(cameraCode.includes('Camera Active'), 'Must contain Camera Active status badge text');
    
    // Video preview and LIVE indicator
    assert.ok(cameraCode.includes('LIVE'), 'Must contain LIVE indicator');
    assert.ok(cameraCode.includes('autoPlay') && cameraCode.includes('playsInline') && cameraCode.includes('muted'), 'Must retain camera video stream attributes');
    assert.ok(cameraCode.includes('-scale-x-100'), 'Must retain mirrored camera preview');
    
    // Primary action
    assert.ok(cameraCode.includes('Disable Camera'), 'Must retain Disable Camera button action');
    
    // Privacy claim
    assert.ok(
      cameraCode.includes('Your camera stream currently stays in your browser and is not uploaded.'),
      'Must preserve exact privacy message'
    );
  });

  await t.test('2. ScreenMonitorCard matches Premium Glass Cards specifications', () => {
    // Header & Subtitle
    assert.ok(screenCode.includes('Screen Monitoring'), 'Must contain Screen Monitoring title');
    assert.ok(screenCode.includes('User-Approved Context'), 'Must contain User-Approved Context subtitle');
    assert.ok(screenCode.includes('Active'), 'Must contain Active status badge text');

    // Video preview and source indicator
    assert.ok(screenCode.includes('getSourceTypeLabel()'), 'Must retain dynamic source type label');
    assert.ok(screenCode.includes('autoPlay') && screenCode.includes('playsInline') && screenCode.includes('muted'), 'Must retain screen video stream attributes');

    // Primary action
    assert.ok(screenCode.includes('Stop Screen Monitoring'), 'Must retain Stop Screen Monitoring button action');

    // Privacy claim
    assert.ok(
      screenCode.includes('Only the screen you explicitly choose to share is available to FocusLens.'),
      'Must preserve explicit screen sharing privacy message'
    );
    assert.ok(
      screenCode.includes('Screen data is currently processed locally and is not uploaded.'),
      'Must preserve local processing privacy message'
    );
  });

  await t.test('3. AIMonitoringCard matches Premium Glass Cards specifications with 6 horizontal rows', () => {
    // Header & Subtitle
    assert.ok(aiCode.includes('AI Monitoring'), 'Must contain AI Monitoring title');
    assert.ok(aiCode.includes('Local Browser Vision Models'), 'Must contain Local Browser Vision Models subtitle');
    assert.ok(aiCode.includes('MediaPipe'), 'Must retain MediaPipe badge');

    // 6 Status rows
    assert.ok(aiCode.includes('>Camera</span>'), 'Must contain Camera status row');
    assert.ok(aiCode.includes('>Screen Activity</span>'), 'Must contain Screen Activity status row');
    assert.ok(aiCode.includes('>Face</span>'), 'Must contain Face status row');
    assert.ok(aiCode.includes('>Head orientation</span>'), 'Must contain Head orientation status row');
    assert.ok(aiCode.includes('>Phone</span>'), 'Must contain Phone status row');
    assert.ok(aiCode.includes('>People</span>'), 'Must contain People status row');

    // Semantic icons
    assert.ok(aiCode.includes('<Camera'), 'Must use Camera icon');
    assert.ok(aiCode.includes('<Monitor'), 'Must use Monitor icon');
    assert.ok(aiCode.includes('<UserCheck'), 'Must use UserCheck icon');
    assert.ok(aiCode.includes('<Compass'), 'Must use Compass icon');
    assert.ok(aiCode.includes('<Smartphone'), 'Must use Smartphone icon');
    assert.ok(aiCode.includes('<Users'), 'Must use Users icon');

    // Dynamic formatting functions preserved
    assert.ok(aiCode.includes('getPersonDisplayText()'), 'Must preserve dynamic person display text logic');
    assert.ok(aiCode.includes('getHeadOrientationText()'), 'Must preserve dynamic head orientation display logic');
    assert.ok(aiCode.includes('SCREEN_ACTIVITY_LABELS[screenActivity]'), 'Must preserve dynamic screen activity labels');
  });

  await t.test('4. AST Analysis: All three cards have 0 undeclared identifiers', () => {
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

    for (const file of [cameraPath, screenPath, aiPath]) {
      const code = fs.readFileSync(file, 'utf8');
      const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
      const undeclared = [];
      traverse(ast, {
        Program(p) {
          p.traverse({
            ReferencedIdentifier(i) {
              const name = i.node.name;
              if (standardGlobals.has(name)) return;
              if (!i.scope.hasBinding(name)) {
                undeclared.push({ name, line: i.node.loc?.start.line });
              }
            }
          });
        }
      });
      assert.equal(undeclared.length, 0, `File ${path.basename(file)} must have 0 undeclared identifiers, found: ${JSON.stringify(undeclared)}`);
    }
  });
});
