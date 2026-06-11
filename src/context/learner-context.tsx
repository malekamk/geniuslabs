import { createContext, useContext, useState, ReactNode } from 'react';
import type { Learner } from '@/types/db';

type LearnerContextType = {
  selectedLearner: Learner | null;
  selectLearner: (l: Learner | null) => void;
};

const LearnerContext = createContext<LearnerContextType>({
  selectedLearner: null,
  selectLearner: () => {},
});

export function LearnerProvider({ children }: { children: ReactNode }) {
  const [selectedLearner, setSelectedLearner] = useState<Learner | null>(null);
  return (
    <LearnerContext.Provider value={{ selectedLearner, selectLearner: setSelectedLearner }}>
      {children}
    </LearnerContext.Provider>
  );
}

export function useSelectedLearner() {
  return useContext(LearnerContext);
}
