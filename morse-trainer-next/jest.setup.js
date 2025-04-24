// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock the window.AudioContext which is not available in the Jest environment
global.AudioContext = jest.fn().mockImplementation(() => ({
  createOscillator: jest.fn().mockReturnValue({
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    frequency: { value: 0 },
    type: 'sine'
  }),
  createGain: jest.fn().mockReturnValue({
    gain: { value: 0 },
    connect: jest.fn()
  }),
  destination: {}
}));

global.HTMLMediaElement.prototype.pause = jest.fn();
global.HTMLMediaElement.prototype.play = jest.fn().mockImplementation(() => Promise.resolve());

// Mock for window.requestAnimationFrame
global.requestAnimationFrame = callback => {
  setTimeout(callback, 0);
  return 123; // A mock ID
};

// Mock for window.cancelAnimationFrame
global.cancelAnimationFrame = jest.fn();

// Mock for navigator.clipboard
Object.defineProperty(window.navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockImplementation(() => Promise.resolve()),
    readText: jest.fn().mockImplementation(() => Promise.resolve('')),
  },
  writable: true,
});

// Set up a mock for localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});