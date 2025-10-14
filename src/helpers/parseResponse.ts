import { ActionPayload, availableActions } from './availableActions';

export type ParsedResponseSuccess = {
  thought: string;
  action: string;
  parsedAction: ActionPayload;
  filteredusersteps: string;
  feedback?: string;
};

export type ParsedResponse =
  | ParsedResponseSuccess
  | {
    error: string;
  };

export function parseResponse(text: string): ParsedResponse {
  let thoughtMatch = text.match(/<Thought>(.*?)<\/Thought>/s);
  let actionMatch = text.match(/<Action>(.*?)<\/Action>/s);

  if (!thoughtMatch) {
    thoughtMatch = text.match(/<thought>(.*?)<\/thought>/s);
  }
  
  if (!actionMatch) {
    actionMatch = text.match(/<action>(.*?)<\/action>/s);
  }

  let thought = '';
  if (!thoughtMatch) {
    thought = 'I will perform the following action:';
  }
  else{
    thought = thoughtMatch[1];
  }

  if (!actionMatch) {
    return {
      error: 'Invalid response: Action not found in the model response.',
    };
  }

  const actionString = actionMatch[1];
  const actionPattern = /(\w+)\((.*?)\)/;
  const actionParts = actionString.match(actionPattern);

  if (!actionParts) {
    return {
      error:
        'Invalid action format: Action should be in the format functionName(arg1, arg2, ...).',
    };
  }

  const actionName = actionParts[1];
  const actionArgsString = actionParts[2];

  const availableAction = availableActions.find(
    (action) => action.name === actionName
  );

  if (!availableAction) {
    return {
      error: `Invalid action: "${actionName}" is not a valid action.`,
    };
  }

  const parsedArgs: Record<string, number | string> = {};
  if (availableAction.name == 'finishwithanswer')
  {
    parsedArgs['answer'] = actionArgsString;
  }
  else
  {
    const argsArray = actionArgsString
    .split(',')
    .map((arg) => arg.trim())
    .filter((arg) => arg !== '');
    if (argsArray.length !== availableAction.args.length) {
      return {
        error: `Invalid number of arguments: Expected ${availableAction.args.length} for action "${actionName}", but got ${argsArray.length}.`,
      };
    }
    for (let i = 0; i < argsArray.length; i++) {
      const arg = argsArray[i];
      const expectedArg = availableAction.args[i];

      if (expectedArg.type === 'number') {
        const numberValue = Number(arg);

        if (isNaN(numberValue)) {
          return {
            error: `Invalid argument type: Expected a number for argument "${expectedArg.name}", but got "${arg}".`,
          };
        }

        parsedArgs[expectedArg.name] = numberValue;
      } else if (expectedArg.type === 'string') {
        const stringValue =
          (arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'")) || (arg.startsWith("`") && arg.endsWith("`")) ? arg.slice(1, -1) : null;

        if (stringValue === null) {
          return {
            error: `Invalid argument type: Expected a string for argument "${expectedArg.name}", but got "${arg}".`,
          };
        }

        parsedArgs[expectedArg.name] = stringValue;
      } else {
        return {
          // @ts-expect-error this is here to make sure we don't forget to update this code if we add a new arg type
          error: `Invalid argument type: Unknown type "${expectedArg.type}" for argument "${expectedArg.name}".`,
        };
      }
    }
  }
  const parsedAction = {
    name: availableAction.name,
    args: parsedArgs,
  } as ActionPayload;

  return {
    thought,
    action: actionString,
    parsedAction,
    feedback: 'reject', //placeholder for future thumbs up/down feature
    filteredusersteps: ''
  };
}
