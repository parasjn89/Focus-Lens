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

test('FocusLens Official Brand Logo (F + Lens) Test Suite', async (t) => {
  const logoPath = path.resolve(__dirname, '../../src/components/FocusLensLogo.jsx');
  const navbarPath = path.resolve(__dirname, '../../src/components/Navbar.jsx');
  const landingNavPath = path.resolve(__dirname, '../../src/components/LandingNavbar.jsx');
  const sidebarPath = path.resolve(__dirname, '../../src/components/Sidebar.jsx');
  const loginPath = path.resolve(__dirname, '../../src/pages/LoginPage.jsx');
  const registerPath = path.resolve(__dirname, '../../src/pages/RegisterPage.jsx');
  const footerPath = path.resolve(__dirname, '../../src/components/Footer.jsx');
  const faviconPath = path.resolve(__dirname, '../../public/favicon.svg');
  const indexHtmlPath = path.resolve(__dirname, '../../index.html');

  const logoCode = fs.readFileSync(logoPath, 'utf8');

  await t.test('1. FocusLensLogo.jsx component exports and variant support', () => {
    assert.ok(fs.existsSync(logoPath), 'FocusLensLogo.jsx must exist');
    assert.ok(logoCode.includes('export function FocusLensLogo'), 'Must export FocusLensLogo function component');
    assert.ok(logoCode.includes('export default FocusLensLogo'), 'Must have default export');
    assert.ok(logoCode.includes("variant === 'icon'"), 'Must support icon variant');
    assert.ok(logoCode.includes("variant === 'compact'"), 'Must support compact variant');
    assert.ok(logoCode.includes('variant = \'horizontal\''), 'Must default to horizontal variant');
  });

  await t.test('2. F + Lens Geometric Construction in Logo SVG', () => {
    // Lens geometry
    assert.ok(logoCode.includes('<circle'), 'Must contain circular lens elements');
    assert.ok(logoCode.includes('strokeDasharray="112 14"'), 'Must contain calibrated aperture ring');
    assert.ok(logoCode.includes('r="21.5"'), 'Must contain outer lens barrel');
    assert.ok(logoCode.includes('r="2.25"') && logoCode.includes('cx="34"'), 'Must contain central focal core');

    // F Letter geometry
    assert.ok(logoCode.includes('x="11.5"') && logoCode.includes('width="6"'), 'Must contain F vertical spine');
    assert.ok(logoCode.includes('H34.5') && logoCode.includes('V14'), 'Must contain F top horizontal arm');
    assert.ok(logoCode.includes('H28.5') && logoCode.includes('V24.5'), 'Must contain F middle crossbar');
    assert.ok(logoCode.includes('M 21.5 37 A 15 15'), 'Must contain lower-right optic symmetry arc');

    // Color gradient
    assert.ok(logoCode.includes('#22D3EE') || logoCode.includes('#00F2FE'), 'Must use electric cyan primary color');
    assert.ok(logoCode.includes('#3B82F6'), 'Must use vibrant blue secondary color');

    // Wordmark styling: Focus in white, Lens in cyan
    assert.ok(logoCode.includes('>Focus</span>'), 'Must contain white Focus portion');
    assert.ok(logoCode.includes('text-cyan-400') && logoCode.includes('>Lens</span>'), 'Must contain cyan Lens portion');
  });

  await t.test('3. Brand logo replaced across all official application touchpoints', () => {
    // Navbar
    const navCode = fs.readFileSync(navbarPath, 'utf8');
    assert.ok(navCode.includes('FocusLensLogo'), 'Navbar must import and use FocusLensLogo');
    assert.ok(!navCode.includes('<Eye className="w-6 h-6 text-white" />'), 'Navbar must not use generic Eye icon');

    // LandingNavbar
    const landNavCode = fs.readFileSync(landingNavPath, 'utf8');
    assert.ok(landNavCode.includes('FocusLensLogo'), 'LandingNavbar must import and use FocusLensLogo');
    assert.ok(!landNavCode.includes('<Eye className="w-5 h-5 text-brand-navy" />'), 'LandingNavbar must not use generic Eye icon');

    // Sidebar
    const sideCode = fs.readFileSync(sidebarPath, 'utf8');
    assert.ok(sideCode.includes('FocusLensLogo'), 'Sidebar must import and use FocusLensLogo');
    assert.ok(!sideCode.includes('<Eye className="w-5 h-5 text-white" />'), 'Sidebar must not use generic Eye icon');

    // LoginPage
    const loginCode = fs.readFileSync(loginPath, 'utf8');
    assert.ok(loginCode.includes('FocusLensLogo'), 'LoginPage must import and use FocusLensLogo');
    assert.ok(!loginCode.includes('<Eye className="w-7 h-7 text-white" />'), 'LoginPage must not use generic Eye icon as logo');

    // RegisterPage
    const regCode = fs.readFileSync(registerPath, 'utf8');
    assert.ok(regCode.includes('FocusLensLogo'), 'RegisterPage must import and use FocusLensLogo');
    assert.ok(!regCode.includes('<Eye className="w-7 h-7 text-white" />'), 'RegisterPage must not use generic Eye icon as logo');

    // Footer
    const footerCode = fs.readFileSync(footerPath, 'utf8');
    assert.ok(footerCode.includes('FocusLensLogo'), 'Footer must import and use FocusLensLogo');
  });

  await t.test('4. Favicon SVG exists and is referenced in index.html', () => {
    assert.ok(fs.existsSync(faviconPath), 'public/favicon.svg must exist');
    const favCode = fs.readFileSync(faviconPath, 'utf8');
    assert.ok(favCode.includes('<svg') && favCode.includes('viewBox="0 0 48 48"'), 'Favicon must be valid vector SVG');
    assert.ok(favCode.includes('#22D3EE'), 'Favicon must include brand cyan gradient');

    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    assert.ok(indexHtml.includes('href="/favicon.svg"'), 'index.html must reference /favicon.svg');
    assert.ok(!indexHtml.includes('eye icon.jpeg'), 'index.html must not reference old eye icon');
  });

  await t.test('5. AST Scope Analysis: 0 undeclared identifiers across all updated files', () => {
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

    const filesToCheck = [logoPath, navbarPath, landingNavPath, sidebarPath, loginPath, registerPath, footerPath];

    for (const f of filesToCheck) {
      const code = fs.readFileSync(f, 'utf8');
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
      assert.equal(undeclared.length, 0, `File ${path.basename(f)} must have 0 undeclared identifiers, found: ${JSON.stringify(undeclared)}`);
    }
  });
});
