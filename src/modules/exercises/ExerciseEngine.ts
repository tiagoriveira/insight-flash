// Sprint 2 - ExerciseEngine.ts
// Geração de exercícios inteligentes baseados em insights

export interface Exercise {
  id: string;
  type: 'fill-blank' | 'multiple-choice' | 'open-answer';
  prompt: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface Insight {
  id: string;
  content: string;
  note?: string;
  source?: string;
  tags?: string[];
}

export class ExerciseEngine {
  /**
   * Gera exercício de preenchimento de lacuna
   * Substitui palavra-chave por ___
   */
  static generateFillBlank(insight: Insight): Exercise | null {
    const words = insight.content.split(' ');
    
    // Filtrar palavras significativas (> 3 caracteres, sem pontuação)
    const significantWords = words
      .map((word, index) => ({ word: word.replace(/[.,!?;:]/g, ''), index }))
      .filter(({ word }) => word.length > 3 && !/^(que|para|com|uma|dos|das|por|são|foi|ter|ser|está|isso|mais|muito|bem|como|quando|onde|porque)$/i.test(word));
    
    if (significantWords.length === 0) return null;
    
    // Selecionar palavra aleatória
    const randomWord = significantWords[Math.floor(Math.random() * significantWords.length)];
    const wordToReplace = randomWord.word;
    
    // Criar prompt com lacuna
    const promptWords = [...words];
    promptWords[randomWord.index] = '______';
    const prompt = promptWords.join(' ');
    
    return {
      id: crypto.randomUUID(),
      type: 'fill-blank',
      prompt: `Complete a lacuna: ${prompt}`,
      correctAnswer: wordToReplace.toLowerCase(),
      explanation: `A palavra correta é "${wordToReplace}". ${insight.content}`
    };
  }
  
  /**
   * Gera exercício de múltipla escolha
   * 1 correta + 2-3 distrações
   */
  static generateMultipleChoice(insight: Insight): Exercise | null {
    const words = insight.content.split(' ');
    const keywords = words
      .map(word => word.replace(/[.,!?;:]/g, ''))
      .filter(word => word.length > 4 && !/^(que|para|com|uma|dos|das|por|são|foi|ter|ser|está|isso|mais|muito|bem|como|quando|onde|porque)$/i.test(word));
    
    if (keywords.length === 0) return null;
    
    const correctAnswer = keywords[Math.floor(Math.random() * keywords.length)];
    
    // Gerar distrações baseadas no contexto
    const distractors = this.generateDistractors(correctAnswer, insight);
    
    // Embaralhar opções
    const options = [correctAnswer, ...distractors].sort(() => Math.random() - 0.5);
    
    return {
      id: crypto.randomUUID(),
      type: 'multiple-choice',
      prompt: `Qual conceito é central neste insight: "${insight.content.substring(0, 80)}..."?`,
      options,
      correctAnswer: correctAnswer.toLowerCase(),
      explanation: `O conceito central é "${correctAnswer}". ${insight.content}`
    };
  }
  
  /**
   * Gera exercício de resposta aberta
   * Campo texto + "ver resposta"
   */
  static generateOpenAnswer(insight: Insight): Exercise {
    const prompts = [
      'Explique com suas próprias palavras o conceito apresentado neste insight:',
      'Como você aplicaria este conceito em uma situação prática?',
      'Qual é a ideia principal deste insight?',
      'Resuma este insight em suas próprias palavras:'
    ];
    
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    
    return {
      id: crypto.randomUUID(),
      type: 'open-answer',
      prompt: randomPrompt,
      correctAnswer: insight.content,
      explanation: `Resposta de referência: ${insight.content}${insight.note ? ` Nota adicional: ${insight.note}` : ''}`
    };
  }
  
  /**
   * Gera distrações para múltipla escolha
   */
  private static generateDistractors(correctAnswer: string, insight: Insight): string[] {
    const commonDistractors = [
      'processo', 'método', 'conceito', 'sistema', 'estratégia', 'técnica',
      'abordagem', 'modelo', 'framework', 'princípio', 'teoria', 'prática'
    ];
    
    // Filtrar distrações que não sejam a resposta correta
    const validDistractors = commonDistractors
      .filter(d => d.toLowerCase() !== correctAnswer.toLowerCase())
      .slice(0, 3);
    
    // Se não temos distrações suficientes, adicionar algumas genéricas
    while (validDistractors.length < 3) {
      const generic = ['elemento', 'aspecto', 'fator'][validDistractors.length - commonDistractors.length] || 'item';
      if (!validDistractors.includes(generic)) {
        validDistractors.push(generic);
      }
    }
    
    return validDistractors.slice(0, 3);
  }
  
  /**
   * Função principal para gerar exercícios
   * Input: Insight
   * Output: Array de exercícios
   */
  static generateExercises(insight: Insight): Exercise[] {
    const exercises: Exercise[] = [];
    
    // Tentar gerar cada tipo de exercício
    const fillBlank = this.generateFillBlank(insight);
    if (fillBlank) exercises.push(fillBlank);
    
    const multipleChoice = this.generateMultipleChoice(insight);
    if (multipleChoice) exercises.push(multipleChoice);
    
    const openAnswer = this.generateOpenAnswer(insight);
    exercises.push(openAnswer);
    
    return exercises;
  }
}