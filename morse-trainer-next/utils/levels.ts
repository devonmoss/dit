// Training level types
export interface RawLevel {
  id: string;
  name: string;
  type: "standard" | "checkpoint";
  newChars?: string[];
  strikeLimit?: number;
}

export interface TrainingLevel {
  id: string;
  name: string;
  type: "standard" | "checkpoint";
  chars: string[];
  strikeLimit?: number;
}

// Raw levels definition with new characters for each level
const rawLevels: RawLevel[] = [
  {
    id: "level-1",
    name: "Level 1: E & T",
    type: "standard",
    newChars: ["e", "t"],
  },
  {
    id: "level-2",
    name: "Level 2: A & N",
    type: "standard",
    newChars: ["a", "n"],
  },
  {
    id: "checkpoint-1",
    name: "Checkpoint 1",
    type: "checkpoint",
    strikeLimit: 3,
  },
  {
    id: "level-4",
    name: "Level 4: I & M",
    type: "standard",
    newChars: ["i", "m"],
  },
  {
    id: "level-5",
    name: "Level 5: S & O",
    type: "standard",
    newChars: ["s", "o"],
  },
  {
    id: "checkpoint-2",
    name: "Checkpoint 2",
    type: "checkpoint",
    strikeLimit: 3,
  },
  {
    id: "level-7",
    name: "Level 7: D & U",
    type: "standard",
    newChars: ["d", "u"],
  },
  {
    id: "level-8",
    name: "Level 8: R & K",
    type: "standard",
    newChars: ["r", "k"],
  },
  {
    id: "checkpoint-3",
    name: "Checkpoint 3",
    type: "checkpoint",
    strikeLimit: 3,
  },
  {
    id: "level-10",
    name: "Level 10: C & P",
    type: "standard",
    newChars: ["c", "p"],
  },
  {
    id: "level-11",
    name: "Level 11: B & G",
    type: "standard",
    newChars: ["b", "g"],
  },
  {
    id: "checkpoint-4",
    name: "Checkpoint 4",
    type: "checkpoint",
    strikeLimit: 3,
  },
  {
    id: "level-13",
    name: "Level 13: W & L",
    type: "standard",
    newChars: ["w", "l"],
  },
  {
    id: "level-14",
    name: "Level 14: Q & H",
    type: "standard",
    newChars: ["q", "h"],
  },
  {
    id: "checkpoint-5",
    name: "Checkpoint 5",
    type: "checkpoint",
    strikeLimit: 3,
  },
  {
    id: "level-16",
    name: "Level 16: F & Y",
    type: "standard",
    newChars: ["f", "y"],
  },
  {
    id: "level-17",
    name: "Level 17: Z & V",
    type: "standard",
    newChars: ["z", "v"],
  },
  {
    id: "level-18",
    name: "Level 18: X & J",
    type: "standard",
    newChars: ["x", "j"],
  },
  {
    id: "checkpoint-6",
    name: "Checkpoint 6",
    type: "checkpoint",
    strikeLimit: 3,
  },
  {
    id: "level-20",
    name: "Level 20: 1 & 2",
    type: "standard",
    newChars: ["1", "2"],
  },
  {
    id: "level-21",
    name: "Level 21: 3 & 4",
    type: "standard",
    newChars: ["3", "4"],
  },
  {
    id: "level-22",
    name: "Level 22: 5 & 6",
    type: "standard",
    newChars: ["5", "6"],
  },
  {
    id: "level-23",
    name: "Level 23: 7 & 8",
    type: "standard",
    newChars: ["7", "8"],
  },
  {
    id: "level-24",
    name: "Level 24: 9 & 0",
    type: "standard",
    newChars: ["9", "0"],
  },
  {
    id: "checkpoint-7",
    name: "Checkpoint 7",
    type: "checkpoint",
    strikeLimit: 3,
  },
];

// Build the final training levels by accumulating characters
export const buildTrainingLevels = (): TrainingLevel[] => {
  const trainingLevels: TrainingLevel[] = [];
  let cumulative: string[] = [];
  
  rawLevels.forEach((lvl) => {
    if (lvl.type === "standard" && Array.isArray(lvl.newChars)) {
      cumulative = [...cumulative, ...lvl.newChars];
      trainingLevels.push({
        id: lvl.id,
        name: lvl.name,
        type: lvl.type,
        chars: [...cumulative],
      });
    } else if (lvl.type === "checkpoint") {
      trainingLevels.push({
        id: lvl.id,
        name: lvl.name,
        type: lvl.type,
        chars: [...cumulative],
        strikeLimit: lvl.strikeLimit,
      });
    }
  });
  
  return trainingLevels;
};

// Export the pre-built training levels
export const trainingLevels = buildTrainingLevels(); 