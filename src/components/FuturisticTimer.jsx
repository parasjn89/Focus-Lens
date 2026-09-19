import React from 'react';
import { CircularGlassTimer } from './CircularGlassTimer';

/**
 * Backward compatibility wrapper: renders the redesigned circular glass productivity timer
 */
export function FuturisticTimer(props) {
  return <CircularGlassTimer {...props} />;
}
