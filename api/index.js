const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url.split('?')[0];
  const parts = url.replace('/api', '').split('/').filter(Boolean);
  const tabla = parts[0];
  const id = parts[1];

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from(tabla)
      .select('*')
      .eq('bloqueria_id', id);
    if (error) return res.status(400).json({ error });
    return res.json(data);
  }

  if (req.method === 'POST') {
    const { data, error } = await supabase
      .from(tabla)
      .insert([req.body]);
    if (error) return res.status(400).json({ error });
    return res.json(data);
  }

  res.status(404).json({ error: 'Not found' });
};