// Vercel Serverless Function — Keep Supabase alive
// This endpoint is called by Vercel Cron every 5 days to prevent auto-sleep
export default async function handler(req, res) {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(200).json({ status: 'skipped', reason: 'No Supabase credentials' });
    }

    try {
        // Simple query to keep the database alive
        const response = await fetch(`${SUPABASE_URL}/rest/v1/applicants?select=count&limit=1`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        const data = await response.json();
        
        return res.status(200).json({
            status: 'ok',
            message: 'Supabase pinged successfully',
            timestamp: new Date().toISOString(),
            dbResponse: response.status
        });
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
