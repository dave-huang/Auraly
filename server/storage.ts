// Storage interface for Auraly
// This app doesn't require persistent storage - all data is handled via API calls
// and localStorage on the client side

export interface IStorage {
  // No storage methods needed for this MVP
  // Analysis results are returned directly from API calls
  // Scan history is stored in browser localStorage
}

export class MemStorage implements IStorage {
  constructor() {
    // No in-memory storage needed for this stateless API
  }
}

export const storage = new MemStorage();
