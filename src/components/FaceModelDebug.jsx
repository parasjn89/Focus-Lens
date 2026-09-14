import React, { useState } from 'react';
import { testFaceModelInit, runSingleFaceTest } from '../services/faceDetector';

export function FaceModelDebug({ videoRef }) {
  const [status, setStatus] = useState('IDLE'); // IDLE | LOADING | READY | ERROR
  const [initTime, setInitTime] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [stage, setStage] = useState('IDLE');
  const [singlePassResult, setSinglePassResult] = useState(null);

  const handleInitializeFaceModel = async () => {
    setStatus('LOADING');
    setErrorMsg(null);
    setInitTime(null);
    setStage('INITIALIZING');
    setSinglePassResult(null);

    console.log('[FaceDebug] shared face model initialization requested');
    const result = await testFaceModelInit();

    if (result.success) {
      setStatus('READY');
      setStage('READY');
      setInitTime(`${result.elapsedMs}ms (delegate: ${result.delegate})`);
      console.log('[FaceDebug] shared face model initialization SUCCESS');
    } else {
      setStatus('ERROR');
      setStage('ERROR');
      setErrorMsg(result.error);
      console.error('[FaceDebug] shared face model initialization ERROR:', result.error);
    }
  };

  const handleSingleInference = async () => {
    const video = videoRef?.current;
    if (!video) {
      setSinglePassResult({ error: 'HTMLVideoElement reference is null.' });
      return;
    }

    console.log('[FaceDebug] running single pass test on shared service...');
    const res = await runSingleFaceTest(video);
    setSinglePassResult(res);
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-brand-500/40 text-slate-100 font-mono text-xs space-y-3 my-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-400 animate-pulse" />
          <span className="font-bold text-sm text-brand-300">MINIMAL FACE MODEL DEBUGGER</span>
        </div>
        <span className={`px-2.5 py-1 rounded-full font-extrabold text-[11px] ${
          status === 'READY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
          status === 'LOADING' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse' :
          status === 'ERROR' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
          'bg-slate-800 text-slate-400 border border-slate-700'
        }`}>
          Status: {status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>Stage: <span className="text-cyan-300 font-bold">{stage}</span></div>
        <div>Init Time: <span className="text-amber-300 font-bold">{initTime || 'N/A'}</span></div>
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 font-bold break-words">
          {errorMsg}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={handleInitializeFaceModel}
          disabled={status === 'LOADING'}
          className="flex-1 py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 text-white font-bold transition-all shadow-md flex items-center justify-center space-x-2"
        >
          <span>[ Initialize Face Model ]</span>
        </button>

        <button
          type="button"
          onClick={handleSingleInference}
          disabled={status !== 'READY'}
          className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold transition-all shadow-md flex items-center justify-center space-x-2"
        >
          <span>[ Run Single Face Pass ]</span>
        </button>
      </div>

      {singlePassResult && (
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-1">
          <div className="font-bold text-emerald-400 flex justify-between">
            <span>Single Pass Inference Output:</span>
            <span>{singlePassResult.detectionsCount !== undefined ? `${singlePassResult.detectionsCount} face(s) detected` : 'FAILED'}</span>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap text-slate-300 max-h-40 overflow-y-auto pt-1 text-[10px]">
            {JSON.stringify(singlePassResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
