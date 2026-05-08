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

  // ---- ABONO / DEUDA DE CLIENTE ----
  if (tabla === 'clientes' && parts[1] === 'deuda' && req.method === 'POST') {
    const { cliente_id, monto } = req.body;
    const { data: clienteData } = await supabase
      .from('clientes')
      .select('deuda_actual')
      .eq('id', cliente_id)
      .single();
    const nuevaDeuda = Math.max(0, (clienteData.deuda_actual || 0) + parseFloat(monto));
    const { error } = await supabase
      .from('clientes')
      .update({ deuda_actual: nuevaDeuda })
      .eq('id', cliente_id);
    if (error) return res.status(400).json({ error });
    return res.json({ ok: true, deuda_actual: nuevaDeuda });
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

    // PRODUCTOS: si ya existe el mismo nombre, sumar stock
    if (tabla === 'productos') {
      const { bloqueria_id, nombre, precio, stock, stock_minimo } = req.body;

      // Buscar si ya existe un producto con ese nombre
      const { data: existe } = await supabase
        .from('productos')
        .select('*')
        .eq('bloqueria_id', bloqueria_id)
        .ilike('nombre', nombre)
        .single();

      if (existe) {
        // Ya existe → sumar stock
        const nuevoStock = (existe.stock || 0) + parseInt(stock);
        const { error } = await supabase
          .from('productos')
          .update({ stock: nuevoStock, precio: precio || existe.precio })
          .eq('id', existe.id);
        if (error) return res.status(400).json({ error });
        return res.json({ ok: true, mensaje: 'Stock actualizado', stock: nuevoStock });
      } else {
        // No existe → crear nuevo
        const { data, error } = await supabase
          .from('productos')
          .insert([req.body]);
        if (error) return res.status(400).json({ error });
        return res.json(data);
      }
    }

    // VENTAS: restar stock al producto vendido
    if (tabla === 'ventas') {
      const { producto_id, cantidad } = req.body;

      // Insertar la venta
      const { data, error } = await supabase
        .from('ventas')
        .insert([req.body]);
      if (error) return res.status(400).json({ error });

      // Restar stock
      const { data: prod } = await supabase
        .from('productos')
        .select('stock')
        .eq('id', producto_id)
        .single();

      if (prod) {
        const nuevoStock = Math.max(0, (prod.stock || 0) - parseInt(cantidad));
        await supabase
          .from('productos')
          .update({ stock: nuevoStock })
          .eq('id', producto_id);
      }

      return res.json(data);
    }

    // RESTO DE TABLAS (clientes, gastos)
    const { data, error } = await supabase
      .from(tabla)
      .insert([req.body]);
    if (error) return res.status(400).json({ error });
    return res.json(data);
  }

  res.status(404).json({ error: 'Not found' });
};