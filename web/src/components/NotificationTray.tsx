'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Notification } from '@/lib/types';
import { relativeTime } from '@/lib/presentation';
import { toast } from 'sonner';

export default function NotificationTray() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: countData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.notifications.unreadCount(),
    refetchInterval: 15000,
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications', 'list'],
    queryFn: () => api.notifications.list(20),
    enabled: open,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => api.notifications.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const unreadCount = countData?.unread_count ?? 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border-default bg-surface text-foreground shadow-2xs transition-colors hover:bg-surface-muted focus:outline-none"
        aria-label="View notifications"
        title="Notifications"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="1.9"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-[22px] border border-border-default bg-surface p-3.5 shadow-[var(--shadow-lift)] z-50">
          <div className="flex items-center justify-between border-b border-border-default pb-2.5 px-1">
            <div className="flex items-center gap-2">
              <span className="tl-serif text-lg text-foreground">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#FCE4E4] px-2 py-0.5 text-[10px] font-bold text-risk-critical">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                className="text-xs font-semibold text-[#7C3AED] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="mt-2 max-h-72 overflow-y-auto space-y-1.5 tl-scroll">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted">
                No notifications yet. Alerts for high-risk threats will appear here.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && markReadMutation.mutate(n.id)}
                  className={`p-3 rounded-2xl transition-colors cursor-pointer text-left ${
                    n.is_read
                      ? 'opacity-70 hover:bg-surface-muted'
                      : 'bg-surface-muted/80 hover:bg-surface-hover border border-border-default/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {n.title}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted">
                      {relativeTime(n.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2">
                    {n.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
