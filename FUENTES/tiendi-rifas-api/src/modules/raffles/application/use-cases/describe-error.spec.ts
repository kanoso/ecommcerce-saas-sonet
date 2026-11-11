import { describeError } from './describe-error';

describe('describeError (DT-13)', () => {
  it('names the error class and keeps a harmless message', () => {
    expect(describeError(new TypeError('Connection reset'))).toBe(
      'TypeError: Connection reset',
    );
  });

  it('adds the error code when there is one', () => {
    const error = Object.assign(new Error('Greeting never received'), {
      code: 'ETIMEDOUT',
    });

    expect(describeError(error)).toBe(
      'Error [ETIMEDOUT]: Greeting never received',
    );
  });

  it('hides an email address an SMTP server echoes back', () => {
    const error = new Error(
      '550 5.1.1 <ana.perez+rifa@example.com>: Recipient address rejected',
    );

    const text = describeError(error);

    expect(text).not.toContain('ana.perez');
    expect(text).not.toContain('example.com');
    expect(text).toBe('Error: 550 5.1.1 <[email]>: Recipient address rejected');
  });

  it('hides URLs and long token-like strings', () => {
    const text = describeError(
      new Error(
        'POST https://mail.example.com/send?key=abc failed with token eyJhbGciOiJIUzI1NiJ9abcdefghijkl',
      ),
    );

    expect(text).toBe('Error: POST [url] failed with token [token]');
  });

  it('cuts the text to 500 characters', () => {
    expect(describeError(new Error('x '.repeat(1000)))).toHaveLength(500);
  });

  it('describes a thrown value that is not an Error', () => {
    expect(describeError('boom to bob@example.com')).toBe(
      'Unknown: boom to [email]',
    );
  });
});
