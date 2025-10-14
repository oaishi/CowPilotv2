import { Box, HStack, Textarea, useToast } from '@chakra-ui/react';
import React, { useCallback, useEffect } from 'react';
import { debugMode } from '../constants';
import { useAppState } from '../state/store';
import RunTaskButton from './RunTaskButton';
import TaskHistory from './TaskHistory';
import SummaryofTaskResult from './SummaryofTaskResult';
import TaskStatus from './TaskStatus';

const TaskUI = () => {
  const state = useAppState((state) => ({
    taskHistory: state.currentTask.history,
    taskStatus: state.currentTask.status,
    runTask: state.currentTask.actions.runTask,
    initiate: state.currentTask.actions.initiate,
    updatetasksuccess: state.settings.actions.updatetasksuccess,
    updateSummaryValue: state.settings.actions.updateSummaryValue,
    DownloadData: state.currentTask.actions.DownloadData,
    instructions: state.ui.instructions,
    setInstructions: state.ui.actions.setInstructions,
    summary: state.settings.summary,
  }));

  const taskInProgress = state.taskStatus === 'running';
  const toast = useToast();

  const toastError = useCallback(
    (message: string) => {
      toast({
        title: 'Error: Retry the task from scratch',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      // Download data when error occurs
      console.log('Downloading data due to error...');
      state.DownloadData();
    },
    [toast, state.DownloadData]
  );

  const initiateTask = useCallback(() => {
    console.log('Attempting to initiate task...', state.instructions);
    if (state.instructions) {
      state.initiate();
    } else {
      console.log('No instructions to run the task.');
    }
  }, [state.initiate]);

  const updateTaskSuccess = useCallback((value: number) => {
    state.updatetasksuccess(value);
  }, [state.updatetasksuccess]);

  const updateSummaryValue = useCallback((key: string, value: string) => {
    state.updateSummaryValue(key, value);
  }, [state.updateSummaryValue]);

  const downloadData = useCallback(() => {
    console.log('Attempting to download data.');
    state.DownloadData();
  }, [state.DownloadData]);


  const runTask = useCallback(() => {
    console.log('Attempting to run task...');
    if (state.instructions) {
      console.log('Running task with instructions:', state.instructions);
      state.runTask(toastError);
    } else {
      console.log('No instructions to run the task.');
    }
  }, [state.instructions, state.runTask, toastError]);

  useEffect(() => {
    // console.log('Checking task status:', state.taskStatus);
    if (state.taskStatus === 'running') {
      // console.log('Task status is running. Calling runTask.');
      runTask();
    }
  }, [state.taskStatus, runTask]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runTask();
    }
  };

  return (
    <>
      <HStack>
        {debugMode && <TaskStatus />}
      </HStack>
      <TaskHistory/>
      <SummaryofTaskResult updateTaskSuccess={updateTaskSuccess} updateSummaryValue={updateSummaryValue} downloadData={downloadData}/>
      <Box position="fixed" bottom = {0} width="90%" bg= "white" mb={4}>
        <Textarea
          autoFocus
          placeholder="CowPilot uses OpenAI's GPT-4 API to perform actions on the current page. Try telling it to sign up for a newsletter, or to add an item to your cart."
          value={state.instructions || ''}
          disabled={taskInProgress}
          onChange={(e) => state.setInstructions(e.target.value)}
          mb={2}
          onKeyDown={onKeyDown}
        />
        <Box position="absolute" bottom="10px" right="10px" zIndex={1}>
          <RunTaskButton runTask={initiateTask} />
        </Box>
      </Box>
      {/* Chat input field - Sticky */}
      {/* <Box
        as="form"
        position="sticky"
        bottom="0"
        width="100%"
        p={2}
      >
        <HStack>
          <Input
            placeholder="Type something to send..."
            value={""}
            // onChange={(e) => state.setMessage(e.target.value)}
          />
          <Button
            colorScheme="green"
            // onClick={handleSendMessage}
          >
            &#9658;
          </Button>
        </HStack>
      </Box> */}
    </>
  );
};

export default TaskUI;
