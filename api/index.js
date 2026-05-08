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

  // ---- AUTH ----
  if (tabla === 'auth' && req.method === 'POST') {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }
    const { data, error } = await supabase
      .rpc('verificar_usuario', { p_username: username, p_password: password });
    if (error || !data || data.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    const usuario = data[0];
    return res.json({
      ok: true,
      bloqueria_id: usuario.bloqueria_id,
      nombre: usuario.nombre,
      username: usuario.username
    });
  }

  // ---- GET ----
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from(tabla)
      .select('*')
      .eq('bloqueria_id', id);
    if (error) return res.status(400).json({ error });
    return res.json(data);
  }

  // ---- POST ----
  if (req.method === 'POST') {
    const { data, error } = await supabase
      .from(tabla)
      .insert([req.body]);
    if (error) return res.status(400).json({ error });
    return res.json(data);
  }

  res.status(404).json({ error: 'Not found' });
};