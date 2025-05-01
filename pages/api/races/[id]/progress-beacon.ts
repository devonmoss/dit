import { NextApiRequest, NextApiResponse } from 'next';
import supabaseAdmin from '../../../../lib/supabaseAdmin';

interface UpdateData {
  progress: number;
  error_count?: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid race ID' });
  }
  
  // POST - Update participant progress from beacon
  if (req.method === 'POST') {
    try {
      const { user_id, progress, error_count } = req.body;
      
      if (!user_id || progress === undefined) {
        return res.status(400).json({ error: 'User ID and progress are required' });
      }
      
      const updateData: UpdateData = { progress: parseInt(progress, 10) };
      if (error_count !== undefined) {
        updateData.error_count = parseInt(error_count, 10);
      }
      
      await supabaseAdmin
        .from('race_participants')
        .update(updateData)
        .eq('race_id', id)
        .eq('user_id', user_id);
        
      return res.status(200).end();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error updating progress:', errorMessage);
      return res.status(500).json({ error: errorMessage });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}