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

test('FocusLens Official Brand Logo Test Suite', async (t) => {
  const logoPath = path.resolve(__dirname, '../../src/components/FocusLensLogo.jsx');
  const navbarPath = path.resolve(__dirname, '../../src/components/Navbar.jsx');
  const landingNavPath = path.resolve(__dirname, '../../src/components/LandingNavbar.jsx');
  const sidebarPath = path.resolve(__dirname, '../../src/components/Sidebar.jsx');
  const loginPath = path.resolve(__dirname, '../../src/pages/LoginPage.jsx');
  const registerPath = path.resolve(__dirname, '../../src/pages/RegisterPage.jsx');
  const resetPassPath = path.resolve(__dirname, '../../src/pages/ResetPasswordPage.jsx');
  const footerPath = path.resolve(__dirname, '../../src/components/Footer.jsx');
  const fullLogoAsset = path.resolve(__dirname, '../../public/branding/focuslens-logo.png');
  const iconAsset = path.resolve(__dirname, '../../public/branding/focuslens-icon.png');
  const faviconPath = path.resolve(__dirname, '../../public/favicon.png');
  const indexHtmlPath = path.resolve(__dirname, '../../index.html');

  const logoCode = fs.readFileSync(logoPath, 'utf8');

  await t.test('1. FocusLensLogo.jsx component exports and variant support', () => {
    assert.ok(fs.existsSync(logoPath), 'FocusLensLogo.jsx must exist');
    assert.ok(logoCode.includes('export function FocusLensLogo'), 'Must export FocusLensLogo function component');
    assert.ok(logoCode.includes('export default FocusLensLogo'), 'Must have default export');
    assert.ok(logoCode.includes("variant === 'icon'"), 'Must support icon variant');
    assert.ok(logoCode.includes("variant === 'compact'"), 'Must support compact variant');
    assert.ok(logoCode.includes("variant = 'horizontal'"), 'Must default to horizontal variant');
  });

  await t.test('2. Official Brand Logo Asset Integrity & Component Implementation', () => {
    // Brand assets must exist and have content
    assert.ok(fs.existsSync(fullLogoAsset), 'public/branding/focuslens-logo.png must exist');
    assert.ok(fs.statSync(fullLogoAsset).size > 1000, 'focuslens-logo.png must have valid file size');

    assert.ok(fs.existsSync(iconAsset), 'public/branding/focuslens-icon.png must exist');
    assert.ok(fs.statSync(iconAsset).size > 1000, 'focuslens-icon.png must have valid file size');

    // Component must reference official assets
    assert.ok(logoCode.includes('/branding/focuslens-logo.png'), 'Must render official full logo asset');
    assert.ok(logoCode.includes('/branding/focuslens-icon.png'), 'Must render official icon asset');

    // Proportional integrity: aspect ratios preserved to prevent stretching
    assert.ok(logoCode.includes('411 / 105'), 'Must enforce 411/105 aspect ratio on horizontal logo');
    assert.ok(logoCode.includes('1 / 1'), 'Must enforce 1/1 square aspect ratio on icon');

    // Size classes for responsive layout
    assert.ok(logoCode.includes('h-6') && logoCode.includes('h-8') && logoCode.includes('h-10') && logoCode.includes('h-12'), 'Must support sm, md, lg, xl sizes');

    // Accessibility attributes
    assert.ok(logoCode.includes('isDecorative'), 'Must support isDecorative prop');
    assert.ok(logoCode.includes('aria-label') || logoCode.includes('ariaLabel'), 'Must support aria-label');
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

    // ResetPasswordPage
    const resetCode = fs.readFileSync(resetPassPath, 'utf8');
    assert.ok(resetCode.includes('FocusLensLogo'), 'ResetPasswordPage must import and use FocusLensLogo');

    // Footer
    const footerCode = fs.readFileSync(footerPath, 'utf8');
    assert.ok(footerCode.includes('FocusLensLogo'), 'Footer must import and use FocusLensLogo');
  });

  await t.test('4. Favicon exists and is referenced in index.html', () => {
    assert.ok(fs.existsSync(faviconPath), 'public/favicon.png must exist');
    assert.ok(fs.statSync(faviconPath).size > 100, 'public/favicon.png must be non-empty');

    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    assert.ok(indexHtml.includes('href="/favicon.png"'), 'index.html must reference /favicon.png');
    assert.ok(indexHtml.includes('href="/branding/focuslens-icon.png"'), 'index.html must reference official icon asset');
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

    const filesToCheck = [logoPath, navbarPath, landingNavPath, sidebarPath, loginPath, registerPath, resetPassPath, footerPath];

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
