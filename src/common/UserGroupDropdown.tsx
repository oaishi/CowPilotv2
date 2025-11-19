import { Select } from '@chakra-ui/react';
import React from 'react';
import { useAppState } from '../state/store';

const UserGroupDropdown = () => {
  const { selectedUserGroup, updateSettings } = useAppState((state) => ({
    selectedUserGroup: state.settings.selectedUserGroup,
    updateSettings: state.settings.actions.update,
  }));

  const { openAIKey } = useAppState((state) => ({
    openAIKey: state.settings.openAIKey,
  }));

  if (!openAIKey) return null;

  return (
    <Select
      size='xs' 
      value={selectedUserGroup ?? "0"}
      onChange={(e) => updateSettings({ selectedUserGroup: e.target.value })}
    >
      <option value="0">Group-0</option>
      <option value="1">Group-1</option>
      <option value="2">Group-2</option>
      <option value="3">Group-3</option>
    </Select>
  );
};

export default UserGroupDropdown;