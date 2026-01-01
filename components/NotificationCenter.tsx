import React, { useState } from 'react';
import { InGameNotification, AppView } from '../types';

interface NotificationCenterProps {
  notifications: InGameNotification[];
  unreadCount: number;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onNavigate: (view: AppView) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  unreadCount,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigate,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Icon configuration with FontAwesome icons and colors
  const getIconConfig = (type: string): { icon: string; color: string; animation?: string } => {
    const icons: Record<string, { icon: string; color: string; animation?: string }> = {
      robbery: { icon: 'fa-mask', color: 'text-alert-red', animation: 'animate-pulse' },
      steal: { icon: 'fa-mask', color: 'text-alert-red', animation: 'animate-pulse' },
      clash: { icon: 'fa-bolt', color: 'text-hot-pink' },
      challenge: { icon: 'fa-crosshairs', color: 'text-cyan-glitch' },
      proof: { icon: 'fa-camera', color: 'text-acid-green' },
      system: { icon: 'fa-cat', color: 'text-acid-green', animation: 'animate-bounce' },
      badge: { icon: 'fa-trophy', color: 'text-yellow-400' },
      debt: { icon: 'fa-gavel', color: 'text-alert-red' },
      beg: { icon: 'fa-hands-praying', color: 'text-cyan-glitch' },
      win: { icon: 'fa-trophy', color: 'text-acid-green', animation: 'animate-bounce' },
      loss: { icon: 'fa-skull', color: 'text-gray-500' },
      friend: { icon: 'fa-user-plus', color: 'text-hot-pink' },
      friend_request: { icon: 'fa-user-plus', color: 'text-hot-pink' },
    };
    return icons[type] || { icon: 'fa-cat', color: 'text-acid-green' };
  };

  const getPriorityStyles = (priority: string) => {
    const styles: Record<string, { border: string; bg: string; glow?: string }> = {
      critical: {
        border: 'border-alert-red',
        bg: 'bg-red-900/30',
        glow: 'shadow-[0_0_15px_rgba(255,51,51,0.5)]'
      },
      high: {
        border: 'border-hot-pink',
        bg: 'bg-pink-900/30',
        glow: 'shadow-[0_0_10px_rgba(255,0,153,0.4)]'
      },
      medium: {
        border: 'border-yellow-500',
        bg: 'bg-yellow-900/20'
      },
      normal: {
        border: 'border-acid-green/50',
        bg: 'bg-green-900/20'
      },
    };
    return styles[priority] || { border: 'border-gray-700', bg: 'bg-gray-900/20' };
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handleNotificationClick = (notification: InGameNotification) => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }

    // Navigate based on notification type
    // Map notification types to appropriate screens:
    // - clash/challenge -> DASHBOARD (view active clashes)
    // - steal/robbery -> DEFENSE (defend against steals)
    // - proof -> PROOF_VAULT (view submitted proofs)
    // - debt -> BORROW (manage debts)
    // - beg -> BEG (handle beg requests)
    // - badge -> PROFILE (view earned badges)
    // - system -> no navigation (general info)
    const type = notification.type || notification.referenceType;

    switch (type) {
      case 'challenge':
        // Challenge notifications (new bet challenges) → go to SwipeFeed to respond
        onNavigate(AppView.SWIPE_FEED);
        onClose();
        break;
      case 'clash':
        // Clash notifications (opposing swipes detected) → go to Dashboard to see active clashes
        onNavigate(AppView.DASHBOARD);
        onClose();
        break;
      case 'steal':
      case 'robbery':
        onNavigate(AppView.DEFENSE);
        onClose();
        break;
      case 'proof':
        onNavigate(AppView.PROOF_VAULT);
        onClose();
        break;
      case 'debt':
        onNavigate(AppView.BORROW);
        onClose();
        break;
      case 'beg':
        onNavigate(AppView.BEG);
        onClose();
        break;
      case 'badge':
        onNavigate(AppView.PROFILE);
        onClose();
        break;
      case 'win':
      case 'loss':
        // Win/loss notifications → go to Dashboard to see clash history
        onNavigate(AppView.DASHBOARD);
        onClose();
        break;
      case 'system':
        // System notifications - check if it's about new bets available
        if (notification.message?.toLowerCase().includes('bet') ||
            notification.title?.toLowerCase().includes('bet')) {
          onNavigate(AppView.SWIPE_FEED);
          onClose();
        }
        // Otherwise stay on notification center
        break;
      default:
        // For unknown types, stay on notification center
        break;
    }
  };

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications;

  return (
    <div className="h-full bg-bingo-black flex flex-col">
      {/* Header */}
      <div className="pt-[env(safe-area-inset-top)] bg-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="p-4 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white active:text-acid-green transition-colors -ml-2 rounded-full active:bg-white/10"
            >
              <i className="fas fa-arrow-left text-2xl"></i>
            </button>
            <div>
              <h1 className="text-acid-green font-bold uppercase tracking-widest">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <p className="text-xs text-gray-500">
                  {unreadCount} unread
                </p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-xs text-acid-green uppercase tracking-wider"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
              filter === 'all'
                ? 'text-acid-green border-b-2 border-acid-green'
                : 'text-gray-500'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
              filter === 'unread'
                ? 'text-acid-green border-b-2 border-acid-green'
                : 'text-gray-500'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            {/* Empty state with cat mascot */}
            <div className="w-24 h-24 rounded-full bg-gray-900/50 border-2 border-gray-700 flex items-center justify-center mb-6">
              <i className="fas fa-cat text-5xl text-gray-600 animate-pulse"></i>
            </div>
            <p className="text-gray-400 text-lg font-bold mb-2 uppercase tracking-wider">
              {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
            </p>
            <p className="text-gray-600 text-sm max-w-xs">
              When someone clashes with you or tries to steal your bingos, you'll see it here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {filteredNotifications.map((notification) => {
              const iconConfig = getIconConfig(notification.type);
              const priorityStyles = getPriorityStyles(notification.priority);

              return (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full p-4 text-left transition-all ${
                    notification.read ? 'opacity-50' : ''
                  } hover:bg-gray-900/50 active:bg-gray-800 ${
                    notification.priority === 'critical' && !notification.read
                      ? 'bg-red-900/10'
                      : ''
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Icon Circle with FontAwesome */}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition-all ${
                        priorityStyles.border
                      } ${priorityStyles.bg} ${
                        !notification.read && priorityStyles.glow ? priorityStyles.glow : ''
                      }`}
                    >
                      <i
                        className={`fas ${iconConfig.icon} text-xl ${iconConfig.color} ${
                          !notification.read && iconConfig.animation ? iconConfig.animation : ''
                        }`}
                      ></i>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3
                          className={`font-bold truncate ${
                            notification.read ? 'text-gray-400' : 'text-white'
                          }`}
                        >
                          {notification.title || getDefaultTitle(notification.type)}
                        </h3>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {formatTime(notification.timestamp)}
                        </span>
                      </div>
                      <p
                        className={`text-sm mt-1 line-clamp-2 ${
                          notification.read ? 'text-gray-500' : 'text-gray-300'
                        }`}
                      >
                        {notification.message}
                      </p>

                      {/* Priority badges */}
                      <div className="flex gap-2 mt-2">
                        {notification.priority === 'critical' && !notification.read && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-alert-red/20 border border-alert-red rounded text-[10px] text-alert-red uppercase tracking-wider animate-pulse">
                            <i className="fas fa-exclamation-triangle text-[8px]"></i>
                            Urgent
                          </span>
                        )}
                        {notification.priority === 'high' && !notification.read && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-hot-pink/20 border border-hot-pink rounded text-[10px] text-hot-pink uppercase tracking-wider">
                            <i className="fas fa-fire text-[8px]"></i>
                            Hot
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Unread indicator */}
                    {!notification.read && (
                      <div className="w-3 h-3 bg-acid-green rounded-full flex-shrink-0 mt-1 animate-pulse"></div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

function getDefaultTitle(type: string): string {
  const titles: Record<string, string> = {
    robbery: 'Robbery Alert',
    clash: 'Clash Update',
    proof: 'Proof Required',
    system: 'System Notice',
    badge: 'Badge Earned',
    debt: 'Debt Notice',
    beg: 'Beg Request',
  };
  return titles[type] || 'Notification';
}

export default NotificationCenter;
