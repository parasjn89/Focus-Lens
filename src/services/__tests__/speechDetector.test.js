import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateAudioLevel, createSpeechTracker, SPEECH_STATES } from '../speechDetector.js';

describe('Speech Detector Unit Tests', () => {
  it('calculateAudioLevel returns 0.0 for flat silent time-domain buffer', () => {
    // 128 represents 0.0 amplitude in 8-bit PCM
    const silentBuffer = new Uint8Array(512).fill(128);
    const level = calculateAudioLevel(silentBuffer);
    assert.strictEqual(level, 0.0);
  });

  it('calculateAudioLevel returns high level for high amplitude waveform', () => {
    const loudBuffer = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      loudBuffer[i] = i % 2 === 0 ? 255 : 0;
    }
    const level = calculateAudioLevel(loudBuffer);
    assert.ok(level > 0.8, `Expected audio level > 0.8, got ${level}`);
  });

  it('createSpeechTracker ignores short noise spike (e.g. keyboard click for 200ms)', () => {
    let stateChanges = [];
    const tracker = createSpeechTracker({
      speechStartThreshold: 0.15,
      speechEndThreshold: 0.08,
      minimumSpeechDurationMs: 1000,
      minimumSilenceDurationMs: 1500,
      onStateChange: (evt) => stateChanges.push(evt),
    });

    const startTime = 10000;

    // 1. Initial silence
    tracker.processAudioFrame(0.02, startTime);
    assert.strictEqual(tracker.getCurrentState(), SPEECH_STATES.SILENCE);

    // 2. Short noise spike for 200ms (10000ms to 10200ms)
    tracker.processAudioFrame(0.40, startTime + 50);
    tracker.processAudioFrame(0.45, startTime + 100);
    tracker.processAudioFrame(0.40, startTime + 200);

    // 3. Audio drops back to quiet baseline at 10300ms
    tracker.processAudioFrame(0.02, startTime + 300);

    // VAD state must remain SILENCE (noise spike rejected)
    assert.strictEqual(tracker.getCurrentState(), SPEECH_STATES.SILENCE);
    assert.strictEqual(stateChanges.length, 0);
  });

  it('createSpeechTracker transitions to SPEECH_LIKE after sustained speech energy (>= 1000ms)', () => {
    let stateChanges = [];
    const tracker = createSpeechTracker({
      speechStartThreshold: 0.15,
      speechEndThreshold: 0.08,
      minimumSpeechDurationMs: 1000,
      minimumSilenceDurationMs: 1500,
      onStateChange: (evt) => stateChanges.push(evt),
    });

    const startTime = 10000;

    // Sustained high energy from 10000ms to 11100ms (1100ms total)
    tracker.processAudioFrame(0.30, startTime);
    tracker.processAudioFrame(0.35, startTime + 500);
    const res = tracker.processAudioFrame(0.32, startTime + 1100);

    assert.strictEqual(res.currentState, SPEECH_STATES.SPEECH_LIKE);
    assert.strictEqual(tracker.getCurrentState(), SPEECH_STATES.SPEECH_LIKE);
    assert.strictEqual(stateChanges.length, 1);
    assert.strictEqual(stateChanges[0].activity, SPEECH_STATES.SPEECH_LIKE);
  });

  it('createSpeechTracker hysteresis keeps SPEECH_LIKE state above speechEndThreshold (0.08)', () => {
    const tracker = createSpeechTracker({
      speechStartThreshold: 0.15,
      speechEndThreshold: 0.08,
      minimumSpeechDurationMs: 1000,
      minimumSilenceDurationMs: 1500,
    });

    const startTime = 10000;

    // Transition to SPEECH_LIKE
    tracker.processAudioFrame(0.30, startTime);
    tracker.processAudioFrame(0.30, startTime + 1100);
    assert.strictEqual(tracker.getCurrentState(), SPEECH_STATES.SPEECH_LIKE);

    // Level drops to 0.10 (between end threshold 0.08 and start threshold 0.15)
    // Hysteresis preserves SPEECH_LIKE state!
    tracker.processAudioFrame(0.10, startTime + 2000);
    assert.strictEqual(tracker.getCurrentState(), SPEECH_STATES.SPEECH_LIKE);
  });

  it('createSpeechTracker transitions back to SILENCE after sustained quiet energy (>= 1500ms)', () => {
    let stateChanges = [];
    const tracker = createSpeechTracker({
      speechStartThreshold: 0.15,
      speechEndThreshold: 0.08,
      minimumSpeechDurationMs: 1000,
      minimumSilenceDurationMs: 1500,
      onStateChange: (evt) => stateChanges.push(evt),
    });

    const startTime = 10000;

    // 1. Transition to SPEECH_LIKE
    tracker.processAudioFrame(0.30, startTime);
    tracker.processAudioFrame(0.30, startTime + 1100);
    assert.strictEqual(tracker.getCurrentState(), SPEECH_STATES.SPEECH_LIKE);

    // 2. Audio drops below 0.08 at t = 15000ms
    const silenceStart = 15000;
    tracker.processAudioFrame(0.02, silenceStart);
    tracker.processAudioFrame(0.01, silenceStart + 800);

    // Still SPEECH_LIKE until minimumSilenceDurationMs (1500ms) elapses
    assert.strictEqual(tracker.getCurrentState(), SPEECH_STATES.SPEECH_LIKE);

    // At t = 16600ms (1600ms elapsed), transitions to SILENCE
    const finalRes = tracker.processAudioFrame(0.02, silenceStart + 1600);
    assert.strictEqual(finalRes.currentState, SPEECH_STATES.SILENCE);
    assert.strictEqual(tracker.getCurrentState(), SPEECH_STATES.SILENCE);
    assert.strictEqual(stateChanges.length, 2);
    assert.strictEqual(stateChanges[1].activity, SPEECH_STATES.SILENCE);
  });

  it('createSpeechTracker reset clears state back to SILENCE', () => {
    const tracker = createSpeechTracker({
      minimumSpeechDurationMs: 500,
    });

    tracker.processAudioFrame(0.40, 1000);
    tracker.processAudioFrame(0.40, 1600);
    assert.strictEqual(tracker.getCurrentState(), SPEECH_STATES.SPEECH_LIKE);

    tracker.reset();
    assert.strictEqual(tracker.getCurrentState(), SPEECH_STATES.SILENCE);
  });
});
