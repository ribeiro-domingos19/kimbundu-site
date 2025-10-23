// ===========================================
// utils/firebase.js (CORREÇÃO DE CHAVE PRIVADA E AMBIENTES)
// ===========================================
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Variáveis de Ambiente esperadas para o DEPLOY (Vercel)
const projectID = process.env.FIREBASE_PROJECT_ID; 
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL; 
const privateKeyString = process.env.FIREBASE_PRIVATE_KEY; // Chave com ou sem literais \n

let serviceAccount;

// 1. Tenta Conectar via Variáveis de Ambiente (Produção/Vercel)
if (projectID && clientEmail && privateKeyString) {
    
    console.log("🔥 Firebase: Conectado via Variáveis de Ambiente Separadas.");
    
    // CORREÇÃO CRUCIAL: Substitui todos os literais '\n' pela quebra de linha real.
    // Isso resolve o erro "Invalid PEM formatted message".
    const correctedPrivateKey = privateKeyString.replace(/\\n/g, '\n'); 

    // Constrói o objeto de credenciais de serviço
    serviceAccount = {
        type: "service_account",
        project_id: projectID,
        private_key: correctedPrivateKey,
        client_email: clientEmail,
        // Inclua outras propriedades do seu JSON se forem necessárias
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID, 
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
        universe_domain: "googleapis.com"
    };

} 
// 2. Conecta via Arquivo Local (Desenvolvimento)
else {
    const keyFileName = 'firebase-key.json'; 
    const keyPath = path.resolve(__dirname, '..', keyFileName); 
    
    if (fs.existsSync(keyPath)) {
        console.log(`🔥 Firebase: Conectado lendo a chave localmente em ${keyFileName}`);
        // O require() lê o JSON e já trata as quebras de linha corretamente.
        try {
            serviceAccount = require(keyPath);
        } catch (e) {
            console.error("ERRO FATAL: Não foi possível carregar o arquivo firebase-key.json. Verifique a sintaxe JSON.", e);
            process.exit(1);
        }
    } else {
        console.error("ERRO FATAL: Chave de serviço não encontrada! Configure Variáveis de Ambiente ou salve o arquivo JSON na raiz do projeto como:", keyFileName);
        process.exit(1);
    }
}

// 3. Inicializa o Firebase (Se serviceAccount foi definido)
if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
} else {
    // Isso só deve ser atingido se houver uma falha lógica acima.
    console.error("ERRO FATAL: Falha na determinação das credenciais do Firebase.");
    process.exit(1);
}

const db = admin.firestore();

module.exports = db;

