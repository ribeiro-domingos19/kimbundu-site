// ===========================================
// utils/firebase.js (AJUSTADO PARA AMBIENTES LOCAL/VERCEL)
// ===========================================
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// 1. Tenta obter a chave da variável de ambiente (Vercel)
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

let serviceAccount;

if (serviceAccountString) {
    // CÓDIGO DO VERCEL/PRODUÇÃO: Lê da variável de ambiente
    try {
        serviceAccount = JSON.parse(serviceAccountString);
        console.log("🔥 Firebase: Conectado via Variável de Ambiente (Vercel).");
    } catch (error) {
        console.error("ERRO FATAL: Falha ao parsear a chave de serviço JSON do Firebase da variável de ambiente.", error);
        process.exit(1);
    }
} else {
    // CÓDIGO LOCAL/DESENVOLVIMENTO: Lê diretamente o arquivo JSON
    const keyFileName = 'firebase-key.json'; 
    // Usa path.resolve para encontrar o arquivo na raiz do projeto
    const keyPath = path.resolve(__dirname, '..', keyFileName); 
    
    if (fs.existsSync(keyPath)) {
        console.log(`🔥 Firebase: Conectado lendo a chave localmente em ${keyFileName}`);
        // require() pode ler o JSON diretamente, contornando o problema de quebras de linha do dotenv
        try {
            serviceAccount = require(keyPath);
        } catch (e) {
            console.error("ERRO FATAL: Não foi possível carregar o arquivo firebase-key.json. Verifique a sintaxe JSON.", e);
            process.exit(1);
        }
    } else {
        console.error("ERRO FATAL: Chave de serviço não encontrada! Para teste local, salve o arquivo JSON na raiz do projeto como:", keyFileName);
        process.exit(1);
    }
}

// 3. Inicializa o Firebase com o objeto de conta de serviço encontrado
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

module.exports = db;

