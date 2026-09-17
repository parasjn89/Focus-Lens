import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Calendar,
  LogOut,
  Trash2,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function ProfilePage({ onNavigate }) {
  const { user, logout, updateProfile, changePassword, deleteAccount } = useAuth();

  // Profile Name & Username Form State
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState('');
  const [passError, setPassError] = useState('');

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    if (user) {
      if (user.name) setName(user.name);
      if (user.username) setUsername(user.username);
    }
  }, [user]);

  // Calculate Password Strength score & label
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: 'None', color: 'bg-slate-700' };
    const len = pass.length;
    if (len < 8) return { score: 1, label: 'Very Weak', color: 'bg-rose-500' };
    if (len < 12) return { score: 2, label: 'Weak (Need 12+ chars)', color: 'bg-amber-500' };

    let bonus = 0;
    if (len >= 16) bonus += 1;
    if (len >= 20) bonus += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) bonus += 1;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) bonus += 1;

    if (bonus >= 3) return { score: 5, label: 'Excellent Passphrase', color: 'bg-emerald-400' };
    if (bonus >= 1) return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
    return { score: 3, label: 'Fair (12+ Chars)', color: 'bg-blue-500' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');

    const cleanName = name.trim();
    const cleanUsername = username.trim().replace(/^@/, '');

    if (!cleanName || cleanName.length < 2) {
      setProfileError('Full name must be at least 2 characters long.');
      return;
    }

    if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 30) {
      setProfileError('Username must be between 3 and 30 characters.');
      return;
    }

    if (!/^[a-zA-Z0-9._]+$/.test(cleanUsername)) {
      setProfileError('Username can only contain letters, numbers, underscores (_), and periods (.).');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await updateProfile({ name: cleanName, username: cleanUsername });
      setProfileSuccess('Profile updated successfully.');
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassSuccess('');
    setPassError('');

    if (!currentPassword) {
      setPassError('Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.length < 12) {
      setPassError('New password must be at least 12 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError('New password and confirmation do not match.');
      return;
    }

    setIsChangingPass(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setPassSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPassError(err.message || 'Failed to change password.');
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    onNavigate('landing');
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      onNavigate('landing');
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete account.');
      setIsDeleting(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Page Header */}
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight">Account & Profile Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your account identity, security preferences, and credentials.</p>
      </div>

      {/* Main Container */}
      <div className="p-8 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-8">
        
        {/* 1. Identity Header */}
        <div className="flex items-center space-x-4 pb-6 border-b border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-brand-500/20">
            {(user?.name || user?.username || user?.email || 'U')[0].toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>{user?.name || 'FocusLens User'}</span>
              {user?.username && (
                <span className="text-xs font-mono text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-md border border-brand-500/20">
                  @{user.username}
                </span>
              )}
            </h2>
            <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span>{user?.email}</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 mt-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Member since {formatDate(user?.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* 2. Profile Information Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Profile Information</h3>
          </div>

          {profileSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center space-x-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{profileSuccess}</span>
            </div>
          )}

          {profileError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center space-x-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{profileError}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Username (Public Handle)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-white text-xs placeholder-slate-500 transition-colors font-mono"
                    required
                  />
                </div>
                <p className="text-[10px] text-slate-500">Unique public handle (3-30 letters, numbers, _, .)</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Full Name (Display Name)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-white text-xs placeholder-slate-500 transition-colors"
                  required
                />
                <p className="text-[10px] text-slate-500">Your display name shown across FocusLens</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isUpdatingProfile || (name.trim() === user?.name && username.trim().toLowerCase().replace(/^@/, '') === user?.username)}
                className="py-2.5 px-6 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
              >
                {isUpdatingProfile ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>

          {/* Contact Details & Verification Status */}
          <div className="pt-2 space-y-3">
            {/* Email Card */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                {user?.email ? (
                  <span className="font-mono text-slate-300">{user.email}</span>
                ) : (
                  <span className="text-slate-500 italic">No email linked (Optional)</span>
                )}

                {user?.email ? (
                  user?.emailVerifiedAt ? (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      ✓ Email Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      ⚠ Unverified
                    </span>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate('verify')}
                    className="text-[11px] font-semibold text-brand-400 hover:text-brand-300"
                  >
                    + Add Email Address
                  </button>
                )}
              </div>
            </div>

            {/* Phone Card */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone Number</label>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                {user?.phoneNumber ? (
                  <span className="font-mono text-slate-300">{user.phoneNumber}</span>
                ) : (
                  <span className="text-slate-500 italic">No phone linked (Optional)</span>
                )}

                {user?.phoneNumber ? (
                  user?.phoneVerifiedAt ? (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      ✓ Phone Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      ⚠ Unverified
                    </span>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate('verify')}
                    className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    + Add Phone Number
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6">
          {/* 3. Password Security Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <KeyRound className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Change Password</h3>
            </div>

            {/* Password Policy Box */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs text-slate-300">
              <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-brand-400" />
                <span>Password requirements:</span>
              </div>
              <ul className="grid sm:grid-cols-2 gap-1 text-[11px] text-slate-400 list-disc list-inside pl-1">
                <li>At least 12 characters</li>
                <li>Longer passphrases recommended</li>
                <li>Use a unique password</li>
                <li>Avoid common words / personal info</li>
                <li>Mixed character types optional</li>
              </ul>
            </div>

            {passSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center space-x-2 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{passSuccess}</span>
              </div>
            )}

            {passError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center space-x-2 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{passError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-white text-xs transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password & Strength Meter */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">New Password (12+ characters)</label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password or passphrase"
                    className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-white text-xs transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Strength Meter Bar */}
                {newPassword && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-400">Password Strength:</span>
                      <span className="font-semibold text-slate-200">{strength.label}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-full flex-1 rounded-full transition-all duration-300 ${
                            level <= strength.score ? strength.color : 'bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-white text-xs transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isChangingPass || !currentPassword || !newPassword || !confirmPassword}
                className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
              >
                {isChangingPass ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>

        {/* 4. Privacy Guarantee Banner */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start space-x-3 text-xs text-slate-300">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Zero-Knowledge Privacy Guaranteed:</span>
            {' '}Your account stores only session metadata and activity scores. Webcam video and screenshots are processed 100% locally on your machine and are never transmitted or stored.
          </div>
        </div>

        {/* 5. Account Actions */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center justify-center space-x-2"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Sign Out</span>
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/30 transition-colors flex items-center justify-center space-x-2"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* Account Deletion Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-2">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white">Delete Account & Focus History?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              This action is permanent and cannot be undone. All your user profile data, persistent focus sessions, and historical activity segments will be permanently deleted from the database.
            </p>

            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
