import { NextApiRequest, NextApiResponse } from 'next';
import supabaseAdmin from '../../../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid race ID' });
  }
  
  // GET - Get race details
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabaseAdmin
        .from('races')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return res.status(404).json({ error: 'Race not found' });
        }
        throw error;
      }
      
      return res.status(200).json(data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error getting race:', errorMessage);
      return res.status(500).json({ error: errorMessage });
    }
  }
  
  // PUT - Update race
  else if (req.method === 'PUT') {
    try {
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }
      
      const { data, error } = await supabaseAdmin
        .from('races')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      
      return res.status(200).json(data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error updating race:', errorMessage);
      return res.status(500).json({ error: errorMessage });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}