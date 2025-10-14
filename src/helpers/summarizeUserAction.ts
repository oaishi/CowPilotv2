import {
    Configuration,
    CreateCompletionResponseUsage,
    OpenAIApi,
  } from 'openai';
import { TaskHistoryEntry } from '../state/currentTask';
import { useAppState } from '../state/store';
  
const systemMessage = `You will be shown a list to HTML eventlistener logdata of the following format:
  \`export interface EventLogStructure{
      action_type: string; // event type (click/scroll/keyup/input/KeyboardEvent/mouseover/contextmenu)
      nodeID?: string; // if set, unique ID of the element acted on 
      elementName?: string;
      DOM?: string;
      elementouterHTML?: string; 
      AXTree?: string; // accessibility tree of the HTML page
      Screenshot?: string;
      coordinateX?: number;
      coordinateY?: number;
      clickType?: string;
      position?: string;
      URL?: string; // URL of the current page whre the events are taking place
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
      urldata?: { // when new tab is opened, the information of the new url and tab id
          url_name: string;
          tab_id: number;
      };
  }\`
  
  Your task is to clean up the raw event data and make a clean list of available actions in the following format:
  \`export const availableActions = [
    {
      name: 'click',
      description: 'Clicks on an element',
      args: [
        {
          name: 'elementId',
          type: 'number',
        },
      ],
    },
    {
      name: 'hover',
      description: 'Hover the mouse on an element',
      args: [
        {
          name: 'elementId',
          type: 'number',
        },
      ],
    },
    {
      name: 'setValue',
      description: 'Focuses on and sets the value of an input element',
      args: [
        {
          name: 'elementId',
          type: 'number',
        },
        {
          name: 'value',
          type: 'string',
        },
      ],
    },
    {
      name: 'goto',
      description: 'Navigate to a specific URL',
      args: [
        {
          name: 'url',
          type: 'string',
        },
      ],
    },
  ] as const;\`
  
  Rules:
  1. Try to merge consecutive UserLogStructure whenever possible. For example, you are merge multiple keyup actions in the same input field as a setvalue event. For consecutive input in a textbox, always pick the final one. For example, 1) setValue(1, 'Hello') 2) setValue (1, 'Hello world') can be merged into a single action setValue (1, 'Hello world')
  2. If there's repetitive user actions of the same type in the same place, feel free to discard duplicates. This might specially be true for scroll and mouseover event. For example: two consecutive scrolls in the same direction can be merged. Or, a random, disjoint scroll can be a noise to be ignored.
  3. Only reply with availableActions.name(args) format. Do not write any code.
  4. Mouseover user log can often be noisy, only add this to the final list if it is meaningful with the rest of the action trajectory in prior and after the mouseover event. For example, a mouseover while tying into a textfield is not useful and can be discarded.
  5. Your response must follow json format: [{"thought": short summary of the action, "action": your generated action}].`;

const systemConcatMessage = `You will be shown a list of logdata. Your task is to clean up the raw event data and make a clean list of available actions in the following format:
  \`export const availableActions = [
    {
      name: 'click',
      description: 'Clicks on an element',
      args: [
        {
          name: 'elementId',
          type: 'number',
        },
      ],
    },
    {
      name: 'hover',
      description: 'Hover the mouse on an element',
      args: [
        {
          name: 'elementId',
          type: 'number',
        },
      ],
    },
    {
      name: 'setValue',
      description: 'Focuses on and sets the value of an input element',
      args: [
        {
          name: 'elementId',
          type: 'number',
        },
        {
          name: 'value',
          type: 'string',
        },
      ],
    },
    {
      name: 'goto',
      description: 'Navigate to a specific URL',
      args: [
        {
          name: 'url',
          type: 'string',
        },
      ],
    },
  ] as const;\`
  
  Rules:
  1. Try to merge consecutive UserLogStructure whenever possible. For example, you are merge multiple keyup actions in the same input field as a setvalue event. For consecutive input in a textbox, always pick the final one. For example, 1) setValue(1, 'Hello') 2) setValue (1, 'Hello world') can be merged into a single action setValue (1, 'Hello world')
  2. If there's repetitive user actions of the same type in the same place, feel free to discard duplicates. This might specially be true for scroll and mouseover event. For example: two consecutive scrolls in the same direction can be merged. Or, a random, disjoint scroll can be a noise to be ignored.
  3. Only reply with availableActions.name(args) format. Do not write any code.
  4. Mouseover user log can often be noisy, only add this to the final list if it is meaningful with the rest of the action trajectory in prior and after the mouseover event. For example, a mouseover while tying into a textfield is not useful and can be discarded.
  5. Your response must follow json format: [{"thought": short summary of the action, "action": your generated action}].
  6. In your thought summary, make sure to mention the implication of the action. For example, instead of saying the user clicked on the start time, say the user clicked on the start time and set it to 9 pm.`;

const workflowMessage = `Given a web navigation goal, your task is to extract the common workflows.
Each given task contains a natural language instruction, and a series of actions to solve the task.
You need to find the repetitive subset of actions across multiple tasks, and extract each of them out as a workflow.
Each workflow should be a commonly reused sub-routine of the tasks. Do not generate similar or overlapping workflows.
Each workflow should have at least two steps. Represent the non-fixed elements (input text, button strings) with descriptive variable names as shown in the example.`;

export async function mergeUserAction(
    taskHistoryEntry: TaskHistoryEntry,
    chunkSize = 4,
) {
    const userLogEntries = formatUserLogEntries(taskHistoryEntry);
    if (userLogEntries.length == 0) return '[]';
    let filteredUserAction: {key: string}[] = [];
    for (let i = 0; i < userLogEntries.length; i += chunkSize) {
        const chunk = userLogEntries.slice(i, i + chunkSize);
        const chunkString = chunk.join('\n');
        const modelResponse = await fetchmodelResponse(chunkString);
        console.log('modelResponse', modelResponse);
        const convertedActions = extractJsonObjects(modelResponse?.response || '');
        console.log('convertedActions', convertedActions);
        // ToDo: filter when you are merging them
        filteredUserAction = filteredUserAction.concat(convertedActions);
    }
    const modelResponse = await fetchmodelResponse(JSON.stringify(filteredUserAction), systemConcatMessage);
    console.log('modelResponse', modelResponse);
    // const convertedActions = extractJsonObjects(modelResponse?.response || '');
    return extractsubstring(modelResponse?.response || '');
}

// ToDo: The following function is useful to design workflow following https://arxiv.org/abs/2409.07429
export async function mergeCommonAction(
  taskHistoryEntry: TaskHistoryEntry[]
) {
  let trajectorylog = '';
  let counter = 0;
  for (let i = 0; i < taskHistoryEntry.length; i += 1) {
    counter += 1;
    let thought = taskHistoryEntry[i].action.thought;
    let action = taskHistoryEntry[i].action.action;
    trajectorylog += '\n-' + 'Actor: Agent' + thought + action + 'User decision: accept';
    if (taskHistoryEntry[i].filteredusersteps) trajectorylog += '\n-' + 'Actor: User' + taskHistoryEntry[i].filteredusersteps;
  }
  return fetchmodelResponse(trajectorylog, workflowMessage);
}

function extractsubstring(text: string) {
  const startIndex = text.indexOf('[');
  const endIndex = text.lastIndexOf(']');
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const substring = text.substring(startIndex-1, endIndex+1);
      return substring;
  } else {
      console.error("Failed to locate valid JSON markers");
      return undefined;
  }
}
function extractJsonObjects(text: string) {
    const startIndex = text.indexOf('[');
    const endIndex = text.lastIndexOf(']');
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        const jsonString = text.substring(startIndex-1, endIndex + 1);
        try {
            return JSON.parse(jsonString);
        } catch (e) {
            console.error("Failed to parse JSON:", e);
        }
    } else {
        console.error("Failed to locate valid JSON markers");
    }
    return [];
 }

async function fetchmodelResponse(
    prompt: string,
    system_prompt = systemMessage,
    maxAttempts = 3,
    notifyError?: (error: string) => void
) {
    const model = useAppState.getState().settings.selectedModel;
    // https://llm.mlc.ai/docs/deploy/rest.html
    if (model === 'mlc-mistral')
    {
      // call local host
  
      type Message = {
        role: string;
        content: string;
      };
  
      type Payload = {
        model: string;
        messages: Message[];
        stream: boolean;
      };
  
      // Function to perform a POST request
      async function postRequest(url: string, payload: Payload): Promise<any> {
          try {
              const response = await fetch(url, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(payload),
              });
              const data = await response.json();
              return data;
          } catch (error) {
              console.error('Error:', error);
          }
      }
  
      // Function to perform a GET request
      async function getRequest(url: string): Promise<any> {
          try {
              const response = await fetch(url);
              const data = await response.json();
              return data;
          } catch (error) {
              console.error('Error:', error);
          }
      }
  
      const payloadforNextAction: Payload = {
          model: "mlc-ai/Mistral-7B-Instruct-v0.2-q3f16_1-MLC",
          messages: [
            {
              role: 'system',
              content: system_prompt,
            },
            { role: 'user', content: prompt },
          ],
          stream: false,
      };
  
      console.log(systemMessage + prompt);
      
      // Get the latest runtime stats
      getRequest("http://127.0.0.1:8000/stats")
          .then(data => {
              console.log("Runtime stats:", data, "\n");
          });
  
      for (let i = 0; i < maxAttempts; i++) {
        try {
  
          const resetResponse = await postRequest("http://127.0.0.1:8000/chat/reset", payloadforNextAction);
          console.log("Reset chat:", resetResponse, "\n");
  
          // Await the completion of the postRequest call for completions
          const data = await postRequest("http://127.0.0.1:8000/v1/chat/completions", payloadforNextAction);
          console.log("mlc response:\n", data?.choices[0]?.message?.content, "\n");
  
          const completionUsage = {
              prompt_tokens: systemMessage?.split(" ").length + prompt?.split(" ").length,
              completion_tokens: data?.choices[0]?.message?.content?.split(" ").length,
              total_tokens: systemMessage?.split(" ").length + 
                            prompt?.split(" ").length +
                            data?.choices[0]?.message?.content?.split(" ").length
          };
  
          return {
            usage: completionUsage,
            prompt,
            response:
            data?.choices[0]?.message?.content?.trim() + '</Action>',
          };
  
        } catch (error: any) {
          console.log('determineNextAction error', error);
          if (error.response.data.error.message.includes('server error')) {
            // Problem with the Rest API, try again
            if (notifyError) {
              notifyError(error.response.data.error.message);
            }
          } else {
            // Another error, give up
            throw new Error(error.response.data.error.message);
          }
        }
      }
      throw new Error(
        `Failed to complete query after ${maxAttempts} attempts. Please try again later.`
      );
  
    }
    else
    {
        const key = useAppState.getState().settings.openAIKey;
        if (!key) {
            notifyError?.('No OpenAI key found');
            return null;
        }
        let configuration;
        if (model.startsWith('neulab')){
          configuration = new Configuration({
              apiKey: key,
              basePath: 'https://cmu.litellm.ai'
          });
        }
        else
        {
          configuration = new Configuration({
            apiKey: key,
          });
        }
        // https://github.com/openai/openai-node/issues/6#issuecomment-1492814621
        delete configuration.baseOptions.headers['User-Agent'];
        const openai = new OpenAIApi(configuration);
  
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const completion = await openai.createChatCompletion({
            model: model,
            messages: [
              {
                role: 'system',
                content: system_prompt,
              },
              { role: 'user', 
                content: prompt },
            ],
            temperature: 0,
          });
    
          return {
            usage: completion.data.usage as CreateCompletionResponseUsage,
            prompt,
            response:
              completion.data.choices[0].message?.content?.trim(),
          };
        } catch (error: any) {
          console.log('error in cleaning up user log', error);
          if (error.response.data.error.message.includes('server error')) {
            if (notifyError) {
              notifyError(error.response.data.error.message);
            }
          } else {
            // Another error, give up
            throw new Error(error.response.data.error.message);
          }
        }
      }
      throw new Error(
        `Failed to complete query after ${maxAttempts} attempts. Please try again later.`
      );
    }
}

export function formatUserLogEntries(taskHistoryEntry: TaskHistoryEntry) {
    let taskHistoryEntryStrings: string[] = [];
    if (taskHistoryEntry.usersteps.length > 0) {
    taskHistoryEntryStrings = taskHistoryEntry.usersteps.map((userlog): string => {
        // Deconstruct userlog, omitting Screenshot and DOM
        const {
        action_type,
        nodeID,
        elementName,
        elementouterHTML,
        AXTree,
        coordinateX,
        coordinateY,
        clickType,
        position,
        URL,
        scrollData,
        keyData,
        urldata
        } = userlog;

        // Construct the string representation manually, excluding Screenshot and DOM
        return `{
        action_type: ${action_type || undefined},
        nodeID: ${nodeID || undefined},
        elementName: ${elementName || undefined},
        elementouterHTML: ${elementouterHTML || undefined},
        AXTree: ${AXTree || undefined},
        coordinateX: ${coordinateX ?? undefined},
        coordinateY: ${coordinateY ?? undefined}),
        clickType: ${clickType || undefined},
        position: ${position || undefined},
        URL: ${URL || undefined},
        scrollData: ${scrollData ? JSON.stringify(scrollData) : undefined},
        keyData: ${keyData ? JSON.stringify(keyData) : undefined},
        urldata: ${urldata ? JSON.stringify(urldata) : undefined},
        }`;
    });
    }
    return taskHistoryEntryStrings;
}
  