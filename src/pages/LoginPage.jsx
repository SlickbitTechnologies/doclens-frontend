import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = React.useState('');

  const handleGoogleLogin = async () => {
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      navigate('/dashboard');
    } catch (err) {
      setError('Google login failed.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-teal-50">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-sm flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-6 text-teal-700 text-center">DocLens Login</h2>
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 py-2 rounded font-semibold hover:bg-gray-100 transition"
        >
          <img src="https://img.icons8.com/color/16/000000/google-logo.png" alt="Google" className="inline-block" />
          Sign in with Google
        </button>
        {error && <div className="text-red-500 mt-4 text-center">{error}</div>}
      </div>
    </div>
  );
}