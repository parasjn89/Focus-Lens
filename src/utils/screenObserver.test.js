import { createScreenObservation, getSourceTypeFromTrack, SCREEN_SOURCE_TYPES } from '../services/screenObserver.js';

export function runScreenObserverTests() {
  const results = [];

  const assert = (condition, testName) => {
    if (condition) {
      results.push({ name: testName, status: 'PASSED' });
    } else {
      results.push({ name: testName, status: 'FAILED' });
      throw new Error(`Test Failed: ${testName}`);
    }
  };

  // Test 1: Active monitor display surface maps to 'screen'
  {
    const mockTrack = { getSettings: () => ({ displaySurface: 'monitor' }) };
    const obs = createScreenObservation(true, mockTrack, 1000);
    assert(obs.type === 'SCREEN_OBSERVATION', 'Observation has SCREEN_OBSERVATION type');
    assert(obs.screenActive === true, 'screenActive is true');
    assert(obs.sourceType === SCREEN_SOURCE_TYPES.SCREEN, 'Maps monitor to screen');
  }

  // Test 2: Active window display surface maps to 'window'
  {
    const mockTrack = { getSettings: () => ({ displaySurface: 'window' }) };
    const obs = createScreenObservation(true, mockTrack, 2000);
    assert(obs.sourceType === SCREEN_SOURCE_TYPES.WINDOW, 'Maps window to window');
  }

  // Test 3: Active browser display surface maps to 'browser-tab'
  {
    const mockTrack = { getSettings: () => ({ displaySurface: 'browser' }) };
    const obs = createScreenObservation(true, mockTrack, 3000);
    assert(obs.sourceType === SCREEN_SOURCE_TYPES.BROWSER_TAB, 'Maps browser to browser-tab');
  }

  // Test 4: Inactive screen returns screenActive: false and unknown sourceType
  {
    const obs = createScreenObservation(false, null, 4000);
    assert(obs.screenActive === false, 'Inactive screen sets screenActive: false');
    assert(obs.sourceType === SCREEN_SOURCE_TYPES.UNKNOWN, 'Inactive screen sets sourceType: unknown');
  }

  return results;
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('screenObserver.test.js')) {
  console.log('Running Screen Observer Unit Tests...');
  const testResults = runScreenObserverTests();
  console.log('Test Results:', testResults);
}
