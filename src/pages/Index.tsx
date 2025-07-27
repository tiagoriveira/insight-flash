import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Plus, Search, Settings, BookOpen, ArrowLeft, Download, Upload, Trash2, CheckCircle, XCircle, BrainCircuit, Zap, Moon, Sun, Target } from 'lucide-react';
import { ExerciseEngine, Exercise } from '../modules/exercises/ExerciseEngine';
import { AIExerciseGenerator } from '../modules/exercises/AIExerciseGenerator';

// --- TIPOS E CONSTANTES ---
interface Insight {
  id: string;
  content: string;
  note?: string;
  source?: string;
  tags?: string[];
  timestamp: number;
  reviewStage: 0 | 1 | 2 | 3;
  nextReview: number;
  isMastered: boolean;
  reviewHistory: Array<{ timestamp: number; action: 'created' | 'reviewed' | 'mastered'; }>;
  // Novos campos para exercícios
  exerciseEnabled: boolean;
  lastExerciseDate?: number;
  exerciseHistory?: Array<{
    timestamp: number;
    type: 'fill-blank' | 'multiple-choice' | 'open-answer';
    correct?: boolean;
  }>;
}

const REVIEW_INTERVALS = [1, 3, 7, 21];
const DAY_IN_MS = 24 * 60 * 60 * 1000;

// --- HOOKS CUSTOMIZADOS ---
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };
  return [storedValue, setValue] as const;
}

function useDarkMode() {
    const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('theme', 'light');

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove(theme === 'light' ? 'dark' : 'light');
        root.classList.add(theme);
    }, [theme]);

    return [theme, setTheme] as const;
}

const useKeyPress = (targetKey: string, callback: (event: KeyboardEvent) => void) => {
    const callbackRef = useRef(callback);
    useEffect(() => {
        callbackRef.current = callback;
    });

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (event.key === targetKey) {
                callbackRef.current(event);
            }
        };
        window.addEventListener('keydown', handler);
        return () => {
            window.removeEventListener('keydown', handler);
        };
    }, [targetKey]);
};

// --- FUNÇÕES AUXILIARES ---
const getNextReviewTimestamp = (stage: number): number => {
  const now = new Date();
  const interval = REVIEW_INTERVALS[stage] || 1;
  now.setDate(now.getDate() + interval);
  return now.getTime();
};

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

function calculatePriority(insight: Insight): number {
  const now = Date.now();
  const daysOverdue = Math.max(0, (now - insight.nextReview) / DAY_IN_MS);
  const daysSinceCreation = (now - insight.timestamp) / DAY_IN_MS;
  const recencyBonus = Math.max(0, 1 - (daysSinceCreation / 30));
  return (daysOverdue * 10) + (insight.reviewStage * -2) + (recencyBonus * 5);
}

// Função para verificar se um insight é elegível para exercícios (Sprint 1)
const isEligibleForExercise = (insight: Insight): boolean => {
  // insights com stage >= 2
  if (insight.reviewStage < 2 && !insight.isMastered) return false;
  
  // que não tenham sido exercitados hoje
  const now = Date.now();
  const today = new Date(now).toDateString();
  const lastExerciseDate = insight.lastExerciseDate ? new Date(insight.lastExerciseDate).toDateString() : null;
  
  return lastExerciseDate !== today;
};

// Função para obter estatísticas de performance por insight (Sprint 4)
const getPerformanceStats = (insight: Insight) => {
  const exerciseHistory = insight.exerciseHistory || [];
  
  if (exerciseHistory.length === 0) {
    return {
      totalExercises: 0,
      correctAnswers: 0,
      accuracy: 0,
      averageResponseTime: 0,
      lastExerciseDate: null,
      exercisesByType: {
        'fill-blank': { total: 0, correct: 0 },
        'multiple-choice': { total: 0, correct: 0 },
        'open-answer': { total: 0, correct: 0 }
      }
    };
  }
  
  const totalExercises = exerciseHistory.length;
  const correctAnswers = exerciseHistory.filter(ex => ex.correct).length;
  const accuracy = Math.round((correctAnswers / totalExercises) * 100);
  
  const exercisesByType = {
    'fill-blank': { total: 0, correct: 0 },
    'multiple-choice': { total: 0, correct: 0 },
    'open-answer': { total: 0, correct: 0 }
  };
  
  exerciseHistory.forEach(ex => {
    if (exercisesByType[ex.type]) {
      exercisesByType[ex.type].total++;
      if (ex.correct) exercisesByType[ex.type].correct++;
    }
  });
  
  return {
    totalExercises,
    correctAnswers,
    accuracy,
    averageResponseTime: 0, // TODO: implementar quando adicionar tempo de resposta
    lastExerciseDate: insight.lastExerciseDate,
    exercisesByType
  };
};

// Função para gerar exercícios baseados no insight usando ExerciseEngine (Sprint 2)
const generateExercises = (insight: Insight) => {
  return ExerciseEngine.generateExercises({
    id: insight.id,
    content: insight.content,
    note: insight.note,
    source: insight.source,
    tags: insight.tags
  }).map(exercise => ({
    ...exercise,
    insight: insight
  }));
};

// Função para gerar exercícios usando IA (Sprint 5)
const generateExercisesWithAI = async (insight: Insight): Promise<Exercise[]> => {
  const exerciseInsight = {
    id: insight.id,
    content: insight.content,
    note: insight.note,
    source: insight.source,
    tags: insight.tags
  };
  
  try {
    const exercises: Exercise[] = [];
    
    // Tentar gerar exercício de preenchimento com IA
    try {
      const fillBlankExercise = await AIExerciseGenerator.getFillBlankQuestionFromIA(exerciseInsight);
      exercises.push(fillBlankExercise);
    } catch (error) {
      console.warn('Falha ao gerar exercício de preenchimento com IA:', error);
    }
    
    // Tentar gerar exercício de múltipla escolha com IA
    try {
      const multipleChoiceExercise = await AIExerciseGenerator.getMultipleChoiceFromIA(exerciseInsight);
      exercises.push(multipleChoiceExercise);
    } catch (error) {
      console.warn('Falha ao gerar exercício de múltipla escolha com IA:', error);
    }
    
    // Se a IA falhou, usar o gerador padrão como fallback
    if (exercises.length === 0) {
      return generateExercises(insight);
    }
    
    // Adicionar exercício de resposta aberta usando o gerador padrão
    const standardExercises = generateExercises(insight);
    const openAnswerExercise = standardExercises.find(ex => ex.type === 'open-answer');
    if (openAnswerExercise) {
      exercises.push(openAnswerExercise);
    }
    
    return exercises;
  } catch (error) {
    console.error('Erro ao gerar exercícios com IA:', error);
    // Fallback para gerador padrão
    return generateExercises(insight);
  }
};

// Componente de Configurações de Exercícios (Sprint 6)
const ExerciseSettings: React.FC = () => {
  const [useAI, setUseAI] = useLocalStorage('exerciseSettings_useAI', false);
  const [maxExercisesPerSession, setMaxExercisesPerSession] = useLocalStorage('exerciseSettings_maxPerSession', 5);
  const [maxExercisesPerDay, setMaxExercisesPerDay] = useLocalStorage('exerciseSettings_maxPerDay', 3);
  const [enabledExerciseTypes, setEnabledExerciseTypes] = useLocalStorage('exerciseSettings_enabledTypes', {
    'fill-blank': true,
    'multiple-choice': true,
    'open-answer': true
  });
  const [difficultyLevel, setDifficultyLevel] = useLocalStorage('exerciseSettings_difficulty', 'medium');
  const [autoAdvance, setAutoAdvance] = useLocalStorage('exerciseSettings_autoAdvance', false);

  const handleExerciseTypeToggle = (type: string) => {
    setEnabledExerciseTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Configuração de IA */}
      <div className="flex justify-between items-center">
        <div>
          <span className="text-foreground font-medium">Usar Geração com IA</span>
          <p className="text-sm text-muted-foreground">Exercícios mais inteligentes e contextuais</p>
        </div>
        <button
          onClick={() => setUseAI(!useAI)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            useAI ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              useAI ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Limite de exercícios por sessão */}
      <div>
        <label className="block text-foreground font-medium mb-2">
          Exercícios por Sessão: {maxExercisesPerSession}
        </label>
        <input
          type="range"
          min="1"
          max="10"
          value={maxExercisesPerSession}
          onChange={(e) => setMaxExercisesPerSession(Number(e.target.value))}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>1</span>
          <span>10</span>
        </div>
      </div>

      {/* Limite de exercícios por dia */}
      <div>
        <label className="block text-foreground font-medium mb-2">
          Exercícios por Dia (por insight): {maxExercisesPerDay}
        </label>
        <input
          type="range"
          min="1"
          max="5"
          value={maxExercisesPerDay}
          onChange={(e) => setMaxExercisesPerDay(Number(e.target.value))}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>1</span>
          <span>5</span>
        </div>
      </div>

      {/* Tipos de exercícios habilitados */}
      <div>
        <label className="block text-foreground font-medium mb-3">Tipos de Exercícios</label>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Preenchimento de Lacunas</span>
            <button
              onClick={() => handleExerciseTypeToggle('fill-blank')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabledExerciseTypes['fill-blank'] ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabledExerciseTypes['fill-blank'] ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Múltipla Escolha</span>
            <button
              onClick={() => handleExerciseTypeToggle('multiple-choice')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabledExerciseTypes['multiple-choice'] ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabledExerciseTypes['multiple-choice'] ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Resposta Aberta</span>
            <button
              onClick={() => handleExerciseTypeToggle('open-answer')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabledExerciseTypes['open-answer'] ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabledExerciseTypes['open-answer'] ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Nível de dificuldade */}
      <div>
        <label className="block text-foreground font-medium mb-3">Nível de Dificuldade</label>
        <div className="grid grid-cols-3 gap-2">
          {['easy', 'medium', 'hard'].map((level) => (
            <button
              key={level}
              onClick={() => setDifficultyLevel(level)}
              className={`p-2 rounded-lg text-sm font-medium transition-colors ${
                difficultyLevel === level
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {level === 'easy' ? 'Fácil' : level === 'medium' ? 'Médio' : 'Difícil'}
            </button>
          ))}
        </div>
      </div>

      {/* Avanço automático */}
      <div className="flex justify-between items-center">
        <div>
          <span className="text-foreground font-medium">Avanço Automático</span>
          <p className="text-sm text-muted-foreground">Avançar automaticamente após resposta correta</p>
        </div>
        <button
          onClick={() => setAutoAdvance(!autoAdvance)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            autoAdvance ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              autoAdvance ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          💡 Dica: As configurações são salvas automaticamente e aplicadas na próxima sessão de exercícios.
        </p>
      </div>
    </div>
  );
};

// --- COMPONENTES DA UI ---
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    onConfirm?: (() => void) | null;
    confirmText?: string;
    cancelText?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, onConfirm, confirmText = "Confirmar", cancelText = "Cancelar" }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
            <div className="bg-card rounded-lg shadow-xl p-6 w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-foreground mb-4">{title}</h3>
                <div className="text-muted-foreground">{children}</div>
                <div className="mt-6 flex justify-end space-x-4">
                    <Button onClick={onClose} variant="secondary">{cancelText}</Button>
                    {onConfirm && <Button onClick={onConfirm} variant="primary">{confirmText}</Button>}
                </div>
            </div>
        </div>
    );
};

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: ButtonVariant;
}

const Button: React.FC<ButtonProps> = ({ children, className = '', variant = 'primary', ...props }) => {
  const baseClasses = 'px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:ring-offset-background';
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-secondary',
    success: 'bg-success text-success-foreground hover:bg-success/90 focus:ring-success',
    warning: 'bg-warning text-warning-foreground hover:bg-warning/90 focus:ring-warning',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive',
  };
  return (
    <button className={`${baseClasses} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

interface InsightCardProps {
    insight: Insight;
    onReview: (insight: Insight) => void;
    onDelete: (id: string) => void;
}

const InsightCard: React.FC<InsightCardProps> = ({ insight, onReview, onDelete }) => {
    const isOverdue = insight.nextReview < Date.now() && !insight.isMastered;
    
    return (
        <div className="bg-card p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 border border-border flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-start mb-2">
                    <p className="text-card-foreground font-medium flex-1">{insight.content}</p>
                    <button 
                        onClick={() => onDelete(insight.id)}
                        className="ml-2 p-1 text-muted-foreground hover:text-destructive transition-colors"
                        title="Deletar insight"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
                {insight.note && <p className="text-sm text-muted-foreground mt-2 italic">"{insight.note}"</p>}
                <div className="flex flex-wrap gap-2 mt-3">
                    {insight.tags?.map((tag) => (
                        <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{tag}</span>
                    ))}
                </div>
            </div>
            <div className="mt-4 flex justify-between items-end">
                <div className="text-xs text-muted-foreground">
                    <p>Próxima revisão:</p>
                    <p className={`font-semibold ${insight.isMastered ? 'text-success' : isOverdue ? 'text-destructive' : 'text-foreground'}`}>
                        {insight.isMastered ? 'Dominado' : formatDate(insight.nextReview)}
                    </p>
                </div>
                <Button onClick={() => onReview(insight)} variant="secondary" className="px-3 py-1 text-sm">
                    <BookOpen size={16} />
                    Revisar
                </Button>
            </div>
        </div>
    );
};

// --- TELAS PRINCIPAIS ---
interface AddInsightFormProps {
    onAddInsight: (data: { content: string; note: string; source: string; tags: string[] }) => void;
    onBack: () => void;
}

const AddInsightForm: React.FC<AddInsightFormProps> = ({ onAddInsight, onBack }) => {
  const [content, setContent] = useState('');
  const [note, setNote] = useState('');
  const [source, setSource] = useState('');
  const [tags, setTags] = useState('');
  
  useKeyPress('Escape', onBack);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.length < 10) return;
    
    const tagsArray = tags.split(',').map(t => t.trim()).filter(Boolean);
    onAddInsight({ content, note, source, tags: tagsArray });
    setContent(''); setNote(''); setSource(''); setTags('');
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-muted mr-4"><ArrowLeft /></button>
        <h2 className="text-2xl font-bold text-foreground">Adicionar Novo Insight</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-foreground mb-1">Insight *</label>
          <textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Capture aqui uma ideia, um fato ou um conceito importante..." className="w-full p-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition duration-150" rows={5} required />
        </div>
        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-foreground mb-1">Tags (separadas por vírgula)</label>
          <input id="tags" type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ex: produtividade, vieses, webdev" className="w-full p-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition duration-150" />
        </div>
        <div>
          <label htmlFor="note" className="block text-sm font-medium text-foreground mb-1">Nota Pessoal</label>
          <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Adicione um contexto ou uma reflexão pessoal..." className="w-full p-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition duration-150" rows={3} maxLength={500} />
        </div>
        <div>
          <label htmlFor="source" className="block text-sm font-medium text-foreground mb-1">URL da Fonte</label>
          <input id="source" type="url" value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://exemplo.com/artigo" className="w-full p-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition duration-150" />
        </div>
        <div className="flex justify-end pt-2">
          <Button type="submit" variant="primary" disabled={content.length < 10}>
            <Plus size={20} /> Adicionar Insight
          </Button>
        </div>
      </form>
    </div>
  );
};

interface DashboardProps {
    insights: Insight[];
    onReview: (insight: Insight) => void;
    onNavigate: (page: string) => void;
    onDelete: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ insights, onReview, onNavigate, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('today');

  const filteredInsights = useMemo(() => {
    const now = Date.now();
    let result = insights;

    if (filter === 'today') {
      result = insights.filter((i) => !i.isMastered && i.nextReview <= now);
    } else if (filter === 'completed') {
      result = insights.filter((i) => i.isMastered);
    }
    
    if (searchTerm) {
      const lowerCaseSearch = searchTerm.toLowerCase();
      result = result.filter((i) => 
        i.content.toLowerCase().includes(lowerCaseSearch) ||
        (i.note && i.note.toLowerCase().includes(lowerCaseSearch)) ||
        (i.tags && i.tags.some((t) => t.toLowerCase().includes(lowerCaseSearch)))
      );
    }
    
    return result.sort((a, b) => calculatePriority(b) - calculatePriority(a));
  }, [insights, searchTerm, filter]);

  const totalInsights = insights.length;
  const completedInsights = insights.filter((i) => i.isMastered).length;
  const progress = totalInsights > 0 ? (completedInsights / totalInsights) * 100 : 0;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Seu Progresso</h2>
        <div className="mt-2">
            <div className="flex justify-between text-sm font-medium text-muted-foreground mb-1">
                <span>Insights Dominados</span>
                <span>{completedInsights} / {totalInsights}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
                <div className="bg-primary h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
        </div>
      </div>

      <div className="mb-6 space-y-4 sm:flex sm:items-center sm:justify-between sm:space-y-0">
        <div className="relative flex-grow">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar por conteúdo ou #tag..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-2 pl-10 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition" />
        </div>
        <div className="flex items-center justify-center space-x-2">
            <FilterButton active={filter === 'today'} onClick={() => setFilter('today')}>Para Revisar</FilterButton>
            <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Todos</FilterButton>
            <FilterButton active={filter === 'completed'} onClick={() => setFilter('completed')}>Dominados</FilterButton>
        </div>
      </div>

      {filteredInsights.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInsights.map((insight) => <InsightCard key={insight.id} insight={insight} onReview={onReview} onDelete={onDelete} />)}
        </div>
      ) : (
        <div className="text-center py-16 px-6 bg-muted/50 rounded-lg">
          <BrainCircuit size={48} className="mx-auto text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold text-foreground">
            {filter === 'today' ? 'Nenhuma revisão para hoje!' : 'Nenhum insight encontrado'}
          </h3>
          <p className="mt-2 text-muted-foreground">
            {filter === 'today' ? 'Você está em dia. Que tal adicionar um novo insight?' : 'Adicione um insight ou ajuste seus filtros.'}
          </p>
          <Button onClick={() => onNavigate('add')} variant="primary" className="mt-6">
            <Plus size={20}/> Adicionar Primeiro Insight
          </Button>
        </div>
      )}
    </div>
  );
};

interface FilterButtonProps {
    children: React.ReactNode;
    active: boolean;
    onClick: () => void;
}

const FilterButton: React.FC<FilterButtonProps> = ({ children, active, onClick }) => (
    <button onClick={onClick} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
        {children}
    </button>
);

interface ReviewViewProps {
    insight: Insight | null;
    onUpdateInsight: (id: string, updates: Partial<Insight>) => void;
    onBack: () => void;
}

const ReviewView: React.FC<ReviewViewProps> = ({ insight, onUpdateInsight, onBack }) => {
  useKeyPress('Escape', onBack);
  if (!insight) return <div className="text-center py-16"><h2 className="text-xl font-semibold">Nenhum insight para revisar.</h2><Button onClick={onBack} className="mt-4">Voltar</Button></div>;

  const handleReview = (rememberedWell: boolean) => {
    let newStage = rememberedWell ? Math.min(insight.reviewStage + 1, REVIEW_INTERVALS.length -1) : insight.reviewStage;
    const nextReview = getNextReviewTimestamp(newStage);
    onUpdateInsight(insight.id, { reviewStage: newStage as Insight['reviewStage'], nextReview, reviewHistory: [...insight.reviewHistory, { timestamp: Date.now(), action: 'reviewed' }] });
  };

  const handleMastered = () => {
    onUpdateInsight(insight.id, { isMastered: true, reviewHistory: [...insight.reviewHistory, { timestamp: Date.now(), action: 'mastered' }] });
  };

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center mb-6"><button onClick={onBack} className="p-2 rounded-full hover:bg-muted mr-4"><ArrowLeft /></button><h2 className="text-2xl font-bold text-foreground">Modo de Revisão</h2></div>
      <div className="bg-card p-6 sm:p-8 rounded-lg shadow-lg border border-border">
        <p className="text-lg md:text-xl text-card-foreground leading-relaxed">{insight.content}</p>
        {insight.note && <div className="mt-6 p-4 bg-warning/10 border-l-4 border-warning rounded"><p className="text-sm font-semibold text-warning mb-1">Sua nota:</p><p className="text-foreground italic">"{insight.note}"</p></div>}
        <div className="text-xs text-muted-foreground border-t border-border pt-4 mt-6">
          <p>Adicionado em: {formatDate(insight.timestamp)}</p>
          {insight.source && <p>Fonte: <a href={insight.source} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{insight.source}</a></p>}
          <p>Estágio de revisão: {insight.reviewStage + 1} / {REVIEW_INTERVALS.length}</p>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Button onClick={() => handleReview(false)} variant="warning" className="w-full h-16 text-lg"><XCircle />Revisar Mais</Button>
        <Button onClick={() => handleReview(true)} variant="success" className="w-full h-16 text-lg"><CheckCircle />Lembrei Bem</Button>
      </div>
      <div className="mt-4"><Button onClick={handleMastered} variant="secondary" className="w-full"><Zap size={16}/>Marcar como Dominado</Button></div>
    </div>
  );
};

interface AdvancedMetricsProps {
    insights: Insight[];
}

const AdvancedMetrics: React.FC<AdvancedMetricsProps> = ({ insights }) => {
    const metrics = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        
        const reviewTimestamps = insights.flatMap(i => i.reviewHistory.map(h => h.timestamp));
        const uniqueDays = Array.from(new Set(reviewTimestamps.map(t => new Date(new Date(t).getFullYear(), new Date(t).getMonth(), new Date(t).getDate()).getTime()))).sort((a,b) => b-a);
        
        let streak = 0;
        if (uniqueDays.length > 0 && (uniqueDays[0] === today || uniqueDays[0] === today - DAY_IN_MS)) {
            streak = 1;
            for (let i = 1; i < uniqueDays.length; i++) {
                if (uniqueDays[i-1] - uniqueDays[i] === DAY_IN_MS) {
                    streak++;
                } else {
                    break;
                }
            }
        }
        if (uniqueDays.length === 1 && uniqueDays[0] === today) streak = 1;

        let totalTimeToFirstReview = 0;
        let reviewedCount = 0;
        insights.forEach(i => {
            const createAction = i.reviewHistory.find(h => h.action === 'created');
            const firstReviewAction = i.reviewHistory.find(h => h.action === 'reviewed');
            if (createAction && firstReviewAction) {
                totalTimeToFirstReview += (firstReviewAction.timestamp - createAction.timestamp);
                reviewedCount++;
            }
        });
        const avgTimeToFirstReview = reviewedCount > 0 ? (totalTimeToFirstReview / reviewedCount) / DAY_IN_MS : 0;

        const stageDistribution = [0, 0, 0, 0];
        insights.filter(i => !i.isMastered).forEach(i => {
            stageDistribution[i.reviewStage]++;
        });

        const scheduledReviews = insights.filter(i => !i.isMastered && i.nextReview < Date.now()).length;
        const reviewsDone = insights.flatMap(i => i.reviewHistory).filter(h => h.action === 'reviewed').length;
        const reviewRate = (scheduledReviews + reviewsDone) > 0 ? (reviewsDone / (scheduledReviews + reviewsDone)) * 100 : 0;

        return { streak, avgTimeToFirstReview, stageDistribution, reviewRate };
    }, [insights]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card p-4 rounded-lg shadow-sm border border-border text-center">
                    <p className="text-3xl font-bold text-primary">{metrics.streak}</p>
                    <p className="text-sm text-muted-foreground">Dias de streak</p>
                </div>
                <div className="bg-card p-4 rounded-lg shadow-sm border border-border text-center">
                    <p className="text-3xl font-bold text-primary">{metrics.avgTimeToFirstReview.toFixed(1)}</p>
                    <p className="text-sm text-muted-foreground">Dias até 1ª revisão</p>
                </div>
                <div className="bg-card p-4 rounded-lg shadow-sm border border-border text-center">
                    <p className="text-3xl font-bold text-primary">{metrics.reviewRate.toFixed(0)}%</p>
                    <p className="text-sm text-muted-foreground">Taxa de revisão</p>
                </div>
            </div>
            <div>
                <h4 className="font-semibold mb-2 text-foreground">Distribuição por Estágio</h4>
                <div className="bg-card p-4 rounded-lg shadow-sm border border-border space-y-2">
                    {metrics.stageDistribution.map((count, index) => (
                        <div key={index} className="flex items-center">
                            <span className="w-20 text-sm text-muted-foreground">Estágio {index + 1}</span>
                            <div className="flex-grow bg-muted rounded-full h-4">
                                <div className="bg-primary h-4 rounded-full text-xs text-primary-foreground flex items-center justify-end pr-2" style={{width: `${(count / (insights.length || 1)) * 100}%`}}>
                                    {count > 0 && count}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

interface SettingsViewProps {
    insights: Insight[];
    onImport: (data: Insight[]) => void;
    onClearData: () => void;
    onBack: () => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ insights, onImport, onClearData, onBack, theme, toggleTheme }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; content: string; onConfirm: (() => void) | null }>({ isOpen: false, title: '', content: '', onConfirm: null });

    useKeyPress('Escape', onBack);

    const handleExport = () => {
        const dataStr = JSON.stringify(insights, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', 'clip-and-review-backup.json');
        linkElement.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const result = e.target?.result;
                if (typeof result !== 'string') throw new Error("File could not be read.");
                const importedData = JSON.parse(result);
                if (Array.isArray(importedData) && importedData.every(item => 'id' in item && 'content' in item)) {
                    setModalState({
                        isOpen: true,
                        title: "Confirmar Importação",
                        content: "Isso substituirá todos os seus dados atuais. Deseja continuar?",
                        onConfirm: () => {
                            onImport(importedData);
                            setModalState({ isOpen: false, title: '', content: '', onConfirm: null });
                        }
                    });
                } else {
                    throw new Error("Formato de arquivo inválido.");
                }
            } catch (error: any) {
                setModalState({ isOpen: true, title: "Erro de Importação", content: `Ocorreu um erro: ${error.message}`, onConfirm: null });
            }
        };
        reader.readAsText(file);
    };
    
    const confirmClearData = () => {
        setModalState({
            isOpen: true,
            title: "Apagar Todos os Dados",
            content: "TEM CERTEZA? Esta ação é irreversível e todos os seus insights serão apagados permanentemente.",
            onConfirm: () => {
                onClearData();
                setModalState({ isOpen: false, title: '', content: '', onConfirm: null });
            }
        });
    };

    return (
        <>
            <Modal 
                isOpen={modalState.isOpen}
                onClose={() => setModalState({ ...modalState, isOpen: false })}
                title={modalState.title}
                onConfirm={modalState.onConfirm}
            >
                {modalState.content}
            </Modal>
            <div className="animate-fade-in max-w-2xl mx-auto">
                <div className="flex items-center mb-6"><button onClick={onBack} className="p-2 rounded-full hover:bg-muted mr-4"><ArrowLeft /></button><h2 className="text-2xl font-bold text-foreground">Configurações</h2></div>
                <div className="space-y-8">
                    <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
                        <h3 className="text-lg font-semibold text-foreground mb-2">Aparência</h3>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Modo Escuro</span>
                            <button onClick={toggleTheme} className="p-2 rounded-full bg-muted">
                                {theme === 'dark' ? <Sun size={20} className="text-warning"/> : <Moon size={20} className="text-muted-foreground" />}
                            </button>
                        </div>
                    </div>
                    <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
                        <h3 className="text-lg font-semibold text-foreground mb-4">Configurações de Exercícios</h3>
                        <ExerciseSettings />
                    </div>
                    <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
                        <h3 className="text-lg font-semibold text-foreground mb-2">Métricas</h3>
                        <AdvancedMetrics insights={insights} />
                    </div>
                    <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
                        <h3 className="text-lg font-semibold text-foreground mb-2">Gerenciamento de Dados</h3>
                        <div className="flex flex-col sm:flex-row gap-4 mt-4">
                            <Button onClick={handleExport} variant="secondary" className="w-full"><Download size={16} /> Exportar Dados</Button>
                            <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="w-full"><Upload size={16} /> Importar Dados</Button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json"/>
                        </div>
                    </div>
                    <div className="bg-card p-6 rounded-lg shadow-sm border border-destructive/20">
                        <h3 className="text-lg font-semibold text-destructive mb-2">Zona de Perigo</h3>
                        <Button onClick={confirmClearData} variant="danger" className="w-full mt-4"><Trash2 size={16} /> Apagar Todos os Dados</Button>
                    </div>
                </div>
            </div>
        </>
    );
};

// --- NOVO COMPONENTE: PRACTICE VIEW ---

interface PracticeViewProps {
    insights: Insight[];
    onUpdateInsight: (id: string, updates: Partial<Insight>) => void;
    onBack: () => void;
}

const PracticeView: React.FC<PracticeViewProps> = ({ insights, onUpdateInsight, onBack }) => {
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [showAnswer, setShowAnswer] = useState(false);
    const [sessionResults, setSessionResults] = useState<Array<{ correct: boolean; exercise: Exercise }>>([]);
    const [sessionComplete, setSessionComplete] = useState(false);

    useKeyPress('Escape', onBack);

    // Filtrar insights elegíveis para exercícios usando a função isEligibleForExercise (Sprint 1)
    const eligibleInsights = useMemo(() => {
        return insights
            .filter(insight => isEligibleForExercise(insight))
            .sort((a, b) => {
                // Ordenar por tempo desde última prática
                const aLastExercise = a.lastExerciseDate || 0;
                const bLastExercise = b.lastExerciseDate || 0;
                return aLastExercise - bLastExercise;
            })
            .slice(0, 5); // Selecionar máximo 5 insights elegíveis por sessão
    }, [insights]);

    // Gerar exercícios para a sessão
    const exercises = useMemo(() => {
        const allExercises = eligibleInsights.slice(0, 5).flatMap(insight => generateExercises(insight));
        return allExercises.slice(0, 5); // Máximo 5 exercícios por sessão
    }, [eligibleInsights]);

    const currentExercise = exercises[currentExerciseIndex];

    const handleAnswer = (answer: string) => {
        setUserAnswer(answer);
        setShowAnswer(true);
    };

    const handleNext = () => {
        if (!currentExercise) return;

        const isCorrect = userAnswer.toLowerCase().trim() === currentExercise.correctAnswer.toLowerCase().trim();
        
        // Registrar resultado
        setSessionResults(prev => [...prev, { correct: isCorrect, exercise: currentExercise }]);

        // Atualizar histórico do insight
        const exerciseHistory = currentExercise.insight.exerciseHistory || [];
        const newExerciseEntry = {
            timestamp: Date.now(),
            type: currentExercise.type,
            correct: isCorrect
        };

        onUpdateInsight(currentExercise.insight.id, {
            lastExerciseDate: Date.now(),
            exerciseHistory: [...exerciseHistory, newExerciseEntry],
            exerciseEnabled: true
        });

        // Próximo exercício ou finalizar sessão
        if (currentExerciseIndex < exercises.length - 1) {
            setCurrentExerciseIndex(prev => prev + 1);
            setUserAnswer('');
            setShowAnswer(false);
        } else {
            setSessionComplete(true);
        }
    };

    const resetSession = () => {
        setCurrentExerciseIndex(0);
        setUserAnswer('');
        setShowAnswer(false);
        setSessionResults([]);
        setSessionComplete(false);
    };

    if (eligibleInsights.length === 0) {
        return (
            <div className="animate-fade-in max-w-2xl mx-auto">
                <div className="flex items-center mb-6">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-muted mr-4">
                        <ArrowLeft />
                    </button>
                    <h2 className="text-2xl font-bold text-foreground">Exercícios</h2>
                </div>
                <div className="text-center py-16 px-6 bg-muted/50 rounded-lg">
                    <Target size={48} className="mx-auto text-muted-foreground" />
                    <h3 className="mt-4 text-xl font-semibold text-foreground">
                        Nenhum insight disponível para exercícios
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                        Revise alguns insights até o estágio 2+ para habilitá-los para exercícios.
                    </p>
                    <Button onClick={onBack} variant="primary" className="mt-6">
                        Voltar ao Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    if (sessionComplete) {
        const correctAnswers = sessionResults.filter(r => r.correct).length;
        const accuracy = Math.round((correctAnswers / sessionResults.length) * 100);

        return (
            <div className="animate-fade-in max-w-2xl mx-auto">
                <div className="flex items-center mb-6">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-muted mr-4">
                        <ArrowLeft />
                    </button>
                    <h2 className="text-2xl font-bold text-foreground">Sessão Concluída!</h2>
                </div>
                <div className="bg-card p-8 rounded-lg shadow-lg border border-border">
                    <div className="text-center mb-6">
                        <div className="text-4xl font-bold text-primary mb-2">{accuracy}%</div>
                        <p className="text-muted-foreground">Taxa de acerto</p>
                    </div>
                    <div className="text-center mb-6">
                        <p className="text-lg text-foreground">
                            Você acertou <span className="font-bold text-success">{correctAnswers}</span> de{' '}
                            <span className="font-bold">{sessionResults.length}</span> exercícios
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <Button onClick={resetSession} variant="primary" className="flex-1">
                            <Target size={16} />
                            Nova Sessão
                        </Button>
                        <Button onClick={onBack} variant="secondary" className="flex-1">
                            Voltar
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (!currentExercise) {
        return <div>Carregando exercícios...</div>;
    }

    return (
        <div className="animate-fade-in max-w-2xl mx-auto">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-muted mr-4">
                    <ArrowLeft />
                </button>
                <h2 className="text-2xl font-bold text-foreground">Exercícios</h2>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
                <div className="flex justify-between text-sm font-medium text-muted-foreground mb-1">
                    <span>Progresso da Sessão</span>
                    <span>{currentExerciseIndex + 1} / {exercises.length}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                    <div 
                        className="bg-primary h-2.5 rounded-full transition-all duration-300" 
                        style={{ width: `${((currentExerciseIndex + 1) / exercises.length) * 100}%` }}
                    ></div>
                </div>
            </div>

            <div className="bg-card p-6 rounded-lg shadow-lg border border-border">
                {/* Insight de referência */}
                <div className="mb-6 p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
                    <p className="text-sm text-muted-foreground mb-1">Baseado no insight:</p>
                    <p className="text-sm font-medium text-foreground">{currentExercise.insight.content}</p>
                </div>

                {/* Pergunta */}
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">{currentExercise.prompt}</h3>

                    {/* Diferentes tipos de exercício */}
                    {currentExercise.type === 'fill-blank' && (
                        <input
                            type="text"
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            placeholder="Digite sua resposta..."
                            className="w-full p-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                            disabled={showAnswer}
                        />
                    )}

                    {currentExercise.type === 'multiple-choice' && currentExercise.options && (
                        <div className="space-y-2">
                            {currentExercise.options.map((option, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleAnswer(option)}
                                    disabled={showAnswer}
                                    className={`w-full p-3 text-left border border-border rounded-lg transition-colors ${
                                        userAnswer === option 
                                            ? 'bg-primary text-primary-foreground' 
                                            : 'bg-background hover:bg-muted'
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    )}

                    {currentExercise.type === 'open-answer' && (
                        <textarea
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            placeholder="Escreva sua resposta..."
                            className="w-full p-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                            rows={4}
                            disabled={showAnswer}
                        />
                    )}
                </div>

                {/* Feedback e ações */}
                {showAnswer ? (
                    <div className="space-y-4">
                        <div className={`p-4 rounded-lg border-l-4 ${
                            userAnswer.toLowerCase().trim() === currentExercise.correctAnswer.toLowerCase().trim()
                                ? 'bg-success/10 border-success text-success'
                                : 'bg-destructive/10 border-destructive text-destructive'
                        }`}>
                            <p className="font-semibold mb-1">
                                {userAnswer.toLowerCase().trim() === currentExercise.correctAnswer.toLowerCase().trim() ? '✅ Correto!' : '❌ Não foi dessa vez'}
                            </p>
                            <p>Resposta: {currentExercise.correctAnswer}</p>
                        </div>
                        <Button onClick={handleNext} variant="primary" className="w-full">
                            {currentExerciseIndex < exercises.length - 1 ? 'Próximo Exercício' : 'Finalizar Sessão'}
                        </Button>
                    </div>
                ) : (
                    <div className="flex gap-4">
                        <Button 
                            onClick={() => handleAnswer(userAnswer)} 
                            variant="primary" 
                            className="flex-1"
                            disabled={!userAnswer.trim()}
                        >
                            Responder
                        </Button>
                        {currentExercise.type === 'open-answer' && (
                            <Button 
                                onClick={() => setShowAnswer(true)} 
                                variant="secondary"
                                className="flex-1"
                            >
                                Ver Resposta
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL DA APLICAÇÃO ---
export default function App() {
  const [insights, setInsights] = useLocalStorage<Insight[]>('clipAndReview_insights', []);
  const [page, setPage] = useState('dashboard');
  const [reviewingInsight, setReviewingInsight] = useState<Insight | null>(null);
  const [theme, setTheme] = useDarkMode();

  const insightsToReviewCount = useMemo(() => {
    const now = Date.now();
    return insights.filter(i => !i.isMastered && i.nextReview <= now).length;
  }, [insights]);

  const exerciseAvailableCount = useMemo(() => {
    const now = Date.now();
    const today = new Date(now).getDate();
    
    return insights.filter(insight => {
      if (insight.reviewStage < 2 && !insight.isMastered) return false;
      
      const lastExerciseDate = insight.lastExerciseDate ? new Date(insight.lastExerciseDate).getDate() : 0;
      const exercisesToday = insight.exerciseHistory?.filter(ex => 
        new Date(ex.timestamp).getDate() === today
      ).length || 0;
      
      return lastExerciseDate !== today || exercisesToday < 3;
    }).length;
  }, [insights]);

  const handleAddInsight = useCallback(({ content, note, source, tags }: { content: string; note: string; source: string; tags: string[] }) => {
    const now = Date.now();
    const newInsight: Insight = {
      id: crypto.randomUUID(),
      content, note, source, tags,
      timestamp: now,
      reviewStage: 0,
      nextReview: getNextReviewTimestamp(0),
      isMastered: false,
      reviewHistory: [{ timestamp: now, action: 'created' }],
      exerciseEnabled: false,
      exerciseHistory: []
    };
    setInsights(prev => [...prev, newInsight]);
    setPage('dashboard');
  }, [setInsights]);

  const handleUpdateInsight = useCallback((id: string, updates: Partial<Insight>) => {
    setInsights(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    if (page === 'review') {
        const now = Date.now();
        const nextToReview = insights
            .filter(i => i.id !== id && !i.isMastered && i.nextReview <= now)
            .sort((a, b) => calculatePriority(b) - calculatePriority(a));
        
        if (nextToReview.length > 0) {
            setReviewingInsight(nextToReview[0]);
        } else {
            setPage('dashboard');
            setReviewingInsight(null);
        }
    }
  }, [insights, setInsights, page]);

  const handleStartReview = useCallback((insight: Insight) => {
    setReviewingInsight(insight);
    setPage('review');
  }, []);

  const handleDeleteInsight = useCallback((id: string) => {
    if (confirm('Tem certeza que deseja deletar este insight?')) {
      setInsights(prev => prev.filter(i => i.id !== id));
    }
  }, [setInsights]);

  const handleNavigate = (targetPage: string) => {
    if (targetPage === 'review') {
        const now = Date.now();
        const firstToReview = insights
            .filter(i => !i.isMastered && i.nextReview <= now)
            .sort((a, b) => calculatePriority(b) - calculatePriority(a))[0];
        
        if (firstToReview) {
            setReviewingInsight(firstToReview);
            setPage('review');
        } else {
            alert("Você está em dia com suas revisões!");
        }
    } else {
        setPage(targetPage);
    }
  };

  const renderPage = () => {
    switch (page) {
      case 'add':
        return <AddInsightForm onAddInsight={handleAddInsight} onBack={() => setPage('dashboard')} />;
      case 'review':
        return <ReviewView insight={reviewingInsight} onUpdateInsight={handleUpdateInsight} onBack={() => setPage('dashboard')} />;
      case 'practice':
        return <PracticeView insights={insights} onUpdateInsight={handleUpdateInsight} onBack={() => setPage('dashboard')} />;
      case 'settings':
        return <SettingsView insights={insights} onImport={setInsights} onClearData={() => setInsights([])} onBack={() => setPage('dashboard')} theme={theme} toggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')} />;
      default:
        return <Dashboard insights={insights} onReview={handleStartReview} onNavigate={handleNavigate} onDelete={handleDeleteInsight} />;
    }
  };

  return (
    <div className="bg-background min-h-screen font-sans text-foreground">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap'); body { font-family: 'Inter', sans-serif; } .animate-fade-in { animation: fadeIn 0.3s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      
      <header className="hidden md:flex bg-card/80 backdrop-blur-lg border-b border-border sticky top-0 z-10">
        <nav className="container mx-auto px-6 py-3 flex justify-between items-center max-w-6xl">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setPage('dashboard')}><BrainCircuit className="text-primary" /><h1 className="text-xl font-bold text-foreground">Clip & Review</h1></div>
          <div className="flex items-center gap-6">
            <button onClick={() => handleNavigate('dashboard')} className={`font-medium ${page === 'dashboard' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>Dashboard</button>
            <button onClick={() => handleNavigate('add')} className={`font-medium ${page === 'add' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>Adicionar</button>
            <button onClick={() => handleNavigate('practice')} className={`font-medium ${page === 'practice' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>Exercícios</button>
            <button onClick={() => handleNavigate('settings')} className={`font-medium ${page === 'settings' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>Configurações</button>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => handleNavigate('practice')} disabled={exerciseAvailableCount === 0} variant="secondary">
              <Target size={18} />Praticar ({exerciseAvailableCount})
            </Button>
            <Button onClick={() => handleNavigate('review')} disabled={insightsToReviewCount === 0}>
              <BookOpen size={18} />Revisar ({insightsToReviewCount})
            </Button>
            <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 rounded-full hover:bg-muted">
              <span className="sr-only">Toggle theme</span>
              {theme === 'dark' ? <Sun /> : <Moon />}
            </button>
          </div>
        </nav>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-6xl md:pb-16">{renderPage()}</main>

      <footer className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border p-2 flex justify-around items-center z-10">
        <NavButtonMobile label="Dashboard" icon={<Search />} active={page === 'dashboard'} onClick={() => handleNavigate('dashboard')} />
        <NavButtonMobile label="Adicionar" icon={<Plus />} active={page === 'add'} onClick={() => handleNavigate('add')} />
        <div className="relative">
            <Button onClick={() => handleNavigate('practice')} disabled={exerciseAvailableCount === 0} className="w-16 h-16 rounded-full shadow-lg -mt-8"><Target /></Button>
            {exerciseAvailableCount > 0 && <span className="absolute -top-6 right-0 block h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{exerciseAvailableCount}</span>}
        </div>
        <NavButtonMobile label="Revisar" icon={<BookOpen />} active={page === 'review'} onClick={() => handleNavigate('review')} />
        <NavButtonMobile label="Ajustes" icon={<Settings />} active={page === 'settings'} onClick={() => handleNavigate('settings')} />
      </footer>
       <div className="h-24 md:hidden"></div>
    </div>
  );
}

interface NavButtonMobileProps {
    label: string;
    icon: React.ReactElement;
    active: boolean;
    onClick: () => void;
    className?: string;
}

const NavButtonMobile: React.FC<NavButtonMobileProps> = ({ label, icon, active, onClick, className = '' }) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center text-xs w-20 h-14 rounded-lg transition-colors ${active ? 'text-primary bg-primary/10' : 'text-muted-foreground'} ${className}`}>
        {React.cloneElement(icon, { size: 24 })}
        <span className="mt-1">{label}</span>
    </button>
);