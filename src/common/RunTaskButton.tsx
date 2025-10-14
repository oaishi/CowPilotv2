import { Box, ButtonGroup, HStack, Icon, useToast, VStack, Tooltip} from '@chakra-ui/react';
import React from 'react';
import { TiTick } from "react-icons/ti";
import { RxCross2 } from "react-icons/rx";
import { useAppState } from '../state/store';
import { BsPlayFill, BsFastForward } from 'react-icons/bs';

export default function RunTaskButton(props: { runTask: () => void }) {
  const state = useAppState((state) => ({
    taskState: state.currentTask.status,
    instructions: state.ui.instructions,
    interruptTask: state.currentTask.actions.finishwithfailure,
    finishwithsuccess: state.currentTask.actions.finishwithsuccess,
    RunNextStep: state.currentTask.actions.RunNextStep,
    accept: state.currentTask.actions.accept,
    reject: state.currentTask.actions.reject,
    markascriticalstep: state.currentTask.actions.markascriticalstep,
  }));

  const toast = useToast(); 
  const handleMarkAsCritical = () => {
    state.markascriticalstep(); 
    toast({
      title: 'Step marked as critical',
      description: 'The current step requires confirmation from user.',
      status: 'success', 
      duration: 5000,
      isClosable: true,
    });
  };

  let button = (
    <VStack spacing={1} pb={2}>
      <Tooltip
      label='Start Task'
      aria-label='Start Task'>
        <Box
          as="button"
          onClick={props.runTask}
          borderRadius="full"
          boxSize="30px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="green.500"
          color="white"
          disabled={state.taskState === 'running' || !state.instructions}
        >
          <Icon as={BsPlayFill} boxSize={4} />
        </Box>
      </Tooltip>
    </VStack>
  );

  if (state.taskState === 'running') {
    button = (
      <ButtonGroup spacing="1" pb={2}>
        {/* Accept Button */}
        {/* <VStack spacing={1}>
          <Tooltip
          label='Next'
          aria-label='Next'>
            <Box
              as="button"
              onClick={state.accept}
              borderRadius="full"
              boxSize="30px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg="green.500"
              color="white"
            >
              <Icon as={BsFastForward} boxSize={4} />
            </Box>
          </Tooltip>
        </VStack> */}

        {/* Reject Button */}
        {/* <VStack spacing={1}>
        <Tooltip
          label='Pause'
          aria-label='Pause'>
            <Box
              as="button"
              onClick={state.reject}
              borderRadius="full"
              boxSize="30px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg="red.500"
              color="white"
            >
              <Icon as={BsPause} boxSize={4} />
            </Box>
          </Tooltip>
        </VStack> */}

        {/* Confirmation Button */}
        {/* <VStack spacing={1}>
        <Tooltip
          label='Ask for Confirmation'
          aria-label='Ask for Confirmation'>
            <Box
              as="button"
              onClick={handleMarkAsCritical}
              borderRadius="full"
              boxSize="30px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg="orange.400"
              color="white"
            >
              <Icon as={BsShieldExclamation} boxSize={4} />
            </Box>
          </Tooltip>
        </VStack> */}

        {/* Retry Button, only show when pause was pressed, WIP */}
        <VStack spacing={1}>
        <Tooltip
          label='Resume'
          aria-label='Resume'>
            <Box
              as="button"
              onClick={state.RunNextStep}
              borderRadius="full"
              boxSize="30px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg="blue.500"
              color="white"
            >
              <Icon as={BsFastForward} boxSize={4} />
            </Box>
          </Tooltip>
        </VStack>

        {/* Finish Button */}
        <VStack spacing={1}>
        <Tooltip
        label='Success'
        aria-label='Success'>
            <Box
              as="button"
              onClick={state.finishwithsuccess}
              borderRadius="full"
              boxSize="30px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg="green.500"
              // bg="purple.500"
              color="white"
            >
              <Icon as={TiTick} boxSize={4} />
            </Box>
            </Tooltip>
        </VStack>

        {/* Abort Button */}
        <VStack spacing={1}>
        <Tooltip
        label='Failure'
        aria-label='Failure'>
            <Box
              as="button"
              onClick={state.interruptTask}
              borderRadius="full"
              boxSize="30px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              // bg="facebook.500"
              bg="red.500"
              color="white"
            >
              <Icon as={RxCross2} boxSize={4} />
            </Box>
          </Tooltip>
        </VStack>
      </ButtonGroup>
    );
  }

  return <HStack alignItems="center">{button}</HStack>;
}
