'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Hash,
  Plus,
  Search,
  Send,
  Users,
  Bell,
  Pin,
  Loader2,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api, getImageUrl } from '@/lib/api';
import { getUser } from '@/lib/auth-storage';
import { usePusher } from '@/contexts/pusher-context';
import { PageHeader } from '@/components/dashboard/page-header';

interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: string;
  isPrivate: boolean;
  memberCount: number;
  lastMessage: { content: string; createdAt: string; senderId: string } | null;
  isMember?: boolean;
  isChannelAdmin?: boolean;
}

interface ChannelMessage {
  id: string;
  channelId: string;
  senderId: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string; avatar: string | null } | null;
  reactions: { id: string; emoji: string; userId: string }[];
  replyCount: number;
}

function getInitials(firstName?: string, lastName?: string) {
  return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase() || '?';
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const getChannelIcon = (type: string) => {
  switch (type) {
    case 'ANNOUNCEMENT':
      return <Bell className="w-4 h-4" />;
    case 'PROJECT':
      return <Hash className="w-4 h-4 text-blue-500" />;
    default:
      return <Hash className="w-4 h-4" />;
  }
};

export default function ChannelsPage() {
  const currentUser = getUser();
  const { subscribeToChannel, unsubscribeFromChannel } = usePusher();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelType, setNewChannelType] = useState('GENERAL');
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch channels
  const fetchChannels = useCallback(async () => {
    try {
      const res = await api.get<any>('/channels');
      const data = Array.isArray(res) ? res : res?.data || [];
      setChannels(data);
    } catch {
      // silently fail
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Fetch messages for active channel
  const fetchMessages = useCallback(async (channelId: string) => {
    setLoadingMessages(true);
    try {
      const res = await api.get<any>(`/channels/${channelId}/messages?limit=100`);
      const msgs = res?.data || [];
      setMessages(Array.isArray(msgs) ? msgs : []);
      // Mark as read
      api.post(`/channels/${channelId}/read`).catch(() => {});
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Select channel
  const handleSelectChannel = (channel: Channel) => {
    setActiveChannel(channel);
    fetchMessages(channel.id);
  };

  // Listen for real-time messages via Supabase Realtime
  useEffect(() => {
    if (!activeChannel) return;

    const channelName = `chat-${activeChannel.id}`;
    const channel = subscribeToChannel(channelName);
    if (channel) {
      channel
        .on('broadcast', { event: 'channel:message' }, (payload) => {
          const data = payload.payload as { channelId: string; message: ChannelMessage };
          if (data.channelId === activeChannel.id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.message.id)) return prev;
              return [...prev, data.message];
            });
          }
        })
        .subscribe();
    }

    return () => {
      unsubscribeFromChannel(channelName);
    };
  }, [activeChannel, subscribeToChannel, unsubscribeFromChannel]);

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !activeChannel) return;
    const content = newMessage;
    setNewMessage('');
    try {
      const res = await api.post<any>(`/channels/${activeChannel.id}/messages`, { content });
      const msg = res?.data || res;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    } catch {
      setNewMessage(content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Create channel
  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    setCreating(true);
    try {
      const res = await api.post<any>('/channels', {
        name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
        description: newChannelDesc.trim() || undefined,
        type: newChannelType,
      });
      const channel = res?.data || res;
      setChannels((prev) => [channel, ...prev]);
      setShowCreateModal(false);
      setNewChannelName('');
      setNewChannelDesc('');
      setNewChannelType('GENERAL');
      handleSelectChannel(channel);
    } catch {
      // error
    } finally {
      setCreating(false);
    }
  };

  // Join channel
  const handleJoinChannel = async (channel: Channel) => {
    try {
      await api.post(`/channels/${channel.id}/join`);
      fetchChannels();
      handleSelectChannel(channel);
    } catch {
      // error
    }
  };

  // Toggle pin
  const handleTogglePin = async (messageId: string) => {
    if (!activeChannel) return;
    try {
      await api.post(`/channels/${activeChannel.id}/messages/${messageId}/pin`);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isPinned: !m.isPinned } : m))
      );
    } catch {
      // error
    }
  };

  const filteredChannels = channels.filter((ch) =>
    !searchQuery || ch.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader title={"Team Channels"} description={"Collaborate with your team in real-time"} />
        <Button className="gap-2 w-full sm:w-auto" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" />
          New Channel
        </Button>
      </div>

      {/* Create Channel Modal */}
      {showCreateModal && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Create Channel</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <Input
              placeholder="Channel name (e.g. sales-team)"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
            />
            <Input
              placeholder="Description (optional)"
              value={newChannelDesc}
              onChange={(e) => setNewChannelDesc(e.target.value)}
            />
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={newChannelType}
              onChange={(e) => setNewChannelType(e.target.value)}
            >
              <option value="GENERAL">General</option>
              <option value="DEPARTMENT">Department</option>
              <option value="PROJECT">Project</option>
              <option value="ANNOUNCEMENT">Announcement</option>
            </select>
            <Button onClick={handleCreateChannel} disabled={!newChannelName.trim() || creating} className="w-full">
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Channel
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Channel Layout */}
      <div className="grid gap-4 lg:grid-cols-4" style={{ height: 'calc(100vh - 250px)' }}>
        {/* Channel List */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search channels..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-2">
              <ScrollArea className="h-[500px]">
                {loadingChannels ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredChannels.length === 0 ? (
                  <div className="text-center py-8">
                    <Hash className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No channels yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Create one to get started</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredChannels.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => channel.isMember !== false ? handleSelectChannel(channel) : handleJoinChannel(channel)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          activeChannel?.id === channel.id
                            ? 'bg-primary text-white'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {getChannelIcon(channel.type)}
                        <span className="flex-1 text-left font-medium">{channel.name}</span>
                        {channel.isMember === false && (
                          <Badge variant="outline" className="text-xs">Join</Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* Message Area */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-3">
          <Card className="h-full flex flex-col">
            {activeChannel ? (
              <>
                {/* Channel Header */}
                <CardHeader className="border-b pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Hash className="w-5 h-5 text-primary" />
                      <div>
                        <h3 className="font-semibold">{activeChannel.name}</h3>
                        <p className="text-xs text-muted-foreground">{activeChannel.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="gap-1">
                        <Users className="w-4 h-4" />
                        {activeChannel.memberCount}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {/* Messages */}
                <CardContent className="flex-1 overflow-y-auto p-4">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Hash className="w-12 h-12 text-muted-foreground/20 mb-3" />
                      <p className="text-sm text-muted-foreground">No messages yet in #{activeChannel.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">Be the first to say something!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex gap-3 group ${
                            message.isPinned
                              ? 'bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg border-l-2 border-yellow-500'
                              : ''
                          }`}
                        >
                          <Avatar className="w-9 h-9 shrink-0">
                            {message.sender?.avatar && (
                              <AvatarImage src={getImageUrl(message.sender.avatar)} />
                            )}
                            <AvatarFallback className="bg-primary text-white text-xs">
                              {getInitials(message.sender?.firstName, message.sender?.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                {message.sender?.firstName} {message.sender?.lastName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(message.createdAt)}
                              </span>
                              {message.isPinned && <Pin className="w-3 h-3 text-yellow-600" />}
                              <button
                                onClick={() => handleTogglePin(message.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                                title={message.isPinned ? 'Unpin' : 'Pin'}
                              >
                                <Pin className="w-3 h-3 text-muted-foreground hover:text-primary" />
                              </button>
                            </div>
                            <p className="text-sm mt-1 whitespace-pre-wrap">{message.content}</p>
                            {message.reactions && message.reactions.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {message.reactions.map((reaction) => (
                                  <span
                                    key={reaction.id}
                                    className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs"
                                  >
                                    {reaction.emoji}
                                  </span>
                                ))}
                              </div>
                            )}
                            {message.replyCount > 0 && (
                              <p className="text-xs text-primary mt-1 cursor-pointer hover:underline">
                                {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </CardContent>

                {/* Message Input */}
                <div className="border-t p-4">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={`Message #${activeChannel.name}`}
                      className="flex-1"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <Button size="icon" onClick={handleSend} disabled={!newMessage.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Hash className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">Select a channel</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose a channel from the list or create a new one
                  </p>
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
