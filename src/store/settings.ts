"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_ST_INPUTS, type AdaptiveSTInputs } from "@/lib/adaptiveSt";
import { DEFAULT_STOPHUNT_INPUTS, type StopHuntInputs } from "@/lib/adaptiveSt";
import { DEFAULT_DCA_INPUTS, type DCAInputs } from "@/lib/adaptiveSt";
import { DEFAULT_MR_INPUTS, type MeanReversionInputs } from "@/lib/meanReversion";
import { DEFAULT_ORB_INPUTS, type ORBInputs } from "@/lib/orb";

interface IndicatorSettingsState {
  st: AdaptiveSTInputs;
  stopHunt: StopHuntInputs;
  dca: DCAInputs;
  mr: MeanReversionInputs;
  orb: ORBInputs;
  setST: (s: Partial<AdaptiveSTInputs>) => void;
  setStopHunt: (s: Partial<StopHuntInputs>) => void;
  setDCA: (s: Partial<DCAInputs>) => void;
  setMR: (s: Partial<MeanReversionInputs>) => void;
  setORB: (s: Partial<ORBInputs>) => void;
  resetAll: () => void;
}

export const useIndicatorSettings = create<IndicatorSettingsState>()(
  persist(
    (set) => ({
      st: DEFAULT_ST_INPUTS,
      stopHunt: DEFAULT_STOPHUNT_INPUTS,
      dca: DEFAULT_DCA_INPUTS,
      mr: DEFAULT_MR_INPUTS,
      orb: DEFAULT_ORB_INPUTS,
      setST: (s) => set((state) => ({ st: { ...state.st, ...s } })),
      setStopHunt: (s) => set((state) => ({ stopHunt: { ...state.stopHunt, ...s } })),
      setDCA: (s) => set((state) => ({ dca: { ...state.dca, ...s } })),
      setMR: (s) => set((state) => ({ mr: { ...state.mr, ...s } })),
      setORB: (s) => set((state) => ({ orb: { ...state.orb, ...s } })),
      resetAll: () => set({
        st: DEFAULT_ST_INPUTS,
        stopHunt: DEFAULT_STOPHUNT_INPUTS,
        dca: DEFAULT_DCA_INPUTS,
        mr: DEFAULT_MR_INPUTS,
        orb: DEFAULT_ORB_INPUTS,
      }),
    }),
    { name: "futures-friend-indicator-settings" }
  )
);