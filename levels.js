/*
  trainingLevels: Array of level definitions.
  type: 'standard' or 'checkpoint'
  id: unique identifier
  name: display name
  chars: array of characters for this level (for checkpoints, include review chars)
  strikeLimit: (optional, only for checkpoint) max mistakes before test ends
*/
window.trainingLevels = [
  {
    id: "level-1",
    name: "Level 1: E & T",
    type: "standard",
    chars: ["e", "t"],
  },
  {
    id: "level-2",
    name: "Level 2: A & N",
    type: "standard",
    chars: ["a", "n"],
  },
  {
    id: "checkpoint-1",
    name: "Checkpoint 1",
    type: "checkpoint",
    chars: ["e", "t", "a", "n"],
    strikeLimit: 3,
  },
  {
    id: "level-4",
    name: "Level 4: I & M",
    type: "standard",
    chars: ["i", "m"],
  },
  {
    id: "level-5",
    name: "Level 5: S & O",
    type: "standard",
    chars: ["s", "o"],
  },
  {
    id: "checkpoint-2",
    name: "Checkpoint 2",
    type: "checkpoint",
    chars: ["e", "t", "a", "n", "i", "m", "s", "o"],
    strikeLimit: 3,
  },
  {
    id: "level-7",
    name: "Level 7: D & U",
    type: "standard",
    chars: ["d", "u"],
  },
  {
    id: "level-8",
    name: "Level 8: R & K",
    type: "standard",
    chars: ["r", "k"],
  },
  {
    id: "checkpoint-3",
    name: "Checkpoint 3",
    type: "checkpoint",
    chars: ["e", "t", "a", "n", "i", "m", "s", "o", "d", "u", "r", "k"],
    strikeLimit: 3,
  },
  {
    id: "level-10",
    name: "Level 10: C & P",
    type: "standard",
    chars: ["c", "p"],
  },
  {
    id: "level-11",
    name: "Level 11: B & G",
    type: "standard",
    chars: ["b", "g"],
  },
  {
    id: "checkpoint-4",
    name: "Checkpoint 4",
    type: "checkpoint",
    chars: [
      "e",
      "t",
      "a",
      "n",
      "i",
      "m",
      "s",
      "o",
      "d",
      "u",
      "r",
      "k",
      "c",
      "p",
      "b",
      "g",
    ],
    strikeLimit: 3,
  },
  {
    id: "level-13",
    name: "Level 13: W & L",
    type: "standard",
    chars: ["w", "l"],
  },
  {
    id: "level-14",
    name: "Level 14: Q & H",
    type: "standard",
    chars: ["q", "h"],
  },
  {
    id: "checkpoint-5",
    name: "Checkpoint 5",
    type: "checkpoint",
    chars: [
      "e",
      "t",
      "a",
      "n",
      "i",
      "m",
      "s",
      "o",
      "d",
      "u",
      "r",
      "k",
      "c",
      "p",
      "b",
      "g",
      "w",
      "l",
      "q",
      "h",
    ],
    strikeLimit: 3,
  },
  {
    id: "level-16",
    name: "Level 16: F & Y",
    type: "standard",
    chars: ["f", "y"],
  },
  {
    id: "level-17",
    name: "Level 17: Z & V",
    type: "standard",
    chars: ["z", "v"],
  },
  {
    id: "level-18",
    name: "Level 18: X & J",
    type: "standard",
    chars: ["x", "j"],
  },
  {
    id: "checkpoint-6",
    name: "Checkpoint 6",
    type: "checkpoint",
    chars: [
      "e",
      "t",
      "a",
      "n",
      "i",
      "m",
      "s",
      "o",
      "d",
      "u",
      "r",
      "k",
      "c",
      "p",
      "b",
      "g",
      "w",
      "l",
      "q",
      "h",
      "f",
      "y",
      "z",
      "v",
      "x",
      "j",
    ],
    strikeLimit: 3,
  },
  {
    id: "level-20",
    name: "Level 20: 1 & 2",
    type: "standard",
    chars: ["1", "2"],
  },
  {
    id: "level-21",
    name: "Level 21: 3 & 4",
    type: "standard",
    chars: ["3", "4"],
  },
  {
    id: "level-22",
    name: "Level 22: 5 & 6",
    type: "standard",
    chars: ["5", "6"],
  },
  {
    id: "level-23",
    name: "Level 23: 7 & 8",
    type: "standard",
    chars: ["7", "8"],
  },
  {
    id: "level-24",
    name: "Level 24: 9 & 0",
    type: "standard",
    chars: ["9", "0"],
  },
  {
    id: "checkpoint-7",
    name: "Checkpoint 7",
    type: "checkpoint",
    chars: [
      "e",
      "t",
      "a",
      "n",
      "i",
      "m",
      "s",
      "o",
      "d",
      "u",
      "r",
      "k",
      "c",
      "p",
      "b",
      "g",
      "w",
      "l",
      "q",
      "h",
      "f",
      "y",
      "z",
      "v",
      "x",
      "j",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "0",
    ],
    strikeLimit: 3,
  },
];
