import { create } from 'zustand';
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firebase-errors';
import type { Role } from '@/lib/roles';
import type { DeletionRequest, InstructorProfile, NotificationPrefs, PrivacySettings } from '@/lib/account-settings';

import type { Timestamp } from 'firebase/firestore';

interface UserProfile {
  name: string;
  email?: string;
  displayName?: string;
  bio?: string;
  role: Role;
  roles?: Role[];
  /** Set for institution_admin — scopes what they can see and manage. */
  institutionId?: string;
  /** Account lifecycle. Absent means active. */
  accountStatus?: 'active' | 'suspended' | 'pending' | 'inactive' | 'banned' | 'deleted';
  statusReason?: string;
  adminRole?: 'super_admin' | 'admin' | 'content_editor' | 'support' | 'finance';
  avatarUrl?: string;
  photoStoragePath?: string;
  level?: string;
  learningStyle?: string;
  interests?: string[];
  xp?: number;
  yearGroup?: string;
  /** Programme chosen at sign-up. Same value as `level` for students. */
  pathway?: string;
  subscriptionTier?: 'free' | 'academic';
  sparksBalance?: number;
  sparksMonthlyAllowance?: number;
  sparksGrantedAt?: Timestamp;
  /** Preferred UI and lesson language. A short code from `lib/languages.ts`. */
  language?: string;
  /** YYYY-MM-DD days a lesson was opened, used for the study streak. */
  studyDates?: string[];
  /** When false, the privacy-safe leaderboard omits this student. */
  shareBoard?: boolean;
  accessTier?: number;
  permissions?: string[];
  phone?: string;
  country?: string;
  timezone?: string;
  currency?: string;
  notificationPrefs?: NotificationPrefs;
  privacy?: PrivacySettings;
  instructor?: InstructorProfile;
  twoFactorEnabled?: boolean;
  sessionsRevokedAt?: number;
  deletionRequest?: DeletionRequest | null;
  region?: string;
  programmeId?: string;
  cohortIds?: string[];
  /** Children who approved a parent link. */
  childIds?: string[];
  /** Server-set from dateOfBirth. Clients cannot write it. */
  ageTier?: 'under13' | 'teen' | 'adult';
  /** YYYY-MM-DD. Server-set. */
  dateOfBirth?: string;
  currentCountry?: string;
  homeCountry?: string;
  /** Server-written verification tier. Clients cannot change it. */
  verification?: { tier: number; method: string; verifiedAt: number; verifiedBy: string };
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  fetchProfile: (uid: string) => Promise<void>;
}

export const useAuthSTORE = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  fetchProfile: async (uid) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        set({ profile: docSnap.data() as UserProfile });
      } else {
        set({ profile: null });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    }
  }
}));
