describe('PostgreSQL Integration Test Harness', () => {
  it('should be configured to target dedicated PostgreSQL database', () => {
    const dbUrl = process.env.DATABASE_URL;
    expect(dbUrl).toBeDefined();
    expect(dbUrl).toMatch(/^postgresql:\/\//);
    // Explicit invariant: real PostgreSQL, never SQLite
    expect(dbUrl).not.toMatch(/sqlite/i);
  });
});
