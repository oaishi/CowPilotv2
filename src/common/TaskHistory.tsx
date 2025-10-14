import { VStack, HStack, Box, Text, ButtonGroup, Icon, Tooltip} from '@chakra-ui/react';
import React, { useState, useEffect, useRef } from 'react';
import { IoIosPause } from "react-icons/io";
import { wait_time_interval } from '../constants';
import { TaskHistoryEntry } from '../state/currentTask';
import { useAppState } from '../state/store';

type TaskHistoryItemProps = {
  index: number;
  entry: TaskHistoryEntry;
  length: number;
};

const PauseButton = () => {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const state = useAppState((state) => ({
    reject: state.currentTask.actions.reject
  }));

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsVisible(false); 
    }, wait_time_interval * 60);
    return () => clearTimeout(timeout);
  }, []);

  // Start the animation and reset it after 3 seconds
  useEffect(() => {
    if (progress < 100) {
      const interval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 1, 100)); // Increment progress up to 100%
      }, 30); // 3 seconds total (100 steps * 30ms)
      
      return () => clearInterval(interval);
    }
  }, [progress]);
  if (!isVisible) return null;
  
  const handleClick = () => {
    setIsVisible(false);
    state.reject();
  };

  const pausebutton = (
    <ButtonGroup spacing="1">
      {/* Pause Button */}
      <VStack spacing={1}>
        <Tooltip label="Pause" aria-label="Pause">
          <Box
            position="relative"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
          >
            {/* Circular Gradient Border */}
            <Box
              borderRadius="full"
              boxSize="50px"
              background={`conic-gradient(green ${progress * 3.6}deg, white ${progress * 3.6}deg)`} // Create circular gradient
              transition="background 0.03s linear" // Smooth transition
            />
            {/* Actual Button */}
            <Box
              as="button"
              position="absolute"
              top="6px"
              left="6px"
              borderRadius="full"
              boxSize="38px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              color="gray.500"
              background="white"
              onClick={handleClick}
            >
              <Icon as={IoIosPause} boxSize={6} />
            </Box>
          </Box>
        </Tooltip>
      </VStack>
    </ButtonGroup>
  );

  return pausebutton;
};

const TaskHistoryItem = ({ index, entry, length}: TaskHistoryItemProps) => {
  let agentMessage = '';
  if ('error' in entry.action) {
    agentMessage = `Error: ${entry.action.error}`;
  } else if (entry.action?.thought) {
    agentMessage = entry.action.thought;
  }

  if (index === length - 1)
    return (
      <VStack w="full" alignItems="start" spacing={1}>
        {/* Agent Output */}
        <HStack
          w="full"
          borderRadius="md"
          alignItems="center"
          spacing={1} 
        >
          {/* Avatar Icon */}
          <Box
            borderRadius="full"
            w="20px"  
            h="20px"  
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Text as="span" size="lg" color="white"> 🤖 </Text>
          </Box>
          {/* Message Content */}
          <Box
            bgGradient='linear(to-b, blue.100, blue.200)'
            p={2}
            borderRadius="xl"
            flex="1"
            ml={2} 
          >
            <Text fontSize="xs">{agentMessage}</Text>
          </Box>
          <PauseButton />
        </HStack>
        {/* User Inputs */}
        {entry.usersteps && entry.usersteps.map((step, stepIndex) => (
          <HStack
            key={stepIndex}
            w="full"
            borderRadius="md"
            alignItems="center"
            spacing={2}
          >
            {/* User Avatar */}
            <Box
              borderRadius="full"
              w="30px"
              h="30px"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Text as="span" size="xs" color="white"> 🙋 </Text>
            </Box>
            {/* User Message Content */}
            <Box
              bgGradient='linear(to-b, gray.100, gray.200)'
              p={2}
              borderRadius="lg"
              flex="1"
              ml={2}
            >
              <Text fontSize="xs">{step.action_type}</Text>
            </Box>
          </HStack>
        ))}
      </VStack>
    );

  return (
    <VStack w="full" alignItems="start" spacing={1}>
      {/* Agent Output */}
      <HStack
        w="full"
        borderRadius="md"
        alignItems="center"
        spacing={1} 
      >
        {/* Avatar Icon */}
        <Box
          borderRadius="full"
          w="20px"  
          h="20px"  
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Text as="span" size="lg" color="white"> 🤖 </Text>
        </Box>
        {/* Message Content */}
        <Box
          bgGradient='linear(to-b, blue.100, blue.200)'
          p={2}
          borderRadius="xl"
          flex="1"
          ml={2} 
        >
          <Text fontSize="xs">{agentMessage}</Text>
        </Box>
      </HStack>
      {/* User Inputs */}
      {entry.usersteps && entry.usersteps.map((step, stepIndex) => (
        <HStack
          key={stepIndex}
          w="full"
          borderRadius="md"
          alignItems="center"
          spacing={2}
        >
          {/* User Avatar */}
          <Box
            borderRadius="full"
            w="30px"
            h="30px"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Text as="span" size="xs" color="white"> 🙋 </Text>
          </Box>
          {/* User Message Content */}
          <Box
            bgGradient='linear(to-b, gray.100, gray.200)'
            p={2}
            borderRadius="lg"
            flex="1"
            ml={2}
          >
            <Text fontSize="xs">{step.action_type}</Text>
          </Box>
        </HStack>
      ))}
    </VStack>
  );
};

export default function TaskHistory() {
  const { taskHistory, taskStatus } = useAppState((state) => ({
    taskStatus: state.currentTask.status,
    taskHistory: state.currentTask.history,
  }));

  const lastItemRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (lastItemRef.current) {
      lastItemRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [taskHistory]);

  if (taskHistory.length === 0 || taskStatus !== 'running') return null;

  return (
    <Box
      maxHeight="600px" // Set the desired height limit
      overflowY="auto" // Enable vertical scrolling
      w="full"
    >
      <VStack mt={4} spacing={2}>
        {taskHistory.map((entry, index) => (
          <TaskHistoryItem key={index} index={index} entry={entry} length={taskHistory.length} />
        ))}
        {/* This div will reference the last item */}
        <div ref={lastItemRef}></div>
      </VStack>
    </Box>
  );
} 
