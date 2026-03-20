const express = require('express');
const path = require('path');
const fs = require('fs');
const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());

// Base de datos falsa (por ahora)
let notas = [];

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
    const nota = req.body.texto;
    notas.push(nota);

    fs.writeFileSync('notas.json', JSON.stringify(notas));

    res.send('Nota agregada');
});
// Eliminar nota
app.delete('/eliminar/:index', (req, res) => {
    const index = req.params.index;

    notas.splice(index, 1);

    fs.writeFileSync('notas.json', JSON.stringify(notas));

    res.send('Nota eliminada');
});
// Editar nota
app.put('/editar/:index', (req, res) => {
    const index = req.params.index;
    const nuevoTexto = req.body.texto;

    notas[index] = nuevoTexto;

    fs.writeFileSync('notas.json', JSON.stringify(notas));

    res.send('Nota editada');
});
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
