import { Select } from '@chakra-ui/react';
import React from 'react';
import { useAppState } from '../state/store';

const AgentDropdown = () => {
  const { selectedPrompt, updateSettings } = useAppState((state) => ({
    selectedPrompt: state.settings.selectedPrompt,
    updateSettings: state.settings.actions.update,
  }));

  const { openAIKey } = useAppState((state) => ({
    openAIKey: state.settings.openAIKey,
  }));

  if (!openAIKey) return null;

  return (
    <Select
      size='xs' 
      value={selectedPrompt || ''}
      onChange={(e) => updateSettings({ selectedPrompt: e.target.value })}
    >
      <option value="AxTree">AxTree</option>
      {/* <option value="multimodal">AxTree + Screenshot</option> */}
    </Select>
  );
};

export default AgentDropdown;
