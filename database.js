// ===========================================
// database.js (NOVA VERSÃO COMPLETA USANDO FIREBASE FIRESTORE)
// Inclui funções para Alterar e Eliminar Usuários.
// ===========================================

// Importa o objeto 'db' do Firestore que inicializamos
const db = require('./utils/firebase'); 
const admin = require('firebase-admin'); // Necessário para FieldValue
const fs = require('fs');
const path = require('path');

// --- Caminhos e Arquivos Locais (Preservados) ---\n
const contentPath = path.join(__dirname, 'content');
const lessonsPath = path.join(__dirname, 'lessons.json');

// --- Funções Auxiliares Comuns ---\n
const mapSnapshotToData = (snapshot) => {
    return snapshot.docs.map(doc => ({ 
        id: doc.id, // ID do Firestore
        ...doc.data() 
    }));
};

// --- Funções Específicas para Usuários ('users' Collection) ---

const getUsers = async () => {
    const snapshot = await db.collection('users').get();
    return mapSnapshotToData(snapshot);
};

const addNewUser = async (userData) => {
    delete userData.id; 
    await db.collection('users').add(userData);
};

// Aprova um usuário usando o ID do Firestore
const approveUser = async (userFirestoreId) => {
    const docRef = db.collection('users').doc(userFirestoreId);
    await docRef.update({
        approved: true
    });
};

// 💡 NOVA FUNÇÃO: Altera campos de um usuário
const updateUser = async (userFirestoreId, newData) => {
    const docRef = db.collection('users').doc(userFirestoreId);
    // Usa .update() para alterar apenas os campos fornecidos
    await docRef.update(newData);
};

// 💡 NOVA FUNÇÃO: Elimina um usuário e seu progresso
const deleteUser = async (userFirestoreId, userId) => {
    // 1. Remove o documento do usuário
    await db.collection('users').doc(userFirestoreId).delete();
    
    // 2. Remove o progresso associado (usa o userId interno, se aplicável, ou userFirestoreId)
    // Assumindo que a progress collection usa o ID interno (userId) como chave do documento
    if (userId) {
       await db.collection('progress').doc(userId.toString()).delete(); 
    }
};

// --- Funções de Lições (Arquivos Locais) ---\n

const getLessons = () => {
    // Lê lessons.json de forma síncrona
    try {
        const data = fs.readFileSync(lessonsPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

const saveLessons = (lessons) => {
    // Salva lessons.json de forma síncrona
    fs.writeFileSync(lessonsPath, JSON.stringify(lessons, null, 2), 'utf8');
};

const getLessonContent = (lessonId) => {
    const lessons = getLessons();
    const lesson = lessons.find(l => l.id.toString() === lessonId.toString());
    if (!lesson) throw new Error('Aula não encontrada.');

    const txtFilePath = path.join(contentPath, `${lesson.content_file}.txt`);
    // Lê o arquivo .txt de forma síncrona
    return fs.readFileSync(txtFilePath, 'utf8'); 
};


// --- Funções de Comentários ('comments' Collection) ---\n

const getComments = async (lessonId = null) => {
    let query = db.collection('comments').orderBy('timestamp', 'desc');
    if (lessonId) {
        query = query.where('lessonId', '==', parseInt(lessonId));
    }
    const snapshot = await query.get();
    return mapSnapshotToData(snapshot);
};

const saveNewComment = async (commentData) => {
    // Adiciona o timestamp antes de salvar
    commentData.timestamp = new Date().toISOString();
    await db.collection('comments').add(commentData);
};

// --- Substituir função existente por esta ---

// (A função saveReplyToComment, que deve usar o objeto 'admin' importado para FieldValue)
    const saveReplyToComment = async (commentFirestoreId, adminResponse, adminName) => {
    const docRef = db.collection('comments').doc(commentFirestoreId);
    
    // 💡 ATUALIZAÇÃO CRÍTICA: Mudar o status para 'responded'
    await docRef.update({
        adminResponse: adminResponse,
        adminName: adminName,
        status: 'responded', // 🚨 MUITO IMPORTANTE: Mudar o status para que saia da lista de pendentes
        respondedAt: new Date().toISOString()
    });
    return true; 
};

// --- Funções de Progresso e Submissões ('progress' e 'quiz_submissions' Collections) ---\n

const getUserProgress = async (userId) => {
    // Assume que a chave do documento é o userId interno
    const doc = await db.collection('progress').doc(userId.toString()).get();
    if (doc.exists) {
        return doc.data().completedLessons || [];
    }
    return [];
};

const markLessonComplete = async (userId, lessonId) => {
    const lessonIdInt = parseInt(lessonId);
    const docRef = db.collection('progress').doc(userId.toString());

    await docRef.set({
        completedLessons: admin.firestore.FieldValue.arrayUnion(lessonIdInt)
    }, { merge: true }); 
    
    return true; 
};

const getSubmissionLogs = async () => {
    const snapshot = await db.collection('quiz_submissions').orderBy('timestamp', 'desc').get();
    return mapSnapshotToData(snapshot);
};


// --- Funções de Mensagens Globais ('messages' Collection) ---\n

const getMessages = async () => {
    const snapshot = await db.collection('messages').orderBy('createdAt', 'desc').get();
    return mapSnapshotToData(snapshot);
};

const saveNewMessage = async (text) => {
    const messageData = {
        text: text,
        createdAt: new Date().toISOString()
    };
    await db.collection('messages').add(messageData);
};

const deleteMessage = async (messageFirestoreId) => {
    await db.collection('messages').doc(messageFirestoreId).delete();
};

const logQuizSubmission = async (userId, username, lessonId, score, totalQuestions, passed) => {
    const submissionData = {
        userId: userId,
        username: username,
        lessonId: parseInt(lessonId),
        score: score,
        totalQuestions: totalQuestions,
        passed: passed,
        timestamp: new Date().toISOString()
    };
    await db.collection('quiz_submissions').add(submissionData);
};

// 💡 NOVA FUNÇÃO: Apagar todas as Mensagens Globais ('messages' collection)
const deleteAllMessages = async () => {
    const messagesRef = db.collection('messages');
    const snapshot = await messagesRef.get();
    const batch = db.batch();

    if (snapshot.empty) {
        return 0;
    }

    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size; 
};

// 💡 NOVA FUNÇÃO: Apagar um único Comentário/Feedback ('comments' collection)
const deleteComment = async (commentFirestoreId) => {
    await db.collection('comments').doc(commentFirestoreId).delete();
};

// 💡 NOVA FUNÇÃO: Apagar todos os Comentários/Feedback ('comments' collection)
const deleteAllComments = async () => {
    const commentsRef = db.collection('comments');
    const snapshot = await commentsRef.get();
    const batch = db.batch();

    if (snapshot.empty) {
        return 0;
    }

    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size;
};


// --- EXPORTAÇÕES GLOBAIS (ATUALIZADAS) ---
module.exports = {
    // Usuários
    getUsers, addNewUser, approveUser, 
    updateUser, deleteUser,
    // Lições
    getLessons, saveLessons, getLessonContent,
    // Comentários/Feedback
    getComments, saveNewComment, saveReplyToComment,
    deleteComment, deleteAllComments, // 💡 NOVAS EXPORTAÇÕES
    // Mensagens Globais
    getMessages, saveNewMessage, deleteMessage,
    deleteAllMessages, // 💡 NOVA EXPORTAÇÃO
    // Progresso
    getUserProgress, markLessonComplete, getSubmissionLogs, logQuizSubmission 
};

