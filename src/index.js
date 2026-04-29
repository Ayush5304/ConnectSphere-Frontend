/*
 * index.js — Entry Point of the React Application
 *
 * This is the FIRST file that runs when the app starts.
 * Its only job is to find the <div id="root"> in public/index.html
 * and inject our entire React app inside it.
 *
 * Think of it like: HTML has an empty box with id="root",
 * and this file fills that box with our entire React application.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/*
 * ReactDOM.createRoot() — creates a React root inside the HTML div with id="root"
 * .render(<App />) — renders our main App component inside that root
 * Everything in our app starts from the <App /> component
 */
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
