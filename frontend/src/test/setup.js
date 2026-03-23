import '@testing-library/jest-dom';

// Provide a fully functional localStorage mock.
// Some jsdom/vitest combinations expose a limited Storage object that lacks
// .clear(); this ensures all tests share a working implementation.
class LocalStorageMock {
  constructor() { this._store = {}; }
  clear()             { this._store = {}; }
  getItem(key)        { return Object.prototype.hasOwnProperty.call(this._store, key) ? this._store[key] : null; }
  setItem(key, value) { this._store[key] = String(value); }
  removeItem(key)     { delete this._store[key]; }
  get length()        { return Object.keys(this._store).length; }
  key(n)              { return Object.keys(this._store)[n] ?? null; }
}

Object.defineProperty(window, 'localStorage', {
  value: new LocalStorageMock(),
  writable: true,
});
