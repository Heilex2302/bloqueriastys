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
    if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    const { data, error } = await supabase.rpc('verificar_usuario', { p_username: username, p_password: password });
    if (error || !data || data.length === 0) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    const usuario = data[0];
    return res.json({ ok: true, bloqueria_id: usuario.bloqueria_id, nombre: usuario.nombre, username: usuario.username });
  }

  // ---- VERIFICAR PIN ADMIN ----
  if (tabla === 'admin' && parts[1] === 'verificar-pin' && req.method === 'POST') {
    const { bloqueria_id, pin } = req.body;
    const { data, error } = await supabase.from('usuarios').select('admin_pin').eq('bloqueria_id', bloqueria_id);
    if (error || !data || data.length === 0) return res.status(400).json({ ok: false });
    if (data[0].admin_pin !== pin) return res.status(401).json({ ok: false, error: 'PIN incorrecto' });
    return res.json({ ok: true });
  }

  // ---- ABONO / DEUDA DE CLIENTE ----
  if (tabla === 'clientes' && parts[1] === 'deuda' && req.method === 'POST') {
    const { cliente_id, monto } = req.body;
    const { data: clienteData } = await supabase.from('clientes').select('deuda_actual').eq('id', cliente_id).single();
    const nuevaDeuda = Math.max(0, (clienteData.deuda_actual || 0) + parseFloat(monto));
    const { error } = await supabase.from('clientes').update({ deuda_actual: nuevaDeuda }).eq('id', cliente_id);
    if (error) return res.status(400).json({ error });
    return res.json({ ok: true, deuda_actual: nuevaDeuda });
  }

  // ---- ELIMINAR REGISTRO ----
  if (tabla !== 'auth' && parts[1] === 'eliminar' && req.method === 'POST') {
    const { id } = req.body;

    // Si es una venta, devolver el stock al producto
    if (tabla === 'ventas') {
      const { data: venta } = await supabase.from('ventas').select('producto_id, cantidad').eq('id', id).single();
      if (venta) {
        const { data: prod } = await supabase.from('productos').select('stock').eq('id', venta.producto_id).single();
        if (prod) {
          const stockDevuelto = (prod.stock || 0) + parseInt(venta.cantidad);
          await supabase.from('productos').update({ stock: stockDevuelto }).eq('id', venta.producto_id);
        }
      }
    }

    const { error } = await supabase.from(tabla).delete().eq('id', id);
    if (error) return res.status(400).json({ error });
    return res.json({ ok: true });
  }

  // ---- EDITAR REGISTRO ----
  if (tabla !== 'auth' && parts[1] === 'editar' && req.method === 'POST') {
    const { id, ...campos } = req.body;

    // Si es una venta, ajustar el stock según la diferencia de cantidad
    if (tabla === 'ventas' && campos.cantidad !== undefined) {
      const { data: ventaAnterior } = await supabase.from('ventas').select('producto_id, cantidad').eq('id', id).single();
      if (ventaAnterior) {
        const cantAnterior = parseInt(ventaAnterior.cantidad);
        const cantNueva = parseInt(campos.cantidad);
        const diferencia = cantAnterior - cantNueva; // positivo = devolver stock, negativo = restar stock

        const productoId = campos.producto_id || ventaAnterior.producto_id;
        const { data: prod } = await supabase.from('productos').select('stock').eq('id', productoId).single();
        if (prod) {
          const nuevoStock = Math.max(0, (prod.stock || 0) + diferencia);
          await supabase.from('productos').update({ stock: nuevoStock }).eq('id', productoId);
        }
      }
    }

    const { error } = await supabase.from(tabla).update(campos).eq('id', id);
    if (error) return res.status(400).json({ error });
    return res.json({ ok: true });
  }

  // ---- GET ----
  if (req.method === 'GET') {
    const { data, error } = await supabase.from(tabla).select('*').eq('bloqueria_id', id);
    if (error) return res.status(400).json({ error });
    return res.json(data);
  }

  // ---- POST ----
  if (req.method === 'POST') {

    // PRODUCTOS: si ya existe el mismo nombre sumar stock
    if (tabla === 'productos') {
      const { bloqueria_id, nombre, precio, precio_bs, stock, stock_minimo } = req.body;
      const { data: existe } = await supabase.from('productos').select('*').eq('bloqueria_id', bloqueria_id).ilike('nombre', nombre).single();
      if (existe) {
        const nuevoStock = (existe.stock || 0) + parseInt(stock);
        const { error } = await supabase.from('productos').update({ stock: nuevoStock, precio: precio || existe.precio, precio_bs: precio_bs || existe.precio_bs, stock_minimo: stock_minimo || existe.stock_minimo }).eq('id', existe.id);
        if (error) return res.status(400).json({ error });
        return res.json({ ok: true, mensaje: 'Stock actualizado', stock: nuevoStock });
      } else {
        const { data, error } = await supabase.from('productos').insert([req.body]);
        if (error) return res.status(400).json({ error });
        return res.json(data);
      }
    }

    // VENTAS: verificar stock y restar
    if (tabla === 'ventas') {
      const { producto_id, cantidad } = req.body;

      // Verificar stock disponible
      const { data: prod } = await supabase.from('productos').select('stock, nombre').eq('id', producto_id).single();
      if (!prod) return res.status(400).json({ error: 'Producto no encontrado' });

      if (parseInt(cantidad) > prod.stock) {
        return res.status(400).json({
          error: `Stock insuficiente. Quieres vender ${cantidad} pero solo hay ${prod.stock} unidades de ${prod.nombre} disponibles.`
        });
      }

      const { data, error } = await supabase.from('ventas').insert([req.body]);
      if (error) return res.status(400).json({ error });

      // Restar stock
      const nuevoStock = prod.stock - parseInt(cantidad);
      await supabase.from('productos').update({ stock: nuevoStock }).eq('id', producto_id);

      return res.json(data);
    }

    // RESTO (clientes, gastos)
    const { data, error } = await supabase.from(tabla).insert([req.body]);
    if (error) return res.status(400).json({ error });
    return res.json(data);
  }

  res.status(404).json({ error: 'Not found' });
};