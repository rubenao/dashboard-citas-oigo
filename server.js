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

app.put('/api/citas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha, hora, paciente_nombre, sede, servicio, telefono, estado } = req.body;

    const result = await pool.query(
      `UPDATE citas SET fecha=$1, hora=$2, paciente_nombre=$3, sede=$4, servicio=$5, telefono=$6, estado=$7
       WHERE id=$8 RETURNING *`,
      [fecha, hora, paciente_nombre, sede, servicio, telefono, estado, id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Cita no encontrada' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar cita:', error);
    res.status(500).json({ error: 'Error al actualizar cita' });
  }
});

app.delete('/api/citas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM citas WHERE id=$1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Cita no encontrada' });
    res.json({ deleted: result.rows[0].id });
  } catch (error) {
    console.error('Error al eliminar cita:', error);
    res.status(500).json({ error: 'Error al eliminar cita' });
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