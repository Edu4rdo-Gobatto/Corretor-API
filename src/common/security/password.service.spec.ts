import { verify } from 'argon2';
import { PasswordService } from './password.service';

describe('password hashing', () => {
  const passwords = new PasswordService();

  it('stores a salted Argon2id hash that verifies with the real library', async () => {
    const password = 'test-password-with-12-characters';
    const hash = await passwords.hash(password);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain(password);
    expect(await verify(hash, password)).toBe(true);
    expect(await passwords.hash(password)).not.toBe(hash);
  });

  it('accepts only the correct password', async () => {
    const hash = await passwords.hash('correct-test-password');
    expect(await passwords.verify(hash, 'correct-test-password')).toBe(true);
    expect(await passwords.verify(hash, 'incorrect-password')).toBe(false);
  });
});
