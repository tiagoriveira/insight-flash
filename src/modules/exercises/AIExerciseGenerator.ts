// Sprint 5 - Integração com IA (versão local simulada)
// Geração de exercícios usando lógica avançada que simula IA

import { Exercise } from './ExerciseEngine';

export interface Insight {
  id: string;
  content: string;
  note?: string;
  source?: string;
  tags?: string[];
}

export class AIExerciseGenerator {
  /**
   * Simula geração de exercício de preenchimento de lacuna usando "IA"
   * Usa análise semântica básica para identificar palavras-chave importantes
   */
  static async getFillBlankQuestionFromIA(insight: Insight): Promise<Exercise> {
    // Simular delay de API
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const words = insight.content.split(/\s+/);
    
    // Análise "semântica" para identificar palavras importantes
    const importantWords = words
      .map((word, index) => ({
        word: word.replace(/[.,!?;:()"']/g, ''),
        index,
        importance: this.calculateWordImportance(word, insight.content)
      }))
      .filter(({ word, importance }) => word.length > 3 && importance > 0.5)
      .sort((a, b) => b.importance - a.importance);
    
    if (importantWords.length === 0) {
      // Fallback para palavra aleatória
      const randomIndex = Math.floor(Math.random() * words.length);
      const randomWord = words[randomIndex].replace(/[.,!?;:()"']/g, '');
      
      const promptWords = [...words];
      promptWords[randomIndex] = '______';
      
      return {
        id: crypto.randomUUID(),
        type: 'fill-blank',
        prompt: promptWords.join(' '),
        correctAnswer: randomWord.toLowerCase(),
        explanation: `A palavra correta é "${randomWord}". Esta palavra é fundamental para compreender o conceito apresentado no insight.`
      };
    }
    
    // Selecionar a palavra mais importante
    const selectedWord = importantWords[0];
    const promptWords = [...words];
    promptWords[selectedWord.index] = '______';
    
    // Gerar explicação "inteligente"
    const explanation = this.generateExplanation(selectedWord.word, insight);
    
    return {
      id: crypto.randomUUID(),
      type: 'fill-blank',
      prompt: promptWords.join(' '),
      correctAnswer: selectedWord.word.toLowerCase(),
      explanation
    };
  }
  
  /**
   * Gera exercício de múltipla escolha usando "IA"
   */
  static async getMultipleChoiceFromIA(insight: Insight): Promise<Exercise> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const concepts = this.extractConcepts(insight.content);
    
    if (concepts.length === 0) {
      throw new Error('Não foi possível extrair conceitos do insight');
    }
    
    const mainConcept = concepts[0];
    const distractors = this.generateSmartDistractors(mainConcept, insight);
    
    const options = [mainConcept, ...distractors].sort(() => Math.random() - 0.5);
    
    return {
      id: crypto.randomUUID(),
      type: 'multiple-choice',
      prompt: `Baseado no insight "${insight.content.substring(0, 100)}...", qual é o conceito central?`,
      options,
      correctAnswer: mainConcept.toLowerCase(),
      explanation: `O conceito central é "${mainConcept}". ${this.generateConceptExplanation(mainConcept, insight)}`
    };
  }
  
  /**
   * Calcula a importância de uma palavra no contexto
   */
  private static calculateWordImportance(word: string, content: string): number {
    const cleanWord = word.replace(/[.,!?;:()"']/g, '').toLowerCase();
    
    // Palavras muito comuns têm baixa importância
    const commonWords = [
      'que', 'para', 'com', 'uma', 'dos', 'das', 'por', 'são', 'foi', 'ter',
      'ser', 'está', 'isso', 'mais', 'muito', 'bem', 'como', 'quando', 'onde',
      'porque', 'então', 'mas', 'também', 'pode', 'deve', 'fazer', 'sobre',
      'entre', 'durante', 'através', 'dentro', 'fora', 'antes', 'depois'
    ];
    
    if (commonWords.includes(cleanWord)) return 0;
    
    let importance = 0.5; // Base
    
    // Palavras maiores tendem a ser mais importantes
    if (cleanWord.length > 6) importance += 0.2;
    if (cleanWord.length > 8) importance += 0.1;
    
    // Palavras técnicas ou conceituais
    const technicalIndicators = ['ção', 'mento', 'dade', 'ismo', 'ncia', 'ência'];
    if (technicalIndicators.some(suffix => cleanWord.endsWith(suffix))) {
      importance += 0.3;
    }
    
    // Palavras que aparecem em contextos importantes
    const contextWords = ['conceito', 'princípio', 'teoria', 'método', 'processo', 'sistema'];
    const nearbyWords = content.toLowerCase().split(/\s+/);
    const wordIndex = nearbyWords.indexOf(cleanWord);
    
    if (wordIndex > 0 && contextWords.includes(nearbyWords[wordIndex - 1])) {
      importance += 0.4;
    }
    
    return Math.min(importance, 1.0);
  }
  
  /**
   * Extrai conceitos principais do texto
   */
  private static extractConcepts(content: string): string[] {
    const words = content.split(/\s+/)
      .map(word => word.replace(/[.,!?;:()"']/g, ''))
      .filter(word => word.length > 4);
    
    // Identificar substantivos e conceitos
    const concepts = words.filter(word => {
      const lowerWord = word.toLowerCase();
      
      // Filtrar palavras comuns
      const commonWords = ['muito', 'mais', 'bem', 'como', 'quando', 'onde', 'porque', 'então', 'mas', 'também', 'pode', 'deve', 'fazer', 'sobre'];
      if (commonWords.includes(lowerWord)) return false;
      
      // Priorizar palavras que terminam com sufixos conceituais
      const conceptualSuffixes = ['ção', 'mento', 'dade', 'ismo', 'ncia', 'ência', 'agem', 'ura'];
      if (conceptualSuffixes.some(suffix => lowerWord.endsWith(suffix))) return true;
      
      // Palavras capitalizadas (possíveis nomes próprios ou conceitos)
      if (word[0] === word[0].toUpperCase() && word.length > 1) return true;
      
      return word.length > 6;
    });
    
    // Remover duplicatas e retornar os 3 principais
    return [...new Set(concepts)].slice(0, 3);
  }
  
  /**
   * Gera distrações inteligentes para múltipla escolha
   */
  private static generateSmartDistractors(correctAnswer: string, insight: Insight): string[] {
    const conceptualWords = [
      'processo', 'método', 'sistema', 'estratégia', 'abordagem',
      'técnica', 'modelo', 'framework', 'princípio', 'teoria',
      'conceito', 'prática', 'elemento', 'aspecto', 'fator',
      'mecanismo', 'estrutura', 'padrão', 'dinâmica', 'fenômeno'
    ];
    
    // Filtrar palavras que não sejam a resposta correta
    const validDistractors = conceptualWords
      .filter(word => word.toLowerCase() !== correctAnswer.toLowerCase())
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    return validDistractors;
  }
  
  /**
   * Gera explicação contextual para o conceito
   */
  private static generateExplanation(word: string, insight: Insight): string {
    const explanations = [
      `A palavra "${word}" é fundamental para compreender este insight, pois representa o elemento central da ideia apresentada.`,
      `"${word}" é a palavra-chave que conecta todos os elementos deste conceito, sendo essencial para sua compreensão.`,
      `O termo "${word}" captura a essência do insight, sendo o ponto focal para entender a mensagem completa.`,
      `"${word}" é o conceito nuclear deste insight, em torno do qual toda a explicação se desenvolve.`
    ];
    
    const randomExplanation = explanations[Math.floor(Math.random() * explanations.length)];
    
    if (insight.note) {
      return `${randomExplanation} Nota adicional: ${insight.note}`;
    }
    
    return randomExplanation;
  }
  
  /**
   * Gera explicação para conceitos em múltipla escolha
   */
  private static generateConceptExplanation(concept: string, insight: Insight): string {
    return `Este conceito representa a ideia principal do insight e é fundamental para compreender a mensagem transmitida.`;
  }
}