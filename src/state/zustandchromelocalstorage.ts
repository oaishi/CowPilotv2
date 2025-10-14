// Creates a custom storage interface for Zustand that is compatible for use 
// with chrome.storage.local

export const zustandChromeLocalStorage  = {
  getItem: (key: string): Promise<string | null> =>
    new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        const value = result[key];
        resolve(value ? JSON.stringify(value) : null); // Convert value to string
      });
    }),
  setItem: (key: string, value: string): Promise<void> =>
    new Promise((resolve) => {
      chrome.storage.local.set({ [key]: JSON.parse(value) }, () => resolve()); // Parse value from string
    }),
  removeItem: (key: string): Promise<void> =>
    new Promise((resolve) => {
      chrome.storage.local.remove(key, () => resolve());
    }),
};