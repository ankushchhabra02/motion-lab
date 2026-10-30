import { createContext, useContext } from 'react';

export type SplashPhase = 'pending' | 'revealed' | 'done';

export type SplashState = {
  phase: SplashPhase;
  /** True once the splash has started revealing the app; screens can start their entrance animations. */
  revealed: boolean;
  done: boolean;
};

const defaultState: SplashState = { phase: 'done', revealed: true, done: true };

export const SplashContext = createContext<SplashState>(defaultState);

export function useSplash(): SplashState {
  return useContext(SplashContext);
}

export function splashStateFor(phase: SplashPhase): SplashState {
  return { phase, revealed: phase !== 'pending', done: phase === 'done' };
}
