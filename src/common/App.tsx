import { Box, ChakraProvider, Heading, HStack, VStack } from '@chakra-ui/react';
import React from 'react';
import { useAppState } from '../state/store';
import ModelDropdown from './ModelDropdown';
import AgentDropdown from './AgentDropdown';
import SetAPIKey from './SetAPIKey';
import TaskUI from './TaskUI';
import OptionsDropdown from './OptionsDropdown';
import logo from '../assets/img/icon.png';

const App = () => {
  const openAIKey = useAppState((state) => state.settings.openAIKey);

  return (
    <ChakraProvider>
      <Box p="8" fontSize="lg" w="full">
        <HStack mb={4} alignItems="center">
          <img
            src={logo}
            width={32}
            height={32}
            className="App-logo"
            alt="logo"
          />

          <Heading as="h4" size="xs" flex={1}>
            CowPilot
          </Heading>
          <HStack spacing={2}>
            <VStack spacing={2}>
              <ModelDropdown />
              {/* <AgentDropdown/> */}
            </VStack>
            <OptionsDropdown />
          </HStack>
        </HStack>
        {openAIKey ? <TaskUI /> : <SetAPIKey />}
      </Box>
    </ChakraProvider>
  );
};

export default App;
