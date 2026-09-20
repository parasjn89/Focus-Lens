import { apiFetch } from './client.js';

/**
 * Fetches all conversations for the authenticated user.
 * @returns {Promise<{ conversations: Array }>}
 */
export async function fetchConversations() {
  return apiFetch('/api/messages/conversations');
}

/**
 * Fetches message history and buddy info for a specific conversation.
 * @param {string} conversationId
 * @returns {Promise<{ conversation: Object, messages: Array, buddy: Object }>}
 */
export async function fetchConversation(conversationId) {
  return apiFetch(`/api/messages/conversations/${conversationId}`);
}

/**
 * Sends a message or focus activity card to a conversation.
 * @param {string} conversationId
 * @param {string} content
 * @param {'TEXT' | 'ACTIVITY'} [messageType='TEXT']
 * @param {Object} [activityMetadata={}]
 * @returns {Promise<{ success: boolean, message: Object }>}
 */
export async function sendMessage(conversationId, content, messageType = 'TEXT', activityMetadata = {}) {
  return apiFetch(`/api/messages/conversations/${conversationId}`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      messageType,
      activityMetadata,
    }),
  });
}

/**
 * Marks unread messages in a conversation as read.
 * @param {string} conversationId
 * @returns {Promise<{ success: boolean }>}
 */
export async function markConversationRead(conversationId) {
  return apiFetch(`/api/messages/conversations/${conversationId}/read`, {
    method: 'PATCH',
  });
}

/**
 * Fetches total unread messages count for current user.
 * @returns {Promise<{ unreadCount: number }>}
 */
export async function fetchUnreadCount() {
  return apiFetch('/api/messages/unread-count');
}

/**
 * Fetches accepted Focus Buddies and pending buddy requests.
 * @returns {Promise<{ buddies: Array, pendingRequests: Array }>}
 */
export async function fetchBuddies() {
  return apiFetch('/api/buddies');
}

/**
 * Sends a new Focus Buddy request by username or email.
 * @param {string} usernameOrEmail
 * @returns {Promise<{ success: boolean, request: Object, targetUser: Object }>}
 */
export async function sendBuddyRequest(usernameOrEmail) {
  return apiFetch('/api/buddies/request', {
    method: 'POST',
    body: JSON.stringify({ usernameOrEmail }),
  });
}

/**
 * Accepts or declines an incoming buddy request.
 * @param {string} requestId
 * @param {'ACCEPT' | 'DECLINE'} action
 * @returns {Promise<{ success: boolean, status: string }>}
 */
export async function respondToBuddyRequest(requestId, action) {
  return apiFetch(`/api/buddies/requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });
}

/**
 * Removes a Focus Buddy relationship.
 * @param {string} buddyUserId
 * @returns {Promise<{ success: boolean }>}
 */
export async function removeBuddy(buddyUserId) {
  return apiFetch(`/api/buddies/${buddyUserId}`, {
    method: 'DELETE',
  });
}

/**
 * Initiates or retrieves an existing conversation with an accepted Focus Buddy.
 * @param {string} buddyUserId
 * @returns {Promise<{ success: boolean, conversation: Object }>}
 */
export async function startConversationWithBuddy(buddyUserId) {
  return apiFetch('/api/messages/start-with-buddy', {
    method: 'POST',
    body: JSON.stringify({ buddyUserId }),
  });
}
