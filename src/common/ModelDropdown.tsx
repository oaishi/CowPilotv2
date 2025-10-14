import { Select } from '@chakra-ui/react';
import React from 'react';
import { useAppState } from '../state/store';

const ModelDropdown = () => {
  const { selectedModel, updateSettings } = useAppState((state) => ({
    selectedModel: state.settings.selectedModel,
    updateSettings: state.settings.actions.update,
  }));

  const { openAIKey } = useAppState((state) => ({
    openAIKey: state.settings.openAIKey,
  }));

  if (!openAIKey) return null;

  return (
    // Chakra UI Select component
    <Select
      size='xs' 
      value={selectedModel || ''}
      onChange={(e) => updateSettings({ selectedModel: e.target.value })}
    >
      <option value="neulab/gpt-4o-2024-08-06">GPT-4o (LiteLLM)</option>
      <option value="neulab/meta-llama/Meta-Llama-3.1-8B-Instruct">Llama 8B (LiteLLM)</option>
      <option value="gpt-4o">GPT-4o</option>
      {/* <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
      <option value="gpt-3.5-turbo-16k">GPT-3.5 Turbo (16k)</option>
      <option value="gpt-4">GPT-4</option>
      <option value="gpt-4-turbo">GPT-4 Turbo</option> */}
    </Select>
  );
};

export default ModelDropdown;
