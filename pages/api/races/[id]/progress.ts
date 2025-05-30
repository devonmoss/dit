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
  
  // PUT - Update participant progress
  if (req.method === 'PUT') {
    try {
      const { user_id, progress, error_count } = req.body;
      
      if (!user_id || progress === undefined) {
        return res.status(400).json({ error: 'User ID and progress are required' });
      }
      
      const updateData: UpdateData = { progress };
      if (error_count !== undefined) {
        updateData.error_count = error_count;
      }
      
      const { data, error } = await supabaseAdmin
        .from('race_participants')
        .update(updateData)
        .eq('race_id', id)
        .eq('user_id', user_id)
        .select()
        .single();
        
      if (error) throw error;
      
      return res.status(200).json(data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error updating progress:', errorMessage);
      return res.status(500).json({ error: errorMessage });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}