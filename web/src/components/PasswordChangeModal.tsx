'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { BTN, INPUT } from './ui';
import { toast } from 'sonner';

interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PasswordChangeModal({ isOpen, onClose }: PasswordChangeModalProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('All password fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await api.auth.changePassword(oldPassword, newPassword);
      toast.success('Password changed successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-[28px] border border-border-default bg-surface p-7 shadow-[var(--shadow-lift)] text-left">
        <div className="flex items-center justify-between border-b border-border-default pb-4">
          <div>
            <h3 className="tl-serif text-2xl text-foreground">Change Password</h3>
            <p className="text-xs text-muted mt-0.5">Update your account credentials securely</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-muted hover:text-foreground text-sm"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className={INPUT}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              New Password (8+ chars, upper, lower, digits)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={INPUT}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={INPUT}
              required
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={BTN.secondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={BTN.primary}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
