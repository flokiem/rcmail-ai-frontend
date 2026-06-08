import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login         from './pages/Login.jsx';
import Setup         from './pages/Setup.jsx';
import Chat          from './pages/Chat.jsx';
import ResetPassword from './pages/ResetPassword.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/"               element={<Login />} />
      <Route path="/setup"          element={<Setup />} />
      <Route path="/chat"           element={<Chat />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*"               element={<Navigate to="/" replace />} />
    </Routes>
  );
}
