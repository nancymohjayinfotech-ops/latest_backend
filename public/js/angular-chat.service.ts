import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../environments/environment';

export interface ChatMessage {
  _id: string;
  groupId: string;
  senderId: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  senderName: string;
  content: string; // This will be automatically decrypted by the server
  messageType: 'text' | 'image' | 'file';
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private socket: Socket;
  private apiUrl = environment.apiUrl;
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();
  
  constructor(private http: HttpClient) {}
  
  /**
   * Initialize the chat service
   * @param userId User ID
   * @param userName User name
   * @param token Authentication token
   */
  initialize(userId: string, userName: string, token: string): void {
    // Initialize socket connection
    this.socket = io(environment.socketUrl, {
      auth: {
        token
      },
      withCredentials: true
    });
    
    // Authenticate with socket
    this.socket.emit('authenticate', { userId, name: userName });
    
    // Set up listeners
    this.setupSocketListeners();
  }
  
  /**
   * Join a chat group
   * @param groupId Group ID to join
   */
  joinGroup(groupId: string): void {
    this.socket.emit('joinGroup', groupId);
    
    // Load existing messages
    this.loadMessages(groupId);
  }
  
  /**
   * Leave a chat group
   * @param groupId Group ID to leave
   */
  leaveGroup(groupId: string): void {
    this.socket.emit('leaveGroup', groupId);
  }
  
  /**
   * Send a message to the current group
   * @param groupId Group ID
   * @param content Message content (will be encrypted on server)
   * @param messageType Message type
   */
  sendMessage(groupId: string, content: string, messageType: 'text' | 'image' | 'file' = 'text'): void {
    this.socket.emit('sendMessage', {
      groupId,
      content,
      messageType
    });
  }
  
  /**
   * Load messages for a group
   * @param groupId Group ID
   * @param page Page number
   * @param limit Messages per page
   */
  loadMessages(groupId: string, page = 1, limit = 50): void {
    this.http.get<{success: boolean, data: {messages: ChatMessage[]}}>(
      `${this.apiUrl}/api/messages/group/${groupId}?page=${page}&limit=${limit}`
    ).subscribe(response => {
      if (response.success && response.data.messages) {
        this.messagesSubject.next(response.data.messages);
      }
    });
  }
  
  /**
   * Mark a message as read
   * @param messageId Message ID
   */
  markAsRead(messageId: string): void {
    this.http.post(`${this.apiUrl}/api/messages/${messageId}/read`, {}).subscribe();
  }
  
  /**
   * Update a message
   * @param messageId Message ID
   * @param content New content (will be encrypted on server)
   */
  updateMessage(messageId: string, content: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/api/messages/${messageId}`, { content });
  }
  
  /**
   * Delete a message
   * @param messageId Message ID
   */
  deleteMessage(messageId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/api/messages/${messageId}`);
  }
  
  /**
   * Set up socket listeners
   */
  private setupSocketListeners(): void {
    // Listen for new messages
    this.socket.on('newMessage', (message: ChatMessage) => {
      const currentMessages = this.messagesSubject.value;
      this.messagesSubject.next([...currentMessages, message]);
    });
    
    // Listen for updated messages
    this.socket.on('messageUpdated', (updatedMessage: ChatMessage) => {
      const currentMessages = this.messagesSubject.value;
      const index = currentMessages.findIndex(msg => msg._id === updatedMessage._id);
      
      if (index !== -1) {
        const updatedMessages = [...currentMessages];
        updatedMessages[index] = updatedMessage;
        this.messagesSubject.next(updatedMessages);
      }
    });
    
    // Listen for deleted messages
    this.socket.on('messageDeleted', (data: {messageId: string}) => {
      const currentMessages = this.messagesSubject.value;
      const updatedMessages = currentMessages.filter(msg => msg._id !== data.messageId);
      this.messagesSubject.next(updatedMessages);
    });
  }
  
  /**
   * Disconnect the socket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
