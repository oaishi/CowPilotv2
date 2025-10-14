import {
  Configuration,
  CreateCompletionResponseUsage,
  OpenAIApi,
} from 'openai';
import { useAppState } from '../state/store';
import { availableActions } from './availableActions';
import { ParsedResponseSuccess } from './parseResponse';

const formattedActions = availableActions
  .map((action, i) => {
    const args = action.args
      .map((arg) => `${arg.name}: ${arg.type}`)
      .join(', ');
    return `${i + 1}. ${action.name}(${args}): ${action.description}`;
  })
  .join('\n');

const systemMessage = `
You are an autonomous intelligent agent tasked with navigating a web browser.
You will be given web-based tasks. These tasks will be accomplished through the use of specific actions you can issue.
Here's the information you'll have:
Task: This is the task you're trying to complete.
Current page contents: This is a simplified representation of the webpage, providing key information.
Previous actions: This is the action you and the user performed. It may be helpful to track your progress and user intention.

You can use the following tools:
${formattedActions}
To be successful, it is very important to follow the following rules:
1. You should only issue an action that is valid given the current page contents.
2. You should only issue one action at a time.
3. You should follow the examples to reason step by step and then issue the next action.
4. You must always include BOTH the <Thought></Thought> and <Action></Action> tags or else your response will be marked as invalid.
5. The past history will include user trajectory as well. If the user rejected some of your past actions, do not execute those again. Your next action must be aware of what the user has done as well. For example, let's say you failed to locate a product user wants to add to cart. Hence, the user pauses your execution and finds the product by using search input box. So, your next action would be then to just add the product user picked to the cart.
	"examples": [
		(
			"""Current page contents:
[1744] link 'HP CB782A#ABA 640 Inkjet Fax Machine (Renewed)'
		[1749] StaticText '$279.49'
		[1757] button 'Add to Cart'
		[1760] button 'Add to Wish List'
		[1761] button 'Add to Compare'
Task: What is the price of HP Inkjet Fax Machine
Previous Action: """,
			"<Thought>Let's think step-by-step. This page list the information of HP Inkjet Fax Machine, which is the product identified in the objective. Its price is $279.49. I think I have achieved the objective. I will issue the stop action with the answer.</Thought><Action>finishwithanswer("$279.49")</Action>
		),
		(
			"""Current page contents:
[164] textbox 'Search' focused: True required: False
[171] button 'Go'
[174] link 'Find directions between two points'
[212] heading 'Search Results'
[216] button 'Close'
Task: Show me the restaurants near CMU
Previous Action: """,
			"<Thought>Let's think step-by-step. This page has a search box whose ID is [164]. According to the nominatim rule of openstreetmap, I can search for the restaurants near a location by \"restaurants near\". I can submit my typing by pressing the Enter afterwards.</Thought><Action>setvalue(164, "restaurants near CMU")</Action>,
		),
	],
}`;
const systemMessageOld = `
You are a browser automation assistant.

You can use the following tools:

${formattedActions}

You will be be given a task to perform and the current state of the DOM. You will also be given previous actions that you have taken and user feedback on your actions. You may retry a failed action up to one time.

This is an example of an action:

<Thought>I should click the add to cart button</Thought>
<Action>click(223)</Action>

You must always include the <Thought> and <Action> open/close tags or else your response will be marked as invalid.`;

export async function determineNextAction(
  taskInstructions: string,
  previousActions: ParsedResponseSuccess[],
  simplifiedDOM: string,
  maxAttempts = 3,
  notifyError?: (error: string) => void
) {
  const model = useAppState.getState().settings.selectedModel;
  const prompt = formatPrompt(taskInstructions, previousActions, simplifiedDOM);
  const key = useAppState.getState().settings.openAIKey;
  if (!key) {
    notifyError?.('No OpenAI key found');
    return null;
  }

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
            content: systemMessage,
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
              content: systemMessage,
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 500,
          temperature: 0,
          stop: ['</Action>'],
        });

        const responseContent = completion.data.choices[0].message?.content?.trim();
        if (responseContent?.toLowerCase().includes('<action>')) {
            return {
                usage: completion.data.usage,
                prompt,
                response: responseContent + '</Action>',
            };
        }
        console.log('Retrying due to missing <Action> tag...');
      } catch (error: any) {
        console.log('determineNextAction error', error);
        if (error.response.data.error.message.includes('server error')) {
          // Problem with the OpenAI API, try again
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

export function formatPrompt(
  taskInstructions: string,
  previousActions: ParsedResponseSuccess[],
  pageContents: string
) {
  let previousActionsString = '';

  if (previousActions.length > 0) {
    // const serializedActions = previousActions
    //   .map(
    //     (action) =>
    //       `<Thought>${action.thought}</Thought>\n<Action>${action.action}</Action>` // \n<Feedback>${action.feedback}</Feedback>`
    //   )
    //   .join('\n');
    
    const actionString = previousActions.map(action => {
      const agentaction = `<Thought>${action.thought}</Thought>\n<Action>${action.action}</Action>`;
      const jsonObjects = JSON.parse(action.filteredusersteps || '[]');
      console.log('action.filteredusersteps', action.filteredusersteps);
      let userlogaction = '';
      if (jsonObjects.length != 0) userlogaction += 'The user rejected the last action and performed the following actions:'
      for (const item of jsonObjects) {
        userlogaction += `\n<Thought>${item.thought}</Thought>\n<Action>${item.action}</Action>`
        console.log(item.thought, item.action);
      }
      return `${agentaction}${userlogaction}`;
    }).join('\n');
    console.log('actionString with user log', actionString);
    previousActionsString = `${actionString}`;
  }
  console.log('previous', previousActionsString);
  return `The user requests the following task: ${taskInstructions}
Current page contents: ${pageContents}
Previous actions: ${previousActionsString}`;
}
