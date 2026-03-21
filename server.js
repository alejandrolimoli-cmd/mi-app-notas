const express = require('express');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());

// Configuración de MongoDB
const MONGODB_URI = process.env.mongodb_url;
let db = null;
const COLLECTION_NAME = 'notas';
const USUARIOS_COLLECTION = 'usuarios';
const GRUPOS_COLLECTION = 'grupos';

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

// Función para crear admin si no existe
async function crearAdminSiNoExiste() {
    try {
        const adminExiste = await db.collection(USUARIOS_COLLECTION).findOne({ usuario: 'goldiyenadmin' });
        if (!adminExiste) {
            const passwordHash = await bcrypt.hash('41794399', 10);
            await db.collection(USUARIOS_COLLECTION).insertOne({
                usuario: 'goldiyenadmin',
                password: passwordHash,
                isAdmin: true,
                fecha: new Date()
            });
            console.log('✅ Usuario admin creado: goldiyenadmin');
        }
    } catch (error) {
        console.error('Error al crear admin:', error);
    }
}

// Ruta principal (mostrar HTML)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Registrar usuario
app.post('/registrar', async (req, res) => {
    try {
        const usuario = req.body.usuario;
        const password = req.body.password;

        if (!usuario || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
        }

        // Verificar si el usuario ya existe
        const usuarioExistente = await db.collection(USUARIOS_COLLECTION).findOne({ usuario });
        if (usuarioExistente) {
            return res.status(400).json({ error: 'El usuario ya existe' });
        }

        // Hashear contraseña
        const passwordHash = await bcrypt.hash(password, 10);

        // Guardar usuario
        await db.collection(USUARIOS_COLLECTION).insertOne({
            usuario,
            password: passwordHash,
            fecha: new Date()
        });

        res.status(201).json({ mensaje: 'Usuario registrado exitosamente' });
    } catch (error) {
        console.error('Error al registrar:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Login
app.post('/login', async (req, res) => {
    try {
        const usuario = req.body.usuario;
        const password = req.body.password;

        if (!usuario || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
        }

        // Buscar usuario
        const usuarioDoc = await db.collection(USUARIOS_COLLECTION).findOne({ usuario });
        if (!usuarioDoc) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        // Validar contraseña
        const passwordValida = await bcrypt.compare(password, usuarioDoc.password);
        if (!passwordValida) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }

        res.json({ 
            mensaje: 'Login exitoso', 
            usuario,
            isAdmin: usuarioDoc.isAdmin || false
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
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
        const usuarioSolicitante = req.body.usuario;
        const isAdmin = req.body.isAdmin || false;

        // Obtener todas las notas
        const notas = await db.collection(COLLECTION_NAME).find({}).toArray();

        // Validación
        if (isNaN(index) || index < 0 || index >= notas.length) {
            return res.status(400).json({ error: 'Índice inválido' });
        }

        const notaAEliminar = notas[index];

        // Validar que sea admin O el propietario
        if (!isAdmin && notaAEliminar.usuario !== usuarioSolicitante) {
            return res.status(403).json({ error: 'Solo puedes eliminar tus propias notas' });
        }

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
        const usuarioSolicitante = req.body.usuario;

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

        // Validar que el usuario sea el propietario
        if (notaAEditar.usuario !== usuarioSolicitante) {
            return res.status(403).json({ error: 'Solo puedes editar tus propias notas' });
        }

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

// ===== ENDPOINTS DE GRUPOS =====

// Función para generar código de invitación único
async function generarCodigoInvitacion() {
    let codigo;
    let existe = true;
    while (existe) {
        codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
        const grupo = await db.collection(GRUPOS_COLLECTION).findOne({ codigo });
        existe = !!grupo;
    }
    return codigo;
}

// Crear grupo
app.post('/crear-grupo', async (req, res) => {
    try {
        const creator = req.body.usuario;
        const nombreGrupo = req.body.nombreGrupo;

        if (!creator || !nombreGrupo) {
            return res.status(400).json({ error: 'Usuario y nombre del grupo son requeridos' });
        }

        const codigo = await generarCodigoInvitacion();

        const nuevoGrupo = {
            nombre: nombreGrupo,
            creador: creator,
            codigo: codigo,
            miembros: [creator],
            notas: [],
            fecha: new Date()
        };

        const result = await db.collection(GRUPOS_COLLECTION).insertOne(nuevoGrupo);

        res.status(201).json({ 
            mensaje: 'Grupo creado', 
            grupoId: result.insertedId,
            codigo: codigo,
            grupo: nuevoGrupo
        });
    } catch (error) {
        console.error('Error al crear grupo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Unirse a un grupo con código
app.post('/unirse-grupo', async (req, res) => {
    try {
        const usuario = req.body.usuario;
        const codigo = req.body.codigo;

        if (!usuario || !codigo) {
            return res.status(400).json({ error: 'Usuario y código son requeridos' });
        }

        const grupo = await db.collection(GRUPOS_COLLECTION).findOne({ codigo });
        if (!grupo) {
            return res.status(404).json({ error: 'Código de invitación inválido' });
        }

        if (grupo.miembros.includes(usuario)) {
            return res.status(400).json({ error: 'Ya eres miembro de este grupo' });
        }

        await db.collection(GRUPOS_COLLECTION).updateOne(
            { codigo },
            { $push: { miembros: usuario } }
        );

        res.json({ mensaje: 'Te uniste al grupo', grupo: grupo.nombre });
    } catch (error) {
        console.error('Error al unirse al grupo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener mis grupos
app.get('/mis-grupos/:usuario', async (req, res) => {
    try {
        const usuario = req.params.usuario;

        const grupos = await db.collection(GRUPOS_COLLECTION)
            .find({ miembros: usuario })
            .toArray();

        const gruposFormato = grupos.map(g => ({
            id: g._id,
            nombre: g.nombre,
            creador: g.creador,
            codigo: g.codigo,
            miembros: g.miembros,
            notasCount: g.notas ? g.notas.length : 0,
            esCreador: g.creador === usuario
        }));

        res.json(gruposFormato);
    } catch (error) {
        console.error('Error al obtener grupos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Obtener notas de un grupo
app.get('/grupo/:grupoId/notas', async (req, res) => {
    try {
        const grupoId = new ObjectId(req.params.grupoId);

        const grupo = await db.collection(GRUPOS_COLLECTION).findOne({ _id: grupoId });
        if (!grupo) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }

        const notas = grupo.notas || [];
        res.json(notas);
    } catch (error) {
        console.error('Error al obtener notas del grupo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Agregar nota a un grupo
app.post('/grupo/:grupoId/agregar-nota', async (req, res) => {
    try {
        const grupoId = new ObjectId(req.params.grupoId);
        const usuario = req.body.usuario;
        const texto = req.body.texto;

        if (!usuario || !texto) {
            return res.status(400).json({ error: 'Usuario y texto son requeridos' });
        }

        const grupo = await db.collection(GRUPOS_COLLECTION).findOne({ _id: grupoId });
        if (!grupo) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }

        if (!grupo.miembros.includes(usuario)) {
            return res.status(403).json({ error: 'No eres miembro de este grupo' });
        }

        const nota = {
            id: new ObjectId(),
            usuario: usuario,
            texto: texto.trim(),
            fecha: new Date()
        };

        await db.collection(GRUPOS_COLLECTION).updateOne(
            { _id: grupoId },
            { $push: { notas: nota } }
        );

        const notasActualizadas = grupo.notas ? [...grupo.notas, nota] : [nota];
        res.json({ mensaje: 'Nota agregada al grupo', notas: notasActualizadas });
    } catch (error) {
        console.error('Error al agregar nota al grupo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Eliminar nota del grupo
app.delete('/grupo/:grupoId/eliminar/:notaId', async (req, res) => {
    try {
        const grupoId = new ObjectId(req.params.grupoId);
        const notaId = new ObjectId(req.params.notaId);
        const usuario = req.body.usuario;
        const isAdmin = req.body.isAdmin || false;

        const grupo = await db.collection(GRUPOS_COLLECTION).findOne({ _id: grupoId });
        if (!grupo) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }

        const nota = grupo.notas.find(n => n.id.equals(notaId));
        if (!nota) {
            return res.status(404).json({ error: 'Nota no encontrada' });
        }

        // Solo el propietario o admin puede borrar
        if (!isAdmin && nota.usuario !== usuario) {
            return res.status(403).json({ error: 'Solo puedes eliminar tus propias notas' });
        }

        await db.collection(GRUPOS_COLLECTION).updateOne(
            { _id: grupoId },
            { $pull: { notas: { id: notaId } } }
        );

        const notasActualizadas = grupo.notas.filter(n => !n.id.equals(notaId));
        res.json({ mensaje: 'Nota eliminada del grupo', notas: notasActualizadas });
    } catch (error) {
        console.error('Error al eliminar nota del grupo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Editar nota del grupo
app.put('/grupo/:grupoId/editar/:notaId', async (req, res) => {
    try {
        const grupoId = new ObjectId(req.params.grupoId);
        const notaId = new ObjectId(req.params.notaId);
        const usuario = req.body.usuario;
        const nuevoTexto = req.body.texto;

        if (!nuevoTexto) {
            return res.status(400).json({ error: 'El texto no puede estar vacío' });
        }

        const grupo = await db.collection(GRUPOS_COLLECTION).findOne({ _id: grupoId });
        if (!grupo) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }

        const nota = grupo.notas.find(n => n.id.equals(notaId));
        if (!nota) {
            return res.status(404).json({ error: 'Nota no encontrada' });
        }

        // Solo el propietario puede editar
        if (nota.usuario !== usuario) {
            return res.status(403).json({ error: 'Solo puedes editar tus propias notas' });
        }

        await db.collection(GRUPOS_COLLECTION).updateOne(
            { _id: grupoId, 'notas.id': notaId },
            { $set: { 'notas.$.texto': nuevoTexto.trim() } }
        );

        const notasActualizadas = grupo.notas.map(n => 
            n.id.equals(notaId) ? { ...n, texto: nuevoTexto.trim() } : n
        );

        res.json({ mensaje: 'Nota editada', notas: notasActualizadas });
    } catch (error) {
        console.error('Error al editar nota del grupo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Eliminar grupo
app.delete('/grupo/:grupoId', async (req, res) => {
    try {
        const grupoId = new ObjectId(req.params.grupoId);
        const usuario = req.body.usuario;
        const isAdmin = req.body.isAdmin || false;

        const grupo = await db.collection(GRUPOS_COLLECTION).findOne({ _id: grupoId });
        if (!grupo) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }

        // Solo el creador o admin puede eliminar el grupo
        if (!isAdmin && grupo.creador !== usuario) {
            return res.status(403).json({ error: 'Solo el creador del grupo puede eliminarlo' });
        }

        await db.collection(GRUPOS_COLLECTION).deleteOne({ _id: grupoId });

        res.json({ mensaje: 'Grupo eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar grupo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.listen(PORT, async () => {
    await conectarMongo();
    await crearAdminSiNoExiste();
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
