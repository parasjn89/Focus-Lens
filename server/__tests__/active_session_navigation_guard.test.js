import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('FocusLens Active Focus Session Navigation Guard Test Suite', () => {
  const modalPath = resolve(process.cwd(), 'src/components/ActiveSessionNavigationGuardModal.jsx');
  const appPath = resolve(process.cwd(), 'src/App.jsx');

  const modalSource = readFileSync(modalPath, 'utf-8');
  const appSource = readFileSync(appPath, 'utf-8');

  it('1. ActiveSessionNavigationGuardModal component file exists and exports named and default component', () => {
    assert.ok(existsSync(modalPath), 'ActiveSessionNavigationGuardModal.jsx must exist');
    assert.ok(modalSource.includes('export function ActiveSessionNavigationGuardModal('), 'Must export named ActiveSessionNavigationGuardModal');
    assert.ok(modalSource.includes('export default ActiveSessionNavigationGuardModal'), 'Must export default ActiveSessionNavigationGuardModal');
  });

  it('2. Modal adheres strictly to FocusLens command center palette and design tokens', () => {
    assert.ok(modalSource.includes('#10232A'), 'Must use primary dark navy background #10232A');
    assert.ok(modalSource.includes('#18313A'), 'Must use card surface #18313A');
    assert.ok(modalSource.includes('#168CFF'), 'Must use electric blue accent #168CFF');
    assert.ok(modalSource.includes('#00B8E6'), 'Must use cyan accent #00B8E6');
    assert.ok(modalSource.includes('#F2F6F8'), 'Must use primary light text #F2F6F8');
    assert.ok(modalSource.includes('#9BAFBC'), 'Must use secondary muted text #9BAFBC');
  });

  it('3. Modal includes required title, lock badge, messages and strictly single "Stay in Session" button', () => {
    // Title
    assert.ok(modalSource.includes('Focus Session in Progress'), 'Must include title "Focus Session in Progress"');
    
    // Warning text
    assert.ok(modalSource.includes("You can't leave the active session until it is finished."), 'Must include warning message');
    assert.ok(modalSource.includes('Stay focused and complete your current session to continue.'), 'Must include secondary helper message');

    // Single primary button
    assert.ok(modalSource.includes('Stay in Session'), 'Must contain "Stay in Session" button');

    // Guard invariant: NO "Leave Session" or "Exit Session" button inside this blocking modal
    assert.strictEqual(modalSource.includes('Leave Session'), false, 'Modal MUST NOT contain a "Leave Session" button');
    assert.strictEqual(modalSource.includes('Exit Session'), false, 'Modal MUST NOT contain an "Exit Session" button');
  });

  it('4. Modal implements full accessibility and dismiss patterns (Escape & Backdrop)', () => {
    assert.ok(modalSource.includes('role="dialog"'), 'Must have role="dialog"');
    assert.ok(modalSource.includes('aria-modal="true"'), 'Must have aria-modal="true"');
    assert.ok(modalSource.includes('aria-labelledby='), 'Must have aria-labelledby');
    assert.ok(modalSource.includes('aria-describedby='), 'Must have aria-describedby');
    assert.ok(modalSource.includes("e.key === 'Escape'"), 'Must handle Escape key down to dismiss modal');
    assert.ok(modalSource.includes('onClick={onClose}'), 'Backdrop click must call onClose');
  });

  it('5. App.jsx imports and mounts ActiveSessionNavigationGuardModal with isNavBlockedModalOpen state', () => {
    assert.ok(appSource.includes("import { ActiveSessionNavigationGuardModal } from './components/ActiveSessionNavigationGuardModal'"), 'App.jsx must import modal');
    assert.ok(appSource.includes('const [isNavBlockedModalOpen, setIsNavBlockedModalOpen] = useState(false);'), 'Must define isNavBlockedModalOpen state');
    assert.ok(appSource.includes('<ActiveSessionNavigationGuardModal'), 'Must mount modal in JSX');
    assert.ok(appSource.includes('isOpen={isNavBlockedModalOpen}'), 'Must pass isOpen to modal');
    assert.ok(appSource.includes('onClose={() => setIsNavBlockedModalOpen(false)}'), 'Must pass onClose handler to modal');
  });

  it('6. Central handleNavigate intercepts in-app navigation when active session is running', () => {
    // Ensure active guard check exists in handleNavigate
    const navGuardPattern = /if\s*\(currentView === 'active' && view !== 'active'\)\s*\{\s*if\s*\(isTimerRunning && !isFinalizingRef\.current\)/;
    assert.ok(navGuardPattern.test(appSource), 'handleNavigate must check currentView === "active" && view !== "active" and isTimerRunning && !isFinalizingRef.current');

    assert.ok(appSource.includes('setIsNavBlockedModalOpen(true);'), 'Must open guard modal on blocked navigation');
  });

  it('7. Popstate back/forward navigation is intercepted and restores /active history state', () => {
    assert.ok(appSource.includes('if (fromPopState && typeof window !== \'undefined\')'), 'Must detect popstate origin');
    assert.ok(appSource.includes("window.history.pushState({ view: 'active' }, '', canonicalPath)"), 'Must restore /active history state upon popstate navigation');
  });

  it('8. Native beforeunload listener prompts native browser warning during active session', () => {
    assert.ok(appSource.includes("window.addEventListener('beforeunload', handleBeforeUnload)"), 'Must add beforeunload listener');
    assert.ok(appSource.includes("window.removeEventListener('beforeunload', handleBeforeUnload)"), 'Must clean up beforeunload listener');
    assert.ok(appSource.includes('e.preventDefault();'), 'beforeunload handler must call e.preventDefault()');
    assert.ok(appSource.includes("e.returnValue = ''"), 'beforeunload handler must set e.returnValue');
  });

  it('9. Session completion and manual end cleanly deactivate the navigation guard', () => {
    // In finishSession
    const finishSessionIndex = appSource.indexOf('const finishSession = async');
    assert.ok(finishSessionIndex > 0, 'finishSession must exist');
    const finishSessionSlice = appSource.slice(finishSessionIndex, finishSessionIndex + 4000);

    assert.ok(finishSessionSlice.includes('isFinalizingRef.current = true;'), 'finishSession sets isFinalizingRef.current = true');
    assert.ok(finishSessionSlice.includes('setIsTimerRunning(false);'), 'finishSession sets isTimerRunning = false');
    assert.ok(finishSessionSlice.includes('setIsNavBlockedModalOpen(false);'), 'finishSession clears isNavBlockedModalOpen');
    assert.ok(finishSessionSlice.includes("handleNavigate('report');"), 'finishSession navigates to report view unblocked');
  });

  it('10. Paused sessions remain strictly guarded', () => {
    // During pause, isTimerRunning stays true while isTimerPaused becomes true
    const pauseConfirmIndex = appSource.indexOf('const handleConfirmPause = () =>');
    assert.ok(pauseConfirmIndex > 0, 'handleConfirmPause must exist');
    const pauseConfirmSlice = appSource.slice(pauseConfirmIndex, pauseConfirmIndex + 600);

    assert.ok(pauseConfirmSlice.includes('setIsTimerPaused(true);'), 'Pausing sets isTimerPaused to true');
    // Ensure isTimerRunning is NOT set to false during pause
    assert.strictEqual(pauseConfirmSlice.includes('setIsTimerRunning(false)'), false, 'Pausing must NOT set isTimerRunning to false');
  });

  it('11. Simulated Navigation Guard State Machine Test', () => {
    // Simulate the exact state machine transition logic used in App.jsx
    class NavigationGuardSimulation {
      constructor() {
        this.currentView = 'active';
        this.isTimerRunning = true;
        this.isTimerPaused = false;
        this.isFinalizing = false;
        this.isNavBlockedModalOpen = false;
        this.historyStack = ['/active'];
      }

      handleNavigate(targetView, { fromPopState = false } = {}) {
        if (this.currentView === 'active' && targetView !== 'active') {
          if (this.isTimerRunning && !this.isFinalizing) {
            if (fromPopState) {
              this.historyStack.push('/active');
            }
            this.isNavBlockedModalOpen = true;
            return false; // Navigation blocked
          }
        }
        this.currentView = targetView;
        this.historyStack.push(`/${targetView}`);
        return true; // Navigation allowed
      }

      pause() {
        this.isTimerPaused = true;
      }

      finish() {
        this.isFinalizing = true;
        this.isTimerRunning = false;
        this.isNavBlockedModalOpen = false;
        return this.handleNavigate('report');
      }
    }

    const sim = new NavigationGuardSimulation();

    // 1. In-app navigation while running -> BLOCKED
    assert.strictEqual(sim.handleNavigate('dashboard'), false);
    assert.strictEqual(sim.currentView, 'active');
    assert.strictEqual(sim.isNavBlockedModalOpen, true);

    // Dismiss modal
    sim.isNavBlockedModalOpen = false;

    // 2. Navigation while PAUSED -> STILL BLOCKED
    sim.pause();
    assert.strictEqual(sim.handleNavigate('tasks'), false);
    assert.strictEqual(sim.currentView, 'active');
    assert.strictEqual(sim.isNavBlockedModalOpen, true);

    // Dismiss modal
    sim.isNavBlockedModalOpen = false;

    // 3. Browser Back button (popstate) -> BLOCKED & History restored
    assert.strictEqual(sim.handleNavigate('landing', { fromPopState: true }), false);
    assert.strictEqual(sim.currentView, 'active');
    assert.strictEqual(sim.historyStack[sim.historyStack.length - 1], '/active');
    assert.strictEqual(sim.isNavBlockedModalOpen, true);

    // 4. Session finishes -> ALLOWED to navigate to report
    const finishedResult = sim.finish();
    assert.strictEqual(finishedResult, true);
    assert.strictEqual(sim.currentView, 'report');
    assert.strictEqual(sim.isNavBlockedModalOpen, false);

    // 5. Normal navigation from report -> ALLOWED
    assert.strictEqual(sim.handleNavigate('dashboard'), true);
    assert.strictEqual(sim.currentView, 'dashboard');
  });
});
