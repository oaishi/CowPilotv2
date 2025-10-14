// written by Faria Huq
// console.log('Content script loaded..');

import { localStorageName, message_for_checking_ongoing_task, NAME_ELEMENT_SELECTOR } from '../../constants';
import { watchForRPCRequests } from '../../helpers/pageRPC';

type UserInteractionEvent = MouseEvent | WheelEvent | KeyboardEvent | InputEvent;

export interface UserLogStructure {
    action_type: string;
    nodeID?: string;
    elementName?: string;
    DOM?: string;
    elementouterHTML?: string;
    AXTree?: string;
    Screenshot?: string;
    coordinateX?: number;
    coordinateY?: number;
    clickType?: string;
    position?: string;
    URL?: string;
    scrollData?: {
      deltaX: number;
      deltaY: number;
      deltaMode: number;
      isLine: boolean;
      isPage: boolean;
      isPixel: boolean;
    };
    keyData?: {
      key: string;
      code: string;
      isCtrlPressed: boolean;
      isShiftPressed: boolean;
      isAltPressed: boolean;
      isMetaPressed: boolean;
      fulltextentry: string;
    };
    urldata?: {
        url_name: string;
        tab_id: number;
    };
}  

watchForRPCRequests();

function debounce<F extends (...args: any[]) => void>(func: F, wait: number): (...args: Parameters<F>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return function(this: ThisParameterType<F>, ...args: Parameters<F>): void {
        const context = this;
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

function userInteractionEventCallback(e: UserInteractionEvent) {
    if (!e.isTrusted) {
      // Ignore synthetic events
      return;
    }

    const target = e.target as HTMLElement;
    let elementId = target.getAttribute(NAME_ELEMENT_SELECTOR);
    if (elementId === null) elementId = target.id;
    const elementName = (target as HTMLInputElement).name;
    const elementouterHTML = target.outerHTML;
    let action_type_name = e.type;
    if (e.type === 'wheel') action_type_name = 'scroll'

    let message: UserLogStructure = {
        action_type: action_type_name,
        nodeID: elementId,
        elementName,
        DOM: document.documentElement.outerHTML,
        elementouterHTML: elementouterHTML,
        coordinateX: 0,
        coordinateY: 0,
        URL: document.URL
    };

    if (e instanceof MouseEvent) {
        message.coordinateX = e.clientX + (window.pageXOffset || document.documentElement.scrollLeft);
        message.coordinateY = e.clientY + (window.pageYOffset || document.documentElement.scrollTop);

        if (e.type === 'click' || e.type === 'contextmenu') {
            message.clickType = e.type === 'contextmenu' ? 'right-click' : 'left-click';
        } else if (e.type === 'wheel') {
            const wheelEvent = e as WheelEvent;
            message.scrollData = {
                deltaX: wheelEvent.deltaX,
                deltaY: wheelEvent.deltaY,
                deltaMode: wheelEvent.deltaMode,
                isLine: wheelEvent.deltaMode === WheelEvent.DOM_DELTA_LINE,
                isPage: wheelEvent.deltaMode === WheelEvent.DOM_DELTA_PAGE,
                isPixel: wheelEvent.deltaMode === WheelEvent.DOM_DELTA_PIXEL
            };
        }
    } else if (e instanceof KeyboardEvent) {
        let text_val = '';
        // Check if the target is an input or textarea to capture its value
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.contentEditable === 'true') {
            text_val = (target as HTMLInputElement | HTMLTextAreaElement).value || (target as HTMLElement).innerText;
        }
        message.keyData = {
            key: e.key,
            code: e.code,
            isCtrlPressed: e.ctrlKey,
            isShiftPressed: e.shiftKey,
            isAltPressed: e.altKey,
            isMetaPressed: e.metaKey,
            fulltextentry: text_val 
        };
    } else if (e instanceof InputEvent) {
        let inputValue = '';
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.contentEditable === 'true') {
            inputValue = (target as HTMLInputElement | HTMLTextAreaElement).value || (target as HTMLElement).innerText;
        }
        
        message.keyData = {
            key: '',
            code: '',
            isCtrlPressed: false,
            isShiftPressed: false,
            isAltPressed: false,
            isMetaPressed: false,
            fulltextentry: inputValue
            // Include any other relevant data from the InputEvent if necessary
        };
    }
  
    // Send the event data to the background script or another part of your application
    chrome.runtime.sendMessage({
        type: 'userlogdatafromcontent',
        logdata: message,
    }, (response) => {
        // console.log("Processed result: ", response);
    });
}

function isDevToolsOpen() {
    if (window.outerWidth - window.innerWidth > 100) {
      return true;
    }
    return false;
}

async function InitiateDOMListenerandTaskExecution() {
    try {
        let currentTaskStatus = '';
        const devToolsOpen = isDevToolsOpen();
        chrome.storage.local.get([localStorageName], function(result) {
            const value = result[localStorageName];
            const storedData = JSON.stringify(value);
            if (storedData) {
                try {
                const persistedState = JSON.parse(storedData);
                currentTaskStatus = persistedState.state?.currentTask?.status;
                console.log('currentTaskStatus', currentTaskStatus);

                chrome.runtime.sendMessage({
                    type: message_for_checking_ongoing_task,
                    payload: currentTaskStatus,
                    devtoolisopen: devToolsOpen,
                }, (response) => {
                    console.log("Response from background script:", response);
                });
        
                // if (currentTaskStatus === 'running') 
                // {
                    document.addEventListener('click', debounce(userInteractionEventCallback, 1000), true);
                    document.addEventListener('wheel', debounce(userInteractionEventCallback, 1000), true);
                    // document.addEventListener('keyup', debounce(userInteractionEventCallback, 50), true);
                    document.addEventListener('input', debounce((event: Event) => {
                            userInteractionEventCallback(event as KeyboardEvent);
                        }, 250), true);
                    document.addEventListener('mouseover', debounce(userInteractionEventCallback, 5000), true);
                    document.addEventListener('contextmenu', debounce(userInteractionEventCallback, 1000), true);
                // }
                } catch (error) {}
            } 
        });
    } catch (error) {
        console.error("Error in retrieving zustand state:", error);
    }
}

function checkDOMAndInitiateTaskExecution() {
    if (document.readyState === "complete") {
      setTimeout(() => {
        InitiateDOMListenerandTaskExecution();
      }, 10);
    } else {
      // Wait until the DOM is fully loaded
      window.addEventListener("load", () => {
        setTimeout(() => {
            InitiateDOMListenerandTaskExecution();
          }, 10);
      });
    }
}  

checkDOMAndInitiateTaskExecution();