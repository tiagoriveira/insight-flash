# Solução para Erro de Login com Google

## Problema Identificado
O erro de cadastro/login com Google pode ter várias causas. Aqui estão as verificações e soluções:

## 1. Verificar Configuração do Firebase Console

### Passo 1: Habilitar Google Authentication
1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto: `insight-flash-dd34d`
3. Vá em **Authentication** > **Sign-in method**
4. Clique em **Google** na lista de provedores
5. **Habilite** o provedor Google
6. Configure os campos obrigatórios:
   - **Nome público do projeto**: insight-flash
   - **E-mail de suporte do projeto**: seu-email@gmail.com
7. Clique em **Salvar**

### Passo 2: Configurar Domínios Autorizados
1. Ainda em **Authentication** > **Sign-in method**
2. Role até **Domínios autorizados**
3. Adicione os domínios:
   - `localhost` (para desenvolvimento)
   - `127.0.0.1` (para desenvolvimento)
   - Seu domínio de produção (se houver)

## 2. Verificar Configurações do Projeto

### Arquivo .env
✅ **CORRIGIDO**: O arquivo .env estava com problemas de codificação e foi corrigido.

Configurações atuais:
```
VITE_FIREBASE_API_KEY=AIzaSyBPO9IEhTnTFguGBy4S6qPjExl_gKF3PpI
VITE_FIREBASE_AUTH_DOMAIN=insight-flash-dd34d.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=insight-flash-dd34d
VITE_FIREBASE_STORAGE_BUCKET=insight-flash-dd34d.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=89484951242
VITE_FIREBASE_APP_ID=1:89484951242:web:75e03fb20ad221a07551c27
```

## 3. Possíveis Erros e Soluções

### Erro: "auth/popup-blocked"
**Solução**: Desabilitar bloqueador de pop-ups no navegador

### Erro: "auth/popup-closed-by-user"
**Solução**: Não fechar a janela de login antes de completar o processo

### Erro: "auth/unauthorized-domain"
**Solução**: Adicionar o domínio atual aos domínios autorizados no Firebase Console

### Erro: "auth/operation-not-allowed"
**Solução**: Habilitar o provedor Google no Firebase Console (Passo 1 acima)

## 4. Teste da Configuração

Após fazer as configurações acima:
1. Reinicie o servidor de desenvolvimento
2. Limpe o cache do navegador (Ctrl+Shift+R)
3. Tente fazer login com Google novamente

## 5. Debug Adicional

Se o problema persistir, verifique:
1. Console do navegador (F12) para erros específicos
2. Network tab para ver se as requisições estão sendo feitas
3. Verifique se o projeto Firebase está ativo e não suspenso

## Comandos para Reiniciar o Projeto

```bash
# Parar o servidor atual (Ctrl+C)
# Limpar cache e reinstalar dependências
npm run dev
```

---

**Nota**: O problema mais comum é o provedor Google não estar habilitado no Firebase Console. Certifique-se de seguir o Passo 1 acima.