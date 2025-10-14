import React from 'react';
import { createRoot } from 'react-dom/client';

import Newtab from './Newtab';
import './index.css';

const container = document.getElementById('app-container');
const root = createRoot(container); // Use container! if you're using TypeScript
root.render(<Newtab />);

if (module.hot) module.hot.accept();

