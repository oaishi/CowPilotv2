// console.log('Put the background scripts here.');

import {ChatRestModule, ChatInterface, ChatModule, InitProgressReport} from "@mlc-ai/web-llm";
import { wait_time_interval, message_for_checking_ongoing_task } from "../../constants";
import { detachDebuggerFromAllTabsExceptActive } from "../../helpers/chromeDebugger";
import { UserLogStructure } from "../Content";

chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// TODO: Surface this as an option to the user 
const useWebGPU = true;
var model_loaded = false;

var cm: ChatInterface;
if (!useWebGPU) {
    cm = new ChatRestModule();
} else {
    cm = new ChatModule();
}

// Set reponse callback for chat module
const generateProgressCallback = (_step: number, message: string) => {
    // send the answer back to the content script
    chrome.runtime.sendMessage({ answer: message });
};

var context = "";
// Faria: needed to pass the information from content to background
interface LogEntry {
    data: UserLogStructure;  
    timestamp: number;
  }

let logQueue: LogEntry[] = [];
let userdecision: string = '';

function cleanUpLogQueue() {
    const now = Date.now();
    // Keep recent entries only
    logQueue = logQueue.filter(entry => now - entry.timestamp <= wait_time_interval); 
}

// Set up an interval to clean up the user log of dom actions queue
setInterval(cleanUpLogQueue, wait_time_interval * 5);  

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    // written by Faria Huq
    if (request.type === 'devtool') {
        if (request.open) {
            console.log('DevTools is open in tab', sender.tab.id);
        } else {
            console.log('DevTools is closed in tab', sender.tab.id);
        }
      return true; 
    } 
 
    if (request.type === 'userlogdatafromcontent') {
        logQueue.push({
            data: request.logdata,
            timestamp: Date.now()
        });
        sendResponse({reply: 'Data received from content!'});
        return true; 
    }

    if (request.type === 'fetchuserlogtosave') {
        if (logQueue.length > 0){
            // Remove the entry from the queue
            const logEntry = logQueue.shift();  
            sendResponse({reply: logEntry.data});
        } else {
            sendResponse({reply: null});  // No data to send
        }
        return true; 
    }

    if (request.type === 'getuserdecisionshortcut') {
        if (userdecision != ''){
            sendResponse({reply: userdecision});
            userdecision = '';
        } else {
            sendResponse({reply: null});  // No data to send
        }
        return true; 
    }

    if (request.type === message_for_checking_ongoing_task) {
        const task_status = request.payload;
        if (task_status === "interrupted") { 
            sendResponse({status: "No task is currently ongoing", payload: task_status});
          } else if (task_status === "running") {
            detachDebuggerFromAllTabsExceptActive();
            console.log("page refreshed!");
            sendResponse({status: "A task is already running", payload: task_status});
            // setTimeout(() => {
            //     chrome.action.openPopup(() => {
            //         console.log("Popup opened successfully after 5 seconds!");
            //     });
            // }, 5000);
          }
        return true; 
    }

    // written by Frank Xu
    // check if the request contains a message that the user sent a new message
    if (request.input) {
        var inp = request.input;
        if (context.length > 0) {
            inp = "Use only the following context when answering the question at the end. Don't use any other knowledge.\n"+ context + "\n\nQuestion: " + request.input + "\n\nHelpful Answer: ";
        }
        console.log("Input:", inp);
        const response = await cm.generate(inp, generateProgressCallback);
    }
    if (request.context) {
        context = request.context;
        console.log("Got context:", context);
    }
    if (request.reload) {
        if (!model_loaded) {
            var appConfig = request.reload;
            console.log("Got appConfig: ", appConfig);
            
            cm.setInitProgressCallback((report: InitProgressReport) => {
                console.log(report.text, report.progress);
                chrome.runtime.sendMessage({ initProgressReport: report.progress});
            });
        
            await cm.reload("Mistral-7B-Instruct-v0.2-q4f16_1", undefined, appConfig);
            console.log("Model loaded");
            model_loaded = true;
        } else {
            chrome.runtime.sendMessage({ initProgressReport: 1.0});
        }
    }
});
  
// https://developer.chrome.com/docs/extensions/reference/api/commands
chrome.commands.onCommand.addListener((command) => {
    console.log('command found', command);
    if (command === 'pause') {
        userdecision = 'reject';
        resetUserDecision();
    }
    if (command === 'continue') {
        userdecision = 'accept';
        resetUserDecision();
      }
  });

function resetUserDecision() {
setTimeout(() => {
    console.log('userDecision resetting from:', userdecision);
    userdecision = '';
    console.log('userDecision reset to empty string', userdecision);
}, 3000);
}
 
// Faria: keep log of user goto action: https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onUpdated
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.url) {
      // console.log("Tab ID: " + tabId + ", updated with new URL: " + changeInfo.url);
      const userLog: UserLogStructure = {
        action_type: 'goto',
        urldata: {
          url_name: changeInfo.url,
          tab_id: tabId
        }
      };
      logQueue.push({
        data: userLog,
        timestamp: Date.now()
      });
    }
});
  