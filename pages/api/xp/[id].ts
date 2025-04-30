import { NextApiRequest, NextApiResponse } from 'next';
import supabaseAdmin from '../../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  // GET - Get user XP information
  if (req.method === 'GET') {
    try {
      // Call the get_user_xp stored function
      const { data, error } = await supabaseAdmin.rpc('get_user_xp', {
        p_user_id: id
      });
      
      if (error) throw error;
      
      return res.status(200).json(data);
    } catch (error: any) {
      console.error('Error getting user XP:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}