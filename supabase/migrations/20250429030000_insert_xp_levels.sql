-- Make sure we have the xp_levels table
CREATE TABLE IF NOT EXISTS xp_levels (
  level INTEGER PRIMARY KEY,
  required_xp INTEGER NOT NULL,
  title TEXT NOT NULL
);

-- Clear existing data to avoid duplicates
TRUNCATE TABLE xp_levels;

-- Insert level thresholds
INSERT INTO xp_levels (level, required_xp, title) VALUES
-- Novice tier (levels 1-5)
(1, 0, 'Novice'),
(2, 100, 'Novice'),
(3, 250, 'Novice'),
(4, 450, 'Novice'),
(5, 700, 'Novice'),
-- Apprentice tier (levels 6-10)
(6, 1000, 'Apprentice'),
(7, 1400, 'Apprentice'),
(8, 1900, 'Apprentice'),
(9, 2500, 'Apprentice'),
(10, 3200, 'Apprentice'),
-- Operator tier (levels 11-15)
(11, 4000, 'Operator'),
(12, 5000, 'Operator'),
(13, 6200, 'Operator'),
(14, 7600, 'Operator'),
(15, 9200, 'Operator'),
-- Expert tier (levels 16-20)
(16, 11000, 'Expert'),
(17, 13000, 'Expert'),
(18, 15500, 'Expert'),
(19, 18500, 'Expert'),
(20, 22000, 'Expert'),
-- Master tier (levels 21-25)
(21, 26000, 'Master'),
(22, 31000, 'Master'),
(23, 37000, 'Master'),
(24, 44000, 'Master'),
(25, 52000, 'Master'),
-- Legend tier (levels 26-30)
(26, 61000, 'Legend'),
(27, 71000, 'Legend'),
(28, 82000, 'Legend'),
(29, 94000, 'Legend'),
(30, 110000, 'Legend'),
-- Mythic tier (levels 31-35)
(31, 130000, 'Mythic'),
(32, 150000, 'Mythic'),
(33, 175000, 'Mythic'),
(34, 205000, 'Mythic'),
(35, 240000, 'Mythic'),
-- Transcendent tier (levels 36-40)
(36, 280000, 'Transcendent'),
(37, 325000, 'Transcendent'),
(38, 375000, 'Transcendent'),
(39, 430000, 'Transcendent'),
(40, 490000, 'Transcendent');
