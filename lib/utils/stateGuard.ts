export type StateTransitions<TState extends string> = Record<TState, readonly TState[]>;

export type StateGuard<TState extends string> = {
  canTransition: (current: TState, next: TState) => boolean;
  assertTransition: (current: TState, next: TState, errorCode?: string) => void;
};

export function createStateGuard<TState extends string>(
  transitions: StateTransitions<TState>,
  options?: { allowSameState?: boolean },
): StateGuard<TState> {
  const allowSameState = options?.allowSameState ?? true;

  function canTransition(current: TState, next: TState) {
    if (current === next) {
      return allowSameState;
    }

    return transitions[current].includes(next);
  }

  function assertTransition(current: TState, next: TState, errorCode = 'INVALID_STATE_TRANSITION') {
    if (!canTransition(current, next)) {
      throw new Error(`${errorCode}:${current}->${next}`);
    }
  }

  return {
    canTransition,
    assertTransition,
  };
}