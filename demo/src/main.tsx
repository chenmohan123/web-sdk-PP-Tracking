import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import tokens from '../ui-tokens.json';
import './style.css';

for (const [key, value] of Object.entries(tokens.color)) document.documentElement.style.setProperty(`--${key}`, value);
for (const [key, value] of Object.entries(tokens.space)) document.documentElement.style.setProperty(`--space-${key}`, value);
for (const [key, value] of Object.entries(tokens.radius)) document.documentElement.style.setProperty(`--radius-${key}`, value);
document.documentElement.style.setProperty('--focus-ring', tokens.focus.ring);
createRoot(document.getElementById('root')!).render(<App />);
