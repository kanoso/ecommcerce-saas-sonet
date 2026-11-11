import * as fs from 'fs';
import * as path from 'path';

/**
 * A plain Error that reaches HTTP answers 500 and, in a job, is retried as if
 * it were an outage. Every refusal of a use case is a domain error with a row
 * in the API error table (F6).
 */
describe('use cases throw domain errors only', () => {
  // Configuration mistakes at construction, never reached by a request.
  const allowed = new Set(['purge-sent-notifications.use-case.ts']);

  it('has no `throw new Error(` in a use case', () => {
    const offenders = fs
      .readdirSync(__dirname)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
      .filter((file) => !allowed.has(file))
      .flatMap((file) =>
        fs
          .readFileSync(path.join(__dirname, file), 'utf8')
          .split(/\r?\n/)
          .map((line, i) => ({ file, line: i + 1, text: line }))
          .filter(({ text }) => /throw new Error\(/.test(text)),
      )
      .map(({ file, line }) => `${file}:${line}`);

    expect(offenders).toEqual([]);
  });
});
