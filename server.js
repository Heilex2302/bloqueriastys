const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ mensaje: 'BloqueriaSys funcionando ✅' });
});

// ---- PRODUCTOS (inventario) ----
app.get('/productos/:bloqueria_id', async (req, res) => {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('bloqueria_id', req.params.bloqueria_id);
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.post('/productos', async (req, res) => {
  const { data, error } = await supabase
    .from('productos')
    .insert([req.body]);
  if (error) return res.status(400).json({ error });
  res.json(data);
});

// ---- VENTAS ----
app.get('/ventas/:bloqueria_id', async (req, res) => {
  const { data, error } = await supabase
    .from('ventas')
    .select('*')
    .eq('bloqueria_id', req.params.bloqueria_id);
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.post('/ventas', async (req, res) => {
  const { data, error } = await supabase
    .from('ventas')
    .insert([req.body]);
  if (error) return res.status(400).json({ error });
  res.json(data);
});

// ---- CLIENTES ----
app.get('/clientes/:bloqueria_id', async (req, res) => {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('bloqueria_id', req.params.bloqueria_id);
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.post('/clientes', async (req, res) => {
  const { data, error } = await supabase
    .from('clientes')
    .insert([req.body]);
  if (error) return res.status(400).json({ error });
  res.json(data);
});

// ---- GASTOS ----
app.get('/gastos/:bloqueria_id', async (req, res) => {
  const { data, error } = await supabase
    .from('gastos')
    .select('*')
    .eq('bloqueria_id', req.params.bloqueria_id);
  if (error) return res.status(400).json({ error });
  res.json(data);
});

app.post('/gastos', async (req, res) => {
  const { data, error } = await supabase
    .from('gastos')
    .insert([req.body]);
  if (error) return res.status(400).json({ error });
  res.json(data);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});