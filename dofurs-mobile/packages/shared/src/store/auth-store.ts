import { create } from 'zustand';
import type { AppRole, AuthStatus } from '../types/auth';

export type SignupDraft = {
  name: string;
  email: string;
  phone: string;
  referralCode?: string | null;
};

type AuthState = {
  accessToken: string | null;
  userId: string | null;
  role: AppRole | null;
  status: AuthStatus;
  requiresProfileSetup: boolean;
  signupDraft: SignupDraft | null;
  setSession: (input: { accessToken: string; userId: string; role: AppRole | null }) => void;
  setRole: (role: AppRole | null) => void;
  setStatus: (status: AuthStatus) => void;
  setRequiresProfileSetup: (required: boolean) => void;
  setSignupDraft: (draft: SignupDraft | null) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  userId: null,
  role: null,
  status: 'idle',
  requiresProfileSetup: false,
  signupDraft: null,
  setSession: ({ accessToken, userId, role }) => {
    set({
      accessToken,
      userId,
      role,
      status: 'authenticated',
    });
  },
  setRole: (role) => set({ role }),
  setStatus: (status) => set({ status }),
  setRequiresProfileSetup: (required) => set({ requiresProfileSetup: required }),
  setSignupDraft: (draft) => set({ signupDraft: draft }),
  clearSession: () => {
    set({
      accessToken: null,
      userId: null,
      role: null,
      status: 'signed-out',
      requiresProfileSetup: false,
      signupDraft: null,
    });
  },
}));
