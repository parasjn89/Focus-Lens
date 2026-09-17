import React, { useState, useEffect, useRef } from 'react';
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
  Camera,
  Upload,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BackButton } from '../components/BackButton.jsx';
import { UserAvatar } from '../components/UserAvatar.jsx';
import { AvatarCropModal } from '../components/AvatarCropModal.jsx';

export function ProfilePage({ onNavigate }) {
  const { user, logout, updateProfile, uploadAvatar, removeAvatar, changePassword, deleteAccount } = useAuth();

  // Avatar Management State
  const fileInputRef = useRef(null);
  const [avatarImageSrc, setAvatarImageSrc] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState('');
  const [avatarError, setAvatarError] = useState('');

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

  const handleSelectFileClick = () => {
    setAvatarError('');
    setAvatarSuccess('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['jpg', 'jpeg', 'png', 'webp'];
    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      setAvatarError('Unsupported image format. Please select a JPG, PNG, or WebP file.');
      return;
    }

    // Validate size (2MB max)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setAvatarError('Image is too large. Maximum file size is 2MB.');
      return;
    }

    // Read file as Data URL
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      setAvatarImageSrc(loadEvt.target.result);
      setShowCropModal(true);
    };
    reader.onerror = () => {
      setAvatarError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCroppedAvatar = async (croppedBase64) => {
    setIsUploadingAvatar(true);
    setAvatarError('');
    try {
      await uploadAvatar(croppedBase64);
      setShowCropModal(false);
      setAvatarImageSrc(null);
      setAvatarSuccess('Profile picture updated successfully.');
    } catch (err) {
      setAvatarError(err.message || 'Failed to upload profile picture.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleConfirmRemoveAvatar = async () => {
    setIsRemovingAvatar(true);
    setAvatarError('');
    try {
      await removeAvatar();
      setShowRemoveConfirm(false);
      setAvatarSuccess('Profile picture removed.');
    } catch (err) {
      setAvatarError(err.message || 'Failed to remove profile picture.');
    } finally {
      setIsRemovingAvatar(false);
    }
  };

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
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      {/* Top Contextual Navigation */}
      <div className="flex items-center justify-between">
        <BackButton
          label="Back to Dashboard"
          onClick={() => onNavigate && onNavigate('dashboard')}
        />
      </div>

      {/* Page Header */}
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight">Account & Profile Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your account identity, security preferences, and credentials.</p>
      </div>

      {/* Main Container */}
      <div className="p-8 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-8">
        
        {/* 1. Identity & Profile Picture Header */}
        <div className="pb-6 border-b border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="relative group">
                <UserAvatar user={user} size="2xl" className="border-2 border-slate-700/60 shadow-xl" />
                <button
                  type="button"
                  onClick={handleSelectFileClick}
                  className="absolute bottom-0 right-0 p-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-black/50 border-2 border-slate-900 transition-all hover:scale-105"
                  title={user?.avatarUrl ? 'Change Profile Picture' : 'Upload Profile Picture'}
                  aria-label="Upload or change profile picture"
                >
                  <Camera className="w-4 h-4" />
                </button>
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

            {/* Avatar Action Buttons */}
            <div className="flex sm:flex-col items-start sm:items-end gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSelectFileClick}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium border border-slate-700 transition shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5 text-brand-400" />
                  <span>{user?.avatarUrl ? 'Change Photo' : 'Upload Photo'}</span>
                </button>

                {user?.avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setShowRemoveConfirm(true)}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-xs font-medium border border-slate-700 hover:border-rose-500/40 transition"
                    title="Remove Photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-500">JPG, PNG, or WebP (max 2MB)</p>
            </div>
          </div>

          {/* Remove Confirmation Dialog */}
          {showRemoveConfirm && (
            <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center space-x-2 text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>Remove profile picture and revert to initials avatar?</span>
              </div>
              <div className="flex items-center space-x-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShowRemoveConfirm(false)}
                  disabled={isRemovingAvatar}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRemoveAvatar}
                  disabled={isRemovingAvatar}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-sm transition disabled:opacity-50"
                >
                  {isRemovingAvatar ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Removing...</span>
                    </>
                  ) : (
                    <span>Confirm Remove</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Avatar Feedback Messages */}
          {avatarSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center space-x-2 text-xs text-emerald-300 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{avatarSuccess}</span>
            </div>
          )}
          {avatarError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center space-x-2 text-xs text-rose-300 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{avatarError}</span>
            </div>
          )}
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
            {' '}Your account stores only session metadata and activity scores. Webcam video, screenshots, and audio buffers are processed 100% locally on your machine and are never transmitted or stored.
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

      {/* Avatar Crop & Preview Modal */}
      <AvatarCropModal
        isOpen={showCropModal}
        imageSrc={avatarImageSrc}
        onClose={() => {
          setShowCropModal(false);
          setAvatarImageSrc(null);
        }}
        onSave={handleSaveCroppedAvatar}
        isSaving={isUploadingAvatar}
      />
    </div>
  );
}
