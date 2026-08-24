import crypto from 'crypto';

class CredentialEncryptionService {
  constructor(encryptionKeyHex) {
    if (!encryptionKeyHex || encryptionKeyHex.length !== 64) {
      throw new Error('Invalid ENCRYPTION_KEY. Must be a 64 character hex string.');
    }
    this.key = Buffer.from(encryptionKeyHex, 'hex');
    this.algorithm = 'aes-256-gcm';
  }

  /**
   * @param {Object} data 
   * @returns {{ encryptedData: string, iv: string, authTag: string }}
   */
  encrypt(data) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    const jsonString = JSON.stringify(data);
    let encrypted = cipher.update(jsonString, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag
    };
  }

  /**
   * @param {string} encryptedDataHex 
   * @param {string} ivHex 
   * @param {string} authTagHex 
   * @returns {Object}
   */
  decrypt(encryptedDataHex, ivHex, authTagHex) {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedDataHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }
}

export default CredentialEncryptionService;
