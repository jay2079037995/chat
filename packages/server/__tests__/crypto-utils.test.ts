/**
 * CryptoUtils 加解密工具测试
 */
import { encryptApiKey, decryptApiKey, maskApiKey } from '../src/modules/bot/CryptoUtils';

describe('CryptoUtils', () => {
  it('should encrypt and decrypt API key correctly', () => {
    const key = 'sk-abc123456789xyz';
    const encrypted = encryptApiKey(key);
    expect(encrypted).not.toBe(key);
    expect(encrypted.split(':')).toHaveLength(3);

    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(key);
  });

  it('should produce different ciphertexts for the same plaintext (random IV)', () => {
    const key = 'sk-test-key';
    const e1 = encryptApiKey(key);
    const e2 = encryptApiKey(key);
    expect(e1).not.toBe(e2);
    expect(decryptApiKey(e1)).toBe(key);
    expect(decryptApiKey(e2)).toBe(key);
  });

  it('should throw on invalid encrypted format', () => {
    expect(() => decryptApiKey('invalid')).toThrow('Invalid encrypted format');
    expect(() => decryptApiKey('a:b')).toThrow('Invalid encrypted format');
  });

  it('should mask API key correctly', () => {
    expect(maskApiKey('sk-abc123456789')).toBe('sk-****6789');
    // maskApiKey uses indexOf('-') for prefix, so '_' doesn't count as separator
    expect(maskApiKey('key_abcdefghij')).toBe('****ghij');
    expect(maskApiKey('short')).toBe('****');
    expect(maskApiKey('abcdefghij')).toBe('****ghij');
  });
});
