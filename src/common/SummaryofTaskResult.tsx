import React from 'react';
import {Table, Tbody, Tr, Td, VStack, Heading, Checkbox, Input, Text, Box, Icon, Tooltip} from '@chakra-ui/react';
import { useAppState } from '../state/store';
import { FaDownload } from "react-icons/fa";

const SummaryofTaskResult = (props: {
    updateSummaryValue: (key: string, value: string) => void; 
    updateTaskSuccess: (value: number) => void;
    downloadData: () => void;}) => {
    const state = useAppState((state) => ({
        taskStatus: state.currentTask.status,
        goal: state.ui.instructions,
        model: state.settings.selectedModel,
        summary: state.settings.summary,
    }));

    if (state.taskStatus !== 'success' && state.taskStatus !== 'interrupted' && state.taskStatus !== 'error') return null;
    if (state.summary.length == 1 && state.summary[0].name === 'name') return null;
    if (state.summary.length == 0) return; 
    const isEndToEndSuccess = state.summary.some(
        (item) => item.name === 'End-to-end success' && item.value > 0
      );
    const handleCheckboxChange = () => {
        // Toggle the value in the global state
        props.updateTaskSuccess(isEndToEndSuccess ? 0 : 1); // Set to 0 if checked, 1 if unchecked
    };

    const handleInputChange = (key: string, value: string) => {
       props.updateSummaryValue(key, value);
    };

    let answerValue = state.summary.find((item) => item.name === 'Answer')?.value ?? '';

    return (
        <VStack spacing={3} align='center'>
            <Heading as="h4" fontSize="sm">
                Summary From Previous Task
            </Heading>
            <Tooltip label='Download Data Log' aria-label='Download Data Log'>
                <Box
                as="button"
                borderRadius="full"
                boxSize="30px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                bg="white"
                color="gray.500"
                onClick={props.downloadData}
                >
                    <Icon as={FaDownload} boxSize={4} />
                </Box>
            </Tooltip>
            <Table size="xs">
            <Tbody>
            <Tr fontSize="sm">
                <Td colSpan={3} textAlign="center" paddingBottom={3}>
                    Goal: {state.goal}
                </Td>
            </Tr>
            <Tr fontSize="xs">
                <Td paddingBottom={1} paddingTop={1}>Model</Td>
                <Td textAlign="end" paddingBottom={1} paddingTop={1}>{state.model}</Td>
            </Tr>
            {/* Extra row with Checkbox */}
            <Tr fontSize={"xs"}>
                <Td paddingBottom={1} paddingTop={1}>Task Outcome</Td>
                <Td textAlign="end" fontSize={"xs"} paddingBottom={1} paddingTop={1}>
                    <Checkbox isChecked={isEndToEndSuccess} onChange={handleCheckboxChange}>
                        <Text fontSize='xs'>Successful</Text>
                    </Checkbox>
                </Td>
            </Tr>
            {/* Editable answer field for IR tasks */}
            <Tr fontSize={"xs"} key={'Answer'} padding={20}>
                <Td paddingBottom={1} paddingTop={1}>{'Answer'}</Td>
                <Td paddingBottom={1} paddingTop={1}>
                <Input textAlign="end"
                    value={answerValue}
                    onChange={(e) => handleInputChange('Answer', e.target.value)}
                    size="xs"
                />
                </Td>
            </Tr>
            {state.summary
                .filter((item) => item.name !== 'name' && item.name !== 'Answer' && item.name !== 'End-to-end success')
                .map((item) => (
                    // <Tr key={item.name}>
                    // <Td>{item.name}</Td>
                    // <Td textAlign="end">{item.value}</Td>
                    // </Tr>
                    <Tr fontSize={"xs"} key={item.name} padding={20}>
                        <Td paddingBottom={1} paddingTop={1}>{item.name}</Td>
                        <Td paddingBottom={1} paddingTop={1}>
                        <Input textAlign="end"
                            value={item.value}
                            onChange={(e) => handleInputChange(item.name, e.target.value)}
                            size="xs"
                        />
                        </Td>
                    </Tr>
            ))}
            </Tbody>
            </Table>
        </VStack>
    );
};

export default SummaryofTaskResult;
