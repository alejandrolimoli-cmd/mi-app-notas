const express = require('express');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());

// Configuración de MongoDB
const MONGODB_URI = process.env.mongodb_url;
let db = null;
const COLLECTION_NAME = 'notas';

// Conectar a MongoDB
async function conectarMongo() {
    if (!MONGODB_URI) {
        console.error('❌ Error: mongodb_url no está definida');
        process.exit(1);
    }

    try {
        const client = new MongoClient(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        
        await client.connect();
        db = client.db();
        console.log('✅ Conectado a MongoDB');
    } catch (error) {
        console.error('❌ Error al conectar a MongoDB:', error.message);
        process.exit(1);
    }
}

// Ruta principal (mostrar HTML)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ver notas
app.get('/notas', async (req, res) => {
    try {
        const notas = await db.collection(COLLECTION_NAME).find({}).toArray();
        // Retornar las notas completas con usuario y texto
        const notasFormato = notas.map(nota => ({
            usuario: nota.usuario || 'Anónimo',
            texto: nota.texto
        }));
        res.json(notasFormato);
    } catch (error) {
        console.error('Error al obtener notas:', error);
        res.status(500).json({ error: 'Error al obtener notas' });
    }
});

// Agregar nota
app.post('/agregar', async (req, res) => {
    try {
        const usuario = req.body.usuario;
        const nota = req.body.texto;

        // Validación de usuario
        if (!usuario || typeof usuario !== 'string') {
            return res.status(400).json({ error: 'El usuario es requerido y debe ser un string' });
        }

        if (usuario.trim() === '') {
            return res.status(400).json({ error: 'El usuario no puede estar vacío' });
        }

        // Validación de nota
        if (!nota || typeof nota !== 'string') {
            return res.status(400).json({ error: 'El texto es requerido y debe ser un string' });
        }

        if (nota.trim() === '') {
            return res.status(400).json({ error: 'La nota no puede estar vacía' });
        }

        const result = await db.collection(COLLECTION_NAME).insertOne({
            usuario: usuario.trim(),
            texto: nota.trim(),
            fecha: new Date()
        });

        const notas = await db.collection(COLLECTION_NAME).find({}).toArray();
        const notasFormato = notas.map(n => ({
            usuario: n.usuario || 'Anónimo',
            texto: n.texto
        }));

        res.status(201).json({ mensaje: 'Nota agregada', notas: notasFormato });
    } catch (error) {
        console.error('Error al agregar nota:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Eliminar nota
app.delete('/eliminar/:index', async (req, res) => {
    try {
        const index = parseInt(req.params.index);

        // Obtener todas las notas
        const notas = await db.collection(COLLECTION_NAME).find({}).toArray();

        // Validación
        if (isNaN(index) || index < 0 || index >= notas.length) {
            return res.status(400).json({ error: 'Índice inválido' });
        }

        const notaAEliminar = notas[index];
        await db.collection(COLLECTION_NAME).deleteOne({ _id: notaAEliminar._id });

        const notasActualizadas = await db.collection(COLLECTION_NAME).find({}).toArray();
        const notasFormato = notasActualizadas.map(n => ({
            usuario: n.usuario || 'Anónimo',
            texto: n.texto
        }));

        res.json({ mensaje: 'Nota eliminada', notaEliminada: notaAEliminar.texto, notas: notasFormato });
    } catch (error) {
        console.error('Error al eliminar nota:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Editar nota
app.put('/editar/:index', async (req, res) => {
    try {
        const index = parseInt(req.params.index);
        const nuevoTexto = req.body.texto;

        // Obtener todas las notas
        const notas = await db.collection(COLLECTION_NAME).find({}).toArray();

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

        const notaAEditar = notas[index];
        const notaAnterior = notaAEditar.texto;

        await db.collection(COLLECTION_NAME).updateOne(
            { _id: notaAEditar._id },
            { $set: { texto: nuevoTexto.trim(), fechaModificacion: new Date() } }
        );

        const notasActualizadas = await db.collection(COLLECTION_NAME).find({}).toArray();
        const notasFormato = notasActualizadas.map(n => ({
            usuario: n.usuario || 'Anónimo',
            texto: n.texto
        }));

        res.json({ mensaje: 'Nota editada', notaAnterior, notaNueva: nuevoTexto.trim(), notas: notasFormato });
    } catch (error) {
        console.error('Error al editar nota:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.listen(PORT, async () => {
    await conectarMongo();
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
