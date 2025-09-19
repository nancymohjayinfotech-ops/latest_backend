const crypto = require('crypto');

/**
 * Encryption utility for chat messages
 * Uses AES-256-GCM encryption algorithm for secure message encryption
 */
class MessageEncryption {
  constructor(encryptionKey) {
    // The encryption key should be a 32-byte (256-bit) key
    this.encryptionKey = encryptionKey || process.env.MESSAGE_ENCRYPTION_KEY;
    
    // Check if encryption is enabled
    const encryptionEnabled = process.env.MESSAGE_ENCRYPTION_ENABLED !== 'false';
    
    if (!this.encryptionKey && encryptionEnabled) {
      console.error('WARNING: MESSAGE_ENCRYPTION_KEY is missing but encryption is enabled');
      throw new Error('MESSAGE_ENCRYPTION_KEY is required for message encryption');
    }
    
    // If encryption is disabled, use a default key (not secure, only for development)
    if (!this.encryptionKey && !encryptionEnabled) {
      console.warn('Message encryption disabled. Using default key (NOT SECURE)');
      this.encryptionKey = 'default_development_key_not_for_production';
    }
    
    // If the key is provided as a hex string, convert it to Buffer
    if (typeof this.encryptionKey === 'string') {
      // If key is shorter than 32 bytes, hash it to get a consistent length key
      if (Buffer.from(this.encryptionKey).length !== 32) {
        this.encryptionKey = crypto
          .createHash('sha256')
          .update(String(this.encryptionKey))
          .digest();
      } else {
        this.encryptionKey = Buffer.from(this.encryptionKey, 'hex');
      }
    }
  }

  /**
   * Encrypt a message
   * @param {string} message - The message to encrypt
   * @returns {string} - The encrypted message as a string in format: iv:authTag:encryptedData
   */
  encrypt(message) {
    if (!message) return message;
    
    // Skip encryption if disabled
    if (process.env.MESSAGE_ENCRYPTION_ENABLED === 'false') {
      return message;
    }
    
    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
      
      // Encrypt the message
      let encrypted = cipher.update(message, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get the authentication tag
      const authTag = cipher.getAuthTag().toString('hex');
      
      // Return the IV, authTag and encrypted message as a single string
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  /**
   * Decrypt a message
   * @param {string} encryptedMessage - The encrypted message in format: iv:authTag:encryptedData
   * @returns {string} - The decrypted message
   */
  decrypt(encryptedMessage) {
    if (!encryptedMessage) return encryptedMessage;
    
    // Skip decryption if encryption is disabled or if the message doesn't look encrypted
    if (process.env.MESSAGE_ENCRYPTION_ENABLED === 'false' || !this.isEncrypted(encryptedMessage)) {
      return encryptedMessage;
    }
    
    try {
      // Split the encrypted message into IV, authTag and data
      const [ivHex, authTagHex, encryptedData] = encryptedMessage.split(':');
      
      if (!ivHex || !authTagHex || !encryptedData) {
        throw new Error('Invalid encrypted message format');
      }
      
      // Convert hex strings back to buffers
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      // Create decipher
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt the message
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt message');
    }
  }

  /**
   * Check if a message is encrypted
   * @param {string} message - The message to check
   * @returns {boolean} - True if the message appears to be encrypted
   */
  isEncrypted(message) {
    if (!message || typeof message !== 'string') return false;
    
    // Check if the message matches our encryption format (iv:authTag:encryptedData)
    const parts = message.split(':');
    if (parts.length !== 3) return false;
    
    // Check if the first part is a valid hex IV (32 chars = 16 bytes)
    // and the second part is a valid hex authTag (32 chars = 16 bytes)
    const [ivHex, authTagHex] = parts;
    return /^[0-9a-f]{32}$/i.test(ivHex) && /^[0-9a-f]{32}$/i.test(authTagHex);
  }
}

// Create a singleton instance with the default key from environment
let encryptionInstance = null;

/**
 * Get the encryption instance (singleton pattern)
 * @param {string} customKey - Optional custom encryption key
 * @returns {MessageEncryption} - The encryption instance
 */
const getEncryptionInstance = (customKey) => {
  if (!encryptionInstance || customKey) {
    encryptionInstance = new MessageEncryption(customKey);
  }
  return encryptionInstance;
};

module.exports = {
  MessageEncryption,
  getEncryptionInstance
};
