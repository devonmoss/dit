import { NextApiRequest, NextApiResponse } from 'next';
import supabaseAdmin from '../../../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid race ID' });
  }
  
  // GET - Get race participants
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabaseAdmin
        .from('race_participants')
        .select('*')
        .eq('race_id', id);
        
      if (error) throw error;
      
      return res.status(200).json(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error getting race participants:', errorMessage);
      return res.status(500).json({ error: errorMessage });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}