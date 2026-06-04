export default async function handler(req, res) {
  try {
    // URL Backend Hugging Face dengan penanda khusus agar terlihat jelas di log
    const baseUrl = process.env.VITE_API_URL || 'https://mranxious-aware-backend.hf.space/';
    const backendUrl = baseUrl.endsWith('/') ? `${baseUrl}?source=vercel-cron` : `${baseUrl}/?source=vercel-cron`;
    
    // Melakukan request (ping) ke backend untuk mencegah mode sleep
    const response = await fetch(backendUrl);
    
    if (response.ok) {
      res.status(200).json({ status: 'awake', message: 'Hugging Face backend is awake!' });
    } else {
      res.status(response.status).json({ status: 'error', message: 'Backend reachable but returned error' });
    }
  } catch (error) {
    res.status(500).json({ status: 'failed', error: error.message });
  }
}
