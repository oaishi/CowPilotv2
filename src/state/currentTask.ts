import { CreateCompletionResponseUsage } from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { host_url, save_data_to_server, wait_time_interval } from '../constants';
import {
  attachDebugger,
  detachDebugger,
  isDebuggerAttachedToCurrentWindow} from '../helpers/chromeDebugger';
import { determineNextAction } from '../helpers/determineNextAction';
import { determineUserInteractionDecision } from '../helpers/determineUserInteraction';
import {
  disableIncompatibleExtensions,
  reenableExtensions
} from '../helpers/disableExtensions';
import {
  callDOMAction,
  fetch_page_accessibility_tree,
  hintTooltip,
  takeScreenshot
} from '../helpers/domActions';
import { callRPC } from '../helpers/pageRPC';
import {
  ParsedResponse,
  ParsedResponseSuccess,
  parseResponse
} from '../helpers/parseResponse';
import { getMapping } from '../helpers/simplifyDom';
// import { mergeCommonAction } from '../helpers/summarizeUserAction';
import { mergeUserAction } from '../helpers/summarizeUserAction';
import { sleep, truthyFilter } from '../helpers/utils';
import { UserLogStructure } from '../pages/Content';
import { eval_score } from './settings';
import { MyStateCreator, useAppState } from './store';

const action_url = host_url + `/gpt_action_record/`;
const user_data_url = host_url + `/user_record/`;
const session_record_url = host_url + `/session_record/`;

export type DomElementmetadata = {
  DOM: string;
  AXTree: string;
  Screenshot: string;
  action_type: string;
  position: string;
  nodeID: number;
  URL: string;
};

export type TimeLogEntry = {
  event: string;
  time: number;
};

export type TaskHistoryEntry = {
  prompt: string;
  response: string;
  action: ParsedResponse;
  usage: CreateCompletionResponseUsage;
  accept_flag: string;
  ask_for_confirmation_flag: boolean;
  counter: number;
  metadata: DomElementmetadata;
  usersteps: UserLogStructure[];
  filteredusersteps?: string;
  wasAutoExecuted?: boolean; // true = agent_continue (auto-executed), false = ask_user (waited for feedback)
};

export type CurrentTaskSlice = {
  userDecision: 'accept' | 'reject' | 'next' | 'idle'| 'askforconfirmation';
  tabId: number;
  tab_index: number;
  tab_array: number[];
  url_index: number;
  url_array: string[];
  UniqueIDperTask: string;
  instructions: string | null;
  history: TaskHistoryEntry[];
  timeLog: TimeLogEntry[];
  totalAgentTime: number;
  totalHumanTime: number;
  status: 'idle' | 'running' | 'success' | 'error' | 'interrupted'| 'accept'| 'reject';
  autoProceed: boolean; // GPT-based decision: true = auto-execute, false = wait for feedback
  actionStatus:
    | 'idle'
    | 'attaching-debugger'
    | 'pulling-dom'
    | 'transforming-dom'
    | 'transforming-axtree'
    | 'performing-query'
    | 'showing-response'
    | 'performing-action'
    | 'waiting';
  actions: {
    runTask: (onError: (error: string) => void) => Promise<void>;
    finishwithfailure: () => void;
    accept: () => void;
    reject: () => void;
    RunNextStep: () => void;
    finishwithsuccess: () => void;
    initiate:() => void;
    DownloadData:() => void;
    markascriticalstep:() => void;
    pause: () => void; 
  };
  pauseRequested: boolean;
};

function postdata(url: string, data: any){
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Item updated successfully:', data);
  })
  .catch(error => {
    console.error('Error updating item:', error);
  });
}

function creategptactiondataforpost(taskhistory :TaskHistoryEntry, time: Number, flag: number, relation_id: any){
  let itemData = {
    _id: uuidv4(),
    _uuid: relation_id,
    _index: flag,
    _time: time,
    prompt: taskhistory.prompt,
    response: taskhistory.response,
    usage: taskhistory.usage,
    accept_flag: taskhistory.accept_flag,
    ask_for_confirmation_flag: taskhistory.ask_for_confirmation_flag,
    counter: taskhistory.counter,
    metadata: taskhistory.metadata
  };
  if (save_data_to_server) postdata(action_url, itemData);
}

function downloadTaskHistoryData(taskHistoryEntries: CurrentTaskSlice, task_intent: string, results: eval_score[]) {
  const newEntries = taskHistoryEntries.history.map((entry, idx) => {
    return {
      prompt: entry.prompt,
      response: entry.response,
      // action: entry.action,
      usage: entry.usage,
      accept_flag: entry.accept_flag,
      ask_for_confirmation_flag: entry.ask_for_confirmation_flag,
      counter: entry.counter,
      metadata: entry.metadata,
      usersteps: entry.usersteps,
      filteredusersteps: entry.filteredusersteps,
      wasAutoExecuted: entry.wasAutoExecuted
    };
  });
  
  const dataToSave = {
    intent: task_intent,
    model: useAppState.getState().settings.selectedModel,
    totalAgentTime: taskHistoryEntries.totalAgentTime,
    totalHumanTime: taskHistoryEntries.totalHumanTime,
    totalTime: taskHistoryEntries.totalAgentTime+taskHistoryEntries.totalHumanTime,
    timeLog: taskHistoryEntries.timeLog,
    action_log: newEntries,
    evaluation_results: results
  };
  
  const jsonString = JSON.stringify(dataToSave, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'session_log.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // let flag = 0;
  // const relation_id = uuidv4();
  // for (const entry of newEntries) {
  //   flag += 1;
  //   creategptactiondataforpost(entry as TaskHistoryEntry, 'time add', flag, relation_id);
  // }
}

export const createCurrentTaskSlice: MyStateCreator<CurrentTaskSlice> = (
  set,
  get
  ) => ({
    tabId: -1,
    tab_array: [],
    tab_index: -1,
    url_array: [],
    url_index: -1,
    UniqueIDperTask: 'null',
    instructions: null,
    history: [],
    timeLog: [],
    userDecision: 'idle', // Add this to store the decision callbacks
    totalAgentTime: 0,
    totalHumanTime: 0,
    status: 'idle',
    autoProceed: false, // Default: wait for feedback (safer) – will be overridden by decision model
    actionStatus: 'idle',
    pauseRequested: false, 
    actions: {
      runTask: async (onError) => {
        const wasStopped = () => get().currentTask.status !== 'running';
        const setActionStatus = (status: CurrentTaskSlice['actionStatus']) => {
          set((state) => {
            state.currentTask.actionStatus = status;
          });
        };
        const addTabIfNotExists = (tab_number: number) => {
          set((state) => {
            if (state.currentTask.tab_array.length === 0 || state.currentTask.tab_array[state.currentTask.tab_array.length - 1] !== tab_number) {
              state.currentTask.tab_array.push(tab_number);
              state.currentTask.tab_index = state.currentTask.tab_array.length - 1;
            }
          });
        };
        const addURLIfNotExists = (url_link: string) => {
          set((state) => {
            if (state.currentTask.url_array.length === 0 || state.currentTask.url_array[state.currentTask.url_array.length - 1] !== url_link) {
              state.currentTask.url_array.push(url_link);
              state.currentTask.url_index = state.currentTask.url_array.length - 1;
            }
          });
        };
        console.log('starting runtask');

        const instructions = get().ui.instructions;
        let action: ParsedResponse; 
        let rippleTime: number;
        let currententryfortaskhistory: TaskHistoryEntry;

        if (!instructions) return;
        set((state) => {
          state.currentTask.instructions = instructions;
          state.currentTask.status = 'running';
          state.currentTask.actionStatus = 'attaching-debugger';
          state.currentTask.totalAgentTime = 0;
          state.currentTask.totalHumanTime = 0;
          state.currentTask.timeLog = [];
        });
        
        const relation_id = get().currentTask.UniqueIDperTask;
        if (save_data_to_server){ 
          let session_data = {
            _id: uuidv4(),
            _uuid: relation_id,
            task: useAppState.getState().ui.instructions
          }
          postdata(session_record_url, session_data);
        }
        
        try {
          const activeTab = (
            await chrome.tabs.query({ active: true, currentWindow: true })
            )[0];
            
          if (!activeTab.id)
          {
            logTimeEvent('No active tab found');
            throw new Error('No active tab found');
          }

          const tabId = activeTab.id;
          addTabIfNotExists(tabId);
          set((state) => {
            state.currentTask.tabId = tabId;
          });
          
          const startTime = performance.now();
          console.log('task started' + ', ' + instructions + ', ' + get().currentTask.status);
          function logTimeEvent(event: string) {
            const elapsed = performance.now() - startTime;
            set((state) => { state.currentTask.timeLog.push({ event, time: elapsed }); });
            console.log(`[TimeLog] ${event} at ${elapsed.toFixed(2)} ms`);
          }
          logTimeEvent("Task started");

          await disableIncompatibleExtensions();
          await attachDebugger(tabId);
          logTimeEvent("Debugger attached");

          let startTimeforTimeout: number | null = null;
          let stopFlag = false;
          let intervalId: number | null = null;

          async function GenerateErrorSummary(): Promise<eval_score[]>
          {
              const history = get().currentTask.history;
              const historylength = get().currentTask.history.length;
              if (historylength > 0 && 
                history[historylength-1].usersteps.length > 0 && 
                (history[historylength-1].filteredusersteps === undefined ||
                history[historylength-1].filteredusersteps?.length == 0))
              {
                const mergedResult = await mergeUserAction(get().currentTask.history[historylength - 1]);
                // console.log('mergedResult', mergedResult);
                set((state) => {
                  state.currentTask.history[historylength - 1].filteredusersteps = mergedResult;
                });
                await sleep(1);
              }
              let summary_draft: eval_score[] = [];
              const taskHistory = get().currentTask.history as TaskHistoryEntry[];
              let step_length = taskHistory.length;
              let human_steps = 0;
              let step_accuracy = 0;
              let human_intervention_count = 0;
              taskHistory.forEach((entry) => { 
                human_steps += (entry.filteredusersteps?.match(new RegExp('thought', 'g')) || []).length;
                if (entry.usersteps.length > 0) human_intervention_count+= 1;
                if (entry.accept_flag === 'accept') step_accuracy += 1;
              });

              summary_draft.push({name: 'Answer', value: ''});
              summary_draft.push({name: 'End-to-end success', value: 0.0} as eval_score);
              summary_draft.push({name: 'Step Accuracy', value: step_accuracy/step_length} as eval_score);
              summary_draft.push({name: '# of Total Steps', value: step_length + human_steps} as eval_score);
              summary_draft.push({name: '# of Human Steps', value: human_steps} as eval_score);
              summary_draft.push({name: '# of Agent Steps', value: step_length} as eval_score);
              summary_draft.push({name: '# of Human Intervention', value: human_intervention_count} as eval_score);
              summary_draft.push({name: 'Last Step', value: 'agent'} as eval_score);
              
              return summary_draft;
          }

          function timeoutFunction(callback: () => void): void {
            // clear any previous interval
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          
            startTimeforTimeout = performance.now();
            stopFlag = false;
          
            intervalId = setInterval(() => {
              console.log('i am still running', stopFlag);
              if (!stopFlag) {
                callback();
              }
            }, wait_time_interval);
          }
          
          function stopTimeoutFunction(): void {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
              console.log('Timer has been completely stopped.');
            }
          }          
          
          async function fetchmodelResponse(instructions: string, recursive_call = 0)
          {
            const noDebugger = await isDebuggerAttachedToCurrentWindow();
            if (noDebugger && get().currentTask.status === "running")
            {
              console.log('tab has changed.')
              const activeTab = (
                await chrome.tabs.query({ active: true, currentWindow: true })
                )[0];
                const tabId = activeTab.id;
                // console.log('attaching to:', tabId);
                if (typeof tabId === 'number'){
                  set((state) => {
                    state.currentTask.tabId = tabId;
                  });
                  await attachDebugger(tabId);
                }
            }
            const agentStartTime = performance.now();
            logTimeEvent("Agent: Starting fetchmodelResponse");
            try {
              if (wasStopped()) return;
              setActionStatus('transforming-axtree');
              
              let flag = true;
              let axtree_rep = "";
              let processTime = 0;
              let repTime = 0;
              let pauseRequested;
            
              // waiting until page loads properly, otherwise axtree is not fetched properly due to reduce in wait time
              const maxAttempts = 10;
              let attempts = 0;
              while (flag && attempts < maxAttempts) {
                attempts++;
                const stepStartTime = performance.now();
                const _ = await getMapping();
                processTime = performance.now();
                // console.log(`Mapping took: ${processTime - stepStartTime} milliseconds`);
                
                await sleep(5);
                axtree_rep = await fetch_page_accessibility_tree(true);
                repTime = performance.now();
                // console.log(`fetch AXtree took: ${repTime - processTime - 5} milliseconds`);
                if (axtree_rep !== "") {
                  logTimeEvent("Agent: AX tree fetched");
                  flag = false;
                }
              }
            
              if (!axtree_rep) {
                console.log('axtree rep not found error, so stopped');
                logTimeEvent('Error: axtree rep not found, so stopped');
                set((state) => {
                  state.currentTask.status = 'error';
                });
                return;
              }
            
              if (wasStopped()) return;
              const previousActions = get().currentTask.history
                .filter(entry => !('error' in entry.action))
                .map(entry => ({
                  thought: (entry.action as ParsedResponseSuccess).thought,
                  action: (entry.action as ParsedResponseSuccess).action,
                  parsedAction: (entry.action as ParsedResponseSuccess).parsedAction,
                  filteredusersteps: entry.filteredusersteps,
                  feedback: (entry.action as ParsedResponseSuccess).feedback
                }))
                .filter(truthyFilter);

              pauseRequested = get().currentTask.pauseRequested;
              if (pauseRequested) {
                console.log('firing pause, should start logging');
                set((state) => {
                  state.currentTask.autoProceed = false;
                  state.currentTask.pauseRequested = false; // consume pause
                  state.currentTask.userDecision = 'reject';
                  if (state.currentTask.history.length > 0) {
                    const last = state.currentTask.history[state.currentTask.history.length - 1];
                    last.accept_flag = 'reject';
                    last.ask_for_confirmation_flag = true;
                  }
                });
                timeoutFunction(waitforfeedback);
                return;
              }
              setActionStatus('performing-query'); 
              logTimeEvent("Agent: Starting GPT query"); 
              let query;
              try
              {
                query = await determineNextAction(
                  instructions,
                  previousActions.filter(
                    (pa) => !('error' in pa)
                    ) as ParsedResponseSuccess[],
                  axtree_rep,
                  3,
                  onError
                );
              }
              catch (e: any) {
                logTimeEvent("Error: GPT query not working");
                stopFlag = true;
                stopTimeoutFunction();
                const summary_draft = await GenerateErrorSummary();
                detachDebugger(get().currentTask.tabId);
                set((state) => {
                  state.currentTask.tabId = -1;
                  state.settings.summary = summary_draft;
                  state.currentTask.status = 'error';
                });
                return;
              }
              pauseRequested = get().currentTask.pauseRequested;
              if (pauseRequested) {
                console.log('firing pause, should start logging');
                set((state) => {
                  state.currentTask.autoProceed = false;
                  state.currentTask.pauseRequested = false; // consume pause
                  state.currentTask.userDecision = 'reject';
                  if (state.currentTask.history.length > 0) {
                    const last = state.currentTask.history[state.currentTask.history.length - 1];
                    last.accept_flag = 'reject';
                    last.ask_for_confirmation_flag = true;
                  }
                });
                timeoutFunction(waitforfeedback);
                return;
              }
              const callTime = performance.now();
              console.log(`GPT4 response took: ${callTime - processTime} milliseconds`);
              logTimeEvent("Agent: GPT query completed");
              if (!query) {
                logTimeEvent("Error: GPT query not found");
                stopFlag = true;
                stopTimeoutFunction();
                const summary_draft = await GenerateErrorSummary();
                detachDebugger(get().currentTask.tabId);
                set((state) => {
                  state.currentTask.tabId = -1;
                  state.settings.summary = summary_draft;
                  state.currentTask.status = 'error';
                });
                return;
              }

              if (wasStopped()) return;
              action = parseResponse(query.response);
              console.log('gpt response parsed', action);
              setActionStatus('showing-response');
              if (action === null) {
                return;
              }
              if ('error' in action) {
                console.log('error in action', action.error);
                logTimeEvent('Error: ' + action.error);
                onError(action.error);
                detachDebugger(get().currentTask.tabId);
                set((state) => {
                  state.currentTask.tabId = -1;
                  state.currentTask.status = 'error';
                });
                stopFlag = true;
                stopTimeoutFunction();
                return;
              }
              const [domString, screenshot, url] = await Promise.all([
                callRPC('getDOM') as Promise<string>,
                takeScreenshot(),
                callRPC('getURl') as Promise<string>
              ]);
              const init_metadata: DomElementmetadata = {
                DOM: domString,
                AXTree: axtree_rep,
                Screenshot: screenshot,
                action_type: action.parsedAction.name,
                position: '',
                nodeID: -1,
                URL: url
              };
              addURLIfNotExists(init_metadata.URL);
                  
              currententryfortaskhistory = {
                prompt: query.prompt,
                response: query.response,
                action,
                usage: query.usage,
                accept_flag: 'accept', //'neutral',
                ask_for_confirmation_flag: false,
                counter: 0,
                metadata: init_metadata,
                usersteps: [],
                filteredusersteps: '',
                wasAutoExecuted: false
              };
              
              if (action.parsedAction.name === 'fail') {
                
                if (recursive_call < 3)
                {
                  fetchmodelResponse(instructions, recursive_call + 1);
                }
                else
                {
                  set((state) => {
                    state.currentTask.history.push(currententryfortaskhistory);
                    state.currentTask.status = 'error';
                  });
                  
                  logTimeEvent('Error: agent replied with fail.')
                  stopFlag = true;
                  stopTimeoutFunction();
                  const summary_draft = await GenerateErrorSummary();
                  detachDebugger(get().currentTask.tabId);
                  set((state) => {
                    state.currentTask.tabId = -1;
                    state.settings.summary = summary_draft;
                  });
                  // downloadTaskHistoryData(get().currentTask, get().ui.instructions, summary_draft);
                }
                return;
              }
              
              const index_of_last_entry = get().currentTask.history.length;
              if ( index_of_last_entry > 0) {
                const mergedResult = await mergeUserAction(get().currentTask.history[index_of_last_entry - 1]);
                // console.log('mergedResult', mergedResult);
                set((state) => {
                  state.currentTask.history[index_of_last_entry - 1].filteredusersteps = mergedResult;
                });
                // console.log('update check', get().currentTask.history[index_of_last_entry-1].filteredusersteps);
              }
              pauseRequested = get().currentTask.pauseRequested;
              if (pauseRequested) {
                console.log('firing pause, should start logging');
                set((state) => {
                  state.currentTask.autoProceed = false;
                  state.currentTask.pauseRequested = false; // consume pause
                  state.currentTask.userDecision = 'reject';
                  if (state.currentTask.history.length > 0) {
                    const last = state.currentTask.history[state.currentTask.history.length - 1];
                    last.accept_flag = 'reject';
                    last.ask_for_confirmation_flag = true;
                  }
                });
                timeoutFunction(waitforfeedback);
                return;
              }

              if (action.parsedAction.name === 'finish' || action.parsedAction.name === 'finishwithanswer') {
                logTimeEvent("Agent: Finished execution step (finish/finishwithanswer)");
                set((state) => {
                  state.currentTask.history.push(currententryfortaskhistory);
                });
                const history = get().currentTask.history;
                const historylength = history.length;
                if (historylength > 0 && 
                  history[historylength-1].usersteps.length > 0 && 
                  history[historylength-1].filteredusersteps === undefined) {
                  const mergedResult = await mergeUserAction(history[historylength - 1]);
                  // console.log('mergedResult', mergedResult);
                  set((state) => {
                    state.currentTask.history[historylength - 1].filteredusersteps = mergedResult;
                  });
                  // console.log('update check', get().currentTask.history[historylength-1].filteredusersteps);
                  await sleep(1);
                }
                let summary_draft: eval_score[] = [];
                const taskHistory = get().currentTask.history as TaskHistoryEntry[];
                let step_length = taskHistory.length;
                let human_steps = 0;
                let step_accuracy = 0;
                let human_intervention_count = 0;
                taskHistory.forEach((entry) => { 
                  // human_steps += entry.usersteps.length;
                  human_steps += (entry.filteredusersteps?.match(new RegExp('thought', 'g')) || []).length;
                  if (entry.usersteps.length > 0) human_intervention_count+= 1;
                  if (entry.accept_flag === 'accept') step_accuracy += 1;
                });

                if (action.parsedAction.name === 'finishwithanswer')
                  summary_draft.push({name: 'Answer', value: action.parsedAction.args.answer});
                else
                  summary_draft.push({name: 'Answer', value: ''});
                summary_draft.push({name: 'End-to-end success', value: 1.0} as eval_score);
                summary_draft.push({name: 'Step Accuracy', value: step_accuracy/step_length} as eval_score);
                summary_draft.push({name: '# of Total Steps', value: step_length + human_steps} as eval_score);
                summary_draft.push({name: '# of Human Steps', value: human_steps} as eval_score);
                summary_draft.push({name: '# of Agent Steps', value: step_length} as eval_score);
                summary_draft.push({name: '# of Human Intervention', value: human_intervention_count} as eval_score);
                summary_draft.push({name: 'Last Step', value: 'agent'} as eval_score);
                
                const endTime = performance.now();
                console.log(`The task took ${endTime - startTime} milliseconds`);
                await detachDebugger(get().currentTask.tabId);
                await sleep (1);
                set((state) => {
                  state.currentTask.status = 'success';
                  state.settings.summary = summary_draft;
                });
                stopFlag = true;
                stopTimeoutFunction();
                return;
              }
              
              let decision: boolean = false; // default to auto-continue if error
              try {
                const filteredActions = previousActions.filter(
                  (pa) => !('error' in pa)
                ) as ParsedResponseSuccess[];
                
                logTimeEvent("Agent: Starting decision model query");
                const decisionResult = await determineUserInteractionDecision(
                  instructions,
                  filteredActions,
                  currententryfortaskhistory,
                  axtree_rep,
                  3,
                  onError,
                  screenshot || undefined
                );
                decision = decisionResult;
                // decision = true means ask_user (wait for feedback)
                // decision = false means agent_continue (auto-execute)
                // autoProceed = false means don't auto (wait), autoProceed = true means auto-execute
                // So we invert: autoProceed = !decision
                set((state) => { state.currentTask.autoProceed = !decision; });
                logTimeEvent(`Agent: Decision made - ${decision ? 'Ask User (wait for feedback)' : 'Auto Continue (execute immediately)'}`);
              } catch (e: any) {
                console.error('Decision model error, defaulting to wait-for-feedback:', e);
                logTimeEvent('Error: Decision model failed, defaulting to wait-for-feedback');
                set((state) => { state.currentTask.autoProceed = false; }); // wait-for-feedback
              }

              const autoProceed = get().currentTask.autoProceed;
              pauseRequested = get().currentTask.pauseRequested;
              currententryfortaskhistory.wasAutoExecuted = autoProceed; // Update last history entry with final decision
              currententryfortaskhistory.ask_for_confirmation_flag = pauseRequested;
              // If user has requested pause, go to observe mode
              if (pauseRequested) {
                console.log('firing pause, should start logging');
                set((state) => {
                  state.currentTask.pauseRequested = false;
                  state.currentTask.userDecision = 'reject';
                  const last = state.currentTask.history[state.currentTask.history.length - 1];
                  last.accept_flag = 'reject';
                });
                timeoutFunction(waitforfeedback);
                return;
              }
              set((state) => {
                state.currentTask.history.push(currententryfortaskhistory);
              });

              try {
                if (autoProceed) {
                  const lastEntry = get().currentTask.history[get().currentTask.history.length - 1];
                  const ifstepisexecuted = lastEntry ? lastEntry.counter : 0;
                  if (ifstepisexecuted == 0) {
                    // perform the action immediately
                    performdomoperation(action);
                  } else {
                    fetchmodelResponse(instructions);
                  }

                  // stop timeout loop since we're not waiting for feedback
                  stopFlag = true;
                  stopTimeoutFunction();
                  return;
                } else {
                  if (action.parsedAction.name !== 'goto' && action.parsedAction.name !== 'scroll') {
                    hintTooltip(action.parsedAction.args, action.parsedAction.name);
                  }
                  // Start the timeout function to wait for user input
                  timeoutFunction(waitforfeedback);
                }
              } catch (e) {
                console.error('Decision handling error', e);
                // On error, default to waiting for feedback (safer)
                if (action.parsedAction.name !== 'goto' && action.parsedAction.name !== 'scroll') {
                  hintTooltip(action.parsedAction.args, action.parsedAction.name);
                }
                timeoutFunction(waitforfeedback);
              }
            } finally {
              const agentElapsed = performance.now() - agentStartTime;
              set((state) => {
                state.currentTask.totalAgentTime += agentElapsed;
              });
            }  
          }

          async function waitforfeedback(): Promise<void> {
            //make stopFlag true if status is finished or interrupted
            if (get().currentTask.status === 'interrupted' || get().currentTask.status === 'error' ) {
              stopFlag = true;
              stopTimeoutFunction();
              const summary_draft = await GenerateErrorSummary();
              set((state) => {
                state.currentTask.tabId = -1;
                state.settings.summary = summary_draft;
              });
              return;
              // downloadTaskHistoryData(get().currentTask, get().ui.instructions, summary_draft);
            }
            const elapsedTime = performance.now() - (startTimeforTimeout ?? 0);
            const userdecision = get().currentTask.userDecision;
 
            // checking if the user pressed any shortcut
            // if (userdecision === 'idle') {
            //   chrome.runtime.sendMessage({
            //     type: 'getuserdecisionshortcut'
            //   }, async (response) => {
            //     if (response.reply !== null){
            //       console.log('found user decision', response);
            //       logTimeEvent(`User decision shortcut received: ${response.reply}`);
            //       startTimeforTimeout = performance.now();
            //       set((state) => {
            //         state.currentTask.userDecision = response.reply;});
            //       }
            //     });
            // }
            
            // mark the current action as critical which must acquire user confirmation
            // if (userdecision === 'askforconfirmation')
            // {
            //   startTimeforTimeout = performance.now();
            //   set((state) => {
            //     if (state.currentTask.history.length > 0) {
            //       state.currentTask.history[state.currentTask.history.length - 1].ask_for_confirmation_flag = true;
            //       // state.currentTask.totalHumanTime += elapsedTime;
            //     }
            //     state.currentTask.userDecision = 'idle';
            //   });
            //   return;
            // }

            if (userdecision === 'reject') {
              set((state) => {
                state.currentTask.totalHumanTime += elapsedTime;
                if (state.currentTask.history.length > 0) {
                  state.currentTask.history[state.currentTask.history.length - 1].accept_flag = 'reject';
                }
              });
              startTimeforTimeout = performance.now();
              
              // https://github.com/oaishi/annotation_pg/blob/main/Data_Annotation_Tool/src/pages/Content/index.ts
              // https://github.com/oaishi/annotation_pg/blob/50d76a811982b02f895ac4c77ef35ee13ca399c0/Data_Annotation_Tool/src/pages/Background/index.ts
              const humanActionStart = performance.now();
              chrome.runtime.sendMessage({
                type: 'fetchuserlogtosave'
              }, async (response) => {
                const humanActionElapsed = performance.now() - humanActionStart;
                  set((state) => {
                    state.currentTask.totalHumanTime += humanActionElapsed;
                });
                if (response.reply !== null){
                  // console.log("got user log info from background", response);
                  logTimeEvent("User: log received after rejection");
                  const user_log_metadata = response.reply as UserLogStructure;
                  const ax_tree = await fetch_page_accessibility_tree(false);
                  const img_data = await takeScreenshot();
                  user_log_metadata.AXTree = ax_tree;
                  user_log_metadata.Screenshot = img_data;
                  user_log_metadata.position = `{${user_log_metadata.coordinateX}, ${user_log_metadata.coordinateY}}`
                  
                  set((state) => {
                    if (state.currentTask.history.length > 0) {
                      state.currentTask.history[state.currentTask.history.length - 1].usersteps.push(user_log_metadata);
                    }
                  });
                 
                  if (save_data_to_server){
                    let trajectory_index = useAppState.getState().currentTask.history.length - 1;
                    const historyEntry = useAppState.getState().currentTask.history[trajectory_index];  
                    let userlog_flag = 0;
                    if (historyEntry && historyEntry.usersteps) {
                      userlog_flag = historyEntry.usersteps.length;
                    }
                    let userlogdata = {
                      _id: uuidv4(),
                      _uuid: relation_id,
                      _index: userlog_flag,
                      _time: performance.now(),
                      _corresponding_agent_tarjectory_id: trajectory_index,
                      _user_metadata: user_log_metadata
                    };
                  postdata(user_data_url, userlogdata); 
                  }
                }
              });
              return;
            }

            else if (userdecision === 'next') {
              stopFlag = true;
              stopTimeoutFunction();
              set((state) => {
                state.currentTask.userDecision = 'idle';
                state.currentTask.totalHumanTime += elapsedTime;
              });
              // user requested for the next step, so start model calling again
              await fetchmodelResponse(instructions);
              logTimeEvent("User: Agent resumed");
              return;
            }

            else if ((elapsedTime >= (wait_time_interval * 35)) || userdecision === 'accept') {
              stopFlag = true;
              stopTimeoutFunction();
              logTimeEvent("Agent: Suggestion accepted");
              set((state) => {
                state.currentTask.userDecision = 'idle';
                state.currentTask.totalAgentTime += elapsedTime;
                if (state.currentTask.history.length > 0) {
                  state.currentTask.history[state.currentTask.history.length - 1].accept_flag = 'accept';
                  const lastAction = state.currentTask.history[state.currentTask.history.length - 1].action;
                  if ('feedback' in lastAction) {
                    lastAction.feedback = 'accept';
                  }
                }
              });

              const ifstepisexecuted = get().currentTask.history[get().currentTask.history.length - 1].counter;
              if (ifstepisexecuted === 0) performdomoperation(action);
              else
              {
                // console.log('this step is already done');
                fetchmodelResponse(instructions); //recalling the model here again because the last step is already done
              }
              return;
            } 
          }
                  
          async function performdomoperation(action)
          {
            set((state) => {
              if (state.currentTask.history.length > 0) {
                state.currentTask.history[state.currentTask.history.length - 1].counter += 1;
              }
            });
            // console.log('user accepted feedback! will perform task now');
            const agentPerformStart = performance.now();
            logTimeEvent("Agent: Starting performdomoperation");
            setActionStatus('performing-action');
            const waitTime = performance.now();
            // rippleTime might be undefined if this is called before it's set, so use agentPerformStart instead
            // const rippleTimeToUse = rippleTime ?? agentPerformStart;
            // console.log(`Wait took: ${waitTime - rippleTimeToUse} milliseconds`);

            const noDebugger = await isDebuggerAttachedToCurrentWindow();
            if (noDebugger && get().currentTask.status === "running")
            {
              console.log('tab has changed.')
              const activeTab = (
                await chrome.tabs.query({ active: true, currentWindow: true })
                )[0];
                const tabId = activeTab.id;
                // console.log('attaching to:', tabId);
                if (typeof tabId === 'number'){
                  set((state) => {
                    state.currentTask.tabId = tabId;
                  });
                  await attachDebugger(tabId);
                }
              fetchmodelResponse(instructions);
              return;
            }
            
            let metadata: DomElementmetadata | undefined;
            if (action.parsedAction.name === 'click' 
                || action.parsedAction.name === 'hover'
                || action.parsedAction.name === 'scroll') {

              try
              {
                metadata = await callDOMAction(action.parsedAction.name, action.parsedAction.args);
              }
              catch (e: any) {
                logTimeEvent('Error: callDOMAction failed');
                metadata = undefined;
              } 
            } 
            else if (action.parsedAction.name === 'setvalue') {
              try
              {
                metadata = await callDOMAction(
                  action?.parsedAction.name,
                  action?.parsedAction.args
                  );
              }
              catch (e: any) {
                logTimeEvent('Error: callDOMAction failed');
                metadata = undefined;
              } 
            } 
            else if (action.parsedAction.name === 'goto') {
              try
              {
                metadata = await callDOMAction(
                  action?.parsedAction.name,
                  action?.parsedAction.args
                  );
              }
              catch (e: any) {
                logTimeEvent('Error: callDOMAction failed');
                metadata = undefined;
              } 
                
              const activeTab = (
                await chrome.tabs.query({ active: true, currentWindow: true })
                )[0];
                const tabId = activeTab.id;
                // console.log('attaching to:', tabId);
                if (typeof tabId === 'number'){
                  set((state) => {
                    state.currentTask.tabId = tabId;
                  });
                  await attachDebugger(tabId);
                }
            }
                
            const actionTime = performance.now();
            console.log(`Action took: ${actionTime - waitTime} milliseconds`);
                
            if (wasStopped()) return;
                  
            // While testing let's automatically stop after 50 actions to avoid infinite loops
            if (get().currentTask.history.length >= 50) {
              set((state) => {
                state.currentTask.status = 'error';
              });
              logTimeEvent('Error: auto stopping when more than 50 actions are performed.')
              return;
            }

            // let img_data = '';
            // try
            // {
            //   img_data = await takeScreenshot()
            // }
            // catch (e: any) {
            //   // console.log('screenshot not working');
            //   logTimeEvent('Error: screenshot not working');
            // } 
            
            set((state) => {
              if (state.currentTask.history.length > 0) {
                const lastEntry = state.currentTask.history[state.currentTask.history.length - 1];
                if (metadata) {
                  lastEntry.metadata = metadata;
                  // lastEntry.metadata.Screenshot = img_data;
                } else {
                  // If metadata is undefined, at least initialize it with the screenshot
                  if (!lastEntry.metadata) {
                    // Initialize with minimal metadata if it doesn't exist
                    lastEntry.metadata = {
                      DOM: '',
                      AXTree: '',
                      Screenshot: '',
                      action_type: action.parsedAction.name,
                      position: '',
                      nodeID: -1,
                      URL: ''
                    };
                  } /*else {
                    lastEntry.metadata.Screenshot = img_data;
                  }*/
                }
              }
            });
            const agentPerformElapsed = performance.now() - agentPerformStart;
            set((state) => {
              state.currentTask.totalAgentTime += agentPerformElapsed;
            });
            logTimeEvent("Agent: Finished performdomoperation");
            
            await sleep(50);
            const history = get().currentTask.history;
            const pauseRequested = get().currentTask.pauseRequested;

            if (pauseRequested) {
              console.log('firing pause, should start logging');
              set((state) => {
                state.currentTask.pauseRequested = false; // consume pause
                state.currentTask.userDecision = 'reject';
                if (state.currentTask.history.length > 0) {
                  const last = state.currentTask.history[state.currentTask.history.length - 1];
                  last.accept_flag = 'reject';
                  last.ask_for_confirmation_flag = true;
                }
              });
              timeoutFunction(waitforfeedback);
            } else if (history.length > 0) {
              const count = history[history.length - 1].counter;
              // to prevent repetitive call to OpenAI
              // sometimes there is error in the call, hence recalling the function
              if (count < 2) 
              {
                fetchmodelResponse(instructions);
              }
            }
          }
          
          // 🟩 GPT-based decision is now made inside fetchmodelResponse() after getting context
          // Decision happens after AX tree and previous actions are available
          fetchmodelResponse(instructions);

        } catch (e: any) {
          onError(e.message);
          set((state) => {
            state.currentTask.status = 'error';
            if (get().currentTask.tabId !== -1)
            {
              detachDebugger(get().currentTask.tabId);
              set((state) => {
                state.currentTask.tabId = -1;
                state.settings.summary = []; //summary_draft;
              });
              downloadTaskHistoryData(get().currentTask, get().ui.instructions, []);
            }
            state.currentTask.tabId = -1;
          });
        } finally {
          await reenableExtensions();
        }
      },
      finishwithfailure: async () => {
        set((state) => {
          state.currentTask.status = 'interrupted';
        });
        const history = get().currentTask.history;
        const historylength = get().currentTask.history.length;
        if (historylength > 0 && 
          history[historylength-1].usersteps.length > 0 && 
          history[historylength-1].filteredusersteps === undefined) {
          const mergedResult = await mergeUserAction(get().currentTask.history[historylength - 1]);
          // console.log('mergedResult', mergedResult);
          set((state) => {
            state.currentTask.history[historylength - 1].filteredusersteps = mergedResult;
          });
          // console.log('update check', get().currentTask.history[historylength-1].filteredusersteps);
          await sleep(1);
        }
        if (get().currentTask.tabId !== -1)
        {
          detachDebugger(get().currentTask.tabId);
          let summary_draft: eval_score[] = [];
          const taskHistory = get().currentTask.history as TaskHistoryEntry[];
          const totalAgentTime = get().currentTask.totalAgentTime;
          const totalHumanTime = get().currentTask.totalHumanTime;
          let human_steps = 0;
          let step_accuracy = 0;
          let human_intervention_count = 0;
          taskHistory.forEach((entry) => { 
            human_steps += (entry.filteredusersteps?.match(new RegExp('thought', 'g')) || []).length;
            if (entry.usersteps.length > 0) human_intervention_count+= 1;
            if (entry.accept_flag === 'accept') step_accuracy += 1;
          });
          summary_draft.push({name: 'Answer', value: ''});
          summary_draft.push({name: 'End-to-end success', value: 0.0} as eval_score);
          summary_draft.push({name: 'Step Accuracy', value: step_accuracy/taskHistory.length} as eval_score);
          summary_draft.push({name: '# of Total Steps', value: taskHistory.length + human_steps} as eval_score);
          summary_draft.push({name: '# of Human Steps', value: human_steps} as eval_score);
          summary_draft.push({name: '# of Agent Steps', value: taskHistory.length} as eval_score);
          // summary_draft.push({name: 'Total Time', value: totalAgentTime+totalHumanTime} as eval_score);
          // summary_draft.push({name: 'Total Human Time', value: totalHumanTime} as eval_score);
          // summary_draft.push({name: 'Total Agent Time', value: totalAgentTime} as eval_score);
          summary_draft.push({name: '# of Human Intervention', value: human_intervention_count} as eval_score);
          summary_draft.push({name: 'Last Step', value: 'Human'} as eval_score);
          // let workflowsummary = await mergeCommonAction(taskHistory);
          // summary_draft.push({name: 'workflow', value: workflowsummary?.response} as eval_score);
          // downloadTaskHistoryData(get().currentTask, get().ui.instructions, summary_draft);
          set((state) => {
            state.currentTask.tabId = -1;
            // state.currentTask.history = [];
            state.settings.summary = summary_draft;
          });
        }
      },
      finishwithsuccess: async () => {
        set((state) => {
          state.currentTask.status = 'interrupted';
        });
        const history = get().currentTask.history;
        const historylength = get().currentTask.history.length;
        if (historylength > 0 && 
          history[historylength-1].usersteps.length > 0 && 
          history[historylength-1].filteredusersteps === undefined) {
          const mergedResult = await mergeUserAction(get().currentTask.history[historylength - 1]);
          // console.log('mergedResult', mergedResult);
          set((state) => {
            state.currentTask.history[historylength - 1].filteredusersteps = mergedResult;
          });
          // console.log('update check', get().currentTask.history[historylength-1].filteredusersteps);
          await sleep(1);
        }
        if (get().currentTask.tabId !== -1)
        {
          detachDebugger(get().currentTask.tabId);
          let summary_draft: eval_score[] = [];
          const taskHistory = get().currentTask.history as TaskHistoryEntry[];
          let human_steps = 0;
          let step_accuracy = 0;
          let human_intervention_count = 0;
          taskHistory.forEach((entry) => { 
            // human_steps += entry.usersteps.length;
            human_steps += (entry.filteredusersteps?.match(new RegExp('thought', 'g')) || []).length;
            if (entry.usersteps.length > 0) human_intervention_count+= 1;
            if (entry.accept_flag === 'accept') step_accuracy += 1;
          });
          summary_draft.push({name: 'Answer', value: ''});
          summary_draft.push({name: 'End-to-end success', value: 1.0} as eval_score);
          summary_draft.push({name: 'Step Accuracy', value: step_accuracy/taskHistory.length} as eval_score);
          summary_draft.push({name: '# of Total Steps', value: taskHistory.length + human_steps} as eval_score);
          summary_draft.push({name: '# of Human Steps', value: human_steps} as eval_score);
          summary_draft.push({name: '# of Agent Steps', value: taskHistory.length} as eval_score);
          summary_draft.push({name: '# of Human Intervention', value: human_intervention_count} as eval_score);
          summary_draft.push({name: 'Last Step', value: 'Human'} as eval_score);
          // let workflowsummary = await mergeCommonAction(taskHistory);
          // summary_draft.push({name: 'workflow', value: workflowsummary?.response} as eval_score);

          // downloadTaskHistoryData(get().currentTask, get().ui.instructions, summary_draft);
          set((state) => {
            state.currentTask.tabId = -1;
            // state.currentTask.history = [];
            state.settings.summary = summary_draft;
          });
          
        }
      },
      RunNextStep: () => {
        set((state) => {
          state.currentTask.userDecision = 'next';
        });
      },
      accept: () => {
        set((state) => {
          state.currentTask.userDecision = 'accept';
        });
      },
      reject: () => {
        set((state) => {
          state.currentTask.userDecision = 'reject';
        });
      },
      pause: () => {
        set((state) => {
          state.currentTask.pauseRequested = true;
        });
      },
      initiate: () => {
        set((state) => {
          state.currentTask.status = 'running';
          state.currentTask.UniqueIDperTask = uuidv4();
          state.currentTask.history = [];
        });
      },
      markascriticalstep: () => {
        set((state) => {
          state.currentTask.userDecision = 'askforconfirmation';
        });
      },
      DownloadData: () => {
        downloadTaskHistoryData(get().currentTask, get().ui.instructions, get().settings.summary);
        sleep(100);
        set((state) => {
          state.currentTask.history = [];
          state.settings.summary = [];
        });
      }
    },
  });

// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message.type === "debugger_detached") {
//       console.log("Debugger was detached! Updating UI...");
//       // Perform any necessary UI updates here
//   }
// });
    