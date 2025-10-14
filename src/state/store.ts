import { merge } from 'lodash';
import { create, StateCreator } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { createCurrentTaskSlice, CurrentTaskSlice } from './currentTask';
import { createUiSlice, UiSlice } from './ui';
import { createSettingsSlice, SettingsSlice } from './settings';
import { localStorageName } from '../constants';
import { zustandChromeLocalStorage } from './zustandchromelocalstorage';

export type StoreType = {
  currentTask: CurrentTaskSlice;
  ui: UiSlice;
  settings: SettingsSlice;
};

export type MyStateCreator<T> = StateCreator<
  StoreType,
  [['zustand/immer', never]],
  [],
  T
>;

export const useAppState = create<StoreType>()(
  persist(
    immer(
      devtools((...a) => ({
        currentTask: createCurrentTaskSlice(...a),
        ui: createUiSlice(...a),
        settings: createSettingsSlice(...a),
      }))
    ),
    {
      name: localStorageName,
      storage: createJSONStorage(() => zustandChromeLocalStorage),
      partialize: (state) => ({
        // values we want to persist in the localstorage and retrieve using the chrome API
        ui: {
          instructions: state.ui.instructions,
        },
        settings: {
          openAIKey: state.settings.openAIKey,
          selectedModel: state.settings.selectedModel,
        },
        currentTask: {
          status: state.currentTask.status,
          UniqueIDperTask: state.currentTask.UniqueIDperTask,
          timeLog: state.currentTask.timeLog,
          // store specific history entries so that we can show the history in multi-tab setting
          // without taking up too much storage
          history: state.currentTask.history.map(({ response, action, usersteps, filteredusersteps}) => ({
            response,
            action,
            usersteps: usersteps.map(({ action_type, elementName, position }) => ({
              action_type,
              elementName,
              position })),
            filteredusersteps
          })),
        },
      }),
      // merge: (persistedState, currentState) => {
      //   if (persistedState?.currentTask?.history) {
      //     currentState.currentTask.history = currentState.currentTask.history.map(
      //       (entry, index) => ({
      //         ...entry,
      //         ...persistedState.currentTask.history[index],
      //       })
      //     );
      //   }
      //   return merge(currentState, persistedState);
      // },
      merge: (persistedState, currentState) => {
        // Check if history exists in the persisted state
        if (persistedState?.currentTask?.history) {
          currentState.currentTask.history = currentState.currentTask.history.map((entry, index) => {
            const persistedEntry = persistedState.currentTask.history[index];
            if (persistedEntry) {
              // Ensure we are merging entries safely
              return {
                ...entry, // Retain current state entry
                ...persistedEntry, // Merge persisted entry (could be a partial overwrite)
                usersteps: persistedEntry.usersteps ? [...entry.usersteps, ...persistedEntry.usersteps] : entry.usersteps, // Merge usersteps, if they exist in persisted state
                filteredusersteps: persistedEntry.filteredusersteps ?? entry.filteredusersteps // Use persisted value if exists, otherwise fallback to current state
              };
            }
            return entry; // Return original entry if no persisted entry is available
          });
        }
        // Perform the default merge for the rest of the state
        return merge(currentState, persistedState);
      },

    }
  )
);

// @ts-expect-error used for debugging
window.getState = useAppState.getState;
