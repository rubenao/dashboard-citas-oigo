require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'oigo_salud',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

app.get('/api/citas', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    let query = 'SELECT * FROM citas';
    let params = [];
    let conditions = [];

    if (fechaInicio && fechaFin) {
      conditions.push('fecha::date >= $1::date AND fecha::date <= $2::date');
      params.push(fechaInicio, fechaFin);
    } else if (fechaInicio) {
      conditions.push('fecha::date = $1::date');
      params.push(fechaInicio);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY fecha ASC, hora ASC';

    console.log('Query:', query, 'Params:', params);
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener citas' });
  }
});

app.get('/api/citas/resumen', async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    let query = `
      SELECT
        DATE(fecha) as fecha,
        COUNT(*) as total,
        COUNT(CASE WHEN estado = \'confirmada\' THEN 1 END) as confirmadas,
        COUNT(CASE WHEN estado = \'pendiente\' THEN 1 END) as pendientes,
        COUNT(CASE WHEN estado = \'cancelada\' THEN 1 END) as canceladas
      FROM citas
    `;
    let params = [];

    if (fechaInicio && fechaFin) {
      query += ' WHERE fecha >= $1 AND fecha <= $2';
      params.push(fechaInicio, fechaFin);
    }

    query += ' GROUP BY DATE(fecha) ORDER BY fecha';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});