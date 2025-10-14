export const availableActions = [
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
    name: 'scroll',
    description: 'Scroll into a given direction (up/down/left/right). Use it only when the target element is not visible in the viewport and scrolling might expose it. Do not use it unless absolutely necessary. Do not scroll indefinitely.',
    args: [
      {
        name: 'direction',
        type: 'string',
      },
    ],
  },
  // {
  //   name: 'hover',
  //   description: 'Hover the mouse on an element',
  //   args: [
  //     {
  //       name: 'elementId',
  //       type: 'number',
  //     },
  //   ],
  // },
  {
    name: 'setvalue',
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
  {
    name: 'finish',
    description: 'Indicates the task is finished',
    args: [],
  },
  {
    name: 'finishwithanswer',
    description: 'Finish the task by responding with the desired answer to a user query',
    args: [
      {
        name: 'answer',
        type: 'string',
      },
    ],
  },
  {
    name: 'fail',
    description: 'Indicates that you are unable to complete the task',
    args: [],
  },
] as const;

type AvailableAction = (typeof availableActions)[number];

type ArgsToObject<T extends ReadonlyArray<{ name: string; type: string }>> = {
  [K in T[number]['name']]: Extract<
    T[number],
    { name: K }
  >['type'] extends 'number'
    ? number
    : string;
};

export type ActionShape<
  T extends {
    name: string;
    args: ReadonlyArray<{ name: string; type: string }>;
  }
> = {
  name: T['name'];
  args: ArgsToObject<T['args']>;
};

export type ActionPayload = {
  [K in AvailableAction['name']]: ActionShape<
    Extract<AvailableAction, { name: K }>
  >;
}[AvailableAction['name']];
