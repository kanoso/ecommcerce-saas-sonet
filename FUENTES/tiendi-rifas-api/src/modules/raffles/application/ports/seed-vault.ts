export interface SeedVault {
  generateAndStoreSeed(raffleId: string): Promise<{
    commitmentHash: string;
    seedCiphertext: string;
  }>;
  revealSeed(raffleId: string, seedCiphertext: string): Promise<string>;
}
