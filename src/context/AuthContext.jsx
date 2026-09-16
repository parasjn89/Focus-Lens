import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearClientUserStorage = () => {
    try {
      localStorage.removeItem('focuslens_local_sessions');
      localStorage.removeItem('focuslens_pending_sync');
      localStorage.removeItem('focuslens_anonymous_id');
      sessionStorage.removeItem('focuslens_active_report_session_id');
    } catch (err) {
      console.warn('Failed to clear client user storage:', err);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.user) {
        setUser(prevUser => {
          if (prevUser && prevUser.id !== res.user.id) {
            clearClientUserStorage();
          }
          return res.user;
        });
      } else {
        setUser(prevUser => {
          if (prevUser) {
            clearClientUserStorage();
          }
          return null;
        });
      }
    } catch (err) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (identifierOrEmail, password) => {
    clearClientUserStorage();
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: identifierOrEmail,
        email: identifierOrEmail,
        password
      }),
    });

    if (res.user) {
      setUser(res.user);
    }
    return res;
  };

  const register = async (username, name, email, password, verificationMethod = 'EMAIL', phoneNumber = '') => {
    clearClientUserStorage();
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username,
        name,
        email,
        password,
        verificationMethod,
        phoneNumber: verificationMethod === 'PHONE' ? phoneNumber : (phoneNumber || undefined),
      }),
    });

    if (res.user) {
      setUser(res.user);
    }
    return res;
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout API error:', err);
    } finally {
      clearClientUserStorage();
      setUser(null);
    }
  };

  const updateProfile = async ({ name, username }) => {
    const res = await apiFetch('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ name, username }),
    });

    if (res.user) {
      setUser(res.user);
    }
    return res;
  };

  const changePassword = async ({ currentPassword, newPassword, confirmPassword }) => {
    const res = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    return res;
  };

  const sendEmailVerification = async (email) => {
    return await apiFetch('/api/auth/send-email-verification', {
      method: 'POST',
      body: JSON.stringify(email ? { email } : {}),
    });
  };

  const verifyEmail = async (code) => {
    const res = await apiFetch('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    if (res.user) {
      setUser(res.user);
    }
    return res;
  };

  const sendPhoneVerification = async (phoneNumber) => {
    return await apiFetch('/api/auth/send-phone-verification', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    });
  };

  const verifyPhone = async (code) => {
    const res = await apiFetch('/api/auth/verify-phone', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    if (res.user) {
      setUser(res.user);
    }
    return res;
  };

  const switchVerificationMethod = async (method, phoneNumber = '') => {
    const res = await apiFetch('/api/auth/switch-verification-method', {
      method: 'POST',
      body: JSON.stringify({ method, phoneNumber }),
    });
    if (res.user) {
      setUser(res.user);
    }
    return res;
  };

  const deleteAccount = async () => {
    await apiFetch('/api/account', { method: 'DELETE' });
    clearClientUserStorage();
    setUser(null);
  };

  const requestForgotPassword = async (method, identifier) => {
    return await apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ method, identifier }),
    });
  };

  const verifyResetToken = async (method, identifier, credential) => {
    return await apiFetch('/api/auth/verify-reset-token', {
      method: 'POST',
      body: JSON.stringify({ method, identifier, code: credential, token: credential }),
    });
  };

  const resetPassword = async ({ token, method, identifier, newPassword, confirmPassword }) => {
    const res = await apiFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, method, identifier, newPassword, confirmPassword }),
    });
    clearClientUserStorage();
    setUser(null);
    return res;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        sendEmailVerification,
        verifyEmail,
        sendPhoneVerification,
        verifyPhone,
        switchVerificationMethod,
        requestForgotPassword,
        verifyResetToken,
        resetPassword,
        deleteAccount,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
