import { DEFAULT_FLOW_TRANSITIONS, type FlowState } from './contracts';

export type FlowContext<TData = unknown> = {
  state: FlowState;
  data?: TData;
  error?: string | null;
};

export function canTransition(from: FlowState, to: FlowState) {
  return DEFAULT_FLOW_TRANSITIONS[from].includes(to);
}

export function transitionFlow<TData>(context: FlowContext<TData>, to: FlowState): FlowContext<TData> {
  if (!canTransition(context.state, to)) {
    return {
      ...context,
      state: 'error',
      error: `Invalid flow transition: ${context.state} -> ${to}`,
    };
  }

  return {
    ...context,
    state: to,
    error: to === 'error' ? context.error ?? 'Flow transition failed' : null,
  };
}

export function withFlowError<TData>(context: FlowContext<TData>, error: unknown): FlowContext<TData> {
  const message = error instanceof Error ? error.message : 'Unexpected flow error';
  return {
    ...context,
    state: 'error',
    error: message,
  };
}
