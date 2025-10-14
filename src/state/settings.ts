import { MyStateCreator } from './store';

export type eval_score =
{
  name: string,
  value: string | number
}

export type SettingsSlice = {
  openAIKey: string | null;
  selectedModel: string;
  selectedPrompt: string;
  summary: eval_score[];
  actions: {
    update: (values: Partial<SettingsSlice>) => void;
    updatetasksuccess: (value: number) => void;
    updateSummaryValue: (key: string, value: string) => void; 
  };
};
export const createSettingsSlice: MyStateCreator<SettingsSlice> = (set) => ({
  openAIKey: null,
  selectedModel: 'neulab/gpt-4o-2024-08-06',
  selectedPrompt: 'WebArena',
  summary: [{'name': 'name', 'value': 'value'}],
  actions: {
    update: (values) => {
      set((state) => {
        state.settings = { ...state.settings, ...values };
      });
    },
    updatetasksuccess: (value: number) => {
      set((state) => {
        state.settings.summary = state.settings.summary.map((score) =>
          score.name === 'End-to-end success' ? { ...score, value } : score
        );
      });
    },
    updateSummaryValue: (key: string, value: string) => {
      set((state) => {
        state.settings.summary = state.settings.summary.map((score) =>
          score.name === key ? { ...score, value } : score
        );
      });
    }
  },
});
