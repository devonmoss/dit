import { NextApiRequest, NextApiResponse } from 'next';
import supabaseAdmin from '../../../lib/supabaseAdmin';

// Generate a simple ID for the race
const generateSimpleId = () => {
  return Math.random().toString(36).substring(2, 10);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // POST - Create a new race
  if (req.method === 'POST') {
    try {
      const { mode, created_by, char_sequence, text, level_id } = req.body;
      
      // Validate required fields
      if (!mode || !created_by || !text) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const raceId = generateSimpleId();
      
      // Create race in database
      const { data, error } = await supabaseAdmin
        .from('races')
        .insert([{
          id: raceId,
          created_by,
          mode,
          status: 'waiting',
          char_sequence,
          text,
          level_id: level_id || null
        }])
        .select()
        .single();
        
      if (error) throw error;
      
      return res.status(200).json(data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error creating race:', errorMessage);
      return res.status(500).json({ error: errorMessage });
    }
  }
  
  // GET - List races (optional, for future use)
  else if (req.method === 'GET') {
    try {
      // Add filters or limiting logic as needed
      const { data, error } = await supabaseAdmin
        .from('races')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) throw error;
      
      return res.status(200).json(data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error listing races:', errorMessage);
      return res.status(500).json({ error: errorMessage });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}