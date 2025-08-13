import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import AppLogo from '../components/AppLogo';

const AuthView: React.FC = () => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleAuthAction = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (isLoginView) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage('¡Registro exitoso! Su cuenta está pendiente de aprobación por un administrador.');
        setFullName('');
        setEmail('');
        setPassword('');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden md:flex">
        <div className="md:w-1/2 bg-primary-700 dark:bg-primary-900 text-white p-8 sm:p-12 flex flex-col justify-center items-center text-center">
            <AppLogo className="w-48 h-24" />
            <h1 className="text-3xl sm:text-4xl font-bold mt-4">CIEC.Now</h1>
            <p className="mt-4 text-primary-200">La plataforma para la gestión de comisiones, reuniones y eventos de CIEC.</p>
        </div>
        <div className="md:w-1/2 p-8 sm:p-12 flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">{isLoginView ? 'Iniciar Sesión' : 'Crear Cuenta'}</h2>
          <form onSubmit={handleAuthAction} className="space-y-4">
            {!isLoginView && (
              <Input
                label="Nombre Completo"
                id="full_name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Su nombre y apellido"
              />
            )}
            <Input
              label="Correo Electrónico"
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="su.correo@ejemplo.com"
            />
            <Input
              label="Contraseña"
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? (isLoginView ? 'Ingresando...' : 'Registrando...') : (isLoginView ? 'Ingresar' : 'Registrarse')}
            </Button>
          </form>
          {error && <p className="mt-4 text-center text-sm text-red-500">{error}</p>}
          {message && <p className="mt-4 text-center text-sm text-green-600 dark:text-green-400">{message}</p>}
          <div className="mt-6 text-center">
            <button onClick={() => { setIsLoginView(!isLoginView); setError(''); setMessage(''); }} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
              {isLoginView ? '¿No tiene una cuenta? Regístrese' : '¿Ya tiene una cuenta? Inicie sesión'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthView;