import { NextApiRequest, NextApiResponse } from 'next';
import supabaseAdmin from '../../../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid race ID' });
  }
  
  // PUT - Finish race for a participant
  if (req.method === 'PUT') {
    try {
      const { user_id, finish_time, error_count, race_time } = req.body;
      
      if (!user_id || !finish_time) {
        return res.status(400).json({ error: 'User ID and finish time are required' });
      }
      
      // Update participant
      const { data, error } = await supabaseAdmin
        .from('race_participants')
        .update({
          finished: true,
          finish_time,
          progress: 100, // Assuming race is complete
          error_count: error_count || 0,
          race_time: race_time || 0
        })
        .eq('race_id', id)
        .eq('user_id', user_id)
        .select()
        .single();
        
      if (error) throw error;
      
      // Check if all participants are finished
      const { data: participants, error: participantsError } = await supabaseAdmin
        .from('race_participants')
        .select('*')
        .eq('race_id', id);
        
      if (participantsError) throw participantsError;
      
      const allFinished = participants?.every(p => p.finished) || false;
      
      // If all participants are finished, update race status
      if (allFinished) {
        const { error: updateError } = await supabaseAdmin
          .from('races')
          .update({ status: 'finished' })
          .eq('id', id);
          
        if (updateError) throw updateError;
      }
      
      return res.status(200).json({
        participant: data,
        all_finished: allFinished
      });
    } catch (error: any) {
      console.error('Error finishing race:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}