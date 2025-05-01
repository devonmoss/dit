import { NextApiRequest, NextApiResponse } from 'next';
import supabaseAdmin from '../../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // POST - Award XP to a user
  if (req.method === 'POST') {
    try {
      const { user_id, amount, source, metadata } = req.body;
      
      if (!user_id || !amount || !source) {
        return res.status(400).json({ error: 'User ID, amount, and source are required' });
      }
      
      // Call the award_xp stored function
      const { data, error } = await supabaseAdmin.rpc('award_xp', {
        p_user_id: user_id,
        p_amount: amount,
        p_reason: source,
        p_details: metadata || {}
      });
      
      if (error) throw error;
      
      // Get updated XP info
      const { data: xpInfo, error: xpError } = await supabaseAdmin.rpc('get_user_xp_info', {
        user_id: user_id
      });
      
      if (xpError) throw xpError;
      
      return res.status(200).json({
        success: true,
        xp_awarded: amount,
        ...xpInfo,
        leveledUp: data || false // data from award_xp is whether user leveled up
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error awarding XP:', errorMessage);
      return res.status(500).json({ error: errorMessage });
    }
  }
  
  // Method not allowed
  else {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}