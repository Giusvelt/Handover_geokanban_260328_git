import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { X, Send, MessageSquare } from 'lucide-react';
import '../logbook-writer.css';

export default function ActivityChatModal({ activity, profile, onClose }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    const fetchMessages = async () => {
        if (!activity?.id) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('activity_messages')
            .select(`
                id, sender_id, sender_role, message_text, created_at,
                user_profiles:sender_id ( display_name )
            `)
            .eq('vessel_activity_id', activity.id)
            .order('created_at', { ascending: true });

        if (!error && data) {
            setMessages(data);

            if (profile?.role) {
                supabase
                    .from('activity_messages')
                    .update({ is_read: true })
                    .eq('vessel_activity_id', activity.id)
                    .neq('sender_role', profile.role)
                    .is('is_read', false)
                    .then();
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!activity?.id) return;

        fetchMessages();

        // Subscribe to new messages for this activity
        const channel = supabase
            .channel(`activity_chat_${activity.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'activity_messages',
                filter: `vessel_activity_id=eq.${activity.id}`
            }, (payload) => {
                fetchMessages(); // Reload to get sender info
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activity?.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !profile) return;

        try {
            await supabase.from('activity_messages').insert({
                vessel_activity_id: activity.id,
                sender_id: profile.id,
                sender_role: profile.role || 'crew',
                message_text: newMessage.trim(),
            });
            setNewMessage('');
            fetchMessages(); // Aggiorna istantaneamente la lista
        } catch (err) {
            console.error('Error sending message:', err);
        }
    };

    return (
        <div className="lem-overlay" onClick={onClose}>
            <div className="chat-modal" onClick={e => e.stopPropagation()}>
                <div className="chat-header">
                    <div className="lem-title-row">
                        <MessageSquare size={18} />
                        <h2>Chat: {activity?.activity}</h2>
                        <span className="lem-badge" style={{ background: '#3b82f6' }}>{activity?.vessel}</span>
                    </div>
                    <button className="lem-close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="chat-body">
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 20 }}>Loading messages...</div>
                    ) : messages.length === 0 ? (
                        <div className="chat-empty">No messages yet for this activity. Start the conversation!</div>
                    ) : (
                        messages.map(m => {
                            const isMine = m.sender_id === profile?.id;
                            const d = new Date(m.created_at);
                            return (
                                <div key={m.id} className={`chat-bubble ${isMine ? 'mine' : 'theirs'}`}>
                                    <div className="chat-meta">
                                        <span className="chat-sender">{m.user_profiles?.display_name || 'Admin'}</span>
                                        <span className="chat-time">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="chat-text">{m.message_text}</div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <form className="chat-footer" onSubmit={handleSend}>
                    <input
                        className="chat-input"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        autoFocus
                    />
                    <button type="submit" className="chat-send" disabled={!newMessage.trim()}>
                        <Send size={16} />
                    </button>
                </form>
            </div>
        </div>
    );
}
