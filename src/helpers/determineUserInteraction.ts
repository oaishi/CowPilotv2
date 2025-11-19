import {
  Configuration,
  OpenAIApi,
} from 'openai';
import { useAppState } from '../state/store';
import { ParsedResponseSuccess } from './parseResponse';
import { TaskHistoryEntry } from '../state/currentTask';
import { per_cluster_intervention_pattern } from '../constants';

// System message based on evaluate_model.py construct_baseline_prompt_zero_shot
const systemMessage = `You are a copilot helping an user in web navigation.`+
`You act in behalf of the user and you will ask the user what to do next when it is appropriate.`+
`If you don't ask, the user won't intervene and you will continue the proposed action.`+
`Typically people intervene primarily for 1) error correction/recovery; 2) preference misalignment; and 3) assistive intervention for complex tasks.`+
`The task, previous actions, proposed action, current webpage observation, and a screenshot of the webpage are shown below.`+
`You will also be given a short description of the typical intervention pattern of this particular user.`+
`You can use the intervention pattern as a cue to personalize the prediction for them.`+
`Think if you would need to ask for confirmation the user at this point to continue the proposed action, and respond with your reasoning.`+
`Make sure to include the final decision in the form of <ask_user> or <agent_continue>.`;

export function formatDecisionPrompt(
  taskInstructions: string,
  previousActions: ParsedResponseSuccess[],
  proposedAction: TaskHistoryEntry,
  pageContents: string,
  interventionPattern: string,
  screenshot?: string
): string {
  let previousActionsString = '';

  if (previousActions.length > 0) {
    const actionString = previousActions.map((action, index) => {
      const agentaction = `Action ${index + 1} (Agent): <Thought>${action.thought}</Thought>\n<Action>${action.action}</Action>`;
      let userlogaction = '';
      
      // Parse user steps if they exist
      if (action.filteredusersteps) {
        try {
          const jsonObjects = JSON.parse(action.filteredusersteps || '[]');
          if (jsonObjects.length > 0) {
            userlogaction += '\nThe user rejected the last action and performed the following actions:';
            for (const item of jsonObjects) {
              userlogaction += `\n<Thought>${item.thought}</Thought>\n<Action>${item.action}</Action>`;
            }
          }
        } catch (e) {
          // If parsing fails, ignore user steps
          console.log('Error parsing user steps:', e);
        }
      }
      
      return `${agentaction}${userlogaction}`;
    }).join('\n\n');
    
    previousActionsString = `PAST ACTIONS:\n\n${actionString}`;
  } else {
    previousActionsString = 'PAST ACTIONS:\n\n(No previous actions)';
  }

  const proposedActionString = `PROPOSED ACTION:\n<Thought>${(proposedAction.action as ParsedResponseSuccess).thought}</Thought>\n<Action>${(proposedAction.action as ParsedResponseSuccess).action}</Action>`;
  const screenshotNote = screenshot ? '\n\nSCREENSHOT: A screenshot of the current webpage is provided in the image below. Use it to better understand the visual context of the page.' : '';
  
  return `INTENT: ${taskInstructions}
INTERVENTION STYLE OF THIS USER: ${interventionPattern}
${previousActionsString}
${proposedActionString}

ACCESSIBILITY TREE OF CURRENT STEP:
${pageContents}${screenshotNote}`;
}

export function parseDecisionResponse(response: string): boolean {
  /**
   * Parse the GPT response to determine if we should ask user or continue automatically.
   * Based on evaluate_model.py parse_prediction function.
   * 
   * Returns:
   *   true = ask_user (wait for human feedback)
   *   false = agent_continue (auto-execute)
   */
  if (!response) {
    return true; // Default to asking user if response is empty
  }

  const normalizedResponse = response.toLowerCase().trim();

  // Look for <ask_user> tag
  if (normalizedResponse.includes('<ask_user>')) {
    return true; // Ask user
  }

  // Look for <agent_continue> tag
  if (normalizedResponse.includes('<agent_continue>')) {
    return false; // Auto-continue
  }

  // If neither tag is found, default to asking user (safer option)
  console.log('Warning: Decision response did not contain <ask_user> or <agent_continue>, defaulting to ask_user');
  return true;
}

export async function determineUserInteractionDecision(
  taskInstructions: string,
  previousActions: ParsedResponseSuccess[],
  proposedAction: TaskHistoryEntry,
  simplifiedDOM: string,
  maxAttempts = 3,
  notifyError?: (error: string) => void,
  screenshot?: string
): Promise<boolean> {
  const model = useAppState.getState().settings.selectedModel;
  const usergroup = useAppState.getState().settings.selectedUserGroup;
  const prompt = formatDecisionPrompt(taskInstructions, previousActions, proposedAction, simplifiedDOM, per_cluster_intervention_pattern[Number(usergroup)] ?? '', screenshot);
  const key = useAppState.getState().settings.openAIKey;
  
  if (!key) {
    notifyError?.('No OpenAI key found for decision model');
    // Default to asking user if no API key
    return true;
  }

  // Handle mlc-mistral model (same pattern as determineNextAction)
  if (model === 'mlc-mistral') {
    type Message = {
      role: string;
      content: string;
    };

    type Payload = {
      model: string;
      messages: Message[];
      stream: boolean;
    };

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
        throw error;
      }
    }

    const payloadforDecision: Payload = {
      model: "mlc-ai/Mistral-7B-Instruct-v0.2-q3f16_1-MLC",
      messages: [
        {
          role: 'system',
          content: systemMessage,
        },
        { role: 'user', content: prompt },
      ],
      stream: false,
    };

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const resetResponse = await postRequest("http://127.0.0.1:8000/chat/reset", payloadforDecision);
        console.log("Decision model reset chat:", resetResponse);

        const data = await postRequest("http://127.0.0.1:8000/v1/chat/completions", payloadforDecision);
        const responseText = data?.choices[0]?.message?.content?.trim() || '';
        
        console.log("Decision model response:", responseText);
        return parseDecisionResponse(responseText);
      } catch (error: any) {
        console.log('determineUserInteractionDecision error (mlc-mistral):', error);
        if (i === maxAttempts - 1) {
          // Last attempt failed, default to asking user
          notifyError?.('Decision model failed, defaulting to ask user');
          return true;
        }
      }
    }
    
    // If all attempts failed, default to asking user
    return true;
  } else {
    // Handle OpenAI API (main path)
    let configuration;
    if (model.startsWith('neulab')) {
      configuration = new Configuration({
        apiKey: key,
        basePath: 'https://cmu.litellm.ai'
      });
    } else {
      configuration = new Configuration({
        apiKey: key,
      });
    }
    
    // https://github.com/openai/openai-node/issues/6#issuecomment-1492814621
    delete configuration.baseOptions.headers['User-Agent'];
    const openai = new OpenAIApi(configuration);

    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Prepare user content - include image if screenshot is provided
        let userContent: any = prompt;
        if (screenshot) {
          // For vision models, content should be an array with text and image
          userContent = [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${screenshot}`,
              },
            },
          ];
        }

        const completion = await openai.createChatCompletion({
          model: model,
          messages: [
            {
              role: 'system',
              content: systemMessage,
            },
            { role: 'user', content: userContent },
          ],
          max_tokens: 500,
          temperature: 0,
        });

        const responseContent = completion.data.choices[0].message?.content?.trim() || '';
        console.log('Decision model response:', responseContent);
        
        return parseDecisionResponse(responseContent);
      } catch (error: any) {
        console.log('determineUserInteractionDecision error:', error);
        
        if (error.response?.data?.error?.message?.includes('server error')) {
          // Problem with the OpenAI API, try again
          if (notifyError && i === maxAttempts - 1) {
            notifyError(error.response.data.error.message);
          }
        } else {
          // Another error, default to asking user on last attempt
          if (i === maxAttempts - 1) {
            console.log('Decision model failed after all attempts, defaulting to ask user');
            return true; // Default to asking user if all attempts fail
          }
        }
      }
    }
    
    // If all attempts failed, default to asking user (safer option)
    return true;
  }
}

