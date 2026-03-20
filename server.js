const express = require('express');
const path = require('path');
const fs = require('fs');
const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());

// Base de datos (persistencia con notas.json)
let notas = [];
cargarNotas();

function cargarNotas() {
    try {
        if (fs.existsSync('notas.json')) {
            const data = fs.readFileSync('notas.json', 'utf-8');
            notas = JSON.parse(data);
        }
    } catch (error) {
        console.error('Error al cargar notas.json:', error);
        notas = [];
    }
}

function guardarNotas() {
    try {
        fs.writeFileSync('notas.json', JSON.stringify(notas, null, 2));
    } catch (error) {
        console.error('Error al guardar notas.json:', error);
    }
}

// Ruta principal (mostrar HTML)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ver notas
app.get('/notas', (req, res) => {
    res.json(notas);
});

// Agregar nota
app.post('/agregar', (req, res) => {
    try {
        const nota = req.body.texto;

        // Validación
        if (!nota || typeof nota !== 'string') {
            return res.status(400).json({ error: 'El texto es requerido y debe ser un string' });
        }

        if (nota.trim() === '') {
            return res.status(400).json({ error: 'La nota no puede estar vacía' });
        }

        notas.push(nota.trim());
        guardarNotas();

        res.status(201).json({ mensaje: 'Nota agregada', notas });
    } catch (error) {
        console.error('Error al agregar nota:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Eliminar nota
app.delete('/eliminar/:index', (req, res) => {
    try {
        const index = parseInt(req.params.index);

        // Validación
        if (isNaN(index) || index < 0 || index >= notas.length) {
            return res.status(400).json({ error: 'Índice inválido' });
        }

        const notaEliminada = notas[index];
        notas.splice(index, 1);
        guardarNotas();

        res.json({ mensaje: 'Nota eliminada', notaEliminada, notas });
    } catch (error) {
        console.error('Error al eliminar nota:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Editar nota
app.put('/editar/:index', (req, res) => {
    try {
        const index = parseInt(req.params.index);
        const nuevoTexto = req.body.texto;

        // Validación de índice
        if (isNaN(index) || index < 0 || index >= notas.length) {
            return res.status(400).json({ error: 'Índice inválido' });
        }

        // Validación de texto
        if (!nuevoTexto || typeof nuevoTexto !== 'string') {
            return res.status(400).json({ error: 'El texto es requerido y debe ser un string' });
        }

        if (nuevoTexto.trim() === '') {
            return res.status(400).json({ error: 'La nota no puede estar vacía' });
        }

        const notaAnterior = notas[index];
        notas[index] = nuevoTexto.trim();
        guardarNotas();

        res.json({ mensaje: 'Nota editada', notaAnterior, notaNueva: notas[index], notas });
    } catch (error) {
        console.error('Error al editar nota:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
