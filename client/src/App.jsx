import './App.css'
import Login from './pages/auth/Login'
import SignUp from './pages/auth/SignUp'
import { Toaster } from 'react-hot-toast';
import { Routes, Route } from 'react-router-dom';

function App() {


  return (
    <AppContent />
  );
}

function AppContent() {
  return (
    <>
      <Toaster />
      <Routes>
        <Route path='/' element={<Login />} />
        <Route path='/login' element={<Login />} />
        <Route path='/signup' element={<SignUp />} />
      </Routes>
    </>
  )
}

export default App
