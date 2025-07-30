# Configuração do Firebase para Insight Flash

## Passo 1: Criar Projeto no Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Clique em "Adicionar projeto"
3. Digite o nome do projeto (ex: insight-flash)
4. Desabilite Google Analytics (opcional)
5. Clique em "Criar projeto"

## Passo 2: Configurar Firestore Database

1. No painel do Firebase, vá em "Firestore Database"
2. Clique em "Criar banco de dados"
3. Escolha "Iniciar no modo de teste" (para desenvolvimento)
4. Selecione uma localização próxima

## Passo 3: Configurar Authentication

1. Vá em "Authentication" > "Sign-in method"
2. Habilite "Anônimo" (para permitir login sem cadastro)

## Passo 4: Obter Configurações

1. Vá em "Configurações do projeto" (ícone de engrenagem)
2. Role até "Seus aplicativos"
3. Clique no ícone da web `</>`
4. Digite um nome para o app
5. Copie as configurações do Firebase

## Passo 5: Configurar Variáveis de Ambiente

1. Copie o arquivo `.env.example` para `.env`
2. Substitua os valores pelas configurações do seu projeto Firebase:

```env
VITE_FIREBASE_API_KEY=sua_api_key_aqui
VITE_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu_projeto_id
VITE_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
VITE_FIREBASE_APP_ID=seu_app_id
```

## Passo 6: Configurar Regras de Segurança (Opcional)

Para produção, configure regras mais restritivas no Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Funcionalidades

- ✅ Sincronização automática entre dispositivos
- ✅ Backup automático na nuvem
- ✅ Acesso de qualquer navegador
- ✅ Login anônimo (sem necessidade de cadastro)
- ✅ Dados persistentes e seguros

## Desenvolvimento Local

O app funciona com configurações demo mesmo sem Firebase configurado, mas os dados ficam apenas localmente.

---

## **Como sincronizar dados do usuário entre dispositivos (Firebase Auth + Firestore)**

### 1. **Ative um método de login no Firebase**
- Vá para [Firebase Console > Authentication > Métodos de login](https://console.firebase.google.com/)
- Ative pelo menos um método (ex: Google, E-mail/senha)

---

### 2. **Adicione tela de login na sua aplicação**
- Implemente um formulário de login (Google ou E-mail/senha)
- Use os métodos do Firebase Auth, por exemplo:
  ```js
  import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
  const auth = getAuth();

  // Para login com Google:
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider);

  // Para login com e-mail/senha:
  signInWithEmailAndPassword(auth, email, password);
  ```

---

### 3. **Salve e recupere dados usando o UID do usuário**
- Ao salvar dados no Firestore, use o `auth.currentUser.uid` como identificador:
  ```js
  import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
  const db = getFirestore();

  // Salvar dados
  await setDoc(doc(db, "users", auth.currentUser.uid, "dados", "meuDado"), { ... });

  // Ler dados
  const docSnap = await getDoc(doc(db, "users", auth.currentUser.uid, "dados", "meuDado"));
  ```

---

### 4. **Oriente o usuário**
- Peça para ele sempre fazer login com a mesma conta em todos os dispositivos.

---

### 5. **Pronto!**
- Agora, ao logar em qualquer dispositivo, o usuário verá sempre os próprios dados.

---

Se quiser um exemplo de código para React ou outra stack, só pedir!