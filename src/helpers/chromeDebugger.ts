export function attachDebugger(tabId: number) {
  return new Promise<void>((resolve, reject) => {
    try {
      isDebuggerAttached(tabId)
      .then((isAttached) => {
        if (isAttached) {
          console.log('Debugger is already attached to this tab.');
          resolve();
          return;
        }});
      chrome.debugger.attach({ tabId }, '1.2', async () => {
        if (chrome.runtime.lastError) {
          console.error(
            'Failed to attach debugger:',
            chrome.runtime.lastError.message
          );
          resolve();
        } else {
          console.log('attached to debugger');
          await chrome.debugger.sendCommand({ tabId }, 'DOM.enable');
          console.log('DOM enabled');
          await chrome.debugger.sendCommand({ tabId }, 'Accessibility.enable');
          console.log('Accessibility enabled');
          await chrome.debugger.sendCommand({ tabId }, 'Runtime.enable');
          console.log('Runtime enabled');
          await chrome.debugger.sendCommand({ tabId }, 'Page.enable');
          console.log('Page enabled');
          resolve();
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

export async function isDebuggerAttachedToCurrentWindow() {
  return new Promise((resolve) => {
      chrome.windows.getCurrent({ populate: true }, (currentWindow) => {
          if (!currentWindow) {
              resolve(true); // No active window, assume no debugger
              return;
          }

      chrome.debugger.getTargets((targets) => {
          const isAttached = targets.some(target => 
              target.attached && target.type === "page" && target.tabId
          );
          resolve(!isAttached); // Resolve true if no debugger is attached
        });
      });
  });
}

export async function detachDebugger(tabId: number) {
  const targets = await chrome.debugger.getTargets();
  const isAttached = targets.some(
    (target) => target.tabId === tabId && target.attached
  );
  if (isAttached) {
    await chrome.debugger.sendCommand({ tabId }, 'Accessibility.disable');
    console.log('Accessibility disabled');
    await chrome.debugger.sendCommand({ tabId }, 'DOM.disable');
    console.log('DOM disabled');
    await chrome.debugger.sendCommand({ tabId }, 'Runtime.disable');
    console.log('Runtime disabled');
    await chrome.debugger.sendCommand({ tabId }, 'Page.disable');
    console.log('Page disabled');
    chrome.debugger.detach({ tabId: tabId });
  }
}

export async function isDebuggerAttached(tabId: number) {
  return new Promise((resolve, reject) => {
    chrome.debugger.getTargets((targets) => {
      const attached = targets.some(
        (target) => target.attached && target.tabId === tabId
      );
      resolve(attached);
    });
  });
}

export async function detachDebuggerFromAllTabsExceptActive() {
  const queryOptions = { currentWindow: true };
  chrome.tabs.query(queryOptions, (tabs) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
      const activeTab = activeTabs[0];
      tabs.forEach((tab) => {
        if (tab.id !== activeTab.id) {
          detachDebugger(tab.id);
        }
      });
    });
  });
}
