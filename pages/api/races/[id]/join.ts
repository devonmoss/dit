import { NextApiRequest, NextApiResponse } from 'next';
import supabaseAdmin from '../../../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid race ID' });
  }
  
  // POST - Join a race
  if (req.method === 'POST') {
    try {
      const { user_id, name } = req.body;
      
      if (!user_id || !name) {
        return res.status(400).json({ error: 'User ID and name are required' });
      }
      
      // Check if race exists
      const { data: race, error: raceError } = await supabaseAdmin
        .from('races')
        .select('*')
        .eq('id', id)
        .single();
        
      if (raceError) {
        if (raceError.code === 'PGRST116') { // No rows returned
          return res.status(404).json({ error: 'Race not found' });
        }
        throw raceError;
      }
      
      // Check if user is already a participant
      const { data: existingParticipant, error: participantError } = await supabaseAdmin
        .from('race_participants')
        .select('*')
        .eq('race_id', id)
        .eq('user_id', user_id)
        .single();
        
      if (participantError && participantError.code !== 'PGRST116') { // Code for no rows returned
        throw participantError;
      }
      
      let participantData;
      
      // Add user as participant if not already present
      if (!existingParticipant) {
        const { data: newParticipant, error: insertError } = await supabaseAdmin
          .from('race_participants')
          .insert([{
            race_id: id,
            user_id,
            name,
            progress: 0,
            finished: false
          }])
          .select()
          .single();
          
        if (insertError) throw insertError;
        participantData = newParticipant;
      } else {
        participantData = existingParticipant;
      }
      
      // Get all participants
      const { data: participants, error: participantsError } = await supabaseAdmin
        .from('race_participants')
        .select('*')
        .eq('race_id', id);
        
      if (participantsError) throw participantsError;
      
      // Return race data and participants
      return res.status(200).json({
        race,
        participant: participantData,
        participants: participants || []
      });
    } catch (error: any) {
      console.error('Error joining race:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}